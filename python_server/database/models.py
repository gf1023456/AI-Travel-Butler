"""
AI Travel Butler - Database Module
PostgreSQL + SQLAlchemy
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, SmallInteger, DECIMAL, JSON, TIMESTAMP, ForeignKey, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
from contextlib import contextmanager
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
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

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
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

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
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

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
    created_at = Column(TIMESTAMP, server_default=func.now())

    plan = relationship("TravelPlan", back_populates="feedbacks")


class SystemConfig(Base):
    """系统配置表"""
    __tablename__ = 'system_configs'

    id = Column(Integer, primary_key=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(Text)
    description = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class UserDailyUsage(Base):
    """用户每日使用次数表"""
    __tablename__ = 'user_daily_usage'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    usage_date = Column(Date, nullable=False)
    plan_count = Column(Integer, default=0)
    bonus_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

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
        
        self.engine = create_engine(
            db_url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
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
            max_free = int(config.config_value) if config and config.config_value else 10
            
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
        """增加用户今日使用次数"""
        from datetime import date
        
        today = date.today()
        
        with self.get_session() as session:
            usage = session.query(UserDailyUsage).filter(
                UserDailyUsage.user_id == user_id,
                UserDailyUsage.usage_date == today
            ).with_for_update().first()
            
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
            max_free = int(config.config_value) if config and config.config_value else 10
            
            return {
                "used": usage.plan_count,
                "bonus": usage.bonus_count,
                "max": max_free
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


# 全局数据库实例
db = Database()


def get_db() -> Database:
    """获取数据库实例"""
    return db
