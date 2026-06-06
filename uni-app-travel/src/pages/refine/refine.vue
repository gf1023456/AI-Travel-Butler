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
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight } = useSafeArea()

const refineRequest = ref('')
const charCount = computed(() => refineRequest.value.length)

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

onMounted(() => {
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 1500)
  }
})

const goBack = () => uni.reLaunch({ url: '/pages/index/index' })

const handleRefine = async () => {
  if (!refineRequest.value.trim()) {
    uni.showToast({ title: '请输入优化需求', icon: 'none' })
    return
  }
  try {
    const result = await travelStore.refinePlanV4({
      refineRequest: refineRequest.value,
      currentPlan: travelStore.currentPlan
    })
    if (result) {
      uni.showToast({ title: '优化完成', icon: 'success' })
      uni.reLaunch({ url: '/pages/index/index' })
    }
  } catch {
    uni.showToast({ title: '优化失败，请稍后重试', icon: 'none' })
  }
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
</style>
