"""
AI Travel Butler - /api/plan/v4 骨架优先渐进加载方案

架构：
1. 骨架生成（AI 调用 1）：输出城市 + 天数 + 每天具体地点列表
2. 立即返回骨架：status = "skeleton_ready"，客户端可渲染时间轴
3. 后台并行填充：
   - 填充详情（AI 调用 2）：为已知地点生成描述、坐标、时间
   - 获取图片：并行获取所有地点图片
   - 获取天气：实时天气
4. 最终状态：status = "completed"

相比 v2 的优势：
- 用户 30-60s 即可看到骨架（地点列表 + 时间轴）
- 完整内容在后台静默填充，客户端轮询自动更新
- 两次 AI 调用各自 scope 更小，更可控
"""

import json
import uuid
import asyncio
import re
import traceback
from typing import Dict, Any, List
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException

from config import settings, API_ENDPOINTS
from modules.image_fetcher import enrich_images
from modules.post_processor import enrich_with_mcp_signals
from modules.verifier import verify_plan

router = APIRouter(prefix="/api/plan", tags=["规划 v4"])

# 内存任务存储（与 v2 隔离）
_v4_task_store: Dict[str, Dict[str, Any]] = {}


async def _cleanup_v4_tasks():
    """每 5 分钟清理一次 10 分钟前的已完成/失败任务"""
    while True:
        await asyncio.sleep(300)
        now = datetime.now().timestamp()
        expired = [
            tid for tid, task in _v4_task_store.items()
            if task.get("status") in ("completed", "failed", "skeleton_ready")
            and now - task.get("completed_at", now) > 600
        ]
        for tid in expired:
            del _v4_task_store[tid]
            print(f"[PlanV4] Cleaned up expired task {tid}")


# ========== Prompt 定义 ==========

V4_SKELETON_PROMPT = """你是一位行程规划专家。请根据用户需求，输出完整的行程规划（含真实经纬度）。

约束：
- 每天至少 3 个地点
- 地点必须是真实存在的景点
- 每个地点需要一句话简介（15-30字），包含看点或特色
- 每个地点需要一句话推荐理由（15-25字，有温度感，像朋友在推荐）
- 相邻天的地点应地理接近，合理安排路线
- 如果用户未指定天数，默认 1 天
- 必须输出真实经纬度（lat/lng）
- 输出完毕之前在检查一下地点是否真实存在
输出格式（严格 JSON，不要额外文字）：
```json
{{
  "city": "城市名",
  "days": 3,
  "travel_mode": "deep",
  "summary": "一句话行程概述",
  "daily_plan": [
    {{
      "day": 1,
      "locations": [
        {{"name": "景点1", "brief": "景点简介（15-30字）", "reason": "推荐理由（15-25字，有温度感）", "lat": 39.9, "lng": 116.4}},
        {{"name": "景点2", "brief": "景点简介（15-30字）", "reason": "推荐理由（15-25字，有温度感）", "lat": 39.95, "lng": 116.45}},
        {{"name": "景点3", "brief": "景点简介（15-30字）", "reason": "推荐理由（15-25字，有温度感）", "lat": 40.0, "lng": 116.5}}
      ]
    }}
  ]
}}
```"""


def _build_fill_prompt(skeleton: dict) -> str:
    """根据骨架构建填充 Prompt"""
    city = skeleton.get("city", "")
    days = skeleton.get("days", 1)
    daily_plan = skeleton.get("daily_plan", [])

    locations_lines = []
    for day_info in daily_plan:
        day_num = day_info.get("day", 1)
        locations = day_info.get("locations", [])
        # 支持新格式 [{"name": "...", "brief": "..."}] 和旧格式 ["景点名"]
        names = []
        for loc in locations:
            if isinstance(loc, dict):
                names.append(loc.get("name", ""))
            else:
                names.append(str(loc))
        locations_lines.append(f"Day {day_num}: {', '.join(names)}")

    locations_str = "\n".join(locations_lines)

    return f"""你是一位行程填充专家。请为以下骨架中的每个地点生成详细信息。

骨架：
城市：{city}
天数：{days}

地点列表：
{locations_str}

请为每个地点输出：
- description: 50字以上介绍（包含看点和游玩建议）
- reason: 一句话推荐理由（为什么推荐这个景点给用户，15-25字，要有温度感，像朋友在推荐）
- lat: 真实纬度
- lng: 真实经度
- time: 建议游览时间段（如 "09:00 - 11:00"）
- transit_hint: 从上一个地点到此的交通建议

输出格式（严格 JSON，不要额外文字）：
```json
{{
  "itinerary": [
    {{
      "name": "地点名",
      "description": "...",
      "reason": "推荐理由（一句话，有温度感）",
      "lat": 39.9,
      "lng": 116.4,
      "time": "09:00 - 11:00",
      "day": 1,
      "sequence": 1,
      "transit_hint": "...",
      "city": "{city}"
    }}
  ],
  "socialRecommendations": [
    {{
      "rank": 1,
      "title": "推荐打卡点",
      "platform": "xiaohongshu",
      "hot_score": "9.2",
      "reason": "推荐理由",
      "photo_tips": "拍照技巧"
    }}
  ]
}}
```"""


# ========== 模型调用 ==========

async def _call_model(provider: str, model: str, messages: List[Dict], request_id: str, max_tokens: int = 5000) -> Dict:
    """单轮调用 AI 模型"""
    endpoint = API_ENDPOINTS.get(provider)
    api_keys = {
        "deepseek": settings.providers.deepseek_api_key,
        "zhipu": settings.providers.zhipu_api_key,
        "dashscope": settings.providers.dashscope_api_key,
        "mimo": settings.providers.mimo_api_key,
    }
    api_key = api_keys.get(provider)
    if not api_key or not endpoint:
        raise HTTPException(status_code=502, detail=f"Provider {provider} not configured")

    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.15,
    }

    max_retries = settings.server.max_retries
    for attempt in range(max_retries + 1):
        try:
            start = datetime.now()
            # v4 模型调用可能很慢（用户反馈最快 60s），timeout 设大
            async with httpx.AsyncClient(timeout=180.0) as client:
                resp = await client.post(endpoint, headers=headers, json=body)
            elapsed = (datetime.now() - start).total_seconds()
            print(f"[PlanV4 {request_id}] {provider} call took {elapsed:.1f}s")

            if resp.status_code != 200:
                raise Exception(f"upstream status={resp.status_code} body={resp.text[:240]}")

            data = resp.json()
            if provider == "zhipu" and data.get("response"):
                return data["response"]
            return data.get("choices", [{}])[0].get("message", {})
        except Exception as e:
            print(f"[PlanV4 {request_id}] {provider} attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            if attempt >= max_retries:
                raise HTTPException(status_code=502, detail=f"{provider} 调用失败: {e}")
            await asyncio.sleep(0.5 * (attempt + 1))
    return {}


# ========== 解析函数 ==========

def _extract_balanced_json(text: str, start: int = 0, open_char: str = '{', close_char: str = '}') -> str:
    """通过括号深度匹配提取嵌套 JSON 字符串"""
    i = start
    # 跳过开头空白
    while i < len(text) and text[i] in ' \t\n\r':
        i += 1
    if i >= len(text) or text[i] != open_char:
        return ''
    
    depth = 0
    in_string = False
    escape = False
    for j in range(i, len(text)):
        c = text[j]
        if escape:
            escape = False
            continue
        if c == '\\' and in_string:
            escape = True
            continue
        if c == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == open_char:
            depth += 1
        elif c == close_char:
            depth -= 1
            if depth == 0:
                return text[i:j+1]
    return ''


def _parse_json_from_model(content: str) -> dict:
    """从模型输出中提取 JSON，增强容错性"""
    if not content:
        return {}
    
    # 方法1：尝试从代码 block 中提取（支持嵌套）
    match = re.search(r'```json\s*', content, re.DOTALL)
    if match:
        start = match.end()
        # 用括号深度匹配找到对应的结束位置
        json_str = _extract_balanced_json(content, start)
        if json_str:
            try:
                return json.loads(json_str)
            except:
                pass
    
    # 方法2：尝试提取数组形式 [ ... ]（支持嵌套）
    json_str = _extract_balanced_json(content, 0, open_char='[', close_char=']')
    if json_str:
        try:
            return json.loads(json_str)
        except:
            pass
    
    # 方法3：尝试提取对象形式 { ... }（支持嵌套）
    json_str = _extract_balanced_json(content, 0, open_char='{', close_char='}')
    if json_str:
        try:
            result = json.loads(json_str)
            if isinstance(result, dict):
                return result
        except:
            pass
    
    # 方法4：清理后重试
    try:
        cleaned = content.strip().replace('\ufeff', '')
        # 移除代码格式的描述部分
        cleaned = re.sub(r'^[\s\S]*?```\s*json\s*', '', cleaned)
        cleaned = re.sub(r'```\s*$', '', cleaned)
        return json.loads(cleaned)
    except:
        pass
    
    # 方法5：尝试提取 JSON 的各个字段
    try:
        result = {}
        # 提取 itinerary 字段
        itinerary_match = re.search(r'"itinerary"\s*:\s*\[([^\]]+)\]', content, re.DOTALL)
        if itinerary_match:
            result["itinerary"] = _extract_items_from_array(itinerary_match.group(0))
        
        # 提取 socialRecommendations 字段
        social_match = re.search(r'"socialRecommendations"\s*:\s*\[([^\]]+)\]', content, re.DOTALL)
        if social_match:
            result["socialRecommendations"] = _extract_items_from_array(social_match.group(0))
        
        if result:
            print(f"[PlanV4] JSON 解析降级：从原始内容提取了字段")
            return result
    except Exception as e:
        print(f"[PlanV4] JSON 提取字段失败: {e}")
    
    return {}


def _extract_items_from_array(array_str: str) -> list:
    """从数组字符串中提取对象列表"""
    items = []
    # 匹配每个对象 { ... }
    obj_matches = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', array_str, re.DOTALL)
    for obj_str in obj_matches:
        try:
            item = json.loads(obj_str)
            items.append(item)
        except:
            # 尝试修复常见的 JSON 错误
            fixed = obj_str.replace("'", '"')
            try:
                item = json.loads(fixed)
                items.append(item)
            except:
                continue
    return items


def _build_framework(skeleton: dict, task_id: str) -> dict:
    """根据骨架构建本地框架，地点简介从骨架中获取"""
    from modules.utils import get_city_center
    
    city = skeleton.get("city", "")
    daily_plan = skeleton.get("daily_plan", [])
    summary = skeleton.get("summary", "")
    
    # 确保 daily_plan 的天数与 days 一致（防止 AI 只返回部分天数）
    days = skeleton.get("days", 1)
    if len(daily_plan) < days:
        existing_days = {item.get("day", i+1) for i, item in enumerate(daily_plan)}
        for d in range(1, days + 1):
            if d not in existing_days:
                daily_plan.append({"day": d, "locations": []})
        daily_plan.sort(key=lambda x: x.get("day", 1))
    elif not daily_plan:
        daily_plan = [{"day": d, "locations": []} for d in range(1, days + 1)]

    day_plan_itinerary = []
    days_list = []
    center = get_city_center(city)

    for day_idx, day_info in enumerate(daily_plan):
        day_num = day_info.get("day", 1)
        locations = day_info.get("locations", [])

        day_items = []
        for seq, loc_info in enumerate(locations, 1):
            # 支持新格式 {name, brief, lat, lng} 和旧格式 "景点名"
            if isinstance(loc_info, dict):
                name = loc_info.get("name", "")
                brief = loc_info.get("brief", "")
                lat = loc_info.get("lat")
                lng = loc_info.get("lng")
            else:
                name = str(loc_info)
                brief = ""
                lat = None
                lng = None
            
            # 优先使用 AI 返回的真实坐标，否则用城市中心 + 偏移
            if lat is not None and lng is not None and abs(float(lat or 0)) > 0.001 and abs(float(lng or 0)) > 0.001:
                item_lat = float(lat)
                item_lng = float(lng)
            else:
                day_offset = day_idx * 0.05
                loc_offset = (seq - 2) * 0.01
                item_lat = round(center["lat"] + day_offset + loc_offset, 4)
                item_lng = round(center["lng"] + day_offset + loc_offset, 4)
            
            item = {
                "name": name,
                "city": city,
                "description": brief,
                "reason": loc_info.get("reason", "") if isinstance(loc_info, dict) else "",
                "lat": item_lat,
                "lng": item_lng,
                "time": "",
                "day": day_num,
                "sequence": seq,
                "transit_hint": "",
                "image": "",
            }
            day_items.append(item)
            day_plan_itinerary.append(item)

        days_list.append({"day": day_num, "itinerary": day_items})

    return {
        "itinerarySummary": summary or f"{city} 行程规划",
        "dayPlanItinerary": day_plan_itinerary,
        "days": days_list,
        "socialRecommendations": [],
        "warnings": [],
        "provider": "",
        "mcpTrace": [f"plan_v4:{task_id}:skeleton_built:{len(day_plan_itinerary)}_locations"],
        "requestId": task_id,
    }


def _merge_fill_result(framework: dict, fill_data: dict) -> dict:
    """将填充结果合并到框架中"""
    filled_itinerary = fill_data.get("itinerary", [])
    name_to_filled = {item.get("name", ""): item for item in filled_itinerary}

    for item in framework.get("dayPlanItinerary", []):
        name = item.get("name", "")
        if name in name_to_filled:
            filled = name_to_filled[name]
            item["description"] = filled.get("description", item.get("description", ""))
            item["reason"] = filled.get("reason", "")
            item["lat"] = filled.get("lat", item.get("lat", 0.0))
            item["lng"] = filled.get("lng", item.get("lng", 0.0))
            item["time"] = filled.get("time", item.get("time", ""))
            item["transit_hint"] = filled.get("transit_hint", item.get("transit_hint", ""))
            item["city"] = filled.get("city", item.get("city", ""))

    if fill_data.get("socialRecommendations"):
        framework["socialRecommendations"] = fill_data["socialRecommendations"]

    return framework


# ========== Provider 选择 ==========

def _choose_provider(payload: Dict) -> tuple:
    """选择模型供应商，返回 (provider, model)"""
    requested = str(payload.get("modelType", "")).lower()

    model_map = {
        "gemini": "gemini",
        "deepseek": "deepseek",
        "glm": "zhipu",
        "qwen": "dashscope",
        "mimo": "mimo",
    }

    if requested and requested != "auto":
        for key, prov in model_map.items():
            if key in requested:
                models = {
                    "gemini": settings.providers.default_gemini_model,
                    "deepseek": settings.providers.default_deepseek_model,
                    "zhipu": settings.providers.default_zhipu_model,
                    "dashscope": settings.providers.default_dashscope_model,
                    "mimo": settings.providers.default_mimo_model,
                }
                return prov, payload.get("modelType") or models.get(prov, "deepseek-v4-pro")

    provider = settings.rollout.primary_provider
    models = {
        "gemini": settings.providers.default_gemini_model,
        "deepseek": settings.providers.default_deepseek_model,
        "zhipu": settings.providers.default_zhipu_model,
        "dashscope": settings.providers.default_dashscope_model,
        "mimo": settings.providers.default_mimo_model,
    }
    return provider, models.get(provider, "deepseek-v4-pro")


# ========== 天气获取 ==========

async def _fetch_weather(itinerary: List[Dict]) -> Dict:
    """取行程中第一个有效坐标查询和风天气"""
    QWEATHER_API_KEY = "8b8a55610b67456091a21ea4cdc870ba"
    QWEATHER_BASE_URL = "https://devapi.qweather.com/v7"

    for item in itinerary:
        try:
            lat, lng = float(item.get("lat", 0)), float(item.get("lng", 0))
            if lat and lng:
                async with httpx.AsyncClient(timeout=8) as client:
                    resp = await client.get(
                        f"{QWEATHER_BASE_URL}/weather/now",
                        params={"location": f"{lng},{lat}", "key": QWEATHER_API_KEY},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("code") == "200":
                            now = data["now"]
                            return {
                                "temp": now["temp"],
                                "icon": now["icon"],
                                "text": now["text"],
                                "obsTime": now["obsTime"],
                                "windDir": now["windDir"],
                                "windScale": now["windScale"],
                                "humidity": now["humidity"],
                            }
        except Exception:
            continue
    return {}


# ========== 核心任务执行 ==========

async def _execute_plan_v4_task(task_id: str, payload: Dict):
    """后台执行 v4 行程生成任务"""
    _v4_task_store[task_id] = {
        "status": "running",
        "created_at": datetime.now().timestamp(),
    }

    try:
        print(f"\n{'=' * 60}\n[PlanV4] Task {task_id} started\n{'=' * 60}")

        user_input = (payload.get("userInput") or "").strip()
        if not user_input:
            raise ValueError("userInput 不能为空")

        travel_mode = payload.get("travelMode", "deep")
        provider, model = _choose_provider(payload)
        print(f"[PlanV4] provider={provider} model={model}")

        mcp_trace = [f"plan_v4:{task_id}:started"]

        # ========== 阶段 1：生成骨架 ==========
        skeleton_messages = [
            {"role": "system", "content": V4_SKELETON_PROMPT},
            {"role": "user", "content": f"旅行风格：{travel_mode}。请生成行程骨架：{user_input}"},
        ]

        print(f"[PlanV4 {task_id}] Step 1/3: Generating skeleton...")
        skeleton_msg = await _call_model(provider, model, skeleton_messages, task_id)
        skeleton_content = skeleton_msg.get("content", "")

        if not skeleton_content:
            raise ValueError("骨架生成失败：模型返回为空")

        skeleton = _parse_json_from_model(skeleton_content)
        if not skeleton or not skeleton.get("daily_plan"):
            raise ValueError(f"骨架解析失败：{skeleton_content[:200]}")

        city = skeleton.get("city", "")
        days = skeleton.get("days", 1)
        
        # 校验骨架中的城市是否与用户输入匹配
        from modules.utils import infer_city_from_request
        expected_city = infer_city_from_request(user_input, [])
        if not city or city == "北京":  # 北京 可能是默认值，需要校验
            if expected_city:
                skeleton["city"] = expected_city
                city = expected_city
                mcp_trace.append(f"plan_v4:city_corrected:{city}_from_local_inference")
                print(f"[PlanV4 {task_id}] City corrected from skeleton to: {city}")
        
        location_count = sum(len(d.get("locations", [])) for d in skeleton.get("daily_plan", []))
        mcp_trace.append(f"plan_v4:{task_id}:skeleton_ready:{city}:{days}d:{location_count}loc")
        print(f"[PlanV4 {task_id}] Skeleton: {city}, {days} days, {location_count} locations")

        # ========== 阶段 2：构建框架并返回骨架 ==========
        framework = _build_framework(skeleton, task_id)
        framework["provider"] = provider
        framework["mcpTrace"] = mcp_trace

        # 立即返回骨架，客户端可渲染时间轴
        _v4_task_store[task_id] = {
            "status": "skeleton_ready",
            "result": framework,
            "created_at": _v4_task_store[task_id]["created_at"],
            "skeleton_at": datetime.now().timestamp(),
        }
        print(f"[PlanV4 {task_id}] Skeleton ready, client can render timeline now")

        # ========== 阶段 3：并行填充详情 + 获取图片 + 天气 ==========
        print(f"[PlanV4 {task_id}] Step 2/3: Filling details + fetching images (parallel)...")

        fill_messages = [
            {"role": "system", "content": _build_fill_prompt(skeleton)},
            {"role": "user", "content": "请为上述地点填充详细信息"},
        ]

        # 并行启动三个任务
        fill_task = asyncio.create_task(_call_model(provider, model, fill_messages, task_id))
        image_task = asyncio.create_task(enrich_images(framework["dayPlanItinerary"], mcp_trace))
        weather_task = asyncio.create_task(_fetch_weather(framework["dayPlanItinerary"]))

        # 等待填充完成（通常最慢）
        fill_msg = await fill_task
        fill_content = fill_msg.get("content", "")

        if fill_content:
            fill_data = _parse_json_from_model(fill_content)
            if fill_data and isinstance(fill_data, dict):
                framework = _merge_fill_result(framework, fill_data)
                mcp_trace.append(f"plan_v4:{task_id}:fill_merged:{len(fill_data.get('itinerary', []))}_items")
                print(f"[PlanV4 {task_id}] Fill merged: {len(fill_data.get('itinerary', []))} items")
            elif fill_data and isinstance(fill_data, list):
                # AI 返回了数组格式，尝试转换
                mcp_trace.append(f"plan_v4:{task_id}:fill_list_converted")
                print(f"[PlanV4 {task_id}] Fill returned list, converting...")
                fill_dict = {"itinerary": fill_data}
                framework = _merge_fill_result(framework, fill_dict)
                mcp_trace.append(f"plan_v4:{task_id}:fill_merged:{len(fill_data)}_items")
            else:
                mcp_trace.append(f"plan_v4:{task_id}:fill_parse_failed")
                print(f"[PlanV4 {task_id}] Fill parse failed, using skeleton only")
        else:
            mcp_trace.append(f"plan_v4:{task_id}:fill_empty")
            print(f"[PlanV4 {task_id}] Fill empty, using skeleton only")

        # 等待图片和天气
        try:
            await asyncio.wait_for(image_task, timeout=15.0)
        except asyncio.TimeoutError:
            mcp_trace.append("image:global_timeout_fallback")
            print(f"[PlanV4 {task_id}] Image fetch timeout")

        real_weather = await weather_task

        # 后处理
        framework["dayPlanItinerary"] = enrich_with_mcp_signals(
            framework["dayPlanItinerary"], mcp_trace, real_weather
        )

        # 验证
        warnings = verify_plan(framework["dayPlanItinerary"], mcp_trace)
        framework["warnings"] = warnings
        framework["mcpTrace"] = mcp_trace

        # 标记完成
        _v4_task_store[task_id] = {
            "status": "completed",
            "result": framework,
            "created_at": _v4_task_store[task_id]["created_at"],
            "skeleton_at": _v4_task_store[task_id].get("skeleton_at"),
            "completed_at": datetime.now().timestamp(),
        }

        elapsed = datetime.now().timestamp() - _v4_task_store[task_id]["created_at"]
        print(f"[PlanV4] Done: {location_count} locations, elapsed={elapsed:.1f}s")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
        traceback_str = traceback.format_exc()
        print(f"[PlanV4] Task {task_id} failed: {error_msg}\n{traceback_str}")
        _v4_task_store[task_id] = {
            "status": "failed",
            "error": error_msg,
            "created_at": _v4_task_store[task_id].get("created_at", datetime.now().timestamp()),
            "completed_at": datetime.now().timestamp(),
        }


# ========== API 路由 ==========

@router.post("/v4")
async def create_plan_v4(payload: Dict):
    """创建 v4 行程任务，立即返回 taskId"""
    task_id = str(uuid.uuid4())
    print(f"\n{'=' * 60}\n[PlanV4] Request {task_id}\n{'=' * 60}")

    user_input = (payload.get("userInput") or "").strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="userInput 不能为空")

    asyncio.create_task(_execute_plan_v4_task(task_id, payload))
    return {"taskId": task_id, "status": "pending"}


@router.get("/v4/status/{task_id}")
async def get_plan_v4_status(task_id: str):
    """查询任务状态

    状态流转：pending → running → skeleton_ready → completed
    客户端可在 skeleton_ready 时先展示骨架，completed 时展示完整内容。
    """
    task = _v4_task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

    result = {"taskId": task_id, "status": task["status"]}

    # 添加耗时信息（方便调试）
    if task.get("skeleton_at") and task.get("created_at"):
        result["skeleton_elapsed_ms"] = int((task["skeleton_at"] - task["created_at"]) * 1000)
    if task.get("completed_at") and task.get("created_at"):
        result["total_elapsed_ms"] = int((task["completed_at"] - task["created_at"]) * 1000)

    return result


@router.get("/v4/result/{task_id}")
async def get_plan_v4_result(task_id: str):
    """获取任务结果

    - skeleton_ready 阶段：返回骨架数据（地点列表已确定，描述/坐标/图片待填充）
    - completed 阶段：返回完整数据
    通过 _stage 字段让前端区分当前阶段。
    """
    task = _v4_task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

    if task["status"] == "failed":
        del _v4_task_store[task_id]
        raise HTTPException(status_code=502, detail=task.get("error", "任务执行失败"))

    if task["status"] in ("skeleton_ready", "completed"):
        result = task.get("result", {}).copy()
        result["_stage"] = task["status"]
        result["_taskId"] = task_id
        return result

    raise HTTPException(status_code=400, detail=f"任务尚未完成，当前状态: {task.get('status', 'unknown')}")
