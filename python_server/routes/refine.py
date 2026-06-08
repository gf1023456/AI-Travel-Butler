"""
AI Travel Butler - /api/plan/refine 异步优化方案

架构：
1. 创建异步优化任务，立即返回 taskId
2. 后台执行优化流程
3. 客户端轮询获取状态和结果
"""

import json
import uuid
import asyncio
import traceback
from typing import Dict, Any, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header

from config import settings
from database import db
from auth import get_current_user_id

router = APIRouter(prefix="/api/plan", tags=["优化"])

# 内存任务存储
_refine_task_store: Dict[str, Dict[str, Any]] = {}

# 清理任务句柄
_cleanup_task = None


async def _cleanup_refine_tasks():
    """每 5 分钟清理一次 10 分钟前的已完成/失败任务"""
    while True:
        await asyncio.sleep(300)
        now = datetime.now().timestamp()
        expired = [
            tid for tid, task in _refine_task_store.items()
            if task.get("status") in ("completed", "failed")
            and now - task.get("completed_at", now) > 600
        ]
        for tid in expired:
            del _refine_task_store[tid]
            print(f"[Refine] Cleaned up expired task {tid}")


def _ensure_cleanup_task():
    """确保清理任务在运行"""
    global _cleanup_task
    if _cleanup_task is None or _cleanup_task.done():
        try:
            loop = asyncio.get_running_loop()
            _cleanup_task = loop.create_task(_cleanup_refine_tasks())
            print("[Refine] Cleanup task started")
        except RuntimeError:
            pass  # 没有运行的事件循环，稍后再试


def generate_refine_summary(refine_instruction: str, original_summary: str = "") -> str:
    """根据优化指令生成个性化的行程摘要"""
    if not refine_instruction:
        return original_summary or "行程已优化完成"

    instruction = refine_instruction.lower()

    # 美食相关
    if any(kw in instruction for kw in ["美食", "吃", "餐厅", "小吃", "味道", "特色菜", "必吃"]):
        return "美食升级！精选当地特色餐厅与街头小吃"

    # 拍照/打卡
    if any(kw in instruction for kw in ["拍照", "打卡", "摄影", "出片", "网红", "机位", "照片"]):
        return "出片率UP！精选最佳拍照打卡点与机位"

    # 轻松/休闲
    if any(kw in instruction for kw in ["轻松", "休闲", "慢", "舒服", "不累", "放松", "舒适"]):
        return "节奏优化！行程更轻松，享受慢旅行时光"

    # 文化/历史
    if any(kw in instruction for kw in ["文化", "历史", "博物馆", "古迹", "人文", "艺术", "传统"]):
        return "深度文化游！融入历史人文与艺术体验"

    # 亲子/家庭
    if any(kw in instruction for kw in ["亲子", "孩子", "家庭", "儿童", "小孩", "带娃", "全家"]):
        return "亲子友好！适合全家出游的精选行程"

    # 浪漫/情侣
    if any(kw in instruction for kw in ["浪漫", "情侣", "约会", "蜜月", "二人", "爱情", "夜景"]):
        return "浪漫升级！情侣专属甜蜜行程"

    # 购物
    if any(kw in instruction for kw in ["购物", "买", "逛街", "商场", "特产", "手信", "纪念品"]):
        return "购物指南！精选必买特产与逛街好去处"

    # 自然/户外
    if any(kw in instruction for kw in ["自然", "户外", "徒步", "登山", "风景", "山水", "公园"]):
        return "亲近自然！户外风光与自然体验之旅"

    # 夜景/晚上
    if any(kw in instruction for kw in ["夜景", "晚上", "夜生活", "灯光", "夜市", "夜游"]):
        return "夜游指南！璀璨夜景与夜间精彩体验"

    # 省钱/预算
    if any(kw in instruction for kw in ["省钱", "便宜", "预算", "免费", "性价比", "经济", "实惠"]):
        return "高性价比！精选实惠又好玩的行程"

    # 增加/添加
    if any(kw in instruction for kw in ["增加", "添加", "加入", "补充", "更多", "加上"]):
        return "内容更丰富！根据您的需求补充更多精彩"

    # 删除/减少
    if any(kw in instruction for kw in ["删除", "减少", "去掉", "移除", "不要", "取消"]):
        return "行程精简！去除冗余，保留精华体验"

    # 调整顺序/时间
    if any(kw in instruction for kw in ["顺序", "时间", "调整", "改", "换", "重新安排"]):
        return "行程优化！时间安排更合理，体验更顺畅"

    # 默认
    return original_summary or "行程已优化完成，更符合您的需求"


def to_refine_payload(payload: Dict) -> Dict:
    """Convert refine request to plan payload"""
    base_plan = payload.get("basePlan", {})
    base_summary = base_plan.get("itinerarySummary", "")
    items = base_plan.get("items", [])

    if len(base_summary) > 200:
        base_summary = base_summary[:200] + "..."

    refine_instruction = payload.get('refineInstruction', '')
    user_input_parts = [f"优化需求：{refine_instruction}"]

    if base_summary:
        user_input_parts.append(f"行程主题：{base_summary}")

    if items and len(items) > 0:
        itinerary_desc = []
        for day in items:
            day_num = day.get('day', 0)
            day_items = day.get('items', [])
            if day_items:
                names = [item.get('name', '') for item in day_items if item.get('name')]
                if names:
                    itinerary_desc.append(f"第{day_num}天：{', '.join(names)}")
        if itinerary_desc:
            user_input_parts.append("当前行程：" + "；".join(itinerary_desc[:5]))

    user_input_parts.append(payload.get("userInput", ""))

    return {
        **payload,
        "userInput": "\n".join(user_input_parts)
    }


async def _execute_refine_task(task_id: str, payload: Dict):
    """后台执行优化任务"""
    _refine_task_store[task_id] = {
        "status": "running",
        "created_at": datetime.now().timestamp(),
    }

    try:
        print(f"\n{'=' * 60}\n[Refine] Task {task_id} started\n{'=' * 60}")

        # 导入需要的模块
        from app import (
            validate_payload, choose_rollout_provider, retrieve_evidence,
            build_rag_context, construct_user_prompt, call_ai_model_for_refine,
            extract_expected_city_from_input, harmonize_itinerary_city,
            ensure_minimum_items_by_requested_days, fetch_real_weather,
            enrich_with_mcp_signals, enrich_images, verify_plan
        )

        refined_payload = to_refine_payload(payload)
        error = validate_payload(refined_payload)
        if error:
            raise ValueError(error)

        mcp_trace = [f"refine_async:{task_id}:started"]

        # 获取 RAG 证据
        evidence = await retrieve_evidence(payload.get("userInput", ""), settings.rag.top_k)
        mcp_trace.append(f"rag:retrieved:{len(evidence)}")

        rag_context = build_rag_context(evidence)
        prompt = construct_user_prompt(
            payload.get("userInput", ""),
            payload.get("isPlannerMode", True),
            payload.get("travelMode", "deep"),
            rag_context
        )

        chosen = choose_rollout_provider(payload)
        mcp_trace.append(f"refine:{chosen['provider']}:{chosen['modelType']}")

        # 执行 AI 优化
        plan = await call_ai_model_for_refine(
            chosen["provider"],
            chosen["modelType"],
            prompt,
            refined_payload.get("userInput", ""),
            mcp_trace,
            task_id
        )

        # 后处理
        expected_city = extract_expected_city_from_input(payload.get("userInput", ""), plan.get("socialRecommendations", []))
        if expected_city:
            plan["dayPlanItinerary"] = harmonize_itinerary_city(plan.get("dayPlanItinerary", []), expected_city, mcp_trace)

        plan["dayPlanItinerary"] = ensure_minimum_items_by_requested_days(
            plan.get("dayPlanItinerary", []),
            payload.get("userInput", ""),
            plan.get("socialRecommendations", []),
            chosen["provider"],
            mcp_trace
        )

        real_weather = await fetch_real_weather(plan.get("dayPlanItinerary", []), mcp_trace)
        plan["dayPlanItinerary"] = enrich_with_mcp_signals(plan.get("dayPlanItinerary", []), mcp_trace, real_weather)
        plan["dayPlanItinerary"] = await enrich_images(plan.get("dayPlanItinerary", []), mcp_trace)

        warnings = verify_plan(plan.get("dayPlanItinerary", []), mcp_trace)
        plan["warnings"] = warnings
        plan["mcpTrace"] = mcp_trace
        plan["requestId"] = task_id

        # 生成个性化摘要文案
        refine_instruction = payload.get("refineInstruction", "").strip()
        plan["itinerarySummary"] = generate_refine_summary(refine_instruction, plan.get("itinerarySummary", ""))

        # 标记完成
        _refine_task_store[task_id] = {
            "status": "completed",
            "result": plan,
            "created_at": _refine_task_store[task_id]["created_at"],
            "completed_at": datetime.now().timestamp(),
        }

        elapsed = datetime.now().timestamp() - _refine_task_store[task_id]["created_at"]
        print(f"[Refine] Task {task_id} completed, elapsed={elapsed:.1f}s")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
        traceback_str = traceback.format_exc()
        print(f"[Refine] Task {task_id} failed: {error_msg}\n{traceback_str}")
        _refine_task_store[task_id] = {
            "status": "failed",
            "error": error_msg,
            "created_at": _refine_task_store[task_id].get("created_at", datetime.now().timestamp()),
            "completed_at": datetime.now().timestamp(),
        }


@router.post("/refine/async")
async def refine_plan_async(payload: Dict, authorization: str = Header(None)):
    """创建异步优化任务，立即返回 taskId"""
    # 1. 检查登录状态
    if not authorization:
        raise HTTPException(status_code=401, detail="请先登录")

    try:
        current_user_id = get_current_user_id(authorization)
    except HTTPException:
        raise HTTPException(status_code=401, detail="登录已过期")

    # 2. 检查额度
    quota = db.check_user_quota(current_user_id)
    if not quota.get("can_use", True):
        raise HTTPException(status_code=403, detail="今日次数已用完，邀请好友可获得额外配额")

    # 3. 消耗额度
    db.increment_usage(current_user_id)
    print(f"[Refine] User {current_user_id} quota consumed, remaining={quota.get('remaining', 0) - 1}")

    # 4. 确保清理任务在运行
    _ensure_cleanup_task()

    task_id = str(uuid.uuid4())
    print(f"\n{'=' * 60}\n[Refine Async] Request {task_id} user={current_user_id}\n{'=' * 60}")

    refine_instruction = payload.get("refineInstruction", "").strip()
    if not refine_instruction:
        raise HTTPException(status_code=400, detail="refineInstruction 不能为空")

    asyncio.create_task(_execute_refine_task(task_id, payload))
    return {"taskId": task_id, "status": "pending"}


@router.get("/refine/status/{task_id}")
async def get_refine_status(task_id: str):
    """查询优化任务状态"""
    task = _refine_task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

    result = {"taskId": task_id, "status": task["status"]}

    if task.get("completed_at") and task.get("created_at"):
        result["elapsed_ms"] = int((task["completed_at"] - task["created_at"]) * 1000)

    return result


@router.get("/refine/result/{task_id}")
async def get_refine_result(task_id: str):
    """获取优化任务结果"""
    task = _refine_task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

    if task["status"] == "failed":
        del _refine_task_store[task_id]
        raise HTTPException(status_code=502, detail=task.get("error", "任务执行失败"))

    if task["status"] == "completed":
        result = task.get("result", {}).copy()
        result["_taskId"] = task_id
        return result

    raise HTTPException(status_code=400, detail=f"任务尚未完成，当前状态: {task.get('status', 'unknown')}")
