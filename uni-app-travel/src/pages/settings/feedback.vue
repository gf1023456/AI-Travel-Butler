<template>
  <view class="feedback-page" :class="themeClass">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <header class="top-bar">
      <view class="top-left">
        <button class="back-btn" @click="goBack">
          <text>←</text>
        </button>
        <text class="top-title">帮助与反馈</text>
      </view>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false">
      <!-- FAQ -->
      <section class="section">
        <text class="section-label">常见问题</text>
        <view class="settings-card">
          <view class="faq-item" v-for="(item, idx) in faqList" :key="idx" @click="toggleFaq(idx)">
            <view class="faq-question">
              <text class="faq-q-text">{{ item.q }}</text>
              <text class="faq-arrow" :class="{ 'faq-arrow-open': item.open }">›</text>
            </view>
            <view class="faq-answer" v-if="item.open">
              <text class="faq-a-text">{{ item.a }}</text>
            </view>
          </view>
        </view>
      </section>

      <!-- Feedback -->
      <section class="section">
        <text class="section-label">意见反馈</text>
        <view class="settings-card feedback-card">
          <view class="feedback-type">
            <view
              class="type-tag"
              :class="{ 'type-tag-active': feedbackType === t }"
              v-for="t in types"
              :key="t"
              @click="feedbackType = t"
            >
              <text>{{ t }}</text>
            </view>
          </view>
          <textarea
            class="feedback-textarea"
            v-model="feedbackContent"
            placeholder="请描述您的问题或建议..."
            maxlength="500"
          />
          <view class="feedback-footer">
            <text class="char-count">{{ feedbackContent.length }}/500</text>
            <button class="submit-btn brand-gradient" @click="submitFeedback" :disabled="!feedbackContent.trim()">
              <text class="submit-text">提交</text>
            </button>
          </view>
        </view>
      </section>

      <!-- Contact -->
      <section class="section">
        <text class="section-label">联系我们</text>
        <view class="settings-card">
          <view class="settings-item" @click="copyEmail">
            <view class="settings-item-left">
              <text class="settings-icon">📧</text>
              <text class="settings-item-title">邮箱</text>
            </view>
            <view class="settings-item-right">
              <text class="settings-item-desc">gf_6667@163.com</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
          <view class="menu-divider"></view>
          <button class="settings-item contact-btn" open-type="contact">
            <view class="settings-item-left">
              <text class="settings-icon">💬</text>
              <text class="settings-item-title">在线客服</text>
            </view>
            <text class="menu-arrow">›</text>
          </button>
        </view>
      </section>

      <view style="height: 40px;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'

const { statusBarHeight } = useSafeArea()
const goBack = () => uni.navigateBack()

const faqList = reactive([
  { q: '如何创建行程规划？', a: '在首页输入您的目的地、出行时间和偏好，点击"开始规划"即可生成 AI 行程建议。', open: false },
  { q: '行程规划消耗配额吗？', a: '每次生成行程规划会消耗 1 次配额。每日有免费配额，也可通过活动获取额外配额。', open: false },
  { q: '如何修改行程偏好？', a: '进入"设置 > 行程偏好"，可以选择休闲、商务、探险等不同旅行风格。', open: false },
  { q: '生成的行程可以编辑吗？', a: '可以。生成行程后，点击具体景点即可进行替换、删除或调整顺序。', open: false },
  { q: '数据会丢失吗？', a: '行程数据会自动保存到服务器。如需清除本地缓存，可在"设置 > 存储管理"中操作。', open: false }
])

const toggleFaq = (idx) => {
  faqList[idx].open = !faqList[idx].open
}

const types = ['功能建议', '问题反馈', '其他']
const feedbackType = ref('功能建议')
const feedbackContent = ref('')

const submitFeedback = () => {
  if (!feedbackContent.value.trim()) return
  try {
    const history = uni.getStorageSync('feedback_history') || []
    history.unshift({
      type: feedbackType.value,
      content: feedbackContent.value,
      time: new Date().toISOString()
    })
    uni.setStorageSync('feedback_history', history.slice(0, 50))
    feedbackContent.value = ''
    uni.showToast({ title: '感谢您的反馈', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
  }
}

const copyEmail = () => {
  uni.setClipboardData({
    data: 'gf_6667@163.com',
    success: () => uni.showToast({ title: '已复制邮箱地址', icon: 'success' })
  })
}
</script>

<style scoped>
.feedback-page { min-height: 100vh; background: var(--color-surface); }
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

.section { margin-bottom: 24px; }
.section-label {
  font-size: 12px; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
  text-transform: uppercase; margin-bottom: 12px;
}

.settings-card {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 24px; overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}

/* FAQ */
.faq-item { padding: 28rpx 40rpx; border-bottom: 1px solid rgba(0,0,0,0.04); }
.faq-item:last-child { border-bottom: none; }
.faq-question { display: flex; align-items: center; justify-content: space-between; }
.faq-q-text { font-size: 15px; font-weight: 500; color: var(--color-on-surface); flex: 1; }
.faq-arrow { font-size: 20px; color: var(--color-outline-variant); transition: transform 0.2s; }
.faq-arrow-open { transform: rotate(90deg); }
.faq-answer { padding-top: 16rpx; }
.faq-a-text { font-size: 14px; color: var(--color-on-surface-variant); line-height: 1.7; }

/* Feedback */
.feedback-card { padding: 28rpx 40rpx; }
.feedback-type { display: flex; gap: 12px; margin-bottom: 20px; }
.type-tag {
  padding: 8rpx 24rpx; border-radius: 40px;
  background: var(--color-surface-container);
  font-size: 13px; color: var(--color-on-surface-variant);
  font-weight: 500;
}
.type-tag-active {
  background: var(--color-primary); color: #ffffff;
}
.feedback-textarea {
  width: 100%; height: 160px; background: var(--color-surface-container-low);
  border-radius: 16px; padding: 20rpx; font-size: 14px;
  color: var(--color-on-surface); line-height: 1.6;
  margin-bottom: 16px;
}
.feedback-footer { display: flex; align-items: center; justify-content: space-between; }
.char-count { font-size: 12px; color: var(--color-outline); }
.submit-btn {
  padding: 12rpx 40rpx; border-radius: 12px; border: none;
  font-size: 14px; font-weight: 600; color: #ffffff;
  background: var(--color-primary); min-width: 120rpx;
  height: 36px; display: flex; align-items: center; justify-content: center;
}
.submit-btn::after { border: none; }
.submit-btn[disabled] { opacity: 0.4; }
.submit-text { color: #ffffff; font-size: 14px; font-weight: 600; }

/* Contact */
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

.contact-btn {
  width: 100%; background: transparent; text-align: left;
  border: none; outline: none; padding: 0; margin: 0;
  border-radius: 0; line-height: normal;
}
.contact-btn::after { border: none; }
</style>
