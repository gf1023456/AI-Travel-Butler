"""
历史记录相关路由
"""
from typing import Optional, List, Dict, Any, Union

from fastapi import APIRouter, Body, HTTPException, Query, Header
from pydantic import BaseModel

from database import db

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
    """
    user_id = get_user_id(authorization)

    from database.models import TravelPlan  # 导入模型

    offset = (page - 1) * page_size

    with db.get_session() as session:
        query = session.query(TravelPlan).filter(
            TravelPlan.user_id == user_id,
            TravelPlan.is_deleted == False  # 过滤掉已删除的记录
        )

        if favorite_only:
            query = query.filter(TravelPlan.is_favorite == True)  # 只获取收藏的 

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

    from database.models import User, TravelPlan  # 导入数据模型

    # 使用数据库会话
    with db.get_session() as session:
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
            generation_time_ms=get_attr_or_fallback(request_data, 'generation_time_ms', 'generationTimeMs', None)
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
            "cost_estimate": float(plan_entity.cost_estimate) if plan_entity.cost_estimate else None
        }

        session.commit()  # 确保数据提交

    # 在数据库会话结束后返回值，这样可以确保所有需要的数据都已经转换
    return {
        "code": 0,
        "data": {"id": result["id"]},
        "msg": "保存成功"
    }





@router.post("/favorite")
async def toggle_plan_favorite(
        request: ToggleFavoriteRequest = Body(...),
        authorization: str = Header(...)
):
    """
    切换收藏状态
    """
    user_id = get_user_id(authorization)

    from database.models import TravelPlan

    with db.get_session() as session:
        plan = session.query(TravelPlan).filter(
            TravelPlan.id == request.plan_id,
            TravelPlan.user_id == user_id
        ).first()

        if not plan:
            return {
                "code": 404,
                "data": {"is_favorite": False},
                "msg": "行程不存在"
            }

        # 在同一会话中变更并提交，直接获取状态避免LazyLoading 
        current_favorite_status = not plan.is_favorite
        plan.is_favorite = current_favorite_status
        session.flush()  # 立即同步到数据库

        result_status = plan.is_favorite
        session.commit()

    return {
        "code": 0,
        "data": {"is_favorite": result_status},
        "msg": "操作成功"
    }


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
