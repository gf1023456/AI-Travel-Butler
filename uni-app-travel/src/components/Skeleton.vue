<template>
  <view class="skeleton-wrapper">
    <!-- Card skeleton -->
    <view v-if="type === 'card'" class="skeleton-card">
      <view class="skeleton-shimmer skeleton-img"></view>
      <view class="skeleton-card-body">
        <view class="skeleton-shimmer skeleton-title"></view>
        <view class="skeleton-shimmer skeleton-text"></view>
        <view class="skeleton-shimmer skeleton-text short"></view>
      </view>
    </view>

    <!-- Timeline skeleton -->
    <view v-if="type === 'timeline'" class="skeleton-timeline">
      <view class="skeleton-day-header">
        <view class="skeleton-shimmer skeleton-day-badge"></view>
        <view class="skeleton-shimmer skeleton-day-title"></view>
      </view>
      <view v-for="i in count" :key="i" class="skeleton-timeline-item">
        <view class="skeleton-dot-col">
          <view class="skeleton-shimmer skeleton-dot"></view>
        </view>
        <view class="skeleton-item-card">
          <view class="skeleton-shimmer skeleton-item-img"></view>
          <view class="skeleton-item-info">
            <view class="skeleton-shimmer skeleton-item-name"></view>
            <view class="skeleton-shimmer skeleton-item-time"></view>
            <view class="skeleton-shimmer skeleton-item-desc"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- Quick card skeleton (for map page) -->
    <view v-if="type === 'quick-card'" class="skeleton-quick-card">
      <view class="skeleton-shimmer skeleton-quick-img"></view>
      <view class="skeleton-quick-info">
        <view class="skeleton-shimmer skeleton-quick-tag"></view>
        <view class="skeleton-shimmer skeleton-quick-title"></view>
        <view class="skeleton-shimmer skeleton-quick-desc"></view>
      </view>
    </view>

    <!-- Inline skeleton (generating animation) -->
    <view v-if="type === 'inline'" class="skeleton-generating">
      <!-- Animated glow background -->
      <view class="skeleton-gen-glow"></view>
      <!-- Central icon with pulse ring -->
      <view class="skeleton-gen-center">
        <view class="skeleton-gen-rings">
          <view class="gen-ring ring-1"></view>
          <view class="gen-ring ring-2"></view>
          <view class="gen-ring ring-3"></view>
        </view>
        <view class="skeleton-gen-icon">{{ icon || '✨' }}</view>
      </view>
      <!-- Status text -->
      <view class="skeleton-gen-info">
        <text class="skeleton-gen-title">{{ statusText }}</text>
        <text class="skeleton-gen-sub" v-if="elapsed > 0">已等待 {{ elapsed }} 秒</text>
      </view>
      <!-- Dots loading -->
      <view class="skeleton-gen-dots">
        <view class="gen-dot" v-for="i in 3" :key="i" :style="{ animationDelay: (i * 0.2) + 's' }"></view>
      </view>
      <!-- Progress bar -->
      <view class="skeleton-gen-bar-wrap">
        <view class="skeleton-gen-bar">
          <view class="skeleton-gen-bar-inner" :style="{ width: progress + '%' }">
            <view class="gen-bar-shimmer"></view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  type: { type: String, default: 'card' }, // card | timeline | quick-card | inline
  count: { type: Number, default: 3 },
  icon: { type: String, default: '' },
  statusText: { type: String, default: '正在加载...' },
  elapsed: { type: [Number, String], default: 0 },
  progress: { type: Number, default: 0 }
})
</script>

<style scoped>
/* Shimmer animation */
.skeleton-shimmer {
  background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite ease-in-out;
  border-radius: 6px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Card skeleton */
.skeleton-card {
  display: flex; gap: 16px; padding: 16px;
  background: rgba(255,255,255,0.5); border-radius: 16px;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.3);
}
.skeleton-img { width: 96px; height: 96px; border-radius: 12px; flex-shrink: 0; }
.skeleton-card-body { flex: 1; display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.skeleton-title { width: 60%; height: 20px; }
.skeleton-text { width: 90%; height: 14px; }
.skeleton-text.short { width: 50%; }

/* Timeline skeleton */
.skeleton-timeline { padding-bottom: 16px; }
.skeleton-day-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.skeleton-day-badge { width: 44px; height: 44px; border-radius: 50%; }
.skeleton-day-title { width: 120px; height: 20px; }
.skeleton-timeline-item { display: flex; gap: 12px; margin-bottom: 24px; }
.skeleton-dot-col { display: flex; flex-direction: column; align-items: center; padding-top: 8px; width: 20px; flex-shrink: 0; }
.skeleton-dot { width: 16px; height: 16px; border-radius: 50%; }
.skeleton-item-card {
  flex: 1; display: flex; gap: 16px;
  padding: 16px; border-radius: 16px;
  background: rgba(255,255,255,0.5);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.3);
}
.skeleton-item-img { width: 96px; height: 96px; border-radius: 12px; flex-shrink: 0; }
.skeleton-item-info { flex: 1; display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.skeleton-item-name { width: 70%; height: 18px; }
.skeleton-item-time { width: 40%; height: 14px; }
.skeleton-item-desc { width: 90%; height: 14px; }

/* Quick card skeleton */
.skeleton-quick-card {
  display: flex; gap: 16px; padding: 20px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 28px;
}
.skeleton-quick-img { width: 96px; height: 96px; border-radius: 16px; flex-shrink: 0; }
.skeleton-quick-info { flex: 1; display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.skeleton-quick-tag { width: 60px; height: 18px; border-radius: 999px; }
.skeleton-quick-title { width: 80%; height: 22px; }
.skeleton-quick-desc { width: 100%; height: 14px; }

/* Generating skeleton - large and impressive */
.skeleton-generating {
  position: relative; overflow: hidden;
  padding: 60rpx 48rpx;
  border-radius: 24px;
  background: rgba(255,255,255,0.5);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255,255,255,0.4);
  display: flex; flex-direction: column; align-items: center;
  gap: 20rpx;
}
.skeleton-gen-glow {
  position: absolute; top: -40%; left: 50%;
  width: 300px; height: 300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(0,6,102,0.06) 0%, transparent 60%);
  animation: gen-glow-pulse 2.5s infinite ease-in-out;
  transform: translateX(-50%);
}
@keyframes gen-glow-pulse {
  0%, 100% { opacity: 0.4; transform: translateX(-50%) scale(1); }
  50% { opacity: 1; transform: translateX(-50%) scale(1.3); }
}

.skeleton-gen-center {
  position: relative; z-index: 1;
  width: 120px; height: 120px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8rpx;
}
.skeleton-gen-icon {
  font-size: 56px; z-index: 2;
  animation: gen-icon-bounce 1.8s infinite ease-in-out;
}
@keyframes gen-icon-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.skeleton-gen-rings {
  position: absolute; inset: 0;
}
.gen-ring {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid rgba(0,6,102,0.12);
  animation: ring-expand 2s infinite ease-out;
}
.ring-2 { animation-delay: 0.4s; }
.ring-3 { animation-delay: 0.8s; }
@keyframes ring-expand {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}

.skeleton-gen-info {
  text-align: center; z-index: 1;
}
.skeleton-gen-title {
  font-size: 18px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.01em; display: block; margin-bottom: 4px;
}
.skeleton-gen-sub {
  font-size: 13px; color: var(--color-outline); display: block;
}

/* Animated dots */
.skeleton-gen-dots {
  display: flex; gap: 10px; z-index: 1;
}
.gen-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--color-primary);
  animation: dot-bounce 0.6s infinite alternate ease-in-out;
}
@keyframes dot-bounce {
  0% { transform: translateY(0); opacity: 0.3; }
  100% { transform: translateY(-10px); opacity: 1; }
}

/* Brand gradient progress bar */
.skeleton-gen-bar-wrap {
  width: 100%; max-width: 320rpx; z-index: 1;
}
.skeleton-gen-bar {
  width: 100%; height: 8px; background: rgba(0,6,102,0.06);
  border-radius: 4px; overflow: hidden;
}
.skeleton-gen-bar-inner {
  height: 100%; position: relative; overflow: hidden;
  background: linear-gradient(90deg, #000666, #1a237e);
  border-radius: 4px; transition: width 0.5s ease;
}
.gen-bar-shimmer {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
  background-size: 200% 100%;
  animation: shimmer 2s infinite ease-in-out;
}
</style>
