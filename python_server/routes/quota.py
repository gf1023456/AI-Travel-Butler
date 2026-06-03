"""
AI Travel Butler - 配额管理路由
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user_id
from database import db

router = APIRouter(prefix="/api/quota", tags=["配额管理"])


class BonusRequest(BaseModel):
    bonus_type: str = "share"


def get_user_id(authorization: str) -> int:
    if not authorization:
        raise HTTPException(status_code=401, detail="未登录")
    return get_current_user_id(authorization)


@router.get("/check")
async def check_quota(authorization: str = Header(None)):
    """检查用户今日配额"""
    current_user_id = get_user_id(authorization)
    quota = db.check_user_quota(current_user_id)
    return {"code": 0, "data": quota, "msg": "获取成功"}


@router.post("/bonus")
async def add_bonus(request: BonusRequest, authorization: str = Header(None)):
    """增加奖励次数"""
    if not authorization:
        return {"code": 401, "msg": "请先登录"}
    
    try:
        current_user_id = get_current_user_id(authorization)
    except HTTPException:
        return {"code": 401, "msg": "登录已过期"}
    
    bonus_type = request.bonus_type if request.bonus_type in ["share", "ad"] else "share"
    db.add_bonus(current_user_id, bonus_type)
    quota = db.check_user_quota(current_user_id)
    return {"code": 0, "data": quota, "msg": "奖励已添加"}


@router.post("/use")
async def use_quota(authorization: str = Header(None)):
    """使用一次配额"""
    if not authorization:
        return {"code": 401, "msg": "请先登录"}
    
    try:
        current_user_id = get_current_user_id(authorization)
    except HTTPException:
        return {"code": 401, "msg": "登录已过期"}
    
    quota_before = db.check_user_quota(current_user_id)
    max_free = quota_before.get("max", 10)
    if not quota_before.get("can_use", True):
        return {"code": 1001, "data": quota_before, "msg": "今日次数已用完"}
    
    # increment_usage 内部已计算 remaining，直接使用返回值
    quota_after = db.increment_usage(current_user_id)
    quota_after["can_use"] = quota_after.get("remaining", 0) > 0
    
    return {"code": 0, "data": quota_after, "msg": "配额已使用"}
