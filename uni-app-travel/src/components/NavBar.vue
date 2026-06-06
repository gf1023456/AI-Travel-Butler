<template>
  <header class="nav-bar" :style="{ paddingTop: (statusBarHeight || 12) + 'px' }">
    <view class="nav-bar-left">
      <!-- 返回按钮 -->
      <view v-if="showBack" class="nav-bar-back" @click="$emit('back')">
        <text class="back-arrow">‹</text>
      </view>
      <image v-if="showAvatar && !showBack" class="nav-bar-avatar" :src="avatarSrc" mode="aspectFill" />
      <text class="nav-bar-title">{{ title }}</text>
    </view>
    <view class="nav-bar-right">
      <slot name="right" />
      <view v-if="showNotif" class="nav-bar-notif" @click="$emit('notif')">
        <text>🔔</text>
      </view>
    </view>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/store/user.js'
import { useSafeArea } from '@/utils/safeArea.js'

const props = defineProps({
  title: { type: String, default: '' },
  avatar: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  showAvatar: { type: Boolean, default: false },
  showNotif: { type: Boolean, default: false }
})

const userStore = useUserStore()
const { statusBarHeight } = useSafeArea()

const avatarSrc = computed(() => {
  return props.avatar || userStore.avatarUrl || 'https://ui-avatars.com/api/?name=行程一下&background=1a237e&color=fff&size=64'
})

defineEmits(['back', 'notif'])
</script>

<style scoped>
.nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20rpx 32rpx 16rpx;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(0,0,0,0.05);
  position: fixed; top: 0; left: 0; right: 0; z-index: 999;
  width: 100%;
}
.nav-bar-left {
  display: flex; align-items: center; gap: 10px;
  flex: 1; min-width: 0;
}
.nav-bar-back {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: rgba(255,255,255,0.8);
  border: 1px solid rgba(0,0,0,0.06);
  flex-shrink: 0;
}
.nav-bar-back:active { background: rgba(15,76,92,0.08); }
.back-arrow {
  font-size: 28px; font-weight: 300; color: var(--color-primary);
  line-height: 1; margin-top: -2px;
}
.nav-bar-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,0.06);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  flex-shrink: 0;
}
.nav-bar-title {
  font-size: 20px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.01em; line-height: 28px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.nav-bar-right {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
.nav-bar-notif {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  background: rgba(255,255,255,0.8);
  border: 1px solid rgba(0,0,0,0.06);
}
</style>
