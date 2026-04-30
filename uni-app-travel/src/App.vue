<template>
  <view class="app">
    <slot />
  </view>
</template>

<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useUserStore } from './store/user.js'

// 添加更多的公共无需登录页面到白名单
const whiteList = [
  '/pages/login/index',
  '/pages/index/index',  // 公共主页一般不需要登录
]

onLaunch(() => {
  console.log('App Launch')
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
  background-color: var(--bg-base);
  font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
