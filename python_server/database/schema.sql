-- ===========================================
-- AI Travel Butler - Database Schema
-- PostgreSQL
-- ===========================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    openid VARCHAR(128) UNIQUE NOT NULL,          -- 微信 openid
    unionid VARCHAR(128),                          -- 微信 unionid
    nickname VARCHAR(100),                          -- 昵称
    avatar_url VARCHAR(500),                       -- 头像URL
    phone VARCHAR(20),                             -- 手机号
    gender SMALLINT DEFAULT 0,                     -- 性别 0未知 1男 2女
    country VARCHAR(50),                           -- 国家
    province VARCHAR(50),                          -- 省份
    city VARCHAR(50),                              -- 城市
    language VARCHAR(20),                          -- 语言
    status SMALLINT DEFAULT 1,                     -- 状态 0禁用 1正常
    total_plans INTEGER DEFAULT 0,                 -- 总生成方案数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- 用户会话表 (用于微信登录维护会话)
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_key VARCHAR(256),                      -- 微信 session_key
    access_token VARCHAR(512),                      -- 自定义访问令牌
    token_expires_at TIMESTAMP,                    -- 令牌过期时间
    refresh_token VARCHAR(512),                    -- 刷新令牌
    refresh_expires_at TIMESTAMP,                  -- 刷新令牌过期时间
    ip_address VARCHAR(50),                        -- IP地址
    user_agent VARCHAR(256),                        -- 用户代理
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_access_token ON user_sessions(access_token);

-- 行程记录表
CREATE TABLE IF NOT EXISTS travel_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 请求信息
    user_input TEXT NOT NULL,                      -- 用户输入
    model_type VARCHAR(50),                         -- 使用的模型
    provider VARCHAR(20),                          -- 使用的AI提供商
    
    -- 行程摘要
    itinerary_summary TEXT,                         -- 文字摘要
    
    -- 详细行程 (JSONB格式存储)
    day_plan JSONB,                                -- 每日行程
    social_recommendations JSONB,                 -- 社交推荐
    evidence JSONB,                                 -- 证据/知识库引用
    
    -- 其他信息
    warnings JSONB,                                -- 验证警告
    mcp_trace JSONB,                               -- 执行追踪
    
    -- 统计信息
    generation_time_ms INTEGER,                    -- 生成耗时(毫秒)
    tokens_used INTEGER,                           -- 消耗token数
    cost_estimate DECIMAL(10, 4),                 -- 预估费用(美元)
    
    -- 状态
    is_favorite BOOLEAN DEFAULT FALSE,             -- 是否收藏
    is_deleted BOOLEAN DEFAULT FALSE,              -- 是否删除
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plans_user_id ON travel_plans(user_id);
CREATE INDEX idx_plans_created_at ON travel_plans(created_at DESC);
CREATE INDEX idx_plans_user_created ON travel_plans(user_id, created_at DESC);
CREATE INDEX idx_plans_user_favorite ON travel_plans(user_id, is_favorite) WHERE is_favorite = TRUE;

-- 用户反馈表
CREATE TABLE IF NOT EXISTS user_feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES travel_plans(id) ON DELETE SET NULL,
    rating SMALLINT,                              -- 评分 1-5
    feedback_type VARCHAR(20),                    -- feedback类型: like, dislike, bug, suggestion
    content TEXT,                                 -- 反馈内容
    contact VARCHAR(100),                         -- 联系方式
    status SMALLINT DEFAULT 0,                    -- 状态 0待处理 1已处理 2忽略
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_plan_id ON user_feedback(plan_id);
CREATE INDEX idx_feedback_status ON user_feedback(status);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化默认配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
    ('primary_provider', 'dashscope', '默认AI提供商'),
    ('enable_canary', 'false', '是否启用灰度发布'),
    ('max_free_plans_per_day', '10', '免费用户每日最大生成次数'),
    ('max_history_days', '90', '历史记录保留天数')
ON CONFLICT (config_key) DO NOTHING;

-- 用户每日次数表
CREATE TABLE IF NOT EXISTS user_daily_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,                          -- 日期
    plan_count INTEGER DEFAULT 0,                      -- 今日已使用次数
    bonus_count INTEGER DEFAULT 0,                     -- 今日奖励次数(分享/广告)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, usage_date)
);

CREATE INDEX idx_daily_usage_user_date ON user_daily_usage(user_id, usage_date);

-- 初始化管理员用户 (可选)
-- INSERT INTO users (openid, nickname, status) VALUES ('admin', '管理员', 1);
