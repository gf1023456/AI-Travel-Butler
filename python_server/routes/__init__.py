"""
AI Travel Butler - 路由模块
"""
from .user import router as user_router
from .history import router as history_router
from .quota import router as quota_router
from .weather import router as weather_router
from .location import router as location_router

__all__ = ["user_router", "history_router", "quota_router", "weather_router", "location_router"]
