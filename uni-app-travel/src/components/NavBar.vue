<template>
  <header class="nav-bar" :style="{ paddingTop: (12 + statusBarHeight) + 'px' }">
    <view class="nav-left">
      <button v-if="showBack" class="nav-back" @click="handleBack">
        <text>←</text>
      </button>
      <image v-if="showAvatar" class="nav-avatar" :src="avatarUrl" mode="aspectFill" />
      <text v-if="brand" class="nav-brand">{{ brand }}</text>
      <text v-if="title" class="nav-title">{{ title }}</text>
      <slot name="left-extra" />
    </view>
    <view class="nav-right">
      <slot name="right" />
      <button v-if="showNotif" class="nav-notif"><text>🔔</text></button>
    </view>
  </header>
  <view v-if="placeholder" class="nav-placeholder" :style="{ height: (80 + statusBarHeight) + 'px' }"></view>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/store/user.js'
import { useSafeArea } from '@/utils/safeArea.js'

const props = defineProps({
  title: { type: String, default: '' },
  brand: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  showAvatar: { type: Boolean, default: false },
  showNotif: { type: Boolean, default: false },
  placeholder: { type: Boolean, default: false },
  backUrl: { type: String, default: '' }
})

const userStore = useUserStore()
const { statusBarHeight } = useSafeArea()

const avatarUrl = computed(() =>
  userStore.avatarUrl || 'https://ui-avatars.com/api/?name=慧游&background=1a237e&color=fff&size=64'
)

const handleBack = () => {
  if (props.backUrl) {
    uni.redirectTo({ url: props.backUrl })
  } else {
    uni.navigateBack()
  }
}
</script>

<style scoped>
.nav-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 24rpx 40rpx 24rpx;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.nav-left { display: flex; align-items: center; gap: 12px; }
.nav-back {
  width: 36px; height: 36px; display: flex; align-items: center;
  justify-content: center; font-size: 20px; color: var(--color-primary);
  background: transparent; border: none; padding: 0;
}
.nav-back::after { border: none; }
.nav-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid var(--color-outline-variant);
  box-shadow: 0 0 0 3px var(--color-surface);
}
.nav-brand {
  font-size: 24px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.01em; line-height: 32px;
}
.nav-title {
  font-size: 24px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.01em; line-height: 32px;
}
.nav-right { display: flex; align-items: center; gap: 12px; }
.nav-notif {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.nav-placeholder { flex-shrink: 0; }
</style>
