"""
AI Travel Butler - /api/plan/v2 单轮 JSON 输出方案
相比 v1 去掉多轮工具循环，模型一次性输出 JSON，延迟从 15-75s 降至 5-12s
"""

import json
import uuid
import asyncio
import traceback
from typing import Dict, Any, List
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException

from config import settings, API_ENDPOINTS, SERVICE_INFO
from modules.post_processor import (
    extract_expected_city_from_input,
    harmonize_itinerary_city,
    ensure_minimum_items_by_requested_days,
    enrich_with_mcp_signals,
)
from modules.verifier import verify_plan
from modules.json_parser import parse_plan_json
from modules.image_fetcher import enrich_images

router = APIRouter(prefix="/api/plan", tags=["规划 v2"])

# 内存任务存储
_task_store: Dict[str, Dict[str, Any]] = {}

async def _cleanup_old_tasks():
    """每 5 分钟清理一次 10 分钟前的已完成/失败任务"""
    while True:
        await asyncio.sleep(300)
        now = datetime.now().timestamp()
        expired = [
            tid for tid, task in _task_store.items()
            if task.get("status") in ("completed", "failed")
            and now - task.get("completed_at", now) > 600
        ]
        for tid in expired:
            del _task_store[tid]
            print(f"[PlanV2] Cleaned up expired task {tid}")

QWEATHER_API_KEY = "8b8a55610b67456091a21ea4cdc870ba"
QWEATHER_BASE_URL = "https://devapi.qweather.com/v7"

V2_SYSTEM_PROMPT = """你是一位专业的深度旅游规划专家。请根据用户需求输出严格的 JSON 格式行程。

输出格式必须如下（精确匹配，不要额外文字）：
```json
{{
  "summary": "行程概述文字",
  "days": [
    {{
      "day": 1,
      "itinerary": [
        {{
          "name": "景点名称",
          "city": "城市名",
          "description": "景点介绍（50字以上，包含看点和游玩建议）",
          "lat": 39.9042,
          "lng": 116.4074,
          "time": "09:00 - 11:00",
          "day": 1,
          "sequence": 1,
          "transit_hint": "从上一个地点到此的交通建议"
        }}
      ]
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
```

约束：
- 每天至少 3 个地点
- 覆盖用户要求的天数
- lat/lng 必须真实有效
- location.city 必须为目标城市
- 相邻地点应地理接近，合理安排路线
- socialRecommendations 至少 3 条"""


async def call_model_once(provider: str, model: str, messages: List[Dict], request_id: str) -> Dict:
    """单轮调用 AI 模型，不启用工具循环"""
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
        "max_tokens": 8888,
        "temperature": 0.3,
    }

    max_retries = settings.server.max_retries
    for attempt in range(max_retries + 1):
        try:
            start = datetime.now()
            # 硬上限 50s，防止挂到网关 60s 超时返回 504
            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(endpoint, headers=headers, json=body)
            elapsed = (datetime.now() - start).total_seconds()
            print(f"[{request_id}] {provider} call took {elapsed:.1f}s")
            if resp.status_code != 200:
                raise Exception(f"upstream status={resp.status_code} body={resp.text[:240]}")
            data = resp.json()
            if provider == "zhipu" and data.get("response"):
                return data["response"]
            return data.get("choices", [{}])[0].get("message", {})
        except Exception as e:
            print(f"[{request_id}] {provider} attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            if attempt >= max_retries:
                raise HTTPException(status_code=502, detail=f"{provider} 调用失败: {e}")
            await asyncio.sleep(0.3 * (attempt + 1))
    return {}


async def fetch_real_weather(itinerary: List[Dict]) -> Dict:
    """取行程中第一个有效坐标查询和风天气"""
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


@router.post("/v2")
async def create_plan_v2(payload: Dict):
    """异步创建行程任务，立即返回 taskId"""
    task_id = str(uuid.uuid4())
    print(f"\n{'=' * 60}\n[PlanV2] Request {task_id}\n{'=' * 60}")

    user_input = (payload.get("userInput") or "").strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="userInput 不能为空")

    asyncio.create_task(_execute_plan_task(task_id, payload))
    return {"taskId": task_id, "status": "pending"}


async def _execute_plan_task(task_id: str, payload: Dict):
    """后台执行行程生成任务"""
    _task_store[task_id] = {"status": "running", "created_at": datetime.now().timestamp()}

    try:
        print(f"\n{'=' * 60}\n[PlanV2] Task {task_id} started\n{'=' * 60}")

        user_input = (payload.get("userInput") or "").strip()
        if not user_input:
            raise ValueError("userInput 不能为空")

        travel_mode = payload.get("travelMode", "deep")
        messages = [
            {"role": "system", "content": V2_SYSTEM_PROMPT},
            {"role": "user", "content": f"旅行风格：{travel_mode}。请生成详细行程：{user_input}"},
        ]

        chosen = _choose_provider(payload)
        provider, model = chosen["provider"], chosen["modelType"]
        print(f"[PlanV2] provider={provider} model={model}")

        message = await call_model_once(provider, model, messages, task_id)
        content = message.get("content", "")
        if not content:
            raise ValueError("模型返回为空")

        summary, itinerary, social = parse_plan_json(content, provider)
        if not itinerary:
            raise ValueError("无法解析模型输出，请重试")

        mcp_trace = [f"plan_v2:{task_id}:parsed:{len(itinerary)}_locations"]
        expected_city = extract_expected_city_from_input(user_input, social)
        if expected_city:
            itinerary = harmonize_itinerary_city(itinerary, expected_city, mcp_trace)

        itinerary = ensure_minimum_items_by_requested_days(itinerary, user_input, social, provider, mcp_trace)

        weather_task = asyncio.create_task(fetch_real_weather(itinerary))

        try:
            await asyncio.wait_for(enrich_images(itinerary, mcp_trace), timeout=12.0)
        except asyncio.TimeoutError:
            print(f"[PlanV2] enrich_images global timeout, fallback to loremflickr")
            mcp_trace.append("image:global_timeout_fallback")
            from urllib.parse import quote
            for item in itinerary:
                if not item.get("image"):
                    tags = f"{item.get('name', '')} {item.get('city', '')}".strip().replace(" ", ",")
                    item["image"] = f"https://loremflickr.com/640/480/{quote(tags)}"

        real_weather = await weather_task
        itinerary = enrich_with_mcp_signals(itinerary, mcp_trace, real_weather)
        warnings = verify_plan(itinerary, mcp_trace)

        result = {
            "itinerarySummary": summary or "行程已生成",
            "dayPlanItinerary": itinerary,
            "socialRecommendations": social,
            "warnings": warnings,
            "provider": provider,
            "mcpTrace": mcp_trace,
            "requestId": task_id,
        }

        _task_store[task_id] = {
            "status": "completed",
            "result": result,
            "completed_at": datetime.now().timestamp()
        }
        print(f"[PlanV2] Done: {len(itinerary)} locations, {len(social)} recs")

    except Exception as e:
        print(f"[PlanV2] Task {task_id} failed: {e}")
        _task_store[task_id] = {
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.now().timestamp()
        }


@router.get("/v2/status/{task_id}")
async def get_plan_status(task_id: str):
    """查询任务状态"""
    task = _task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")
    return {"taskId": task_id, "status": task["status"]}


@router.get("/v2/result/{task_id}")
async def get_plan_result(task_id: str):
    """获取任务结果，取完后删除"""
    task = _task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")

    if task["status"] == "failed":
        del _task_store[task_id]
        raise HTTPException(status_code=502, detail=task.get("error", "任务执行失败"))

    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="任务尚未完成")

    result = task["result"]
    del _task_store[task_id]
    return result


def _choose_provider(payload: Dict) -> Dict:
    """选择模型供应商"""
    requested = str(payload.get("modelType", "")).lower()
    if requested and requested != "auto":
        model_map = {
            "gemini": "gemini",
            "deepseek": "deepseek",
            "glm": "zhipu",
            "qwen": "dashscope",
            "mimo": "mimo",
        }
        for key, prov in model_map.items():
            if key in requested:
                models = {
                    "gemini": settings.providers.default_gemini_model,
                    "deepseek": settings.providers.default_deepseek_model,
                    "zhipu": settings.providers.default_zhipu_model,
                    "dashscope": settings.providers.default_dashscope_model,
                    "mimo": settings.providers.default_mimo_model,
                }
                return {"provider": prov, "modelType": payload.get("modelType")}

    provider = settings.rollout.primary_provider
    models = {
        "gemini": settings.providers.default_gemini_model,
        "deepseek": settings.providers.default_deepseek_model,
        "zhipu": settings.providers.default_zhipu_model,
        "dashscope": settings.providers.default_dashscope_model,
        "mimo": settings.providers.default_mimo_model,
    }
    return {"provider": provider, "modelType": models.get(provider, "deepseek-v4-pro")}
