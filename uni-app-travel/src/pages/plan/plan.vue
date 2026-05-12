<template>
  <view class="page-container">
    <!-- 行程面板 -->
    <view class="side-panel plan-panel panel-active">
      <view class="panel-header">
        <text class="panel-title">行程方案</text>
        <view class="header-actions">
          <view class="action-icon action-pill" @click="saveToHistory">
            <text class="action-glyph">存</text>
          </view>
          <view class="action-icon action-pill" @click="copyToClipboard">
            <text class="action-glyph">复</text>
          </view>
          <view class="action-icon action-pill" @click="exportToFile">
            <text class="action-glyph">导</text>
          </view>
          <view class="close-btn" @click="goBack">✕</view>
        </view>
      </view>
      
      <scroll-view scroll-y class="panel-body plan-body">
          <view v-if="!travelStore.currentPlan" class="empty-state">
            <view class="empty-icon"></view>
          <text class="empty-title">暂无行程</text>
          <text class="empty-desc">您还没有生成任何行程方案</text>
        </view>
        
        <view v-else class="plan-content">
          <!-- 行程摘要 -->
          <view class="summary-card">
            <text class="summary-text">{{ itinerarySummary }}</text>
          </view>
          
          <!-- 每日行程 -->
          <view class="days-container">
            <view
              v-for="(item, index) in sortedItinerary"
              :key="index"
              class="day-card"
              :style="{ borderLeftColor: getDayColor(item.day) }"
              @click="goMapWithItem(item)"
            >
              <view class="day-header">
                <view class="day-label" :style="{ background: getDayColor(item.day) }">
                  <text class="day-label-text">D{{ item.day }}</text>
                </view>
                <text class="time-label">{{ item.time }}</text>
              </view>
              <text class="place-name">{{ item.name }}</text>
              <text class="place-desc">{{ item.description }}</text>
              <view v-if="item.city || (item.weather_icon && item.temperature)" class="place-meta">
                <text v-if="item.city" class="meta-item">地点 · {{ item.city }}</text>
                <text v-if="item.weather_icon && item.temperature" class="meta-item">天气 · {{ item.weather_icon }} {{ item.temperature }}</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { saveHistory } from '@/api/history.js'

const travelStore = useTravelStore()

// 数据
const dayPlanItinerary = ref([])
const socialRecommendations = ref([])
const itinerarySummary = ref('')
const itineraryEvidence = ref([])
const verifierWarnings = ref([])

// 颜色
const DAY_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98FB98', '#DDA0DD', '#F0E68C', '#FF6347', '#BA55D3', '#9ACD32']

// 计算属性
const sortedItinerary = computed(() => [...dayPlanItinerary.value].sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence)))
const getDayColor = (day) => DAY_COLORS[(day - 1) % DAY_COLORS.length]

// 在页面加载时从store获取数据
onMounted(() => {
  if (travelStore.currentPlan) {
    loadPlanDataFromStore()
  } else {
    itinerarySummary.value = '暂无行程'
  }
})

// 从store加载数据
const loadPlanDataFromStore = () => {
  const plan = travelStore.currentPlan
  dayPlanItinerary.value = Array.isArray(plan.dayPlanItinerary) ? plan.dayPlanItinerary : []
  socialRecommendations.value = Array.isArray(plan.socialRecommendations) ? plan.socialRecommendations : []
  itinerarySummary.value = plan.itinerarySummary || '排期已生成'
  itineraryEvidence.value = Array.isArray(plan.evidence) ? plan.evidence : []
  verifierWarnings.value = Array.isArray(plan.verifierWarnings) ? plan.verifierWarnings : []
}

// 保存到历史
const saveToHistory = async () => {
  if (!dayPlanItinerary.value.length) { 
    uni.showToast({ title: '无行程可保存', icon: 'none' })
    return 
  }
  
  const plan = travelStore.currentPlan
  if (!plan) {
    uni.showToast({ title: '无行程数据', icon: 'none' })
    return
  }
  
  try {
    uni.showLoading({ title: '保存中...' })
    
    // 调用后端API保存
    const result = await saveHistory({
      userInput: plan.userInput || '行程方案',
      modelType: plan.modelType || 'auto',
      provider: plan.provider || 'unknown',
      itinerarySummary: itinerarySummary.value || '',
      dayPlan: dayPlanItinerary.value || [],
      socialRecommendations: socialRecommendations.value || [],
      evidence: itineraryEvidence.value || [],
      warnings: verifierWarnings.value || []
    })
    
    uni.hideLoading()
    
    if (result?.id) {
      uni.showToast({ title: '保存成功', icon: 'success' })
    } else {
      // 保存到本地作为备份
      saveToLocalStorage()
    }
  } catch (error) {
    console.error('保存失败', error)
    uni.hideLoading()
    // 降级到本地存储
    saveToLocalStorage()
  }
}

// 保存到本地存储
const saveToLocalStorage = () => {
  try {
    const history = JSON.parse(uni.getStorageSync('travel_history') || '[]')
    const userData = ''
    
    history.unshift({
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      prompt: userData,
      summary: itinerarySummary.value,
      itinerary: dayPlanItinerary.value,
      recommendations: socialRecommendations.value,
      evidence: itineraryEvidence.value,
      warnings: verifierWarnings.value
    })
    
    if (history.length > 30) history.pop()
    uni.setStorageSync('travel_history', JSON.stringify(history))
    uni.showToast({ title: '已保存到本地', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '保存失败', icon: 'error' })
  }
}

// 复制到剪贴板
const copyToClipboard = () => {
  if (!dayPlanItinerary.value.length && !itinerarySummary.value) { 
    showToast('无内容', 'error')
    return 
  }
  
  uni.setClipboardData({ 
    data: generatePlainTextGuide(),
    success: () => showToast('已复制', 'success'),
    fail: () => showToast('复制失败', 'error')
  })
}

// 导出行程
const exportToFile = () => {
  if (!dayPlanItinerary.value.length) { 
    showToast('无行程', 'error')
    return 
  }
  
  uni.showModal({ 
    title: '导出行程', 
    content: '已将行程复制到剪贴板', 
    showCancel: false,
    success: () => copyToClipboard() 
  })
}

// 生成纯文本行程指南
const generatePlainTextGuide = () => {
  let text = `🌍 AI Travel Pro 行程指南\n📅 ${new Date().toLocaleString()}\n🎯 旅行方案\n\n`
  
  if (itinerarySummary.value) text += `📝 亮点\n${itinerarySummary.value}\n\n`
  
  if (socialRecommendations.value.length) {
    text += `🔥 热门打卡\n`
    socialRecommendations.value.forEach((item, i) => { 
      text += `${i+1}. ${item.title || item.name} [${item.platform}] - ${item.reason || item.description}\n`
    })
    text += '\n'
  }
  
  if (dayPlanItinerary.value.length) {
    text += `🗺️ 每日行程\n`
    const days = {}
    dayPlanItinerary.value.forEach(item => { 
      if (!days[item.day]) days[item.day] = []
      days[item.day].push(item)
    })
    
    Object.keys(days).sort().forEach(day => {
      text += `\n【Day ${day}】\n`
      days[day].forEach(item => {
        const city = item.city ? `(${item.city})` : ''
        const weather = item.weather_icon && item.temperature ? ` [${item.weather_icon} ${item.temperature}]` : ''
        text += `📍 ${item.sequence || ''}. ${item.name} ${city}\n   ⏰ ${item.time}${weather}\n   📖 ${item.description}\n`
        if (item.transit_hint) text += `   🚗 ${item.transit_hint}\n`
        text += `   ────────────────────\n`
      })
    })
  }
  
  return text
}

// 跳转到地图并定位
const goMapWithItem = (item) => {
  // 如果有地图功能页面则跳转
  if (item.lat && item.lng) {
    showToast(`Day ${item.day} - ${item.name}`, 'normal')
  }
}

// 返回主页（地图页面）
const goBack = () => {
  uni.redirectTo({ url: '/pages/index/index' })
}

// Toast
const showToast = (message, type = 'normal', duration = 3000) => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, duration)
}
</script>

<style scoped>
/* 页面 */
.page-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--gradient-aurora);
}

/* 行程面板通用 */
.side-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  max-width: 100%;
  background: var(--gradient-aurora);
  border-radius: 0;
  box-shadow: 0 16rpx 60rpx rgba(0, 40, 142, 0.15);
  transform: translateX(0);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.panel-header {
  border-bottom: 1rpx solid var(--border-glass-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 36rpx var(--page-padding-x);
  background: var(--bg-topbar);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.panel-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: #16203a;
  letter-spacing: var(--title-letter-spacing);
  font-family: var(--font-display);
}

.model-tag {
  padding: 8rpx 18rpx;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #ffffff;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

.close-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.66);
  border-radius: 50%;
  color: #1f2937;
  font-size: 32rpx;
}

.close-btn:active {
  background: rgba(255, 255, 255, 0.25);
}

.header-actions {
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.action-icon {
  min-width: 54rpx;
  min-height: 54rpx;
  border: 1rpx solid rgba(255,255,255,.24);
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.66);
  border-radius: 50%;
  color: #1f2937;
}

.action-glyph {
  font-size: 24rpx;
  font-weight: 600;
}

.action-icon:active {
  background: rgba(255, 255, 255, 0.25);
}

/* 行程主体 */
.panel-body {
  flex: 1;
  padding: 32rpx var(--page-padding-x);
  overflow-y: auto;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
  gap: 24rpx;
}

.empty-icon {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.45);
}

.empty-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1A1B22;
}

.empty-desc {
  font-size: 28rpx;
  color: #80868B;
}

/* 行程内容 */
.plan-content {
  padding-bottom: 32rpx;
}

.summary-card {
  background: linear-gradient(135deg, rgba(0, 40, 142, 0.06) 0%, rgba(30, 64, 175, 0.04) 100%);
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  border: 1rpx solid rgba(0, 40, 142, 0.1);
}

.summary-text {
  font-size: 30rpx;
  line-height: 1.6;
  color: #202124;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

/* 日期卡片 */
.days-container {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.day-card {
  background: var(--gradient-aurora);
  border-radius: 24rpx;
  padding: 32rpx;
  border-left: 8rpx solid #4285F4;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}

.day-card:active {
  transform: scale(0.98);
  box-shadow: 0 8rpx 24rpx rgba(0, 40, 142, 0.1);
}

.day-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.day-label {
  display: flex;
  align-items: center;
  padding: 12rpx 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #4285F4 0%, #3367D6 100%);
}

.day-label-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

.time-label {
  font-size: 28rpx;
  color: #5F6368;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

.place-name {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #202124;
  margin-bottom: 16rpx;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

.place-desc {
  display: block;
  font-size: 28rpx;
  color: #5F6368;
  line-height: 1.6;
  margin-bottom: 20rpx;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

.place-meta {
  display: flex;
  gap: 24rpx;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 26rpx;
  color: #5F6368;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

/* Toast */
.toast-wrap {
  position: absolute;
  top: 140rpx;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.toast {
  background: rgba(23,23,23,0.9);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: #fff;
  padding: 24rpx 48rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 500;
  opacity: 0;
  transform: translateY(-20rpx);
  transition: all 0.3s;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.2);
}

.toast-visible {
  opacity: 1;
  transform: translateY(0);
}

.toast.success {
  background: rgba(34,197,94,0.9);
}

.toast.error {
  background: rgba(239,68,68,0.9);
}

.action-pill { transition: transform .2s var(--ease-out), box-shadow .2s var(--ease-out); }
.action-pill:active { transform: translateY(1rpx) scale(.95); box-shadow: 0 8rpx 16rpx rgba(0,0,0,.2); }
</style>
