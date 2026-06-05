<template>
  <view class="onboarding-page">
    <swiper
      class="onboarding-swiper"
      :current="currentIndex"
      @change="onSwipeChange"
      :indicator-dots="false"
      :autoplay="false"
      circular
    >
      <swiper-item v-for="(page, idx) in pages" :key="idx">
        <view class="onboarding-slide">
          <view class="slide-visual">
            <text class="slide-emoji">{{ page.emoji }}</text>
            <view class="slide-glow"></view>
          </view>
          <view class="slide-content">
            <text class="slide-title">{{ page.title }}</text>
            <text class="slide-desc">{{ page.desc }}</text>
          </view>
        </view>
      </swiper-item>
    </swiper>

    <!-- Indicators -->
    <view class="onboarding-indicators">
      <view
        v-for="(page, idx) in pages"
        :key="idx"
        :class="['indicator-dot', idx === currentIndex ? 'indicator-active' : '']"
      ></view>
    </view>

    <!-- Actions -->
    <view class="onboarding-actions" :style="{ paddingBottom: (24 + safeAreaBottom) + 'px' }">
      <button v-if="currentIndex < pages.length - 1" class="skip-btn" @click="handleSkip">
        <text>跳过</text>
      </button>
      <view v-else style="width: 60px;"></view>
      <button class="next-btn" @click="handleNext">
        <text>{{ currentIndex === pages.length - 1 ? '开始探索' : '下一步' }}</text>
        <text v-if="currentIndex < pages.length - 1">→</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useSafeArea } from '@/utils/safeArea.js'

const { safeAreaBottom } = useSafeArea()

const currentIndex = ref(0)

const pages = [
  {
    emoji: '🌍',
    title: '智能行程规划',
    desc: '只需输入你的旅行想法，慧游 AI 即可为你量身定制完整行程方案，从景点到美食一网打尽'
  },
  {
    emoji: '🗺️',
    title: '地图交互体验',
    desc: '在地图上直观查看行程路线，一键导航到目的地，旅行途中不再迷路'
  },
  {
    emoji: '📤',
    title: '一键分享海报',
    desc: '生成专属旅行海报，一键分享到朋友圈或好友，让你的精彩行程被更多人看见'
  }
]

const onSwipeChange = (e) => {
  currentIndex.value = e.detail.current
}

const handleNext = () => {
  if (currentIndex.value < pages.length - 1) {
    currentIndex.value++
  } else {
    completeOnboarding()
  }
}

const handleSkip = () => {
  completeOnboarding()
}

const completeOnboarding = () => {
  uni.setStorageSync('onboarding_completed', 'true')
  uni.reLaunch({ url: '/pages/login/index' })
}
</script>

<style scoped>
.onboarding-page {
  min-height: 100vh; background: var(--color-surface);
  display: flex; flex-direction: column;
}
.onboarding-swiper { flex: 1; width: 100%; }
.onboarding-slide {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100%;
  padding: 120rpx 64rpx;
}
.slide-visual {
  position: relative; margin-bottom: 80rpx;
  display: flex; align-items: center; justify-content: center;
}
.slide-emoji { font-size: 120px; z-index: 1; }
.slide-glow {
  position: absolute; width: 240px; height: 240px; border-radius: 50%;
  background: radial-gradient(circle, rgba(0,6,102,0.08) 0%, transparent 70%);
}
.slide-content {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 16px; max-width: 600rpx;
}
.slide-title {
  font-size: 28px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.02em; line-height: 36px;
}
.slide-desc {
  font-size: 15px; line-height: 26px; color: var(--color-on-surface-variant);
  font-weight: 400;
}

.onboarding-indicators {
  display: flex; justify-content: center; gap: 8px;
  padding: 32rpx 0;
}
.indicator-dot {
  width: 8px; height: 8px; border-radius: 4px;
  background: var(--color-outline-variant); opacity: 0.4;
  transition: all 0.3s ease;
}
.indicator-active {
  width: 24px; background: var(--color-primary); opacity: 1;
}

.onboarding-actions {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24rpx 48rpx;
}
.skip-btn {
  padding: 12px 24px; color: var(--color-outline);
  font-size: 16px; font-weight: 500;
}
.next-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 32px; border-radius: 999px;
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  color: #fff; font-size: 17px; font-weight: 700;
  box-shadow: 0 8px 24px rgba(0,6,102,0.25);
}
.next-btn:active { transform: scale(0.97); }
</style>
