<template>
  <view class="mine-page" :class="themeClass">
    <header class="top-bar" :style="{ paddingTop: (12 + statusBarHeight) + 'px' }">
      <view class="top-left">
        <button class="back-btn" @click="goBack"><text>←</text></button>
        <text class="top-title">我的</text>
      </view>
      <view class="top-right">
        <button class="top-avatar-btn">
          <image class="top-avatar" :src="userAvatarComputed" mode="aspectFill" />
        </button>
      </view>
    </header>
    <scroll-view scroll-y class="content" show-scrollbar="false">
      <!-- Profile Header -->
      <section class="profile-section">
        <view class="profile-row">
          <button class="avatar-update-btn" open-type="chooseAvatar" @chooseavatar="onUpdateAvatar">
            <view class="avatar-wrap">
              <view class="avatar-glow"></view>
              <image class="profile-avatar" :src="userInfo.avatar || defaultAvatar" mode="aspectFill" />
              <view class="verified-badge">
                <text>✓</text>
              </view>
            </view>
          </button>
          <view class="profile-details">
            <view class="profile-name-wrap">
              <input 
                ref="nicknameInput"
                class="profile-name-input" 
                :value="userInfo.nickname || '微信用户'" 
                @blur="onUpdateNickname" 
                placeholder="点击编辑昵称" 
                :focus="nicknameFocus"
                @focus="nicknameFocus = true"
              />
              <button class="edit-name-btn" @click="focusNickname">
                <text>✏️</text>
              </button>
            </view>
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
          <view class="quota-bonus">含 {{ quotaInfo.bonus }} 次额外奖励</view>
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
          <view class="quota-refresh" @click="forceRefreshQuota">刷新</view>
        </view>
      </section>

      <!-- Invite Card -->
      <section class="invite-card">
        <view class="invite-header">
          <view class="invite-icon-wrap">
            <text class="invite-icon">🎁</text>
          </view>
          <view class="invite-header-text">
            <text class="invite-title">邀请好友，获取额外配额</text>
            <text class="invite-subtitle">每邀请 1 位好友，双方各 +3 次规划机会</text>
          </view>
        </view>
        <view class="invite-actions" v-if="inviteInfo.invite_code">
          <button class="invite-share-btn" open-type="share" @success="onShareSuccess">
            <text class="invite-btn-icon">📤</text>
            <text>分享给好友</text>
          </button>
          <button class="invite-copy-btn" @click="copyInviteCode">
            <text class="invite-btn-icon">📋</text>
            <text>复制邀请码</text>
          </button>
        </view>
        <view class="invite-loading" v-else>
          <text>生成邀请链接...</text>
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
          <!-- 我的收藏已隐藏，避免审核风险 -->
          <!--
          <view class="menu-divider"></view>
          <view class="menu-item" @click="goTo('/pages/history/index?favoriteOnly=1')">
            <view class="menu-item-left">
              <view class="menu-icon" style="background: rgba(239,68,68,0.15);">
                <text style="color: #ef4444; font-size: 24px;">📌</text>
              </view>
              <text class="menu-item-title">我的收藏</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          -->
          <view class="menu-divider"></view>
          <view class="menu-item" @click="goTo('/pages/settings/index')">
            <view class="menu-item-left">
              <view class="menu-icon" style="background: var(--color-secondary-fixed); opacity: 0.3;">
                <text style="color: var(--color-secondary); font-size: 24px;">⚙️</text>
              </view>
              <text class="menu-item-title">设置</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="menu-item" @click="goTo('/pages/settings/feedback')">
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

  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user.js'
import { getUserInfo, updateUserInfo, verifyToken } from '@/api/user.js'
import { getQuota, getInviteInfo, addBonus } from '@/api/quota.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'

const userStore = useUserStore()
const { statusBarHeight, safeAreaBottom } = useSafeArea()

const goBack = () => uni.navigateBack({ delta: 1 })
const goInspiration = () => uni.navigateTo({ url: '/pages/inspiration/index' })
const goPlan = () => uni.navigateTo({ url: '/pages/ai-plan-detail/index' })
const goMine = () => uni.reLaunch({ url: '/pages/mine/index' })
const defaultAvatar = 'https://ui-avatars.com/api/?name=行程一下&background=1a237e&color=fff&size=256'

const userInfo = ref({ nickname: '', avatar: '', id: '' })
const quotaInfo = ref({ used: 0, bonus: 0, max: 1, remaining: 1 })
const inviteInfo = ref({ invite_code: '', bonus_per_invite: 3 })
const nicknameFocus = ref(false)

const userAvatarComputed = computed(() => userInfo.value.avatar || userStore.avatarUrl || 'https://ui-avatars.com/api/?name=行程一下&background=0F4C5C&color=fff&size=64')
const userNicknameComputed = computed(() => userInfo.value.nickname || userStore.nickname || '行程一下')

// 分享：inviteCode 在调用时才读取，确保已更新
const shareInviteCode = ref('')
watch(inviteInfo, (val) => {
  if (val.invite_code) shareInviteCode.value = val.invite_code
})
onShareAppMessage(() => ({
  title: '行程一下 - 邀请好友，双方各得3次规划配额',
  path: `/pages/login/index?invite=${shareInviteCode.value}`,
  imageUrl: 'https://tonystark-ai.ccwu.cc/png/kfeng.png'
}))

const onShareSuccess = async () => {
  try {
    await addBonus('share')
    uni.showToast({ title: '分享成功 +3 次配额', icon: 'success' })
  } catch (err) {
    console.warn('[Mine] 分享加分失败:', err)
  }
}

onMounted(async () => {
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    uni.redirectTo({ url: '/pages/login/index' })
    return
  }
  await loadUserInfo()
  await loadQuotaInfo()
  await loadInviteInfo()
})

// 每次回到本页都刷新（解决邀请奖励不及时显示的问题）
onShow(async () => {
  if (!userStore.hasToken) return
  console.log('[Mine] onShow 触发,重新拉取 quota + inviteInfo')
  await Promise.all([loadQuotaInfo(), loadInviteInfo()])
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
        max: quota.max ?? 1, remaining: quota.remaining ?? 0
      }
    }
  } catch {
    quotaInfo.value = userStore.quota || { used: 0, bonus: 0, max: 1, remaining: 1 }
  }
}

const loadInviteInfo = async () => {
  try {
    const res = await getInviteInfo()
    if (res && res.code === 0 && res.data) {
      inviteInfo.value = res.data
    }
  } catch {
    console.error('获取邀请信息失败')
  }
}

const copyInviteCode = () => {
  const code = inviteInfo.value.invite_code
  if (!code) return
  uni.setClipboardData({
    data: code,
    success: () => {
      uni.showToast({ title: '邀请码已复制', icon: 'success' })
    }
  })
}

// 手动强制刷新配额（调试用）
const forceRefreshQuota = async () => {
  uni.showLoading({ title: '刷新中...' })
  await Promise.all([loadQuotaInfo(), loadInviteInfo()])
  uni.hideLoading()
  uni.showToast({
    title: `剩余 ${quotaInfo.value.remaining} / 奖励 ${quotaInfo.value.bonus}`,
    icon: 'none',
    duration: 2000
  })
  console.log('[Mine] 强制刷新完成:', JSON.stringify(quotaInfo.value))
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

const onUpdateNickname = async (e) => {
  const newNickname = e.detail?.value?.trim()
  if (!newNickname || newNickname === userInfo.value.nickname) return
  
  try {
    userStore.restoreFromStorage()
    
    const isValid = await verifyToken()
    if (!isValid) {
      uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      userStore.clearLogin()
      uni.reLaunch({ url: '/pages/login/index' })
      return
    }
    
    uni.showLoading({ title: '更新中...' })
    await updateUserInfo({ nickname: newNickname })
    userInfo.value.nickname = newNickname
    userStore.setUserInfo({ nickname: newNickname })
    uni.hideLoading()
    uni.showToast({ title: '昵称已更新', icon: 'success' })
  } catch (error) {
    uni.hideLoading()
    console.error('昵称更新失败:', error)
    uni.showToast({ title: '更新失败: ' + (error.message || '请检查网络连接'), icon: 'none' })
  }
}

const onUpdateAvatar = async (e) => {
  const newAvatar = e.detail?.avatarUrl
  if (!newAvatar) return
  try {
    userStore.restoreFromStorage()
    
    const isValid = await verifyToken()
    if (!isValid) {
      uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      userStore.clearLogin()
      uni.reLaunch({ url: '/pages/login/index' })
      return
    }
    
    uni.showLoading({ title: '更新中...' })
    await updateUserInfo({ avatar_url: newAvatar })
    userInfo.value.avatar = newAvatar
    userStore.setUserInfo({ avatar_url: newAvatar })
    uni.hideLoading()
    uni.showToast({ title: '头像已更新', icon: 'success' })
  } catch (error) {
    uni.hideLoading()
    console.error('头像更新失败:', error)
    uni.showToast({ title: '更新失败: ' + (error.message || '请检查网络连接'), icon: 'none' })
  }
}

const focusNickname = () => {
  nicknameFocus.value = false
  nextTick(() => {
    nicknameFocus.value = true
  })
}

const goTo = (url) => uni.navigateTo({ url })
</script>

<style scoped>
.mine-page { min-height: 100vh; background: var(--color-surface); }

.top-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 24rpx 40rpx 24rpx;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.top-left { display: flex; align-items: center; gap: 12px; }
.back-btn {
  width: 36px; height: 36px; display: flex; align-items: center;
  justify-content: center; font-size: 20px; color: var(--color-primary);
}
.top-title { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; line-height: 32px; }
.top-right { display: flex; align-items: center; gap: 12px; }
.top-avatar { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.4); }
.top-avatar-btn { padding: 0; margin: 0; border: none; background: transparent; line-height: 0; }
.top-avatar-btn::after { border: none; }

.content { padding: 260rpx 40rpx 280rpx; }

.profile-section { margin-bottom: 24px; }
.profile-row { display: flex; align-items: center; gap: 24px; position: relative; }
.avatar-update-btn {
  position: relative; padding: 0; margin: 0; border: none;
  background: transparent; border-radius: 0;
  display: block; line-height: 0;
}
.avatar-update-btn::after { border: none; }
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
.profile-name-wrap { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.profile-name-input { font-size: 20px; font-weight: 700; color: var(--color-on-surface); line-height: 28px; display: block; background: transparent; border: none; outline: none; flex: 1; }
.profile-name-input:focus { border-bottom: 1px solid var(--color-primary); }
.edit-name-btn {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,6,102,0.06); border: none; padding: 0;
  flex-shrink: 0;
}
.edit-name-btn::after { border: none; }
.edit-name-btn:active { background: rgba(0,6,102,0.12); }
.edit-name-btn text { font-size: 14px; }
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
  border-radius: 32px; padding: 48rpx;
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
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
}
.quota-refresh {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(15, 76, 92, 0.08);
  color: var(--color-primary, #0F4C5C);
  font-size: 11px; font-weight: 500; letter-spacing: 0.05em;
  opacity: 1;
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
  padding: 48rpx; transition: all var(--transition-fast);
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
.menu-divider { height: 1px; margin: 0 48rpx; background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent); }

.invite-card {
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  border-radius: 32px;
  padding: 48rpx;
  margin-bottom: 24px;
  box-shadow: 0 12px 32px rgba(15,76,92,0.2);
}
.invite-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.invite-icon-wrap {
  width: 48px; height: 48px; border-radius: 16px;
  background: rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.invite-icon { font-size: 24px; }
.invite-header-text { flex: 1; }
.invite-title { font-size: 17px; font-weight: 700; color: #ffffff; display: block; margin-bottom: 4px; }
.invite-subtitle { font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.65); display: block; line-height: 1.5; }
.invite-actions { display: flex; gap: 12px; }
.invite-share-btn, .invite-copy-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 48px; border-radius: 999px; font-size: 14px; font-weight: 600;
  border: none; padding: 0;
}
.invite-share-btn {
  background: #ffffff; color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.invite-copy-btn {
  background: rgba(255,255,255,0.12); color: #ffffff;
  border: 1px solid rgba(255,255,255,0.2);
}
.invite-share-btn::after, .invite-copy-btn::after { border: none; }
.invite-share-btn:active { transform: scale(0.96); }
.invite-copy-btn:active { background: rgba(255,255,255,0.2); transform: scale(0.96); }
.invite-btn-icon { font-size: 16px; }
.invite-loading { text-align: center; padding: 12px 0; }
.invite-loading text { font-size: 13px; color: rgba(255,255,255,0.5); }

.logout-section { margin-top: 16px; }
.logout-btn {
  width: 100%; padding: 32rpx;
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
</style>
