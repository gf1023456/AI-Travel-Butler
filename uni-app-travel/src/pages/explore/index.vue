<template>
  <view class="explore-page" :class="themeClass">
    <NavBar show-back show-avatar show-notif title="灵感探索" />
    <scroll-view scroll-y class="content" show-scrollbar="false">
      <section class="section">
        <text class="section-overline">旅行风格</text>
        <view class="style-grid">
          <view
            v-for="(style, idx) in travelStyles"
            :key="idx"
            :class="['style-card', travelModeIndex === idx ? 'style-selected' : '']"
            @click="travelModeIndex = idx"
          >
            <image class="style-img" :src="style.image" mode="aspectFill" />
            <view class="style-overlay"></view>
            <view class="style-label">
              <text class="style-icon">{{ style.icon }}</text>
              <text class="style-name">{{ style.name }}</text>
            </view>
          </view>
        </view>
      </section>

      <section class="section">
        <view class="input-header">
          <text class="section-overline">告诉我你的想法</text>
          <view class="input-badge">
            <text>✨ 深度定制</text>
          </view>
        </view>
        <view class="input-card">
          <textarea
            class="main-textarea"
            v-model="userInput"
            placeholder="想去上海看展，住在外滩附近，对法租界的咖啡馆感兴趣..."
            :maxlength="500"
            :auto-height="true"
          />
          <view class="input-footer">
            <text class="char-count">{{ charCount }} / 500</text>
          </view>
        </view>
        
        <!-- 骨架状态提示 - 使用 Skeleton 组件 -->
        <Skeleton v-if="isSkeletonPhase" type="inline" icon="🧠" :status-text="skeletonStatusText" :elapsed="skeletonElapsed" />
        <view class="tag-chips">
          <text class="tag-chip" @click="userInput = '上海 3天 深度游'">上海 3天</text>
          <text class="tag-chip" @click="userInput = '东京 樱花季 4天'">东京 樱花季</text>
          <text class="tag-chip" @click="userInput = '成都 美食之旅 3天'">成都 美食</text>
        </view>
      </section>

      <section class="section action-section">
        <button
          class="generate-btn"
          :disabled="travelStore.loading || !userInput.trim()"
          @click="handleGenerate"
        >
          <text class="gen-icon">✨</text>
          <text>开始灵感生成</text>
        </button>
        <text class="agreement-hint">点击生成即代表同意 慧游旅行服务协议</text>
      </section>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { getCurrentModel } from '@/api/travel.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'
import NavBar from '@/components/NavBar.vue'
import Skeleton from '@/components/Skeleton.vue'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight } = useSafeArea()

onMounted(() => { userStore.restoreFromStorage() })

const userInput = ref('')
const travelModeIndex = ref(0)

// 骨架状态
const isSkeletonPhase = ref(false)
const skeletonStatusText = ref('正在生成行程骨架...')
const skeletonElapsed = ref(0)
let skeletonStartTime = 0

// 监听 loading 状态变化
watch(() => travelStore.loading, (loading) => {
  if (loading && !isSkeletonPhase.value) {
    isSkeletonPhase.value = true
    skeletonStartTime = Date.now()
    skeletonStatusText.value = '正在生成行程骨架...'
    updateSkeletonPhase()
  }
})

const updateSkeletonPhase = () => {
  if (!isSkeletonPhase.value) return
  skeletonElapsed.value = Math.round((Date.now() - skeletonStartTime) / 1000)
  if (skeletonElapsed.value > 0) {
    skeletonStatusText.value = `正在生成行程骨架... ${skeletonElapsed.value}s`
  }
  // 每秒更新一次
  if (isSkeletonPhase.value) {
    setTimeout(updateSkeletonPhase, 1000)
  }
}

const travelStyles = [
  { name: '轻装上阵', icon: '🌤️', image: 'https://tonystark-ai.ccwu.cc/png/d852559c-ac19-43e1-ab02-78e1f529c25c.png' },
  { name: '深度打卡', icon: '📍', image: 'https://tonystark-ai.ccwu.cc/png/4d94c032-2cd5-4e00-8771-b1cd89cb0850.png' },
  { name: '美食之旅', icon: '🍜', image: 'https://tonystark-ai.ccwu.cc/png/1aaa9239-ca21-4e2d-a661-04ac864d9918.png' },
  { name: '户外探索', icon: '🏔️', image: 'https://tonystark-ai.ccwu.cc/png/f02f9327-4f1e-4a51-bfdd-5dd343151fb8.png' }
]

const charCount = computed(() => userInput.value.length)

const handleGenerate = async () => {
  userStore.restoreFromStorage()
  if (!userStore.hasToken) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 1500)
    return
  }
  if (!userInput.value.trim()) {
    uni.showToast({ title: '请输入旅行描述', icon: 'none' })
    return
  }

  try {
    // 不用 uni.showLoading，让骨架屏组件负责视觉反馈
    // 使用 V4 骨架优先方案（支持完整状态流转：pending → running → skeleton_ready → completed）
    const result = await travelStore.createPlanV4({
      userInput: userInput.value,
      modelType: 'auto',
      travelMode: travelStyles[travelModeIndex.value].name
    })
    isSkeletonPhase.value = false
    if (result && result.dayPlanItinerary && result.dayPlanItinerary.length > 0) {
      uni.showToast({ title: '行程已生成', icon: 'success' })
      uni.reLaunch({ url: '/pages/index/index' })
    }
  } catch (error) {
    isSkeletonPhase.value = false
    uni.showToast({ title: '生成失败，请稍后重试', icon: 'none' })
  }
}
</script>

<style scoped>
.explore-page {
  min-height: 100vh;
  background: var(--color-surface);
}
.content {
  padding: 16rpx 40rpx 240rpx;
}
.section { margin-bottom: 24px; }
.section-overline {
  display: block;
  font-size: 11px; font-weight: 700; color: var(--color-outline);
  text-transform: uppercase; letter-spacing: 0.15em;
  margin-bottom: 8px;
}

.style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.style-card {
  border-radius: 16px; overflow: hidden;
  position: relative; height: 180px;
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.5);
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: 12px;
  transition: all var(--transition-fast);
}
.style-card:active { transform: scale(0.95); }
.style-selected { border-color: var(--color-primary-container); }
.style-img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  z-index: 0;
}
.style-overlay {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to top, rgba(0,6,102,0.7) 0%, rgba(0,6,102,0.15) 50%, transparent 100%);
}
.style-label {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 6px;
}
.style-icon { font-size: 18px; }
.style-name {
  font-size: 12px; font-weight: 600; letter-spacing: 0.05em;
  color: #fff;
}

.input-header {
  display: flex; align-items: center; justify-content: space-between; padding: 0 4px;
}
.input-badge {
  display: flex; align-items: center; gap: 6px;
  color: var(--color-primary); opacity: 0.7;
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
}
.input-card {
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 24px; padding: 40rpx; margin-top: 8px;
  box-shadow: 0 12px 24px rgba(0,0,0,0.02);
}
.main-textarea {
  width: 100%; min-height: 90px;
  background: transparent; border: none; resize: none;
  margin: 0; padding: 0;
  font-size: 16px; line-height: 26px;
  color: var(--color-on-surface);
}
.main-textarea::placeholder { color: var(--color-on-surface-variant); opacity: 0.3; }
.input-footer {
  display: flex; justify-content: flex-end;
  padding-top: 8px; margin-top: 8px;
  border-top: 1px solid rgba(198,197,212,0.1);
}
.char-count { font-size: 11px; font-weight: 500; color: var(--color-outline); opacity: 0.6; }

.tag-chips {
  display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;
}
.tag-chip {
  padding: 8px 16px; border-radius: 999px;
  border: 1px solid var(--color-outline-variant); opacity: 0.3;
  font-size: 12px; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-on-surface-variant);
  background: rgba(243,244,245,0.5);
}



.action-section { margin-top: 16px; display: flex; flex-direction: column; align-items: center; }
.generate-btn {
  width: 100%; height: 64px;
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  border-radius: 24px; color: #fff;
  font-size: 20px; font-weight: 600; line-height: 28px;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  box-shadow: 0 12px 32px rgba(0,6,102,0.25);
  position: relative; overflow: hidden;
}
.generate-btn[disabled] { opacity: 0.5; }
.gen-icon { font-size: 24px; }
.agreement-hint {
  margin-top: 24px;
  font-size: 11px; font-weight: 500; color: var(--color-outline); opacity: 0.5;
  text-align: center;
}
</style>
