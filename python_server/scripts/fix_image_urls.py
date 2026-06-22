"""
修复数据库中相对路径图片 URL → 完整 URL
用法：cd python_server && python scripts/fix_image_urls.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.models import db, TravelPlan
from config import settings

BASE = settings.server.public_base_url


def fix_day_plan(day_plan: list) -> list:
    """修复 day_plan 中所有图片 URL，返回新列表"""
    result = []
    for entry in day_plan:
        if not isinstance(entry, dict):
            result.append(entry)
            continue
        entry = dict(entry)
        items = entry.get("items")
        if items and isinstance(items, list):
            entry["items"] = [
                {**item, "image": BASE + item["image"]}
                if isinstance(item, dict) and item.get("image", "").startswith("/static/")
                else item
                for item in items
            ]
        else:
            if entry.get("image", "").startswith("/static/"):
                entry["image"] = BASE + entry["image"]
        result.append(entry)
    return result


def main():
    with db.get_session() as session:
        plans = session.query(TravelPlan).filter(TravelPlan.is_deleted == False).all()
        print(f"共 {len(plans)} 条方案")
        fixed = 0
        for p in plans:
            changed = False
            # cover_url
            if p.cover_url and p.cover_url.startswith("/static/"):
                p.cover_url = BASE + p.cover_url
                changed = True
            # day_plan
            if p.day_plan and isinstance(p.day_plan, list):
                new_day_plan = fix_day_plan(p.day_plan)
                # 检查是否有变化
                if json.dumps(new_day_plan, ensure_ascii=False) != json.dumps(p.day_plan, ensure_ascii=False):
                    p.day_plan = new_day_plan
                    changed = True
            if changed:
                fixed += 1
                print(f"  ✓ 修复 plan_id={p.id}")
        session.commit()
        print(f"共修复 {fixed} 条方案")


if __name__ == "__main__":
    main()
