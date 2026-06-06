"""
方案点赞路由（公开社交信号）
"""
from fastapi import APIRouter, Header, HTTPException

from database import db

router = APIRouter(prefix="/api/plan", tags=["点赞"])


@router.post("/{plan_id}/like")
async def toggle_like(plan_id: int, authorization: str = Header(None)):
    """Toggle 点赞：返回 {is_liked, likes}"""
    if not authorization:
        raise HTTPException(status_code=401, detail="请先登录")

    # 提取 user_id
    token = authorization.replace("Bearer ", "").strip() if authorization.startswith("Bearer ") else authorization
    from auth import get_current_user_id
    user_id = get_current_user_id(token)

    result = db.toggle_plan_like(user_id, plan_id)
    if result.get("code") != 0:
        return {"code": result["code"], "msg": result.get("msg", "操作失败")}

    return {
        "code": 0,
        "data": {
            "is_liked": result["is_liked"],
            "likes": result["likes"]
        },
        "msg": "已点赞" if result["is_liked"] else "已取消点赞"
    }


__all__ = ['router']
