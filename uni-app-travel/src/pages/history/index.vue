<template>
  <view class="history-page" :class="themeClass">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <header class="top-bar">
      <button class="back-btn" @click="goBack"><text>←</text></button>
      <text class="top-brand">行程一下</text>
      <view class="top-spacer"></view>
    </header>

    <scroll-view
      scroll-y
      class="content"
      :scroll-top="scrollTop"
      :scroll-with-animation="true"
      @scrolltolower="onScrollToLower"
      @scroll="onScroll"
    >
      <EmptyState
        v-if="!initialLoading && historyList.length === 0"
        :icon="favoriteOnly ? '📌' : '📭'"
        :title="favoriteOnly ? '还没有收藏' : '暂无历史记录'"
        :description="favoriteOnly ? '在方案详情页点击收藏，就能在这里看到啦' : '你的旅行方案将显示在这里'"
      />

      <view class="history-section" v-else>
        <text class="section-overline">{{ favoriteOnly ? '收藏列表' : '旅行记录' }}</text>
        <view
          v-for="item in historyList"
          :key="item.id"
          class="history-card"
          @click="showDetails(item)"
        >
          <view class="history-info">
            <view class="history-meta">
              <view class="meta-left">
                <text class="history-time">{{ formatDate(item.created_at || item.timestamp) }}</text>
                <view v-if="item.is_favorite" class="fav-badge"><text>⭐</text></view>
              </view>
              <view class="history-tag">{{ item.model_type || '标准' }}</view>
            </view>
            <text class="history-preview">{{ getPreviewText(item) }}</text>
          </view>
          <view class="history-actions">
            <button class="action-load" @click.stop="loadHistory(item)">载入</button>
            <button class="action-delete" @click.stop="deleteHistory(item.id)">
              <text class="del-icon">🗑️</text>
            </button>
          </view>
        </view>
      </view>

      <!-- 加载更多 / 已到底 -->
      <view v-if="loadingMore" class="loading-hint">
        <text>加载中…</text>
      </view>
      <view v-else-if="!hasMore && historyList.length > 0" class="loading-hint">
        <text>— 已经到底啦 —</text>
      </view>
    </scroll-view>

    <!-- 返回顶部 -->
    <view v-if="showBackTop" class="back-top" :style="{ bottom: (40 + safeAreaBottom) + 'px' }" @click="scrollToTop">
      <text>↑</text>
    </view>

    <!-- Detail Bottom Sheet -->
    <view v-if="showDetailPopup" class="sheet-overlay" @click="closeDetailPopup">
      <view class="sheet-container" @click.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-header">
          <text class="sheet-title">{{ selectedDetail.itinerary_summary?.substring(0, 24) || '行程详情' }}</text>
          <view class="sheet-header-meta">
            <view class="sheet-meta-item">
              <text class="meta-label">创建时间</text>
              <text class="meta-value">{{ formatDate(selectedDetail.created_at) }}</text>
            </view>
          </view>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view v-if="selectedDetail.itinerary_summary" class="sheet-summary">
            <view class="sheet-section-label">行程摘要</view>
            <text class="summary-text">{{ selectedDetail.itinerary_summary.substring(0, 500) }}</text>
          </view>
          <view v-if="selectedDetail.day_plan" class="sheet-plan">
            <view class="sheet-section-label">行程计划</view>
            <view v-if="Array.isArray(selectedDetail.day_plan)">
              <view v-for="(loc, i) in selectedDetail.day_plan" :key="i" class="plan-loc-card">
                <view class="loc-badge">{{ i + 1 }}</view>
                <view class="loc-content">
                  <text class="loc-name">{{ loc.name || loc.title || '未知地点' }}</text>
                  <text class="loc-time" v-if="loc.time">{{ loc.time }}</text>
                  <text class="loc-desc" v-if="loc.description">{{ loc.description }}</text>
                </view>
              </view>
            </view>
            <view v-else>
              <view v-for="(locs, dayKey) in selectedDetail.day_plan" :key="dayKey">
                <view v-if="Array.isArray(locs)">
                  <view class="day-group-header">Day {{ dayKey }}</view>
                  <view v-for="(loc, i) in locs" :key="i" class="plan-loc-card">
                    <view class="loc-badge">{{ i + 1 }}</view>
                    <view class="loc-content">
                      <text class="loc-name">{{ loc.name || loc.title || '未知地点' }}</text>
                      <text class="loc-time" v-if="loc.time">{{ loc.time }}</text>
                      <text class="loc-desc" v-if="loc.description">{{ loc.description }}</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="sheet-footer">
          <button class="sheet-btn sheet-btn-primary" @click="loadDetailToPlan">载入此方案</button>
          <button class="sheet-btn sheet-btn-secondary" @click="closeDetailPopup">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { getHistoryList, deleteHistory as deleteHistoryApi, getHistoryDetail } from '@/api/history.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight, safeAreaBottom } = useSafeArea()

// 返回顶部
const scrollTop = ref(0)
const showBackTop = ref(false)
const onScroll = (e) => {
  const top = e?.detail?.scrollTop || 0
  showBackTop.value = top > 400
}
const scrollToTop = () => {
  scrollTop.value = 0
  setTimeout(() => { scrollTop.value = 1 }, 0)
  setTimeout(() => { scrollTop.value = 0 }, 50)
}

const historyList = ref([])
const showDetailPopup = ref(false)
const selectedDetail = ref({})

const getPreviewText = (item) => {
  const text = item.itinerary_summary || item.user_input || item.summary || '未命名行程'
  return text.substring(0, 50) + (text.length > 50 ? '...' : '')
}

const goBack = () => uni.reLaunch({ url: '/pages/index/index' })

// 收藏模式开关（从 URL ?favoriteOnly=1 进入时开启）
const favoriteOnly = ref(false)

// 分页状态
const pageNum = ref(1)
const pageSize = 10
const hasMore = ref(true)
const loadingMore = ref(false)
const initialLoading = ref(false)

onMounted(() => {
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    uni.redirectTo({ url: '/pages/login/index' })
    return
  }

  // 读取路由 query（在 onMounted 时页面已入栈，能拿到 options）
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1]
    const opts = cur && cur.options ? cur.options : {}
    console.log('[history] onMounted options =', opts)
    if (opts.favoriteOnly && (opts.favoriteOnly === '1' || opts.favoriteOnly === 1 || opts.favoriteOnly === true)) {
      favoriteOnly.value = true
      uni.setNavigationBarTitle({ title: '我的收藏' })
    }
  } catch (e) {
    console.warn('[history] 读 query 失败:', e)
  }

  loadHistoryList()
})

const loadHistory = async (item) => {
  uni.showLoading({ title: '加载中...' })
  let sourceItem = item
  if (!item.day_plan) {
    try {
      const detail = await getHistoryDetail(item.id)
      if (detail?.id) sourceItem = detail
    } catch (e) { /* ignore */ }
  }

  let dayPlanItinerary = []
  if (Array.isArray(sourceItem.day_plan)) {
    dayPlanItinerary = sourceItem.day_plan.map((loc, i) => ({ ...loc, sequence: loc.sequence ?? (i + 1) }))
  } else if (sourceItem.day_plan && typeof sourceItem.day_plan === 'object') {
    for (const dayKey in sourceItem.day_plan) {
      const items = sourceItem.day_plan[dayKey]
      if (Array.isArray(items)) {
        items.forEach((loc, i) => {
          dayPlanItinerary.push({ ...loc, day: parseInt(dayKey), sequence: loc.sequence ?? (i + 1) })
        })
      }
    }
  }

  uni.hideLoading()
  travelStore.currentPlan = {
    itinerarySummary: sourceItem.itinerary_summary || sourceItem.summary || '',
    dayPlanItinerary,
    socialRecommendations: sourceItem.social_recommendations || [],
    evidence: sourceItem.evidence || [],
    warnings: sourceItem.warnings || [],
    isFromHistory: true,
    historyId: sourceItem.id
  }
  uni.reLaunch({ url: '/pages/index/index' })
}

const showDetails = async (item) => {
  try {
    uni.showLoading({ title: '加载中...' })
    const detail = await getHistoryDetail(item.id)
    uni.hideLoading()
    selectedDetail.value = detail?.id ? detail : item
    showDetailPopup.value = true
  } catch {
    uni.hideLoading()
    selectedDetail.value = item
    showDetailPopup.value = true
  }
}

const closeDetailPopup = () => { showDetailPopup.value = false }

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      const d = new Date(dateStr)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    return dateStr
  } catch { return dateStr }
}

const loadDetailToPlan = () => {
  if (!selectedDetail.value) return
  let dayPlanItinerary = []
  if (selectedDetail.value.day_plan) {
    if (typeof selectedDetail.value.day_plan === 'object' && !Array.isArray(selectedDetail.value.day_plan)) {
      for (const dayKey in selectedDetail.value.day_plan) {
        const items = selectedDetail.value.day_plan[dayKey]
        if (Array.isArray(items)) {
          items.forEach((loc, i) => {
            dayPlanItinerary.push({ ...loc, day: parseInt(dayKey), sequence: loc.sequence ?? (i + 1), name: loc.name || loc.title || '', time: loc.time, lat: loc.lat, lng: loc.lng, description: loc.description, city: loc.city || '' })
          })
        }
      }
    } else if (Array.isArray(selectedDetail.value.day_plan)) {
      dayPlanItinerary = selectedDetail.value.day_plan.map((item, i) => ({ ...item, day: item.day || 1, sequence: item.sequence || (i + 1), name: item.name || item.title, city: item.city }))
    }
  }
  travelStore.currentPlan = {
    itinerarySummary: selectedDetail.value.itinerary_summary || selectedDetail.value.summary || '行程详情',
    dayPlanItinerary,
    socialRecommendations: selectedDetail.value.social_recommendations || [],
    evidence: selectedDetail.value.evidence || [],
    warnings: selectedDetail.value.warnings || [],
    isFromHistory: true,
    historyId: selectedDetail.value.id
  }
  uni.reLaunch({ url: '/pages/index/index' })
  closeDetailPopup()
}

const deleteHistory = (id) => {
  uni.showModal({
    title: '确认删除', content: '确定删除这条记录？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteHistoryApi(id)
          uni.showToast({ title: '已删除', icon: 'success' })
          loadHistoryList()
        } catch {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const loadHistoryList = async (append = false) => {
  if (append) {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  } else {
    initialLoading.value = true
    pageNum.value = 1
    hasMore.value = true
  }
  try {
    const data = await getHistoryList(pageNum.value, pageSize, favoriteOnly.value)
    const list = data?.list || []
    if (append) {
      // 追加前去重（防后端重复返回）
      const existing = new Set(historyList.value.map(x => x.id))
      historyList.value = historyList.value.concat(list.filter(x => !existing.has(x.id)))
    } else {
      historyList.value = list
    }
    hasMore.value = list.length >= pageSize
  } catch {
    if (!append) {
      try {
        const local = JSON.parse(uni.getStorageSync('travel_history') || '[]')
        historyList.value = favoriteOnly.value ? local.filter(p => p.is_favorite) : local
      } catch { historyList.value = [] }
    }
  } finally {
    initialLoading.value = false
    loadingMore.value = false
  }
}

// 加载下一页
const onScrollToLower = () => {
  if (hasMore.value && !loadingMore.value && !initialLoading.value) {
    pageNum.value += 1
    loadHistoryList(true)
  }
}
</script>

<style scoped>
.history-page { min-height: 100vh; background: #f8f9fa; }

.status-bar { width: 100%; background: rgba(255,255,255,0.7); }

.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16rpx 40rpx;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
  position: sticky; top: 0; z-index: 10;
}
.back-btn {
  width: 36px; height: 36px; display: flex; align-items: center;
  justify-content: center; font-size: 20px; color: var(--color-primary);
  background: transparent; border: none; padding: 0;
}
.back-btn::after { border: none; }
.top-brand { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; line-height: 32px; }
.top-spacer { width: 36px; }

.content { padding: 16rpx 40rpx 80rpx; }

.loading-hint {
  display: flex; justify-content: center; align-items: center;
  padding: 32rpx 0; color: var(--color-on-surface-variant, #666);
  font-size: 12px; opacity: 0.7;
}

.back-top {
  position: fixed; right: 32rpx; z-index: 20;
  width: 80rpx; height: 80rpx; border-radius: 50%;
  background: linear-gradient(135deg, #0F4C5C, #14B8A6);
  color: #fff; font-size: 36rpx; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(15,76,92,0.30);
  transition: opacity 0.2s, transform 0.2s;
}
.back-top:active { transform: scale(0.92); }

.section-overline {
  display: block;
  font-size: 11px; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
  margin-bottom: 12px;
}

.history-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 40rpx; margin-bottom: 12px;
  background: rgba(255,255,255,0.65); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 24px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.02);
  transition: all var(--transition-fast);
}
.history-card:active { transform: scale(0.97); }
.history-info { flex: 1; min-width: 0; }
.history-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.meta-left { display: flex; align-items: center; gap: 6px; }
.history-time { font-size: 11px; font-weight: 600; color: var(--color-outline); letter-spacing: 0.05em; text-transform: uppercase; }
.fav-badge text { font-size: 14px; }
.history-tag {
  font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
  padding: 2px 10px; border-radius: 999px;
  background: var(--color-primary-fixed); color: var(--color-primary);
}
.history-preview {
  font-size: 14px; color: var(--color-on-surface-variant);
  line-height: 1.5; font-weight: 500; display: block;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.history-actions { display: flex; align-items: center; gap: 8px; margin-left: 12px; }
.action-load {
  padding: 8px 16px; border-radius: 999px;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  color: #fff; font-size: 12px; font-weight: 600;
  letter-spacing: 0.05em; line-height: 1.4;
  box-shadow: 0 4px 12px rgba(15,76,92,0.18);
  border: none;
}
.action-load::after { border: none; }
.action-load:active { transform: scale(0.95); }
.action-delete {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--color-surface-container-low);
  border: 1px solid rgba(198,197,212,0.3);
  display: flex; align-items: center; justify-content: center;
}
.action-delete::after { border: none; }
.del-icon { font-size: 16px; opacity: 0.6; }

.sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: flex-end;
}
.sheet-container {
  width: 100%; max-height: 80vh;
  background: #ffffff;
  border-radius: 32px 32px 0 0;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.sheet-handle {
  width: 36px; height: 5px;
  background: rgba(0,0,0,0.1);
  border-radius: 2.5px;
  margin: 12px auto;
  flex-shrink: 0;
}
.sheet-header {
  padding: 8px 24px 12px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.sheet-title {
  font-size: 22px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.01em; line-height: 28px;
}
.sheet-header-meta {
  display: flex; align-items: center; gap: 8px;
}
.sheet-meta-item { display: flex; align-items: center; gap: 8px; }
.meta-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
}
.meta-value { font-size: 13px; font-weight: 500; color: var(--color-on-surface); }

.sheet-body { flex: 1; overflow-y: auto; padding: 40rpx 48rpx; }
.sheet-section-label {
  font-size: 11px; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
  margin-bottom: 12px;
}
.sheet-summary { margin-bottom: 20px; }
.summary-text {
  font-size: 14px; line-height: 1.7; color: var(--color-on-surface);
  background: var(--color-surface-container-low);
  border-radius: 12px; padding: 16px; display: block;
}
.plan-loc-card {
  display: flex; gap: 12px;
  padding: 14px 0; border-bottom: 1px solid rgba(198,197,212,0.12);
}
.plan-loc-card:last-child { border-bottom: none; }
.loc-badge {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: var(--color-primary-fixed); color: var(--color-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; margin-top: 2px;
}
.loc-content { flex: 1; }
.loc-name { font-size: 15px; font-weight: 600; color: var(--color-on-surface); display: block; }
.loc-time { font-size: 12px; color: var(--color-on-surface-variant); margin: 4px 0; display: block; }
.loc-desc { font-size: 12px; color: var(--color-outline); line-height: 1.5; }
.day-group-header {
  font-size: 14px; font-weight: 700; color: var(--color-primary);
  padding: 12px 0 8px; margin-top: 8px;
  border-top: 2px dashed var(--color-outline-variant); opacity: 0.5;
}
.sheet-footer {
  display: flex; gap: 12px;
  padding: 32rpx 48rpx 56rpx;
  border-top: 1px solid rgba(198,197,212,0.1);
}
.sheet-btn {
  flex: 1; height: 50px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 600;
}
.sheet-btn-primary {
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  color: #fff; box-shadow: 0 8px 24px rgba(15,76,92,0.2);
}
.sheet-btn-primary:active { transform: scale(0.97); }
.sheet-btn-secondary {
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.5);
  color: var(--color-on-surface-variant);
}
.sheet-btn-secondary:active { transform: scale(0.97); }
</style>
