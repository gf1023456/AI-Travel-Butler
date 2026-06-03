"""
AI Travel Butler - Utility Functions
"""

import httpx
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
    "丽江": {"lat": 26.8721, "lng": 100.2296},
    # 省会/热门城市
    "乌鲁木齐": {"lat": 43.8256, "lng": 87.6168},
    "拉萨": {"lat": 29.6525, "lng": 91.1721},
    "西宁": {"lat": 36.6171, "lng": 101.7782},
    "兰州": {"lat": 36.0611, "lng": 103.8343},
    "银川": {"lat": 38.4680, "lng": 106.2580},
    "桂林": {"lat": 25.2736, "lng": 110.2907},
    "厦门": {"lat": 24.4798, "lng": 118.0894},
    "三亚": {"lat": 18.2527, "lng": 109.5119},
    "青岛": {"lat": 36.0671, "lng": 120.3826},
    "长沙": {"lat": 28.2282, "lng": 112.9388},
    "武汉": {"lat": 30.5928, "lng": 114.3055},
    "哈尔滨": {"lat": 45.8038, "lng": 126.5340},
    "贵阳": {"lat": 26.6470, "lng": 106.6302},
    "南宁": {"lat": 20.0444, "lng": 110.1999},
    "太原": {"lat": 37.8706, "lng": 112.5489},
    "天津": {"lat": 39.3434, "lng": 117.3616},
    "大连": {"lat": 38.9140, "lng": 121.6147},
    "济南": {"lat": 36.6512, "lng": 116.8867},
    "郑州": {"lat": 34.7466, "lng": 113.6253},
    "南昌": {"lat": 28.6820, "lng": 115.8579},
    "福州": {"lat": 26.0753, "lng": 119.2965},
    "沈阳": {"lat": 41.8057, "lng": 123.4328},
    "石家庄": {"lat": 38.0428, "lng": 114.5149},
    "长春": {"lat": 43.8171, "lng": 125.3235},
}

DEFAULT_CENTER = {"lat": 39.9042, "lng": 116.4074}
KNOWN_CITIES = list(CITY_CENTERS.keys())

# 省份到省会的映射
PROVINCE_TO_CAPITAL = {
    "新疆": "乌鲁木齐", "西藏": "拉萨", "青海": "西宁",
    "甘肃": "兰州", "宁夏": "银川", "内蒙古": "呼和浩特",
}

_geocoding_cache: Dict[str, Dict[str, float]] = {}


async def geocode_location(name: str, city: str = "") -> Optional[Dict[str, float]]:
    """通过高德地图 API 获取地点的真实经纬度（带缓存）"""
    cache_key = f"{city}:{name}"
    if cache_key in _geocoding_cache:
        return _geocoding_cache[cache_key]
    
    from config import settings
    api_key = settings.external_apis.amap_api_key
    if not api_key:
        print(f"[Geocoding] 高德 API key 未配置，无法获取真实坐标: {name}")
        return None
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 关键词 = 地点名 + 城市（提高匹配精度）
            keywords = f"{name}" + (f" {city}" if city else "")
            resp = await client.get(
                "https://restapi.amap.com/v3/place/text",
                params={
                    "key": api_key,
                    "keywords": keywords,
                    "city": city or "全国",
                    "output": "json",
                    "batch": "false",
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                pois = data.get("pois", [])
                if pois and len(pois) > 0:
                    location = pois[0].get("location", "")
                    if location:
                        lng_str, lat_str = location.split(",")
                        result = {"lat": float(lat_str), "lng": float(lng_str)}
                        _geocoding_cache[cache_key] = result
                        print(f"[Geocoding] {name} → lat={result['lat']}, lng={result['lng']}")
                        return result
        print(f"[Geocoding] 未找到地点: {name}")
        return None
    except Exception as e:
        print(f"[Geocoding] 请求失败 {name}: {e}")
        return None


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

    # 先检查已知城市
    for city in KNOWN_CITIES:
        if city in combined:
            return city
    
    # 再检查省份映射
    for province, capital in PROVINCE_TO_CAPITAL.items():
        if province in combined and capital in KNOWN_CITIES:
            return capital
    
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
    if "六" in text and ("天" in text or "日" in text):
        return 6
    if "七" in text or "7" in text and ("天" in text or "日" in text):
        return 7
    if "八" in text and ("天" in text or "日" in text):
        return 8
    if "九" in text and ("天" in text or "日" in text):
        return 9
    if "十" in text and ("天" in text or "日" in text):
        return 10

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