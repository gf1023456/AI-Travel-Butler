"""
图片压缩存储模块
下载外网图 → Pillow 缩放 → 转 webp → 存到 static/img
- 800px 宽（卡片展示足够,retina 也清晰）
- webp 质量 75（约 30-80KB/张）
- MD5 命名（同一 URL 不重复处理）
- 并发控制（信号量限制同时下载数）
- 失败 fallback 返回原 URL
"""
import asyncio
import hashlib
import io
import sys
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image

# 静态存储根目录（python_server/static/img/）
STATIC_DIR = Path(__file__).resolve().parent.parent / "static" / "img"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# 压缩参数
MAX_WIDTH = 800           # 最大宽度
WEBP_QUALITY = 75         # webp 质量
DOWNLOAD_TIMEOUT = 8.0    # 单张下载超时(秒)
COMPRESS_TIMEOUT = 5.0    # 单张压缩超时(秒)
MAX_CONCURRENT = 5        # 最大并发数
MIN_BYTES = 4096          # 小于这个体积说明下载失败/空图,跳过压缩

# 公开 URL 前缀（生成方案返回前端时用）
# 通过 FastAPI StaticFiles 暴露 /static
PUBLIC_PATH_PREFIX = "/static/img"

# 公开域名（从 settings 读,留空时 fallback 到 BACKEND_URL）
def _get_public_base_url() -> str:
    # 优先用 config.settings
    try:
        from config import settings
        base = getattr(settings.server, "public_base_url", "") or ""
        if base:
            return base.rstrip("/")
    except Exception:
        pass
    # fallback:直接读 .env
    try:
        from pathlib import Path
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if line.startswith("PUBLIC_BASE_URL="):
                    val = line.split("=", 1)[1].strip()
                    if val and not val.startswith("#"):
                        return val.rstrip("/")
    except Exception:
        pass
    return ""


PUBLIC_BASE_URL = _get_public_base_url()


def _public_url(url_hash: str) -> str:
    """拼完整 URL,给前端直接用。前端如果需要相对路径,可以从 PUBLIC_PATH_PREFIX 取。"""
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL}{PUBLIC_PATH_PREFIX}/{url_hash}.webp"
    return f"{PUBLIC_PATH_PREFIX}/{url_hash}.webp"


def _log(msg: str):
    """安全 print,避免 Windows 下 UnicodeEncodeError"""
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        # 截断到 ASCII 安全长度
        safe = msg.encode("ascii", "replace").decode("ascii")[:200]
        print(safe, flush=True)


def _hash_url(url: str) -> str:
    """URL → MD5,作为文件名"""
    return hashlib.md5(url.encode("utf-8")).hexdigest()


def _local_path(url_hash: str) -> Path:
    """hash → 本地路径"""
    return STATIC_DIR / f"{url_hash}.webp"


def _compress_sync(raw: bytes) -> Optional[bytes]:
    """同步压缩:打开→等比缩放→转 webp。返回 None 表示失败。"""
    try:
        img = Image.open(io.BytesIO(raw))
        if getattr(img, "is_animated", False):
            img.seek(0)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
        if img.width > MAX_WIDTH:
            ratio = MAX_WIDTH / img.width
            new_h = int(img.height * ratio)
            img = img.resize((MAX_WIDTH, new_h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=WEBP_QUALITY, method=4)
        return buf.getvalue()
    except Exception as e:
        _log(f"[ImageCompressor] compress fail: {type(e).__name__}")
        return None


async def download_and_store(url: str, client: httpx.AsyncClient, sem: asyncio.Semaphore) -> str:
    """
    下载外网图 → 压缩 → 存本地 → 返回公开 URL。
    任何环节失败都 fallback 返回原 URL,不阻塞方案生成。
    """
    if not url or not url.startswith(("http://", "https://")):
        return url

    url_hash = _hash_url(url)
    local_file = _local_path(url_hash)
    public_url = _public_url(url_hash)
    short = url_hash[:8]

    # 缓存命中
    if local_file.exists() and local_file.stat().st_size > 0:
        return public_url

    async with sem:
        try:
            # 1. 下载
            resp = await asyncio.wait_for(
                client.get(url, follow_redirects=True, timeout=DOWNLOAD_TIMEOUT),
                timeout=DOWNLOAD_TIMEOUT
            )
            if resp.status_code != 200:
                _log(f"[ImageCompressor] {short} download fail {resp.status_code}")
                return url
            raw = resp.content
            if len(raw) < MIN_BYTES:
                _log(f"[ImageCompressor] {short} too small {len(raw)}B, skip")
                return url

            # 2. 压缩(线程池,避免阻塞事件循环)
            loop = asyncio.get_event_loop()
            compressed = await asyncio.wait_for(
                loop.run_in_executor(None, _compress_sync, raw),
                timeout=COMPRESS_TIMEOUT
            )
            if not compressed:
                return url

            # 3. 写文件(线程池)
            await loop.run_in_executor(None, local_file.write_bytes, compressed)

            saved_kb = len(compressed) / 1024
            orig_kb = len(raw) / 1024
            _log(f"[ImageCompressor] OK {short} {saved_kb:.1f}KB (was {orig_kb:.1f}KB)")
            return public_url

        except asyncio.TimeoutError:
            _log(f"[ImageCompressor] {short} timeout")
            return url
        except Exception as e:
            _log(f"[ImageCompressor] {short} error: {type(e).__name__}")
            return url


async def compress_all(urls: list[str]) -> list[str]:
    """
    批量处理:同一 httpx 客户端复用,并发受控。
    输入:URL 列表
    输出:本地(或回退)URL 列表,顺序与输入一致
    """
    if not urls:
        return []
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    async with httpx.AsyncClient(headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    }) as client:
        return await asyncio.gather(
            *(download_and_store(u, client, sem) for u in urls)
        )
