"""
AI Travel Butler - 微信小程序认证模块
"""

import os
import uuid
import hashlib
import json
import time
import base64
from datetime import datetime, timedelta
from typing import Optional
import httpx
from Crypto.Cipher import AES

from config import settings
from database import db


def get_wechat_config():
    """获取微信配置"""
    env_appid = os.environ.get('WECHAT_APPID')
    env_secret = os.environ.get('WECHAT_SECRET')
    config_appid = settings.wechat.appid
    config_secret = settings.wechat.secret
    
    print(f"[WeChat Config] 环境变量 WECHAT_APPID: {'已设置' if env_appid else '未设置'}")
    print(f"[WeChat Config] 环境变量 WECHAT_SECRET: {'已设置' if env_secret else '未设置'}")
    print(f"[WeChat Config] 配置文件 appid: {'已设置' if config_appid else '未设置'}")
    print(f"[WeChat Config] 配置文件 secret: {'已设置' if config_secret else '未设置'}")
    
    appid = env_appid or config_appid
    secret = env_secret or config_secret
    
    if not appid:
        raise ValueError("WECHAT_APPID 未配置")
    if not secret:
        raise ValueError("WECHAT_SECRET 未配置")
    
    print(f"[WeChat Config] 最终使用: appid={appid[:10]}...")
    return appid, secret


def generate_token() -> tuple:
    """生成访问令牌和刷新令牌"""
    access_token = hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()
    refresh_token = hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()
    
    # 令牌过期时间 (7天)
    expires_at = datetime.now() + timedelta(days=7)
    refresh_expires_at = datetime.now() + timedelta(days=30)
    
    return access_token, refresh_token, expires_at, refresh_expires_at


async def get_wechat_session(code: str) -> dict:
    """调用微信接口获取用户openid和session_key"""
    appid, secret = get_wechat_config()
    
    print(f"[WeChat] appid={appid}, code={code[:30]}...")
    
    url = f"https://api.weixin.qq.com/sns/jscode2session"
    params = {
        'appid': appid,
        'secret': secret,
        'js_code': code,
        'grant_type': 'authorization_code'
    }
    
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, params=params)
        print(f"[WeChat] 响应状态: {response.status_code}")
        data = response.json()
        print(f"[WeChat] 响应数据: {data}")
        
        if 'errcode' in data:
            raise Exception(f"微信登录失败: {data.get('errmsg', '未知错误')}")
        
        return {
            'openid': data.get('openid'),
            'session_key': data.get('session_key'),
            'unionid': data.get('unionid')
        }


async def wechat_login(code: str, user_info: dict = None, phone_code: str = None, encrypted_data: str = None, iv: str = None, invite_code: str = None) -> dict:
    """
    微信小程序登录
    
    Args:
        code: 小程序wx.login返回的code
        user_info: 可选的用户信息 {nickname, avatar_url, gender, country, province, city, language}
        phone_code: 手机号授权code
        encrypted_data: 加密数据
        iv: 加密算法初始向量
        invite_code: 邀请码（来自分享链接）
    
    Returns:
        {user_id, openid, access_token, expires_at, phone}
    """
    # 获取openid
    wechat_data = await get_wechat_session(code)
    openid = wechat_data['openid']
    session_key = wechat_data['session_key']
    unionid = wechat_data.get('unionid')
    
    # 如果有手机号授权，解密手机号
    phone = None
    if phone_code and encrypted_data and iv:
        try:
            print(f"[Login] 开始解密手机号...")
            phone = decrypt_phone_number(session_key, encrypted_data, iv)
            print(f"[Login] ✅ 手机号解密成功: {phone}")
        except Exception as e:
            print(f"[Login] ⚠️ 手机号解密失败: {e}")
            phone = None
    
    # 生成令牌
    access_token, refresh_token, expires_at, refresh_expires_at = generate_token()
    
    # 所有数据库操作在一个 session 中完成
    with db.get_session() as db_session:
        from database import User, UserSession
        
        # 查找用户
        user = db_session.query(User).filter(User.openid == openid).first()
        print(f"[Login] openid={openid}, existing_user={bool(user)}, invite_code_param={invite_code}")

        if not user:
            # 创建新用户
            user = User(
                openid=openid,
                unionid=unionid,
                nickname=user_info.get('nickname') if user_info else None,
                avatar_url=user_info.get('avatar_url') if user_info else None,
                phone=phone,  # 保存手机号
                gender=user_info.get('gender', 0) if user_info else 0,
                country=user_info.get('country') if user_info else None,
                province=user_info.get('province') if user_info else None,
                city=user_info.get('city') if user_info else None,
                language=user_info.get('language') if user_info else None,
            )
            db_session.add(user)
            db_session.flush()  # 获取 user.id

            # 新用户：如果有邀请码，自动处理邀请
            # 关键：传外层 db_session 进去，保证新用户在同一事务内可见
            if invite_code:
                try:
                    result = db.process_invite(user.id, invite_code, _session=db_session)
                    if result.get('code') == 0:
                        print(f"[Login] ✅ 自动处理邀请码成功: user_id={user.id}, invite_code={invite_code}, inviter_id={result.get('inviter_id')}")
                    else:
                        print(f"[Login] ⚠️ 处理邀请码返回非 0: {result}")
                except Exception as e:
                    print(f"[Login] ⚠️ 处理邀请码异常: {e}")
                    import traceback
                    traceback.print_exc()
        else:
            # 更新用户信息
            if user_info:
                if user_info.get('nickname') != '微信用户':
                    user.nickname = user_info['nickname']
                if user_info.get('avatar_url') != None and user_info.get('avatar_url') != '':
                    user.avatar_url = user_info['avatar_url']
                if user_info.get('gender') is not None:
                    user.gender = user_info['gender']
            
            # 如果有手机号，更新手机号
            if phone:
                user.phone = phone
        user_id = user.id
        
        # 查找或创建会话
        existing_session = db_session.query(UserSession).filter(
            UserSession.user_id == user_id
        ).first()
        
        if existing_session:
            existing_session.access_token = access_token
            existing_session.refresh_token = refresh_token
            existing_session.token_expires_at = expires_at
            existing_session.refresh_expires_at = refresh_expires_at
            existing_session.session_key = session_key
        else:
            new_session = UserSession(
                user_id=user_id,
                session_key=session_key,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=expires_at,
                refresh_expires_at=refresh_expires_at
            )
            db_session.add(new_session)
        
        db_session.commit()
    
    return {
        'user_id': user_id,
        'openid': openid,
        'access_token': access_token,
        'expires_at': expires_at.isoformat(),
        'refresh_token': refresh_token,
        'refresh_expires_at': refresh_expires_at.isoformat(),
        'phone': phone  # 返回手机号
    }


async def refresh_access_token(refresh_token: str) -> dict:
    """刷新访问令牌"""
    from database import db, UserSession
    
    with db.get_session() as session:
        session_obj = session.query(UserSession).filter(
            UserSession.refresh_token == refresh_token
        ).first()
        
        if not session_obj:
            raise Exception("无效的刷新令牌")
        
        if session_obj.refresh_expires_at < datetime.now():
            raise Exception("刷新令牌已过期")
        
        # 生成新令牌
        access_token, new_refresh_token, expires_at, refresh_expires_at = generate_token()
        
        session_obj.access_token = access_token
        session_obj.refresh_token = new_refresh_token
        session_obj.token_expires_at = expires_at
        session_obj.refresh_expires_at = refresh_expires_at
        
        return {
            'access_token': access_token,
            'expires_at': expires_at.isoformat(),
            'refresh_token': new_refresh_token,
            'refresh_expires_at': refresh_expires_at.isoformat()
        }


def verify_token(access_token: str) -> Optional[int]:
    """验证访问令牌，返回user_id"""
    from database import db, UserSession
    
    with db.get_session() as session:
        session_obj = session.query(UserSession).filter(
            UserSession.access_token == access_token
        ).first()
        
        if not session_obj:
            return None
        
        if session_obj.token_expires_at < datetime.now():
            return None
        
        return session_obj.user_id


def get_current_user_id(authorization: str = None) -> int:
    """验证访问令牌并返回用户ID"""
    from fastapi import HTTPException
    
    print(f"[Auth] get_current_user_id called, authorization: {authorization}")
    
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证信息")
    
    token = authorization.replace("Bearer ", "").strip()
    print(f"[Auth] token: {token}")
    
    user_id = verify_token(token)
    print(f"[Auth] verify_token result: {user_id}")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="登录已过期")
    
    return user_id


def decrypt_wechat_data(session_key: str, encrypted_data: str, iv: str) -> dict:
    """解密微信数据"""
    import base64
    from Crypto.Cipher import AES
    
    session_key_bytes = base64.b64decode(session_key)
    encrypted_data_bytes = base64.b64decode(encrypted_data)
    iv_bytes = base64.b64decode(iv)
    
    cipher = AES.new(session_key_bytes, AES.MODE_CBC, iv_bytes)
    decrypted = cipher.decrypt(encrypted_data_bytes)
    
    # 去除 PKCS7 填充
    padding_len = decrypted[-1]
    if padding_len < 1 or padding_len > 32:
        padding_len = 0
    decrypted = decrypted[:-padding_len]
    
    return json.loads(decrypted.decode('utf-8'))


def decrypt_phone_number(session_key: str, encrypted_data: str, iv: str) -> str:
    """解密微信手机号
    
    Args:
        session_key: 微信session_key
        encrypted_data: 加密数据
        iv: 加密向量
    
    Returns:
        手机号字符串
    """
    # 使用已有的decrypt_wechat_data函数
    phone_info = decrypt_wechat_data(session_key, encrypted_data, iv)
    
    # 返回纯手机号
    return phone_info.get('purePhoneNumber') or phone_info.get('phoneNumber')


async def get_phone_number(code: str, encrypted_data: str, iv: str) -> dict:
    """通过 code 和加密数据获取手机号"""
    import base64
    from config import settings
    from database import db, UserSession
    
    appid, secret = get_wechat_config()
    
    # 获取 session_key
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            "https://api.weixin.qq.com/sns/jscode2session",
            params={
                'appid': appid,
                'secret': secret,
                'js_code': code,
                'grant_type': 'authorization_code'
            }
        )
        data = response.json()
        
        if 'errcode' in data and data['errcode'] != 0:
            raise Exception(f"获取session_key失败: {data.get('errmsg')}")
        
        session_key = data.get('session_key')
    
    # 解密手机号
    phone_info = decrypt_wechat_data(session_key, encrypted_data, iv)
    
    return {
        'phoneNumber': phone_info.get('phoneNumber'),
        'purePhoneNumber': phone_info.get('purePhoneNumber'),
        'countryCode': phone_info.get('countryCode'),
        'watermark': phone_info.get('watermark')
    }
