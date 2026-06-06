"""
旅行风格枚举（前后端共享唯一真源）

slug 必须是英文，存数据库、URL、AI prompt 都用 slug。
name/icon 只用于前端展示。
"""

TRAVEL_STYLES = {
    'light': {
        'slug': 'light',
        'name': '轻装上阵',
        'icon': '🌤️',
        'description': '轻松慢游，少量景点'
    },
    'deep': {
        'slug': 'deep',
        'name': '深度打卡',
        'icon': '📍',
        'description': '深度文化与历史'
    },
    'food': {
        'slug': 'food',
        'name': '美食之旅',
        'icon': '🍜',
        'description': '美食探店为主'
    },
    'outdoor': {
        'slug': 'outdoor',
        'name': '户外探索',
        'icon': '🏔️',
        'description': '徒步登山户外'
    },
}


def get_style(slug: str) -> dict:
    """安全获取风格，不存在时返回 deep"""
    return TRAVEL_STYLES.get(slug, TRAVEL_STYLES['deep'])


def get_all_slugs() -> list:
    return list(TRAVEL_STYLES.keys())


def is_valid_slug(slug: str) -> bool:
    return slug in TRAVEL_STYLES
