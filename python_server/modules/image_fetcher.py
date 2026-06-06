"""
AI Travel Butler - 实景图获取模块
Serper.dev (Google Images) → Pixabay → LoremFlickr
获取原图 URL → 调用 image_compressor 下载压缩到本地
"""

import asyncio
import httpx
import re
from typing import List, Dict
from urllib.parse import quote

from config import settings
from modules.image_compressor import compress_all

PIXABAY_API = "https://pixabay.com/api/"
PIXABAY_KEY = settings.external_apis.pixabay_api_key

SERPER_API = "https://google.serper.dev/images"
SERPER_KEY = settings.external_apis.serper_api_key

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
}


async def fetch_location_image(name: str, city: str = "") -> str:
    url = await _serper(name, city)
    if url:
        return url
    url = await _pixabay(name, city)
    if url:
        return url
    return _loremflickr(name, city)


async def _serper(name: str, city: str) -> str:
    if not SERPER_KEY:
        return ""
    query = f"{name} {city}".strip()
    payload = {"q": query}
    try:
        async with httpx.AsyncClient() as client:
            resp = await asyncio.wait_for(
                client.post(SERPER_API, json=payload,
                    headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
                    timeout=8),
                timeout=8)
            if resp.status_code != 200:
                return ""
            data = resp.json()
            for img in data.get("images", []):
                url = img.get("imageUrl") or ""
                if url:
                    return url
    except Exception as e:
        print(f"[Image] Serper fail: {name} - {e}")
    return ""


async def _pixabay(name: str, city: str) -> str:
    if not PIXABAY_KEY:
        return ""
    keyword = quote(f"{name} {city}")
    try:
        url = f"{PIXABAY_API}?key={PIXABAY_KEY}&q={keyword}&image_type=photo&orientation=horizontal&category=places&per_page=3&safesearch=true&lang=zh"
        async with httpx.AsyncClient() as client:
            resp = await asyncio.wait_for(client.get(url, timeout=8), timeout=8)
            if resp.status_code != 200:
                return ""
            data = resp.json()
            for hit in data.get("hits", []):
                img = hit.get("webformatURL") or hit.get("largeImageURL") or ""
                if img:
                    return img
    except Exception as e:
        print(f"[Image] Pixabay fail: {name} - {e}")
    return ""


def _loremflickr(name: str, city: str) -> str:
    tags = re.sub(r"[^\u4e00-\u9fa5a-zA-Z]+", ",", f"{name} {city}").strip(",")
    tags = ",".join(tags.split(",")[:3])
    return f"https://loremflickr.com/640/480/{quote(tags)}"


async def enrich_images(items: List[Dict], mcp_trace: List[str]) -> List[Dict]:
    """
    三步:
    1. 并发拿每个 item 的外网图 URL
    2. 全部拿完后,批量下载压缩存到本地
    3. 把 item.image 替换成本地 URL
    """
    if not items:
        return items

    async def fetch_one(item: Dict) -> Dict:
        if item.get("image"):
            return item
        name = item.get("name", "")
        city = item.get("city", "")
        if name:
            url = await fetch_location_image(name, city)
            if url:
                item["image"] = url
                mcp_trace.append(f"image:found:{name}")
            else:
                mcp_trace.append(f"image:not_found:{name}")
        return item

    # 第一步:并发拿 URL
    items = await asyncio.gather(*[fetch_one(item) for item in items])

    # 第二步:批量下载压缩
    urls = [item.get("image", "") for item in items if item.get("image")]
    if not urls:
        return items

    compressed = await compress_all(urls)
    url_map = dict(zip(urls, compressed))

    # 第三步:替换成本地 URL
    for item in items:
        orig = item.get("image", "")
        if orig and orig in url_map:
            item["image"] = url_map[orig]

    return items
