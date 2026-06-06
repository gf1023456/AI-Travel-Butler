"""
数据库迁移：为 users 表添加 invite_code 和 invited_by 字段
独立运行，不依赖项目模块。
"""

import os
from sqlalchemy import create_engine, text, inspect

# 数据库连接参数（从项目 config/settings.py 读取）
DB_CONFIG = {
    "host": "47.108.24.14",
    "port": 15477,
    "user": "postgres",
    "password": "postgres123",
    "database": "ai_travel_butler",
}

# 也支持环境变量覆盖
DB_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
)


def migrate():
    engine = create_engine(DB_URL)
    inspector = inspect(engine)
    existing = [col["name"] for col in inspector.get_columns("users")]
    print(f"[迁移] users 表现有列: {existing}")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            if "invite_code" not in existing:
                conn.execute(text(
                    """ALTER TABLE users ADD COLUMN invite_code VARCHAR(32)"""
                ))
                conn.execute(text(
                    """CREATE UNIQUE INDEX IF NOT EXISTS ix_users_invite_code ON users (invite_code)"""
                ))
                print("[迁移] ✅ 已添加 invite_code 列 + 唯一索引")
            else:
                print("[迁移] ⏭ invite_code 列已存在")

            if "invited_by" not in existing:
                conn.execute(text(
                    """ALTER TABLE users ADD COLUMN invited_by INTEGER REFERENCES users(id)"""
                ))
                print("[迁移] ✅ 已添加 invited_by 列 (外键 -> users.id)")
            else:
                print("[迁移] ⏭ invited_by 列已存在")

            trans.commit()
            print("[迁移] ✅ 完成")
        except Exception as e:
            trans.rollback()
            print(f"[迁移] ❌ 失败: {e}")
            raise


if __name__ == "__main__":
    migrate()
