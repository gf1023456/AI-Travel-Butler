<template>
  <view class="login-page">
    <view class="close-btn" @click="handleClose">
      <text class="close-icon">×</text>
    </view>

    <view class="main-content">
      <view class="brand-section">
        <text class="brand-title">行程一下</text>
        <text class="brand-tagline">探索世界，从行程开始</text>
      </view>

      <view class="login-card glass-card-heavy">
        <view class="avatar-section">
          <view class="avatar-wrap">
            <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
              <image v-if="avatarUrl" class="avatar-img" :src="avatarUrl" mode="aspectFill" />
              <view v-else class="avatar-empty">
                <view class="avatar-empty-icon"></view>
                <text class="avatar-empty-label">添加头像</text>
              </view>
            </button>
            <view class="avatar-edit" @click="triggerAvatar">
              <view class="edit-camera"></view>
            </view>
          </view>
        </view>

        <view class="field-wrap">
          <view class="field-label">昵称</view>
          <view class="field-box">
            <input
              class="field-input"
              type="nickname"
              v-model="nickname"
              @blur="onNicknameBlur"
              placeholder="输入你的昵称"
              maxlength="20"
            />
          </view>
        </view>

        <button class="login-btn brand-gradient" @click="handleWechatLogin" :disabled="loading">
          <text class="btn-text">{{ loading ? '登录中...' : '微信一键登录' }}</text>
        </button>

        <view class="agreement-text">
          <text class="agreement-main">登录即代表同意</text>
          <text class="agreement-link" @click.stop="showAgreement('user')">用户协议</text>
          <text class="agreement-main">和</text>
          <text class="agreement-link" @click.stop="showAgreement('privacy')">隐私政策</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { wechatLogin } from '@/api/user.js'
import { useUserStore } from '@/store/user.js'

const loading = ref(false)
const nickname = ref('')
const avatarUrl = ref('')

const handleClose = () => {
  uni.navigateBack({ fallback: () => uni.switchTab({ url: '/pages/index/index' }) })
}

const triggerAvatar = () => {
  uni.chooseImage({
    count: 1,
    success: (res) => {
      if (res.tempFilePaths && res.tempFilePaths[0]) {
        avatarUrl.value = res.tempFilePaths[0]
      }
    }
  })
}

const onChooseAvatar = (e) => {
  if (e.detail && e.detail.avatarUrl) {
    avatarUrl.value = e.detail.avatarUrl
  }
}

const onNicknameBlur = (e) => {
  if (e.detail && e.detail.value && !nickname.value) {
    nickname.value = e.detail.value
  }
}

const showAgreement = (type) => {
  const url = type === 'user' ? '/pages/agreement/user' : '/pages/agreement/privacy'
  uni.navigateTo({ url })
}

const handleWechatLogin = async () => {
  if (!avatarUrl.value) {
    uni.showToast({ title: '请选择头像', icon: 'none' })
    return
  }

  if (!nickname.value) {
    uni.showToast({ title: '请填写昵称', icon: 'none' })
    return
  }

  if (loading.value) return
  loading.value = true

  try {
    uni.showLoading({ title: '登录中...' })

    const code = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => resolve(res.code),
        fail: () => reject(new Error('获取登录凭证失败'))
      })
    })

    const loginData = await wechatLogin({
      code,
      nickname: nickname.value,
      avatar_url: avatarUrl.value
    })

    const userStore = useUserStore()
    userStore.setLoginData(loginData)
    userStore.setUserInfo({
      nickname: loginData.nickname || nickname.value,
      avatar_url: loginData.avatar_url || avatarUrl.value
    })

    uni.hideLoading()
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' })
    }, 1000)
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: error.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--color-background);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-surface-container);
  transition: background var(--transition-fast);
}

.close-btn:active {
  background: var(--color-surface-container-high);
}

.close-icon {
  font-size: 20px;
  font-weight: 300;
  color: var(--color-on-surface-variant);
  line-height: 1;
}

.main-content {
  width: 100%;
  max-width: 400px;
  padding: 0 var(--space-container);
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  z-index: 2;
  padding-top: 100px;
  padding-bottom: 48px;
}

/* Brand */
.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48px;
}

.brand-title {
  font-size: 34px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin-bottom: 10px;
}

.brand-tagline {
  font-size: 14px;
  font-weight: 400;
  color: var(--color-on-surface-variant);
  letter-spacing: 0.02em;
  line-height: 1.5;
}

/* Card */
.login-card {
  width: 100%;
  border-radius: var(--radius-xl);
  padding: 36px 28px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Avatar */
.avatar-section {
  margin-bottom: 28px;
}

.avatar-wrap {
  position: relative;
}

.avatar-btn {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  padding: 0;
  margin: 0;
  background: var(--color-surface-container);
  border: none;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-btn::after {
  border: none;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.avatar-empty-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--color-outline-variant);
  position: relative;
}

.avatar-empty-icon::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 1.5px;
  background: var(--color-outline-variant);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.avatar-empty-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  letter-spacing: 0.02em;
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid var(--color-surface-container-lowest);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.edit-camera {
  width: 14px;
  height: 14px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/%3E%3Ccircle cx='12' cy='13' r='4'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

/* Field */
.field-wrap {
  width: 100%;
  margin-bottom: 24px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-variant);
  margin-bottom: 8px;
  text-align: center;
}

.field-box {
  background: var(--color-surface-container-low);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  overflow: hidden;
}

.field-box:focus-within {
  border-color: var(--color-primary);
  background: var(--color-surface-container-lowest);
  box-shadow: 0 0 0 3px rgba(0, 6, 102, 0.08);
}

.field-input {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 400;
  color: var(--color-on-surface);
  padding: 13px 16px;
  outline: none;
  letter-spacing: 0.01em;
  text-align: center;
}

.field-input::placeholder {
  color: var(--color-outline);
  font-weight: 400;
}

/* Button */
.login-btn {
  width: 100%;
  height: 50px;
  border-radius: var(--radius-md);
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-button);
  margin-bottom: 20px;
  transition: all var(--transition-fast);
}

.login-btn::after {
  border: none;
}

.login-btn:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.login-btn[disabled] {
  opacity: 0.5;
  transform: none;
}

.btn-text {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.04em;
  line-height: 1;
}

/* Agreement */
.agreement-text {
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  color: var(--color-on-surface-variant);
}

.agreement-main {
  color: var(--color-on-surface-variant);
}

.agreement-link {
  color: var(--color-primary);
  font-weight: 500;
}
</style>
