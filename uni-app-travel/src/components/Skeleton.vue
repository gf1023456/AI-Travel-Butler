<template>
  <view class="skeleton-wrapper" v-if="visible">
    <!-- Central bounce icon -->
    <view class="skeleton-center">
      <view class="skeleton-icon-wrap">
        <view class="skeleton-ring ring-1"></view>
        <view class="skeleton-ring ring-2"></view>
        <view class="skeleton-ring ring-3"></view>
        <text class="skeleton-main-icon">{{ icon }}</text>
      </view>
      <text class="skeleton-title">{{ title }}</text>
      <text v-if="subtitle" class="skeleton-subtitle">{{ subtitle }}</text>
    </view>

    <!-- Skeleton card shimmer -->
    <view class="skeleton-cards">
      <view class="skel-card" v-for="i in cards" :key="i">
        <view class="skel-card-header">
          <view class="skel-circle"></view>
          <view class="skel-lines">
            <view class="skel-line skel-line-long"></view>
            <view class="skel-line skel-line-short"></view>
          </view>
        </view>
        <view class="skel-card-body">
          <view class="skel-line"></view>
          <view class="skel-line skel-line-medium"></view>
        </view>
      </view>
    </view>

    <!-- Bouncing dots -->
    <view class="skeleton-dots">
      <view class="skel-dot" v-for="i in 3" :key="i" :style="{ animationDelay: (i * 0.15) + 's' }"></view>
    </view>

    <!-- Progress bar -->
    <view class="skeleton-progress">
      <view class="skel-progress-bar" :style="{ width: progress + '%' }">
        <view class="skel-progress-shimmer"></view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: true },
  icon: { type: String, default: '🧭' },
  title: { type: String, default: '正在规划行程...' },
  subtitle: { type: String, default: '' },
  cards: { type: Number, default: 3 },
  progress: { type: Number, default: 0 }
})
</script>

<style scoped>
.skeleton-wrapper {
  display: flex; flex-direction: column; align-items: center;
  padding: 48rpx 40rpx; gap: 40rpx;
}

/* Center icon + rings */
.skeleton-center { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.skeleton-icon-wrap { position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; }
.skeleton-main-icon { font-size: 48px; z-index: 2; animation: skel-bounce 1.5s ease-in-out infinite; }
.skeleton-ring {
  position: absolute; border-radius: 50%;
  border: 2px solid transparent;
  animation: skel-pulse 2s ease-in-out infinite;
}
.ring-1 { inset: 0; border-color: rgba(15,76,92,0.2); animation-delay: 0s; }
.ring-2 { inset: -12px; border-color: rgba(20,184,166,0.15); animation-delay: 0.4s; }
.ring-3 { inset: -24px; border-color: rgba(15,76,92,0.1); animation-delay: 0.8s; }

.skeleton-title { font-size: 18px; font-weight: 700; color: var(--color-primary); animation: skel-fade 2s ease-in-out infinite; }
.skeleton-subtitle { font-size: 13px; color: var(--color-on-surface-variant); opacity: 0.6; }

/* Card shimmer blocks */
.skeleton-cards { width: 100%; display: flex; flex-direction: column; gap: 16px; }
.skel-card {
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 20px; padding: 24px;
  box-shadow: var(--shadow-glass);
  overflow: hidden; position: relative;
}
.skel-card::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.08) 50%, transparent 100%);
  animation: skel-shimmer 2s infinite linear;
}
.skel-card-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
.skel-circle { width: 48px; height: 48px; border-radius: 50%; background: rgba(15,76,92,0.1); flex-shrink: 0; }
.skel-lines { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.skel-line { height: 12px; border-radius: 6px; background: rgba(15,76,92,0.06); }
.skel-line-long { width: 70%; }
.skel-line-short { width: 45%; }
.skel-line-medium { width: 55%; }
.skel-card-body { display: flex; flex-direction: column; gap: 10px; }

/* Bouncing dots */
.skeleton-dots { display: flex; gap: 10px; align-items: center; }
.skel-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--color-primary-container);
  animation: skel-dot-bounce 1.4s ease-in-out infinite;
}

/* Progress bar */
.skeleton-progress { width: 100%; max-width: 280px; }
.skel-progress-bar {
  height: 6px; border-radius: 3px;
  background: var(--gradient-brand);
  transition: width 0.5s ease;
  position: relative; overflow: hidden;
}
.skel-progress-shimmer {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%);
  animation: skel-shimmer 1.5s infinite linear;
}

/* Keyframes */
@keyframes skel-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-12px) scale(1.1); }
}
@keyframes skel-pulse {
  0%, 100% { transform: scale(0.95); opacity: 0.5; }
  50% { transform: scale(1.05); opacity: 1; }
}
@keyframes skel-fade {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
@keyframes skel-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
@keyframes skel-dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
