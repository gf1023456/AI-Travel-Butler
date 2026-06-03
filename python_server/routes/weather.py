"""
AI Travel Butler - 和风天气查询路由
"""

import httpx
from fastapi import APIRouter, Query, HTTPException

from config import settings

router = APIRouter(prefix="/api/weather", tags=["天气"])

QWEATHER_BASE_URL = "https://devapi.qweather.com/v7"
QWEATHER_API_KEY = "8b8a55610b67456091a21ea4cdc870ba"


@router.get("/now")
async def get_weather_now(
    longitude: float = Query(..., description="经度"),
    latitude: float = Query(..., description="纬度"),
):
    """根据经纬度获取实时天气"""
    location = f"{longitude},{latitude}"
    url = f"{QWEATHER_BASE_URL}/weather/now"
    params = {"location": location, "key": QWEATHER_API_KEY}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=httpx.Timeout(60.0, connect=60.0, read=60.0))

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="和风天气服务暂不可用")

    data = resp.json()
    if data.get("code") != "200":
        raise HTTPException(status_code=502, detail=data.get("msg", "天气查询失败"))

    now = data["now"]
    return {
        "code": 0,
        "data": {
            "temp": now["temp"],
            "feelsLike": now["feelsLike"],
            "icon": now["icon"],
            "text": now["text"],
            "windDir": now["windDir"],
            "windScale": now["windScale"],
            "humidity": now["humidity"],
            "precip": now["precip"],
            "obsTime": now["obsTime"],
        },
        "msg": "获取成功",
    }
