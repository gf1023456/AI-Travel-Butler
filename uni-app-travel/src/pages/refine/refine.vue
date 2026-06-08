<template>
  <view class="refine-page" :class="themeClass">
    <header class="top-bar" :style="{ paddingTop: (12 + statusBarHeight) + 'px' }">
      <view class="top-left">
        <button class="back-btn" @click="goBack"><text>←</text></button>
        <text class="top-title">行程优化</text>
      </view>
      <button class="more-btn"><text>⋯</text></button>
    </header>

    <scroll-view scroll-y class="content" :style="{ paddingTop: (80 + statusBarHeight) + 'px' }">
      <!-- Trip Summary -->
      <section class="section">
        <view class="section-header">
          <text class="section-icon">✨</text>
          <text class="section-overline">当前行程概览</text>
        </view>
        <view class="summary-card">
          <view class="summary-bg-deco"></view>
          <view class="summary-content">
            <text class="summary-title">{{ currentTitle }}</text>
            <text class="summary-date">{{ currentDate }}</text>
            <view class="summary-tags">
              <text class="tag" v-for="tag in currentTags" :key="tag">{{ tag }}</text>
            </view>
          </view>
        </view>
      </section>

      <!-- Optimization Input -->
      <section class="section">
        <view class="input-header">
          <view class="input-header-left">
            <text class="section-icon">✏️</text>
            <text class="section-overline">告诉行程一下你的想法</text>
          </view>
          <text class="char-count">{{ charCount }} / 500</text>
        </view>
        <view class="input-area">
          <textarea
            class="input-textarea"
            v-model="refineRequest"
            placeholder="例如：'增加更多地道的美食推荐'、'行程安排不要太紧凑' 或 '加入更多适合摄影的景点'..."
            :maxlength="500"
          />
          <button class="voice-btn"><text>🎤</text></button>
        </view>
        <!-- Quick Suggestions -->
        <view class="suggestions">
          <text class="suggestions-label">常用优化方案</text>
          <view class="suggestions-grid">
            <button class="suggestion-chip" v-for="s in suggestions" :key="s.text" @click="refineRequest = s.text">
              <text>{{ s.icon }}</text>
              <text>{{ s.text }}</text>
            </button>
          </view>
        </view>
      </section>

      <!-- Action Button -->
      <section class="section action-section">
        <button
          class="apply-btn"
          :disabled="travelStore.loading || !refineRequest.trim()"
          @click="handleRefine"
        >
          <text class="apply-icon">✨</text>
          <text>立即应用优化</text>
        </button>
        <text class="apply-hint">将根据你的需求优化当前行程</text>
      </section>

      <!-- Decorative Image -->
      <view class="deco-image">
        <image class="deco-img" src="https://tonystark-ai.ccwu.cc/png/4d94c032-2cd5-4e00-8771-b1cd89cb0850.png" mode="aspectFill" />
        <view class="deco-overlay"></view>
        <view class="deco-content">
          <text class="deco-title">每次优化，让旅行更完美</text>
          <text class="deco-sub">行程一下 · 你的私人旅行管家</text>
        </view>
      </view>
    </scroll-view>

    <!-- 优化中状态弹窗 -->
    <view v-if="isRefining" class="refine-overlay" @click.stop>
      <view class="refine-modal">
        <view class="refine-icon">✨</view>
        <view class="refine-info">
          <text class="refine-title">行程优化中</text>
          <text class="refine-sub">预计需要 2-3 分钟，您可以先浏览其他页面</text>
          <text class="refine-time" v-if="refineElapsed">已耗时 {{ refineElapsed }}s</text>
        </view>
        <view class="refine-spinner">
          <view class="spinner-ring"></view>
        </view>
        <button class="refine-close-btn" @click="goBack">
          <text>返回首页浏览</text>
        </button>
      </view>
    </view>

    <!-- 优化完成提示 -->
    <view v-if="showComplete" class="refine-overlay" @click.stop>
      <view class="refine-modal complete">
        <view class="refine-icon complete-icon">🎉</view>
        <view class="refine-info">
          <text class="refine-title">优化完成！</text>
          <text class="refine-sub">行程已根据您的需求优化完成</text>
        </view>
        <button class="refine-view-btn" @click="goToPlan">
          <text>查看优化后的行程</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight } = useSafeArea()

const refineRequest = ref('')
const charCount = computed(() => refineRequest.value.length)

// 优化中状态 - 从 store 获取（持久化）
const isRefining = computed(() => travelStore.refineTask.isRunning)
const showComplete = ref(false)
let refineTimer = null

// 优化耗时
const refineElapsed = computed(() => travelStore.refineTask.elapsed)

// 页面加载时检查是否有正在进行的优化任务
onMounted(() => {
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 1500)
    return
  }

  // 如果有正在进行的优化任务，启动计时器
  if (travelStore.refineTask.isRunning) {
    startRefineTimer()
  }
})

const startRefineTimer = () => {
  if (refineTimer) return
  refineTimer = setInterval(() => {
    if (travelStore.refineTask.startTime) {
      travelStore.refineTask.elapsed = Math.round((Date.now() - travelStore.refineTask.startTime) / 1000)
    }
  }, 1000)
}

const stopRefineTimer = () => {
  if (refineTimer) {
    clearInterval(refineTimer)
    refineTimer = null
  }
}

const cleanup = () => {
  showComplete.value = false
  stopRefineTimer()
}

onUnmounted(() => {
  cleanup()
})

const currentTitle = computed(() => {
  const plan = travelStore.currentPlan
  return plan?.itinerarySummary?.substring(0, 40) || '未命名行程'
})
const currentDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
})
const currentTags = computed(() => ['专属规划', '可优化'])

const suggestions = [
  { icon: '🍜', text: '增加美食推荐' },
  { icon: '📸', text: '加入拍照打卡点' },
  { icon: '😌', text: '行程更轻松一些' },
  { icon: '🏛️', text: '增加文化体验' },
]

const goBack = () => uni.reLaunch({ url: '/pages/index/index' })

const handleRefine = async () => {
  // 检查是否已有优化任务在进行中
  if (travelStore.refineTask.isRunning) {
    uni.showModal({
      title: '优化进行中',
      content: '当前已有优化任务在进行中，请等待完成后再试',
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }

  if (!refineRequest.value.trim()) {
    uni.showToast({ title: '请输入优化需求', icon: 'none' })
    return
  }

  const currentPlan = travelStore.currentPlan
  if (!currentPlan) {
    uni.showToast({ title: '请先创建行程', icon: 'none' })
    return
  }

  try {
    // 提取关键行程信息用于优化（控制数据量）
    const extractKeyInfo = (plan) => {
      if (!plan?.dayPlanItinerary || !Array.isArray(plan.dayPlanItinerary)) {
        return { summary: plan?.itinerarySummary || '', items: [] }
      }

      const dayGroups = {}
      plan.dayPlanItinerary.forEach(item => {
        const dayNum = item.day || 1
        if (!dayGroups[dayNum]) {
          dayGroups[dayNum] = []
        }
        dayGroups[dayNum].push(item)
      })

      const sortedDays = Object.keys(dayGroups).sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 5)
      const dailyItems = sortedDays.map(dayNum => ({
        day: parseInt(dayNum),
        items: dayGroups[dayNum].slice(0, 4).map(item => ({
          name: item.name || '',
          type: item.type || '',
          city: item.city || ''
        }))
      }))

      return {
        summary: plan.itinerarySummary?.substring(0, 200) || '',
        items: dailyItems
      }
    }

    const basePlanInfo = extractKeyInfo(currentPlan)

    // 启动优化，启动计时器
    startRefineTimer()

    const result = await travelStore.refinePlan({
      userInput: currentPlan?.userInput || '',
      modelType: currentPlan?.modelType || 'default',
      isPlannerMode: currentPlan?.isPlannerMode !== false,
      travelMode: currentPlan?.travelMode || 'deep',
      refineInstruction: refineRequest.value,
      basePlan: basePlanInfo
    })

    // 优化完成
    cleanup()
    if (result) {
      showComplete.value = true
      // 3秒后自动跳转
      setTimeout(() => {
        showComplete.value = false
        uni.reLaunch({ url: '/pages/index/index' })
      }, 2500)
    }
  } catch (err) {
    console.error('[Refine] 优化失败:', err)
    cleanup()

    // 检查是否是额度不足错误
    const errorMsg = err.message || ''
    if (errorMsg.includes('次数已用完') || errorMsg.includes('配额') || err.status === 403) {
      uni.showModal({
        title: '次数已用完',
        content: '今日优化次数已用完，邀请好友可获得额外配额',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去邀请',
        success: (res) => {
          if (res.confirm) {
            // 跳转到我的页面邀请好友
            uni.navigateTo({ url: '/pages/mine/index' })
          }
        }
      })
    } else {
      uni.showToast({ title: errorMsg || '优化失败，请稍后重试', icon: 'none' })
    }
  }
}

const goToPlan = () => {
  showComplete.value = false
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<style scoped>
.refine-page { min-height: 100vh; background: #f8f9fa; }

.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16rpx 40rpx;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
  position: sticky; top: 0; z-index: 10;
}
.top-left { display: flex; align-items: center; gap: 12px; }
.back-btn {
  width: 36px; height: 36px; display: flex; align-items: center;
  justify-content: center; font-size: 20px; color: var(--color-primary);
  background: transparent; border: none; padding: 0;
}
.back-btn::after { border: none; }
.top-title { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; line-height: 32px; }
.more-btn {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: var(--color-primary);
  background: transparent; border: none;
}
.more-btn::after { border: none; }

.content { padding: 16rpx 40rpx 80rpx; }

.section { margin-bottom: 24px; }
.section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.section-icon { font-size: 18px; }
.section-overline {
  font-size: 11px; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
}

.summary-card {
  position: relative; overflow: hidden; border-radius: 24px;
  background: rgba(255,255,255,0.6);
  padding: 40rpx; border: 1px solid rgba(255,255,255,0.4);
  box-shadow: 0 8px 24px rgba(0,0,0,0.04);
}
.summary-bg-deco {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(15,76,92,0.03) 0%, transparent 100%);
}
.summary-content { position: relative; z-index: 1; }
.summary-title { font-size: 18px; font-weight: 700; color: var(--color-primary); line-height: 28px; margin-bottom: 8px; display: block; }
.summary-date { font-size: 13px; color: var(--color-on-surface-variant); opacity: 0.7; }
.summary-tags { display: flex; gap: 8px; margin-top: 8px; }
.tag { font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 999px; background: var(--color-primary-fixed); color: var(--color-primary); }

.input-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.input-header-left { display: flex; align-items: center; gap: 8px; }
.char-count { font-size: 12px; color: var(--color-outline); opacity: 0.5; }

.input-area {
  display: flex; align-items: flex-end; gap: 12px;
  background: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 24px;
  padding: 40rpx;
}
.input-textarea {
  flex: 1; min-height: 90px;
  background: transparent; border: none; resize: none;
  font-size: 15px; line-height: 24px;
  color: var(--color-on-surface);
}
.input-textarea::placeholder { color: var(--color-on-surface-variant); opacity: 0.4; }
.voice-btn {
  width: 44px; height: 44px; border-radius: 12px;
  background: rgba(255,255,255,0.8); border: 1px solid #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}

.suggestions { margin-top: 48rpx; }
.suggestions-label {
  font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
  margin-bottom: 16px; display: block;
}
.suggestions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.suggestion-chip {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 24rpx 32rpx;
  background: #fff; border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  font-size: 14px; font-weight: 600; color: var(--color-primary);
}

.action-section { margin-top: 48rpx; display: flex; flex-direction: column; align-items: center; }
.apply-btn {
  width: 100%; height: 56px;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 50%, #0F4C5C 100%);
  background-size: 200% 200%;
  border-radius: 16px; color: #fff;
  font-size: 18px; font-weight: 700; line-height: 28px;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  box-shadow: 0 12px 24px rgba(15,76,92,0.3);
}
.apply-btn[disabled] { opacity: 0.5; }
.apply-icon { font-size: 24px; }
.apply-hint {
  margin-top: 16px; font-size: 12px; font-weight: 500;
  color: var(--color-outline); opacity: 0.6;
}

.deco-image {
  position: relative; overflow: hidden; border-radius: 24px;
  height: 176px; margin-top: 32px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.deco-img { width: 100%; height: 100%; }
.deco-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 100%);
}
.deco-content {
  position: absolute; bottom: 40rpx; left: 48rpx; right: 48rpx;
}
.deco-title { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; line-height: 28px; }
.deco-sub { font-size: 14px; color: rgba(255,255,255,0.8); font-weight: 500; }

/* 优化中弹窗 */
.refine-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(8px);
}
.refine-modal {
  width: 80%; max-width: 320px;
  background: #fff; border-radius: 24px;
  padding: 40rpx; text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: modal-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes modal-pop {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.refine-modal.complete {
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  color: #fff;
}
.refine-icon {
  font-size: 48px; margin-bottom: 16px;
  animation: icon-bounce 1s ease-in-out infinite;
}
.refine-icon.complete-icon {
  animation: icon-pop 0.5s cubic-bezier(0.17, 0.67, 0.12, 0.99);
}
@keyframes icon-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes icon-pop {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
.refine-info { margin-bottom: 24px; }
.refine-title {
  font-size: 20px; font-weight: 700;
  color: var(--color-primary); margin-bottom: 8px;
  display: block;
}
.refine-modal.complete .refine-title {
  color: #fff;
}
.refine-sub {
  font-size: 14px; color: var(--color-on-surface-variant);
  opacity: 0.7; line-height: 1.5;
  display: block;
}
.refine-modal.complete .refine-sub {
  color: rgba(255,255,255,0.8);
}
.refine-time {
  font-size: 12px; color: var(--color-primary);
  margin-top: 8px; display: block;
}
.refine-modal.complete .refine-time {
  color: rgba(255,255,255,0.6);
}
.refine-spinner {
  margin: 20px auto;
  width: 60px; height: 60px;
}
.spinner-ring {
  width: 100%; height: 100%;
  border: 4px solid rgba(15,76,92,0.1);
  border-top-color: #0F4C5C;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.refine-close-btn {
  width: 100%; height: 48px;
  background: var(--color-surface-container);
  border-radius: 12px;
  font-size: 15px; font-weight: 600;
  color: var(--color-on-surface-variant);
  border: none;
}
.refine-close-btn::after { border: none; }
.refine-close-btn:active { opacity: 0.7; }
.refine-view-btn {
  width: 100%; height: 48px;
  background: #fff; border-radius: 12px;
  font-size: 15px; font-weight: 600;
  color: #0F4C5C; border: none;
}
.refine-view-btn::after { border: none; }
.refine-view-btn:active { opacity: 0.8; }
</style>
