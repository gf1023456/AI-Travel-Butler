<template>
  <view :class="['user-avatar', `user-avatar-${size}`]" :style="{ borderRadius: shape === 'circle' ? '50%' : '12px' }">
    <image v-if="src" :src="src" mode="aspectFill" class="user-avatar-img" />
    <text v-else class="user-avatar-placeholder">{{ placeholder }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '行' },
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg'].includes(v) },
  shape: { type: String, default: 'circle', validator: v => ['circle', 'round'].includes(v) }
})

const placeholder = computed(() => props.name ? props.name.substring(0, 1) : '行')
</script>

<style scoped>
.user-avatar {
  overflow: hidden; flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  background: var(--gradient-brand);
  display: flex; align-items: center; justify-content: center;
}
.user-avatar-sm { width: 32px; height: 32px; }
.user-avatar-md { width: 44px; height: 44px; }
.user-avatar-lg { width: 80px; height: 80px; }
.user-avatar-img { width: 100%; height: 100%; }
.user-avatar-placeholder {
  color: #fff; font-weight: 700;
  font-size: 14px;
}
.user-avatar-sm .user-avatar-placeholder { font-size: 12px; }
.user-avatar-lg .user-avatar-placeholder { font-size: 24px; }
</style>
