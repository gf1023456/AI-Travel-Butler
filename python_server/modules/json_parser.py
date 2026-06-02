"""
AI Travel Butler - LLM JSON 输出解析器
将单轮模型输出的 JSON 解析为标准化行程数据
"""

import json
import re
from typing import Dict, Any, List, Tuple
from .normalizer import normalize_location


def extract_json(text: str) -> str:
    """从模型输出中提取 JSON 字符串（去掉 markdown 包裹）"""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return match.group(1).strip()
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end > brace_start:
        return text[brace_start : brace_end + 1]
    return text


def parse_plan_json(text: str, provider: str) -> Tuple[str, List[Dict], List[Dict]]:
    """解析模型输出的完整行程 JSON

    Returns:
        (summary, dayPlanItinerary, socialRecommendations)
    """
    raw = extract_json(text)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            cleaned = raw.replace("'", '"')
            cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
            cleaned = re.sub(r"([{,])\s*\"", r'\1"', cleaned)
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            return "", [], []

    summary = data.get("summary") or data.get("itinerarySummary") or ""
    social = _parse_social(data, provider)
    itinerary = _parse_itinerary(data, provider)

    return summary, itinerary, social


def _parse_social(data: Dict, provider: str) -> List[Dict]:
    """解析社交推荐"""
    recs = data.get("socialRecommendations") or data.get("social_recommendations") or []
    if not isinstance(recs, list):
        return []

    results = []
    for idx, rec in enumerate(recs):
        if not rec.get("title"):
            continue
        results.append({
            "rank": int(rec.get("rank", idx + 1)),
            "title": str(rec.get("title", "")),
            "platform": str(rec.get("platform", "综合")),
            "hot_score": str(rec.get("hot_score", "N/A")),
            "reason": str(rec.get("reason", "")),
            "photo_tips": rec.get("photo_tips"),
            "source": f"provider:{provider}:social",
            "source_timestamp": "2024-01-01T00:00:00Z",
            "confidence": rec.get("confidence", 0.6),
        })
    return results


def _parse_itinerary(data: Dict, provider: str) -> List[Dict]:
    """解析每日行程"""
    items = []

    days = data.get("days") or data.get("dayPlanItinerary") or []
    if isinstance(days, list):
        for day_entry in days:
            if isinstance(day_entry, dict) and "itinerary" in day_entry:
                day_num = int(day_entry.get("day", 1))
                for loc in day_entry.get("itinerary", []):
                    loc["day"] = loc.get("day", day_num)
                    parsed = normalize_location(loc, provider)
                    if parsed and parsed.get("name") and parsed.get("name") != "未知地点":
                        items.append(parsed)
            elif isinstance(day_entry, dict) and "name" in day_entry:
                parsed = normalize_location(day_entry, provider)
                if parsed and parsed.get("name") and parsed.get("name") != "未知地点":
                    items.append(parsed)

    flat = data.get("dayPlanItinerary") if isinstance(items, list) else items
    if isinstance(flat, list) and not items:
        for loc in flat:
            if isinstance(loc, dict) and "name" in loc:
                parsed = normalize_location(loc, provider)
                if parsed and parsed.get("name") and parsed.get("name") != "未知地点":
                    items.append(parsed)

    return items
