<template>
  <view :class="['glass-card', heavy ? 'glass-card-heavy' : '', panel ? 'glass-panel' : '']" :style="customStyle">
    <slot />
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  heavy: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
  radius: { type: String, default: '' },
  padding: { type: String, default: '' }
})

const customStyle = computed(() => {
  const s = {}
  if (props.radius) s.borderRadius = props.radius
  if (props.padding) s.padding = props.padding
  return s
})
</script>

<style scoped>
.glass-card {
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
.glass-panel {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.6);
}
</style>
