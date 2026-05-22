<template>
  <view class="history-page" :class="themeClass">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <header class="top-bar">
      <button class="back-btn" @click="goBack"><text>←</text></button>
      <text class="top-brand">慧游</text>
      <view class="top-spacer"></view>
    </header>

    <scroll-view scroll-y class="content">
      <view v-if="historyList.length === 0" class="empty-state">
        <view class="empty-icon-wrap"><text class="empty-icon">📭</text></view>
        <text class="empty-title">暂无历史记录</text>
        <text class="empty-desc">你的旅行方案将显示在这里</text>
      </view>

      <view class="history-section" v-else>
        <text class="section-overline">旅行记录</text>
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
              <view class="history-tag">{{ item.model_type || 'AI' }}</view>
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
    </scroll-view>

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
            <view class="sheet-meta-item">
              <text class="meta-label">模型</text>
              <text class="meta-value">{{ selectedDetail.model_type || 'N/A' }}</text>
            </view>
            <view class="sheet-meta-item">
              <text class="meta-label">提供商</text>
              <text class="meta-value">{{ selectedDetail.provider || 'N/A' }}</text>
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
const { statusBarHeight } = useSafeArea()

const historyList = ref([])
const showDetailPopup = ref(false)
const selectedDetail = ref({})

const getPreviewText = (item) => {
  const text = item.itinerary_summary || item.user_input || item.summary || '未命名行程'
  return text.substring(0, 50) + (text.length > 50 ? '...' : '')
}

const goBack = () => uni.reLaunch({ url: '/pages/index/index' })

onMounted(() => {
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    uni.redirectTo({ url: '/pages/login/index' })
    return
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
  uni.navigateTo({ url: '/pages/plan/plan' })
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
            dayPlanItinerary.push({
              ...loc, day: parseInt(dayKey), sequence: loc.sequence ?? (i + 1),
              name: loc.name || loc.title || '', time: loc.time,
              lat: loc.lat, lng: loc.lng, description: loc.description, city: loc.city || ''
            })
          })
        }
      }
    } else if (Array.isArray(selectedDetail.value.day_plan)) {
      dayPlanItinerary = selectedDetail.value.day_plan.map((item, i) => ({
        ...item, day: item.day || 1, sequence: item.sequence || (i + 1), name: item.name || item.title, city: item.city
      }))
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
  uni.navigateTo({ url: '/pages/plan/plan' })
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

const loadHistoryList = async () => {
  try {
    const data = await getHistoryList(1, 50, false)
    historyList.value = data?.list || []
  } catch {
    try {
      const local = JSON.parse(uni.getStorageSync('travel_history') || '[]')
      historyList.value = local
    } catch { historyList.value = [] }
  }
}
</script>

<style scoped>
.history-page { min-height: 100vh; background: var(--color-surface); }
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px 8px;
  background: rgba(248,249,250,0.8); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(198,197,212,0.3);
  position: sticky; top: 0; z-index: 10;
}
.back-btn {
  width: 40px; height: 40px; display: flex; align-items: center;
  justify-content: center; font-size: 20px; color: var(--color-primary);
  margin-left: -4px;
}
.top-brand {
  font-size: 24px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.01em; line-height: 32px;
}
.top-spacer { width: 40px; }

.content { padding: 8px 20px 120px; }

.section-overline {
  display: block;
  font-size: 11px; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
  margin-bottom: 12px; padding-left: 4px;
}

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 80px 20px; gap: 12px; }
.empty-icon-wrap {
  width: 80px; height: 80px; border-radius: 50%;
  background: var(--color-surface-container-low);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
.empty-icon { font-size: 36px; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--color-on-surface); }
.empty-desc { font-size: 14px; color: var(--color-outline); margin-top: 4px; }

.history-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px; margin-bottom: 12px;
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
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  color: #fff; font-size: 12px; font-weight: 600;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 12px rgba(0,6,102,0.18);
}
.action-load:active { transform: scale(0.95); }
.action-delete {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--color-surface-container-low);
  border: 1px solid rgba(198,197,212,0.3);
  display: flex; align-items: center; justify-content: center;
}
.del-icon { font-size: 16px; opacity: 0.6; }

.sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(6px);
  display: flex; align-items: flex-end;
}
.sheet-container {
  width: 100%; max-height: 82vh;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border-radius: 32px 32px 0 0;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.08);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.sheet-handle {
  width: 36px; height: 5px; border-radius: 999px;
  background: var(--color-outline-variant); opacity: 0.5;
  align-self: center; margin: 12px auto 4px;
}
.sheet-header {
  padding: 16px 24px 20px;
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  color: #fff;
}
.sheet-title {
  font-size: 22px; font-weight: 700; line-height: 28px;
  letter-spacing: -0.01em; margin-bottom: 16px;
}
.sheet-header-meta {
  display: flex; gap: 24px;
}
.sheet-meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; opacity: 0.6;
}
.meta-value { font-size: 13px; font-weight: 500; }
.sheet-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.sheet-section-label {
  font-size: 11px; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
  margin-bottom: 12px;
}
.sheet-summary { margin-bottom: 20px; }
.summary-text {
  font-size: 14px; line-height: 1.7; color: var(--color-on-surface);
  background: var(--color-surface-container-low);
  border-radius: 12px; padding: 16px;
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
  padding: 16px 24px 28px;
  border-top: 1px solid rgba(198,197,212,0.1);
}
.sheet-btn {
  flex: 1; height: 50px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 600;
}
.sheet-btn-primary {
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  color: #fff; box-shadow: 0 8px 24px rgba(0,6,102,0.2);
}
.sheet-btn-primary:active { transform: scale(0.97); }
.sheet-btn-secondary {
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.5);
  color: var(--color-on-surface-variant);
}
.sheet-btn-secondary:active { transform: scale(0.97); }
</style>
