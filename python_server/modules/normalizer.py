"""
AI Travel Butler - Data Normalization
"""

from typing import Dict, List, Any, Optional
import json


CITY_COORDINATES = {
    "西安": {"lat": 34.3416, "lng": 108.9398},
    "北京": {"lat": 39.9042, "lng": 116.4074},
    "上海": {"lat": 31.2304, "lng": 121.4737},
    "成都": {"lat": 30.5728, "lng": 104.0668},
    "重庆": {"lat": 29.563, "lng": 106.5516},
    "广州": {"lat": 23.1291, "lng": 113.2644},
    "深圳": {"lat": 22.5431, "lng": 114.0579},
    "杭州": {"lat": 30.2741, "lng": 120.1551},
    "南京": {"lat": 32.0603, "lng": 118.7969},
    "武汉": {"lat": 30.5929, "lng": 114.3055},
    "天津": {"lat": 39.3434, "lng": 117.3616},
    "苏州": {"lat": 31.2989, "lng": 120.5853},
    "厦门": {"lat": 24.4798, "lng": 118.0894},
    "青岛": {"lat": 36.0671, "lng": 120.3826},
    "昆明": {"lat": 25.0211, "lng": 102.7123},
    "丽江": {"lat": 26.8748, "lng": 100.233},
    "大理": {"lat": 25.6823, "lng": 100.2539},
    "西安": {"lat": 34.3416, "lng": 108.9398},
}


def parse_tool_arguments(raw_args: str) -> Dict[str, Any]:
    """Parse and validate JSON tool arguments."""
    if not raw_args:
        return {}

    try:
        return json.loads(raw_args)
    except json.JSONDecodeError:
        try:
            corrected = raw_args.replace("\\'", '"').replace("'", '"')
            corrected = corrected.replace('\\"', '"')
            return json.loads(corrected)
        except Exception:
            return {}


def normalize_location(item: Dict[str, Any], provider: str) -> Dict[str, Any]:
    """Normalize location data."""
    name = item.get("name")
    city = item.get("city")

    # Fallback for missing coordinates
    lat = item.get("lat")
    lng = item.get("lng")

    if not lat or not lng:
        fallback = CITY_COORDINATES.get(city, CITY_COORDINATES.get("西安"))
        lat = fallback["lat"]
        lng = fallback["lng"]

    return {
        "name": str(name) if name else "未知地点",
        "city": str(city) if city else "",
        "description": str(item.get("description", "")),
        "lat": float(lat) if lat else 34.3416,
        "lng": float(lng) if lng else 108.9398,
        "time": str(item.get("time", "")),
        "day": int(item.get("day", 1)),
        "sequence": int(item.get("sequence", 1)),
        "transit_hint": str(item.get("transit_hint", "")),
        "category": item.get("category"),
        "source": f"provider:{provider}:location",
        "source_timestamp": "2024-01-01T00:00:00Z",
        "confidence": item.get("confidence", 0.6)
    }


def normalize_recommendations_list(recommendations: List[Dict], provider: str) -> List[Dict[str, Any]]:
    """Normalize social recommendations."""
    results = []
    for idx, rec in enumerate(recommendations or []):
        results.append({
            "rank": int(rec.get("rank", idx + 1)),
            "title": str(rec.get("title", "")),
            "platform": str(rec.get("platform", "综合")),
            "hot_score": str(rec.get("hot_score", "N/A")),
            "reason": str(rec.get("reason", "")),
            "photo_tips": rec.get("photo_tips"),
            "source": f"provider:{provider}:social",
            "source_timestamp": "2024-01-01T00:00:00Z",
            "confidence": rec.get("confidence", 0.6)
        })
    return results
