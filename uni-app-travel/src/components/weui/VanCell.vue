<template>
  <view class="van-cell" @click="$emit('click', $event)"><slot /></view>
</template>
<script setup>
defineEmits(['click'])
</script>
<style scoped>
.van-cell { background: rgba(255,255,255,.9); border-radius: var(--radius-xl); border:1rpx solid var(--border-glass-strong); box-shadow: var(--shadow-card-soft); }
</style>
