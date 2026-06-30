"""
数据库迁移：为 travel_plans 表添加 note_meta 列（小红书笔记元信息）
独立运行，不依赖项目模块。
用法：python migrate_note_meta.py
"""

import os
from sqlalchemy import create_engine, text, inspect

DB_CONFIG = {
    "host": "47.108.24.14",
    "port": 15477,
    "user": "postgres",
    "password": "postgres123",
    "database": "ai_travel_butler",
}

DB_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
)


def migrate():
    engine = create_engine(DB_URL)
    inspector = inspect(engine)
    existing = [col["name"] for col in inspector.get_columns("travel_plans")]
    print(f"[迁移] travel_plans 表现有列: {existing}")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            if "note_meta" not in existing:
                conn.execute(text(
                    """ALTER TABLE travel_plans ADD COLUMN note_meta JSON"""
                ))
                print("[迁移] ✅ 已添加 note_meta 列")
            else:
                print("[迁移] ⏭ note_meta 列已存在")

            trans.commit()
            print("[迁移] ✅ 完成")
        except Exception as e:
            trans.rollback()
            print(f"[迁移] ❌ 失败: {e}")
            raise


if __name__ == "__main__":
    migrate()
