"""
获取小红书 Cookie — xhshow 生成 a1 + Playwright 扫码登录
核心：xhshow 生成的 a1 注入 Playwright，保证签名用的 a1 和 cookie 里的一致
"""
import os
import sys
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

# 固定存到 python_server/ 目录下
_BASE_DIR = Path(__file__).resolve().parent.parent
_STATE_PATH = str(_BASE_DIR / "xhs_state.json")
_STEALTH_PATH = str(_BASE_DIR / "stealth.min.js")
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)
_XHS_LOGIN_URL = "https://www.xiaohongshu.com"


def _generate_a1_and_webid():
    """用 xhshow 生成 a1 和 webId，保证签名一致"""
    try:
        from xhshow import Xhshow
        a1 = Xhshow.generate_a1()
        web_id = Xhshow.generate_web_id(a1)
        print(f"[xhshow] 生成 a1: {a1[:20]}... (len={len(a1)})")
        print(f"[xhshow] 生成 webId: {web_id}")
        return a1, web_id
    except Exception as e:
        print(f"[xhshow] 生成失败: {e}")
        return None, None


def _build_cookie_str(cookies):
    """从 Playwright cookies 列表构建 cookie 字符串"""
    return "; ".join([f"{c['name']}={c['value']}" for c in cookies])


def _replace_cookie(cookies_list, name, value):
    """替换或追加 cookie"""
    for c in cookies_list:
        if c["name"] == name:
            c["value"] = value
            return cookies_list
    cookies_list.append({
        "name": name,
        "value": value,
        "domain": ".xiaohongshu.com",
        "path": "/",
    })
    return cookies_list


async def _create_context(browser, state_path=None):
    """创建带 stealth 反检测的浏览器上下文"""
    if state_path and os.path.exists(state_path):
        context = await browser.new_context(
            storage_state=state_path,
            user_agent=_USER_AGENT,
        )
        print(f"[state] 已加载保存的登录状态: {state_path}")
    else:
        context = await browser.new_context(user_agent=_USER_AGENT)
        print("[state] 未检测到登录状态，需要扫码登录")

    # 注入 stealth.min.js 反检测脚本
    if os.path.exists(_STEALTH_PATH):
        await context.add_init_script(path=_STEALTH_PATH)
        print("[stealth] 已注入反检测脚本")
    else:
        print(f"[stealth] 未找到: {_STEALTH_PATH}")

    return context


def is_cookie_valid(cookie_str):
    """检查 cookie 是否包含关键字段"""
    required = ['a1', 'web_session']
    names = [p.split('=')[0].strip() for p in cookie_str.split(';')]
    missing = [k for k in required if k not in names]
    if missing:
        print(f"[cookie] 缺少关键字段: {missing}")
        return False
    print(f"[cookie] 包含关键字段: {', '.join(required)}")
    return True


async def get_xiaohongshu_cookie(headless=True):
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=headless,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                ]
            )

            context = await _create_context(browser, _STATE_PATH)

            # 注入 xhshow 生成的 a1 + webId（签名一致性的关键）
            a1, web_id = _generate_a1_and_webid()
            if a1 and web_id:
                # 注入初始 cookie
                cookies = await context.cookies()
                cookies = _replace_cookie(cookies, "a1", a1)
                cookies = _replace_cookie(cookies, "webId", web_id)
                cookies = _replace_cookie(cookies, "xsecappid", "xhs-pc-web")
                # 清除旧的 storage state，用我们注入的 cookie
                await context.clear_cookies()
                for c in cookies:
                    # 确保 domain 正确
                    if "domain" not in c or not c["domain"]:
                        c["domain"] = ".xiaohongshu.com"
                    if "path" not in c or not c["path"]:
                        c["path"] = "/"
                await context.add_cookies(cookies)
                print(f"[inject] 已注入 a1 + webId + xsecappid")
            else:
                print("[inject] xhshow 生成失败，使用网站默认 a1")

            page = await context.new_page()

            # 访问小红书首页（stealth 会保护注入的 a1 不被覆盖）
            print("[nav] 正在访问小红书...")
            await page.goto(_XHS_LOGIN_URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)

            # 获取当前 cookie
            cookies = await context.cookies()
            cookie_str = _build_cookie_str(cookies)

            # 打印 a1 信息
            current_a1 = next((c['value'] for c in cookies if c['name'] == 'a1'), '')
            print(f"[debug] 当前 a1: {current_a1[:30]}... (len={len(current_a1)})")
            print(f"[debug] a1 来源: {'xhshow' if current_a1 == a1 else '网站覆盖'}")

            # 有 state 文件时，检查 cookie 字段
            if os.path.exists(_STATE_PATH) and is_cookie_valid(cookie_str):
                print("[ok] Cookie 字段完整，跳过 API 验证")
                await browser.close()
                return cookie_str

            # 无 state 文件时，检查登录状态
            is_logged_in = False
            try:
                has_login_btn = await page.query_selector('[class*="login"]')
                has_avatar = await page.query_selector('[class*="avatar"]')
                is_logged_in = has_avatar is not None and has_login_btn is None
                print(f"[debug] login_btn={has_login_btn is not None}, avatar={has_avatar is not None}")
            except Exception as e:
                print(f"[debug] 页面检测异常: {e}")

            if is_logged_in and is_cookie_valid(cookie_str):
                await browser.close()
                return cookie_str

            # 需要登录
            if not is_logged_in:
                print("[login] 未登录，需要扫码登录")
            else:
                print("[login] Cookie 已过期，需要重新扫码")
            print("请在弹出的浏览器中扫码登录小红书...")

            try:
                input(">>> 扫码后看到小红书首页，再按下回车继续... ")
            except (EOFError, OSError):
                print("[error] 无法等待扫码，请在有界面的环境运行: python -m modules.get_xhs_cookie")
                await browser.close()
                return None

            # 等待 cookie 写入
            await page.wait_for_timeout(5000)

            # 保存登录状态
            await context.storage_state(path=_STATE_PATH)
            print(f"[state] 登录状态已保存: {_STATE_PATH}")

            # 获取最终 cookie
            cookie_str = _build_cookie_str(await context.cookies())
            final_a1 = next((c.split('=', 1)[1] for c in cookie_str.split(';') if c.strip().startswith('a1=')), '')
            print(f"[final] a1: {final_a1[:30]}... (len={len(final_a1)})")

            await browser.close()
            return cookie_str
    except Exception as e:
        print(f"[error] 获取cookie失败: {e}")
        return None


if __name__ == "__main__":
    cookie = asyncio.run(get_xiaohongshu_cookie(headless=False))

    if not cookie:
        print("未获取到Cookie，退出")
        exit(1)

    if not is_cookie_valid(cookie):
        print("Cookie无效或已过期，退出程序")
        exit(1)

    print("Cookie 获取并验证成功")
