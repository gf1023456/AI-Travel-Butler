"""
历史记录相关路由
"""
from typing import Optional, List, Dict, Any, Union

from fastapi import APIRouter, Body, HTTPException, Query, Header
from pydantic import BaseModel

from database import db
from database.models import TravelPlan, PlanLike
from constants.travel_styles import is_valid_slug

# 创建路由实例
router = APIRouter(prefix="/api/history", tags=["历史记录"])


# 定义请求/响应模型
class PlanSaveRequest(BaseModel):
    user_input: str  # 对应前端字段
    model_type: str
    provider: str
    itinerary_summary: str
    day_plan: Optional[Any] = None  # 兼容字典格式(按天分组)和数组格式(扁平列表)
    social_recommendations: Optional[List[Dict[str, Any]]] = None
    evidence: Optional[List[Dict[str, Any]]] = None
    warnings: Optional[List[Dict[str, Any]]] = None
    generation_time_ms: Optional[int] = None
    mcp_trace: Optional[List[str]] = None
    tokens_used: Optional[int] = None
    cost_estimate: Optional[float] = None
    # v1.1+: 广场/分类/封面
    category: Optional[str] = None           # light/deep/food/outdoor
    is_public: Optional[bool] = False
    cover_url: Optional[str] = None


class ToggleFavoriteRequest(BaseModel):
    plan_id: int  # 添加缺失的模型定义


def get_user_id(authorization: str) -> int:
    """
    从授权头中提取用户ID  
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="请先登录")

    # 移除 Bearer 前缀
    if authorization.startswith("Bearer "):
        authorization = authorization[7:]

    from auth import get_current_user_id  # 确保正确导入认证模块
    return get_current_user_id(authorization)


@router.get("/list")
async def get_history_list(
        authorization: str = Header(...),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        favorite_only: bool = Query(False)
):
    """
    获取历史记录列表

    - favorite_only=false（默认）：当前用户自己创建的方案
    - favorite_only=true：当前用户收藏的方案（来自 plan_favorites 表，跨用户独立）
    """
    user_id = get_user_id(authorization)

    from database.models import TravelPlan, PlanFavorite  # 导入模型

    offset = (page - 1) * page_size

    with db.get_session() as session:
        if favorite_only:
            # v1.1: 用 plan_favorites 关联表，只取当前用户收藏的方案（不限制作者）
            fav_q = session.query(PlanFavorite.plan_id).filter(PlanFavorite.user_id == user_id)
            query = session.query(TravelPlan).filter(
                TravelPlan.id.in_(fav_q.subquery()),
                TravelPlan.is_deleted == False
            )
        else:
            # 默认：仅看自己创建的方案
            query = session.query(TravelPlan).filter(
                TravelPlan.user_id == user_id,
                TravelPlan.is_deleted == False
            )

        total = query.count()
        plans_raw = query.order_by(TravelPlan.created_at.desc()).offset(offset).limit(page_size).all()

        # 在session作用域内将所有数据库对象转换为原始值类型
        # 防止 DetachedInstanceError 错误
        plan_list = []
        for p in plans_raw:
            # 提前将所有属性加载到普通字典中
            user_input_preview = p.user_input
            if user_input_preview and len(user_input_preview) > 100:
                user_input_preview = user_input_preview[:100] + "..."

            itinerary_summary_preview = p.itinerary_summary
            if itinerary_summary_preview and len(itinerary_summary_preview) > 200:
                itinerary_summary_preview = itinerary_summary_preview[:200] + "..."

            plan_list.append({
                "id": p.id,
                "user_input": user_input_preview,
                "provider": p.provider,
                "model_type": p.model_type,
                "itinerary_summary": itinerary_summary_preview,
                "is_favorite": p.is_favorite,
                "created_at": p.created_at.isoformat() if p.created_at else None
            })


    return {
        "code": 0,
        "data": {
            "list": plan_list,
            "total": total,
            "page": page,
            "page_size": page_size
        },
        "msg": "获取成功"
    }


@router.get("/detail/{plan_id}")
async def get_history_detail(
        plan_id: int,
        authorization: str = Header(...)
):
    """
    获取历史记录详情
    """
    user_id = get_user_id(authorization)

    from database.models import TravelPlan  # 导入模型

    with db.get_session() as session:
        plan = session.query(TravelPlan).filter(
            TravelPlan.id == plan_id,
            TravelPlan.user_id == user_id,
            TravelPlan.is_deleted == False
        ).first()

        if not plan:
            return {
                "code": 404,
                "msg": "行程不存在"
            }

        # 在session作用域内将所有属性提前加载到字典，防止DetachedInstanceError
        plan_dict = {
            "id": plan.id,
            "user_input": plan.user_input,
            "model_type": plan.model_type,
            "provider": plan.provider,
            "itinerary_summary": plan.itinerary_summary,
            "day_plan": plan.day_plan,
            "social_recommendations": plan.social_recommendations,
            "evidence": plan.evidence,
            "warnings": plan.warnings,
            "mcp_trace": plan.mcp_trace,
            "generation_time_ms": plan.generation_time_ms,
            "tokens_used": plan.tokens_used,
            "cost_estimate": float(plan.cost_estimate) if plan.cost_estimate else None,
            "is_favorite": plan.is_favorite,
            "created_at": plan.created_at.isoformat() if plan.created_at else None,
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else None
        }

    return {
        "code": 0,
        "data": plan_dict,
        "msg": "获取成功"
    }


@router.post("/save")
async def save_plan_to_history(
        request_data: PlanSaveRequest = Body(...),
        authorization: str = Header(...)
):
    """
    保存行程到历史记录 
    """
    user_id = get_user_id(authorization)

    # 检查必要参数
    user_input_value = getattr(request_data, 'user_input', None) or getattr(request_data, 'userInput', None)
    if not user_input_value:
        raise HTTPException(status_code=422, detail="user_input is required")

    # v1.1: 校验 category 合法性
    category = getattr(request_data, 'category', None)
    if category and not is_valid_slug(category):
        return {"code": 400, "msg": f"无效的 category: {category}"}

    is_public = bool(getattr(request_data, 'is_public', False))
    if is_public and not category:
        return {"code": 400, "msg": "公开到广场必须设置 category（旅行风格）"}

    # 若未传 cover_url，自动从 day_plan[0].items[0].image 抓
    cover_url = getattr(request_data, 'cover_url', None)
    if not cover_url:
        cover_url = _extract_first_image(getattr(request_data, 'day_plan', None))

    from database.models import User, TravelPlan  # 导入数据模型

    # 使用数据库会话
    with db.get_session() as session:
        # v1.1 去重：同一用户 itinerary_summary 完全相同 → 视为重复，不入库
        summary_value = (
            getattr(request_data, 'itinerary_summary', None)
            or getattr(request_data, 'itinerarySummary', None)
            or ''
        )
        if summary_value:
            existing = session.query(TravelPlan).filter(
                TravelPlan.user_id == user_id,
                TravelPlan.itinerary_summary == summary_value
            ).order_by(TravelPlan.created_at.desc()).first()
            if existing:
                return {
                    "code": 0,
                    "data": {"id": existing.id, "deduped": True},
                    "msg": "已存在相同摘要的方案，已复用"
                }

        # 更新用户生成计数
        session.query(User).filter(User.id == user_id).update(
            {User.total_plans: User.total_plans + 1})

        # 创建行程实体 - 支持兼容属性名（下划线和驼峰）
        def get_attr_or_fallback(req, primary, fallback, default=''):
            primary_val = getattr(req, primary, getattr(req, primary.replace('_', ''), None))
            fallback_val = getattr(req, fallback, getattr(req, fallback.replace('Plan', 'plan'), None)) or default
            return primary_val or fallback_val

        plan_entity = TravelPlan(
            user_id=user_id,
            user_input=get_attr_or_fallback(request_data, 'user_input', 'userInput', ''),
            model_type=get_attr_or_fallback(request_data, 'model_type', 'modelType', 'auto'),
            provider=get_attr_or_fallback(request_data, 'provider', 'provider', 'unknown'),
            itinerary_summary=get_attr_or_fallback(request_data, 'itinerary_summary', 'itinerarySummary', ''),
            day_plan=get_attr_or_fallback(request_data, 'day_plan', 'dayPlan', {}),
            social_recommendations=get_attr_or_fallback(request_data, 'social_recommendations', 'socialRecommendations',
                                                        []),
            evidence=get_attr_or_fallback(request_data, 'evidence', 'evidence', []),
            warnings=get_attr_or_fallback(request_data, 'warnings', 'warnings', []),
            generation_time_ms=get_attr_or_fallback(request_data, 'generation_time_ms', 'generationTimeMs', None),
            category=category,
            is_public=is_public,
            cover_url=cover_url
        )

        session.add(plan_entity)
        session.flush()  # 冲刷以获取数据库ID
        # 立即处理成原始值避免懒加载问题
        result = {
            "id": plan_entity.id,
            "user_input": plan_entity.user_input,
            "model_type": plan_entity.model_type,
            "provider": plan_entity.provider,
            "itinerary_summary": plan_entity.itinerary_summary,
            "day_plan": plan_entity.day_plan,
            "social_recommendations": plan_entity.social_recommendations,
            "evidence": plan_entity.evidence,
            "warnings": plan_entity.warnings,
            "mcp_trace": plan_entity.mcp_trace,
            "generation_time_ms": plan_entity.generation_time_ms,
            "tokens_used": plan_entity.tokens_used,
            "cost_estimate": float(plan_entity.cost_estimate) if plan_entity.cost_estimate else None,
            "category": plan_entity.category,
            "is_public": plan_entity.is_public,
            "cover_url": plan_entity.cover_url
        }

        session.commit()  # 确保数据提交

    # 在数据库会话结束后返回值，这样可以确保所有需要的数据都已经转换
    return {
        "code": 0,
        "data": {"id": result["id"]},
        "msg": "保存成功" if not is_public else "已公开到广场"
    }


def _extract_first_image(day_plan: Any) -> Optional[str]:
    """从 day_plan 中提取第一张图（用于 cover_url 兜底）"""
    try:
        if not day_plan:
            return None
        # 数组形式 [day, day, ...]
        if isinstance(day_plan, list):
            for day in day_plan:
                if isinstance(day, dict):
                    items = day.get('items') if isinstance(day.get('items'), list) else None
                    if items:
                        for it in items:
                            if isinstance(it, dict) and it.get('image'):
                                return it['image']
                    elif day.get('image'):
                        return day['image']
        # 字典形式 {day1: [loc, loc], ...}
        elif isinstance(day_plan, dict):
            for _dk, day in day_plan.items():
                if isinstance(day, list):
                    for it in day:
                        if isinstance(it, dict) and it.get('image'):
                            return it['image']
                elif isinstance(day, dict) and day.get('image'):
                    return day['image']
    except Exception:
        pass
    return None





@router.post("/favorite")
async def toggle_plan_favorite(
        request: ToggleFavoriteRequest = Body(...),
        authorization: str = Header(...)
):
    """
    切换收藏状态（v1.1：每用户独立，使用 plan_favorites 关联表）

    跨用户独立：用户 A 收藏了某方案，不会影响用户 B。
    """
    user_id = get_user_id(authorization)
    print(f"[Favorite v1.1] 收到收藏请求 plan_id={request.plan_id} user_id={user_id}")

    result = db.toggle_plan_favorite(user_id, request.plan_id)

    if result.get("code") == 404:
        return {
            "code": 404,
            "data": {"is_favorite": False},
            "msg": result.get("msg", "方案不存在")
        }

    return {
        "code": 0,
        "data": {"is_favorite": result.get("is_favorited", False)},
        "msg": "已收藏" if result.get("is_favorited") else "已取消收藏"
    }


@router.get("/public")
async def get_public_plans(
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=50),
        category: Optional[str] = Query(None, description="light/deep/food/outdoor，'all' 或空表示全部"),
        sort: Optional[str] = Query("hot", description="hot(按点赞数) / new(按创建时间)"),
        authorization: Optional[str] = Header(None)
):
    """
    获取公开方案列表（灵感广场）

    - 只返回 is_public=true 的方案
    - 点赞数取自 plan_likes 真表
    - 当前用户（如果登录）返回 is_liked 标记
    """
    from database.models import TravelPlan, PlanLike
    from database.models import User
    from sqlalchemy import func as sqlfunc

    # 解析当前 user_id（可选登录）
    current_user_id = None
    if authorization:
        try:
            from auth import get_current_user_id
            current_user_id = get_current_user_id(authorization.replace("Bearer ", "").strip())
        except Exception:
            current_user_id = None

    offset = (page - 1) * page_size

    with db.get_session() as session:
        # 基础查询：已公开 + 非删除 + 有摘要
        base_q = session.query(TravelPlan).filter(
            TravelPlan.is_deleted == False,
            TravelPlan.is_public == True,
            TravelPlan.itinerary_summary.isnot(None),
            TravelPlan.itinerary_summary != ""
        )
        if category and category not in ('', 'all', 'hot'):
            base_q = base_q.filter(TravelPlan.category == category)

        total = base_q.count()

        # 排序：hot 按点赞数倒序，new 按时间倒序
        if sort == 'new':
            plans_raw = base_q.order_by(TravelPlan.created_at.desc()).offset(offset).limit(page_size).all()
        else:
            # 按点赞数 desc, created_at desc 二级排序
            like_count_subq = session.query(
                PlanLike.plan_id,
                sqlfunc.count(PlanLike.id).label('like_count')
            ).group_by(PlanLike.plan_id).subquery()
            q = session.query(TravelPlan, sqlfunc.coalesce(like_count_subq.c.like_count, 0).label('like_count')) \
                .outerjoin(like_count_subq, like_count_subq.c.plan_id == TravelPlan.id) \
                .filter(
                    TravelPlan.is_deleted == False,
                    TravelPlan.is_public == True,
                    TravelPlan.itinerary_summary.isnot(None),
                    TravelPlan.itinerary_summary != ""
                )
            if category and category not in ('', 'all', 'hot'):
                q = q.filter(TravelPlan.category == category)
            plans_raw = q.order_by(sqlfunc.coalesce(like_count_subq.c.like_count, 0).desc(), TravelPlan.created_at.desc()) \
                .offset(offset).limit(page_size).all()

        # 批量取作者信息（SQLAlchemy 2.x 的 Row 不是 tuple 子类，用 _mapping 判断）
        _is_row = bool(plans_raw) and hasattr(plans_raw[0], '_mapping')
        if _is_row:
            author_ids = list({row[0].user_id for row in plans_raw})
        else:
            author_ids = list({p.user_id for p in plans_raw})
        authors = {a.id: a for a in session.query(User).filter(User.id.in_(author_ids)).all()} if author_ids else {}

        # 批量取当前用户的点赞状态
        if _is_row:
            plan_ids = [row[0].id for row in plans_raw]
        else:
            plan_ids = [p.id for p in plans_raw]
        liked_map = db.get_likes_for_plans(current_user_id, plan_ids) if current_user_id else {}
        fav_map = db.get_favorites_for_user(current_user_id, plan_ids) if current_user_id else {}

        fallback_covers = [
            "https://tonystark-ai.ccwu.cc/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png",
            "https://tonystark-ai.ccwu.cc/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png",
            "https://tonystark-ai.ccwu.cc/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png"
        ]

        plan_list = []
        for i, item in enumerate(plans_raw):
            if hasattr(item, '_mapping'):
                p, likes = item[0], (item[1] if len(item) > 1 else 0)
            else:
                p, likes = item, 0
            summary = p.itinerary_summary or ""
            title = (summary[:30] + "...") if len(summary) > 30 else (summary or "旅行方案")

            # 封面优先级：cover_url > 抓 day_plan image > fallback
            cover = p.cover_url
            if not cover:
                cover = _extract_first_image(p.day_plan) or fallback_covers[i % len(fallback_covers)]

            author = authors.get(p.user_id)
            plan_list.append({
                "id": p.id,
                "title": title,
                "author": author.nickname if author and author.nickname else "匿名旅者",
                "author_avatar": author.avatar_url if author and author.avatar_url else "",
                "category": p.category,
                "likes": int(likes or 0),
                "is_liked": liked_map.get(p.id, False),
                "is_favorited": fav_map.get(p.id, False),
                "is_public": True,
                "cover": cover,
                "user_input": p.user_input or "",
                "created_at": p.created_at.isoformat() if p.created_at else None
            })

    return {
        "code": 0,
        "data": {
            "list": plan_list,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    }


@router.get("/public/{plan_id}")
async def get_public_plan_detail(plan_id: int, authorization: Optional[str] = Header(None)):
    """
    获取公开方案详情（灵感广场点击查看），无需登录

    - is_public=true 才返回（作者本人能预览自己私有的）
    - 返回 category + is_liked
    """
    from database.models import TravelPlan, User, PlanLike, PlanFavorite

    current_user_id = None
    if authorization:
        try:
            from auth import get_current_user_id
            current_user_id = get_current_user_id(authorization.replace("Bearer ", "").strip())
        except Exception:
            current_user_id = None

    with db.get_session() as session:
        plan = session.query(TravelPlan).filter(
            TravelPlan.id == plan_id,
            TravelPlan.is_deleted == False
        ).first()

        if not plan:
            return {"code": 404, "msg": "行程不存在"}

        # 私有时只有作者能看
        if not plan.is_public and plan.user_id != current_user_id:
            return {"code": 403, "msg": "该方案未公开"}

        author = session.query(User).filter(User.id == plan.user_id).first()

        # 真实点赞数 + 当前用户是否点过
        like_count = session.query(PlanLike).filter(PlanLike.plan_id == plan_id).count()
        is_liked = False
        is_favorited = False
        if current_user_id:
            is_liked = session.query(PlanLike).filter(
                PlanLike.user_id == current_user_id, PlanLike.plan_id == plan_id
            ).first() is not None
            is_favorited = session.query(PlanFavorite).filter(
                PlanFavorite.user_id == current_user_id, PlanFavorite.plan_id == plan_id
            ).first() is not None

        plan_dict = {
            "id": plan.id,
            "user_input": plan.user_input,
            "model_type": plan.model_type,
            "itinerary_summary": plan.itinerary_summary,
            "day_plan": plan.day_plan,
            "social_recommendations": plan.social_recommendations,
            "evidence": plan.evidence,
            "warnings": plan.warnings,
            "category": plan.category,
            "is_public": plan.is_public,
            "likes": int(like_count),
            "is_liked": is_liked,
            "is_favorited": is_favorited,
            "author": author.nickname if author else "匿名旅者",
            "author_avatar": author.avatar_url if author else "",
            "created_at": plan.created_at.isoformat() if plan.created_at else None
        }

    return {"code": 0, "data": plan_dict}


@router.delete("/{plan_id}")
async def delete_history_by_id(
        plan_id: int,
        authorization: str = Header(...)
):
    """
    删除历史记录
    """
    user_id = get_user_id(authorization)

    from database.models import TravelPlan  # 导入模型

    with db.get_session() as session:
        plan = session.query(TravelPlan).filter(
            TravelPlan.id == plan_id,
            TravelPlan.user_id == user_id
        ).first()

        if not plan:
            return {"code": 404, "msg": "行程不存在"}

        # 在session内立即执行删除标记
        plan.is_deleted = True
        session.commit()  # 立即提交到数据库

    return {"code": 0, "msg": "删除成功"}


__all__ = ['router']  # 确保模块正确导出
