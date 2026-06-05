<template>
  <button :class="['brand-btn', `brand-btn-${size}`, block ? 'brand-btn-block' : '']" :disabled="disabled" @click="$emit('click', $event)">
    <text v-if="icon" class="brand-btn-icon">{{ icon }}</text>
    <text><slot /></text>
  </button>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

defineEmits(['click'])
</script>

<style scoped>
.brand-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  color: #fff; font-weight: 600;
  border-radius: 999px; border: none;
  box-shadow: 0 12px 32px rgba(0,6,102,0.25);
  transition: all 0.15s ease;
}
.brand-btn:active { transform: scale(0.97); filter: brightness(1.1); }
.brand-btn[disabled] { opacity: 0.5; }

.brand-btn-sm { padding: 8px 16px; font-size: 12px; }
.brand-btn-md { padding: 12px 24px; font-size: 16px; }
.brand-btn-lg { padding: 16px 32px; font-size: 18px; }

.brand-btn-block { width: 100%; }
.brand-btn-icon { font-size: 1.2em; }
</style>
