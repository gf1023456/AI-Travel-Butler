<template>
  <view class="settings-page" :class="themeClass">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <header class="top-bar">
      <view class="top-left">
        <button class="back-btn" @click="goBack">
          <text>←</text>
        </button>
        <text class="top-title">设置</text>
      </view>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false">
      <!-- Account & Security -->
      <section class="settings-section">
        <text class="section-label">账号与安全</text>
        <view class="settings-card">
          <view class="settings-item" @click="showDevToast">
            <view class="settings-item-left">
              <text class="settings-icon">📱</text>
              <text class="settings-item-title">绑定手机号</text>
            </view>
            <view class="settings-item-right">
              <text class="settings-item-desc">{{ userStore.phone || '未绑定' }}</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item" @click="showDevToast">
            <view class="settings-item-left">
              <text class="settings-icon">🔒</text>
              <text class="settings-item-title">修改密码</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item danger" @click="showDevToast">
            <view class="settings-item-left">
              <text class="settings-icon">🗑️</text>
              <text class="settings-item-title">注销账号</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </section>

      <!-- Appearance -->
      <section class="settings-section">
        <text class="section-label">外观</text>
        <view class="settings-card">
          <view class="settings-item">
            <view class="settings-item-left">
              <text class="settings-icon">🌙</text>
              <text class="settings-item-title">深色模式</text>
            </view>
            <switch :checked="darkModeEnabled" @change="toggleDarkMode" :disabled="followSystemTheme" color="#0F4C5C" />
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item">
            <view class="settings-item-left">
              <text class="settings-icon">📱</text>
              <text class="settings-item-title">跟随系统</text>
            </view>
            <switch :checked="followSystemTheme" @change="toggleFollowSystem" color="#0F4C5C" />
          </view>
        </view>
      </section>

      <!-- Preferences -->
      <section class="settings-section">
        <text class="section-label">偏好设置</text>
        <view class="settings-card">
          <view class="settings-item">
            <view class="settings-item-left">
              <text class="settings-icon">🔔</text>
              <text class="settings-item-title">行程提醒</text>
            </view>
            <switch :checked="notificationEnabled" @change="toggleNotification" color="#0F4C5C" />
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item">
            <view class="settings-item-left">
              <text class="settings-icon">🎯</text>
              <text class="settings-item-title">优惠活动推送</text>
            </view>
            <switch :checked="promoEnabled" @change="togglePromo" color="#0F4C5C" />
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item" @click="showDevToast">
            <view class="settings-item-left">
              <text class="settings-icon">✈️</text>
              <text class="settings-item-title">行程偏好</text>
            </view>
            <view class="settings-item-right">
              <text class="settings-item-desc">休闲</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>
      </section>

      <!-- Storage -->
      <section class="settings-section">
        <text class="section-label">存储管理</text>
        <view class="settings-card">
          <view class="settings-item" @click="clearImageCache">
            <view class="settings-item-left">
              <text class="settings-icon">🖼️</text>
              <text class="settings-item-title">清除图片缓存</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item" @click="clearLocalData">
            <view class="settings-item-left">
              <text class="settings-icon">🗂️</text>
              <text class="settings-item-title">清除本地行程数据</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </section>

      <!-- About -->
      <section class="settings-section">
        <text class="section-label">关于与帮助</text>
        <view class="settings-card">
          <view class="settings-item" @click="showDevToast">
            <view class="settings-item-left">
              <text class="settings-icon">📋</text>
              <text class="settings-item-title">用户协议</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item" @click="showDevToast">
            <view class="settings-item-left">
              <text class="settings-icon">🔏</text>
              <text class="settings-item-title">隐私政策</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item" @click="showDevToast">
            <view class="settings-item-left">
              <text class="settings-icon">💬</text>
              <text class="settings-item-title">帮助与反馈</text>
            </view>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-divider"></view>
          <view class="settings-item">
            <view class="settings-item-left">
              <text class="settings-icon">📦</text>
              <text class="settings-item-title">版本信息</text>
            </view>
            <text class="settings-item-desc">{{ appVersion }}</text>
          </view>
        </view>
      </section>

      <view style="height: 40px;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { APP_CONFIG } from '@/config/index.js'
import { getCurrentTheme, setTheme, isFollowSystem, setFollowSystem, themeClass } from '@/utils/theme.js'

const userStore = useUserStore()
const { statusBarHeight } = useSafeArea()
const appVersion = ref(APP_CONFIG.VERSION)
const notificationEnabled = ref(true)
const promoEnabled = ref(true)
const darkModeEnabled = ref(false)
const followSystemTheme = ref(true)

onMounted(() => {
  userStore.restoreFromStorage()
  loadSettings()
})

const loadSettings = () => {
  try {
    notificationEnabled.value = uni.getStorageSync('setting_notification') !== false
    promoEnabled.value = uni.getStorageSync('setting_promo') !== false
    followSystemTheme.value = isFollowSystem()
    darkModeEnabled.value = getCurrentTheme() === 'dark'
  } catch (e) {
    console.log('加载设置失败', e)
  }
}

const goBack = () => uni.navigateBack()

const showDevToast = () => uni.showToast({ title: '功能开发中', icon: 'none' })

const toggleNotification = (e) => {
  notificationEnabled.value = e.detail.value
  uni.setStorageSync('setting_notification', e.detail.value)
  uni.showToast({ title: e.detail.value ? '已开启行程提醒' : '已关闭行程提醒', icon: 'none' })
}

const togglePromo = (e) => {
  promoEnabled.value = e.detail.value
  uni.setStorageSync('setting_promo', e.detail.value)
  uni.showToast({ title: e.detail.value ? '已开启推送' : '已关闭推送', icon: 'none' })
}

const toggleDarkMode = (e) => {
  darkModeEnabled.value = e.detail.value
  const theme = e.detail.value ? 'dark' : 'light'
  setTheme(theme)
  uni.showToast({ title: e.detail.value ? '已开启深色模式' : '已切换浅色模式', icon: 'none' })
}

const toggleFollowSystem = (e) => {
  followSystemTheme.value = e.detail.value
  setFollowSystem(e.detail.value)
  if (e.detail.value) {
    const systemInfo = uni.getSystemInfoSync()
    const isDark = systemInfo.theme === 'dark'
    darkModeEnabled.value = isDark
    uni.showToast({ title: '已跟随系统主题', icon: 'none' })
  } else {
    uni.showToast({ title: '已关闭跟随系统', icon: 'none' })
  }
}

const clearImageCache = () => {
  uni.showModal({
    title: '清除图片缓存',
    content: '确定要清除所有缓存的图片吗？',
    success: (res) => {
      if (res.confirm) {
        try {
          // #ifdef MP-WEIXIN
          const fs = wx.getFileSystemManager()
          const dir = `${wx.env.USER_DATA_PATH}/`
          fs.readdir({
            dirPath: dir,
            success: (readRes) => {
              let cleared = 0
              readRes.files.forEach(file => {
                if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
                  try { fs.unlinkSync(dir + file); cleared++ } catch (e) {}
                }
              })
              uni.showToast({ title: `已清除 ${cleared} 张缓存图片`, icon: 'success' })
            },
            fail: () => uni.showToast({ title: '清除失败', icon: 'none' })
          })
          // #endif
          // #ifndef MP-WEIXIN
          uni.showToast({ title: '已清除图片缓存', icon: 'success' })
          // #endif
        } catch (e) {
          uni.showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}

const clearLocalData = () => {
  uni.showModal({
    title: '清除本地行程数据',
    content: '此操作将删除所有未保存到服务器的本地行程，确定继续吗？',
    confirmColor: '#ff4444',
    success: (res) => {
      if (res.confirm) {
        try {
          uni.removeStorageSync('travel_history')
          uni.removeStorageSync('travel_store')
          uni.showToast({ title: '已清除本地数据', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}
</script>

<style scoped>
.settings-page { min-height: 100vh; background: var(--color-surface); }

.status-bar { background: rgba(255,255,255,0.7); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); }
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24rpx 40rpx 24rpx;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
  position: sticky; top: 0; z-index: 10;
}
.top-left { display: flex; align-items: center; gap: 12px; }
.back-btn {
  width: 36px; height: 36px; display: flex; align-items: center;
  justify-content: center; font-size: 20px; color: var(--color-primary);
  background: transparent; border: none; padding: 0;
}
.back-btn::after { border: none; }
.top-title { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; line-height: 32px; }

.content { padding: 16rpx 40rpx 80rpx; }

.settings-section { margin-bottom: 24px; }
.section-label {
  font-size: 12px; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.settings-card {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 24px; overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}
.settings-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 36rpx 40rpx; transition: all var(--transition-fast);
}
.settings-item:active { background: rgba(255,255,255,0.4); }
.settings-item-left { display: flex; align-items: center; gap: 14px; }
.settings-icon { font-size: 20px; width: 24px; text-align: center; }
.settings-item-title { font-size: 15px; font-weight: 500; color: var(--color-on-surface); line-height: 24px; }
.settings-item-right { display: flex; align-items: center; gap: 8px; }
.settings-item-desc { font-size: 13px; color: var(--color-on-surface-variant); opacity: 0.6; }
.menu-arrow { font-size: 20px; color: var(--color-outline-variant); }
.menu-divider { height: 1px; margin: 0 40rpx; background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent); }

.settings-item.danger .settings-item-title { color: var(--color-error); }
</style>
