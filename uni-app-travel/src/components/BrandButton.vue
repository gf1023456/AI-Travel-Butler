<template>
  <button :class="['brand-btn', `brand-btn-${size}`, { 'brand-btn-disabled': disabled, 'brand-btn-loading': loading }]" :disabled="disabled || loading" @click="$emit('click')">
    <text v-if="loading" class="brand-btn-spinner">⏳</text>
    <text v-else-if="icon" class="brand-btn-icon">{{ icon }}</text>
    <text>{{ text }}</text>
  </button>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' },
  icon: { type: String, default: '' },
  size: { type: String, default: 'lg', validator: v => ['sm', 'md', 'lg'].includes(v) },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})
defineEmits(['click'])
</script>

<style scoped>
.brand-btn {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  background: var(--gradient-brand);
  color: #fff; border: none; border-radius: 999px;
  font-weight: 600; position: relative; overflow: hidden;
  box-shadow: var(--shadow-button);
  transition: all var(--transition-fast);
}
.brand-btn::after { border: none; }
.brand-btn:active { transform: scale(0.97); filter: brightness(1.1); }

.brand-btn-lg { height: 64px; font-size: 20px; line-height: 28px; width: 100%; border-radius: 24px; }
.brand-btn-md { height: 56px; font-size: 17px; line-height: 24px; padding: 0 32px; }
.brand-btn-sm { height: 48px; font-size: 14px; line-height: 20px; padding: 0 24px; }

.brand-btn-disabled { opacity: 0.5; pointer-events: none; }
.brand-btn-loading { opacity: 0.8; pointer-events: none; }
.brand-btn-icon { font-size: 20px; }
.brand-btn-spinner { font-size: 18px; animation: brand-spin 1s linear infinite; }
@keyframes brand-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
