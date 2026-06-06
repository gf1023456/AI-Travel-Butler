<template>
  <view v-if="visible" class="bs-overlay" @click="$emit('close')">
    <view class="bs-container" @click.stop>
      <view class="bs-handle"></view>
      <slot />
    </view>
  </view>
</template>

<script setup>
defineProps({ visible: { type: Boolean, default: false } })
defineEmits(['close'])
</script>

<style scoped>
.bs-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(6px);
  display: flex; align-items: flex-end;
}
.bs-container {
  width: 100%; max-height: 85vh;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border-radius: 32px 32px 0 0;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.08);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.bs-handle {
  width: 36px; height: 5px; border-radius: 999px;
  background: var(--color-outline-variant); opacity: 0.5;
  align-self: center; margin: 12px auto 4px; flex-shrink: 0;
}
</style>
