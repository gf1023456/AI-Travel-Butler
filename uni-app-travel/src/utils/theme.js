/**
 * 主题管理工具
 * 支持浅色/深色模式切换
 */

import { ref, computed } from 'vue'

const THEME_KEY = 'app_theme'
const SYSTEM_THEME_KEY = 'app_theme_follow_system'

// 全局共享的主题状态
const _currentTheme = ref('light')

// 获取保存的主题设置
export function getSavedTheme() {
  try {
    const followSystem = uni.getStorageSync(SYSTEM_THEME_KEY)
    if (followSystem !== false) {
      const systemInfo = uni.getSystemInfoSync()
      return systemInfo.theme === 'dark' ? 'dark' : 'light'
    }
    return uni.getStorageSync(THEME_KEY) || 'light'
  } catch (e) {
    return 'light'
  }
}

// 应用主题
export function applyTheme(theme) {
  _currentTheme.value = theme
  // #ifdef H5
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme')
    } else {
      document.documentElement.classList.remove('dark-theme')
    }
  }
  // #endif
}

// 切换主题
export function setTheme(theme) {
  uni.setStorageSync(THEME_KEY, theme)
  uni.setStorageSync(SYSTEM_THEME_KEY, false)
  applyTheme(theme)
}

// 设置是否跟随系统
export function setFollowSystem(follow) {
  uni.setStorageSync(SYSTEM_THEME_KEY, follow)
  if (follow) {
    const systemInfo = uni.getSystemInfoSync()
    const theme = systemInfo.theme === 'dark' ? 'dark' : 'light'
    applyTheme(theme)
  }
}

// 检查是否跟随系统
export function isFollowSystem() {
  try {
    return uni.getStorageSync(SYSTEM_THEME_KEY) !== false
  } catch (e) {
    return true
  }
}

// 获取当前主题
export function getCurrentTheme() {
  return _currentTheme.value
}

// 全局共享的 themeClass（所有页面共用）
export const themeClass = computed(() => _currentTheme.value === 'dark' ? 'dark-theme' : '')

// 初始化主题（在 App.vue onLaunch 中调用）
export function initTheme() {
  const theme = getSavedTheme()
  applyTheme(theme)
  return theme
}
