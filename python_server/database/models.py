"""
AI Travel Butler - Database Module
PostgreSQL + SQLAlchemy
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, SmallInteger, DECIMAL, JSON, TIMESTAMP, ForeignKey, Date, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta

_BJT = timezone(timedelta(hours=8))

def _bjt_now():
    return datetime.now(_BJT)
from typing import Generator, Optional
import os

from config import settings

Base = declarative_base()


class User(Base):
    """用户表"""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    openid = Column(String(128), unique=True, nullable=False, index=True)
    unionid = Column(String(128))
    nickname = Column(String(100))
    avatar_url = Column(String(500))
    phone = Column(String(20))
    gender = Column(SmallInteger, default=0)
    country = Column(String(50))
    province = Column(String(50))
    city = Column(String(50))
    language = Column(String(20))
    status = Column(SmallInteger, default=1)
    total_plans = Column(Integer, default=0)
    invite_code = Column(String(32), unique=True, index=True)
    invited_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(TIMESTAMP, default=_bjt_now)
    updated_at = Column(TIMESTAMP, default=_bjt_now, onupdate=_bjt_now)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    plans = relationship("TravelPlan", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    """用户会话表"""
    __tablename__ = 'user_sessions'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    session_key = Column(String(256))
    access_token = Column(String(512), unique=True, index=True)
    token_expires_at = Column(TIMESTAMP)
    refresh_token = Column(String(512))
    refresh_expires_at = Column(TIMESTAMP)
    ip_address = Column(String(50))
    user_agent = Column(String(256))
    created_at = Column(TIMESTAMP, default=_bjt_now)
    updated_at = Column(TIMESTAMP, default=_bjt_now, onupdate=_bjt_now)

    user = relationship("User", back_populates="sessions")


class TravelPlan(Base):
    """行程记录表"""
    __tablename__ = 'travel_plans'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # 请求信息
    user_input = Column(Text, nullable=False)
    model_type = Column(String(50))
    provider = Column(String(20))
    
    # 行程摘要
    itinerary_summary = Column(Text)
    
    # 详细行程 (JSON格式)
    day_plan = Column(JSON)
    social_recommendations = Column(JSON)
    evidence = Column(JSON)
    
    # 其他信息
    warnings = Column(JSON)
    mcp_trace = Column(JSON)
    
    # 统计信息
    generation_time_ms = Column(Integer)
    tokens_used = Column(Integer)
    cost_estimate = Column(DECIMAL(10, 4))
    
    # 状态
    is_favorite = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

    # 广场/分类（v1.1+）
    category = Column(String(32), index=True, nullable=True)        # city/photo/food/couple/family/rusher/road
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    cover_url = Column(String(500), nullable=True)                  # 显式封面，优先于 day_plan[].image

    created_at = Column(TIMESTAMP, default=_bjt_now)
    updated_at = Column(TIMESTAMP, default=_bjt_now, onupdate=_bjt_now)

    user = relationship("User", back_populates="plans")
    feedbacks = relationship("UserFeedback", back_populates="plan")


class UserFeedback(Base):
    """用户反馈表"""
    __tablename__ = 'user_feedback'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    plan_id = Column(Integer, ForeignKey('travel_plans.id', ondelete='SET NULL'), index=True)
    rating = Column(SmallInteger)
    feedback_type = Column(String(20))
    content = Column(Text)
    contact = Column(String(100))
    status = Column(SmallInteger, default=0)  # 0待处理 1已处理 2忽略
    created_at = Column(TIMESTAMP, default=_bjt_now)

    plan = relationship("TravelPlan", back_populates="feedbacks")


class PlanLike(Base):
    """方案点赞表（公开社交信号）"""
    __tablename__ = 'plan_likes'

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey('travel_plans.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(TIMESTAMP, default=_bjt_now)

    plan = relationship("TravelPlan", backref="likes")
    user = relationship("User", backref="liked_plans")

    __table_args__ = (
        UniqueConstraint('plan_id', 'user_id', name='uq_plan_user_like'),
    )


class PlanFavorite(Base):
    """方案收藏表（每个用户对每条方案一份收藏，跨用户独立）"""
    __tablename__ = 'plan_favorites'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey('travel_plans.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(TIMESTAMP, default=_bjt_now)

    plan = relationship("TravelPlan", backref="favorited_by")
    user = relationship("User", backref="favorite_plans")

    __table_args__ = (
        UniqueConstraint('user_id', 'plan_id', name='uq_user_plan_fav'),
    )


class SystemConfig(Base):
    """系统配置表"""
    __tablename__ = 'system_configs'

    id = Column(Integer, primary_key=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(Text)
    description = Column(String(255))
    created_at = Column(TIMESTAMP, default=_bjt_now)
    updated_at = Column(TIMESTAMP, default=_bjt_now, onupdate=_bjt_now)


class UserDailyUsage(Base):
    """用户每日使用次数表"""
    __tablename__ = 'user_daily_usage'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    usage_date = Column(Date, nullable=False)
    plan_count = Column(Integer, default=0)
    bonus_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, default=_bjt_now)
    updated_at = Column(TIMESTAMP, default=_bjt_now, onupdate=_bjt_now)

    user = relationship("User", backref="daily_usage")


class Database:
    """数据库管理器"""
    
    _instance: Optional['Database'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # 从环境变量或配置获取数据库URL
        db_url = os.environ.get('DATABASE_URL') or getattr(settings.database, 'url', None)
        
        if not db_url:
            # 默认PostgreSQL配置
            db_config = settings.database
            db_url = f"postgresql://{db_config.username}:{db_config.password}@{db_config.host}:{db_config.port}/{db_config.name}"

        # 连接池配置
        pool_size = 5
        max_overflow = 10
        pool_timeout = 30

        self.engine = create_engine(
            db_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_timeout=pool_timeout,
            echo=False
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self._initialized = True
    
    def create_tables(self):
        """创建所有表"""
        Base.metadata.create_all(bind=self.engine)
    
    @contextmanager
    def get_session(self) -> Generator:
        """获取数据库会话"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    def get_user_by_openid(self, openid: str) -> Optional[User]:
        """通过openid获取用户"""
        with self.get_session() as session:
            return session.query(User).filter(User.openid == openid).first()
    
    def create_user(self, openid: str, **kwargs) -> User:
        """创建新用户"""
        with self.get_session() as session:
            user = User(openid=openid, **kwargs)
            session.add(user)
            session.flush()
            session.refresh(user)
            return user
    
    def get_user_plan_history(self, user_id: int, limit: int = 20, offset: int = 0) -> list:
        """获取用户行程历史"""
        with self.get_session() as session:
            return session.query(TravelPlan).filter(
                TravelPlan.user_id == user_id,
                TravelPlan.is_deleted == False
            ).order_by(TravelPlan.created_at.desc()).limit(limit).offset(offset).all()
    
    def save_travel_plan(self, user_id: int, plan_data: dict) -> TravelPlan:
        """保存行程记录"""
        with self.get_session() as session:
            # 更新用户生成计数
            session.query(User).filter(User.id == user_id).update(
                {User.total_plans: User.total_plans + 1}
            )
            
            plan = TravelPlan(
                user_id=user_id,
                user_input=plan_data.get('user_input'),
                model_type=plan_data.get('model_type'),
                provider=plan_data.get('provider'),
                itinerary_summary=plan_data.get('itinerary_summary'),
                day_plan=plan_data.get('day_plan'),
                social_recommendations=plan_data.get('social_recommendations'),
                evidence=plan_data.get('evidence'),
                warnings=plan_data.get('warnings'),
                mcp_trace=plan_data.get('mcp_trace'),
                generation_time_ms=plan_data.get('generation_time_ms'),
                tokens_used=plan_data.get('tokens_used'),
                cost_estimate=plan_data.get('cost_estimate')
            )
            session.add(plan)
            session.flush()
            session.refresh(plan)
            return plan
    
    def toggle_favorite(self, plan_id: int, user_id: int) -> bool:
        """切换收藏状态"""
        with self.get_session() as session:
            plan = session.query(TravelPlan).filter(
                TravelPlan.id == plan_id,
                TravelPlan.user_id == user_id
            ).first()
            if plan:
                plan.is_favorite = not plan.is_favorite
                return plan.is_favorite
            return False
    
    def delete_plan(self, plan_id: int, user_id: int) -> bool:
        """删除行程记录"""
        with self.get_session() as session:
            plan = session.query(TravelPlan).filter(
                TravelPlan.id == plan_id,
                TravelPlan.user_id == user_id
            ).first()
            if plan:
                plan.is_deleted = True
                return True
            return False
    
    def check_user_quota(self, user_id: int) -> dict:
        """检查用户今日配额"""
        from datetime import date
        
        today = date.today()
        
        with self.get_session() as session:
            config = session.query(SystemConfig).filter(
                SystemConfig.config_key == 'max_free_plans_per_day'
            ).first()
            max_free = int(config.config_value) if config and config.config_value else 1
            
            usage = session.query(UserDailyUsage).filter(
                UserDailyUsage.user_id == user_id,
                UserDailyUsage.usage_date == today
            ).first()
            
            if not usage:
                return {
                    "can_use": True,
                    "used": 0,
                    "bonus": 0,
                    "max": max_free,
                    "remaining": max_free
                }
            
            remaining = max(0, max_free - usage.plan_count)
            
            return {
                "can_use": usage.plan_count < max_free or usage.bonus_count > 0,
                "used": usage.plan_count,
                "bonus": usage.bonus_count,
                "max": max_free,
                "remaining": remaining + usage.bonus_count
            }
    
    def increment_usage(self, user_id: int) -> dict:
        """增加用户今日使用次数，优先扣减 bonus，再扣减免费额度"""
        from datetime import date
        
        today = date.today()
        
        with self.get_session() as session:
            usage = session.query(UserDailyUsage).filter(
                UserDailyUsage.user_id == user_id,
                UserDailyUsage.usage_date == today
            ).with_for_update().first()
            
            # 优先扣减 bonus，bonus 用完后再扣减免费额度
            if usage and usage.bonus_count > 0:
                usage.bonus_count -= 1
            else:
                # 没有 bonus 或 bonus 已用完，增加 plan_count
                if usage:
                    usage.plan_count += 1
                else:
                    usage = UserDailyUsage(
                        user_id=user_id,
                        usage_date=today,
                        plan_count=1,
                        bonus_count=0
                    )
                    session.add(usage)
            
            session.flush()
            session.refresh(usage)
            
            config = session.query(SystemConfig).filter(
                SystemConfig.config_key == 'max_free_plans_per_day'
            ).first()
            max_free = int(config.config_value) if config and config.config_value else 1
            
            # 计算 remaining：免费剩余 + bonus
            free_remaining = max_free - usage.plan_count
            remaining = max(0, free_remaining) + usage.bonus_count
            
            return {
                "used": usage.plan_count,
                "bonus": usage.bonus_count,
                "max": max_free,
                "remaining": remaining
            }
    
    def add_bonus(self, user_id: int, bonus_type: str = "share") -> bool:
        """增加用户奖励次数"""
        from datetime import date
        
        today = date.today()
        
        with self.get_session() as session:
            usage = session.query(UserDailyUsage).filter(
                UserDailyUsage.user_id == user_id,
                UserDailyUsage.usage_date == today
            ).with_for_update().first()
            
            bonus_amount = 3 if bonus_type == "share" else 1
            
            if usage:
                usage.bonus_count += bonus_amount
            else:
                usage = UserDailyUsage(
                    user_id=user_id,
                    usage_date=today,
                    plan_count=0,
                    bonus_count=bonus_amount
                )
                session.add(usage)
            
            return True

    def get_or_create_invite_code(self, user_id: int) -> str:
        """获取或生成用户邀请码"""
        import uuid
        with self.get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                return ""
            if user.invite_code:
                return user.invite_code
            code = uuid.uuid4().hex[:8].upper()
            user.invite_code = code
            return code

    def process_invite(self, user_id: int, invite_code: str, _session=None) -> dict:
        """处理邀请：被邀请人使用邀请码，双方各+3次配额

        Args:
            user_id: 被邀请人 user_id
            invite_code: 邀请码
            _session: (内部用) 传入已有 session 以避免事务隔离问题
        """
        from datetime import date

        today = date.today()
        INVITE_BONUS = 3

        if _session is not None:
            return self._process_invite_in_session(_session, user_id, invite_code, today, INVITE_BONUS)

        with self.get_session() as session:
            return self._process_invite_in_session(session, user_id, invite_code, today, INVITE_BONUS)

    def _process_invite_in_session(self, session, user_id: int, invite_code: str, today, INVITE_BONUS: int) -> dict:
        """在指定 session 中处理邀请（保证与外层事务一致）"""
        # 找到邀请人
        inviter = session.query(User).filter(User.invite_code == invite_code).first()
        if not inviter:
            return {"code": 404, "msg": "邀请码无效"}

        if inviter.id == user_id:
            return {"code": 400, "msg": "不能使用自己的邀请码"}

        # 检查是否已经使用过邀请码
        invitee = session.query(User).filter(User.id == user_id).first()
        if not invitee:
            return {"code": 404, "msg": "用户不存在"}
        if invitee.invited_by:
            return {"code": 400, "msg": "您已使用过邀请码"}

        # 记录邀请关系
        invitee.invited_by = inviter.id

        # 邀请人 +3 bonus
        inviter_usage = session.query(UserDailyUsage).filter(
            UserDailyUsage.user_id == inviter.id,
            UserDailyUsage.usage_date == today
        ).first()
        inviter_before_bonus = inviter_usage.bonus_count if inviter_usage else 0
        if inviter_usage:
            inviter_usage.bonus_count += INVITE_BONUS
        else:
            session.add(UserDailyUsage(
                user_id=inviter.id, usage_date=today,
                plan_count=0, bonus_count=INVITE_BONUS
            ))
        session.flush()
        inviter_after_bonus = session.query(UserDailyUsage.bonus_count).filter(
            UserDailyUsage.user_id == inviter.id,
            UserDailyUsage.usage_date == today
        ).scalar() or 0
        print(f"[Invite] 邀请人 user_id={inviter.id} (invite_code={invite_code}) bonus: {inviter_before_bonus} → {inviter_after_bonus} (+{INVITE_BONUS})")

        # 被邀请人 +3 bonus
        invitee_usage = session.query(UserDailyUsage).filter(
            UserDailyUsage.user_id == user_id,
            UserDailyUsage.usage_date == today
        ).first()
        invitee_before_bonus = invitee_usage.bonus_count if invitee_usage else 0
        if invitee_usage:
            invitee_usage.bonus_count += INVITE_BONUS
        else:
            session.add(UserDailyUsage(
                user_id=user_id, usage_date=today,
                plan_count=0, bonus_count=INVITE_BONUS
            ))
        session.flush()
        invitee_after_bonus = session.query(UserDailyUsage.bonus_count).filter(
            UserDailyUsage.user_id == user_id,
            UserDailyUsage.usage_date == today
        ).scalar() or 0
        print(f"[Invite] 被邀请人 user_id={user_id} bonus: {invitee_before_bonus} → {invitee_after_bonus} (+{INVITE_BONUS})")

        return {
            "code": 0,
            "msg": "邀请成功，获得3次额外配额",
            "inviter_id": inviter.id,
            "invitee_id": user_id,
            "inviter_bonus_added": INVITE_BONUS,
            "invitee_bonus_added": INVITE_BONUS
        }

    # ========== 点赞 ==========

    def toggle_plan_like(self, user_id: int, plan_id: int) -> dict:
        """Toggle 点赞：写过删行返回 is_liked=False，没写过插行返回 is_liked=True

        同时校验 plan 存在且未删除。
        """
        with self.get_session() as session:
            plan = session.query(TravelPlan).filter(
                TravelPlan.id == plan_id,
                TravelPlan.is_deleted == False
            ).first()
            if not plan:
                return {"code": 404, "msg": "方案不存在", "is_liked": False, "likes": 0}

            existing = session.query(PlanLike).filter(
                PlanLike.user_id == user_id,
                PlanLike.plan_id == plan_id
            ).first()
            if existing:
                session.delete(existing)
                is_liked = False
            else:
                session.add(PlanLike(user_id=user_id, plan_id=plan_id))
                is_liked = True
            session.flush()
            count = session.query(PlanLike).filter(PlanLike.plan_id == plan_id).count()
            print(f"[Like] user_id={user_id} plan_id={plan_id} is_liked={is_liked} total_likes={count}")
            return {"code": 0, "is_liked": is_liked, "likes": count}

    def get_likes_for_plans(self, user_id: int, plan_ids: list) -> dict:
        """批量查询 user 对这些 plan 的点赞状态 {plan_id: True}（未点的不在 dict 里）"""
        if not plan_ids:
            return {}
        with self.get_session() as session:
            rows = session.query(PlanLike.plan_id).filter(
                PlanLike.user_id == user_id,
                PlanLike.plan_id.in_(plan_ids)
            ).all()
            return {row[0]: True for row in rows}

    def get_plans_like_counts(self, plan_ids: list) -> dict:
        """批量查询多个 plan 的点赞数 {plan_id: count}"""
        if not plan_ids:
            return {}
        with self.get_session() as session:
            rows = session.query(PlanLike.plan_id, func.count(PlanLike.id)).filter(
                PlanLike.plan_id.in_(plan_ids)
            ).group_by(PlanLike.plan_id).all()
            return {pid: cnt for pid, cnt in rows}

    # ========== 收藏（每用户独立） ==========

    def toggle_plan_favorite(self, user_id: int, plan_id: int) -> dict:
        """Toggle 收藏：写过删行返回 is_favorited=False，没写过插行返回 is_favorited=True

        跨用户独立：用户 A 的收藏不影响用户 B。
        """
        with self.get_session() as session:
            plan = session.query(TravelPlan).filter(
                TravelPlan.id == plan_id,
                TravelPlan.is_deleted == False
            ).first()
            if not plan:
                return {"code": 404, "msg": "方案不存在", "is_favorited": False}

            existing = session.query(PlanFavorite).filter(
                PlanFavorite.user_id == user_id,
                PlanFavorite.plan_id == plan_id
            ).first()
            if existing:
                session.delete(existing)
                is_favorited = False
            else:
                session.add(PlanFavorite(user_id=user_id, plan_id=plan_id))
                is_favorited = True
            session.flush()
            print(f"[Favorite] user_id={user_id} plan_id={plan_id} is_favorited={is_favorited}")
            return {"code": 0, "is_favorited": is_favorited}

    def get_favorites_for_user(self, user_id: int, plan_ids: list) -> dict:
        """批量查询 user 对这些 plan 的收藏状态 {plan_id: True}（未收藏的不在 dict 里）"""
        if not plan_ids:
            return {}
        with self.get_session() as session:
            rows = session.query(PlanFavorite.plan_id).filter(
                PlanFavorite.user_id == user_id,
                PlanFavorite.plan_id.in_(plan_ids)
            ).all()
            return {row[0]: True for row in rows}


# 全局数据库实例
db = Database()


def get_db() -> Database:
    """获取数据库实例"""
    return db
