-- ============================================================
-- AI-Travel-Butler  数据库迁移脚本（v1.1 邀请修复 + 广场点赞/收藏）
-- 用法：psql -h 47.108.24.14 -p 15477 -U postgres -d ai_travel_butler -f migrate_invite.sql
-- 可重复执行（所有语句都用了 IF NOT EXISTS / DO 块）
-- ============================================================

-- ===== 1. 邀请字段（兼容旧库） =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_invite_code ON users (invite_code);

ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES users(id);

-- ===== 2. travel_plans 新增字段（v1.1 广场 / 分类） =====

-- 旅行风格 slug：light / deep / food / outdoor
ALTER TABLE travel_plans ADD COLUMN IF NOT EXISTS category VARCHAR(32);
CREATE INDEX IF NOT EXISTS ix_travel_plans_category ON travel_plans (category);

-- 是否公开到广场（默认私有）
ALTER TABLE travel_plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS ix_travel_plans_is_public ON travel_plans (is_public);

-- 广场卡片封面图（兜底取 day_plan[0].items[0].image）
ALTER TABLE travel_plans ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500);

-- ===== 3. 点赞表 plan_likes（公开社交信号） =====

CREATE TABLE IF NOT EXISTS plan_likes (
    id          SERIAL PRIMARY KEY,
    plan_id     INTEGER NOT NULL REFERENCES travel_plans(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plan_likes_plan_id ON plan_likes (plan_id);
CREATE INDEX IF NOT EXISTS ix_plan_likes_user_id ON plan_likes (user_id);

-- 同一用户对同一方案只能点赞一次
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_plan_user_like'
    ) THEN
        ALTER TABLE plan_likes
            ADD CONSTRAINT uq_plan_user_like UNIQUE (plan_id, user_id);
    END IF;
END$$;

-- ===== 5. 收藏表 plan_favorites（每用户每方案一份，跨用户独立） =====

CREATE TABLE IF NOT EXISTS plan_favorites (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id     INTEGER NOT NULL REFERENCES travel_plans(id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plan_favorites_user_id ON plan_favorites (user_id);
CREATE INDEX IF NOT EXISTS ix_plan_favorites_plan_id ON plan_favorites (plan_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_plan_fav'
    ) THEN
        ALTER TABLE plan_favorites
            ADD CONSTRAINT uq_user_plan_fav UNIQUE (user_id, plan_id);
    END IF;
END$$;

-- ===== 4. 校验：确认所有变更生效 =====
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'travel_plans'
  AND column_name IN ('category', 'is_public', 'cover_url');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('invite_code', 'invited_by');

SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('plan_likes', 'plan_favorites');
