"""
AI Travel Butler - /api/plan/v3 本地预构建框架 + 按需调模型 + 骨架优先渐进加载

架构：
1. 阶段1：轻量模型快速提取骨架（城市、天数、每天地点名称列表）→ 3-8s
2. 阶段2：本地预构建框架 → 立即返回 skeleton_ready，前端先渲染时间轴
3. 阶段3：后台按天并行填充景点细节（描述、坐标、时间等）→ 3-5s
4. 阶段4：标记 completed，前端轮询获取完整结果

状态流转：pending → running → skeleton_ready → filling → completed
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
from modules.post_processor import (
    extract_expected_city_from_input,
    harmonize_itinerary_city,
    ensure_minimum_items_by_requested_days,
    enrich_with_mcp_signals,
)
from modules.verifier import verify_plan
from modules.image_fetcher import enrich_images
from modules.utils import get_city_center, infer_city_from_request, infer_requested_days

router = APIRouter(prefix="/api/plan", tags=["规划 v3"])

_task_store: Dict[str, Dict[str, Any]] = {}

QWEATHER_API_KEY = "8b8a55610b67456091a21ea4cdc870ba"
QWEATHER_BASE_URL = "https://devapi.qweather.com/v7"

# ========== Prompt 定义 ==========

SKELETON_PROMPT = """你是一位行程骨架生成专家。请根据用户需求，输出行程骨架（城市、天数、每天的具体地点列表，每个地点的一句话简介）。

约束：
- 如果用户在需求中指定了天数（如"3天"、"玩4天"），必须严格生成对应天数
- 如果用户未指定天数，默认生成 1 天
- 每天至少 3 个地点，地点必须是真实存在的景点
- 每个地点必须有15-30字的一句话简介（brief），包含看点或特色
- 相邻天的地点应地理接近，合理安排路线

输出格式（严格 JSON，不要额外文字）：
```json
{
  "city": "城市名",
  "days": 3,
  "travel_style": "deep",
  "summary": "一句话行程概述",
  "keywords": ["关键词1", "关键词2"],
  "daily_plan": [
    {
      "day": 1,
      "locations": [
        {"name": "景点1", "brief": "景点简介15-30字"},
        {"name": "景点2", "brief": "景点简介15-30字"},
        {"name": "景点3", "brief": "景点简介15-30字"}
      ]
    }
  ]
}
```"""

DAY_FILL_PROMPT = """你是一位专业的旅游规划专家。请为指定城市的一天行程中的已知地点生成详细信息。

城市：{city}
旅行风格：{style}
当天主题：{theme}
地点列表：{location_names}

输出格式（精确匹配，不要额外文字）：
```json
{{
  "day": {day},
  "itinerary": [
    {{
      "name": "地点名称（必须与列表中一致）",
      "city": "{city}",
      "description": "景点介绍（50字以上，包含看点和游玩建议）",
      "lat": 39.9042,
      "lng": 116.4074,
      "time": "09:00 - 11:00",
      "day": {day},
      "sequence": 1,
      "transit_hint": "从上一个地点到此的交通建议"
    }}
  ]
}}
```

约束：
- 必须为列表中的每个地点都生成详细信息
- lat/lng 必须是该景点的真实坐标
- 相邻景点地理接近，路线合理
- 时间安排从早到晚
- sequence 从 1 开始递增"""

SOCIAL_FILL_PROMPT = """你是一位热门旅游内容专家。请为指定城市推荐热门打卡点。

城市：{city}
关键词：{keywords}

输出格式（精确匹配，不要额外文字）：
```json
{{
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
```

约束：
- 至少 3 条推荐
- 必须是 {city} 的真实热门地点
- platform 包含 xiaohongshu/douyin/weibo"""

DAY_THEMES = {
    1: "经典必游", 2: "深度探索", 3: "小众体验", 4: "美食之旅",
    5: "文化沉浸", 6: "自然风光", 7: "购物休闲", 8: "周边游",
    9: "夜生活体验", 10: "返程前的悠闲时光",
}

DAY_SLOTS = [
    {"time": "09:00 - 11:00", "category": "SIGHT"},
    {"time": "11:30 - 13:00", "category": "FOOD"},
    {"time": "14:00 - 16:00", "category": "SIGHT"},
    {"time": "16:30 - 18:00", "category": "SIGHT"},
    {"time": "19:00 - 21:00", "category": "FOOD"},
]


# ========== 模型调用 ==========

async def _call_model(provider: str, model: str, messages: List[Dict], request_id: str, max_tokens: int = 1500) -> Dict:
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
        "temperature": 0.1,
    }

    max_retries = settings.server.max_retries
    for attempt in range(max_retries + 1):
        try:
            start = datetime.now()
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(endpoint, headers=headers, json=body)
            elapsed = (datetime.now() - start).total_seconds()
            print(f"[PlanV3][{request_id}] {provider} call took {elapsed:.1f}s")
            if resp.status_code != 200:
                raise Exception(f"upstream status={resp.status_code} body={resp.text[:240]}")
            data = resp.json()
            if provider == "zhipu" and data.get("response"):
                return data["response"]
            return data.get("choices", [{}])[0].get("message", {})
        except Exception as e:
            print(f"[PlanV3][{request_id}] {provider} attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            if attempt >= max_retries:
                raise HTTPException(status_code=502, detail=f"{provider} 调用失败: {e}")
            await asyncio.sleep(0.3 * (attempt + 1))
    return {}


# ========== 解析函数 ==========

def _extract_json_from_text(text: str) -> str:
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return match.group(1).strip()
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end > brace_start:
        return text[brace_start:brace_end + 1]
    return text


def _parse_skeleton(content: str) -> Dict:
    raw = _extract_json_from_text(content)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            cleaned = raw.replace("'", '"')
            cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            data = {}

    # 解析天数（用户指定的天数）
    days = max(1, min(10, int(data.get("days", 1))))
    
    daily_plan = data.get("daily_plan", [])
    
    # 确保 daily_plan 的长度与 days 一致
    if len(daily_plan) < days:
        # 补充缺失的天数（empty days）
        existing_days = {item.get("day", i+1) for i, item in enumerate(daily_plan)}
        for d in range(1, days + 1):
            if d not in existing_days:
                daily_plan.append({"day": d, "locations": []})
        # 按 day 排序
        daily_plan.sort(key=lambda x: x.get("day", 1))
    elif not daily_plan:
        # 完全为空时生成默认结构
        daily_plan = [{"day": d, "locations": []} for d in range(1, days + 1)]

    return {
        "city": data.get("city", ""),
        "days": days,
        "travel_style": data.get("travel_style", "deep"),
        "summary": data.get("summary", ""),
        "keywords": data.get("keywords", []),
        "daily_plan": daily_plan,
    }


def _parse_day_itinerary(content: str, provider: str, fallback_day: int, city: str) -> List[Dict]:
    raw = _extract_json_from_text(content)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            cleaned = raw.replace("'", '"')
            cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            return []

    from modules.normalizer import normalize_location

    itinerary = data.get("itinerary", [])
    if not itinerary:
        day_data = data.get("days", [])
        if day_data and isinstance(day_data, list):
            first_day = day_data[0] if day_data else {}
            itinerary = first_day.get("itinerary", [])

    items = []
    for loc in itinerary:
        if isinstance(loc, dict) and loc.get("name"):
            loc["day"] = loc.get("day", fallback_day)
            loc["city"] = loc.get("city", city)
            parsed = normalize_location(loc, provider)
            if parsed and parsed.get("name") and parsed["name"] != "未知地点":
                items.append(parsed)

    return items


def _parse_social(content: str, provider: str) -> List[Dict]:
    raw = _extract_json_from_text(content)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            cleaned = raw.replace("'", '"')
            cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            return []

    from modules.normalizer import normalize_recommendations_list

    recs = data.get("socialRecommendations") or data.get("social_recommendations") or []
    if not isinstance(recs, list):
        return []

    return normalize_recommendations_list(recs, provider)


# ========== 本地构建函数 ==========

def _build_framework_from_skeleton(skeleton: dict, task_id: str, provider: str) -> dict:
    """根据骨架构建本地框架（地点名称已知，描述/坐标待填充）"""
    city = skeleton.get("city", "")
    daily_plan = skeleton.get("daily_plan", [])
    summary = skeleton.get("summary", "")

    day_plan_itinerary = []
    days_list = []

    for day_info in daily_plan:
        day_num = day_info.get("day", 1)
        locations = day_info.get("locations", [])
        center = get_city_center(city)

        day_items = []
        for seq, loc_info in enumerate(locations, 1):
            offset = (seq - 2) * 0.008
            slot = DAY_SLOTS[min(seq - 1, len(DAY_SLOTS) - 1)]
            # 支持新格式 {"name": "景点", "brief": "简介"} 和旧格式 "景点名"
            if isinstance(loc_info, dict):
                name = loc_info.get("name", "")
                brief = loc_info.get("brief", "")
            else:
                name = str(loc_info)
                brief = ""
            item = {
                "name": name,
                "city": city,
                "description": brief,  # 使用 brief 作为 description
                "lat": round(center["lat"] + offset, 4),
                "lng": round(center["lng"] + offset, 4),
                "time": slot["time"],
                "day": day_num,
                "sequence": seq,
                "transit_hint": "",
                "image": "",
                "category": slot["category"],
                "source": f"provider:{provider}:skeleton",
                "source_timestamp": datetime.now().isoformat() + "Z",
                "confidence": 0.5,
            }
            day_items.append(item)
            day_plan_itinerary.append(item)

        days_list.append({"day": day_num, "itinerary": day_items})

    return {
        "itinerarySummary": summary or f"{city}行程规划",
        "dayPlanItinerary": day_plan_itinerary,
        "days": days_list,
        "socialRecommendations": [],
        "warnings": [],
        "provider": provider,
        "mcpTrace": [f"plan_v3:{task_id}:skeleton_built:{len(day_plan_itinerary)}_locations"],
        "requestId": task_id,
    }


def _merge_day_fill(framework: dict, day_num: int, filled_items: List[Dict]) -> None:
    """将某天的填充结果合并到框架中（原地修改）"""
    if not filled_items:
        return

    name_to_filled = {item.get("name", ""): item for item in filled_items}

    for item in framework.get("dayPlanItinerary", []):
        if item.get("day") != day_num:
            continue
        name = item.get("name", "")
        if name in name_to_filled:
            filled = name_to_filled[name]
            if filled.get("description"):
                item["description"] = filled["description"]
            if filled.get("lat") and filled["lat"] != 0.0:
                item["lat"] = filled["lat"]
            if filled.get("lng") and filled["lng"] != 0.0:
                item["lng"] = filled["lng"]
            if filled.get("time"):
                item["time"] = filled["time"]
            if filled.get("transit_hint"):
                item["transit_hint"] = filled["transit_hint"]
            if filled.get("city"):
                item["city"] = filled["city"]
            item["source"] = filled.get("source", item.get("source", ""))
            item["confidence"] = filled.get("confidence", 0.8)


def _build_fallback_social(city: str) -> List[Dict]:
    return [
        {
            "rank": i,
            "title": f"{city}热门打卡点{i}",
            "platform": "xiaohongshu",
            "hot_score": "8.5",
            "reason": f"{city}热门推荐地点",
            "photo_tips": "建议白天前往拍照",
            "source": "fallback:v3:local",
            "source_timestamp": datetime.now().isoformat() + "Z",
            "confidence": 0.3,
        }
        for i in range(1, 4)
    ]


def _infer_skeleton_locally(user_input: str, travel_mode: str) -> Dict:
    city = infer_city_from_request(user_input, [])
    days = infer_requested_days(user_input)

    keywords = []
    style_keywords = {
        "deep": "深度游", "casual": "休闲", "food": "美食",
        "culture": "文化", "shopping": "购物", "nature": "自然",
    }
    for key, label in style_keywords.items():
        if key in user_input.lower() or label in user_input:
            keywords.append(label)

    daily_plan = [{"day": d, "locations": []} for d in range(1, days + 1)]

    return {
        "city": city or "北京",
        "days": days,
        "travel_style": travel_mode if travel_mode in ("deep", "casual", "food", "culture") else "deep",
        "summary": "",
        "keywords": keywords or ["经典游览"],
        "daily_plan": daily_plan,
    }


# ========== Provider 选择 ==========

def _choose_provider(payload: Dict) -> Dict:
    requested = str(payload.get("modelType", "")).lower()
    if requested and requested != "auto":
        model_map = {
            "gemini": "gemini", "deepseek": "deepseek",
            "glm": "zhipu", "qwen": "dashscope", "mimo": "mimo",
        }
        for key, prov in model_map.items():
            if key in requested:
                return {"provider": prov, "modelType": payload.get("modelType")}

    provider = settings.rollout.primary_provider
    models = {
        "gemini": settings.providers.default_gemini_model,
        "deepseek": settings.providers.default_deepseek_model,
        "zhipu": settings.providers.default_zhipu_model,
        "dashscope": settings.providers.default_dashscope_model,
        "mimo": settings.providers.default_mimo_model,
    }
    return {"provider": provider, "modelType": models.get(provider, "deepseek-chat")}


# ========== 天气获取 ==========

async def _fetch_real_weather(itinerary: List[Dict]) -> Dict:
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
                                "temp": now["temp"], "icon": now["icon"],
                                "text": now["text"], "obsTime": now["obsTime"],
                                "windDir": now["windDir"], "windScale": now["windScale"],
                                "humidity": now["humidity"],
                            }
        except Exception:
            continue
    return {}


# ========== 核心步骤 ==========

async def _step1_skeleton(user_input: str, travel_mode: str, provider: str, model: str, request_id: str, mcp_trace: List[str]) -> Dict:
    """第一步：生成骨架（含每天地点名称列表）"""
    messages = [
        {"role": "system", "content": SKELETON_PROMPT},
        {"role": "user", "content": f"旅行风格：{travel_mode}。请生成行程骨架：{user_input}"},
    ]

    start = datetime.now()
    try:
        message = await _call_model(provider, model, messages, request_id, max_tokens=800)
        content = message.get("content", "")
        if content:
            skeleton = _parse_skeleton(content)
            elapsed = (datetime.now() - start).total_seconds()
            mcp_trace.append(f"v3:step1:skeleton:ok:{elapsed:.1f}s:city={skeleton['city']}:days={skeleton['days']}")
            print(f"[PlanV3][{request_id}] Step1 skeleton done in {elapsed:.1f}s: {skeleton['city']}, {skeleton['days']}d, {sum(len(d.get('locations',[])) for d in skeleton.get('daily_plan',[]))} locations")
            return skeleton
    except Exception as e:
        mcp_trace.append(f"v3:step1:skeleton:fail:{e}")
        print(f"[PlanV3][{request_id}] Step1 skeleton failed: {e}")

    skeleton = _infer_skeleton_locally(user_input, travel_mode)
    mcp_trace.append(f"v3:step1:skeleton:fallback_local:city={skeleton['city']}:days={skeleton['days']}")
    print(f"[PlanV3][{request_id}] Step1 fallback to local inference: {skeleton}")
    return skeleton


async def _step2_fill_day(city: str, day: int, days_total: int, style: str, location_names: List[str], provider: str, model: str, request_id: str, mcp_trace: List[str]) -> List[Dict]:
    """第二步（并行）：填充单天行程详情"""
    theme = DAY_THEMES.get(day, f"第{day}天行程")
    names_str = "、".join(location_names) if location_names else "经典景点"

    prompt = DAY_FILL_PROMPT.format(
        city=city, style=style, theme=theme,
        location_names=names_str, day=day,
    )
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"请为{city}第{day}天的以下地点填充详细信息：{names_str}"},
    ]

    start = datetime.now()
    try:
        message = await _call_model(provider, model, messages, request_id, max_tokens=1200)
        content = message.get("content", "")
        if content:
            items = _parse_day_itinerary(content, provider, day, city)
            elapsed = (datetime.now() - start).total_seconds()
            mcp_trace.append(f"v3:step2:day{day}:ok:{elapsed:.1f}s:{len(items)}_locations")
            print(f"[PlanV3][{request_id}] Step2 day{day} done in {elapsed:.1f}s: {len(items)} locations")
            return items
    except Exception as e:
        mcp_trace.append(f"v3:step2:day{day}:fail:{e}")
        print(f"[PlanV3][{request_id}] Step2 day{day} failed: {e}")

    return []


async def _step2_fill_social(city: str, keywords: List[str], provider: str, model: str, request_id: str, mcp_trace: List[str]) -> List[Dict]:
    """第二步（并行）：填充社交推荐"""
    keywords_str = "、".join(keywords) if keywords else "热门景点"

    prompt = SOCIAL_FILL_PROMPT.format(city=city, keywords=keywords_str)
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"请推荐{city}的热门打卡点"},
    ]

    start = datetime.now()
    try:
        message = await _call_model(provider, model, messages, request_id, max_tokens=800)
        content = message.get("content", "")
        if content:
            recs = _parse_social(content, provider)
            elapsed = (datetime.now() - start).total_seconds()
            mcp_trace.append(f"v3:step2:social:ok:{elapsed:.1f}s:{len(recs)}_recs")
            print(f"[PlanV3][{request_id}] Step2 social done in {elapsed:.1f}s: {len(recs)} recs")
            return recs
    except Exception as e:
        mcp_trace.append(f"v3:step2:social:fail:{e}")
        print(f"[PlanV3][{request_id}] Step2 social failed: {e}")

    return _build_fallback_social(city)


# ========== 核心任务执行 ==========

@router.post("/v3")
async def create_plan_v3(payload: Dict):
    """创建 v3 行程任务，立即返回 taskId"""
    task_id = str(uuid.uuid4())
    print(f"\n{'=' * 60}\n[PlanV3] Request {task_id}\n{'=' * 60}")

    user_input = (payload.get("userInput") or "").strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="userInput 不能为空")

    asyncio.create_task(_execute_plan_task(task_id, payload))
    return {"taskId": task_id, "status": "pending"}


async def _execute_plan_task(task_id: str, payload: Dict):
    """后台执行行程生成任务（v3：骨架优先渐进加载）"""
    _task_store[task_id] = {"status": "running", "created_at": datetime.now().timestamp()}
    total_start = datetime.now()

    try:
        user_input = (payload.get("userInput") or "").strip()
        if not user_input:
            raise ValueError("userInput 不能为空")

        travel_mode = payload.get("travelMode", "deep")
        chosen = _choose_provider(payload)
        provider, model = chosen["provider"], chosen["modelType"]
        mcp_trace = [f"plan_v3:{task_id}:provider={provider}:model={model}"]
        print(f"[PlanV3] Task {task_id} started: provider={provider} model={model}")

        # ========== 阶段1：生成骨架 ==========
        print(f"[PlanV3 {task_id}] Step 1/3: Generating skeleton...")
        skeleton = await _step1_skeleton(user_input, travel_mode, provider, model, task_id, mcp_trace)
        city = skeleton["city"]
        days = skeleton["days"]
        style = skeleton["travel_style"]
        keywords = skeleton["keywords"]

        # 强制同步骨架天数与用户输入（防止 AI 只返回部分天数）
        from modules.utils import infer_requested_days, infer_city_from_request
        requested_days = infer_requested_days(user_input)
        if requested_days > days:
            # 补充缺失天数到骨架
            existing_days = {item.get("day", i+1) for i, item in enumerate(skeleton.get("daily_plan", []))}
            for d in range(1, requested_days + 1):
                if d not in existing_days:
                    skeleton["daily_plan"].append({"day": d, "locations": []})
            skeleton["daily_plan"].sort(key=lambda x: x.get("day", 1))
            skeleton["days"] = requested_days
            days = requested_days
            mcp_trace.append(f"v3:days_adjusted:{requested_days}_from_request")
            print(f"[PlanV3 {task_id}] Adjusted days from {skeleton['days']} to {requested_days} based on user input")

        # 校验骨架中的城市是否与用户输入匹配
        expected_city = infer_city_from_request(user_input, [])
        if not city or city == "北京":  # 北京 可能是默认值，需要校验
            # 如果骨架没有城市或城市为默认值，优先使用本地推断的城市
            if expected_city:
                skeleton["city"] = expected_city
                city = expected_city
                mcp_trace.append(f"v3:city_corrected:{city}_from_local_inference")
                print(f"[PlanV3 {task_id}] City corrected from skeleton to: {city}")

        # ========== 阶段2：构建框架 + 立即返回骨架 ==========
        print(f"[PlanV3 {task_id}] Step 2/3: Building framework from skeleton...")
        framework = _build_framework_from_skeleton(skeleton, task_id, provider)
        framework["provider"] = provider
        framework["mcpTrace"] = mcp_trace

        # 立即返回骨架，前端可先渲染时间轴
        _task_store[task_id] = {
            "status": "skeleton_ready",
            "result": framework,
            "created_at": _task_store[task_id]["created_at"],
            "skeleton_at": datetime.now().timestamp(),
        }
        skeleton_elapsed = (datetime.now() - total_start).total_seconds()
        location_count = len(framework.get("dayPlanItinerary", []))
        print(f"[PlanV3 {task_id}] Skeleton ready in {skeleton_elapsed:.1f}s: {city}, {days}d, {location_count} locations - client can render now")

        # ========== 阶段3：后台并行填充详情 ==========
        _task_store[task_id]["status"] = "filling"
        print(f"[PlanV3 {task_id}] Step 3/3: Filling details (parallel)...")

        fill_tasks = []
        daily_plan = skeleton.get("daily_plan", [])
        for day_info in daily_plan:
            day_num = day_info.get("day", 1)
            location_names = day_info.get("locations", [])
            fill_tasks.append(_step2_fill_day(
                city, day_num, days, style, location_names,
                provider, model, task_id, mcp_trace,
            ))
        fill_tasks.append(_step2_fill_social(city, keywords, provider, model, task_id, mcp_trace))

        results = await asyncio.gather(*fill_tasks, return_exceptions=True)

        # 合并填充结果到框架（每个 day 完成后立即更新，让前端能实时看到进度）
        for i in range(days):
            day_num = daily_plan[i].get("day", i + 1) if i < len(daily_plan) else i + 1
            result = results[i]
            if isinstance(result, Exception):
                mcp_trace.append(f"v3:step2:day{day_num}:exception:{result}")
                print(f"[PlanV3 {task_id}] Day{day_num} fill exception: {result}")
            elif isinstance(result, list) and result:
                _merge_day_fill(framework, day_num, result)
                # 立即更新 store，让前端能实时看到已填充的内容
                _task_store[task_id]["result"] = framework
                print(f"[PlanV3 {task_id}] Day{day_num} merged, {len(result)} locations, updating store")

        social_result = results[days]
        if isinstance(social_result, Exception):
            framework["socialRecommendations"] = _build_fallback_social(city)
            mcp_trace.append(f"v3:step2:social:exception:{social_result}")
        elif isinstance(social_result, list):
            framework["socialRecommendations"] = social_result

        # ========== 后处理 ==========
        expected_city = extract_expected_city_from_input(user_input, framework.get("socialRecommendations", []))
        if expected_city:
            framework["dayPlanItinerary"] = harmonize_itinerary_city(
                framework["dayPlanItinerary"], expected_city, mcp_trace,
            )

        framework["dayPlanItinerary"] = ensure_minimum_items_by_requested_days(
            framework["dayPlanItinerary"], user_input,
            framework.get("socialRecommendations", []), provider, mcp_trace,
        )

        weather_task = asyncio.create_task(_fetch_real_weather(framework["dayPlanItinerary"]))

        try:
            await asyncio.wait_for(enrich_images(framework["dayPlanItinerary"], mcp_trace), timeout=12.0)
        except asyncio.TimeoutError:
            mcp_trace.append("image:global_timeout_fallback")
            from urllib.parse import quote
            for item in framework["dayPlanItinerary"]:
                if not item.get("image"):
                    tags = f"{item.get('name', '')} {item.get('city', '')}".strip().replace(" ", ",")
                    item["image"] = f"https://loremflickr.com/640/480/{quote(tags)}"

        real_weather = await weather_task
        framework["dayPlanItinerary"] = enrich_with_mcp_signals(framework["dayPlanItinerary"], mcp_trace, real_weather)
        warnings = verify_plan(framework["dayPlanItinerary"], mcp_trace)
        framework["warnings"] = warnings
        framework["mcpTrace"] = mcp_trace

        total_elapsed = (datetime.now() - total_start).total_seconds()

        # 标记完成
        _task_store[task_id] = {
            "status": "completed",
            "result": framework,
            "created_at": _task_store[task_id]["created_at"],
            "skeleton_at": _task_store[task_id].get("skeleton_at"),
            "completed_at": datetime.now().timestamp(),
        }

        print(f"[PlanV3] Done in {total_elapsed:.1f}s (skeleton: {skeleton_elapsed:.1f}s): {len(framework['dayPlanItinerary'])} locations, {len(framework.get('socialRecommendations', []))} recs")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
        traceback_str = traceback.format_exc()
        print(f"[PlanV3] Task {task_id} failed: {error_msg}\n{traceback_str}")
        _task_store[task_id] = {
            "status": "failed",
            "error": error_msg,
            "created_at": _task_store[task_id].get("created_at", datetime.now().timestamp()),
            "completed_at": datetime.now().timestamp(),
        }


# ========== API 路由 ==========

@router.get("/v3/status/{task_id}")
async def get_plan_v3_status(task_id: str):
    """查询 v3 任务状态

    状态流转：pending → running → skeleton_ready → filling → completed
    客户端可在 skeleton_ready 时先展示骨架，completed 时展示完整内容。
    """
    task = _task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

    result = {"taskId": task_id, "status": task["status"]}

    if task.get("skeleton_at") and task.get("created_at"):
        result["skeleton_elapsed_ms"] = int((task["skeleton_at"] - task["created_at"]) * 1000)
    if task.get("completed_at") and task.get("created_at"):
        result["total_elapsed_ms"] = int((task["completed_at"] - task["created_at"]) * 1000)

    return result


@router.get("/v3/result/{task_id}")
async def get_plan_v3_result(task_id: str):
    """获取 v3 任务结果

    - skeleton_ready / filling 阶段：返回骨架数据（地点名称已知，描述/坐标待填充）
    - completed 阶段：返回完整数据
    通过 _stage 字段让前端区分当前阶段。
    """
    task = _task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

    if task["status"] == "failed":
        del _task_store[task_id]
        raise HTTPException(status_code=502, detail=task.get("error", "任务执行失败"))

    if task["status"] in ("skeleton_ready", "filling", "completed"):
        result = task.get("result", {}).copy()
        result["_stage"] = task["status"]
        result["_taskId"] = task_id
        return result

    raise HTTPException(status_code=400, detail=f"任务尚未完成，当前状态: {task.get('status', 'unknown')}")


async def _cleanup_old_tasks():
    """每 5 分钟清理一次 10 分钟前的已完成/失败任务"""
    while True:
        await asyncio.sleep(300)
        now = datetime.now().timestamp()
        expired = [
            tid for tid, task in _task_store.items()
            if task.get("status") in ("completed", "failed", "skeleton_ready")
            and now - task.get("completed_at", now) > 600
        ]
        for tid in expired:
            del _task_store[tid]
            print(f"[PlanV3] Cleaned up expired task {tid}")
