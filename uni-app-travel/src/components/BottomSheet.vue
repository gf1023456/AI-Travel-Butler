<template>
  <view v-if="visible" class="sheet-overlay" :class="{ 'sheet-show': animShow }" @click="handleOverlayClick">
    <view class="sheet-container" :class="{ 'sheet-container-show': animShow }" @click.stop @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
      <view class="sheet-handle"></view>
      <slot name="swipe-indicator" />
      <view class="sheet-header" v-if="title || $slots.header">
        <slot name="header">
          <text class="sheet-title">{{ title }}</text>
        </slot>
      </view>
      <scroll-view scroll-y class="sheet-body">
        <slot />
      </scroll-view>
      <view class="sheet-footer" v-if="$slots.footer">
        <slot name="footer" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  closeOnOverlay: { type: Boolean, default: true }
})

const emit = defineEmits(['update:visible', 'close'])

const animShow = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => { animShow.value = true })
  } else {
    animShow.value = false
  }
})

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    emit('update:visible', false)
    emit('close')
  }
}

// Touch handling for swipe-to-close
let touchStartY = 0
const onTouchStart = (e) => { touchStartY = e.touches[0].clientY }
const onTouchMove = (e) => {
  if (e.touches.length > 1) return
  const deltaY = e.touches[0].clientY - touchStartY
  if (deltaY > 80) {
    emit('update:visible', false)
    emit('close')
  }
}
const onTouchEnd = () => {}
</script>

<style scoped>
.sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(6px);
  display: flex; align-items: flex-end;
  opacity: 0; transition: opacity 0.25s ease;
}
.sheet-show { opacity: 1; }
.sheet-container {
  width: 100; max-height: 85%;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255,255,255,0.5);
  border-radius: 32px 32px 0 0;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
  display: flex; flex-direction: column;
  overflow: hidden; transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sheet-container-show { transform: translateY(0); }
.sheet-handle {
  width: 36px; height: 5px;
  background: rgba(0,0,0,0.1); border-radius: 2.5px;
  margin: 12px auto; flex-shrink: 0;
}
.sheet-header { padding: 8px 24px 12px; flex-shrink: 0; }
.sheet-title {
  font-size: 22px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.02em; line-height: 28px;
}
.sheet-body { flex: 1; overflow-y: auto; padding: 8px 24px 16px; }
.sheet-footer {
  padding: 16px 24px; flex-shrink: 0;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255,255,255,0.4);
  display: flex; align-items: center; gap: 12px;
}
</style>
