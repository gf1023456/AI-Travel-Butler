"""
迁移脚本：把数据库里所有 XHS CDN 图片下载到本地，更新数据库 URL
用法：
  1. 在本地电脑跑（服务器 IP 被封了）：python scripts/migrate_xhs_images.py
  2. 会下载图片到 static/img/ 并更新数据库
  3. 把 static/img/ 目录上传到服务器
"""
import os
import sys
import hashlib
import asyncio
import httpx
from pathlib import Path

# 确保能 import 项目模块
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.models import db, TravelPlan

# 本地保存图片的目录
IMG_DIR = Path(__file__).resolve().parent.parent / "static" / "img"
IMG_DIR.mkdir(parents=True, exist_ok=True)

# 匹配 XHS CDN 域名
XHS_DOMAINS = ("xhscdn.com", "xiaohongshu.com/sns-webpic")


def is_xhs_url(url: str) -> bool:
    return url and any(d in url for d in XHS_DOMAINS)


def url_to_local(url: str) -> str:
    """URL → 完整本地 URL"""
    from config import settings
    ext = ".webp"
    h = hashlib.md5(url.encode()).hexdigest()
    return f"{settings.server.public_base_url}/static/img/{h}{ext}"


def local_path(url: str) -> Path:
    h = hashlib.md5(url.encode()).hexdigest()
    return IMG_DIR / f"{h}.webp"


async def download_one(client: httpx.AsyncClient, url: str) -> bool:
    """下载单张图片，成功返回 True"""
    dest = local_path(url)
    if dest.exists():
        return True
    try:
        resp = await client.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.xiaohongshu.com/",
        }, follow_redirects=True)
        if resp.status_code == 200 and len(resp.content) > 100:
            dest.write_bytes(resp.content)
            return True
    except Exception as e:
        print(f"  ✗ 下载失败: {url[:60]}... -> {e}")
    return False


def collect_urls(plan: TravelPlan) -> set:
    """从一条 plan 中提取所有 XHS 图片 URL"""
    urls = set()

    # cover_url
    if plan.cover_url and is_xhs_url(plan.cover_url):
        urls.add(plan.cover_url)

    # day_plan JSON
    if plan.day_plan and isinstance(plan.day_plan, list):
        for day in plan.day_plan:
            for item in (day.get("items") or []):
                img = item.get("image", "")
                if img and is_xhs_url(img):
                    urls.add(img)

    return urls


def replace_urls_in_plan(plan: TravelPlan, url_map: dict):
    """替换 plan 中所有 XHS URL 为本地路径"""
    # cover_url
    if plan.cover_url and plan.cover_url in url_map:
        plan.cover_url = url_map[plan.cover_url]

    # day_plan
    if plan.day_plan and isinstance(plan.day_plan, list):
        for day in plan.day_plan:
            for item in (day.get("items") or []):
                img = item.get("image", "")
                if img and img in url_map:
                    item["image"] = url_map[img]


async def main():
    with db.get_session() as session:
        plans = session.query(TravelPlan).filter(TravelPlan.is_deleted == False).all()
        print(f"共 {len(plans)} 条方案")

        # 1. 收集所有 XHS URL
        all_urls = set()
        for plan in plans:
            all_urls.update(collect_urls(plan))

        xhs_urls = [u for u in all_urls if is_xhs_url(u)]
        print(f"共 {len(xhs_urls)} 个 XHS 图片 URL")

        if not xhs_urls:
            print("无需迁移")
            return

        # 2. 并发下载
        success = 0
        fail = 0
        async with httpx.AsyncClient(timeout=20.0) as client:
            sem = asyncio.Semaphore(5)

            async def _dl(url):
                nonlocal success, fail
                async with sem:
                    ok = await download_one(client, url)
                    if ok:
                        success += 1
                    else:
                        fail += 1

            await asyncio.gather(*[_dl(u) for u in xhs_urls])

        print(f"下载完成: 成功={success}, 失败={fail}")

        # 3. 更新数据库
        url_map = {u: url_to_local(u) for u in xhs_urls if local_path(u).exists()}
        updated = 0
        for plan in plans:
            old_cover = plan.cover_url
            replace_urls_in_plan(plan, url_map)
            if plan.cover_url != old_cover or _day_plan_changed(plan, url_map):
                updated += 1

        session.commit()
        print(f"数据库更新: {updated} 条方案")
        print("完成!")


def _day_plan_changed(plan: TravelPlan, url_map: dict) -> bool:
    if not plan.day_plan or not isinstance(plan.day_plan, list):
        return False
    for day in plan.day_plan:
        for item in (day.get("items") or []):
            if item.get("image", "") in url_map:
                return True
    return False


if __name__ == "__main__":
    asyncio.run(main())
