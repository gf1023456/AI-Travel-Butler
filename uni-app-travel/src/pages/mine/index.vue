<template>
  <view class="mine-page">
    <header class="top-bar">
      <view class="top-left">
        <image class="top-avatar" :src="userAvatar" mode="aspectFill" />
        <text class="top-brand">慧游</text>
      </view>
      <button class="top-notif">
        <text>🔔</text>
      </button>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false">
      <!-- Profile Header -->
      <section class="profile-section">
        <view class="profile-row">
          <view class="avatar-wrap">
            <view class="avatar-glow"></view>
            <image class="profile-avatar" :src="userInfo.avatar || defaultAvatar" mode="aspectFill" />
            <view class="verified-badge">
              <text>✓</text>
            </view>
          </view>
          <view class="profile-details">
            <text class="profile-name">{{ userInfo.nickname || '微信用户' }}</text>
            <view class="profile-badge">
              <text>⭐</text>
              <text>精英旅行者</text>
            </view>
          </view>
        </view>
      </section>

      <!-- Quota Card -->
      <section class="quota-card">
        <view class="quota-header">
          <text class="quota-label">旅行规划配额</text>
          <view class="quota-bonus">含 2 次额外奖励</view>
        </view>
        <view class="quota-numbers">
          <text class="quota-current">{{ quotaInfo.remaining }}</text>
          <text class="quota-total">/ {{ quotaInfo.max }}</text>
        </view>
        <view class="quota-bar-bg">
          <view class="quota-bar" :style="{ width: Math.min(100, ((quotaInfo.used + quotaInfo.bonus) / quotaInfo.max) * 100) + '%' }">
            <view class="quota-bar-shimmer"></view>
          </view>
        </view>
        <view class="quota-footer">
          <text>已使用：{{ quotaInfo.used }} 次</text>
          <text>12 天后重置</text>
        </view>
      </section>

      <!-- Bento Menu -->
      <section class="menu-section">
        <view class="menu-card">
          <view class="menu-item" @click="goTo('/pages/history/index')">
            <view class="menu-item-left">
              <view class="menu-icon" style="background: var(--color-primary-fixed); opacity: 0.3;">
                <text style="color: var(--color-primary); font-size: 24px;">📅</text>
              </view>
              <text class="menu-item-title">我的行程</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="menu-item" @click="showDevToast">
            <view class="menu-item-left">
              <view class="menu-icon" style="background: var(--color-secondary-fixed); opacity: 0.3;">
                <text style="color: var(--color-secondary); font-size: 24px;">⚙️</text>
              </view>
              <text class="menu-item-title">设置</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="menu-item" @click="showDevToast">
            <view class="menu-item-left">
              <view class="menu-icon" style="background: var(--color-tertiary-fixed); opacity: 0.3;">
                <text style="color: var(--color-tertiary); font-size: 24px;">💬</text>
              </view>
              <text class="menu-item-title">帮助与反馈</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </section>

      <!-- Logout -->
      <section class="logout-section">
        <button class="logout-btn" @click="handleLogout">
          <text class="logout-icon">🚪</text>
          <text>退出登录</text>
        </button>
      </section>
    </scroll-view>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <button class="nav-item" @click="reLaunch('/pages/index/index')">
        <text class="nav-item-icon">🧭</text>
        <text class="nav-item-label">探索</text>
      </button>
      <button class="nav-item" @click="reLaunch('/pages/plan/plan')">
        <text class="nav-item-icon">📅</text>
        <text class="nav-item-label">行程</text>
      </button>
      <button class="nav-item nav-active">
        <text class="nav-item-icon">👤</text>
        <text class="nav-item-label">我的</text>
      </button>
    </nav>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user.js'
import { getUserInfo } from '@/api/user.js'
import { getQuota } from '@/api/quota.js'

const userStore = useUserStore()
const defaultAvatar = 'https://ui-avatars.com/api/?name=慧游&background=1a237e&color=fff&size=256'
const userAvatar = computed(() => userStore.avatarUrl || defaultAvatar)

const userInfo = ref({ nickname: '', avatar: '', id: '' })
const quotaInfo = ref({ used: 0, bonus: 0, max: 10, remaining: 10 })

onMounted(async () => {
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    uni.redirectTo({ url: '/pages/login/index' })
    return
  }
  await loadUserInfo()
  await loadQuotaInfo()
})

const loadUserInfo = async () => {
  try {
    const info = await getUserInfo()
    if (info) {
      userInfo.value.nickname = info.nickname || ''
      userInfo.value.avatar = info.avatar_url || ''
      userInfo.value.id = info.id || ''
    }
  } catch {
    userInfo.value.nickname = userStore.nickname || ''
    userInfo.value.avatar = userStore.avatarUrl || ''
  }
}

const loadQuotaInfo = async () => {
  try {
    const quota = await getQuota()
    if (quota) {
      quotaInfo.value = {
        used: quota.used ?? 0, bonus: quota.bonus ?? 0,
        max: quota.max ?? 10, remaining: quota.remaining ?? 0
      }
    }
  } catch {
    quotaInfo.value = userStore.quota || { used: 0, bonus: 0, max: 10, remaining: 10 }
  }
}

const handleLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.clearLogin()
        uni.reLaunch({ url: '/pages/login/index' })
      }
    }
  })
}

const goTo = (url) => uni.navigateTo({ url })
const reLaunch = (url) => uni.reLaunch({ url })
const showDevToast = () => uni.showToast({ title: '页面开发中', icon: 'none' })
</script>

<style scoped>
.mine-page { min-height: 100vh; background: var(--color-surface); }

.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(12px + var(--status-bar-height)) 20px 12px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
  position: sticky; top: 0; z-index: 10;
}
.top-left { display: flex; align-items: center; gap: 12px; }
.top-avatar { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--color-outline-variant); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.top-brand { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; line-height: 32px; }
.top-notif {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: var(--color-primary);
}

.content { padding: 8px 20px 140px; }

.profile-section { margin-bottom: 24px; }
.profile-row { display: flex; align-items: center; gap: 24px; position: relative; }
.avatar-wrap { position: relative; }
.avatar-glow {
  position: absolute; inset: -16px; border-radius: 50%;
  background: radial-gradient(circle, rgba(76,86,175,0.15) 0%, transparent 70%);
}
.profile-avatar {
  width: 80px; height: 80px; border-radius: 50%;
  border: 2px solid #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  position: relative; z-index: 1;
}
.verified-badge {
  position: absolute; bottom: 0; right: 0; z-index: 2;
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--color-primary); border: 2px solid #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.verified-badge text { color: #fff; font-size: 12px; font-weight: 700; }
.profile-details { flex: 1; position: relative; z-index: 1; }
.profile-name { font-size: 20px; font-weight: 700; color: var(--color-on-surface); line-height: 28px; display: block; margin-bottom: 4px; }
.profile-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 999px;
  background: var(--color-secondary-container);
  font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
  color: var(--color-on-secondary-container);
  border: 1px solid rgba(255,255,255,0.3);
}

.quota-card {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 32px; padding: 24px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.03);
  margin-bottom: 24px;
}
.quota-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
.quota-label { font-size: 12px; font-weight: 500; letter-spacing: 0.05em; color: var(--color-on-surface-variant); opacity: 0.8; }
.quota-bonus {
  font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
  color: var(--color-on-secondary-container);
  background: var(--color-secondary-fixed);
  padding: 6px 12px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.2);
}
.quota-numbers { display: flex; align-items: baseline; gap: 4px; margin-bottom: 16px; }
.quota-current { font-size: 36px; font-weight: 700; color: var(--color-primary); line-height: 44px; }
.quota-total { font-size: 20px; font-weight: 600; color: var(--color-on-surface-variant); opacity: 0.6; line-height: 28px; }
.quota-bar-bg { height: 10px; background: var(--color-surface-container); border-radius: 999px; overflow: hidden; margin-bottom: 16px; }
.quota-bar {
  height: 100%; border-radius: 999px;
  background: var(--color-primary); position: relative; overflow: hidden;
}
.quota-bar-shimmer {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
  animation: shimmer 2s infinite linear;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
.quota-footer {
  display: flex; justify-content: space-between;
  font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
}

.menu-section { margin-bottom: 24px; }
.menu-card {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 32px; overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}
.menu-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px; transition: all var(--transition-fast);
}
.menu-item:active { background: rgba(255,255,255,0.4); }
.menu-item-left { display: flex; align-items: center; gap: 20px; }
.menu-icon {
  width: 48px; height: 48px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.4);
}
.menu-item-title { font-size: 16px; font-weight: 500; color: var(--color-on-surface); line-height: 26px; }
.menu-arrow { font-size: 24px; color: var(--color-outline-variant); }
.menu-divider { height: 1px; margin: 0 24px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent); }

.logout-section { margin-top: 16px; }
.logout-btn {
  width: 100%; padding: 16px;
  background: rgba(255,255,255,0.4); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 16px; font-weight: 600; color: var(--color-error);
  line-height: 26px;
  box-shadow: 0 8px 32px rgba(31,38,135,0.07), inset 0 0 0 1px rgba(255,255,255,0.2);
}
.logout-icon { font-size: 20px; }

.bottom-nav {
  position: fixed; bottom: 24px; left: 20px; right: 20px; z-index: 10;
  display: flex; align-items: center; justify-content: space-around;
  height: 80px; padding: 0 8px;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 999px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.1);
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 8px 24px; border-radius: 999px;
  color: var(--color-on-secondary-container); opacity: 0.5;
}
.nav-active {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container); opacity: 1;
  box-shadow: 0 4px 12px rgba(0,6,102,0.15);
  padding: 14px 32px;
}
.nav-item-icon { font-size: 22px; margin-bottom: 2px; }
.nav-item-label { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
</style>
