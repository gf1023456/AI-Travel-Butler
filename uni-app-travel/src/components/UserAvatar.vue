<template>
  <view class="user-info" @click="$emit('click')">
    <image class="user-avatar" :src="avatarUrl" mode="aspectFill" />
    <view class="user-detail" v-if="showName">
      <text class="user-name">{{ nickname }}</text>
      <slot name="extra" />
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/store/user.js'

const props = defineProps({
  showName: { type: Boolean, default: true },
  size: { type: String, default: 'md' } // sm | md | lg
})

defineEmits(['click'])

const userStore = useUserStore()

const avatarUrl = computed(() =>
  userStore.avatarUrl || 'https://ui-avatars.com/api/?name=慧游&background=1a237e&color=fff&size=256'
)

const nickname = computed(() => userStore.nickname || '慧游')
</script>

<style scoped>
.user-info { display: flex; align-items: center; gap: 12px; }
.user-avatar {
  border-radius: 50%; border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
/* Size variants */
.user-avatar { width: 40px; height: 40px; }
.user-detail { display: flex; flex-direction: column; gap: 2px; }
.user-name {
  font-size: 16px; font-weight: 600; color: var(--color-primary);
  letter-spacing: -0.01em; line-height: 22px;
}
</style>
