<template>
  <view class="page-container">
    <view class="top-bar" :style="'padding-top:' + (safeAreaTop + 32) + 'px'">
      <view class="back-btn" @click="goBack">
        <text>←</text>
      </view>
      <text class="page-title">历史记录</text>
    </view>

    <scroll-view scroll-y class="content">
      <view v-if="historyList.length === 0" class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无历史记录</text>
      </view>

      <view
        v-for="item in historyList"
        :key="item.id"
        class="history-item"
        @click="showDetails(item)"
      >
        <view class="history-info">
          <view class="history-header">
            <text class="history-time" v-if="item.created_at">{{ formatDate(item.created_at) }}</text>
            <text class="history-time" v-else-if="item.timestamp">{{ item.timestamp }}</text>
            <view 
              v-if="item.is_favorite" 
              class="history-favorite"
            >
              ⭐
            </view>
          </view>
          <text class="history-prompt">{{ getPreviewText(item) }}</text>
        </view>
        <view class="history-actions">
          <view class="history-load btn-pill" @click.stop="loadHistory(item)">载入</view>
          <view class="history-delete btn-pill" @click.stop="deleteHistory(item.id)">🗑️</view>
        </view>
      </view>
    </scroll-view>

    <!-- 详情弹窗 -->
    <view v-if="showDetailPopup" class="popup-overlay" @click="closeDetailPopup">
      <view class="popup-content" @click.stop>
        <view class="popup-header">
          <text class="popup-title">{{ selectedDetail.itinerary_summary?.substring(0, 20) || '行程详情' }}</text>
          <view class="popup-close" @click="closeDetailPopup">×</view>
        </view>
        <view class="popup-body">
          <view class="detail-section">
            <text class="detail-label">行程ID:</text>
            <text class="detail-value">{{ selectedDetail.id }}</text>
          </view>
          <view class="detail-section">
            <text class="detail-label">创建时间:</text>
            <text class="detail-value">{{ formatDate(selectedDetail.created_at) }}</text>
          </view>
          <view class="detail-section">
            <text class="detail-label">模型类型:</text>
            <text class="detail-value">{{ selectedDetail.model_type || 'N/A' }}</text>
          </view>
          <view class="detail-section">
            <text class="detail-label">服务提供商:</text>
            <text class="detail-value">{{ selectedDetail.provider || 'N/A' }}</text>
          </view>
          <view class="detail-section" v-if="selectedDetail.itinerary_summary">
            <text class="detail-label">行程摘要:</text>
            <text class="detail-value preview-text">{{ selectedDetail.itinerary_summary.substring(0, 300) }}...</text>
          </view>
          <view class="detail-section" v-if="selectedDetail.day_plan">
            <text class="detail-label">行程计划:</text>
            <view class="day-plan-container">
              <!-- 数组格式（扁平列表） -->
              <view v-if="Array.isArray(selectedDetail.day_plan)">
                <view v-for="(location, locIndex) in selectedDetail.day_plan" :key="locIndex" class="location-item">
                  <text class="location-name">{{ location.name || location.title || '未知地点' }}</text>
                  <text class="location-time" v-if="location.time">⏰ {{ location.time }}</text>
                  <text class="location-city" v-if="location.city">📍 {{ location.city }}</text>
                  <text class="location-desc">{{ location.description }}</text>
                  <view class="location-coords" v-if="location.lat && location.lng">
                    坐标: {{ location.lat }}, {{ location.lng }}
                  </view>
                </view>
              </view>
              <!-- 对象分组格式 { '1': [...], '2': [...] } -->
              <view v-else>
                <view v-for="(locations, dayKey) in selectedDetail.day_plan" :key="dayKey">
                  <view v-if="Array.isArray(locations)" class="day-plan-group">
                    <text class="day-title">Day {{ dayKey }}</text>
                    <view class="location-list">
                      <view class="location-item" v-for="(location, locIndex) in locations" :key="locIndex">
                        <text class="location-name">{{ location.name || location.title || '未知地点' }}</text>
                        <text class="location-time" v-if="location.time">⏰ {{ location.time }}</text>
                        <text class="location-city" v-if="location.city">📍 {{ location.city }}</text>
                        <text class="location-desc">{{ location.description }}</text>
                        <view class="location-coords" v-if="location.lat && location.lng">
                          坐标: {{ location.lat }}, {{ location.lng }}
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="popup-actions">
          <button class="action-btn load-btn btn-pill" @click="loadDetailToPlan">载入此方案</button>
          <button class="action-btn cancel-btn btn-pill" @click="closeDetailPopup">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { getHistoryList, deleteHistory as deleteHistoryApi, getHistoryDetail, toggleFavorite as toggleFavoriteApi } from '@/api/history.js'

const travelStore = useTravelStore()
const userStore = useUserStore()

// 安全区域顶部高度
const safeAreaTop = ref(0)

const historyList = ref([])
const showDetailPopup = ref(false)
const selectedDetail = ref({})

const getPreviewText = (item) => {
  const text = item.itinerary_summary || item.user_input || item.summary || '未命名行程'
  return text.substring(0, 50) + (text.length > 50 ? '...' : '')
}

const goBack = () => {
  // 使用 reLaunch 重置页面栈并跳转到首页
  uni.reLaunch({ url: '/pages/index/index' })
}

onMounted(() => {
  // 获取安全区域
  try {
    const systemInfo = uni.getSystemInfoSync()
    safeAreaTop.value = systemInfo.safeAreaInsets?.top || 0
    console.log('[History] 安全区域顶部:', safeAreaTop.value)
  } catch (e) {
    console.error('[History] 获取安全区域失败:', e)
    safeAreaTop.value = 0
  }
  
  // 从本地存储恢复登录状态
  userStore.restoreFromStorage()
  
  // 检查是否已登录
  if (!userStore.hasToken) {
    console.log('[History] 未登录，跳转到登录页')
    uni.showToast({ title: '请先登录', icon: 'none' })
    uni.redirectTo({ url: '/pages/login/index' })
    return
  }
  
  loadHistoryList()
})

const loadHistory = async (item) => {
  console.log('载入历史数据', { item })
  uni.showLoading({ title: '加载中...' })

  // 列表接口可能不返回完整 day_plan，需要获取详情
  let sourceItem = item
  if (!item.day_plan || (typeof item.day_plan === 'object' && !Array.isArray(item.day_plan) && Object.keys(item.day_plan).length === 0)) {
    try {
      const detail = await getHistoryDetail(item.id)
      if (detail && detail.id) {
        sourceItem = detail
        console.log('从详情接口获取完整数据', detail)
      }
    } catch (e) {
      console.error('获取详情失败，使用列表数据', e)
    }
  }

  // 从历史加载行程到store
  let dayPlanItinerary = []

  // 优先处理数组格式（扁平列表）
  if (Array.isArray(sourceItem.day_plan)) {
    dayPlanItinerary = sourceItem.day_plan.map((location, index) => ({
      ...location,
      sequence: (location.sequence !== undefined) ? location.sequence : (index + 1),
    }))
  }
  // 处理对象分组格式 { '1': [...], '2': [...] }
  else if (sourceItem.day_plan && typeof sourceItem.day_plan === 'object' && !Array.isArray(sourceItem.day_plan)) {
    for (const dayKey in sourceItem.day_plan) {
      const dayItems = sourceItem.day_plan[dayKey]
      if (Array.isArray(dayItems)) {
        const dayNum = parseInt(dayKey)
        dayItems.forEach((location, index) => {
          dayPlanItinerary.push({
            ...location,
            day: dayNum,
            sequence: (location.sequence !== undefined) ? location.sequence : (index + 1),
          })
        })
      }
    }
  }
  // 兼容其他字段名
  else if (Array.isArray(sourceItem.dayPlan) || Array.isArray(sourceItem.itinerary)) {
    dayPlanItinerary = (sourceItem.dayPlan || sourceItem.itinerary || []).map((location, index) => ({
      ...location,
      sequence: (location.sequence !== undefined) ? location.sequence : (index + 1),
    }))
  }

  uni.hideLoading()

  const planData = {
    itinerarySummary: sourceItem.itinerary_summary || sourceItem.summary || sourceItem.user_input || '',
    dayPlanItinerary: dayPlanItinerary,
    socialRecommendations: sourceItem.social_recommendations || sourceItem.recommendations || [],
    evidence: sourceItem.evidence || [],
    warnings: sourceItem.warnings || []
  }

  travelStore.currentPlan = planData
  console.log('载入行程完毕，跳转到计划页面', planData)
  uni.navigateTo({ url: '/pages/plan/plan' })
}

const showDetails = async (item) => {
  console.log('显示详情', item)
  try {
    uni.showLoading({ title: '加载中...' })
    // 优先从API获取详细信息
    const detail = await getHistoryDetail(item.id)
    uni.hideLoading()
    
    if (detail && detail.id) {
      console.log('详情从服务器加载成功', detail)
      selectedDetail.value = detail
    } else {
      // API失败则使用原始项数据
      console.log('从本地项加载详情', item)
      selectedDetail.value = item
    }
    
    showDetailPopup.value = true
  } catch (e) {
    console.error('获取详细信息失败', e)
    uni.hideLoading()
    // 使用原有数据展示
    selectedDetail.value = item
    showDetailPopup.value = true
  }
}

const closeDetailPopup = () => {
  showDetailPopup.value = false
}

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  
  try {
    // 如果是ISO格式的时间戳，则转换为易读格式
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      // 格式：2026-04-23 23:30
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    return dateStr;
  } catch (err) {
    // 如果解析失败，直接返回原字符串
    return dateStr;
  }
}

const loadDetailToPlan = () => {
  console.log('点击载入详情', selectedDetail.value)
  if (selectedDetail.value) {
    // 处理详细 day_plan 数据结构
    let dayPlanItinerary = []
    
    if (selectedDetail.value.day_plan) {
      if (typeof selectedDetail.value.day_plan === 'object' && !Array.isArray(selectedDetail.value.day_plan)) {
        // 如果是按天分组的字典格式
        for (const dayKey in selectedDetail.value.day_plan) {
          const dayItems = selectedDetail.value.day_plan[dayKey]
          if (Array.isArray(dayItems)) {
            const dayNum = parseInt(dayKey)
            // 为每个项目添加天数信息
            dayItems.forEach((location, index) => {
              dayPlanItinerary.push({
                ...location,
                day: dayNum,
                sequence: (location.sequence !== undefined) ? location.sequence : (index + 1),
                name: location.name || location.title || '',
                time: location.time,
                lat: location.lat,
                lng: location.lng,
                description: location.description,
                city: location.city || ''
              })
            })
          }
        }
      } else if (Array.isArray(selectedDetail.value.day_plan)) {
        // 如果是数组格式  
        dayPlanItinerary = selectedDetail.value.day_plan.map((item, index) => ({
          ...item,
          day: item.day || 1,
          sequence: item.sequence || (index + 1),
          name: item.name || item.title,
          city: item.city
        }))
      }
    }

    // 计算摘要
    const itinerarySummary = selectedDetail.value.itinerary_summary || selectedDetail.value.summary || selectedDetail.value.user_input || '行程详情'

    console.log('准备加载到行程:', {
      itinerarySummary,
      dayPlanItineraryLength: dayPlanItinerary.length,
      socialRecommendationsLength: (selectedDetail.value.social_recommendations || selectedDetail.value.recommendations || []).length
    })

    travelStore.currentPlan = {
      itinerarySummary: itinerarySummary,
      dayPlanItinerary: dayPlanItinerary,
      socialRecommendations: selectedDetail.value.social_recommendations || selectedDetail.value.recommendations || [],
      evidence: selectedDetail.value.evidence || [],
      warnings: selectedDetail.value.warnings || []
    }
    
    console.log('准备跳转到Plan页面')
    uni.navigateTo({ url: '/pages/plan/plan' })
    closeDetailPopup()
  } else {
    console.error('没有选择的详细信息')
  }
}

// 切换收藏状态
const toggleFavorite = async (id) => {
  try {
    const result = await toggleFavoriteApi(id)
    // 更新本地数据
    const item = historyList.value.find(item => item.id === id)
    if (item) {
      item.is_favorite = result
    }
  } catch (e) {
    console.error('切换收藏状态失败', e)
  }
}

const deleteHistory = (id) => {
  uni.showModal({
    title: '确认删除',
    content: '确定删除这条记录？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteHistoryApi(id)
          showDetailPopup.value = false // 删除后关闭弹窗
          console.log('删除成功')
        } catch (e) {
          console.log('删除失败', e)
        }
        loadHistoryList()
      }
    }
  })
}

const loadHistoryList = async () => {
  console.log('开始加载历史记录列表')
  try {
    const data = await getHistoryList(1, 50, false)
    if (data?.list) {
      console.log('API返回历史数据', data.list.length, '条')
      historyList.value = data.list
    } else {
      console.log('API返回空或无效数据结构', data)
      historyList.value = []
    }
  } catch (e) {
    console.error('API加载失败，尝试本地缓存', e)
    
    // 降级到本地存储
    try {
      const localStr = uni.getStorageSync('travel_history') || '[]'
      const localData = JSON.parse(localStr)
      console.log('从本地缓存加载', localData.length, '条历史记录')
      historyList.value = localData
    } catch (parseError) {
      console.error('本地存储解析失败', parseError)
      historyList.value = []
    }
  }
}
</script>

<style scoped>
/* 根据 design.md 应用统一样式 */
.page-container {
  min-height: 100vh;
  background: var(--gradient-aurora);
}

.top-bar {
  display: flex;
  align-items: center;
  padding: 32rpx 40rpx;
  background: linear-gradient(135deg, #4285f4 0%, #5e9ae4 100%);
  color: white;
}

.back-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.page-title {
  flex: 1;
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
}

.content {
  padding: 32rpx;
  padding-bottom: 120rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 40rpx;
  gap: 24rpx;
}

.empty-icon {
  font-size: 80rpx;
  opacity: 0.5;
  color: #adb5bd;
}

.empty-text {
  font-size: 28rpx;
  color: #adb5bd;
}

.history-item {
  border: 1rpx solid rgba(255,255,255,.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  background: rgba(255,255,255,.82);
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0rpx 2rpx 4rpx 0px rgba(0,0,0,0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.history-item:active {
  transform: scale(0.98);
  box-shadow: 0rpx 8rpx 16rpx 0px rgba(0,0,0,0.12);
}

.history-info {
  flex: 1;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.history-time {
  font-size: 24rpx;
  color: #6c757d;
  display: block;
}

.history-favorite {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(45deg, #fbc02d, #f57f17);
  color: white;
  border-radius: 50%;
  font-size: 28rpx;
  flex-shrink: 0;
}

.history-prompt {
  font-size: 28rpx;
  color: #495057;
  display: block;
  line-height: 1.4;
  word-break: break-word;
  font-weight: 500;
}

.history-actions {
  display: flex;
  gap: 16rpx;
}

.history-load {
  padding: 16rpx 32rpx;
  background: linear-gradient(135deg, #34a853 0%, #2e8a49 100%);
  color: white;
  border-radius: 50rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.history-delete {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ea4335 0%, #d62828 100%);
  color: white;
  font-size: 28rpx;
  padding: 0;
  margin-left: 10rpx;
}

.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8rpx);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.popup-content {
  width: 92%;
  max-height: 85vh;
  background: rgba(255,255,255,.82);
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  max-width: 800rpx;
  box-shadow: 0rpx 20rpx 60rpx 0px rgba(0,0,0,0.2);
  animation: scaleIn 0.3s cubic-bezier(0.25,0.8,0.25,1);
  overflow: hidden;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(40rpx);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  background: linear-gradient(135deg, #4285f4 0%, #5e9ae4 100%);
  color: white;
  border-radius: 24rpx 24rpx 0 0;
  flex-shrink: 0;
}

.popup-title {
  font-size: 32rpx;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
  flex: 1;
  margin-right: 16rpx;
}

.popup-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  font-size: 28rpx;
  font-weight: bold;
  color: white;
  flex-shrink: 0;
}

.popup-body {
  padding: 32rpx;
  flex: 1;
  overflow-y: auto;
  max-height: 60vh;
}

.detail-section {
  margin-bottom: 32rpx;
  border-radius: 16rpx;
  padding: 20rpx;
  background: #f8f9fa;
}

.detail-label {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #4285f4;
  margin-bottom: 12rpx;
  padding-bottom: 8rpx;
  border-bottom: 1rpx solid #e9ecef;
}

.detail-value {
  display: block;
  font-size: 26rpx;
  color: #6c757d;
  word-break: break-word;
  line-height: 1.5;
  padding: 12rpx;
  background: rgba(255,255,255,.82);
  border-radius: 12rpx;
  border: 1rpx solid #e9ecef;
  white-space: pre-wrap;
}

.preview-text {
  max-height: 150rpx;
  overflow: hidden;
}

.day-plan-container {
  margin-top: 16rpx;
}

.day-plan-group {
  margin-bottom: 24rpx;
}

.day-title {
  display: block;
  font-size: 30rpx;
  font-weight: bold;
  color: #4a5568;
  margin: 24rpx 0 16rpx 0;
  padding: 12rpx 16rpx;
  background: linear-gradient(90deg, #e3f2fd 0%, #bbdefb 100%);
  border-radius: 12rpx;
  border-left: 5rpx solid #4285f4;
  display: inline-block;
  width: auto;
}

.location-list {
  padding-left: 16rpx;
  margin-top: 8rpx;
}

.location-item {
  margin: 24rpx 0;
  padding: 24rpx;
  border: 2rpx solid #e0f7fa;
  border-radius: 16rpx;
  background: #f0f9ff;
  transition: box-shadow 0.2s;
}

.location-item:hover {
  box-shadow: 0rpx 4rpx 12rpx rgba(66, 133, 244, 0.1);
}

.location-name {
  display: block;
  font-size: 30rpx;
  font-weight: bold;
  color: #1a202c;
  margin-bottom: 10rpx;
}

.location-time, .location-city {
  display: block;
  font-size: 26rpx;
  color: #4a5568;
  margin-bottom: 6rpx;
  font-weight: 500;
}

.location-desc {
  display: block;
  font-size: 24rpx;
  color: #718096;
  line-height: 1.4;
  margin: 8rpx 0;
  padding: 8rpx 0 0;
  border-top: 1rpx dashed #cbd5e0;
}

.location-coords {
  display: block;
  font-size: 22rpx;
  color: #a0aec0;
  margin-top: 8rpx;
  font-family: monospace;
  word-break: break-all;
  background: #edf2f7;
  padding: 4rpx 8rpx;
  border-radius: 4rpx;
}

.popup-actions {
  display: flex;
  padding: 32rpx;
  gap: 16rpx;
  border-top: 1rpx solid #e9ecef;
  flex-shrink: 0;
  background: #f8f9fa;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  outline: none;
  transition: transform 0.2s, opacity 0.2s;
}

.action-btn:active {
  transform: scale(0.96);
}

.load-btn {
  background: linear-gradient(135deg, #4285f4 0%, #3367d6 100%);
  color: white;
}

.cancel-btn {
  background: linear-gradient(135deg, #6c757d 0%, #545b62 100%);
  color: white;
}

/* 阀止弹出层背景滚动 */
page {
  height: 100vh;
  overflow: hidden;
}
</style>

.btn-pill {
  transition: transform .2s var(--ease-out), box-shadow .2s var(--ease-out);
}
.btn-pill:active {
  transform: translateY(1rpx) scale(.97);
}
.history-load {
  box-shadow: 0 10rpx 18rpx rgba(16,185,129,.24);
}
.history-delete {
  box-shadow: 0 10rpx 18rpx rgba(234,67,53,.24);
}
.action-btn {
  border-radius: 20rpx !important;
  font-weight: 600;
}
.load-btn {
  background: var(--gradient-primary) !important;
  box-shadow: 0 12rpx 24rpx rgba(24,73,169,.24);
}
.cancel-btn {
  background: rgba(255,255,255,.88) !important;
  border: 1rpx solid rgba(255,255,255,.78);
  color: #334155 !important;
}
