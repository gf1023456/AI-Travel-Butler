<template>
  <view class="feedback-page" :class="themeClass">
    <NavBar show-back title="帮助与反馈" @back="goBack" />
    <scroll-view scroll-y class="content" show-scrollbar="false">
      <!-- 常见问题 -->
      <section class="faq-section">
        <text class="section-title">常见问题</text>
        <view class="faq-card">
          <view class="faq-item" v-for="(faq, idx) in faqs" :key="idx" @click="toggleFaq(idx)">
            <view class="faq-q">
              <text class="faq-q-text">{{ faq.q }}</text>
              <text class="faq-arrow" :class="{ 'faq-arrow-open': faq.open }">›</text>
            </view>
            <view v-if="faq.open" class="faq-a">
              <text class="faq-a-text">{{ faq.a }}</text>
            </view>
          </view>
        </view>
      </section>

      <!-- 反馈入口 -->
      <section class="feedback-section">
        <text class="section-title">意见反馈</text>
        <view class="feedback-card">
          <textarea
            class="feedback-textarea"
            v-model="feedbackText"
            placeholder="请描述您的问题或建议..."
            :maxlength="500"
          />
          <view class="feedback-footer">
            <text class="feedback-count">{{ feedbackText.length }}/500</text>
            <button class="feedback-submit" :disabled="!feedbackText.trim()" @click="submitFeedback">
              <text>提交反馈</text>
            </button>
          </view>
        </view>
      </section>

      <!-- 联系方式 -->
      <section class="contact-section">
        <text class="section-title">联系我们</text>
        <view class="contact-card">
          <view class="contact-item">
            <text class="contact-icon">📧</text>
            <text class="contact-text">gaof_6667@163.com</text>
          </view>
          <view class="contact-divider"></view>
          <view class="contact-item">
            <text class="contact-icon">💬</text>
            <text class="contact-text">微信公众号：行程一下</text>
          </view>
        </view>
      </section>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { themeClass } from '@/utils/theme.js'
import NavBar from '@/components/NavBar.vue'

const goBack = () => uni.navigateBack()

const feedbackText = ref('')

const faqs = ref([
  { q: '如何生成行程？', a: '在探索页面点击右下角+号，输入你的旅行想法即可生成专属行程方案。', open: false },
  { q: '行程配额怎么增加？', a: '每位用户每日有免费配额，邀请好友可获得额外3次额度。', open: false },
  { q: '如何编辑已有行程？', a: '在行程详情页点击底部"编辑"按钮，可对景点进行排序、删除、修改时间等操作。', open: false },
  { q: '支持哪些城市？', a: '目前支持全国300+热门城市和景区，覆盖所有省份。', open: false },
  { q: '如何分享行程？', a: '在行程详情页点击"分享"按钮，可生成精美分享图片。', open: false }
])

const toggleFaq = (idx) => {
  faqs.value[idx].open = !faqs.value[idx].open
}

const submitFeedback = () => {
  if (!feedbackText.value.trim()) return
  uni.showLoading({ title: '提交中...' })
  setTimeout(() => {
    uni.hideLoading()
    uni.showToast({ title: '感谢您的反馈！', icon: 'success' })
    feedbackText.value = ''
  }, 800)
}
</script>

<style scoped>
.feedback-page { min-height: 100vh; background: var(--color-surface); }
.content { padding: 16rpx 40rpx 80rpx; }

.section-title {
  font-size: 14px; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant); opacity: 0.7;
  margin-bottom: 12px; display: block; padding-left: 4rpx;
}

.faq-section { margin-bottom: 32px; }
.faq-card {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.3); border-radius: 24px;
  overflow: hidden;
}
.faq-item { padding: 32rpx 40rpx; border-bottom: 1px solid rgba(0,0,0,0.03); }
.faq-item:last-child { border-bottom: none; }
.faq-q { display: flex; align-items: center; justify-content: space-between; }
.faq-q-text { font-size: 15px; font-weight: 600; color: var(--color-on-surface); flex: 1; }
.faq-arrow { font-size: 20px; color: var(--color-outline-variant); transition: transform 0.2s; }
.faq-arrow-open { transform: rotate(90deg); }
.faq-a { margin-top: 12px; }
.faq-a-text { font-size: 14px; color: var(--color-on-surface-variant); line-height: 1.6; }

.feedback-section { margin-bottom: 32px; }
.feedback-card {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.3); border-radius: 24px;
  padding: 32rpx;
}
.feedback-textarea {
  width: 100%; min-height: 120px; background: transparent; border: none;
  font-size: 15px; line-height: 24px; color: var(--color-on-surface);
}
.feedback-textarea::placeholder { color: var(--color-on-surface-variant); opacity: 0.4; }
.feedback-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.04); }
.feedback-count { font-size: 12px; color: var(--color-outline); opacity: 0.5; }
.feedback-submit {
  padding: 8px 24px; border-radius: 999px; font-size: 14px; font-weight: 600;
  background: linear-gradient(135deg, #0F4C5C, #14B8A6); color: #fff;
  border: none;
}
.feedback-submit::after { border: none; }
.feedback-submit:disabled { opacity: 0.4; }

.contact-section { margin-bottom: 32px; }
.contact-card {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.3); border-radius: 24px;
  overflow: hidden;
}
.contact-item {
  display: flex; align-items: center; gap: 12px;
  padding: 32rpx 40rpx;
}
.contact-icon { font-size: 20px; }
.contact-text { font-size: 15px; color: var(--color-on-surface); }
.contact-divider { height: 1px; margin: 0 40rpx; background: rgba(0,0,0,0.03); }
</style>
