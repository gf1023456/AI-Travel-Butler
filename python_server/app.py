"""
AI Travel Butler - Main FastAPI Application
"""

import json
import uuid
import asyncio
import traceback
import sys
from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

from config import (
    settings,
    GLOBAL_SYSTEM_PROMPT,
    HARD_CONSTRAINTS,
    API_ENDPOINTS,
    SERVICE_INFO
)
from models import (
    HealthResponse,
    FrontendConfig,
)
from modules.utils import get_city_center, infer_city_from_request, infer_requested_days
from modules.tool_handler import map_tool_calls
from modules.post_processor import (
    extract_expected_city_from_input,
    harmonize_itinerary_city,
    synthesize_locations_from_social,
    ensure_minimum_items_by_requested_days,
    enrich_with_mcp_signals
)
from modules.verifier import verify_plan
from modules.image_fetcher import enrich_images


app = FastAPI(
    title="AI Travel Butler API",
    version=SERVICE_INFO["version"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
from routes import user_router, history_router, quota_router, weather_router, location_router
from routes.plan_v2 import router as plan_v2_router
from routes.plan_v3 import router as plan_v3_router
from routes.plan_v4 import router as plan_v4_router

from routes.poster import router as poster_router
from routes.random_city import router as random_city_router
from routes.plan_likes import router as plan_likes_router

app.include_router(poster_router)
app.include_router(random_city_router)
app.include_router(plan_likes_router)
app.include_router(user_router)
app.include_router(history_router)
app.include_router(quota_router)
app.include_router(weather_router)
app.include_router(location_router)
app.include_router(plan_v2_router)
app.include_router(plan_v3_router)
app.include_router(plan_v4_router)

@app.on_event("startup")
async def startup_plan_cleanup():
    from routes.plan_v2 import _cleanup_old_tasks as v2_cleanup
    from routes.plan_v3 import _cleanup_old_tasks as v3_cleanup
    from routes.plan_v4 import _cleanup_v4_tasks as v4_cleanup
    asyncio.create_task(v2_cleanup())
    asyncio.create_task(v3_cleanup())
    asyncio.create_task(v4_cleanup())

knowledge_cache = None
execution_log_store: Dict[str, Dict] = {}
response_cache: Dict[str, Dict] = {}
alerts: List[Dict] = []

metrics = {
    "totalRequests": 0,
    "planRequests": 0,
    "refineRequests": 0,
    "failedRequests": 0,
    "cacheHits": 0,
    "totalEstimatedCost": 0.0,
    "providerCounts": {"gemini": 0, "deepseek": 0, "zhipu": 0, "dashscope": 0, "unknown": 0},
    "lastError": None
}


async def load_knowledge_chunks():
    """Load knowledge chunks from file."""
    global knowledge_cache
    if knowledge_cache:
        return knowledge_cache

    import os
    knowledge_file = settings.rag.knowledge_file
    try:
        if os.path.exists(knowledge_file):
            with open(knowledge_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
                knowledge_cache = [json.loads(line) for line in lines if line.strip()]
                return knowledge_cache
    except Exception as e:
        print(f"Error loading knowledge: {e}")

    knowledge_cache = []
    return knowledge_cache


def to_keywords(text: str) -> List[str]:
    """Extract keywords from text."""
    import re
    text = str(text or "").lower()
    text = re.sub(r"[^\u4e00-\u9fa5a-zA-Z0-9\s]", " ", text)
    return [t for t in text.split() if len(t) > 1]


def keyword_score(query: str, chunk: Dict) -> int:
    """Calculate keyword match score."""
    q = set(to_keywords(query))
    content = f"{chunk.get('city', '')} {' '.join(chunk.get('tags', []))} {chunk.get('snippet', '')}".lower()
    score = sum(1 for token in q if token in content)
    return score


async def retrieve_evidence(query: str, top_k: int) -> List[Dict]:
    """Retrieve evidence from knowledge base."""
    chunks = await load_knowledge_chunks()
    scored = []
    for chunk in chunks:
        score = keyword_score(query, chunk)
        if score > 0:
            scored.append({"chunk": chunk, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)
    scored = scored[:top_k]

    return [
        {
            "claim": f"与需求相关：{x['chunk'].get('city', '目的地')}知识片段",
            "source": x["chunk"].get("source", settings.rag.knowledge_file),
            "snippet": x["chunk"].get("snippet", ""),
            "fetched_at": datetime.now().isoformat(),
            "score": x["score"],
            "chunk_id": x["chunk"].get("id")
        }
        for x in scored
    ]


def build_rag_context(evidence: List[Dict]) -> str:
    """Build RAG context from evidence."""
    if not evidence:
        return ""
    lines = [f"{i+1}. {e['snippet']}（source: {e['source']}）" for i, e in enumerate(evidence)]
    return f"\n\n【本地知识库检索上下文】\n{chr(10).join(lines)}\n请优先参考以上信息。"


def construct_user_prompt(user_input: str, is_planner_mode: bool, travel_mode: str, rag_context: str) -> str:
    """Construct user prompt."""
    if is_planner_mode:
        return f"旅行风格：{travel_mode}。请生成详细每日行程：{user_input}。{HARD_CONSTRAINTS}{rag_context}"
    return f"请推荐 5-10 个地点并标注地图：{user_input}。{HARD_CONSTRAINTS}{rag_context}"


def cache_key_of(payload: Dict) -> str:
    """Generate cache key for payload."""
    return json.dumps({
        "userInput": payload.get("userInput"),
        "modelType": payload.get("modelType"),
        "isPlannerMode": payload.get("isPlannerMode"),
        "travelMode": payload.get("travelMode")
    })


def stable_bucket(text: str) -> int:
    """Generate stable bucket for canary rollout."""
    h = 0
    for c in str(text or ""):
        h = (h * 31 + ord(c)) % 100
    return h


def choose_rollout_provider(payload: Dict) -> Dict:
    """Choose provider based on rollout strategy."""
    requested = str(payload.get("modelType", "")).lower()

    if requested and requested != "auto":
        if requested.startswith("gemini"):
            return {"provider": "gemini", "modelType": payload.get("modelType"), "rollout": "fixed"}
        if "deepseek" in requested:
            return {"provider": "deepseek", "modelType": payload.get("modelType"), "rollout": "fixed"}
        if "glm" in requested:
            return {"provider": "zhipu", "modelType": payload.get("modelType"), "rollout": "fixed"}
        if "qwen" in requested:
            return {"provider": "dashscope", "modelType": payload.get("modelType"), "rollout": "fixed"}
        if "mimo" in requested:
            return {"provider": "mimo", "modelType": payload.get("modelType"), "rollout": "fixed"}

    bucket = stable_bucket(payload.get("userInput", ""))
    canary_hit = settings.rollout.enable_canary and bucket < settings.rollout.canary_percent

    provider = settings.rollout.canary_provider if canary_hit else settings.rollout.primary_provider

    model_map = {
        "gemini": settings.providers.default_gemini_model,
        "deepseek": settings.providers.default_deepseek_model,
        "zhipu": settings.providers.default_zhipu_model,
        "dashscope": settings.providers.default_dashscope_model,
        "mimo": settings.providers.default_mimo_model
    }

    return {
        "provider": provider,
        "modelType": model_map.get(provider, "gemini-2.0-flash"),
        "rollout": "canary" if canary_hit else "primary"
    }


def validate_payload(payload: Dict) -> Optional[str]:
    """Validate request payload."""
    if not payload or not isinstance(payload, dict):
        return "Request body must be a JSON object"
    if not payload.get("userInput"):
        return "userInput is required"
    if not payload.get("modelType"):
        return "modelType is required"
    return None


def to_refine_payload(payload: Dict) -> Dict:
    """Convert refine request to plan payload."""
    base_summary = payload.get("basePlan", {}).get("itinerarySummary", "")
    return {
        "userInput": f"{payload.get('userInput', '')}\n\n请基於已有方案继续调整：{payload.get('refineInstruction', '')}\n已有摘要：{base_summary}".strip(),
        "modelType": payload.get("modelType"),
        "isPlannerMode": payload.get("isPlannerMode", True),
        "travelMode": payload.get("travelMode", "deep")
    }


def get_provider_from_model(model_type: str) -> str:
    """Get provider name from model type."""
    model_type = str(model_type or "").lower()
    if model_type.startswith("gemini"):
        return "gemini"
    if "deepseek" in model_type:
        return "deepseek"
    if "glm" in model_type:
        return "zhipu"
    if "qwen" in model_type:
        return "dashscope"
    if "mimo" in model_type:
        return "mimo"
    return "unknown"


def push_alert(level: str, code: str, message: str, extra: Dict = None):
    """Push alert to alerts list."""
    alert = {"level": level, "code": code, "message": message, "at": datetime.now().isoformat()}
    if extra:
        alert.update(extra)
    alerts.insert(0, alert)
    if len(alerts) > 100:
        alerts.pop()


async def call_compatible_api(endpoint: str, api_key: str, model: str, messages: List[Dict], provider: str, mcp_trace: List[str], request_id: str) -> Dict:
    """Call compatible API (DeepSeek, Zhipu, Dashscope)."""
    from config import TOOLS_CONFIG

    max_retries = settings.server.max_retries
    timeout_ms = settings.server.request_timeout_ms

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    body = {
        "model": model,
        "messages": messages,
        "tools": TOOLS_CONFIG,
        "tool_choice": "auto",
        "max_tokens": 4096,
        "temperature": 0.1
    }

    if provider == "zhipu":
        body["top_p"] = 0.8
    elif provider == "deepseek":
        body["frequency_penalty"] = 0.1
        body["presence_penalty"] = 0.1
    elif provider == "dashscope":
        body["top_p"] = 0.7
    elif provider == "mimo":
        body["top_p"] = 0.7

    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout_ms / 1000) as client:
                response = await client.post(endpoint, headers=headers, json=body)
                mcp_trace.append(f"provider:{provider}:attempt:{attempt + 1}:status:{response.status_code}")

                if  response.status_code!=200:
                    body_text = response.text[:240]
                    raise Exception(f"{provider} upstream status={response.status_code} body={body_text}")

                data = response.json()

                if provider == "zhipu" and data.get("response"):
                    message = data["response"]
                else:
                    message = data.get("choices", [{}])[0].get("message", {})

                return message

        except Exception as e:
            mcp_trace.append(f"provider:{provider}:attempt:{attempt + 1}:error")
            print(f"[{request_id}] {provider} attempt {attempt + 1} failed: {e}")
            if attempt >= max_retries:
                raise Exception(f"{provider} failed after {max_retries} retries: {e}")
            await asyncio.sleep(0.3 * (attempt + 1))

    return {}


async def call_ai_model(provider: str, model: str, prompt: str, user_input: str, mcp_trace: List[str], request_id: str) -> Dict:
    """Call AI model and return plan."""
    day_plan_itinerary = []
    social_recommendations = []
    max_tool_rounds = 10

    messages = [
        {"role": "system", "content": GLOBAL_SYSTEM_PROMPT},
        {"role": "user", "content": f"【强制执行】需求：{user_input}。{prompt}。你需要同时执行两个子任务：任务A 调用 get_social_recommendations；任务B 为每一天多次调用 location。请立刻开始调用工具，不要回复文字说明。"}
    ]

    final_message = None

    for round_idx in range(max_tool_rounds):
        mcp_trace.append(f"tool_round:{round_idx}:start")

        endpoint = API_ENDPOINTS.get(provider)
        api_keys = {
            "deepseek": settings.providers.deepseek_api_key,
            "zhipu": settings.providers.zhipu_api_key,
            "dashscope": settings.providers.dashscope_api_key,
            "mimo": settings.providers.mimo_api_key
        }
        api_key = api_keys.get(provider)

        if not api_key:
            raise Exception(f"Missing API key for {provider}")

        message = await call_compatible_api(endpoint, api_key, model, messages, provider, mcp_trace, request_id)
        print(f"[RAW-MODEL-OUTPUT] {provider} round {round_idx}:", message)

        messages.append(message)
        tool_calls = message.get("tool_calls", [])

        if not tool_calls:
            final_message = message
            mcp_trace.append(f"tool_round:{round_idx}:no_more_calls")
            break

        mapped = map_tool_calls(tool_calls, mcp_trace, provider)
        day_plan_itinerary.extend(mapped.get("dayPlanItinerary", []))
        if mapped.get("socialRecommendations") and not social_recommendations:
            social_recommendations = mapped["socialRecommendations"]

        for tc in tool_calls:
            fn_name = tc.get("function", {}).get("name")
            raw_args = tc.get("function", {}).get("arguments", "{}")
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except:
                args = {}

            print(f"[TOOL_CALL] {fn_name}:", args)

            if fn_name == "get_social_recommendations":
                mcp_trace.append(f"tool:{provider}:get_social_recommendations:executed")
                recs = social_recommendations or []
                tool_result = json.dumps({"status": "ok", "count": len(recs), "recommendations": [r.get("title", "") for r in recs]}, ensure_ascii=False)
            elif fn_name == "location":
                mcp_trace.append(f"tool:{provider}:location:executed")
                name = args.get("name", "")
                item = next((i for i in mapped.get("dayPlanItinerary", []) if i.get("name") == name), None)
                tool_result = json.dumps({"status": "ok", "name": name, "city": args.get("city", ""), "lat": item.get("lat") if item else args.get("lat"), "lng": item.get("lng") if item else args.get("lng")}, ensure_ascii=False)
            else:
                tool_result = "[]"

            messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id", f"call_{round_idx}_{fn_name}"),
                "content": tool_result
            })

        mcp_trace.append(f"tool_round:{round_idx}:completed:{len(tool_calls)}_calls")

    if not day_plan_itinerary and social_recommendations:
        day_plan_itinerary = synthesize_locations_from_social(user_input, social_recommendations, provider, mcp_trace)

    return {
        "provider": provider,
        "itinerarySummary": final_message.get("content", "") if final_message else "规划已生成",
        "dayPlanItinerary": day_plan_itinerary,
        "socialRecommendations": social_recommendations,
        "mcpTrace": mcp_trace,
    }


async def fetch_real_weather(itinerary: List[Dict], mcp_trace: List[str]) -> Dict:
    """Use Hefeng API to fetch real weather for the first valid location in itinerary."""
    if not itinerary:
        return {}
    for item in itinerary:
        try:
            lat = float(item.get("lat", 0))
            lng = float(item.get("lng", 0))
            if lat and lng:
                QWEATHER_BASE_URL = "https://devapi.qweather.com/v7"
                QWEATHER_API_KEY = "8b8a55610b67456091a21ea4cdc870ba"
                url = f"{QWEATHER_BASE_URL}/weather/now"
                async with httpx.AsyncClient(timeout=8) as client:
                    resp = await client.get(url, params={"location": f"{lng},{lat}", "key": QWEATHER_API_KEY})
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("code") == "200":
                            now = data["now"]
                            mcp_trace.append("weather:realtime_api:success")
                            return {
                                "temp": now["temp"],
                                "icon": now["icon"],
                                "text": now["text"],
                                "obsTime": now["obsTime"],
                                "windDir": now["windDir"],
                                "windScale": now["windScale"],
                                "humidity": now["humidity"],
                            }
        except Exception as e:
            mcp_trace.append(f"weather:realtime_api:error:{e}")
            continue
    return {}


async def generate_plan(payload: Dict, request_id: str) -> Dict:
    """Generate travel plan."""
    mcp_trace = [f"request:{request_id}:received"]

    cache_key = cache_key_of(payload)
    cached = response_cache.get(cache_key)

    if cached:
        cache_ttl = settings.performance.cache_ttl_ms
        if datetime.now().timestamp() - cached.get("at", 0) < cache_ttl / 1000:
            metrics["cacheHits"] += 1
            cloned = cached["value"].copy()
            cloned["mcpTrace"] = [*cloned.get("mcpTrace", []), "cache:hit"]
            return cloned

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
    mcp_trace.append(f"rollout:{chosen['rollout']}:provider:{chosen['provider']}:model:{chosen['modelType']}")

    plan = await call_ai_model(
        chosen["provider"],
        chosen["modelType"],
        prompt,
        payload.get("userInput", ""),
        mcp_trace,
        request_id
    )

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

    plan["evidence"] = evidence

    response_cache[cache_key] = {
        "value": plan,
        "at": datetime.now().timestamp()
    }

    if len(response_cache) > 100:
        oldest_key = next(iter(response_cache))
        del response_cache[oldest_key]

    execution_log_store[request_id] = {
        "requestId": request_id,
        "route": "/api/plan",
        "startedAt": datetime.now().isoformat(),
        "finishedAt": datetime.now().isoformat(),
        "durationMs": 0,
        "modelType": payload.get("modelType"),
        "provider": get_provider_from_model(payload.get("modelType", "")),
        "userInputPreview": str(payload.get("userInput", ""))[:120],
        "mcpTraceCount": len(mcp_trace),
        "evidenceCount": len(evidence),
        "itineraryCount": len(plan.get("dayPlanItinerary", [])),
        "failed": False,
        "errorMessage": None
    }

    if len(execution_log_store) > 200:
        oldest_key = next(iter(execution_log_store))
        del execution_log_store[oldest_key]

    metrics["providerCounts"][chosen["provider"]] = metrics["providerCounts"].get(chosen["provider"], 0) + 1

    return plan


@app.get("/healthz", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(ok=True, service=SERVICE_INFO["name"], city=SERVICE_INFO["default_city"])


@app.get("/api/metrics")
async def get_metrics():
    """Get system metrics."""
    return {
        **metrics,
        "executionLogSize": len(execution_log_store),
        "cacheSize": len(response_cache),
        "alertCount": len(alerts),
        "updatedAt": datetime.now().isoformat()
    }


@app.get("/api/alerts")
async def get_alerts(request_id: str = ""):
    """Get alerts."""
    return {"alerts": alerts, "requestId": request_id}


@app.get("/api/release/status")
async def get_release_status(request_id: str = ""):
    """Get release status."""
    import os
    return {
        "enable_canary": settings.rollout.enable_canary,
        "canary_percent": settings.rollout.canary_percent,
        "primary_provider": settings.rollout.primary_provider,
        "canary_provider": settings.rollout.canary_provider,
        "auto_rollback_on_failure": settings.rollout.auto_rollback_on_failure,
        "config_file": os.environ.get("CONFIG_FILE", "server/config.json"),
        "requestId": request_id
    }


@app.get("/api/getModel")
async def get_current_model():
    """Get currently active model based on rollout strategy."""
    primary_provider = settings.rollout.primary_provider
    provider_names = {
        "gemini": "Gemini",
        "deepseek": "DeepSeek",
        "zhipu": "智谱GLM",
        "dashscope": "通义千问",
        "mimo": "MImo"
    }
    return {
        "modelName": provider_names.get(primary_provider, "Gemini")
    }


@app.get("/api/frontend-config")
async def get_frontend_config(request_id: str = ""):
    """Get frontend configuration."""
    import os
    return {
        "backend_url": f"http://localhost:{settings.server.port}",
        "tdt_api_key": settings.external_apis.tdt_api_key,
        "map_center": [30.5728, 104.0668],
        "map_zoom": 12,
        "default_map_type": "tdt_vec",
        "requestId": request_id
    }


@app.get("/api/knowledge/search")
async def knowledge_search(q: str = "", request_id: str = ""):
    """Search knowledge base."""
    evidence = await retrieve_evidence(q, settings.rag.top_k)
    return {"q": q, "evidence": evidence, "requestId": request_id}


@app.get("/api/execution-log/{log_id}")
async def get_execution_log(log_id: str, request_id: str = ""):
    """Get execution log."""
    log = execution_log_store.get(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="execution log not found")
    return {"log": log, "requestId": request_id}


@app.post("/api/plan")
async def create_plan(payload: Dict):
    """Create travel plan."""
    global metrics
    metrics["totalRequests"] += 1
    metrics["planRequests"] += 1

    request_id = str(uuid.uuid4())
    print(f"\n{'=' * 80}")
    print(f"📨 [请求开始] POST /api/plan")
    print(f"🆔 Request ID: {request_id}")
    print(f"⏰ 请求时间: {datetime.now().isoformat()}")
    print("=" * 80)

    error = validate_payload(payload)
    if error:
        metrics["failedRequests"] += 1
        metrics["lastError"] = {"message": error, "at": datetime.now().isoformat(), "route": "/api/plan"}
        raise HTTPException(status_code=400, detail=error)

    try:
        plan = await generate_plan(payload, request_id)
        return {**plan, "requestId": request_id}
    except Exception as e:
        metrics["failedRequests"] += 1
        error_msg = str(e)
        stack_trace = traceback.format_exc()
        print(f"\n{'='*80}")
        print(f"❌ [ERROR] /api/plan 请求处理失败")
        print(f"🆔 Request ID: {request_id}")
        print(f"💬 错误信息: {error_msg}")
        print(f"📍 堆栈跟踪:\n{stack_trace}")
        print(f"{'='*80}\n")
        metrics["lastError"] = {"message": error_msg, "stack": stack_trace, "at": datetime.now().isoformat(), "route": "/api/plan"}
        raise HTTPException(status_code=500, detail=f"{error_msg}\n\n堆栈:\n{stack_trace}")


@app.post("/api/plan/refine")
async def refine_plan(payload: Dict):
    """Refine travel plan."""
    global metrics
    metrics["totalRequests"] += 1
    metrics["refineRequests"] += 1

    request_id = str(uuid.uuid4())

    refined_payload = to_refine_payload(payload)
    error = validate_payload(refined_payload)
    if error:
        metrics["failedRequests"] += 1
        raise HTTPException(status_code=400, detail=error)

    try:
        plan = await generate_plan(refined_payload, request_id)
        return {**plan, "requestId": request_id}
    except Exception as e:
        metrics["failedRequests"] += 1
        error_msg = str(e)
        stack_trace = traceback.format_exc()
        print(f"\n{'='*80}")
        print(f"❌ [ERROR] /api/plan/refine 请求处理失败")
        print(f"🆔 Request ID: {request_id}")
        print(f"💬 错误信息: {error_msg}")
        print(f"📍 堆栈跟踪:\n{stack_trace}")
        print(f"{'='*80}\n")
        raise HTTPException(status_code=500, detail=f"{error_msg}\n\n堆栈:\n{stack_trace}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.server.port)
