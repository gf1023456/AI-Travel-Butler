<template>
  <nav class="bottom-nav-wrapper">
    <view class="bottom-nav">
      <button
        :class="['nav-item', { 'nav-active': active === 'index' }]"
        @click="goTo('index')"
      >
        <image
          src="/static/icons/index.svg"
          style="width:24px;height:24px;"
          mode="aspectFit"
        />
        <text class="nav-label">首页</text>
      </button>
      <button
        :class="['nav-item', { 'nav-active': active === 'explore' }]"
        @click="goTo('explore')"
      >
        <image
          :src="active === 'explore' ? '/static/icons/tansuo-active.svg' : '/static/icons/tansuo.svg'"
          style="width:24px;height:24px;"
          mode="aspectFit"
        />
        <text class="nav-label">探索</text>
      </button>
      <button
        :class="['nav-item', { 'nav-active': active === 'plan' }]"
        @click="goTo('plan')"
      >
        <image
          src="/static/icons/hangcheng.svg"
          style="width:24px;height:24px;"
          mode="aspectFit"
        />
        <text class="nav-label">行程</text>
      </button>
      <button
        :class="['nav-item', { 'nav-active': active === 'mine' }]"
        @click="goTo('mine')"
      >
        <image
          src="/static/icons/wodedefuben.svg"
          style="width:24px;height:24px;"
          mode="aspectFit"
        />
        <text class="nav-label">我的</text>
      </button>
    </view>
  </nav>
</template>

<script setup>
const props = defineProps({
  active: {
    type: String,
    default: '',
    validator: (val) => ['', 'index', 'explore', 'plan', 'mine'].includes(val)
  }
})

const goTo = (page) => {
  const routes = {
    index: '/pages/index/index',
    explore: '/pages/explore/index',
    plan: '/pages/plan/plan',
    mine: '/pages/mine/index'
  }
  if (routes[page]) {
    uni.reLaunch({ url: routes[page] })
  }
}
</script>

<style scoped>
.bottom-nav-wrapper {
  position: fixed;
  bottom: 24px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
  pointer-events: none;
}

.bottom-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: 999px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  pointer-events: auto;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 20px;
  min-width: 68px;
  border-radius: 999px;
  background: transparent;
  border: none;
  transition: all 0.25s ease;
}

.nav-item::after {
  border: none;
}

.nav-item:active {
  transform: scale(0.95);
}

.nav-active {
  background: var(--color-primary);
  box-shadow: 0 4px 16px rgba(15,76,92,0.25);
}

.nav-item image {
  opacity: 0.5;
  transition: opacity 0.25s ease;
}

.nav-active image {
  opacity: 1;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  line-height: 1;
  transition: color 0.25s ease;
}

.nav-active .nav-label {
  color: var(--color-on-primary);
  font-weight: 600;
}
</style>
