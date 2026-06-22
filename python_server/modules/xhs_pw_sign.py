"""
小红书 Playwright 签名模块 — 用浏览器 JS 直接签名，避免 Python 实现差异
"""
import os
import asyncio
import time
from pathlib import Path
from typing import Optional, Dict

_BASE_DIR = Path(__file__).resolve().parent.parent
_STEALTH_PATH = str(_BASE_DIR / "stealth.min.js")
_STATE_PATH = str(_BASE_DIR / "xhs_state.json")
_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"

_browser = None
_context = None
_page = None
_a1 = ""


async def init_signer():
    """启动 Playwright 浏览器并初始化签名环境"""
    global _browser, _context, _page, _a1

    from playwright.async_api import async_playwright

    p = await async_playwright().start()
    _browser = await p.chromium.launch(
        headless=True,
        args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
    )

    # 创建上下文并注入 stealth
    if os.path.exists(_STATE_PATH):
        _context = await _browser.new_context(
            storage_state=_STATE_PATH,
            user_agent=_USER_AGENT,
        )
        print("[PW-Sign] ✔ 已加载登录状态")
    else:
        _context = await _browser.new_context(user_agent=_USER_AGENT)
        print("[PW-Sign] ⚠ 无登录状态")

    if os.path.exists(_STEALTH_PATH):
        await _context.add_init_script(path=_STEALTH_PATH)

    _page = await _context.new_page()

    # 导航到小红书，加载签名 JS
    await _page.goto("https://www.xiaohongshu.com/", wait_until="networkidle", timeout=30000)
    await _page.wait_for_timeout(3000)

    # 等 _webmsxyw 函数就绪
    for i in range(10):
        has_fn = await _page.evaluate("() => typeof window._webmsxyw === 'function'")
        if has_fn:
            print("[PW-Sign] ✔ _webmsxyw 函数已就绪")
            break
        await _page.wait_for_timeout(1000)
    else:
        print("[PW-Sign] ⚠ _webmsxyw 函数未找到")

    # 获取 a1
    _a1 = await _page.evaluate("() => document.cookie.match(/a1=([^;]+)/)?.[1] || ''")
    print(f"[PW-Sign] a1: {_a1[:30]}... (len={len(_a1)})")


async def sign(uri: str, data: dict = None, method: str = "POST") -> Dict[str, str]:
    """用浏览器 JS 签名"""
    global _page, _a1

    if not _page or _page.is_closed():
        await init_signer()

    # 调用 XHS 的 JS 签名函数
    try:
        if method.upper() == "POST":
            result = await _page.evaluate(
                "([uri, data]) => window._webmsxyw(uri, data)",
                [uri, data or {}]
            )
        else:
            result = await _page.evaluate(
                "([uri, data]) => window._webmsxyw(uri, data)",
                [uri, data or {}]
            )

        return {
            "x-s": result.get("X-s", ""),
            "x-t": str(result.get("X-t", "")),
        }
    except Exception as e:
        print(f"[PW-Sign] 签名异常: {e}")
        # 尝试刷新页面后重试
        await _page.reload(wait_until="networkidle", timeout=15000)
        await _page.wait_for_timeout(2000)
        result = await _page.evaluate(
            "([uri, data]) => window._webmsxyw(uri, data)",
            [uri, data or {}]
        )
        return {
            "x-s": result.get("X-s", ""),
            "x-t": str(result.get("X-t", "")),
        }


async def sign_and_build_headers(uri: str, cookie: str, payload: dict = None) -> Dict[str, str]:
    """签名并构建完整请求头"""
    signs = await sign(uri, data=payload, method="POST")
    return {
        "X-S": signs["x-s"],
        "X-T": signs["x-t"],
        "x-S-Common": "",  # JS 签名不需要
        "X-B3-Traceid": ''.join(__import__('random').choices('0123456789abcdef', k=16)),
    }


async def get_a1() -> str:
    """获取当前 a1"""
    return _a1


async def close():
    """关闭浏览器"""
    global _browser, _context, _page
    if _page and not _page.is_closed():
        await _page.close()
    if _context:
        await _context.close()
    if _browser:
        await _browser.close()
    _page = None
    _context = None
    _browser = None
