<template>
  <view class="app">
    <slot />
  </view>
</template>

<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useUserStore } from './store/user.js'
import { initTheme } from './utils/theme.js'

// 添加更多的公共无需登录页面到白名单
const whiteList = [
  '/pages/login/index',
  '/pages/index/index',  // 公共主页一般不需要登录
]

onLaunch(() => {
  const systemInfo = uni.getSystemInfoSync()
  uni.$systemInfo = systemInfo

  // 初始化主题
  initTheme()

  // 检查是否首次启动（未完成引导）
  const onboardingCompleted = uni.getStorageSync('onboarding_completed')
  if (!onboardingCompleted) {
    // 延迟跳转，避免与首页冲突
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/guide/index' })
    }, 100)
    return
  }

  // #ifdef H5
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const safeAreaBottom = Math.max(0, systemInfo.screenHeight - (systemInfo.safeArea?.bottom || systemInfo.screenHeight))
      document.documentElement.style.setProperty('--status-bar-height', systemInfo.statusBarHeight + 'px')
      document.documentElement.style.setProperty('--safe-area-bottom', safeAreaBottom + 'px')
    }
  } catch (e) { /* ignore */ }
  // #endif
})

onShow(() => {
  checkAuth()
})

const checkAuth = () => {
  // 恢复登录状态
  const userStore = useUserStore()
  userStore.restoreFromStorage()
  
  // 获取当前页面  
  const pages = getCurrentPages()
  if (pages.length === 0) return
  
  const currentPage = pages[pages.length - 1]
  const currentPath = '/' + currentPage.route
  
  console.log('[Auth] 当前页面:', currentPath, 'hasToken:', !!userStore.accessToken)
  
  // 白名单页面直接通过
  if (whiteList.includes(currentPath)) {
    console.log('[Auth] 白名单页面，跳过检查')
    return
  }
  
  // 检查是否已登录
  if (!userStore.hasToken) {
    console.log('[Auth] 未登录，跳转登录页')
    // 添加延迟以确保页面完全加载后再跳转
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 500)
  }
}
</script>

<style>
@import './static/common.css';

.app {
  width: 100%;
  min-height: 100vh;
}

page {
  background-color: var(--color-surface);
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
