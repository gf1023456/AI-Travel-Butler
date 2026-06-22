"""
自动采集小红书热门城市笔记
用法：python scripts/collect_hot_notes.py
"""
import os
import sys
import asyncio
import requests
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import settings

# 热门城市 + 关键词（有代表性但不烂大街）
CITIES = [
    ("苏州", "苏州旅游攻略"),
    ("洛阳", "洛阳旅游攻略"),
    ("大同", "大同旅游攻略"),
    ("敦煌", "敦煌旅游攻略"),
    ("景德镇", "景德镇旅游攻略"),
    ("潮州", "潮州旅游攻略"),
    ("恩施", "恩施旅游攻略"),
    ("甘南", "甘南旅游攻略"),
    ("腾冲", "腾冲旅游攻略"),
    ("喀什", "喀什旅游攻略"),
    ("威海", "威海旅游攻略"),
    ("婺源", "婺源旅游攻略"),
]

# 每个城市采集数
NOTES_PER_CITY = 5

# 本地保存采集结果
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "collected"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def search_notes(keyword: str, cookie_dict: dict) -> list:
    """搜索笔记，返回 note_id 列表"""
    try:
        from xhshow import Xhshow
    except ImportError:
        print("请先安装 xhshow: pip install xhshow")
        sys.exit(1)

    api_url = "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes"
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": 20,
        "sort": "general",
        "note_type": 0,
        "image_formats": ["jpg", "webp", "avif"],
    }

    client = Xhshow()

    # 只保留 XHS 必需的 cookie 给签名，避免 1239 个无关 cookie 污染 x-s-common
    xhs_keys = {'a1', 'webId', 'web_session', 'webBuild', 'gid', 'xsecappid', 'abRequestId'}
    sign_dict = {k: v for k, v in cookie_dict.items() if k in xhs_keys}

    sign_headers = client.sign_headers_post(api_url, cookies=sign_dict, payload=payload)
    cookie_str = "; ".join(f"{k}={v}" for k, v in cookie_dict.items())

    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.xiaohongshu.com",
        "Referer": f"https://www.xiaohongshu.com/search_result?keyword={keyword}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "Cookie": cookie_str,
    }
    # 过滤签名头值中的非 ASCII（requests/latin-1 不支持中文）
    for k, v in sign_headers.items():
        sv = str(v)
        try:
            sv.encode('latin-1')
            headers[str(k)] = sv
        except UnicodeEncodeError:
            pass  # 跳过非 ASCII 的签名头（如 x-s-common）

    try:
        resp = requests.post(api_url, headers=headers, json=payload, timeout=15)
    except Exception as e:
        print(f"  搜索异常: {e}")
        return []

    if resp.status_code != 200:
        print(f"  搜索失败: HTTP {resp.status_code}")
        return []

    data = resp.json()
    if data.get("code") != 0:
        print(f"  搜索失败: {data.get('msg', '未知错误')}")
        return []

    items = data.get("data", {}).get("items") or []
    notes = []
    for item in items:
        note_card = item.get("note_card") or {}
        note_id = item.get("id") or note_card.get("note_id") or ""
        if not note_id:
            continue
        likes = note_card.get("interact_info", {}).get("liked_count", "0")
        title = note_card.get("display_title", "")[:30]
        notes.append({
            "note_id": note_id,
            "title": title,
            "likes": likes,
            "url": f"https://www.xiaohongshu.com/explore/{note_id}",
        })

    # 按点赞数排序
    def parse_likes(s):
        s = str(s).replace("万", "0000").replace("+", "")
        try:
            return int(float(s))
        except:
            return 0

    notes.sort(key=lambda x: parse_likes(x["likes"]), reverse=True)
    return notes[:NOTES_PER_CITY]


def import_note(url: str) -> dict:
    """调用 import 接口导入笔记"""
    try:
        resp = requests.post(
            "http://localhost:8787/api/xhs/import",
            json={"url": url},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()
        return {"code": resp.status_code, "msg": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"code": -1, "msg": str(e)}


async def main():
    # 读取 cookie（支持两种格式）
    cookie_dict = {}
    cookie = ""
    cookie_file = Path(__file__).resolve().parent.parent / "cookies.txt"
    if cookie_file.exists():
        raw = cookie_file.read_text().strip()
        if raw.startswith("# Netscape") or "\t" in raw:
            for line in raw.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("\t")
                if len(parts) >= 7:
                    cookie_dict[parts[5]] = parts[6]
            cookie = "; ".join(f"{k}={v}" for k, v in cookie_dict.items())
            print(f"  从 Netscape 格式解析 cookie，共 {len(cookie_dict)} 个字段")
        else:
            cookie = raw
    else:
        cookie = settings.xhs.cookie

    if not cookie:
        print("未找到 cookie，请在 python_server/cookies.txt 放入 cookie 或设置 XHS_COOKIE")
        return

    if not cookie_dict:
        cookie_dict = dict(p.split("=", 1) for p in cookie.split(";") if "=" in p)
    print(f"Cookie 字段: {list(cookie_dict.keys())[:5]}... 共 {len(cookie_dict)} 个")
    print(f"采集城市: {len(CITIES)} 个")
    print(f"每城市采集: {NOTES_PER_CITY} 篇")
    print("-" * 50)

    results = []

    for city, keyword in CITIES:
        print(f"\n🔍 {city}: {keyword}")

        # 搜索
        notes = search_notes(keyword, cookie_dict)
        if not notes:
            print(f"  未搜到结果，跳过")
            continue

        print(f"  搜到 {len(notes)} 篇，开始导入...")

        for i, note in enumerate(notes):
            print(f"  [{i+1}/{len(notes)}] {note['title']} (👍{note['likes']})")

            # 调 import 接口
            result = import_note(note["url"])
            if result.get("code") == 0:
                data = result.get("data", {})
                plan_id = data.get("plan_id")
                summary = data.get("itinerary_summary", "")[:50]
                print(f"    ✓ 导入成功: {summary}...")
                results.append({
                    "city": city,
                    "note_id": note["note_id"],
                    "title": note["title"],
                    "likes": note["likes"],
                    "plan_id": plan_id,
                    "summary": data.get("itinerary_summary", ""),
                })
            else:
                print(f"    ✗ 导入失败: {result.get('msg', '未知错误')}")

            # 避免请求过快
            await asyncio.sleep(2)

    # 保存结果
    output_file = OUTPUT_DIR / "collected_notes.json"
    output_file.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\n{'=' * 50}")
    print(f"采集完成! 共导入 {len(results)} 篇笔记")
    print(f"结果保存: {output_file}")


if __name__ == "__main__":
    asyncio.run(main())
