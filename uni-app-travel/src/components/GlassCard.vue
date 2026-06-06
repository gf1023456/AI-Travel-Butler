<template>
  <view :class="['glass-card', heavy ? 'glass-card-heavy' : 'glass-card-light']" :style="customStyle">
    <slot />
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  radius: { type: String, default: '16px' },
  heavy: { type: Boolean, default: false },
  padding: { type: String, default: '' }
})

const customStyle = computed(() => ({
  borderRadius: props.radius,
  padding: props.padding
}))
</script>

<style scoped>
.glass-card-light {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--shadow-glass);
}
.glass-card-heavy {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
</style>
