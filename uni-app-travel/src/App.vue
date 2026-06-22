<template>
  <view class="app">
    <slot />
  </view>
</template>

<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useUserStore } from './store/user.js'
import { initTheme } from './utils/theme.js'
import { getQuota } from './api/quota.js'

// 添加更多的公共无需登录页面到白名单
const whiteList = [
  '/pages/login/index',
  '/pages/inspiration/index',  // 灵感页（首页）无需登录
  '/pages/inspiration/index',       // 灵感页无需登录
]

onLaunch(() => {
  const systemInfo = uni.getSystemInfoSync()
  uni.$systemInfo = systemInfo

  // 初始化主题
  initTheme()

  // #ifdef H5
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const safeAreaBottom = Math.max(0, systemInfo.screenHeight - (systemInfo.safeArea?.bottom || systemInfo.screenHeight))
      document.documentElement.style.setProperty('--status-bar-height', systemInfo.statusBarHeight + 'px')
      document.documentElement.style.setProperty('--safe-area-bottom', safeAreaBottom + 'px')
    }
  } catch (e) { /* ignore */ }
  // #endif

  // 捕获分享带来的邀请码
  captureInviteCode()
})

onShow(() => {
  checkAuth()
  // 已登录用户：从后台返回时刷新配额（可能刚被新用户使用了邀请码）
  const userStore = useUserStore()
  userStore.restoreFromStorage()
  if (userStore.hasToken) {
    console.log('[App] onShow 检测到已登录,开始刷新 quota')
    getQuota().then((quota) => {
      if (quota) {
        userStore.setQuota(quota)
        console.log('[App] 配额已刷新:', JSON.stringify(quota))
      }
    }).catch((e) => console.warn('[App] 配额刷新失败:', e))
  } else {
    console.log('[App] onShow 未登录,跳过 quota 刷新')
  }
})

// 捕获页面参数中的邀请码
const captureInviteCode = () => {
  try {
    const pages = getCurrentPages()
    if (pages.length === 0) return
    const page = pages[pages.length - 1]
    const options = page.$page?.options || page.options || {}
    const inviteCode = options.invite
    if (inviteCode) {
      const userStore = useUserStore()
      userStore.inviteCode = inviteCode
      console.log('[App] 捕获到邀请码:', inviteCode)
    }
  } catch (e) {
    console.warn('[App] 捕获邀请码失败:', e)
  }
}

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
