"""
小红书笔记抓取模块 — 直接复用 xhs_collector.py 的 fetch_note_detail 逻辑
"""
import re
import json
import httpx
from typing import Optional, Dict
from urllib.parse import urlparse, parse_qs

from config import settings
from modules.xhs_sign import XhsSign


COOKIE = ""
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"


def extract_note_id(url: str) -> Optional[str]:
    for pattern in (
        r'xiaohongshu\.com/explore/([a-f0-9]+)',
        r'xiaohongshu\.com/discovery/item/([a-f0-9]+)',
        r'xiaohongshu\.com/([a-f0-9]{24})',
    ):
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def extract_xsec_token(url: str) -> str:
    query = urlparse(url).query
    return parse_qs(query).get("xsec_token", [""])[0] or ""


def _get_cookie() -> str:
    return settings.xhs.cookie


def _extract_url_from_text(text: str) -> str:
    """从分享文本中提取小红书 URL"""
    # 匹配小红书链接
    m = re.search(r'https?://[^\s]+xiaohongshu\.com/[^\s]+', text)
    if m:
        return m.group(0)
    # 匹配 xhslink 短链
    m = re.search(r'https?://xhslink\.com/\S+', text)
    if m:
        return m.group(0)
    # 如果输入本身像 URL
    if text.strip().startswith('http') and 'xiaohongshu' in text:
        return text.strip()
    return text.strip()


async def fetch_note_by_url(url: str) -> Optional[Dict]:
    # 从分享文本中提取 URL
    url = _extract_url_from_text(url)

    # 自动补全协议
    if url and not url.startswith('http'):
        url = 'https://' + url

    note_id = extract_note_id(url)
    if not note_id:
        print("[XHS] note_id 提取失败")
        return None

    cookie = _get_cookie()
    if not cookie:
        print("[XHS] cookie 为空")
        return None

    xsec_token = extract_xsec_token(url)
    print(f"[XHS] note_id={note_id}, xsec_token={'有' if xsec_token else '无'}, cookie_len={len(cookie)}")

    # 如果 URL 没有 xsec_token，先请求页面获取
    if not xsec_token:
        xsec_token = await _get_xsec_token_from_html(note_id, url, cookie)
        if xsec_token:
            print(f"[XHS] 从 HTML 获取 xsec_token: {xsec_token[:20]}...")

    if not xsec_token:
        print("[XHS] 无法获取 xsec_token")
        return None

    # 调用 feed API（与 xhs_collector.fetch_note_detail 完全一致）
    return await _fetch_note_detail(note_id, xsec_token, cookie)


async def _fetch_note_detail(note_id: str, xsec_token: str, cookie: str) -> Optional[Dict]:
    """
    与 xhs_collector.py 的 fetch_note_detail 完全一致
    """
    api_url = "https://edith.xiaohongshu.com/api/sns/web/v1/feed"

    payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": "pc_user",
        "xsec_token": xsec_token,
    }

    signer = XhsSign()
    sign_headers = signer.sign_headers_post(api_url, cookie, payload=payload)

    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": "https://www.xiaohongshu.com",
        "Referer": f"https://www.xiaohongshu.com/explore/{note_id}",
        "User-Agent": USER_AGENT,
        "Cookie": cookie,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Sec-Ch-Ua": '"Google Chrome";v="143", "Chromium";v="143", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
    }
    headers.update(sign_headers)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(api_url, headers=headers, json=payload)

        print(f"[XHS] feed status={response.status_code}")

        if response.status_code == 406:
            print("[XHS] 406 签名验证失败")
            return None

        if response.status_code != 200:
            print(f"[XHS] HTTP {response.status_code}")
            return None

        data = response.json()
        code = data.get("code")
        print(f"[XHS] feed code={code}, msg={data.get('msg', '')}")

        if code == -100:
            print("[XHS] Cookie 已失效")
            return None

        if code != 0:
            return None

        items = data.get("data", {}).get("items", [])
        if not items:
            print("[XHS] items 为空")
            return None

        note_card = items[0].get("note_card", {})
        if not note_card:
            print("[XHS] note_card 为空")
            return None

        return _parse_note_card(note_card, note_id)


def _parse_note_card(note_card: Dict, note_id: str) -> Optional[Dict]:
    title = note_card.get("title", "") or note_card.get("display_title", "")
    content = note_card.get("desc", "")

    if not title and not content:
        return None

    images = []
    for img in note_card.get("image_list", []):
        url_default = img.get("url_default", "") or img.get("url_pre", "") or img.get("url", "")
        if url_default:
            images.append(url_default)

    tags = []
    for tag in note_card.get("tag_list", []):
        name = tag.get("name", "")
        if name:
            tags.append(name)

    user = note_card.get("user", {})
    interact = note_card.get("interact_info", {})

    # 提取作者名（兼容多种字段名）
    author = (user.get("nickname") or 
              user.get("nickName") or 
              user.get("nick_name") or "")
    
    # 提取点赞数（兼容多种字段名）
    likes = (interact.get("liked_count") or 
             interact.get("likes") or 
             interact.get("like_count") or 0)

    return {
        "note_id": note_id,
        "title": title,
        "content": content,
        "images": images,
        "tags": tags,
        "author": author,
        "likes": int(likes) if likes else 0,
        "cover_url": images[0] if images else "",
    }


async def _get_xsec_token_from_html(note_id: str, url: str, cookie: str) -> str:
    """从页面 HTML 提取 xsec_token"""
    headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9",
        "user-agent": USER_AGENT,
        "cookie": cookie,
        "referer": "https://www.xiaohongshu.com/",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return ""
            html = resp.text

            if "你访问的页面不见了" in html or "页面不存在" in html:
                return ""

            patterns = [
                rf'"note_id"\s*:\s*"{note_id}".+?"xsec_token"\s*:\s*"([^"]+)"',
                rf'"noteId"\s*:\s*"{note_id}".+?"xsecToken"\s*:\s*"([^"]+)"',
                r'"xsec_token"\s*:\s*"([^"]+)"',
                r'"xsecToken"\s*:\s*"([^"]+)"',
            ]
            for pattern in patterns:
                match = re.search(pattern, html, re.DOTALL)
                if match:
                    return match.group(1)
    except Exception as e:
        print(f"[XHS] HTML 请求异常: {e}")
    return ""
