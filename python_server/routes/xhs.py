"""
小红书笔记导入路由
POST /api/xhs/import  — 粘贴小红书链接，抓取+解析（不存库）
POST /api/xhs/parse   — 直接粘贴文本，解析为行程（不存库）
POST /api/xhs/cookie  — 更新 XHS Cookie（管理接口）
"""
import os
import asyncio
import hashlib
from pathlib import Path
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import httpx

from modules.xhs_fetcher import fetch_note_by_url, set_cookie, CookieExpiredError
from modules.xhs_parser import parse_note
from modules.xhs_llm_parser import llm_parse_note
from modules.utils import geocode_location, get_city_center
from config import settings

router = APIRouter(prefix="/api/xhs", tags=["小红书导入"])

# 图片本地缓存目录
_IMG_DIR = Path(__file__).resolve().parent.parent / "static" / "img"
_IMG_DIR.mkdir(parents=True, exist_ok=True)


async def _download_image(url: str) -> str:
    """下载单张图片到本地，返回完整 URL；失败返回原 URL"""
    if not url or not url.startswith("http"):
        return url
    try:
        url_hash = hashlib.md5(url.encode()).hexdigest()
        ext = ".webp"
        local_path = _IMG_DIR / f"{url_hash}{ext}"
        if local_path.exists():
            return f"{settings.server.public_base_url}/static/img/{url_hash}{ext}"

        # 从环境变量读代理（服务器被封时需要）
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, proxy=proxy) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.xiaohongshu.com/",
            })
            if resp.status_code == 200:
                local_path.write_bytes(resp.content)
                print(f"[XHS] 图片下载成功: {url_hash}.webp ({len(resp.content)} bytes)")
                return f"{settings.server.public_base_url}/static/img/{url_hash}{ext}"
            else:
                print(f"[XHS] 图片下载失败: HTTP {resp.status_code} -> {url[:80]}...")
    except Exception as e:
        print(f"[XHS] 图片下载异常: {url[:60]}... -> {e}")
    return url


async def _download_images(urls: list) -> list:
    """并发下载多张图片"""
    if not urls:
        return urls
    tasks = [_download_image(u) for u in urls]
    return await asyncio.gather(*tasks)


def _flat_day_plan(day_plan: list) -> list:
    """将嵌套/扁平 day_plan 统一展开为景点列表（扁平格式直接返回）"""
    spots = []
    for entry in day_plan:
        if "items" in entry and isinstance(entry["items"], list):
            spots.extend(entry["items"])
        else:
            spots.append(entry)
    return spots


async def _fillCoordinates(day_plan: list, city: str = "") -> list:
    """并发调用高德 geocoding，给每个景点补全 lat/lng（兼容扁平+嵌套格式）"""
    if not day_plan:
        return day_plan

    # 展开所有景点（扁平直接返回，嵌套提取 items）
    spots = _flat_day_plan(day_plan)

    async def _geocode_one(spot):
        name = spot.get("name", "")
        if not name:
            return spot
        result = await geocode_location(name, city or spot.get("city", ""))
        if result:
            spot["lat"] = result["lat"]
            spot["lng"] = result["lng"]
        else:
            center = get_city_center(city or spot.get("city", ""))
            idx = spots.index(spot)
            spot["lat"] = round(center["lat"] + idx * 0.01, 4)
            spot["lng"] = round(center["lng"] + idx * 0.01, 4)
        return spot

    await asyncio.gather(*[_geocode_one(s) for s in spots])
    return day_plan


class ImportRequest(BaseModel):
    url: str


class ParseRequest(BaseModel):
    text: str
    city: Optional[str] = None


@router.post("/import")
async def import_xhs_note(req: ImportRequest):
    """
    导入小红书笔记：抓取 → 解析 → 返回结构化行程（不存库）
    """
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="请输入小红书链接")

    # 1. 从 URL 抓取笔记详情
    try:
        note = await fetch_note_by_url(req.url)
    except Exception as e:
        from modules.xhs_fetcher import CookieExpiredError
        if isinstance(e, CookieExpiredError):
            raise HTTPException(status_code=401, detail="小红书 Cookie 已过期，请联系管理员更新")
        raise HTTPException(status_code=500, detail=f"抓取笔记失败: {e}")

    if not note:
        raise HTTPException(status_code=422, detail="无法抓取笔记内容，请检查链接是否有效或 Cookie 是否过期")

    title = note.get("title", "")
    content = note.get("content", "")
    city = note.get("city", "")

    # 2. 解析笔记内容（LLM 优先，正则兜底）
    parsed = None
    try:
        llm_result = await llm_parse_note(
            title=title,
            content=content,
            images=note.get("images", []),
            city=city,
        )
        if llm_result and llm_result.get("day_plan"):
            parsed = llm_result
    except Exception as e:
        print(f"[XHS] LLM parse failed, fallback to regex: {e}")

    if not parsed or parsed.get("spot_count", 0) < 2:
        parsed = parse_note(title, content, city, note.get("images", []))

    # 3. 并发补充经纬度
    day_plan = parsed.get("day_plan", [])
    if day_plan:
        await _fillCoordinates(day_plan, city)

    # 4. 下载所有 XHS 图片到本地（绕过 CDN 封锁），并替换 URL
    cover_url = note.get("cover_url", "")
    note_images = note.get("images", [])

    # 收集所有需要下载的 URL
    all_urls = []
    if cover_url:
        all_urls.append(cover_url)
    all_urls.extend([u for u in note_images if u])

    # 下载 day_plan 中的图片（兼容扁平和嵌套两种格式）
    def _collect_day_plan_images(day_plan):
        urls = []
        for entry in day_plan:
            if "items" in entry and isinstance(entry["items"], list):
                for item in entry["items"]:
                    img = item.get("image", "")
                    if img and img.startswith("http"):
                        urls.append(img)
            else:
                img = entry.get("image", "")
                if img and img.startswith("http"):
                    urls.append(img)
        return urls

    all_urls.extend(_collect_day_plan_images(day_plan))

    # 下载图片并获取 URL 映射，替换 day_plan/cover_url/images 中的原始 URL
    if all_urls:
        unique_urls = list(dict.fromkeys(all_urls))
        downloaded = await _download_images(unique_urls)
        url_map = dict(zip(unique_urls, downloaded))

        # 替换 day_plan 中的 image URL
        for entry in day_plan:
            if "items" in entry and isinstance(entry["items"], list):
                for item in entry["items"]:
                    img = item.get("image", "")
                    if img in url_map:
                        item["image"] = url_map[img]
            else:
                img = entry.get("image", "")
                if img in url_map:
                    entry["image"] = url_map[img]

        # 替换 cover_url 和 note_images
        if cover_url in url_map:
            cover_url = url_map[cover_url]
        note_images = [url_map.get(u, u) for u in note_images]

    # 5. 返回前端期望的格式（不自动存库，用户在方案详情页手动保存）
    return {
        "code": 0,
        "data": {
            "itinerary_summary": parsed.get("itinerary_summary", ""),
            "day_plan": day_plan,
            "category": parsed.get("category", "city"),
            "plan_id": None,
            "note": {
                "cover_url": cover_url,
                "images": note_images,
                "content": content,
                "author": note.get("author", ""),
                "likes": note.get("likes", 0),
                "title": note.get("title", ""),
                "tags": note.get("tags", []),
                "note_id": note.get("note_id", ""),
            },
        },
        "msg": "导入成功",
    }


@router.post("/parse")
async def parse_xhs_text(req: ParseRequest):
    """
    直接解析文本内容（不从 XHS 抓取，不存库）
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="请输入笔记内容")

    text = req.text.strip()
    parsed = None
    try:
        llm_result = await llm_parse_note(
            title="",
            content=text,
            images=[],
            city=req.city,
        )
        if llm_result and llm_result.get("day_plan"):
            parsed = llm_result
    except Exception as e:
        print(f"[XHS] LLM parse failed, fallback to regex: {e}")

    if not parsed or parsed.get("spot_count", 0) < 2:
        parsed = parse_note("", text, req.city)

    # 3. 并发补充经纬度
    day_plan = parsed.get("day_plan", [])
    if day_plan:
        await _fillCoordinates(day_plan, req.city or "")

    return {
        "code": 0,
        "data": {
            "itinerary_summary": parsed.get("itinerary_summary", ""),
            "day_plan": parsed.get("day_plan", []),
            "category": parsed.get("category", "city"),
            "plan_id": None,
        },
        "msg": "解析成功",
    }


class CookieRequest(BaseModel):
    cookie: str


@router.post("/cookie")
async def update_xhs_cookie(req: CookieRequest, authorization: str = Header(None)):
    """
    更新小红书 Cookie（管理接口，需登录）
    用法：POST /api/xhs/cookie  body: {"cookie": "新的cookie字符串"}
    """
    if not req.cookie or not req.cookie.strip():
        raise HTTPException(status_code=400, detail="cookie 不能为空")

    # 简单权限校验：只有 userId=1 的管理员能更新
    if authorization:
        try:
            from auth import get_current_user_id
            user_id = get_current_user_id(authorization.replace("Bearer ", "").strip())
            if user_id != 1 and str(user_id) != "1":
                raise HTTPException(status_code=403, detail="仅管理员可更新 Cookie")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="登录已过期")
    else:
        raise HTTPException(status_code=401, detail="请先登录")

    set_cookie(req.cookie.strip())
    return {"code": 0, "msg": "Cookie 已更新"}


@router.post("/refresh-cookie")
async def refresh_xhs_cookie():
    """
    自动刷新小红书 Cookie（无需登录验证）
    通过 xhshow 生成 a1 + Playwright 扫码获取新 cookie
    """
    from modules.xhs_fetcher import _refresh_cookie
    new_cookie = await _refresh_cookie()
    if new_cookie:
        return {"code": 0, "msg": "Cookie 自动刷新成功", "data": {"length": len(new_cookie)}}
    raise HTTPException(status_code=500, detail="Cookie 自动刷新失败，请检查 xhs_state.json 是否存在")


# ===== XHS 图片代理 =====
import hashlib
import httpx
from fastapi.responses import Response
from pathlib import Path


