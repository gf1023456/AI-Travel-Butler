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
      "description": "景点描述。优先使用笔记原文中的描述，如笔记中该景点无详细描述，则结合景点名称和你的知识库自主生成一段200字以内的有价值的描述（包含景点特色、亮点、推荐理由等），禁止留空或生成'未提供详细描述'等敷衍文案",
      "tips": "实用小提醒，如笔记中有则提取（营业时间、避坑、交通、穿搭建议等），没有则留空",
      "time": "建议时间（如上午、下午、晚上，根据笔记推断）",
      "category": "city/photo/food/couple/family/rusher/road"
    }}
  ]
}}

【规则】
0. 如果正文结构简单（1天或1-2个景点），直接返回。
1. day_plan 按笔记原文的 Day/天 分组，保持原始顺序（景点出现的先后顺序必须和笔记正文一致）
2. name 提取景点的完整官方名称（如"赛格国际购物中心"而不是"赛格"，"陕西历史博物馆"保持完整）。去掉 1⃣️ 2⃣️ ① ② 等 emoji 编号和装饰符号
3. description 优先使用笔记原文中的描述。如果笔记中该景点只是简单提及（如"📍解放碑"）而没有详细描述，则结合景点名称和你的知识库自主生成有价值的描述，包含景点特色、亮点、推荐理由等。禁止留空字符串，禁止生成"笔记中列出该景点，但未提供详细描述"、"未提供详细描述"等敷衍文案
4. tips 提取笔记中零散的实用信息：门票价格、开放时间、交通方式、穿搭建议、避坑提醒、最佳拍照时间等。如果没有明显的小提醒则留空字符串
5. 如果笔记没有明确 Day 分组，全部归为 day=1
6. category 根据内容判断，只能是以下之一：city/photo/food/couple/family/rusher/road
7. city 输出城市简称，不带"市/省/自治区"后缀（如"西安"而非"西安市"，"北京"而非"北京市"）
8. 只输出 JSON，不要其他文字"""


async def _call_llm(messages: List[Dict], timeout: float = 60) -> Optional[str]:
    """调用 LLM API（简化版，不走 tools）"""
    provider = settings.rollout.primary_provider
    endpoint = API_ENDPOINTS.get(provider, API_ENDPOINTS["deepseek"])

    if provider == "deepseek":
        api_key = settings.providers.deepseek_api_key
        model = "deepseek-v4-flash"  # XHS 解析用闪版，更快更稳
    elif provider == "dashscope":
        api_key = settings.providers.dashscope_api_key
        model = settings.providers.default_dashscope_model
    elif provider == "mimo":
        api_key = settings.providers.mimo_api_key
        model = settings.providers.default_mimo_model
    else:
        api_key = settings.providers.deepseek_api_key
        model = "deepseek-v4-flash"  # XHS 解析用闪版

    print(f"[XHS-LLM] provider={provider}, endpoint={endpoint}, model={model}")
    print(f"[XHS-LLM] api_key length={len(api_key) if api_key else 0}")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    body = {
        "model": model,
        "messages": messages,
        "max_tokens": 6000,
        "temperature": 0.4,
    }

    if provider == "deepseek":
        body["frequency_penalty"] = 0.1
        body["presence_penalty"] = 0.1

    max_retries = 0  # XHS 解析不重试，超时直接降级正则
    for attempt in range(max_retries + 1):
        try:
            print(f"[XHS-LLM] attempt {attempt + 1}/{max_retries + 1}")
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0, read=120.0, write=15.0)) as client:
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
    # 图片不传给 LLM，节省 token；解析完后按笔记顺序分配
    prompt = _XHS_PARSE_PROMPT.format(title=title, content=content[:5000])

    messages = [
        {"role": "system", "content": "你是旅行笔记解析专家，只输出 JSON。"},
        {"role": "user", "content": prompt}
    ]

    response_text = await _call_llm(messages, timeout=120)
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
        spot.setdefault('tips', '')
        spot.setdefault('reason', '')
        spot.setdefault('time', '')
        spot.setdefault('category', 'SIGHT')

    # 过滤无效景点
    day_plan = [s for s in day_plan if isinstance(s, dict) and s.get('name')]

    # 按笔记原始顺序分配图片（LLM 保持了笔记顺序，直接按位置对应）
    if images:
        for i, spot in enumerate(day_plan):
            if i < len(images):
                spot['image'] = images[i]

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
