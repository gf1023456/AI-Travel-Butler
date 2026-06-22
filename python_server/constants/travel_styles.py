"""
旅行风格枚举（前后端共享唯一真源）

slug 必须是英文，存数据库、URL、AI prompt 都用 slug。
与前端 uni-app-travel/src/constants/travelStyles.js 严格一致。
"""

TRAVEL_STYLES = {
    'city': {
        'slug': 'city',
        'name': '城市探索',
        'icon': '🚶',
        'description': 'City Walk / 深度漫游 / 首次到访'
    },
    'photo': {
        'slug': 'photo',
        'name': '摄影出片',
        'icon': '📸',
        'description': '城市地标 / 夜景摄影 / 人文街拍'
    },
    'food': {
        'slug': 'food',
        'name': '美食打卡',
        'icon': '🍜',
        'description': '本地老字号 / 夜市路线 / 咖啡地图'
    },
    'couple': {
        'slug': 'couple',
        'name': '情侣约会',
        'icon': '💕',
        'description': '浪漫夜景 / 氛围餐厅 / 日落观景'
    },
    'family': {
        'slug': 'family',
        'name': '亲子遛娃',
        'icon': '👨‍👩‍👧',
        'description': '动物园 / 科技馆 / 儿童乐园'
    },
    'rusher': {
        'slug': 'rusher',
        'name': '特种兵暴走',
        'icon': '🔥',
        'description': '极限打卡 / 一天刷遍 / 低预算'
    },
    'road': {
        'slug': 'road',
        'name': '自驾旅行',
        'icon': '🚗',
        'description': '环线玩法 / 风景公路 / 露营路线'
    },
}

DEFAULT_STYLE = 'city'


def get_style(slug: str) -> dict:
    """安全获取风格，不存在时返回默认"""
    return TRAVEL_STYLES.get(slug, TRAVEL_STYLES[DEFAULT_STYLE])


def get_all_slugs() -> list:
    return list(TRAVEL_STYLES.keys())


def is_valid_slug(slug: str) -> bool:
    return slug in TRAVEL_STYLES
