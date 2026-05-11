<template>
  <view class="page-container">
    <!-- 顶部导航 -->
    <view class="top-bar" :style="'padding-top:' + (safeAreaTop + 32) + 'px'">
      <view class="back-btn" @click="goBack">
        <text>←</text>
      </view>
      <text class="page-title">灵感探索</text>
    </view>

    <scroll-view scroll-y class="content">
      <!-- 模式切换 -->
      <view class="section">
        <view class="mode-card card-pop">
          <view class="mode-content">
            <view class="mode-info">
              <text class="mode-name">{{ isPlannerMode ? '深度排期' : '快速探索' }}</text>
              <text class="mode-hint">{{ isPlannerMode ? '完整行程规划 · 多日安排' : '景点发现 · 轻量推荐' }}</text>
            </view>
            <switch :checked="isPlannerMode" @change="onModeToggle" color="#4285F4" />
          </view>
        </view>
      </view>

      <!-- 旅行风格 -->
      <view class="section" v-if="isPlannerMode">
        <text class="section-label">旅行风格</text>
        <view class="style-grid">
          <view
            v-for="(option, idx) in travelModeOptions"
            :key="idx"
            :class="['style-item', travelModeIndex === idx ? 'style-active' : '']"
            @click="travelModeIndex = idx"
          >
            <text class="style-name">{{ option.label }}</text>
          </view>
        </view>
      </view>

      <!-- 输入区域 -->
      <view class="section section-main">
        <view class="input-card card-pop">
          <textarea
            class="main-input"
            v-model="userInput"
            placeholder="描述你的旅行想法，例如：我想去云南，5 天时间，喜欢自然风光和美食..."
            :auto-height="true"
            :maxlength="500"
          />
          <view class="input-footer">
            <text class="char-count">{{ charCount }} / 500</text>
          </view>
        </view>
      </view>

      <!-- 生成按钮 -->
      <button
        class="generate-btn"
        :loading="travelStore.loading"
        :disabled="travelStore.loading || !userInput.trim()"
        @click="handleGenerate"
      >
        <text>{{ isPlannerMode ? '生成完整行程' : '开始探索' }}</text>
      </button>

      <!-- 底部提示 -->
      <view class="section section-hint">
        <text class="hint-text">慧游将根据你的描述，智能推荐最佳行程方案</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { getCurrentModel } from '@/api/travel.js'
import { saveHistory } from '@/api/history.js'

const travelStore = useTravelStore()
const userStore = useUserStore()

const userInput = ref('')
const isPlannerMode = ref(false)
const travelModeIndex = ref(0)
const currentModelName = ref('GPT-4o')

// 安全区域顶部高度
const safeAreaTop = ref(0)

const travelModeOptions = [
  { label: '轻装上阵', value: 'light' },
  { label: '深度打卡', value: 'deep' },
  { label: '美食之旅', value: 'food' },
  { label: '户外探索', value: 'outdoor' }
]

const charCount = computed(() => userInput.value.length)

const onModeToggle = (e) => {
  isPlannerMode.value = e.detail.value
}

const goBack = () => {
  uni.navigateBack()
}

const handleGenerate = async () => {
  // 检查登录状态
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' })
    }, 1500)
    return
  }
  
  if (!userInput.value.trim()) {
    uni.showToast({ title: '请输入旅行描述', icon: 'none' })
    return
  }

  try {
    uni.showLoading({ title: '规划中...' })
    
    const result = await travelStore.createPlan({
      userInput: userInput.value,
      modelType: 'auto',
      isPlannerMode: isPlannerMode.value,
      travelMode: travelModeOptions[travelModeIndex.value].value
    })

    uni.hideLoading()

    if (result) {
      // 不自动保存，让用户在plan页面手动保存
      console.log('行程已生成，准备查看')
      
      uni.showToast({ title: '行程已生成', icon: 'success' })
      uni.navigateTo({ url: '/pages/plan/plan' })
    }
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: error.message || '生成失败', icon: 'none' })
  }
}

onMounted(async () => {
  // 获取安全区域
  try {
    const systemInfo = uni.getSystemInfoSync()
    safeAreaTop.value = systemInfo.safeAreaInsets?.top || 0
    console.log('[Explore] 安全区域顶部:', safeAreaTop.value)
  } catch (e) {
    console.error('[Explore] 获取安全区域失败:', e)
    safeAreaTop.value = 0
  }
  
  try {
    const result = await getCurrentModel()
    if (result?.modelName) {
      currentModelName.value = result.modelName
    }
  } catch (e) {
    console.log('获取模型失败', e)
  }
})
</script>

<style scoped>
@keyframes driftIn {
  from { opacity: 0; transform: translateY(24rpx) scale(0.98);}
  to { opacity: 1; transform: translateY(0) scale(1);}
}

.page-container {
  min-height: 100vh;
  background: var(--gradient-aurora);
  display: flex;
  flex-direction: column;
}

.top-bar {
  animation: driftIn var(--duration-slow) var(--ease-out);

  display: flex;
  align-items: center;
  padding: 32rpx var(--page-padding-x);
  gap: 20rpx;
  background: var(--bg-topbar);
  border-bottom: 1rpx solid var(--border-glass-soft);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.back-btn {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: #404040;
}

.page-title {
  flex: 1;
  font-size: var(--text-xl);
  font-weight: 600;
  color: #16203a;
  font-family: var(--font-display);
  letter-spacing: var(--title-letter-spacing);
}

.model-tag {
  padding: 12rpx 24rpx;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 16rpx;
  font-size: 24rpx;
  color: #4285F4;
  font-weight: 500;
}

.content {
  flex: 1;
  padding: 0 40rpx;
}

.aurora-orb {
  position: fixed;
  border-radius: 999rpx;
  filter: blur(10px);
  z-index: 0;
  pointer-events: none;
}

.orb-a { width: 360rpx; height: 360rpx; top: 90rpx; right: -120rpx; background: radial-gradient(circle, rgba(96,165,250,.45), rgba(96,165,250,0)); }
.orb-b { width: 300rpx; height: 300rpx; bottom: 180rpx; left: -90rpx; background: radial-gradient(circle, rgba(139,92,246,.35), rgba(139,92,246,0)); }

.content { position: relative; z-index: 2; }

.card-pop { border-radius: 28rpx; transform: translateY(0); transition: transform .25s var(--ease-out), box-shadow .25s var(--ease-out); }
.card-pop:active { transform: translateY(-4rpx) scale(.995); box-shadow: 0 20rpx 44rpx rgba(24,73,169,.16); }

.section {
  margin-bottom: var(--section-gap);
}

.section-label {
  display: block;
  font-size: var(--text-base);
  font-weight: 600;
  color: #404040;
  margin-bottom: 24rpx;
}

.mode-card {
  background: rgba(255,255,255,.94);
  border-radius: var(--radius-xl);
  padding: 32rpx;
  box-shadow: var(--shadow-card-soft);
  border: 1rpx solid var(--border-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.mode-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-info {
  flex: 1;
}

.mode-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #202124;
  margin-bottom: 8rpx;
}

.mode-hint {
  display: block;
  font-size: 26rpx;
  color: #737373;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.style-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx;
  background: rgba(255,255,255,.94);
  border-radius: var(--radius-xl);
  border: 1rpx solid var(--border-glass-soft);
  box-shadow: var(--shadow-card-soft);
}

.style-active {
  border-color: #4285F4;
  background: rgba(99, 102, 241, 0.05);
}

.style-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #404040;
}

.input-card {
  background: rgba(255,255,255,.94);
  border-radius: var(--radius-xl);
  padding: 32rpx;
  box-shadow: var(--shadow-card-soft);
  border: 1rpx solid var(--border-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.main-input {
  width: 100%;
  min-height: 200rpx;
  font-size: 30rpx;
  line-height: 1.6;
  color: #202124;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20rpx;
}

.char-count {
  font-size: var(--text-sm);
  color: #a1a1a1;
}

.generate-btn {
  width: 100%;
  height: var(--btn-height);
  background: var(--gradient-primary);
  border-radius: var(--radius-xl);
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card-strong);
}

.generate-btn[disabled] {
  opacity: 0.6;
}

.section-hint {
  text-align: center;
  padding: 40rpx;
}

.hint-text {
  font-size: var(--text-sm);
  color: #a1a1aa;
}
</style>
