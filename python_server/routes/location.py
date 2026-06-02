"""
AI Travel Butler - 地点相关路由（图片查询等）
"""

from fastapi import APIRouter, Query
from modules.image_fetcher import fetch_location_image

router = APIRouter(prefix="/api/location", tags=["地点"])


@router.get("/image")
async def get_location_image(
    name: str = Query(..., description="地点名称"),
    city: str = Query("", description="所在城市"),
):
    """获取地点实景图（百度图片搜索，国内可用）"""
    print(f"[Location] 请求图片: name={name} city={city}")
    url = await fetch_location_image(name, city)
    print(f"[Location] 结果: url={url[:60] + '...' if url else 'None'}")
    return {"code": 0 if url else 1001, "data": {"url": url} if url else None, "msg": "获取成功" if url else "未找到图片"}


@router.get("/ping")
async def ping():
    """检测服务版本"""
    from modules.image_fetcher import fetch_location_image
    import inspect
    src = inspect.getsource(fetch_location_image)
    return {
        "version": "v2-baidu",
        "baidu_enabled": "baidu" in src.lower(),
        "status": "ok",
    }
