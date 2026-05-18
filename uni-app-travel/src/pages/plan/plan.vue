<template>
  <view class="plan-page">
    <header class="top-bar">
      <view class="top-left">
        <button class="back-btn" @click="goBack">
          <text>←</text>
        </button>
        <text class="top-title">行程详情</text>
      </view>
      <button class="top-avatar-btn">
        <image class="top-avatar" :src="userAvatar" mode="aspectFill" />
      </button>
    </header>

    <scroll-view scroll-y class="content">
      <section class="hero-card" v-if="travelStore.currentPlan">
        <image class="hero-img" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA02IZ_Cr-4sufxcvHZE8BU-38VV750iCYCWUNAwyxlCSLM0AjHjpLAhgQRLRXHRHbXoirHSD1z_1rNdMbasVr_jytZZbzzrdl2hnY71--UeKVV3Hdz4bystRXxSG5qzhpJ3APxP4J6AxfOIImSrnJqnP5Ln1SB6Tr-1uIFhp3Nl1SiR56udEqhJYI7BtB92gIKbmACxLNZB7As774DxNGWsoJOszF7XWoB-hu0sTorTf2jEN5xipAxGw32wLlBCLeC-ZIwBXLUhDs" mode="aspectFill" />
        <view class="hero-overlay"></view>
        <view class="hero-content">
          <text class="hero-title">{{ itinerarySummary || '行程方案' }}</text>
          <text class="hero-date">{{ planDate }}</text>
          <view class="hero-badge">
            <text>商务休闲</text>
          </view>
        </view>
      </section>

      <section class="empty-state" v-if="!travelStore.currentPlan">
        <text class="empty-icon">🗺️</text>
        <text class="empty-title">暂无行程</text>
        <text>您还没有生成任何行程方案</text>
      </section>

      <section class="timeline" v-if="travelStore.currentPlan && days.length">
        <view v-for="(dayItems, dayKey) in daysByDay" :key="dayKey" class="day-group">
          <view class="day-header">
            <view :class="['day-badge', dayKey === '1' ? 'day-active' : '']">
              <text>D{{ dayKey }}</text>
            </view>
            <text class="day-title">{{ getDayTitle(dayKey) }}</text>
          </view>
          <view class="day-items">
            <view v-for="(item, idx) in dayItems" :key="idx" class="timeline-item">
              <view class="timeline-dot">
                <view :class="['dot', idx === 0 ? 'dot-active' : '']"></view>
              </view>
              <view class="item-card">
                <view class="item-img-wrap">
                  <image class="item-img" :src="item.image || getPlaceholderImg(idx)" mode="aspectFill" />
                </view>
                <view class="item-info">
                  <view class="item-header">
                    <text class="item-name">{{ item.name || '景点' }}</text>
                    <text class="item-weather" v-if="item.weather_icon">{{ item.weather_icon }} {{ item.temperature }}</text>
                  </view>
                  <view class="item-time">
                    <text>🕐</text>
                    <text>{{ item.time || '全天' }}</text>
                  </view>
                  <text class="item-desc">{{ item.description }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </section>
    </scroll-view>

    <!-- Bottom Action Bar -->
    <view class="action-bar">
      <button class="action-btn action-outline" @click="copyToClipboard">
        <text>📋</text>
        <text>复制</text>
      </button>
      <button class="action-btn action-outline" @click="exportToFile">
        <text>📤</text>
        <text>导出</text>
      </button>
      <button class="action-btn action-primary" @click="saveToHistory">
        <text>💾</text>
        <text>保存行程</text>
      </button>
    </view>

    <!-- Floating AI Bubble -->
    <button class="ai-bubble" @click="goRefine">
      <text>🤖</text>
    </button>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { saveHistory } from '@/api/history.js'

const travelStore = useTravelStore()
const userStore = useUserStore()
const userAvatar = computed(() => userStore.avatarUrl || 'https://ui-avatars.com/api/?name=慧游&background=1a237e&color=fff&size=64')

const dayPlanItinerary = ref([])
const itinerarySummary = ref('')

onMounted(() => {
  userStore.restoreFromStorage()
  if (travelStore.currentPlan) {
    const plan = travelStore.currentPlan
    dayPlanItinerary.value = Array.isArray(plan.dayPlanItinerary) ? plan.dayPlanItinerary : []
    itinerarySummary.value = plan.itinerarySummary || '排期已生成'
  }
})

const sortedItinerary = computed(() =>
  [...dayPlanItinerary.value].sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence))
)

const days = computed(() => {
  const set = new Set()
  sortedItinerary.value.forEach(i => set.add(i.day))
  return [...set].sort()
})

const daysByDay = computed(() => {
  const map = {}
  sortedItinerary.value.forEach(item => {
    const key = String(item.day || 1)
    if (!map[key]) map[key] = []
    map[key].push(item)
  })
  return map
})

const getStartDate = () => {
  const plan = travelStore.currentPlan
  if (!plan) return new Date()
  if (plan.startDate) return new Date(plan.startDate)
  return new Date()
}

const planDate = computed(() => {
  if (!travelStore.currentPlan) return ''
  const start = getStartDate()
  const numDays = days.value.length || 1
  const end = new Date(start)
  end.setDate(end.getDate() + numDays - 1)
  const f = (d) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  return `${f(start)} - ${f(end)} (${numDays}天)`
})

const getDayTitle = (day) => {
  const start = getStartDate()
  const d = new Date(start)
  d.setDate(d.getDate() + parseInt(day) - 1)
  const theme = (daysByDay.value[day]?.[0]?.dayTheme) || ''
  const m = d.getMonth() + 1
  const dd = d.getDate()
  return theme ? `${m}月${dd}日 · ${theme}` : `${m}月${dd}日 · Day ${day}`
}

const getPlaceholderImg = (idx) => {
  const imgs = [
    'https://tonystark-ai.ccwu.cc/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png',
    'https://tonystark-ai.ccwu.cc/png/62d9b74c-a24c-4474-b119-59f01af3902b.png',
    'https://tonystark-ai.ccwu.cc/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png'
  ]
  return imgs[idx % imgs.length]
}

const goBack = () => uni.redirectTo({ url: '/pages/index/index' })
const goRefine = () => uni.navigateTo({ url: '/pages/refine/refine' })

const saveToHistory = async () => {
  if (!dayPlanItinerary.value.length) {
    uni.showToast({ title: '无行程可保存', icon: 'none' }); return
  }
  try {
    uni.showLoading({ title: '保存中...' })
    const result = await saveHistory({
      userInput: travelStore.currentPlan?.userInput || '行程方案',
      modelType: 'auto', provider: 'unknown',
      itinerarySummary: itinerarySummary.value,
      dayPlan: dayPlanItinerary.value,
      socialRecommendations: [],
      evidence: [], warnings: []
    })
    uni.hideLoading()
    if (result?.id) {
      uni.showToast({ title: '保存成功', icon: 'success' })
    } else {
      saveToLocalStorage()
    }
  } catch (error) {
    uni.hideLoading()
    saveToLocalStorage()
  }
}

const saveToLocalStorage = () => {
  try {
    const history = JSON.parse(uni.getStorageSync('travel_history') || '[]')
    history.unshift({
      id: Date.now(), timestamp: new Date().toLocaleString(),
      summary: itinerarySummary.value, itinerary: dayPlanItinerary.value
    })
    if (history.length > 30) history.pop()
    uni.setStorageSync('travel_history', JSON.stringify(history))
    uni.showToast({ title: '已保存到本地', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '保存失败', icon: 'error' })
  }
}

const copyToClipboard = () => {
  if (!dayPlanItinerary.value.length) { uni.showToast({ title: '无内容', icon: 'none' }); return }
  uni.setClipboardData({
    data: generateText(),
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
    fail: () => uni.showToast({ title: '复制失败', icon: 'error' })
  })
}

const exportToFile = () => {
  uni.showModal({
    title: '导出行程', content: '已将行程复制到剪贴板',
    showCancel: false, success: () => copyToClipboard()
  })
}

const generateText = () => {
  let text = `🌍 慧游 行程指南\n📅 ${new Date().toLocaleString()}\n\n`
  if (itinerarySummary.value) text += `📝 ${itinerarySummary.value}\n\n`
  const days = {}
  dayPlanItinerary.value.forEach(item => {
    if (!days[item.day]) days[item.day] = []
    days[item.day].push(item)
  })
  Object.keys(days).sort().forEach(day => {
    text += `【Day ${day}】\n`
    days[day].forEach(item => {
      text += `📍 ${item.sequence || ''}. ${item.name || ''} ${item.time || ''}\n`
      if (item.description) text += `   ${item.description}\n`
    })
    text += '\n'
  })
  return text
}
</script>

<style scoped>
.plan-page { min-height: 100vh; background: var(--color-surface); }

.top-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(12px + var(--status-bar-height)) 20px 12px;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.top-left { display: flex; align-items: center; gap: 12px; }
.back-btn {
  width: 36px; height: 36px; display: flex; align-items: center;
  justify-content: center; font-size: 20px; color: var(--color-primary);
}
.top-title { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; line-height: 32px; }
.top-avatar { width: 32px; height: 32px; border-radius: 50%; }

.content { padding: calc(80px + var(--status-bar-height)) 20px 140px; }

.hero-card {
  position: relative; overflow: hidden; border-radius: 16px;
  height: 200px; margin-bottom: 48px;
  box-shadow: 0 12px 32px rgba(0,6,102,0.08);
}
.hero-img { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%);
}
.hero-content {
  position: absolute; bottom: 0; left: 0; right: 0; padding: 24px;
  display: flex; flex-direction: column; gap: 8px;
}
.hero-title { font-size: 24px; font-weight: 700; color: #fff; letter-spacing: -0.01em; line-height: 32px; }
.hero-date { font-size: 14px; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 8px; }
.hero-badge { align-self: flex-start; }
.hero-badge text {
  font-size: 12px; font-weight: 500; letter-spacing: 0.05em;
  color: #fff; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
  padding: 6px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.3);
}

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 80px 20px; gap: 16px; }
.empty-icon { font-size: 64px; opacity: 0.5; }
.empty-title { font-size: 20px; font-weight: 700; color: var(--color-on-surface); }

.timeline { padding-bottom: 32px; }
.day-group { margin-bottom: 48px; }
.day-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.day-badge {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--color-secondary-container);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0,6,102,0.15);
}
.day-active {
  background: linear-gradient(135deg, #000666 0%, #343d96 100%);
  color: #fff;
}
.day-title { font-size: 20px; font-weight: 600; color: var(--color-primary); letter-spacing: -0.01em; }
.day-items { padding-left: 20px; }

.timeline-item { display: flex; gap: 16px; margin-bottom: 24px; position: relative; }
.timeline-dot { display: flex; flex-direction: column; align-items: center; padding-top: 8px; width: 24px; flex-shrink: 0; }
.dot {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--color-outline-variant);
  border: 4px solid var(--color-surface);
  box-shadow: 0 0 0 2px var(--color-outline-variant);
}
.dot-active { background: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary); }

.item-card {
  flex: 1; display: flex; gap: 16px;
  background: rgba(255,255,255,0.75); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 16px; padding: 16px;
  box-shadow: 0 8px 24px rgba(0,6,102,0.04);
}
.item-img-wrap { width: 96px; height: 96px; border-radius: 12px; overflow: hidden; flex-shrink: 0; }
.item-img { width: 100%; height: 100%; }
.item-info { flex: 1; }
.item-header { display: flex; justify-content: space-between; align-items: flex-start; }
.item-name { font-size: 16px; font-weight: 700; color: var(--color-primary); }
.item-weather { font-size: 12px; font-weight: 500; color: var(--color-secondary); }
.item-time { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-on-surface-variant); margin-top: 4px; }
.item-desc { font-size: 13px; color: var(--color-on-surface-variant); margin-top: 8px; line-height: 1.5; }

.action-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
  display: flex; gap: 12px; padding: 20px;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(0,6,102,0.08);
}
.action-btn {
  flex: 1; height: 48px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 14px; font-weight: 600;
}
.action-outline {
  border: 1px solid var(--color-outline-variant); color: var(--color-primary);
}
.action-primary {
  flex: 1.5;
  background: linear-gradient(135deg, #000666 0%, #343d96 100%);
  color: #fff; box-shadow: 0 8px 20px rgba(0,6,102,0.25);
}

.ai-bubble {
  position: fixed; bottom: 112px; right: 24px; z-index: 10;
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #000666 0%, #343d96 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; color: #fff;
  box-shadow: 0 8px 24px rgba(0,6,102,0.3);
}
</style>
