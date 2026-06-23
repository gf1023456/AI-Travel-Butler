"""
小红书笔记解析模块 — 正则优先 + AI 兜底
复用 crawler/parser.py 的正则逻辑，并在解析失败时调用 AI
"""
import re
from typing import List, Dict, Optional, Tuple


# Day 分段正则
_DAY_PATTERNS = [
    re.compile(r'[Dd]ay\s*(\d+)', re.IGNORECASE),
    re.compile(r'第([一二三四五六七八九十\d]+)天'),
    re.compile(r'(\d+)\s*[天日]'),
]

_SEPARATORS = re.compile(r'[→/／、，,；;\n]\s*|\d+[.、．]\s*|[-—]')

_CITY_KEYWORDS = {
    '北京': ['北京', '故宫', '天安门', '长城', '颐和园', '南锣鼓巷'],
    '上海': ['上海', '外滩', '迪士尼', '豫园', '城隍庙', '南京路'],
    '成都': ['成都', '宽窄巷子', '锦里', '春熙路', '太古里', '大熊猫'],
    '重庆': ['重庆', '洪崖洞', '解放碑', '磁器口', '朝天门'],
    '杭州': ['杭州', '西湖', '灵隐寺', '千岛湖', '雷峰塔'],
    '西安': ['西安', '兵马俑', '大雁塔', '回民街', '城墙'],
    '三亚': ['三亚', '亚龙湾', '天涯海角', '蜈支洲岛'],
    '大理': ['大理', '洱海', '古城', '苍山', '双廊'],
    '丽江': ['丽江', '古城', '玉龙雪山', '束河'],
    '长沙': ['长沙', '橘子洲', '岳麓山', '太平街', '坡子街'],
}


def _cn_to_num(cn: str) -> int:
    cn_map = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
              '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
    if cn.isdigit():
        return int(cn)
    return cn_map.get(cn, 1)


def _extract_day_number(text: str) -> int:
    for pattern in _DAY_PATTERNS:
        m = pattern.search(text)
        if m:
            return _cn_to_num(m.group(1))
    return 0


def _clean_spot_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r'^[\s\d.、．]+', '', name)
    name = re.sub(r'[：:].*$', '', name)
    name = re.sub(r'[（(].*[）)]$', '', name)
    name = re.sub(r'[！!？?。.]$', '', name)
    if re.match(r'^[\W\s_]+$', name):
        return ''
    return name.strip()


def _infer_city(text: str, fallback_city: Optional[str] = None) -> str:
    if fallback_city:
        return fallback_city
    for city, keywords in _CITY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return city
    return ''


def _try_extract_day_blocks(content: str) -> Dict[int, List[str]]:
    day_blocks: Dict[int, List[str]] = {}
    split_pattern = re.compile(
        r'([Dd]ay\s*\d+|第[一二三四五六七八九十\d]+天|\d+\s*[天日])',
        re.IGNORECASE
    )
    parts = split_pattern.split(content)

    current_day = 0
    for part in parts:
        day_num = _extract_day_number(part)
        if day_num > 0:
            current_day = day_num
            continue
        if current_day > 0 and part.strip():
            items = _SEPARATORS.split(part)
            spots = []
            for item in items:
                name = _clean_spot_name(item)
                if name and 2 <= len(name) <= 20:
                    spots.append(name)
            if spots:
                day_blocks[current_day] = spots
    return day_blocks


def _try_extract_emoji(content: str) -> List[str]:
    pattern = re.compile(r'📍\s*(.+?)(?:\s*[-——]|$)', re.MULTILINE)
    return [m.group(1).strip() for m in pattern.finditer(content) if m.group(1).strip()]


def _try_extract_brackets(content: str) -> List[str]:
    pattern = re.compile(r'[【\[](.+?)[】\]]')
    return [m.group(1).strip() for m in pattern.finditer(content) if m.group(1).strip()]


def regex_parse(title: str, content: str, city: Optional[str] = None, images: Optional[List[str]] = None) -> Tuple[List[Dict], str, bool]:
    """
    正则解析笔记内容

    Args:
        images: 原始笔记图片列表，用于关联到解析出的 spots
    Returns:
        (spots, city, success) — success 表示是否解析到足够景点
    """
    full_text = f"{title}\n{content}"
    inferred_city = _infer_city(full_text, city)
    img_list = images or []
    img_count = len(img_list)

    def _make_spot(name: str, day: int, seq: int) -> Dict:
        img_idx = (day - 1) * 3 + (seq - 1)
        spot_image = img_list[img_idx % img_count] if img_count > 0 else ''
        return {
            'name': name,
            'city': inferred_city,
            'day': day,
            'sequence': seq,
            'description': '',
            'reason': '',
            'time': '',
            'category': 'SIGHT',
            'image': spot_image,
        }

    # 策略 1：Day 分段
    day_blocks = _try_extract_day_blocks(full_text)
    if day_blocks:
        spots = []
        for day_num in sorted(day_blocks.keys()):
            for seq, name in enumerate(day_blocks[day_num], 1):
                spots.append(_make_spot(name, day_num, seq))
        return spots, inferred_city, len(spots) >= 2

    # 策略 2：emoji 📍
    emoji_spots = _try_extract_emoji(full_text)
    if emoji_spots:
        spots = [_make_spot(name, 1, i) for i, name in enumerate(emoji_spots, 1)]
        return spots, inferred_city, len(spots) >= 2

    # 策略 3：方括号 【】
    bracket_spots = _try_extract_brackets(full_text)
    if bracket_spots:
        spots = [_make_spot(name, 1, i) for i, name in enumerate(bracket_spots, 1)]
        return spots, inferred_city, len(spots) >= 2

    # 策略 4：通用分隔符
    spots = []
    for line in content.split('\n'):
        line = line.strip()
        if not line or len(line) < 4:
            continue
        items = _SEPARATORS.split(line)
        for item in items:
            name = _clean_spot_name(item)
            if name and 2 <= len(name) <= 15:
                spots.append(_make_spot(name, 1, len(spots) + 1))

    return spots, inferred_city, len(spots) >= 2


def _infer_category(text: str) -> str:
    if any(kw in text for kw in ['摄影', '拍照', '出片', '机位', '夜景']):
        return 'photo'
    if any(kw in text for kw in ['美食', '吃', '小吃', '餐厅', '咖啡']):
        return 'food'
    if any(kw in text for kw in ['情侣', '约会', '浪漫']):
        return 'couple'
    if any(kw in text for kw in ['带娃', '亲子', '家庭', '小朋友', '动物园']):
        return 'family'
    if any(kw in text for kw in ['特种兵', '暴走', '打卡', '穷游']):
        return 'rusher'
    if any(kw in text for kw in ['自驾', '环线', '公路', '露营']):
        return 'road'
    return 'city'


def parse_note(title: str, content: str, city: Optional[str] = None, images: Optional[List[str]] = None) -> Dict:
    """
    解析笔记（正则优先）

    Args:
        images: 原始笔记图片列表，用于关联到解析出的 spots
    Returns:
        {
            "itinerary_summary": str,
            "day_plan": list,
            "category": str,
            "city": str,
            "spot_count": int,
            "parse_method": "regex" | "fallback"
        }
    """
    spots, inferred_city, success = regex_parse(title, content, city, images)
    category = _infer_category(f"{title}\n{content}")

    if title and len(title) <= 50:
        summary = title
    elif spots:
        days = set(s['day'] for s in spots)
        day_count = max(days) if days else 1
        summary = f"{inferred_city}{''.join(s['name'] for s in spots[:3])}等{len(spots)}个景点{day_count}日游"
    else:
        summary = title or '小红书旅行方案'

    return {
        'itinerary_summary': summary,
        'day_plan': spots,
        'category': category,
        'city': inferred_city,
        'spot_count': len(spots),
        'parse_method': 'regex' if success else 'fallback',
    }
