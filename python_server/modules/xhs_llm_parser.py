"""
小红书笔记 LLM 解析模块
用 LLM 将笔记原文解析为平台标准行程结构
"""
import json
import re
import asyncio
from typing import Dict, Optional, List

import httpx

from config.settings import settings
from config.constants import API_ENDPOINTS
from modules.json_parser import extract_json


_XHS_PARSE_PROMPT = """你是一位旅行笔记解析专家。请将以下小红书笔记内容解析为结构化的旅行行程。

【笔记标题】{title}
【笔记正文】{content}

【输出要求】
严格输出 JSON，格式如下：
{{
  "itinerary_summary": "基于笔记标题的摘要（20字以内）",
  "city": "目的地城市（从笔记内容推断）",
  "day_plan": [
    {{
      "day": 1,
      "sequence": 1,
      "name": "景点名（去掉emoji编号和装饰符号）",
      "city": "城市",
      "description": "笔记中关于该景点的原文描述（50字以内，保留原文风味）",
      "time": "建议时间（如上午、下午、晚上，根据笔记推断）",
      "category": "SIGHT/FOOD/SHOPPING"
    }}
  ]
}}

【规则】
1. day_plan 按笔记原文的 Day/天 分组，保持原始顺序
2. name 提取真实景点名（去掉 1⃣️ 2⃣️ ① ② 等 emoji 编号和装饰符号）
3. description 保留笔记原文中对该景点的描述，不要编造
4. 如果笔记没有明确 Day 分组，全部归为 day=1
5. category 根据内容判断：景点=SIGHT，美食=FOOD，购物=SHOPPING
6. 只输出 JSON，不要其他文字"""


async def _call_llm(messages: List[Dict], timeout: float = 30) -> Optional[str]:
    """调用 LLM API（简化版，不走 tools）"""
    provider = settings.rollout.primary_provider
    endpoint = API_ENDPOINTS.get(provider, API_ENDPOINTS["deepseek"])

    if provider == "deepseek":
        api_key = settings.providers.deepseek_api_key
        model = settings.providers.default_deepseek_model
    elif provider == "dashscope":
        api_key = settings.providers.dashscope_api_key
        model = settings.providers.default_dashscope_model
    elif provider == "mimo":
        api_key = settings.providers.mimo_api_key
        model = settings.providers.default_mimo_model
    else:
        api_key = settings.providers.deepseek_api_key
        model = settings.providers.default_deepseek_model

    print(f"[XHS-LLM] provider={provider}, endpoint={endpoint}, model={model}")
    print(f"[XHS-LLM] api_key length={len(api_key) if api_key else 0}")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    body = {
        "model": model,
        "messages": messages,
        "max_tokens": 4096,
        "temperature": 0.1,
    }

    if provider == "deepseek":
        body["frequency_penalty"] = 0.1
        body["presence_penalty"] = 0.1

    max_retries = settings.server.max_retries
    for attempt in range(max_retries + 1):
        try:
            print(f"[XHS-LLM] attempt {attempt + 1}/{max_retries + 1}")
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(endpoint, headers=headers, json=body)
                print(f"[XHS-LLM] response status={response.status_code}")
                if response.status_code != 200:
                    print(f"[XHS-LLM] error body: {response.text[:500]}")
                    if attempt < max_retries:
                        await asyncio.sleep(0.3 * (attempt + 1))
                        continue
                    return None

                data = response.json()
                print(f"[XHS-LLM] response keys: {list(data.keys())}")
                message = data.get("choices", [{}])[0].get("message", {})
                content = message.get("content", "")
                print(f"[XHS-LLM] content length={len(content) if content else 0}")
                if content:
                    return content
                return None

        except Exception as e:
            import traceback
            print(f"[XHS-LLM] attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            print(f"[XHS-LLM] traceback: {traceback.format_exc()}")
            if attempt < max_retries:
                await asyncio.sleep(0.3 * (attempt + 1))
                continue
            return None

    return None


def _parse_llm_json(text: str) -> Optional[Dict]:
    """解析 LLM 输出的 JSON"""
    raw = extract_json(text)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            cleaned = raw.replace("'", '"')
            cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            return None

    if not isinstance(data, dict):
        return None
    if "day_plan" not in data:
        return None

    return data


def _infer_category(title: str, content: str) -> str:
    """从标题和内容推断分类"""
    text = f"{title} {content}"
    if any(kw in text for kw in ['摄影', '拍照', '出片', '机位', '夜景']):
        return 'photo'
    if any(kw in text for kw in ['美食', '吃', '小吃', '餐厅', '咖啡']):
        return 'food'
    if any(kw in text for kw in ['情侣', '约会', '浪漫']):
        return 'couple'
    if any(kw in text for kw in ['带娃', '亲子', '家庭', '小朋友', '动物园']):
        return 'family'
    if any(kw in text for kw in ['特种兵', '暴走', '打卡', '穷游']):
        return 'rusher'
    if any(kw in text for kw in ['自驾', '环线', '公路', '露营']):
        return 'road'
    return 'city'


def _assign_images(day_plan: List[Dict], images: List[str]) -> List[Dict]:
    """将图片均匀分配到各景点"""
    if not images or not day_plan:
        return day_plan

    for i, spot in enumerate(day_plan):
        idx = i % len(images)
        spot['image'] = images[idx]

    return day_plan


async def llm_parse_note(
    title: str,
    content: str,
    images: Optional[List[str]] = None,
    city: Optional[str] = None,
) -> Optional[Dict]:
    """
    用 LLM 解析小红书笔记

    Returns:
        {
            "itinerary_summary": str,
            "day_plan": list,
            "category": str,
            "city": str,
            "spot_count": int,
            "parse_method": "llm"
        }
        失败返回 None
    """
    prompt = _XHS_PARSE_PROMPT.format(title=title, content=content[:3000])

    messages = [
        {"role": "system", "content": "你是旅行笔记解析专家，只输出 JSON。"},
        {"role": "user", "content": prompt}
    ]

    response_text = await _call_llm(messages, timeout=30)
    if not response_text:
        print("[XHS-LLM] LLM 返回为空")
        return None

    data = _parse_llm_json(response_text)
    if not data:
        print(f"[XHS-LLM] JSON 解析失败: {response_text[:200]}")
        return None

    # 规范化 day_plan
    day_plan = data.get("day_plan", [])
    if not isinstance(day_plan, list):
        return None

    for i, spot in enumerate(day_plan):
        if not isinstance(spot, dict):
            continue
        spot.setdefault('name', '')
        spot.setdefault('city', city or data.get('city', ''))
        spot.setdefault('day', 1)
        spot.setdefault('sequence', i + 1)
        spot.setdefault('description', '')
        spot.setdefault('reason', '')
        spot.setdefault('time', '')
        spot.setdefault('category', 'SIGHT')

    # 过滤无效景点
    day_plan = [s for s in day_plan if isinstance(s, dict) and s.get('name')]

    # 分配图片
    if images:
        day_plan = _assign_images(day_plan, images)

    category = _infer_category(title, content)
    inferred_city = city or data.get('city', '')

    summary = data.get('itinerary_summary', '')
    if not summary:
        summary = title if title and len(title) <= 50 else f"{inferred_city}旅行方案"

    return {
        'itinerary_summary': summary,
        'day_plan': day_plan,
        'category': category,
        'city': inferred_city,
        'spot_count': len(day_plan),
        'parse_method': 'llm',
    }
