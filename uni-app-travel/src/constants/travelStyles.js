/**
 * 旅行风格枚举（7大玩法体系）
 * slug 是英文稳定值，name/icon 仅用于 UI 展示
 *
 * 城市探索 — City Walk / 深度漫游 / 首次到访 / 周末微度假
 * 摄影出片 — 城市地标 / 夜景摄影 / 人文街拍 / 小众机位
 * 美食打卡 — 本地老字号 / 夜市路线 / 咖啡地图 / 一日吃遍城市
 * 情侣约会 — 浪漫夜景 / 氛围餐厅 / 日落观景 / 周末约会
 * 亲子遛娃 — 动物园 / 科技馆 / 儿童乐园 / 自然教育
 * 特种兵暴走 — 极限打卡 / 一天刷遍经典 / 低预算 / 学生党专属
 * 自驾旅行 — 环线玩法 / 周边逃离 / 风景公路 / 露营路线
 */

export const TRAVEL_STYLES = {
  city:    { slug: 'city',    name: '城市探索', icon: '🚶', description: 'City Walk / 深度漫游 / 首次到访' },
  photo:   { slug: 'photo',   name: '摄影出片', icon: '📸', description: '城市地标 / 夜景摄影 / 人文街拍' },
  food:    { slug: 'food',    name: '美食打卡', icon: '🍜', description: '本地老字号 / 夜市路线 / 咖啡地图' },
  couple:  { slug: 'couple',  name: '情侣约会', icon: '💕', description: '浪漫夜景 / 氛围餐厅 / 日落观景' },
  family:  { slug: 'family',  name: '亲子遛娃', icon: '👨‍👩‍👧', description: '动物园 / 科技馆 / 儿童乐园' },
  rusher:  { slug: 'rusher',  name: '特种兵暴走', icon: '🔥', description: '极限打卡 / 一天刷遍 / 低预算' },
  road:    { slug: 'road',    name: '自驾旅行', icon: '🚗', description: '环线玩法 / 风景公路 / 露营路线' },
}

export const ALL_SLUGS = Object.keys(TRAVEL_STYLES)

export const DEFAULT_STYLE = 'city'

export function getStyle(slug) {
  return TRAVEL_STYLES[slug] || TRAVEL_STYLES[DEFAULT_STYLE]
}

export function getName(slug) {
  return getStyle(slug).name
}

export function getIcon(slug) {
  return getStyle(slug).icon
}

export function isValidSlug(slug) {
  return !!TRAVEL_STYLES[slug]
}
