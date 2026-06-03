<template>
  <view class="agreement-page" :class="themeClass">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <header class="top-bar">
      <view class="top-left">
        <button class="back-btn" @click="goBack">
          <text>←</text>
        </button>
        <text class="top-title">隐私政策</text>
      </view>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false">
      <view class="update-time">更新日期：2026年1月1日</view>
      <view class="update-time">生效日期：2026年1月1日</view>

      <view class="section" v-for="(item, idx) in sections" :key="idx">
        <text class="section-title">{{ item.title }}</text>
        <text class="section-text" v-for="(p, pi) in item.paragraphs" :key="pi">{{ p }}</text>
      </view>

      <view style="height: 40px;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'

const { statusBarHeight } = useSafeArea()
const goBack = () => uni.navigateBack()

const sections = [
  {
    title: '一、我们如何收集和使用您的个人信息',
    paragraphs: [
      '在您使用「行程一下」小程序时，我们会收集以下信息：',
      '1. 微信授权信息：当您选择微信登录时，我们会获取您的微信 OpenID 用于身份识别。',
      '2. 用户资料信息：包括您主动设置的头像和昵称。',
      '3. 行程规划数据：您输入的出行偏好、目的地、时间等行程相关信息。',
      '我们收集上述信息是为了向您提供行程规划服务、改善用户体验和保障服务安全。'
    ]
  },
  {
    title: '二、我们如何存储和保护您的个人信息',
    paragraphs: [
      '您的个人信息存储在中华人民共和国境内的服务器上。如需跨境传输，我们会单独征得您的授权同意。',
      '我们采用业界通行的安全技术和措施来保护您的个人信息，包括但不限于数据加密、访问控制、安全审计等。',
      '我们仅保留为实现服务目的所必需的最短期限内的您的个人信息。'
    ]
  },
  {
    title: '三、我们如何共享、转让和公开披露您的个人信息',
    paragraphs: [
      '我们不会将您的个人信息出售给任何第三方。',
      '在以下情况下，我们可能会共享您的个人信息：',
      '1. 获得您明确同意后，我们会与授权方共享您的相关信息。',
      '2. 根据法律法规规定或行政、司法机关的强制性要求。'
    ]
  },
  {
    title: '四、您的权利',
    paragraphs: [
      '您有权访问、更正、删除您的个人信息，法律法规另有规定的除外。',
      '您可以通过小程序"设置"页面管理您的个人信息和偏好设置。',
      '您有权注销您的账号，注销后我们将停止提供服务并删除您的个人信息。'
    ]
  },
  {
    title: '五、未成年人保护',
    paragraphs: [
      '我们非常重视对未成年人个人信息的保护。如果您是未满14周岁的未成年人，请在监护人的陪同和指导下使用本服务。'
    ]
  },
  {
    title: '六、隐私政策的变更',
    paragraphs: [
      '我们可能会适时修订本政策。当政策条款发生变更时，我们会在版本更新时以推送通知或弹窗等方式向您展示变更后的内容。',
      '若您在政策变更后继续使用本服务，即代表您接受变更后的隐私政策。'
    ]
  },
  {
    title: '七、联系我们',
    paragraphs: [
      '如对本隐私政策有任何疑问，请通过小程序内"帮助与反馈"功能与我们联系。'
    ]
  }
]
</script>

<style scoped>
.agreement-page { min-height: 100vh; background: var(--color-surface); }
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

.content { padding: 24rpx 40rpx 80rpx; }

.update-time {
  font-size: 13px; color: var(--color-on-surface-variant); margin-bottom: 8px;
}

.section { margin-bottom: 28px; }
.section-title {
  font-size: 16px; font-weight: 600; color: var(--color-on-surface);
  margin-bottom: 12px; display: block; line-height: 1.5;
}
.section-text {
  font-size: 14px; color: var(--color-on-surface-variant); line-height: 1.8;
  display: block; margin-bottom: 8px;
}
</style>
