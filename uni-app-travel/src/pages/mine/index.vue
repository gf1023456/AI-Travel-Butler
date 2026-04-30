<template>
  <view class="mine-page">
    <scroll-view scroll-y class="mine-content">
      <!-- 用户资料头部 -->
      <view class="profile-header" :style="'padding-top:' + (safeAreaTop + 48) + 'px'">
        <view class="profile-info">
          <image class="profile-avatar" :src="userInfo.avatar || defaultAvatar" mode="aspectFill" />
          <view class="profile-details">
            <view class="profile-name-row">
              <text class="profile-name">{{ userInfo.nickname || '微信用户' }}</text>
              <text class="profile-verified">✓</text>
            </view>
            <view class="profile-badge">
              <text class="badge-icon">⭐</text>
              <text class="badge-text">精英旅行者</text>
            </view>
          </view>
        </view>
        <button class="edit-btn" @click="handleEdit">编辑</button>
      </view>

      <!-- 今日配额卡片 -->
      <view class="quota-card">
        <view class="quota-header">
          <text class="quota-title">📊 今日配额</text>
        </view>
        <view class="quota-content">
          <view class="quota-stat">
            <text class="quota-num">{{ quotaInfo.remaining }}</text>
            <text class="quota-label">剩余次数</text>
          </view>
          <view class="quota-divider"></view>
          <view class="quota-stat">
            <text class="quota-num">{{ quotaInfo.used }}</text>
            <text class="quota-label">已使用</text>
          </view>
          <view class="quota-divider"></view>
          <view class="quota-stat">
            <text class="quota-num">{{ quotaInfo.bonus }}</text>
            <text class="quota-label">额外奖励</text>
          </view>
        </view>
        <view class="quota-progress">
          <view class="quota-progress-bar" :style="'width:' + Math.min(100, (quotaInfo.used / quotaInfo.max) * 100) + '%'"></view>
        </view>
      </view>

      <!-- 核心菜单列表 -->
      <view class="menu-card">
        <!-- 我的行程 -->
        <view class="menu-item" @click="reLaunchTo('/pages/history/index')">
          <view class="menu-left">
            <view class="menu-icon-wrapper menu-icon-blue">
              <text class="menu-icon">🧳</text>
            </view>
            <view class="menu-content">
              <text class="menu-title">我的行程</text>
              <text class="menu-desc">管理您的旅行计划</text>
            </view>
          </view>
          <text class="menu-arrow">›</text>
        </view>

        <!-- 设置 -->
        <view class="menu-item" @click="navigateTo('/pages/settings/index')">
          <view class="menu-left">
            <view class="menu-icon-wrapper menu-icon-slate">
              <text class="menu-icon">⚙️</text>
            </view>
            <view class="menu-content">
              <text class="menu-title">设置</text>
              <text class="menu-desc">偏好与账户安全</text>
            </view>
          </view>
          <text class="menu-arrow">›</text>
        </view>

        <!-- 帮助与反馈 -->
        <view class="menu-item" @click="navigateTo('/pages/feedback/index')">
          <view class="menu-left">
            <view class="menu-icon-wrapper menu-icon-orange">
              <text class="menu-icon">💬</text>
            </view>
            <view class="menu-content">
              <text class="menu-title">帮助与反馈</text>
              <text class="menu-desc">遇到问题？告诉我们</text>
            </view>
          </view>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <!-- 会员权益卡片 -->
      <view class="vip-card">
        <view class="vip-content">
          <text class="vip-title">Voyage AI 会员权益</text>
          <text class="vip-desc">享受专属定制行程与极速办理服务</text>
        </view>
        <text class="vip-icon">👑</text>
      </view>

      <!-- 退出登录 -->
      <button class="logout-btn" @click="handleLogout">退出登录</button>

      <!-- 版本信息 -->
      <view class="version-info">
        <text>Voyage AI · 微信小程序 v2.4.0</text>
      </view>

      <!-- 底部安全区域 -->
      <view class="safe-area-bottom"></view>
    </scroll-view>

    <!-- 底部导航栏 -->
    <view class="bottom-nav">
      <view class="nav-item" @click="reLaunchTo('/pages/index/index')">
        <text class="nav-icon">🗺️</text>
        <text class="nav-label">探索</text>
      </view>
      <view class="nav-item" @click="reLaunchTo('/pages/plan/plan')">
        <text class="nav-icon">📅</text>
        <text class="nav-label">行程</text>
      </view>
      <view class="nav-item active" @click="reLaunchTo('/pages/mine/index')">
        <text class="nav-icon">👤</text>
        <text class="nav-label active-label">我的</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user.js'
import { getUserInfo } from '@/api/user.js'
import { getQuota } from '@/api/quota.js'

const userStore = useUserStore()

const defaultAvatar = 'https://ui-avatars.com/api/?name=User&background=1e40af&color=fff'

const userInfo = ref({
  nickname: '',
  avatar: '',
  id: ''
})

const quotaInfo = ref({
  used: 0,
  bonus: 0,
  max: 10,
  remaining: 10
})

// 安全区域顶部高度
const safeAreaTop = ref(0)

onMounted(async () => {
  console.log('[Mine] onMounted 开始')
  
  // 获取安全区域
  try {
    const systemInfo = uni.getSystemInfoSync()
    safeAreaTop.value = systemInfo.safeAreaInsets?.top || 0
    console.log('[Mine] 安全区域顶部:', safeAreaTop.value)
  } catch (e) {
    console.error('[Mine] 获取安全区域失败:', e)
    safeAreaTop.value = 0
  }
  
  // 从本地存储恢复登录状态
  userStore.restoreFromStorage()
  console.log('[Mine] userStore 恢复后:', {
    nickname: userStore.nickname,
    avatarUrl: userStore.avatarUrl,
    hasToken: userStore.hasToken,
    accessToken: userStore.accessToken ? userStore.accessToken.substring(0, 20) + '...' : null
  })
  
  // 检查是否已登录
  if (!userStore.hasToken) {
    console.log('[Mine] 未登录，跳转到登录页')
    uni.showToast({ title: '请先登录', icon: 'none' })
    // 使用 redirectTo 替代 reLaunch，避免页面栈问题
    uni.redirectTo({ url: '/pages/login/index' })
    return
  }

  // 加载用户信息
  await loadUserInfo()
  
  // 加载配额信息
  await loadQuotaInfo()
  console.log('[Mine] loadQuotaInfo done:', quotaInfo.value)
})

const loadUserInfo = async () => {
  try {
    console.log('[Mine] 开始加载用户信息...')
    const info = await getUserInfo()
    console.log('[Mine] getUserInfo 返回:', info)
    if (info) {
      userInfo.value.nickname = info.nickname || ''
      userInfo.value.avatar = info.avatar_url || ''
      userInfo.value.id = info.id || ''
      console.log('[Mine] userInfo 设置完成:', userInfo.value)
    }
  } catch (error) {
    console.error('[Mine] 加载用户信息失败:', error)
    // 使用本地存储的信息
    userInfo.value.nickname = userStore.nickname || ''
    userInfo.value.avatar = userStore.avatarUrl || ''
  }
}

const loadQuotaInfo = async () => {
  try {
    const quota = await getQuota()
    if (quota) {
      quotaInfo.value = {
        used: quota.used || 0,
        bonus: quota.bonus || 0,
        max: quota.max || 10,
        remaining: quota.remaining || 0
      }
    }
  } catch (error) {
    console.error('[Mine] 加载配额失败:', error)
    // 使用本地存储的配额
    quotaInfo.value = userStore.quota
  }
}

const handleEdit = () => {
  uni.showToast({ title: '编辑功能开发中', icon: 'none' })
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

const navigateTo = (url) => {
  uni.showToast({ title: '页面开发中', icon: 'none' })
}

const reLaunchTo = (url) => {
  uni.reLaunch({ url })
}

</script>

<style scoped>
@keyframes floatIn { from { opacity: 0; transform: translateY(18rpx);} to { opacity: 1; transform: translateY(0);} }

.mine-page {
  width: 100vw;
  min-height: 100vh;
  background: var(--gradient-aurora);
  position: relative;
  font-family: var(--font-body);
}

.mine-content {
  height: calc(100vh - 160rpx);
  padding: 0 32rpx;
  padding-top: 32rpx;
  padding-bottom: 120rpx;
}

/* 用户资料头部 */
.profile-header {
  background: rgba(255,255,255,.72);
  border: 1rpx solid rgba(255,255,255,.72);
  box-shadow: 0 14rpx 36rpx rgba(37,75,156,.12);
  border-radius: 32rpx;
  padding: 24rpx 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 64rpx;
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 32rpx;
  flex: 1;
}

.profile-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 4rpx solid #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
}

.profile-details {
  flex: 1;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.profile-name {
  font-size: 42rpx;
  font-family: var(--font-display);
  font-weight: 700;
  color: #202124;
}

.profile-verified {
  font-size: 32rpx;
  color: #4285F4;
}

.profile-badge {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  background: rgba(0, 40, 142, 0.05);
  padding: 8rpx 20rpx;
  border-radius: 32rpx;
  border: 1rpx solid rgba(0, 40, 142, 0.1);
}

.badge-icon {
  font-size: 28rpx;
  color: #4285F4;
}

.badge-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #4285F4;
}

.edit-btn {
  background: #ffffff;
  border: 1rpx solid #DADCE0;
  padding: 12rpx 32rpx;
  border-radius: 32rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #202124;
}

.edit-btn:active {
  background: #F1F3F4;
}

/* 今日配额卡片 */
.quota-card {
  animation: floatIn .45s var(--ease-out);
  background: var(--gradient-primary);
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 12rpx 30rpx rgba(24, 73, 169, 0.28);
}

.quota-header {
  margin-bottom: 24rpx;
}

.quota-title {
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.quota-content {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-bottom: 24rpx;
}

.quota-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.quota-num {
  font-size: 48rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
}

.quota-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 8rpx;
}

.quota-divider {
  width: 1rpx;
  height: 60rpx;
  background: rgba(255, 255, 255, 0.3);
}

.quota-progress {
  height: 8rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4rpx;
  overflow: hidden;
}

.quota-progress-bar {
  height: 100%;
  background: #ffffff;
  border-radius: 4rpx;
  transition: width 0.3s ease;
}

/* 菜单卡片 */
.menu-card {
  background: rgba(255,255,255,.82);
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 14rpx 34rpx rgba(37,75,156,.1);
  border: 1rpx solid rgba(255, 255, 255, 0.72);
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background: #F1F3F4;
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 32rpx;
  flex: 1;
}

.menu-icon-wrapper {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-icon-blue {
  background: rgba(0, 40, 142, 0.08);
}

.menu-icon-slate {
  background: #f8fafc;
}

.menu-icon-orange {
  background: rgba(234, 88, 12, 0.08);
}

.menu-icon {
  font-size: 40rpx;
}

.menu-icon-slate .menu-icon {
  color: #5F6368;
}

.menu-icon-orange .menu-icon {
  color: #ea580c;
}

.menu-content {
  flex: 1;
}

.menu-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #202124;
  margin-bottom: 8rpx;
}

.menu-desc {
  display: block;
  font-size: 24rpx;
  color: #5F6368;
}

.menu-arrow {
  font-size: 40rpx;
  color: #DADCE0;
  opacity: 0.4;
}

/* 会员权益卡片 */
.vip-card {
  margin-top: 64rpx;
  padding: 48rpx;
  background: linear-gradient(140deg, #1b3f91 0%, #356cdd 65%, #7fb5ff 100%);
  border-radius: 32rpx;
  position: relative;
  overflow: hidden;
}

.vip-content {
  position: relative;
  z-index: 1;
}

.vip-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 16rpx;
}

.vip-desc {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.vip-icon {
  position: absolute;
  right: -32rpx;
  bottom: -32rpx;
  font-size: 256rpx;
  color: rgba(255, 255, 255, 0.1);
}

/* 退出登录按钮 */
.logout-btn {
  margin-top: 64rpx;
  background: rgba(255,255,255,.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  width: 100%;
  padding: 64rpx 0;
  border: 1rpx solid rgba(255,255,255,.7);
  border-radius: 32rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #ba1a1a;
  box-shadow: 0 14rpx 34rpx rgba(37,75,156,.1);
}

.logout-btn:active {
  background: rgba(186, 26, 26, 0.1);
}

/* 版本信息 */
.version-info {
  margin-top: 192rpx;
  text-align: center;
}

.version-info text {
  font-size: 24rpx;
  color: #DADCE0;
  opacity: 0.4;
}

/* 底部安全区域 */
.safe-area-bottom {
  height: 32rpx;
}

/* 底部导航栏 */
.bottom-nav {
  position: fixed;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: rgba(255,255,255,.82);
  border-top: 1rpx solid rgba(255,255,255,.75);
  box-shadow: 0 -10rpx 28rpx rgba(22,32,58,.08);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 24rpx;
}

.nav-icon {
  font-size: 48rpx;
}

.nav-label {
  font-size: 20rpx;
  font-weight: 500;
  color: #9AA0A6;
}

.nav-item.active .nav-icon {
  color: #4285F4;
  font-size: 56rpx;
}

.nav-item.active .nav-label {
  color: #4285F4;
  font-weight: 700;
}

.filled {
  font-variation-settings: 'FILL' 1;
}
</style>
