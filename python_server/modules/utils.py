"""
AI Travel Butler - Utility Functions
"""

from typing import Dict, Tuple, Optional, List


CITY_CENTERS = {
    "大理": {"lat": 25.6075, "lng": 100.2676},
    "呼和浩特": {"lat": 40.8426, "lng": 111.7492},
    "西安": {"lat": 34.3416, "lng": 108.9398},
    "北京": {"lat": 39.9042, "lng": 116.4074},
    "上海": {"lat": 31.2304, "lng": 121.4737},
    "成都": {"lat": 30.5728, "lng": 104.0668},
    "重庆": {"lat": 29.563, "lng": 106.5516},
    "广州": {"lat": 23.1291, "lng": 113.2644},
    "深圳": {"lat": 22.5431, "lng": 114.0579},
    "杭州": {"lat": 30.2741, "lng": 120.1551},
    "南京": {"lat": 32.0603, "lng": 118.7969},
    "苏州": {"lat": 31.2989, "lng": 120.5853},
    "昆明": {"lat": 25.0389, "lng": 102.7183},
    "丽江": {"lat": 26.8721, "lng": 100.2296}
}

DEFAULT_CENTER = {"lat": 39.9042, "lng": 116.4074}
KNOWN_CITIES = list(CITY_CENTERS.keys())


def get_city_center(city: str) -> Dict[str, float]:
    """Get city center coordinates."""
    return CITY_CENTERS.get(city, DEFAULT_CENTER)


def infer_city_from_request(user_input: str, recommendations: List[Dict]) -> str:
    """Infer city from user input and recommendations."""
    text = str(user_input or "")
    from_recs = " ".join(
        f"{r.get('title', '')} {r.get('reason', '')}" for r in (recommendations or [])
    )
    combined = f"{text} {from_recs}"

    for city in KNOWN_CITIES:
        if city in combined:
            return city
    return ""


def infer_requested_days(user_input: str) -> int:
    """Infer requested travel days from user input."""
    import re

    text = str(user_input or "")

    # Direct number match
    match = re.search(r"(\d+)\s*[天日]", text)
    if match:
        return min(10, max(1, int(match.group(1))))

    # Chinese number words
    if "一" in text or "一天" in text or "一日" in text:
        return 1
    if "两" in text or "二" in text or "两天" in text or "二日" in text:
        return 2
    if "三" in text and ("天" in text or "日" in text):
        return 3
    if "四" in text and ("天" in text or "日" in text):
        return 4
    if "五" in text and ("天" in text or "日" in text):
        return 5

    return 1


def extract_destination_from_input(user_input: str) -> str:
    """Extract destination from user input."""
    import re

    text = str(user_input or "")

    # Match "从 A 到/去/前往 B"
    match = re.search(r"从\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(?:到|去|前往|->|→)\s*([\u4e00-\u9fa5a-zA-Z]+)", text)
    if match and match.group(2):
        return match.group(2)

    # Match "到 B"
    match = re.search(r"到\s*([\u4e00-\u9fa5a-zA-Z]+)", text)
    if match and match.group(1):
        return match.group(1)

    return ""


def estimate_weather_by_hour(time_range: str) -> Dict[str, str]:
    """Estimate weather by time range."""
    import re

    match = re.search(r"(\d{1,2})", str(time_range or ""))
    first_hour = int(match.group(1)) if match else 12

    if first_hour <= 8:
        return {"weather_icon": "🌤️", "weather_condition": "清晨晴朗", "temperature": "18°C"}
    if first_hour <= 16:
        return {"weather_icon": "☀️", "weather_condition": "白天晴朗", "temperature": "25°C"}
    return {"weather_icon": "🌙", "weather_condition": "夜间微风", "temperature": "20°C"}