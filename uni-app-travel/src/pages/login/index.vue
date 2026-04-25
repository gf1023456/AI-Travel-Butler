<template>
  <view class="login-page">
    <!-- 顶部导航栏 -->
    <view class="top-bar">
      <text class="top-close">✕</text>
      <text class="top-title">AI Travel Companion</text>
      <view class="top-spacer"></view>
    </view>

    <view class="login-container">
      <!-- Logo 区域 -->
      <view class="logo-section">
        <view class="logo-icon-wrapper">
          <text class="logo-icon">🌍</text>
          <view class="logo-badge">
            <text class="logo-badge-icon">✨</text>
          </view>
        </view>
        <text class="brand-name">AI Travel Companion</text>
        <text class="brand-subtitle">AI 智能旅行管家</text>
      </view>

      <!-- 登录按钮区域 -->
      <view class="login-actions">
        <!-- 头像选择 - 使用微信原生选择器 -->
        <view class="avatar-section">
          <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image class="avatar-preview" :src="avatarUrl || '/static/logo.png'" mode="aspectFill" />
          </button>
          <text class="avatar-tip">点击选择微信头像</text>
        </view>

        <!-- 昵称输入 -->
        <input 
          class="nickname-input" 
          type="nickname" 
          v-model="nickname" 
          placeholder="请输入昵称" 
          maxlength="20"
        />

        <button class="wechat-login-btn" @click="handleWechatLogin">
          <text class="btn-icon">💬</text>
          <text>微信一键登录</text>
        </button>
        <button class="phone-login-btn" @click="handlePhoneLogin">
          <text>手机号登录</text>
        </button>
      </view>

      <!-- 协议勾选 -->
      <view class="agreement-section">
        <checkbox-group @change="onAgreementChange">
          <label class="agreement-label">
            <checkbox value="agree" :checked="agreed" color="#4285F4" />
            <text class="agreement-text">
              我已阅读并同意
              <text class="agreement-link">《用户协议》</text>
              和
              <text class="agreement-link">《隐私政策》</text>
            </text>
          </label>
        </checkbox-group>
      </view>
    </view>

    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="bg-blob bg-blob-1"></view>
      <view class="bg-blob bg-blob-2"></view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { wechatLogin } from '@/api/user.js'
import { useUserStore } from '@/store/user.js'
import { getQuota } from '@/api/quota.js'

const agreed = ref(false)
const loading = ref(false)
const nickname = ref('')
const avatarUrl = ref('')

// 手机号相关信息（使用全局变量保存）
let globalPhoneNumber = ''
let globalPhoneEncryptedData = ''
let globalPhoneIv = ''

const phoneNumber = ref('')
const phoneEncryptedData = ref('')
const phoneIv = ref('')

const onAgreementChange = (e) => {
  agreed.value = e.detail.value.length > 0
}

// 微信头像选择（使用 open-type="chooseAvatar"）
const onChooseAvatar = (e) => {
  const url = e.detail.avatarUrl
  if (url) {
    avatarUrl.value = url
    console.log('[Login] ✅ 微信头像选择成功:', url)
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

    console.log('[Login] === 开始微信登录流程 ===')
    
    // 获取微信登录code
    const loginCode = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => {
          console.log('[Login] ✅ 获取微信code成功:', res.code.substring(0, 20) + '...')
          resolve(res.code)
        },
        fail: (err) => {
          console.error('[Login] ❌ 获取微信code失败:', err)
          reject(new Error('获取登录凭证失败'))
        }
      })
    })
    
    // 调用后端登录接口（传入 nickname 和 avatar_url）
    console.log('[Login] 🚀 调用后端登录接口...')
    const loginData = await wechatLogin({
      code: loginCode,
      nickname: nickname.value || '微信用户',
      avatar_url: avatarUrl.value || ''
    })

    console.log('[Login] ✅ 后端登录成功:', {
      userId: loginData.user_id,
      hasToken: !!loginData.access_token
    })

    // 保存登录信息
    const userStore = useUserStore()
    userStore.saveToStorage()
    
    console.log('[Login] 💾 登录信息已保存到本地存储')

    uni.hideLoading()
    uni.showToast({ title: '登录成功', icon: 'success' })

    // 跳转到探索页面
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' })
    }, 1000)

  } catch (error) {
    console.error('[Login] ❌ 登录失败:', error)
    uni.hideLoading()
    uni.showToast({ 
      title: error.message || '登录失败，请重试', 
      icon: 'none' 
    })
  } finally {
    loading.value = false
  }
}

// 处理手机号授权
const onGetPhoneNumber = async (e) => {
  console.log('[Login] 📱 手机号授权回调:', e)
  
  if (e.detail.errMsg === 'getPhoneNumber:ok') {
    // 用户同意授权
    console.log('[Login] ✅ 用户同意授权手机号')
    console.log('[Login] code:', e.detail.code ? '已获取' : '未获取')
    console.log('[Login] encryptedData:', e.detail.encryptedData ? '已获取' : '未获取')
    console.log('[Login] iv:', e.detail.iv ? '已获取' : '未获取')
    
    // 保存到全局变量
    globalPhoneNumber = e.detail.code
    globalPhoneEncryptedData = e.detail.encryptedData
    globalPhoneIv = e.detail.iv
    
    // 同时保存到响应式变量
    phoneNumber.value = e.detail.code
    phoneEncryptedData.value = e.detail.encryptedData
    phoneIv.value = e.detail.iv
    
    console.log('[Login] ✅ 手机号信息已保存')
  } else {
    // 用户拒绝授权
    console.warn('[Login] ⚠️ 用户拒绝授权手机号:', e.detail.errMsg)
    // 清空全局变量
    globalPhoneNumber = ''
    globalPhoneEncryptedData = ''
    globalPhoneIv = ''
  }
}

const handlePhoneLogin = () => {
  // 手机号登录逻辑
  uni.showToast({ title: '手机号登录开发中', icon: 'none' })
}
</script>

<style scoped>

.login-page {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  background: #F8F9FA;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

/* 顶部导航栏 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  height: 112rpx;
  background: #F8F9FA;
  border-bottom: 1rpx solid #E8EAED;
}

.top-close {
  font-size: 40rpx;
  color: #4285F4;
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.top-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #4285F4;
}

.top-spacer {
  width: 80rpx;
}

/* 登录容器 */
.login-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 48rpx;
  padding-top: 120rpx;
  padding-bottom: 160rpx;
}

/* Logo 区域 */
.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: auto;
  padding-top: 80rpx;
}

.logo-icon-wrapper {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 48rpx;
}

.logo-icon {
  width: 160rpx;
  height: 160rpx;
  font-size: 100rpx;
  color: #ffffff;
  background: #3367D6;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 40rpx rgba(30, 64, 175, 0.2);
}

.logo-badge {
  position: absolute;
  bottom: -8rpx;
  right: -8rpx;
  width: 64rpx;
  height: 64rpx;
  background: #8ab4f8;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 8rpx solid #F8F9FA;
}

.logo-badge-icon {
  font-size: 32rpx;
  color: #003c70;
}

.brand-name {
  font-size: 48rpx;
  font-weight: 800;
  color: #4285F4;
  margin-bottom: 16rpx;
  letter-spacing: -1rpx;
}

.brand-subtitle {
  font-size: 28rpx;
  font-weight: 500;
  color: #5F6368;
  opacity: 0.8;
  letter-spacing: 8rpx;
}

/* 登录按钮区域 */
.login-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
  margin-bottom: 256rpx;
}

/* 头像选择区域 */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.avatar-btn {
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  line-height: normal;
}

.avatar-btn::after {
  border: none;
}

.avatar-preview {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #f0f0f0;
  border: 4rpx solid #4285F4;
}

.avatar-tip {
  font-size: 24rpx;
  color: #666;
}

/* 昵称输入框 */
.nickname-input {
  width: 100%;
  height: 96rpx;
  background: #ffffff;
  border: 2rpx solid #E8EAED;
  border-radius: 24rpx;
  padding: 0 32rpx;
  font-size: 32rpx;
  color: #333;
}

.nickname-input:focus {
  border-color: #4285F4;
}

.wechat-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  height: 112rpx;
  background: #4285F4;
  color: #ffffff;
  border: none;
  border-radius: 24rpx;
  font-size: 32rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 24rpx rgba(0, 40, 142, 0.1);
}

.wechat-login-btn:active {
  transform: scale(0.95);
}

.btn-icon {
  font-size: 40rpx;
}

.phone-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  background: transparent;
  color: #5F6368;
  border: none;
  font-size: 28rpx;
  font-weight: 600;
}

.phone-login-btn:active {
  color: #4285F4;
}

/* 协议区域 */
.agreement-section {
  margin-top: auto;
}

.agreement-label {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  padding: 0 32rpx;
}

.agreement-text {
  font-size: 24rpx;
  color: #5F6368;
  line-height: 1.5;
  flex: 1;
}

.agreement-link {
  color: #4285F4;
  font-weight: 600;
}

/* 背景装饰 */
.bg-decoration {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.bg-blob {
  position: absolute;
  border-radius: 50%;
}

.bg-blob-1 {
  width: 1000rpx;
  height: 1000rpx;
  background: rgba(30, 64, 175, 0.05);
  top: -200rpx;
  right: -200rpx;
  filter: blur(200rpx);
}

.bg-blob-2 {
  width: 800rpx;
  height: 800rpx;
  background: rgba(100, 168, 254, 0.05);
  bottom: -200rpx;
  left: -200rpx;
  filter: blur(160rpx);
}
</style>
