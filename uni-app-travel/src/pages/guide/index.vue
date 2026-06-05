<template>
  <view class="guide-page">
    <!-- 跳过 -->
    <view class="skip-btn" @click="handleSkip" v-if="current < slides.length - 1">
      <text class="skip-text">跳过</text>
    </view>

    <!-- 轮播 -->
    <swiper
      class="swiper"
      :current="current"
      @change="onSwiperChange"
      :duration="350"
      :easing-function="'easeInOutCubic'"
    >
      <swiper-item v-for="(slide, index) in slides" :key="index">
        <view class="slide-wrap">
          <!-- 图示区 -->
          <view class="slide-visual">
            <view class="slide-icon-wrap">
              <image v-if="slide.iconType === 'map'" src="/static/icons/map.svg" style="width:72px;height:72px;" mode="aspectFit" />
              <image v-if="slide.iconType === 'star'" src="/static/icons/star-primary.svg" style="width:72px;height:72px;" mode="aspectFit" />
              <image v-if="slide.iconType === 'search'" src="/static/icons/search.svg" style="width:72px;height:72px;" mode="aspectFit" />
            </view>
          </view>
          <!-- 文案 -->
          <view class="slide-text">
            <text class="slide-title">{{ slide.title }}</text>
            <text class="slide-desc">{{ slide.desc }}</text>
          </view>
        </view>
      </swiper-item>
    </swiper>

    <!-- 底部操作区 -->
    <view class="bottom-bar">
      <!-- 圆点指示器 -->
      <view class="dots">
        <view
          v-for="(slide, index) in slides"
          :key="index"
          class="dot"
          :class="{ active: current === index }"
        />
      </view>

      <!-- 按钮 -->
      <button class="action-btn" @click="handleNext">
        <text class="action-btn-text">{{ current < slides.length - 1 ? '下一步' : '开始使用' }}</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const current = ref(0)

const slides = [
  {
    iconType: 'map',
    title: '行程一下',
    desc: '你的智能旅行伙伴，让每一段旅程都有温度'
  },
  {
    iconType: 'star',
    title: '智能规划',
    desc: '只需说出你的想法，AI 为你量身定制专属行程'
  },
  {
    iconType: 'search',
    title: '灵感探索',
    desc: '发现隐藏的宝藏地点，开启与众不同的旅行体验'
  }
]

const onSwiperChange = (e) => {
  current.value = e.detail.current
}

const handleSkip = () => {
  finishOnboarding()
}

const handleNext = () => {
  if (current.value < slides.length - 1) {
    current.value++
  } else {
    finishOnboarding()
  }
}

const finishOnboarding = () => {
  uni.setStorageSync('onboarding_completed', true)
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<style scoped>
.guide-page {
  width: 100%;
  height: 100vh;
  background: var(--color-surface-container-lowest);
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 跳过 */
.skip-btn {
  position: absolute;
  top: 52px;
  right: 24px;
  z-index: 10;
  padding: 8px 16px;
}

.skip-text {
  font-size: 15px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.35);
  letter-spacing: 0.02em;
}

/* 轮播 */
.swiper {
  flex: 1;
  width: 100%;
}

.slide-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 48px;
  padding-bottom: 120px;
  box-sizing: border-box;
}

/* 图示 */
.slide-visual {
  margin-bottom: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-icon-wrap {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--color-primary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 文案 */
.slide-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.slide-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-on-surface);
  letter-spacing: 0.02em;
  line-height: 1.3;
  margin-bottom: 12px;
}

.slide-desc {
  font-size: 15px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.4);
  letter-spacing: 0.03em;
  line-height: 1.6;
  max-width: 260px;
}

/* 底部操作区 */
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 32px;
  padding-bottom: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

/* 圆点 */
.dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.dot.active {
  width: 20px;
  background: var(--color-primary);
}

/* 按钮 */
.action-btn {
  width: 100%;
  max-width: 340px;
  height: 48px;
  border-radius: 24px;
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  transition: opacity 0.2s, transform 0.15s;
}

.action-btn::after {
  border: none;
}

.action-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.action-btn-text {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.04em;
  line-height: 1;
}
</style>
