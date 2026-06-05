<template>
  <view class="empty-state">
    <view class="empty-icon-wrap">
      <text class="empty-icon">{{ icon }}</text>
    </view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="description" class="empty-desc">{{ description }}</text>
    <button v-if="actionText" class="empty-action" @click="$emit('action')">
      <text>{{ actionText }}</text>
    </button>
  </view>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '✨' },
  title: { type: String, default: '暂无内容' },
  description: { type: String, default: '' },
  actionText: { type: String, default: '' }
})

defineEmits(['action'])
</script>

<style scoped>
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 120rpx 40rpx; gap: 12px;
}
.empty-icon-wrap {
  width: 80px; height: 80px; border-radius: 50%;
  background: var(--color-surface-container-low);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
.empty-icon { font-size: 36px; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--color-on-surface); }
.empty-desc { font-size: 14px; color: var(--color-outline); margin-top: 4px; }
.empty-action {
  margin-top: 16px;
  padding: 12px 32px; border-radius: 999px;
  background: linear-gradient(135deg, #000666 0%, #343d96 100%);
  color: #fff; font-size: 16px; font-weight: 600;
  box-shadow: 0 8px 20px rgba(0,6,102,0.25);
}
</style>
