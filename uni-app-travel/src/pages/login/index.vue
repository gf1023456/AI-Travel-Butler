<template>
  <view class="login-page">
    <view class="bg-orbs">
      <view class="orb orb-1"></view>
      <view class="orb orb-2"></view>
      <view class="orb orb-3"></view>
    </view>
    <main class="login-main">
      <header class="logo-header">
        <text class="brand-logo">慧游</text>
      </header>
      <section class="login-body">
        <view class="avatar-section">
          <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image class="avatar-img" :src="avatarUrl || defaultAvatar" mode="aspectFill" />
            <view class="avatar-add">
              <text class="avatar-add-icon">+</text>
            </view>
          </button>
        </view>
        <view class="profile-panel">
          <view class="input-group">
            <text class="input-label">昵称</text>
            <input class="nickname-input" type="nickname" v-model="nickname" @blur="onNicknameBlur" placeholder="点击自动获取微信昵称" maxlength="20" />
          </view>
        </view>
        <view class="login-actions">
          <button class="login-btn" @click="handleWechatLogin" :disabled="loading">
            <text class="btn-icon">💬</text>
            <text>微信一键登录</text>
          </button>
          <view class="secure-indicator">
            <text class="secure-text">安全加密连接中</text>
            <view class="dots">
              <view class="dot" style="animation-delay: 0ms"></view>
              <view class="dot" style="animation-delay: 150ms"></view>
              <view class="dot" style="animation-delay: 300ms"></view>
            </view>
          </view>
        </view>
      </section>
      <footer class="login-footer">
        <label class="agreement" @click="toggleAgreement">
          <checkbox class="agreement-checkbox" :checked="agreed" color="#000666" />
          <text class="agreement-text">
            登录即代表您已阅读并同意
            <text class="agreement-link">《用户服务协议》</text>
            与
            <text class="agreement-link">《隐私权政策》</text>
          </text>
        </label>
      </footer>
    </main>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { wechatLogin } from '@/api/user.js'
import { useUserStore } from '@/store/user.js'

const agreed = ref(false)
const loading = ref(false)
const nickname = ref('')
const avatarUrl = ref('')
const defaultAvatar = 'https://ui-avatars.com/api/?name=慧游&background=1a237e&color=fff&size=256'

const toggleAgreement = () => {
  agreed.value = !agreed.value
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

const handleWechatLogin = async () => {
  if (!agreed.value) {
    uni.showToast({ title: '请先同意用户协议', icon: 'none' })
    return
  }
  if (loading.value) return
  loading.value = true

  try {
    uni.showLoading({ title: '登录中...' })

    const loginCode = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => resolve(res.code),
        fail: () => reject(new Error('获取登录凭证失败'))
      })
    })

    const loginData = await wechatLogin({
      code: loginCode,
      nickname: nickname.value || '微信用户',
      avatar_url: avatarUrl.value || ''
    })

    const userStore = useUserStore()
    userStore.setLoginData(loginData)
    userStore.setUserInfo({
      nickname: nickname.value || loginData.nickname || '微信用户',
      avatar_url: avatarUrl.value || loginData.avatar_url || ''
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
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.bg-orbs {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
}
.orb {
  position: absolute; border-radius: 50%;
}
.orb-1 {
  width: 80vw; height: 80vw; top: 10%; left: 10%;
  background: rgba(0,6,102,0.05); filter: blur(120px);
  animation: pulse 4s ease-in-out infinite;
}
.orb-2 {
  width: 60vw; height: 60vw; bottom: -10%; right: -10%;
  background: rgba(212,230,229,0.1); filter: blur(100px);
}
.orb-3 {
  width: 120vw; height: 40vh; top: 40%; left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.4); filter: blur(80px);
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.login-main {
  position: relative; z-index: 1;
  width: 100%; max-width: 400px; margin: 0 auto;
  display: flex; flex-direction: column; min-height: 100vh;
  padding: 0 20px;
}
.logo-header {
  display: flex; justify-content: center; padding: 60px 0 48px;
}
.brand-logo {
  font-size: 36px; font-weight: 700; color: var(--color-primary);
  letter-spacing: -0.02em; line-height: 44px;
}
.login-body {
  flex: 1; display: flex; flex-direction: column; align-items: center;
}
.avatar-section { margin-bottom: 40px; }
.avatar-btn {
  position: relative; width: 96px; height: 96px;
  padding: 0; margin: 0; border: none; background: transparent; border-radius: 50%;
  display: block; line-height: 0;
}
.avatar-btn::after { border: none; }
.avatar-img {
  width: 100%; height: 100%; border-radius: 50%;
  border: 4px solid #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.avatar-add {
  position: absolute; bottom: 0; right: 0;
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-primary); border: 2px solid #fff;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.avatar-add-icon { color: #fff; font-size: 18px; font-weight: 700; line-height: 1; }
.profile-panel {
  width: 100%;
  background: rgba(255,255,255,0.4);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 16px; padding: 24px; margin-bottom: 24px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.03);
}
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-label {
  font-size: 12px; line-height: 16px; letter-spacing: 0.05em;
  font-weight: 500; color: var(--color-on-surface-variant);
  padding-left: 4px;
}
.nickname-input {
  width: 100%; height: 48px;
  background: rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 12px; padding: 0 16px;
  font-size: 16px; line-height: 26px; color: var(--color-on-surface);
}
.login-actions { width: 100%; display: flex; flex-direction: column; gap: 16px; }
.login-btn {
  width: 100%; height: 56px;
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  border-radius: 999px; color: #fff;
  font-size: 20px; font-weight: 600; line-height: 28px;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  box-shadow: 0 8px 24px rgba(0,6,102,0.15);
  transition: all var(--transition-fast);
}
.login-btn:active { transform: scale(0.98); }
.login-btn[disabled] { opacity: 0.6; }
.btn-icon { font-size: 24px; }
.secure-indicator {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.secure-text {
  font-size: 12px; line-height: 16px; letter-spacing: 0.05em;
  font-weight: 500; color: var(--color-on-surface-variant); opacity: 0.6;
}
.dots { display: flex; gap: 4px; }
.dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--color-primary); opacity: 0.2;
  animation: bounce 1.4s ease-in-out infinite;
}
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.2; }
  40% { transform: translateY(-4px); opacity: 0.8; }
}
.login-footer { padding: 32px 0; }
.agreement { display: flex; align-items: flex-start; gap: 16px; }
.agreement-checkbox { flex-shrink: 0; }
.agreement-text {
  font-size: 12px; line-height: 18px; letter-spacing: 0.05em;
  font-weight: 500; color: var(--color-on-surface-variant); opacity: 0.7;
}
.agreement-link { color: var(--color-primary); font-weight: 600; }
</style>
