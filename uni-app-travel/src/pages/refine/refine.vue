<template>
  <view class="page-container">
    <!-- 头部 -->
    <view class="header-section slide-up">
      <view class="header-bg">
        <view class="header-glow header-glow-1"></view>
        <view class="header-glow header-glow-2"></view>
      </view>

      <text class="title">优化行程</text>
      <text class="subtitle">对现有行程进行调整和优化</text>
    </view>

    <!-- 表单区域 -->
    <view class="form-section glass-surface-heavy slide-up">
      <!-- 当前行程 -->
      <view class="form-group">
        <text class="group-label">当前行程</text>
        <view class="plan-preview">
          <view class="plan-info">
            <text class="plan-icon">📍</text>
            <text class="plan-dest">{{ travelStore.currentPlan.destination || '未知目的地' }}</text>
          </view>
          <view class="plan-info">
            <text class="plan-icon">📅</text>
            <text class="plan-days">{{ travelStore.currentPlan.duration || 0 }}天行程</text>
          </view>
        </view>
      </view>

      <!-- 优化要求 -->
      <view class="form-group">
        <text class="group-label">优化要求</text>
        <view class="textarea-wrapper">
          <textarea
            class="textarea-field"
            v-model="refineRequest"
            :placeholder="placeholderText"
            :auto-height="true"
            :maxlength="500"
          />
          <text class="char-count">{{ charCount }} / 500</text>
        </view>
      </view>

      <!-- 提交按钮 -->
      <button
        class="btn-primary btn-submit"
        :loading="travelStore.loading"
        :disabled="travelStore.loading || !refineRequest.trim()"
        @click="handleRefine"
      >
        <text v-if="!loading">✨ 开始优化</text>
      </button>
    </view>

    <!-- 错误提示 -->
    <view v-if="travelStore.error" class="error-toast slide-up">
      <text class="error-icon">⚠️</text>
      <text class="error-text">{{ travelStore.error }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTravelStore } from '@/store/travel.js'

const travelStore = useTravelStore()
const refineRequest = ref('')

const charCount = computed(() => refineRequest.value.length)

const placeholderText = '请输入优化需求，例如：\n· 增加某个景点或减少某个地点\n· 调整行程顺序或时间安排\n· 添加美食或购物推荐'

const handleRefine = async () => {
  if (!refineRequest.value.trim()) {
    uni.showToast({ title: '请输入优化需求', icon: 'none' }); return
  }
  if (!travelStore.currentPlan) {
    uni.showToast({ title: '请先创建行程', icon: 'none' }); return
  }
  try {
    uni.showLoading({ title: '正在优化...' })
    await travelStore.refinePlan({
      userInput: travelStore.currentPlan.userInput || travelStore.currentPlan.destination,
      modelType: travelStore.currentPlan.modelType || 'auto',
      isPlannerMode: travelStore.currentPlan.isPlannerMode || false,
      travelMode: travelStore.currentPlan.travelMode || 'deep',
      refineInstruction: refineRequest.value,
      basePlan: travelStore.currentPlan
    })
    uni.hideLoading()
    uni.showToast({ title: '优化成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '优化失败', icon: 'error' })
    console.error('优化失败:', error)
  }
}
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #F8F9FA 0%, #FAFBFC 100%);
  padding: 48rpx 40rpx;
}

/* 头部 */
.header-section {
  position: relative;
  text-align: center;
  padding-top: 20rpx;
  margin-bottom: 48rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.header-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.4;
}

.header-glow-1 {
  width: 280rpx;
  height: 280rpx;
  background: linear-gradient(135deg, #4285F4 0%, #5E97F6 100%);
  top: -80rpx;
  right: -60rpx;
}

.header-glow-2 {
  width: 200rpx;
  height: 200rpx;
  background: linear-gradient(135deg, #34A853 0%, #5E97F6 100%);
  bottom: -60rpx;
  left: -40rpx;
}

.title {
  position: relative;
  font-size: 52rpx;
  font-weight: 700;
  color: #202124;
  display: block;
  margin-bottom: 16rpx;
  letter-spacing: 1px;
}

.subtitle {
  position: relative;
  font-size: 28rpx;
  color: #737373;
  display: block;
}

/* 表单区域 */
.form-section {
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.group-label {
  font-size: 30rpx;
  color: #202124;
  font-weight: 600;
}

/* 行程预览 */
.plan-preview {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 28rpx;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%);
  border-radius: 20rpx;
  border: 1rpx solid rgba(99, 102, 241, 0.12);
}

.plan-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.plan-icon {
  font-size: 32rpx;
}

.plan-dest {
  font-size: 30rpx;
  color: #202124;
  font-weight: 600;
}

.plan-days {
  font-size: 30rpx;
  color: #525252;
}

/* 文本域 */
.textarea-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
}

.textarea-field {
  width: 100%;
  min-height: 360rpx;
  background: rgba(250, 250, 250, 0.8);
  border: 1rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 18rpx;
  padding: 28rpx;
  font-size: 30rpx;
  color: #202124;
  line-height: 1.7;
  transition: all 0.2s;
}

.textarea-field:focus {
  background: #fff;
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 3rpx rgba(99, 102, 241, 0.08);
}

.char-count {
  display: block;
  text-align: right;
  font-size: 24rpx;
  color: #a3a3a3;
  margin-top: 12rpx;
}

/* 按钮 */
.btn-submit {
  width: 100%;
  height: 104rpx;
  margin-top: 8rpx;
}

/* 错误提示 */
.error-toast {
  margin-top: 32rpx;
  padding: 28rpx 32rpx;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.06) 100%);
  border-radius: 18rpx;
  border: 1rpx solid rgba(239, 68, 68, 0.15);
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.error-icon {
  font-size: 36rpx;
}

.error-text {
  font-size: 28rpx;
  color: #dc2626;
  font-weight: 500;
}
</style>