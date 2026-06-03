"""
AI Travel Butler - 用户路由
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional

from auth import wechat_login, refresh_access_token, verify_token, get_current_user_id, get_phone_number
from database import db, User

router = APIRouter(prefix="/api", tags=["用户"])


class LoginRequest(BaseModel):
    code: str  # 微信wx.login返回的code
    user_info: Optional[dict] = None  # 可选的用户信息 {nickname, avatar_url}
    # 手机号相关（可选）
    phone_code: Optional[str] = None  # 手机号授权code
    encrypted_data: Optional[str] = None  # 加密数据
    iv: Optional[str] = None  # 加密算法初始向量


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PhoneDecryptRequest(BaseModel):
    code: str
    encryptedData: str
    iv: str


class UserInfoUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None


@router.post("/login")
async def login(request: LoginRequest):
    """
    微信小程序登录
    """
    print(f"[Login] 收到登录请求: code={request.code[:20] if request.code else 'None'}...")
    print(f"[Login] user_info: {request.user_info}")
    print(f"[Login] phone_code: {'已提供' if request.phone_code else '未提供'}")
    
    try:
        result = await wechat_login(
            code=request.code,
            user_info=request.user_info,
            phone_code=request.phone_code,
            encrypted_data=request.encrypted_data,
            iv=request.iv
        )
        print(f"[Login] 登录成功: user_id={result['user_id']}")
        return {
            "code": 0,
            "data": result,
            "msg": "登录成功"
        }
    except Exception as e:
        print(f"[Login] 登录失败: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refreshToken")
async def refresh_token(request: RefreshTokenRequest):
    """
    刷新访问令牌
    """
    try:
        result = await refresh_access_token(request.refresh_token)
        return {
            "code": 0,
            "data": result,
            "msg": "刷新成功"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/phone/decrypt")
async def decrypt_phone(request: PhoneDecryptRequest):
    """
    解密手机号
    """
    try:
        result = await get_phone_number(request.code, request.encryptedData, request.iv)
        return {
            "code": 0,
            "data": result,
            "msg": "获取成功"
        }
    except Exception as e:
        print(f"[Phone] 解密失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/userInfo")
async def get_user_info(authorization: str = Header(None)):
    """
    获取用户信息 - 必须登录
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="请先登录")
    
    user_id = get_current_user_id(authorization)
    
    with db.get_session() as session:
        user = session.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        return {
            "code": 0,
            "data": {
                "id": user.id,
                "nickname": user.nickname,
                "avatar_url": user.avatar_url,
                "phone": user.phone,
                "gender": user.gender,
                "country": user.country,
                "province": user.province,
                "city": user.city,
                "total_plans": user.total_plans,
                "created_at": user.created_at.isoformat() if user.created_at else None
            },
            "msg": "获取成功"
        }


@router.post("/userInfo")
async def update_user_info(
    info: UserInfoUpdate,
    authorization: str = Header(None),

):
    if not authorization:
        raise HTTPException(status_code=401, detail="请先登录")

    current_user_id = get_current_user_id(authorization)
    """
    更新用户信息
    """
    update_data = {}
    if info.nickname:
        update_data['nickname'] = info.nickname
    if info.avatar_url:
        update_data['avatar_url'] = info.avatar_url
    if info.phone:
        update_data['phone'] = info.phone
    
    with db.get_session() as session:
        session.query(User).filter(User.id == current_user_id).update(update_data)
    
    return {"code": 0, "msg": "更新成功"}
