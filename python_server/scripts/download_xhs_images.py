"""
Step 1: 在本地电脑运行，从数据库读取所有 XHS 图片 URL 并下载
用法：python scripts/download_xhs_images.py
结果：图片保存到 static/img/ 目录
"""
import os
import sys
import hashlib
import asyncio
import httpx
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.models import db, TravelPlan

IMG_DIR = Path(__file__).resolve().parent.parent / "static" / "img"
IMG_DIR.mkdir(parents=True, exist_ok=True)

XHS_DOMAINS = ("xhscdn.com", "xiaohongshu.com/sns-webpic")


def is_xhs_url(url: str) -> bool:
    return url and any(d in url for d in XHS_DOMAINS)


async def download_one(client: httpx.AsyncClient, url: str, sem: asyncio.Semaphore) -> bool:
    async with sem:
        h = hashlib.md5(url.encode()).hexdigest()
        dest = IMG_DIR / f"{h}.webp"
        if dest.exists():
            return True
        try:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.xiaohongshu.com/",
            }, follow_redirects=True)
            if resp.status_code == 200 and len(resp.content) > 100:
                dest.write_bytes(resp.content)
                print(f"  ✓ {h}.webp ({len(resp.content)} bytes)")
                return True
            else:
                print(f"  ✗ HTTP {resp.status_code}: {url[:60]}...")
        except Exception as e:
            print(f"  ✗ 失败: {url[:60]}... -> {e}")
    return False


async def main():
    with db.get_session() as session:
        plans = session.query(TravelPlan).filter(TravelPlan.is_deleted == False).all()
        print(f"共 {len(plans)} 条方案")

        urls = set()
        for plan in plans:
            if plan.cover_url and is_xhs_url(plan.cover_url):
                urls.add(plan.cover_url)
            if plan.day_plan and isinstance(plan.day_plan, list):
                for day in plan.day_plan:
                    for item in (day.get("items") or []):
                        img = item.get("image", "")
                        if img and is_xhs_url(img):
                            urls.add(img)

        urls = list(urls)
        print(f"共 {len(urls)} 个 XHS 图片 URL")
        if not urls:
            print("无需下载")
            return

        sem = asyncio.Semaphore(5)
        success = 0
        fail = 0
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        print(f"代理: {proxy or '无（直连）'}")
        async with httpx.AsyncClient(timeout=20.0, proxy=proxy) as client:
            results = await asyncio.gather(*[download_one(client, u, sem) for u in urls])
            success = sum(1 for r in results if r)
            fail = len(results) - success

        print(f"\n下载完成: 成功={success}, 失败={fail}")
        print(f"图片目录: {IMG_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
