<template>
  <view class="page" :class="themeClass">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <header class="top-bar">
      <button class="back-btn" @click="goBack"><text>←</text></button>
      <text class="top-title">方案详情</text>
      <view class="top-spacer"></view>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false">
      <view class="hero-section" v-if="plan.cover">
        <image class="hero-img" :src="plan.cover" mode="aspectFill" />
        <view class="hero-mask"></view>
        <view class="hero-content">
          <text class="hero-title">{{ plan.title || '精选旅行方案' }}</text>
          <view class="hero-meta" v-if="!hideSocial">
            <text v-if="plan.author" class="hero-author">👤 {{ plan.author }}</text>
            <text v-if="plan.likes" class="hero-likes">❤ {{ plan.likes }}</text>
          </view>
        </view>
      </view>

      <view v-else class="hero-section hero-fallback">
        <view class="hero-content">
          <text class="hero-title">{{ plan.title || '精选旅行方案' }}</text>
          <view class="hero-meta" v-if="!hideSocial">
            <text v-if="plan.author" class="hero-author">👤 {{ plan.author }}</text>
            <text v-if="plan.likes" class="hero-likes">❤ {{ plan.likes }}</text>
          </view>
        </view>
      </view>

      <view class="content-card">
        <text class="section-overline">旅行记录</text>
        <view class="plan-meta-row">
          <view class="meta-item">
            <text class="meta-label">创建时间</text>
            <text class="meta-value">{{ formatDate(plan.createdAt) || '最近更新' }}</text>
          </view>
        </view>

        <view v-if="plan.userInput" class="user-input">
          <text class="user-input-text">{{ plan.userInput }}</text>
        </view>

        <view v-if="plan.itinerarySummary" class="summary-block">
          <view class="sheet-section-label">行程摘要</view>
          <text class="summary-text">{{ plan.itinerarySummary }}</text>
        </view>

        <view v-if="hasItinerary" class="plan-block">
          <view class="sheet-section-label">行程计划</view>
          <view v-if="useNestedDay">
            <view v-for="(day, di) in plan.dayPlan" :key="di">
              <view class="day-group-header">Day {{ di + 1 }}</view>
              <view v-if="Array.isArray(day.items) && day.items.length > 0">
                <view v-for="(loc, li) in day.items" :key="li" class="plan-loc-card">
                  <view class="loc-badge">{{ li + 1 }}</view>
                  <view class="loc-content">
                    <text class="loc-name">{{ loc.name || loc.title || '未知地点' }}</text>
                    <text class="loc-time" v-if="loc.time">🕐 {{ loc.time }}</text>
                    <text class="loc-desc" v-if="loc.description">{{ loc.description }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
          <view v-else>
            <view v-for="(loc, i) in normalizedItems" :key="i" class="plan-loc-card">
              <view class="loc-badge">{{ i + 1 }}</view>
              <view class="loc-content">
                <text class="loc-name">{{ loc.name || loc.title || '未知地点' }}</text>
                <text class="loc-time" v-if="loc.time">🕐 {{ loc.time }}</text>
                <text class="loc-desc" v-if="loc.description">{{ loc.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="!hasItinerary && !plan.itinerarySummary" class="empty-hint">
          <text class="empty-icon">📋</text>
          <text class="empty-text">暂无详细行程</text>
        </view>
      </view>

      <view style="height: 180rpx;"></view>
    </scroll-view>

    <view class="footer-bar" :style="{ paddingBottom: (12 + safeAreaBottom) + 'px' }">
      <template v-if="!hideSocial">
        <button class="footer-btn secondary" @click="onToggleLike">
          <text>{{ plan.is_liked ? '❤' : '🤍' }} {{ plan.likes || 0 }}</text>
        </button>
        <button class="footer-btn secondary" @click="onFavorite">
          <text>{{ plan.is_favorite ? '📌' : '🔖' }} 收藏</text>
        </button>
      </template>
      <button class="footer-btn primary" :class="{ 'full-width': hideSocial }" @click="copyPlanToMine">
        <text>复制方案</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'
import { likePlan, toggleFavorite } from '@/api/history.js'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight, safeAreaBottom } = useSafeArea()

const plan = computed(() => travelStore.previewPlan || {})

// 判断是否隐藏社交元素（从灵感库进入时不显示点赞、收藏、作者信息）
const hideSocial = computed(() => {
  // 如果方案没有作者信息，说明是从灵感库加载的
  return !plan.value.author && !plan.value.likes
})

const useNestedDay = computed(() => {
  const dp = plan.value.dayPlan
  if (!Array.isArray(dp) || dp.length === 0) return false
  return dp.some(d => d && typeof d === 'object' && Array.isArray(d.items))
})

const hasItinerary = computed(() => {
  if (Array.isArray(plan.value.dayPlan) && plan.value.dayPlan.length > 0) {
    if (useNestedDay.value) {
      return plan.value.dayPlan.some(d => d && d.items && d.items.length > 0)
    }
    return true
  }
  if (Array.isArray(plan.value.items) && plan.value.items.length > 0) return true
  return false
})

const normalizedItems = computed(() => {
  const dp = plan.value.dayPlan
  if (!dp) return plan.value.items || []
  if (Array.isArray(dp)) {
    return dp.flatMap(d => Array.isArray(d.items) ? d.items : (Array.isArray(d) ? d : []))
  }
  if (typeof dp === 'object') {
    return Object.values(dp).flat().filter(Boolean)
  }
  return []
})

const formatDate = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const goBack = () => uni.navigateBack()

const copyPlanToMine = () => {
  const p = plan.value
  let dayPlanItinerary = []
  if (Array.isArray(p.dayPlan) && p.dayPlan.length > 0) {
    p.dayPlan.forEach((day, di) => {
      const items = Array.isArray(day.items) ? day.items : (Array.isArray(day) ? day : [])
      items.forEach((loc, i) => {
        dayPlanItinerary.push({
          ...loc,
          day: day.day || (di + 1),
          sequence: loc.sequence ?? (i + 1),
          name: loc.name || loc.title || '',
          time: loc.time,
          lat: loc.lat,
          lng: loc.lng,
          description: loc.description,
          city: loc.city || ''
        })
      })
    })
  } else if (Array.isArray(p.items)) {
    dayPlanItinerary = p.items.map((item, i) => ({ ...item, day: 1, sequence: i + 1, name: item.name || item.title }))
  }

  travelStore.previewPlan = null  // 清掉旧方案
  travelStore.currentPlan = {
    itinerarySummary: p.itinerarySummary || p.title || '精选旅行方案',
    dayPlanItinerary,
    socialRecommendations: p.socialRecommendations || [],
    evidence: p.evidence || [],
    warnings: p.warnings || [],
    // 保留原方案的 category（旅行风格）到 currentPlan，让保存页能取到
    category: p.category || travelStore.preferences?.travelMode || 'city',
    isFromHistory: true,
    historyId: p.id
  }

  if (p.userInput) {
    travelStore.preferences.userInput = p.userInput
  }

  uni.reLaunch({ url: '/pages/index/index' })
}

const onFavorite = async () => {
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 800)
    return
  }
  const p = plan.value
  if (!p.id) return
  try {
    const is_favorite = await toggleFavorite(p.id)
    p.is_favorite = !!is_favorite
    uni.showToast({ title: is_favorite ? '已收藏' : '已取消收藏', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  }
}

const onToggleLike = async () => {
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 800)
    return
  }
  const p = plan.value
  if (!p.id) return
  const wasLiked = p.is_liked
  const oldLikes = p.likes || 0
  p.is_liked = !wasLiked
  p.likes = oldLikes + (wasLiked ? -1 : 1)
  try {
    const res = await likePlan(p.id)
    p.is_liked = res.is_liked
    p.likes = res.likes
  } catch (e) {
    p.is_liked = wasLiked
    p.likes = oldLikes
    uni.showToast({ title: e.message || '点赞失败', icon: 'none' })
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--color-background);
  display: flex; flex-direction: column;
}

.status-bar { background: var(--color-background); }

.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 80rpx 40rpx 16rpx;
  background: var(--color-background);
  position: relative;
}
.back-btn {
  width: 64rpx; height: 64rpx; border-radius: 50%;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  display: flex; align-items: center; justify-content: center;
  border: none; padding: 0; font-size: 32rpx; color: var(--color-on-surface);
}
.back-btn::after { border: none; }
.back-btn:active { opacity: 0.7; }
.top-title {
  font-size: 32rpx; font-weight: 600; color: var(--color-on-surface);
  position: absolute; left: 50%; transform: translateX(-50%);
}
.top-spacer { width: 64rpx; }

.content {
  flex: 1;
  padding: 0 0 24rpx;
}

.hero-section {
  position: relative;
  height: 360rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}
.hero-fallback {
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  display: flex; align-items: flex-end;
}
.hero-img {
  width: 100%; height: 100%; display: block;
}
.hero-mask {
  position: absolute; left: 0; right: 0; bottom: 0; top: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%);
}
.hero-content {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 24rpx 40rpx 32rpx;
  z-index: 2;
}
.hero-title {
  display: block;
  font-size: 36rpx; font-weight: 700; color: #FFFFFF;
  letter-spacing: -0.01em; line-height: 1.3;
  margin-bottom: 12rpx;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
.hero-meta { display: flex; gap: 24rpx; }
.hero-author, .hero-likes {
  font-size: 22rpx; color: rgba(255,255,255,0.9);
  letter-spacing: 0.02em;
}

.content-card {
  margin: 0 32rpx;
  background: var(--color-surface-container-lowest);
  border-radius: 24rpx;
  padding: 32rpx 32rpx 40rpx;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.section-overline {
  display: block;
  font-size: 20rpx; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
  margin-bottom: 16rpx;
}

.plan-meta-row { margin-bottom: 24rpx; }
.meta-item { display: flex; align-items: center; gap: 12rpx; }
.meta-label {
  font-size: 22rpx; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
}
.meta-value { font-size: 26rpx; font-weight: 500; color: var(--color-on-surface); }

.user-input {
  background: var(--color-surface-container-low);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 32rpx;
  border-left: 4rpx solid var(--color-primary);
}
.user-input-text {
  font-size: 26rpx; line-height: 1.6; color: var(--color-on-surface-variant);
  display: block;
}

.summary-block { margin-bottom: 32rpx; }
.summary-text {
  font-size: 26rpx; line-height: 1.7; color: var(--color-on-surface);
  background: var(--color-surface-container-low);
  border-radius: 16rpx; padding: 24rpx; display: block;
}

.sheet-section-label {
  font-size: 20rpx; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
  margin-bottom: 16rpx;
}

.plan-block { margin-top: 8rpx; }

.day-group-header {
  font-size: 28rpx; font-weight: 700; color: var(--color-primary);
  padding: 16rpx 0 12rpx; margin-top: 16rpx;
  border-top: 2rpx dashed var(--color-outline-variant); opacity: 0.85;
}
.day-group-header:first-child { border-top: none; margin-top: 0; padding-top: 0; }

.plan-loc-card {
  display: flex; gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(198,197,212,0.12);
}
.plan-loc-card:last-child { border-bottom: none; }
.loc-badge {
  width: 48rpx; height: 48rpx; border-radius: 50%; flex-shrink: 0;
  background: var(--color-primary-fixed); color: var(--color-on-primary-fixed);
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx; font-weight: 700; margin-top: 4rpx;
}
.loc-content { flex: 1; }
.loc-name {
  font-size: 28rpx; font-weight: 600; color: var(--color-on-surface);
  display: block; line-height: 1.4;
}
.loc-time {
  font-size: 22rpx; color: var(--color-on-surface-variant);
  margin: 6rpx 0; display: block;
}
.loc-desc {
  font-size: 24rpx; color: var(--color-outline); line-height: 1.5;
  margin-top: 4rpx; display: block;
}

.empty-hint {
  display: flex; flex-direction: column; align-items: center; gap: 12rpx;
  padding: 60rpx 0;
}
.empty-icon { font-size: 56rpx; }
.empty-text { font-size: 26rpx; color: var(--color-on-surface-variant); }

.footer-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  display: flex; gap: 20rpx;
  padding: 20rpx 32rpx 0;
  background: rgba(248,249,250,0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(198,197,212,0.1);
  z-index: 10;
}
.footer-btn {
  flex: 1; height: 88rpx; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 30rpx; font-weight: 600;
  border: none; padding: 0;
}
.footer-btn::after { border: none; }
.footer-btn.primary {
  flex: 2;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  color: #FFFFFF;
  box-shadow: 0 8rpx 24rpx rgba(15,76,92,0.2);
}
.footer-btn.primary:active { transform: scale(0.98); }
.footer-btn.secondary {
  background: rgba(255,255,255,0.7);
  border: 1rpx solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}
.footer-btn.secondary:active { transform: scale(0.98); }
.footer-btn.full-width { flex: 3; }
</style>
