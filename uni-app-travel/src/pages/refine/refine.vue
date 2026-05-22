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
            <text class="section-overline">告诉慧游你的想法</text>
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
        <text class="apply-hint">慧游 将为您重新生成最优路线</text>
      </section>

<!--      &lt;!&ndash; Decorative Visual &ndash;&gt;-->
<!--      <view class="deco-image">-->
<!--        <image class="deco-img" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvaIBpvSfc7bQdB9Eyz-qbNj0HwauVvGllVjqsfxny-ctimt6M4tS2QwntgTeb2Q1bSZI2-uK13weAGS26NEGecLp7LT7YVok6UJNMO61aFQSN-8SIDchRAkmM0jeABJAUdcjbGDTg2ZPGsHLU8oxq6J1XRuL2fGtuaySVhZzwNhHRwLbHCP5Ppo_2GZCCtQ5-wP8H9kD44BpsojqgU2T9QoTHH_AK-m_gvKWV69xHpn2KecwEKfFOe5ps4v5lLp-9dIkhBkJJIx0" mode="aspectFill" />-->
<!--        <view class="deco-overlay"></view>-->
<!--        <view class="deco-content">-->
<!--          <text class="deco-title">灵感启发</text>-->
<!--          <text class="deco-sub">探索京都最隐秘的红叶观赏点</text>-->
<!--        </view>-->
<!--      </view>-->
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'

const travelStore = useTravelStore()
const { statusBarHeight } = useSafeArea()
const refineRequest = ref('')
const charCount = computed(() => refineRequest.value.length)

const currentTitle = computed(() => {
  return travelStore.currentPlan?.itinerarySummary?.substring(0, 20) || '京都秋意之旅'
})
const currentDate = computed(() => {
  return '11月15日 - 11月20日 (6天)'
})
const currentTags = computed(() => {
  const items = travelStore.currentPlan?.dayPlanItinerary || []
  const names = items.slice(0, 3).map(i => i.name).filter(Boolean)
  const more = items.length > 3 ? items.length - 3 : 0
  return [...names, ...(more ? [`+${more} 更多`] : [])]
})

const suggestions = [
  { icon: '🍲', text: '更多特色餐厅' },
  { icon: '☕', text: '寻找精品咖啡' },
  { icon: '🚶', text: '减少步行距离' },
  { icon: '📸', text: '增加网红打卡' }
]

const goBack = () => uni.navigateBack()

const handleRefine = async () => {
  if (!refineRequest.value.trim()) {
    uni.showToast({ title: '请输入优化需求', icon: 'none' }); return
  }
  if (!travelStore.currentPlan) {
    uni.showToast({ title: '请先创建行程', icon: 'none' }); return
  }
  try {
    uni.showLoading({ title: '正在优化...' })
    await travelStore.refinePlan({
      userInput: travelStore.currentPlan.userInput || '',
      modelType: travelStore.currentPlan.modelType || 'auto',
      isPlannerMode: travelStore.currentPlan.isPlannerMode || false,
      travelMode: travelStore.currentPlan.travelMode || 'deep',
      refineInstruction: refineRequest.value,
      basePlan: travelStore.currentPlan
    })
    uni.hideLoading()
    uni.showToast({ title: '优化成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '优化失败', icon: 'error' })
  }
}
</script>

<style scoped>
.refine-page { min-height: 100vh; background: var(--color-surface); }

.top-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px 12px;
  background: var(--color-surface); opacity: 0.95;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.top-left { display: flex; align-items: center; gap: 12px; }
.back-btn { font-size: 20px; color: var(--color-primary); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
.top-title { font-size: 20px; font-weight: 600; color: var(--color-primary); line-height: 28px; }
.more-btn { font-size: 24px; color: var(--color-on-surface-variant); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }

.content { padding: 80px 20px 32px; }

.section { margin-bottom: 40px; }
.section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.section-icon { font-size: 18px; color: var(--color-on-primary-container); }
.section-overline {
  font-size: 12px; font-weight: 500; letter-spacing: 0.1em;
  color: var(--color-on-secondary-container); text-transform: uppercase;
}

.summary-card {
  position: relative; overflow: hidden;
  background: #fff; border: 1px solid rgba(255,255,255,0.8);
  border-radius: 16px; padding: 24px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.04);
}
.summary-bg-deco {
  position: absolute; top: 0; right: 0; width: 128px; height: 128px;
  background: var(--color-primary); opacity: 0.03;
  border-radius: 50%; transform: translate(32px, -32px); filter: blur(40px);
}
.summary-content { position: relative; z-index: 1; }
.summary-title { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; margin-bottom: 4px; }
.summary-date { font-size: 14px; color: var(--color-on-surface-variant); opacity: 0.8; margin-bottom: 20px; display: flex; align-items: center; gap: 6px; }
.summary-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.tag {
  padding: 6px 14px; border-radius: 8px;
  background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-variant); opacity: 0.2;
  font-size: 13px; font-weight: 600; color: var(--color-on-surface-variant);
}

.input-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.input-header-left { display: flex; align-items: center; gap: 8px; }
.char-count { font-size: 12px; font-weight: 500; color: var(--color-outline); opacity: 0.6; }

.input-area {
  position: relative;
  background: rgba(255,255,255,0.4); backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 16px; overflow: hidden;
}
.input-textarea {
  width: 100%; height: 160px; padding: 24px;
  font-size: 16px; line-height: 26px; color: var(--color-on-surface);
  background: transparent;
}
.input-textarea::placeholder { color: var(--color-outline-variant); opacity: 0.6; }
.voice-btn {
  position: absolute; bottom: 16px; right: 16px;
  width: 44px; height: 44px; border-radius: 12px;
  background: rgba(255,255,255,0.8); border: 1px solid #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}

.suggestions { margin-top: 24px; }
.suggestions-label {
  font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
  margin-bottom: 16px; display: block;
}
.suggestions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.suggestion-chip {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px;
  background: #fff; border: 1px solid var(--color-outline-variant); opacity: 0.2;
  border-radius: 12px;
  font-size: 14px; font-weight: 600; color: var(--color-primary); opacity: 0.8;
}

.action-section { margin-top: 24px; display: flex; flex-direction: column; align-items: center; }
.apply-btn {
  width: 100%; height: 56px;
  background: linear-gradient(135deg, #000666 0%, #2a3eb1 50%, #1a237e 100%);
  border-radius: 16px; color: #fff;
  font-size: 18px; font-weight: 700; line-height: 28px;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  box-shadow: 0 12px 24px rgba(0,6,102,0.3);
  background-size: 200% 200%;
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
  position: absolute; bottom: 20px; left: 24px; right: 24px;
}
.deco-title { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; line-height: 28px; }
.deco-sub { font-size: 14px; color: rgba(255,255,255,0.8); font-weight: 500; }
</style>
