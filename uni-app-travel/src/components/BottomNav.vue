<template>
  <nav class="bottom-nav" :style="{ bottom: (24 + safeAreaBottom) + 'px' }">
    <button
      v-for="item in navItems"
      :key="item.path"
      :class="['nav-item', currentItem === item.key ? 'nav-active' : '']"
      @click="navigateTo(item)"
    >
      <text class="nav-item-icon">{{ item.icon }}</text>
      <text class="nav-item-label">{{ item.label }}</text>
    </button>
  </nav>
</template>

<script setup>
import { useSafeArea } from '@/utils/safeArea.js'

const props = defineProps({
  currentItem: { type: String, default: 'explore' },
  explorePath: { type: String, default: '/pages/index/index' }
})

const { safeAreaBottom } = useSafeArea()

const baseItems = [
  { key: 'plan', icon: '📅', label: '行程', path: '/pages/plan/plan', method: 'navigateTo' },
  { key: 'mine', icon: '👤', label: '我的', path: '/pages/mine/index', method: 'reLaunch' }
]

const navItems = [
  { key: 'explore', icon: '🧭', label: '探索', path: props.explorePath, method: 'navigateTo' },
  ...baseItems
]

const navigateTo = (item) => {
  const pages = getCurrentPages()
  const currentRoute = '/' + pages[pages.length - 1].route
  if (currentRoute === item.path) return
  if (item.method === 'reLaunch') {
    uni.reLaunch({ url: item.path })
  } else {
    uni.navigateTo({ url: item.path })
  }
}
</script>

<style scoped>
.bottom-nav {
  position: fixed; left: 48rpx; right: 48rpx; z-index: 10;
  display: flex; align-items: center; justify-content: space-around;
  height: 72px; padding: 0 8px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 999px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 8px 24px; border-radius: 999px;
  color: var(--color-on-surface-variant); opacity: 0.6;
}
.nav-active {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container); opacity: 1;
  box-shadow: 0 4px 12px rgba(0,6,102,0.15);
}
.nav-item-icon { font-size: 22px; margin-bottom: 2px; }
.nav-item-label { font-size: 10px; font-weight: 700; letter-spacing: 0.02em; }
</style>
