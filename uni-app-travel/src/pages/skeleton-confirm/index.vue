<template>
  <view class="skeleton-confirm-page" :class="themeClass">
    <!-- 顶部导航 -->
    <header class="top-bar" :style="{ paddingTop: (12 + statusBarHeight) + 'px' }">
      <view class="top-left">
        <button class="back-btn" @click="goBack"><text>←</text></button>
        <text class="top-title">确认行程</text>
      </view>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false">
      <!-- 天气提示 -->
      <view v-if="weatherInfo" class="weather-banner">
        <text class="weather-icon">{{ weatherInfo.icon }}</text>
        <text class="weather-text">{{ weatherInfo.text }}</text>
      </view>

      <!-- 方案摘要卡片 -->
      <view class="summary-card" v-if="skeletonPlan">
        <view class="summary-header">
          <text class="summary-title">{{ skeletonPlan.title || '为您规划的行程' }}</text>
          <view class="summary-tags">
            <text class="summary-tag">{{ skeletonPlan.categoryName || '深度游' }}</text>
            <text class="summary-tag">{{ skeletonPlan.days }}天</text>
            <text class="summary-tag">~¥{{ skeletonPlan.budget }}/人</text>
          </view>
        </view>
        <text class="summary-desc">{{ skeletonPlan.summary || '根据您的需求定制的专属行程' }}</text>
      </view>

      <!-- 骨架预览 -->
      <view class="skeleton-preview" v-if="skeletonPlan">
        <view v-for="(day, dayIndex) in skeletonPlan.daysList" :key="dayIndex" class="day-section">
          <view class="day-header">
            <text class="day-label">Day {{ dayIndex + 1 }}</text>
            <text class="day-theme">{{ day.theme || '精彩一天' }}</text>
          </view>
          
          <view class="spots-list">
            <view 
              v-for="(spot, spotIndex) in day.spots" 
              :key="spotIndex"
              class="spot-item"
              :class="{ 'spot-deleted': spot.isDeleted }"
            >
              <view class="spot-main">
                <view class="spot-time">{{ spot.time }}</view>
                <view class="spot-info">
                  <text class="spot-name">{{ spot.name }}</text>
                  <text class="spot-reason" v-if="spot.reason">{{ spot.reason }}</text>
                </view>
                <view class="spot-actions">
                  <button class="action-btn delete" @click="deleteSpot(dayIndex, spotIndex)">
                    <text>×</text>
                  </button>
                </view>
              </view>
              
              <!-- 景点之间的路线 -->
              <view v-if="spotIndex < day.spots.length - 1 && !spot.isDeleted" class="spot-route">
                <view class="route-line"></view>
                <text class="route-text">{{ spot.routeToNext || '步行约15分钟' }}</text>
              </view>
            </view>
          </view>

          <!-- 添加景点按钮 -->
          <button class="add-spot-btn" @click="addSpot(dayIndex)">
            <text>+ 添加景点</text>
          </button>
        </view>
      </view>

      <!-- 底部间距 -->
      <view style="height: 200rpx;"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-actions" :style="{ bottom: (16 + safeAreaBottom) + 'px' }">
      <button class="btn-secondary" @click="regenerate">
        <text>🔄 重新生成</text>
      </button>
      <button class="btn-primary" @click="confirmAndGenerate">
        <text>✨ 生成完整方案</text>
      </button>
    </view>

    <!-- 替换景点弹窗 -->
    <view v-if="showReplaceModal" class="modal-mask" @click="closeReplaceModal">
      <view class="modal-panel" @click.stop>
        <view class="modal-header">
          <text class="modal-title">替换 "{{ currentSpot?.name }}"</text>
          <button class="modal-close" @click="closeReplaceModal">×</button>
        </view>
        <scroll-view scroll-y class="modal-body">
          <view 
            v-for="(alt, idx) in alternatives" 
            :key="idx"
            class="alternative-item"
            @click="selectAlternative(alt)"
          >
            <text class="alt-name">{{ alt.name }}</text>
            <text class="alt-reason">{{ alt.reason }}</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 添加景点弹窗 -->
    <view v-if="showAddSpotModal" class="modal-mask" @click="closeAddSpotModal">
      <view class="modal-panel add-spot-panel" @click.stop>
        <view class="modal-header">
          <text class="modal-title">添加景点</text>
          <button class="modal-close" @click="closeAddSpotModal">×</button>
        </view>
        <view class="modal-body add-spot-body">
          <view class="form-item">
            <text class="form-label">景点名称</text>
            <input 
              v-model="newSpotName" 
              class="form-input" 
              placeholder="请输入景点名称"
              maxlength="50"
            />
          </view>
          <view class="form-item">
            <text class="form-label">建议时间</text>
            <input 
              v-model="newSpotTime" 
              class="form-input" 
              placeholder="如：09:00"
              maxlength="10"
            />
          </view>
          <view class="form-item">
            <text class="form-label">推荐理由（可选）</text>
            <textarea 
              v-model="newSpotReason" 
              class="form-textarea" 
              placeholder="简单描述一下这个景点..."
              maxlength="100"
            />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-secondary" @click="closeAddSpotModal">取消</button>
          <button class="btn-primary" @click="confirmAddSpot">确认添加</button>
        </view>
      </view>
    </view>

    <!-- 生成中状态 -->
    <view v-if="isGenerating" class="generating-overlay">
      <view class="generating-content">
        <view class="generating-spinner"></view>
        <text class="generating-text">正在生成完整行程...</text>
        <text class="generating-sub">正在获取景点详情、图片和路线</text>
        <text class="generating-time">已等待 {{ generatingTime }} 秒</text>
        <button class="generating-cancel" @click="cancelGenerating">取消</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'
import { getWeatherNow } from '@/api/weather.js'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight, safeAreaBottom } = useSafeArea()

// 骨架数据
const skeletonPlan = ref(null)
const weatherInfo = ref(null)

// 弹窗状态
const showReplaceModal = ref(false)
const currentSpot = ref(null)
const currentDayIndex = ref(0)
const currentSpotIndex = ref(0)
const alternatives = ref([])

// 生成状态
const isGenerating = ref(false)
const generatingTime = ref(0)
let generatingTimer = null

// 开始计时
const startGeneratingTimer = () => {
  generatingTime.value = 0
  generatingTimer = setInterval(() => {
    generatingTime.value++
  }, 1000)
}

// 停止计时
const stopGeneratingTimer = () => {
  if (generatingTimer) {
    clearInterval(generatingTimer)
    generatingTimer = null
  }
}

// 取消生成
const cancelGenerating = () => {
  stopGeneratingTimer()
  isGenerating.value = false
  uni.showToast({ title: '已取消生成', icon: 'none' })
}

onMounted(() => {
  userStore.restoreFromStorage()
  loadSkeletonData()
  loadWeather()
})

// 加载骨架数据
const loadSkeletonData = () => {
  const plan = travelStore.currentPlan
  if (!plan) {
    uni.showToast({ title: '暂无行程数据', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
    return
  }

  // 从 days 数组或 dayPlanItinerary 构建数据
  const days = plan.days || []
  const dayPlanItinerary = plan.dayPlanItinerary || []
  
  // 计算天数
  const totalDays = days.length || Math.max(...dayPlanItinerary.map(i => i.day || 1), 1)
  
  // 提取城市名
  const city = dayPlanItinerary[0]?.city || plan.itinerarySummary?.split(' ')[0] || '目的地'
  
  // 转换骨架数据为可编辑格式
  skeletonPlan.value = {
    title: plan.itinerarySummary?.substring(0, 20) || `${city}行程`,
    categoryName: '深度游',
    days: totalDays,
    budget: 1200,
    summary: plan.itinerarySummary || `为您规划了${totalDays}天的${city}行程`,
    daysList: []
  }

  // 按天分组景点
  if (days.length > 0) {
    // 使用 days 数组
    skeletonPlan.value.daysList = days.map((day, idx) => ({
      day: day.day || idx + 1,
      theme: `Day ${day.day || idx + 1}`,
      spots: (day.itinerary || []).map((item, spotIdx) => ({
        name: item.name,
        time: item.time || '',
        reason: item.description?.substring(0, 30) || '',
        isDeleted: false,
        originalData: item
      }))
    }))
  } else {
    // 从 dayPlanItinerary 分组
    const dayMap = {}
    dayPlanItinerary.forEach(item => {
      const day = item.day || 1
      if (!dayMap[day]) {
        dayMap[day] = {
          day: day,
          theme: `Day ${day}`,
          spots: []
        }
      }
      dayMap[day].spots.push({
        name: item.name,
        time: item.time || '',
        reason: item.description?.substring(0, 30) || '',
        isDeleted: false,
        originalData: item
      })
    })
    skeletonPlan.value.daysList = Object.values(dayMap).sort((a, b) => a.day - b.day)
  }
}

// 加载天气
const loadWeather = async () => {
  const plan = travelStore.currentPlan
  if (!plan?.dayPlanItinerary?.length) return
  
  // 获取第一个景点的坐标
  const firstSpot = plan.dayPlanItinerary[0]
  const lat = firstSpot?.lat
  const lng = firstSpot?.lng
  
  if (!lat || !lng) return
  
  try {
    const res = await getWeatherNow(lng, lat)
    if (res) {
      weatherInfo.value = {
        icon: res.text === '晴' ? '☀️' : res.text?.includes('雨') ? '🌧️' : '⛅',
        text: `${firstSpot.city || ''} ${res.temp}° ${res.text}`,
        hasRain: res.text?.includes('雨')
      }
    }
  } catch (e) {
    console.warn('[SkeletonConfirm] 获取天气失败:', e)
  }
}

// 删除景点
const deleteSpot = (dayIdx, spotIdx) => {
  const spot = skeletonPlan.value.daysList[dayIdx].spots[spotIdx]
  spot.isDeleted = !spot.isDeleted
}

// 添加景点弹窗状态
const showAddSpotModal = ref(false)
const addSpotDayIndex = ref(0)
const newSpotName = ref('')
const newSpotTime = ref('09:00')
const newSpotReason = ref('')

// 打开添加景点弹窗
const addSpot = (dayIdx) => {
  addSpotDayIndex.value = dayIdx
  newSpotName.value = ''
  newSpotTime.value = '09:00'
  newSpotReason.value = ''
  showAddSpotModal.value = true
}

// 关闭添加景点弹窗
const closeAddSpotModal = () => {
  showAddSpotModal.value = false
  newSpotName.value = ''
  newSpotTime.value = '09:00'
  newSpotReason.value = ''
}

// 确认添加景点
const confirmAddSpot = () => {
  if (!newSpotName.value.trim()) {
    uni.showToast({ title: '请输入景点名称', icon: 'none' })
    return
  }
  
  const day = skeletonPlan.value.daysList[addSpotDayIndex.value]
  const newSpot = {
    name: newSpotName.value.trim(),
    time: newSpotTime.value,
    reason: newSpotReason.value.trim() || '用户自定义添加',
    isDeleted: false,
    isUserAdded: true, // 标记为用户添加
    originalData: {
      name: newSpotName.value.trim(),
      time: newSpotTime.value,
      description: newSpotReason.value.trim() || '用户自定义添加',
      day: day.day,
      sequence: day.spots.length + 1
    }
  }
  
  day.spots.push(newSpot)
  closeAddSpotModal()
  uni.showToast({ title: '添加成功', icon: 'success' })
}

// 关闭替换弹窗
const closeReplaceModal = () => {
  showReplaceModal.value = false
  currentSpot.value = null
}

// 选择替代景点
const selectAlternative = (alt) => {
  if (currentSpot.value) {
    currentSpot.value.name = alt.name
    currentSpot.value.reason = alt.reason
  }
  closeReplaceModal()
}

// 重新生成
const regenerate = () => {
  uni.navigateBack()
}

// 确认并生成完整方案
const confirmAndGenerate = async () => {
  console.log('[SkeletonConfirm] === confirmAndGenerate 被调用 ===')

  // 过滤已删除的景点，构建确认的景点列表
  const confirmedSpots = []
  skeletonPlan.value.daysList.forEach((day, dayIdx) => {
    day.spots.forEach((spot, spotIdx) => {
      if (!spot.isDeleted && spot.originalData) {
        confirmedSpots.push({
          name: spot.originalData.name,
          day: day.day,
          sequence: spotIdx + 1,
          deleted: false,
          isUserAdded: !!spot.isUserAdded,
          description: spot.originalData.description || spot.reason || '',
          reason: spot.originalData.reason || spot.reason || '',
          time: spot.originalData.time || spot.time || '',
          city: spot.originalData.city || '',
          lat: spot.originalData.lat || null,
          lng: spot.originalData.lng || null
        })
      }
    })
  })

  console.log('[SkeletonConfirm] confirmedSpots:', JSON.stringify(confirmedSpots))
  console.log('[SkeletonConfirm] skeletonPlan.days:', skeletonPlan.value.days)
  console.log('[SkeletonConfirm] travelStore.currentPlan?._taskId:', travelStore.currentPlan?._taskId)

  if (confirmedSpots.length === 0) {
    uni.showToast({ title: '请至少保留一个景点', icon: 'none' })
    return
  }

  isGenerating.value = true
  startGeneratingTimer()

  try {
    console.log('[SkeletonConfirm] 开始生成完整方案，景点数:', confirmedSpots.length)
    // 调用store确认并生成完整方案
    const result = await travelStore.confirmAndGenerateFullPlan({
      confirmedSpots,
      adjustments: {
        days: skeletonPlan.value.days
      }
    })
    console.log('[SkeletonConfirm] 生成结果:', result?._stage, result?.days?.length)
    
    stopGeneratingTimer()
    isGenerating.value = false
    console.log('[SkeletonConfirm] 生成完成，准备跳转')
    // 先跳转，再显示提示（避免跳转被 Toast 阻塞）
    uni.navigateTo({ 
      url: '/pages/ai-plan-detail/index',
      success: () => {
        console.log('[SkeletonConfirm] 跳转成功')
        uni.showToast({ title: '行程生成完成', icon: 'success' })
      },
      fail: (err) => {
        console.error('[SkeletonConfirm] 跳转失败:', err)
        uni.showModal({
          title: '跳转失败',
          content: '请手动返回首页查看行程',
          showCancel: false
        })
      }
    })
  } catch (err) {
    stopGeneratingTimer()
    isGenerating.value = false
    console.error('[SkeletonConfirm] 生成失败:', err)
    uni.showModal({
      title: '生成失败',
      content: err.message || '网络异常，请检查网络后重试',
      showCancel: false,
      confirmText: '知道了'
    })
  }
}

// 返回
const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.skeleton-confirm-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 40rpx 24rpx;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.top-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--color-primary);
}

.top-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.01em;
}

.content {
  flex: 1;
  padding: 180rpx 32rpx 160rpx;
}

/* 天气横幅 */
.weather-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16rpx 24rpx;
  background: linear-gradient(135deg, rgba(15, 76, 92, 0.08), rgba(20, 184, 166, 0.08));
  border-radius: 16px;
  margin-bottom: 24rpx;
}

.weather-icon {
  font-size: 20px;
}

.weather-text {
  font-size: 14px;
  color: var(--color-on-surface);
  font-weight: 500;
}

/* 摘要卡片 */
.summary-card {
  background: #fff;
  border-radius: 20px;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.summary-header {
  margin-bottom: 16rpx;
}

.summary-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 12rpx;
  display: block;
}

.summary-tags {
  display: flex;
  gap: 8px;
}

.summary-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(15, 76, 92, 0.08);
  padding: 6px 14px;
  border-radius: 999px;
}

.summary-desc {
  font-size: 14px;
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

/* 骨架预览 */
.skeleton-preview {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.day-section {
  background: #fff;
  border-radius: 20px;
  padding: 28rpx;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.day-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20rpx;
}

.day-label {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-primary);
}

.day-theme {
  font-size: 14px;
  color: var(--color-on-surface-variant);
}

.spots-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.spot-item {
  position: relative;
}

.spot-item.spot-deleted {
  opacity: 0.4;
}

.spot-main {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.spot-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  background: rgba(15, 76, 92, 0.08);
  padding: 6px 12px;
  border-radius: 8px;
  flex-shrink: 0;
}

.spot-info {
  flex: 1;
  min-width: 0;
}

.spot-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-on-surface);
  display: block;
  margin-bottom: 4rpx;
}

.spot-reason {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  display: block;
}

.spot-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* 路线 */
.spot-route {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12rpx 0 12rpx 80rpx;
}

.route-line {
  width: 2px;
  height: 24rpx;
  background: var(--color-outline-variant);
}

.route-text {
  font-size: 11px;
  color: var(--color-outline);
}

/* 添加景点按钮 */
.add-spot-btn {
  width: 100%;
  height: 44px;
  margin-top: 20rpx;
  border-radius: 12px;
  background: rgba(15, 76, 92, 0.06);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-spot-btn::after {
  border: none;
}

/* 底部操作栏 */
.bottom-actions {
  position: fixed;
  left: 32rpx;
  right: 32rpx;
  display: flex;
  gap: 16rpx;
  z-index: 100;
}

.btn-secondary {
  flex: 1;
  height: 52px;
  border-radius: 16px;
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-secondary::after {
  border: none;
}

.btn-primary {
  flex: 2;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(15, 76, 92, 0.25);
}

.btn-primary::after {
  border: none;
}

.btn-primary:active {
  transform: scale(0.97);
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
}

.modal-panel {
  width: 100%;
  background: #fff;
  border-radius: 32px 32px 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  max-height: 70vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  font-size: 20px;
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close::after {
  border: none;
}

.modal-body {
  max-height: 50vh;
}

.alternative-item {
  padding: 24rpx;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.alternative-item:last-child {
  border-bottom: none;
}

.alt-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-on-surface);
  display: block;
  margin-bottom: 4rpx;
}

.alt-reason {
  font-size: 13px;
  color: var(--color-on-surface-variant);
}

/* 生成中遮罩 */
.generating-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.generating-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 48rpx;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
}

.generating-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(15, 76, 92, 0.1);
  border-top-color: #0F4C5C;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.generating-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.generating-sub {
  font-size: 14px;
  color: var(--color-on-surface-variant);
}

.generating-time {
  font-size: 12px;
  color: var(--color-outline);
  margin-top: 8rpx;
}

.generating-cancel {
  margin-top: 24rpx;
  padding: 16rpx 48rpx;
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-outline-variant);
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
}

.generating-cancel::after {
  border: none;
}

.generating-cancel:active {
  opacity: 0.7;
}

/* 添加景点弹窗样式 */
.add-spot-panel {
  max-height: 80vh;
}

.add-spot-body {
  padding: 24rpx 0;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-bottom: 12rpx;
  display: block;
}

.form-input {
  width: 100%;
  height: 44px;
  padding: 0 16rpx;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  font-size: 15px;
  color: var(--color-on-surface);
  background: #f8f9fa;
}

.form-textarea {
  width: 100%;
  height: 100px;
  padding: 16rpx;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  font-size: 15px;
  color: var(--color-on-surface);
  background: #f8f9fa;
}

.modal-footer {
  display: flex;
  gap: 16rpx;
  padding-top: 24rpx;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.modal-footer .btn-secondary,
.modal-footer .btn-primary {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-footer .btn-secondary {
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
}

.modal-footer .btn-secondary::after {
  border: none;
}

.modal-footer .btn-primary {
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  color: #fff;
}

.modal-footer .btn-primary::after {
  border: none;
}
</style>
