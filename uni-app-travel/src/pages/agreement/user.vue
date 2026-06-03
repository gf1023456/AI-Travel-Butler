<template>
  <view class="agreement-page" :class="themeClass">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <header class="top-bar">
      <view class="top-left">
        <button class="back-btn" @click="goBack">
          <text>←</text>
        </button>
        <text class="top-title">用户协议</text>
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
    title: '一、服务条款的确认和接纳',
    paragraphs: [
      '欢迎使用「行程一下」小程序（以下简称"本服务"）。在使用本服务前，请您仔细阅读并充分理解本用户协议（以下简称"本协议"）。',
      '您一旦使用本服务，即视为您已阅读并同意本协议的约束。如果您不同意本协议的任何内容，请立即停止使用本服务。'
    ]
  },
  {
    title: '二、服务内容',
    paragraphs: [
      '本服务是一款基于人工智能技术的智能行程规划工具，为用户提供旅行行程规划、景点推荐、行程优化等服务。',
      '本服务通过 AI 模型生成行程建议，生成内容仅供参考，不构成任何承诺或保证。用户应根据自身情况独立判断并做出决策。'
    ]
  },
  {
    title: '三、用户账号',
    paragraphs: [
      '您通过微信授权登录使用本服务，需确保提供的微信账号信息真实有效。',
      '您应妥善保管账号信息，因账号保管不善造成的损失由您自行承担。如发现账号被非法使用，应立即通知我们。'
    ]
  },
  {
    title: '四、使用规范',
    paragraphs: [
      '您在使用本服务时，应遵守中华人民共和国相关法律法规，不得利用本服务从事违法违规活动。',
      '您不得对本服务进行反向工程、反编译、反汇编，或以其他方式试图获取本服务的源代码。'
    ]
  },
  {
    title: '五、知识产权',
    paragraphs: [
      '本服务的所有内容，包括但不限于文字、图片、软件、界面设计、版面编排等，均受著作权法、商标法及其他知识产权法律法规的保护。',
      '未经我们书面许可，您不得以任何形式复制、传播、展示、修改本服务的任何内容。'
    ]
  },
  {
    title: '六、免责声明',
    paragraphs: [
      '本服务提供的行程规划建议由 AI 生成，我们不对行程建议的准确性、完整性、时效性做出任何保证。',
      '因不可抗力、系统故障、网络中断等原因导致的服务中断，我们不承担任何责任。'
    ]
  },
  {
    title: '七、协议变更',
    paragraphs: [
      '我们有权根据需要修改本协议条款，修改后的协议将在本页面更新并重新标注生效日期。',
      '如果您在协议变更后继续使用本服务，即视为您接受变更后的协议。'
    ]
  },
  {
    title: '八、联系我们',
    paragraphs: [
      '如对本协议有任何疑问，请通过小程序内"帮助与反馈"功能与我们联系。'
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
