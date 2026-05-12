<template>
  <view :class="['van-tag', typeClass]"><slot /></view>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ type: { type: String, default: 'primary' } })
const typeClass = computed(() => props.type === 'success' ? 'is-success' : 'is-primary')
</script>

<style scoped>
.van-tag { display:inline-flex; align-items:center; justify-content:center; padding:6rpx 14rpx; border-radius:999rpx; font-size:var(--text-xs); font-weight:600; }
.is-primary { background: rgba(37,99,235,.12); color:#2563eb; }
.is-success { background: rgba(16,185,129,.14); color:#059669; }
</style>
