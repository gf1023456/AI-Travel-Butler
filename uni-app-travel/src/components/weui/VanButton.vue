<template>
  <view :class="['van-btn', typeClass, round ? 'is-round' : '', block ? 'is-block' : '']" @click="$emit('click', $event)">
    <slot />
  </view>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  type: { type: String, default: 'primary' },
  round: { type: Boolean, default: true },
  block: { type: Boolean, default: false }
})
const typeClass = computed(() => props.type === 'danger' ? 'is-danger' : 'is-primary')
</script>

<style scoped>
.van-btn { display:inline-flex; align-items:center; justify-content:center; height:72rpx; padding:0 28rpx; font-size:var(--text-sm); font-weight:600; }
.is-primary { background: var(--gradient-primary); color:#fff; }
.is-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color:#fff; }
.is-round { border-radius:999rpx; }
.is-block { width:100%; }
</style>
