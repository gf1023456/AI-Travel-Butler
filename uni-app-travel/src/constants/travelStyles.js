/**
 * 旅行风格枚举（与后端 python_server/constants/travel_styles.py 保持一致）
 * slug 是英文稳定值，name/icon 仅用于 UI 展示
 */

export const TRAVEL_STYLES = {
  light:   { slug: 'light',   name: '轻装上阵', icon: '🌤️', description: '轻松慢游，少量景点' },
  deep:    { slug: 'deep',    name: '深度打卡', icon: '📍', description: '深度文化与历史' },
  food:    { slug: 'food',    name: '美食之旅', icon: '🍜', description: '美食探店为主' },
  outdoor: { slug: 'outdoor', name: '户外探索', icon: '🏔️', description: '徒步登山户外' }
}

export const ALL_SLUGS = Object.keys(TRAVEL_STYLES)

export const DEFAULT_STYLE = 'deep'

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
