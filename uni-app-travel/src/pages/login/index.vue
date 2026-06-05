<template>
  <view class="login-page">
    <image class="bg-image" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBEB_brch-OcURAWfoHGV3sb169yQ2GF1GAns82mbKWokFqd7-GszkVAODPUwGjI3cPVu5yD2DgUwqadfdTjnhV8dO9qyowmE7t8UPprR-Mz3f-3IoZH237dltJLrIQsYvsnacRpbLFNRSVee5LJmwHjh27j6SMAYYA9kkCGzDS6tgQ1_tj_NCDAgC1bRdbhYWIS8XyY3dt905CIW6PM-7c4rkgAE4qYT6x2DAgLIAIuFoaephd8Bpw3YdVDGpg-IH6y7t20SuiwD8" mode="aspectFill" />
    <view class="bg-overlay"></view>

    <view class="close-btn" @click="handleClose">
      <text class="close-icon">×</text>
    </view>

    <view class="main-content">
      <view class="brand-section">
        <text class="brand-title">
          <text class="brand-serif">行程</text><text class="brand-sans">一下</text>
        </text>
        <text class="brand-tagline">今天你行程了嘛？</text>
      </view>

      <view class="avatar-section">
        <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image v-if="avatarUrl" class="avatar-img" :src="avatarUrl" mode="aspectFill" />
          <text v-else class="avatar-placeholder">👤</text>
          <view class="avatar-glass"></view>
        </button>
        <button class="avatar-camera" @click="triggerAvatar">
          <text class="camera-icon">📷</text>
        </button>
      </view>

      <view class="form-section">
        <image class="form-logo" src="/static/tabbar/screen_compressed.png" mode="aspectFit" />
        <view class="input-wrap">
          <input class="nickname-input" type="nickname" v-model="nickname" @blur="onNicknameBlur" placeholder="输入微信昵称" maxlength="20" />
          <view class="input-glow"></view>
        </view>

        <button class="login-btn" @click="handleWechatLogin" :disabled="loading">
          <view class="btn-content">
            <text class="btn-icon">💬</text>
            <text class="btn-text">微信一键登录</text>
          </view>
        </button>
      </view>

      <view class="footer">
        <text class="footer-text">登录即代表您同意</text>
        <view class="footer-links">
          <text class="footer-link" @click.stop="showAgreement('user')">用户协议</text>
          <view class="footer-divider"></view>
          <text class="footer-link" @click.stop="showAgreement('privacy')">隐私政策</text>
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
page {
  background: linear-gradient(160deg, #0a3341 0%, #0F4C5C 40%, #134e5e 70%, #0D9488 100%);
}
.login-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #0a3341 0%, #0F4C5C 40%, #134e5e 70%, #0D9488 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
}

.bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15,76,92,0.25) 0%, rgba(13,148,136,0.15) 50%, rgba(10,51,65,0.35) 100%);
  z-index: 1;
}

.close-btn {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.close-icon {
  font-size: 24px;
  font-weight: 300;
  color: rgba(255,255,255,0.4);
  line-height: 1;
}

.main-content {
  width: 100%;
  max-width: 400px;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  z-index: 2;
  padding-top: 80px;
  padding-bottom: 48px;
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 64px;
}

.brand-title {
  font-size: 44px;
  line-height: 1;
  color: #ffffff;
  letter-spacing: -0.02em;
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 24px;
}

.brand-serif {
  font-family: 'Playfair Display', 'Times New Roman', serif;
  font-weight: 400;
  margin-right: 4px;
}

.brand-sans {
  font-weight: 300;
  letter-spacing: -0.04em;
}

.brand-tagline {
  font-size: 12px;
  font-weight: 300;
  color: rgba(196,199,200,0.6);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  line-height: 1.6;
}

.avatar-section {
  position: relative;
  margin-bottom: 64px;
}

.avatar-btn {
  position: relative;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  padding: 0;
  margin: 0;
  background: none;
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

.avatar-glass {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 0.5px solid rgba(255,255,255,0.2);
  box-shadow: inset 0 0 20px rgba(255,255,255,0.05), 0 0 40px rgba(255,255,255,0.02);
  z-index: 1;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  z-index: 2;
}

.avatar-placeholder {
  font-size: 64px;
  font-weight: 100;
  color: rgba(255,255,255,0.4);
  position: relative;
  z-index: 2;
  line-height: 1;
}

.avatar-camera {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(15,76,92,0.75);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  padding: 0;
  margin: 0;
  z-index: 3;
}

.avatar-camera::after {
  border: none;
}

.camera-icon {
  font-size: 18px;
  font-weight: 300;
  line-height: 1;
}

.form-section {
  width: 100%;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
}

.form-logo {
  width: 32px;
  height: 32px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.input-wrap {
  width: 100%;
  position: relative;
}

.nickname-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 0.5px solid rgba(255,255,255,0.2);
  text-align: center;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: #ffffff;
  padding: 12px 0;
  outline: none;
  letter-spacing: 0.1em;
  transition: border-color 0.5s;
  position: relative;
  z-index: 1;
}

.nickname-input::placeholder {
  color: rgba(255,255,255,0.6);
  font-weight: 300;
}

.nickname-input:focus {
  border-bottom-color: rgba(20,184,166,0.6);
}

.input-glow {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent);
  transform: scaleX(0);
  transition: transform 0.7s;
  transform-origin: center;
  z-index: 2;
}

.input-wrap:focus-within .input-glow {
  transform: scaleX(1);
}

.login-btn {
  position: relative;
  width: 100%;
  height: 52px;
  border-radius: 9999px;
  overflow: hidden;
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  outline: none;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  box-shadow: 0 8px 24px rgba(15,76,92,0.4);
  transition: transform 0.5s, opacity 0.3s;
  margin-top: 16px;
}

.login-btn::after {
  border: none;
}

.login-btn:active {
  transform: scale(0.95);
}

.login-btn[disabled] {
  opacity: 0.6;
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
}

.btn-icon {
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
}

.btn-text {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  letter-spacing: 0.15em;
  line-height: 1;
}

.footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-top: auto;
  padding-top: 64px;
}

.footer-text {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  line-height: 1;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 16px;
}

.footer-link {
  font-size: 11px;
  font-weight: 300;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.15em;
  line-height: 1;
}

.footer-divider {
  width: 1px;
  height: 12px;
  background: rgba(255,255,255,0.2);
}
</style>
