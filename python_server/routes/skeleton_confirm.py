"""
AI Travel Butler - /api/skeleton/confirm 确认/调整中间态 API

支持用户在骨架生成后进行景点确认、删除、调整顺序，然后再生成完整方案
"""

import json
import uuid
import asyncio
from typing import Dict, Any, List
from datetime import datetime

from fastapi import APIRouter, HTTPException

from routes.plan_v4 import _v4_task_store, _call_model, _parse_json_from_model, _fetch_weather
from modules.image_fetcher import enrich_images
from modules.post_processor import enrich_with_mcp_signals
from modules.verifier import verify_plan
from config import settings

router = APIRouter(prefix="/api/skeleton", tags=["骨架确认"])

# 存储用户确认后的骨架数据
_skeleton_confirm_store: Dict[str, Dict[str, Any]] = {}


async def _fill_reasons(day_plan_itinerary: List[Dict], city: str):
    """为没有 reason 的景点生成推荐理由"""
    spots_without_reason = [s for s in day_plan_itinerary if not s.get("reason")]
    if not spots_without_reason:
        return

    spots_desc = []
    for s in spots_without_reason:
        spots_desc.append(f"- {s.get('name', '')}（{s.get('description', '')[:30]}）")

    prompt = f"""你是一位旅行推荐专家。请为以下景点各生成一句推荐理由（15-25字，有温度感，像朋友在推荐）。

城市：{city}
景点：
{chr(10).join(spots_desc)}

输出格式（严格 JSON）：
```json
{{
  "reasons": [
    {{"name": "景点名", "reason": "推荐理由"}}
  ]
}}
```"""

    try:
        provider = settings.rollout.primary_provider
        model = {
            "gemini": settings.providers.default_gemini_model,
            "deepseek": settings.providers.default_deepseek_model,
            "zhipu": settings.providers.default_zhipu_model,
            "dashscope": settings.providers.default_dashscope_model,
            "mimo": settings.providers.default_mimo_model,
        }.get(provider, settings.providers.default_deepseek_model)

        content = await _call_model(prompt, provider, model)
        data = _parse_json_from_model(content)
        reasons = data.get("reasons", [])

        name_to_reason = {r.get("name", ""): r.get("reason", "") for r in reasons}
        for s in day_plan_itinerary:
            if not s.get("reason") and s.get("name") in name_to_reason:
                s["reason"] = name_to_reason[s["name"]]
                print(f"[SkeletonConfirm] Filled reason for {s['name']}: {s['reason']}")
    except Exception as e:
        print(f"[SkeletonConfirm] _fill_reasons error: {e}")


async def _cleanup_skeleton_confirm_tasks():
    """每 5 分钟清理一次 30 分钟前的确认任务"""
    while True:
        await asyncio.sleep(300)
        now = datetime.now().timestamp()
        expired = [
            tid for tid, task in _skeleton_confirm_store.items()
            if now - task.get("confirmed_at", now) > 1800
        ]
        for tid in expired:
            del _skeleton_confirm_store[tid]
            print(f"[SkeletonConfirm] Cleaned up expired task {tid}")


# ========== API 路由 ==========

@router.post("/confirm")
async def confirm_skeleton(payload: Dict):
    """
    用户确认/调整骨架后，保存确认结果并生成完整方案
    
    请求体：
    {
        "taskId": "原任务ID",
        "confirmedSpots": [
            {"name": "景点名", "day": 1, "sequence": 1, "deleted": false}
        ],
        "adjustments": {
            "days": 3,  // 调整后的天数
            "notes": "用户备注"
        }
    }
    """
    task_id = payload.get("taskId")
    print(f"[SkeletonConfirm] 收到确认请求 taskId={task_id}, spots={len(payload.get('confirmedSpots', []))}")
    if not task_id:
        raise HTTPException(status_code=400, detail="taskId 不能为空")
    
    # 获取原骨架数据
    original_task = _v4_task_store.get(task_id)
    if not original_task:
        print(f"[SkeletonConfirm] 任务不存在: {task_id}")
        raise HTTPException(status_code=404, detail="原任务不存在或已过期")
    
    if original_task.get("status") not in ("skeleton_ready", "completed"):
        raise HTTPException(status_code=400, detail=f"任务状态不正确: {original_task.get('status')}")
    
    confirmed_spots = payload.get("confirmedSpots", [])
    adjustments = payload.get("adjustments", {})
    
    # 获取原结果
    original_result = original_task.get("result", {})
    
    # 应用用户调整
    day_plan_itinerary = original_result.get("dayPlanItinerary", [])
    
    # 处理删除的景点
    deleted_names = {s.get("name") for s in confirmed_spots if s.get("deleted")}
    filtered_itinerary = [item for item in day_plan_itinerary if item.get("name") not in deleted_names]
    
    # 收集原骨架中所有景点名
    original_names = {item.get("name") for item in day_plan_itinerary}
    
    # 处理顺序调整 + 新增景点
    if confirmed_spots:
        # 构建新的顺序映射
        order_map = {}
        new_spots = []
        for spot in confirmed_spots:
            if not spot.get("deleted"):
                name = spot.get("name")
                order_map[name] = {
                    "day": spot.get("day", 1),
                    "sequence": spot.get("sequence", 1)
                }
                # 如果是用户新增的景点（不在原骨架中），创建新条目
                if spot.get("isUserAdded") and name not in original_names:
                    new_item = {
                        "name": name,
                        "city": spot.get("city", ""),
                        "description": spot.get("description", "用户自定义景点"),
                        "reason": spot.get("reason", ""),
                        "lat": spot.get("lat") or 0,
                        "lng": spot.get("lng") or 0,
                        "time": spot.get("time", ""),
                        "day": spot.get("day", 1),
                        "sequence": spot.get("sequence", 1),
                        "transit_hint": "",
                        "image": "",
                        "source": "user_added"
                    }
                    new_spots.append(new_item)
        
        # 添加用户新增的景点
        filtered_itinerary.extend(new_spots)
        
        # 更新每个景点的 day 和 sequence
        for item in filtered_itinerary:
            name = item.get("name")
            if name in order_map:
                item["day"] = order_map[name]["day"]
                item["sequence"] = order_map[name]["sequence"]
        
        # 重新排序
        filtered_itinerary.sort(key=lambda x: (x.get("day", 1), x.get("sequence", 1)))
    
    # 如果调整了天数，需要重新分配
    new_days = adjustments.get("days")
    if new_days and new_days != original_result.get("days"):
        # 简单的重新分配逻辑：平均分配到每天
        items_per_day = max(1, len(filtered_itinerary) // new_days)
        for idx, item in enumerate(filtered_itinerary):
            item["day"] = min(idx // items_per_day + 1, new_days)
            item["sequence"] = (idx % items_per_day) + 1
    
    # 构建确认后的结果
    confirmed_result = {
        **original_result,
        "dayPlanItinerary": filtered_itinerary,
        "_confirmed": True,
        "_confirmedAt": datetime.now().isoformat(),
        "_originalTaskId": task_id,
        "_adjustments": adjustments
    }
    
    # 重新构建 days 列表，并确保 sequence 连续不重复
    days_list = []
    max_day = max([item.get("day", 1) for item in filtered_itinerary] + [1])
    for day_num in range(1, max_day + 1):
        day_items = [item for item in filtered_itinerary if item.get("day") == day_num]
        # 按原始 sequence 排序，然后重新分配连续的 sequence
        day_items.sort(key=lambda x: x.get("sequence", 1))
        for seq, item in enumerate(day_items, start=1):
            item["sequence"] = seq
        days_list.append({"day": day_num, "itinerary": day_items})
    
    confirmed_result["days"] = days_list
    
    # 存储确认结果
    confirm_id = str(uuid.uuid4())
    _skeleton_confirm_store[confirm_id] = {
        "status": "confirmed",
        "result": confirmed_result,
        "confirmed_at": datetime.now().timestamp(),
        "original_task_id": task_id
    }
    
    # 启动后台任务：为确认的景点填充详细信息
    asyncio.create_task(_fill_confirmed_plan(confirm_id, confirmed_result))
    
    return {
        "confirmId": confirm_id,
        "status": "filling",
        "message": "骨架已确认，正在生成完整方案"
    }


@router.get("/confirm/status/{confirm_id}")
async def get_confirm_status(confirm_id: str):
    """查询确认任务状态"""
    task = _skeleton_confirm_store.get(confirm_id)
    if not task:
        raise HTTPException(status_code=404, detail="确认任务不存在或已过期")
    
    result = {
        "confirmId": confirm_id,
        "status": task["status"],
        "originalTaskId": task.get("original_task_id")
    }
    
    if task.get("filled_at") and task.get("confirmed_at"):
        result["fillElapsedMs"] = int((task["filled_at"] - task["confirmed_at"]) * 1000)
    
    return result


@router.get("/confirm/result/{confirm_id}")
async def get_confirm_result(confirm_id: str):
    """获取确认后的完整方案结果"""
    task = _skeleton_confirm_store.get(confirm_id)
    if not task:
        raise HTTPException(status_code=404, detail="确认任务不存在或已过期")
    
    if task["status"] == "failed":
        del _skeleton_confirm_store[confirm_id]
        raise HTTPException(status_code=502, detail=task.get("error", "任务执行失败"))
    
    if task["status"] in ("confirmed", "filling", "completed"):
        result = task.get("result", {}).copy()
        result["_stage"] = task["status"]
        result["_confirmId"] = confirm_id
        return result
    
    raise HTTPException(status_code=400, detail=f"任务状态不正确: {task.get('status', 'unknown')}")


@router.post("/regenerate")
async def regenerate_skeleton(payload: Dict):
    """
    用户不满意，重新生成骨架
    直接调用 plan_v4 重新生成
    """
    from routes.plan_v4 import _execute_plan_v4_task
    
    task_id = str(uuid.uuid4())
    user_input = payload.get("userInput", "")
    
    if not user_input:
        raise HTTPException(status_code=400, detail="userInput 不能为空")
    
    # 添加随机性提示
    modified_input = f"{user_input}（请生成不同的行程方案）"
    payload["userInput"] = modified_input
    
    asyncio.create_task(_execute_plan_v4_task(task_id, payload))
    
    return {
        "taskId": task_id,
        "status": "pending",
        "message": "正在重新生成骨架"
    }


# ========== 后台填充任务 ==========

async def _fill_confirmed_plan(confirm_id: str, confirmed_result: Dict):
    """为确认的骨架填充详细信息"""
    try:
        day_plan_itinerary = confirmed_result.get("dayPlanItinerary", [])
        user_added = [i for i in day_plan_itinerary if i.get("source") == "user_added"]
        print(f"\n{'=' * 60}\n[SkeletonConfirm] Filling plan {confirm_id} ({len(day_plan_itinerary)} spots, {len(user_added)} user-added)\n{'=' * 60}")
        
        _skeleton_confirm_store[confirm_id]["status"] = "filling"
        
        day_plan_itinerary = confirmed_result.get("dayPlanItinerary", [])
        city = confirmed_result.get("days", [{}])[0].get("itinerary", [{}])[0].get("city", "") if confirmed_result.get("days") else ""
        
        if not city and day_plan_itinerary:
            city = day_plan_itinerary[0].get("city", "")
        
        # 并行获取图片和天气
        mcp_trace = confirmed_result.get("mcpTrace", [])
        image_task = asyncio.create_task(enrich_images(day_plan_itinerary, mcp_trace))
        weather_task = asyncio.create_task(_fetch_weather(day_plan_itinerary))
        
        try:
            await asyncio.wait_for(image_task, timeout=15.0)
        except asyncio.TimeoutError:
            print(f"[SkeletonConfirm {confirm_id}] Image fetch timeout")
        except Exception as e:
            print(f"[SkeletonConfirm {confirm_id}] Image fetch error: {e}")
        
        try:
            real_weather = await weather_task
        except Exception as e:
            print(f"[SkeletonConfirm {confirm_id}] Weather fetch error: {e}")
            real_weather = None
        
        # 后处理（带错误保护）
        try:
            day_plan_itinerary = enrich_with_mcp_signals(day_plan_itinerary, mcp_trace, real_weather)
        except Exception as e:
            print(f"[SkeletonConfirm {confirm_id}] MCP signals error: {e}")
        
        # 为没有 reason 的景点生成推荐理由
        try:
            await _fill_reasons(day_plan_itinerary, city)
        except Exception as e:
            print(f"[SkeletonConfirm {confirm_id}] Fill reasons error: {e}")
        
        # 验证（带错误保护）
        warnings = []
        try:
            warnings = verify_plan(day_plan_itinerary, mcp_trace)
        except Exception as e:
            print(f"[SkeletonConfirm {confirm_id}] Verify error: {e}")
        
        # 更新结果
        confirmed_result["dayPlanItinerary"] = day_plan_itinerary
        confirmed_result["warnings"] = warnings
        confirmed_result["mcpTrace"] = mcp_trace
        confirmed_result["_filledAt"] = datetime.now().isoformat()
        
        # 更新 days 列表中的图片和reason
        for day in confirmed_result.get("days", []):
            for item in day.get("itinerary", []):
                name = item.get("name")
                # 从 day_plan_itinerary 中找到对应的完整数据
                full_item = next((i for i in day_plan_itinerary if i.get("name") == name), None)
                if full_item:
                    item["image"] = full_item.get("image", "")
                    item["description"] = full_item.get("description", item.get("description", ""))
                    item["reason"] = full_item.get("reason", item.get("reason", ""))
                    item["transit_hint"] = full_item.get("transit_hint", item.get("transit_hint", ""))
                    item["time"] = full_item.get("time", item.get("time", ""))
        
        _skeleton_confirm_store[confirm_id]["result"] = confirmed_result
        _skeleton_confirm_store[confirm_id]["status"] = "completed"
        _skeleton_confirm_store[confirm_id]["filled_at"] = datetime.now().timestamp()
        
        print(f"[SkeletonConfirm] Done: {len(day_plan_itinerary)} locations")
        
    except Exception as e:
        print(f"[SkeletonConfirm] Task {confirm_id} failed: {e}")
        import traceback
        traceback.print_exc()
        _skeleton_confirm_store[confirm_id]["status"] = "failed"
        _skeleton_confirm_store[confirm_id]["error"] = str(e)
