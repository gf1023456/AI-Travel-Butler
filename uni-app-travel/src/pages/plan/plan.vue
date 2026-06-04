<template>
  <view class="plan-page" :class="themeClass">
    <NavBar show-back title="行程详情" back-url="/pages/index/index" placeholder />

    <scroll-view scroll-y class="content">
      <section class="hero-card" v-if="travelStore.currentPlan">
        <image class="hero-img" src="https://tonystark-ai.ccwu.cc/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png" mode="aspectFill" />
        <view class="hero-overlay"></view>
        <view class="hero-content">
          <text class="hero-title">{{ itinerarySummary || '行程方案' }}</text>
          <text class="hero-date">{{ planDate }}</text>
          <view class="hero-badge">
            <text>商务休闲</text>
          </view>
          <!-- 骨架填充进度 - 使用 Skeleton 组件 -->
          <Skeleton v-if="isFilling" type="inline" icon="🔄" :status-text="fillProgressText" :progress="fillProgress" />
        </view>
      </section>

      <EmptyState v-if="!travelStore.currentPlan" icon="✨" title="快去生成你的专属方案吧" action-text="开始探索" @action="goExplore" />

      <!-- 骨架屏占位 - 等待数据填充 -->
      <section v-if="travelStore.currentPlan && isFilling && !days.length" class="timeline">
        <Skeleton type="timeline" :count="3" />
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
            <view v-for="(item, idx) in dayItems" :key="idx" class="timeline-item" :class="{ 'editing': isEditing }">
              <view class="timeline-dot">
                <view :class="['dot', idx === 0 ? 'dot-active' : '']"></view>
              </view>
              <view class="item-card" @longpress="onItemLongPress(item, dayKey, idx)">
                <view class="item-img-wrap" @click="previewImage(item.image || getPlaceholderImg(idx))">
                  <image class="item-img" :src="item.image || getPlaceholderImg(idx)" mode="aspectFill" />
                </view>
                <view class="item-info">
                  <view class="item-header">
                    <text class="item-name">{{ item.name || '景点' }}</text>
                    <text class="item-weather" v-if="item.weather_icon">{{ item.weather_icon }} {{ item.temperature }}</text>
                  </view>
                  <view class="item-time" v-if="!editingTimeItem || editingTimeItem !== item" @click="startEditTime(item)">
                    <text>🕐</text>
                    <text>{{ item.time || '全天' }}</text>
                  </view>
                  <view class="item-time-edit" v-if="editingTimeItem === item">
                    <picker mode="time" :value="item.time || '09:00'" @change="onTimeChange($event, item)">
                      <view class="time-picker-display">
                        <text>🕐</text>
                        <text class="time-editing-text">{{ item.time || '09:00' }}</text>
                        <text class="time-edit-hint">点击修改</text>
                      </view>
                    </picker>
                  </view>
                  <text class="item-desc" v-if="item.description">{{ item.description }}</text>
                  <text class="item-desc skeleton-text" v-else-if="isFilling">正在生成详情...</text>
                </view>
                <!-- 编辑模式下的操作按钮 -->
                <view class="item-edit-actions" v-if="isEditing">
                  <button class="edit-action-btn move-up" v-if="idx > 0" @click.stop="moveItem(dayKey, idx, -1)">
                    <text>↑</text>
                  </button>
                  <button class="edit-action-btn move-down" v-if="idx < dayItems.length - 1" @click.stop="moveItem(dayKey, idx, 1)">
                    <text>↓</text>
                  </button>
                  <button class="edit-action-btn delete-btn" @click.stop="deleteItem(dayKey, idx)">
                    <text>🗑</text>
                  </button>
                </view>
              </view>
            </view>
          </view>
        </view>
      </section>

      <!-- 免责声明 -->
      <view class="disclaimer" v-if="travelStore.currentPlan">
        <text>本行程仅供参考，出行前请核实相关信息</text>
      </view>
    </scroll-view>

    <!-- Bottom Action Bar -->
    <view class="action-bar" :style="{ bottom: safeAreaBottom + 'px' }" v-if="travelStore.currentPlan">
      <button class="action-btn action-outline" @click="toggleEdit">
        <text>{{ isEditing ? '✅' : '✏️' }}</text>
        <text>{{ isEditing ? '完成编辑' : '编辑行程' }}</text>
      </button>
      <button class="action-btn action-outline" @click="generateBackendLongPoster">
        <text>📤</text>
        <text>分享行程</text>
      </button>
      <button class="action-btn action-primary" @click="saveToHistory" v-if="!travelStore.currentPlan.isFromHistory">
        <text>💾</text>
        <text>保存行程</text>
      </button>
    </view>

    <!-- Floating AI Bubble -->
    <button class="ai-bubble" @click="goRefine" :style="{ bottom: (112 + safeAreaBottom) + 'px' }" v-if="travelStore.currentPlan">
      <text>💡</text>
    </button>

    <!-- 景点操作菜单 -->
    <view v-if="showItemMenu" class="sheet-overlay" @click="showItemMenu = false">
      <view class="item-menu" @click.stop>
        <view class="menu-header">
          <text class="menu-title">{{ selectedItem?.name || '景点操作' }}</text>
        </view>
        <button class="menu-option" @click="editItemTime">
          <text>🕐</text><text>修改时间</text>
        </button>
        <button class="menu-option" @click="refineSingleItem">
          <text>✨</text><text>AI 优化此景点</text>
        </button>
        <button class="menu-option danger" @click="confirmDeleteItem">
          <text>🗑️</text><text>删除此景点</text>
        </button>
      </view>
    </view>

    <!-- 隐藏 Canvas 用于生成分享图片 -->
    <canvas canvas-id="shareCanvas" id="shareCanvas" style="position: fixed; left: -9999px; top: -9999px; width: 750px; height: 1200px;"></canvas>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance, nextTick, watch } from 'vue'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { saveHistory } from '@/api/history.js'
import { generatePoster as generateBackendPoster, downloadPoster } from '@/api/poster.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'
import PosterGenerator from '@/utils/poster.js'
import NavBar from '@/components/NavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight, safeAreaBottom } = useSafeArea()
const instance = getCurrentInstance()
const posterGen = new PosterGenerator({ canvasId: 'shareCanvas', instance })

const dayPlanItinerary = ref([])
const itinerarySummary = ref('')
const officialImagePath = ref('')

// 填充进度相关状态
const isFilling = ref(false)
const fillProgress = ref(0)
const fillProgressText = ref('正在加载...')

// 行程编辑相关状态
const isEditing = ref(false)
const editingTimeItem = ref(null)
const showItemMenu = ref(false)
const selectedItem = ref(null)
const selectedDayKey = ref('')
const selectedIdx = ref(-1)

// 监听 currentPlan 变化，骨架填充完成后自动更新页面
watch(() => travelStore.currentPlan, (newPlan) => {
  if (newPlan) {
    const plan = newPlan
    dayPlanItinerary.value = Array.isArray(plan.dayPlanItinerary) ? plan.dayPlanItinerary : []
    itinerarySummary.value = plan.itinerarySummary || '排期已生成'
    
    // 检查是否已完成填充（description 有内容）
    const hasContent = dayPlanItinerary.value.some(item => item.description && item.description.length > 0)
    if (hasContent) {
      isFilling.value = false
      nextTick(() => preGenerateOfficialImage())
    } else {
      // 骨架阶段或填充中
      isFilling.value = true
      updateFillProgress()
    }
  }
}, { deep: true })

// 计算填充进度
const updateFillProgress = () => {
  const items = dayPlanItinerary.value
  if (!items || items.length === 0) {
    fillProgress.value = 0
    fillProgressText.value = '正在加载...'
    return
  }
  
  const total = items.length
  const filled = items.filter(item => item.description && item.description.length > 10).length
  fillProgress.value = Math.round((filled / total) * 100)
  fillProgressText.value = `正在填充详细信息 ${filled}/${total}`
  
  // 每500ms更新一次
  if (isFilling.value && fillProgress.value < 100) {
    setTimeout(updateFillProgress, 500)
  }
  if (fillProgress.value >= 100) {
    isFilling.value = false
  }
}

onMounted(() => {
  userStore.restoreFromStorage()
  loadPlanData()
})

const loadPlanData = () => {
  if (travelStore.currentPlan) {
    const plan = travelStore.currentPlan
    dayPlanItinerary.value = Array.isArray(plan.dayPlanItinerary) ? plan.dayPlanItinerary : []
    itinerarySummary.value = plan.itinerarySummary || '排期已生成'
    nextTick(() => preGenerateOfficialImage())
  }
}

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

const goExplore = () => uni.navigateTo({ url: '/pages/explore/index' })
const goRefine = () => uni.navigateTo({ url: '/pages/refine/refine' })

// ============ 行程编辑功能 ============

// 切换编辑模式
const toggleEdit = () => {
  isEditing.value = !isEditing.value
  if (!isEditing.value) {
    // 退出编辑模式时保存到 store
    syncToStore()
  }
}

// 长按景点弹出操作菜单
const onItemLongPress = (item, dayKey, idx) => {
  if (isEditing.value) return // 编辑模式下不弹菜单
  selectedItem.value = item
  selectedDayKey.value = dayKey
  selectedIdx.value = idx
  showItemMenu.value = true
}

// 移动景点（上/下）
const moveItem = (dayKey, idx, direction) => {
  const items = daysByDay.value[dayKey]
  const newIdx = idx + direction
  if (newIdx < 0 || newIdx >= items.length) return

  // 交换在 dayPlanItinerary 中的位置
  const day = parseInt(dayKey)
  const dayItems = dayPlanItinerary.value.filter(i => i.day === day)
  const otherItems = dayPlanItinerary.value.filter(i => i.day !== day)
  
  // 交换
  const temp = dayItems[idx]
  dayItems[idx] = dayItems[newIdx]
  dayItems[newIdx] = temp
  
  // 更新 sequence
  dayItems.forEach((item, i) => { item.sequence = i + 1 })
  
  dayPlanItinerary.value = [...otherItems, ...dayItems].sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence))
}

// 删除景点
const deleteItem = (dayKey, idx) => {
  const day = parseInt(dayKey)
  const target = daysByDay.value[dayKey][idx]
  dayPlanItinerary.value = dayPlanItinerary.value.filter(item => item !== target)
  // 重新编号 sequence
  let seq = 1
  dayPlanItinerary.value.filter(i => i.day === day).forEach(item => { item.sequence = seq++ })
  syncToStore()
}

// 菜单中的删除确认
const confirmDeleteItem = () => {
  showItemMenu.value = false
  if (!selectedItem.value) return
  const day = parseInt(selectedDayKey.value)
  dayPlanItinerary.value = dayPlanItinerary.value.filter(item => item !== selectedItem.value)
  let seq = 1
  dayPlanItinerary.value.filter(i => i.day === day).forEach(item => { item.sequence = seq++ })
  syncToStore()
  uni.showToast({ title: '已删除', icon: 'success' })
}

// 修改时间
const startEditTime = (item) => {
  editingTimeItem.value = item
}

const onTimeChange = (e, item) => {
  item.time = e.detail.value
  editingTimeItem.value = null
  syncToStore()
  uni.showToast({ title: '时间已更新', icon: 'success' })
}

const editItemTime = () => {
  showItemMenu.value = false
  if (selectedItem.value) {
    editingTimeItem.value = selectedItem.value
  }
}

// 单景点AI优化
const refineSingleItem = () => {
  showItemMenu.value = false
  if (!selectedItem.value) return
  uni.navigateTo({
    url: `/pages/refine/refine?focus=${encodeURIComponent(selectedItem.value.name || '')}`
  })
}

// 同步修改到 store
const syncToStore = () => {
  if (travelStore.currentPlan) {
    travelStore.currentPlan.dayPlanItinerary = [...dayPlanItinerary.value]
  }
}

// ============ 以下为原有功能 ============

const previewImage = (current) => {
  const urls = []
  Object.values(daysByDay.value).forEach(dayItems => {
    dayItems.forEach((item, idx) => {
      const url = item.image || getPlaceholderImg(idx)
      if (url) urls.push(url)
    })
  })
  if (urls.length === 0) return
  uni.previewImage({ current, urls })
}

const wrapText = (ctx, text, x, y, maxWidth, lineHeight, maxLines) => {
  let line = ''
  let currentLine = 0
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, y)
      line = text[i]
      y += lineHeight
      currentLine++
      if (currentLine >= maxLines) return
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, y)
}

const generateTags = () => {
  const tags = ['慧游', '旅行']
  if (days.value.length <= 3) tags.push('短途旅行')
  else if (days.value.length <= 7) tags.push('中途旅行')
  else tags.push('长途旅行')
  const dayPlan = dayPlanItinerary.value
  if (dayPlan.some(item => item.name?.includes('美食') || item.name?.includes('餐厅'))) tags.push('美食之旅')
  if (dayPlan.some(item => item.name?.includes('博物馆') || item.name?.includes('文化'))) tags.push('文化之旅')
  return tags.slice(0, 5)
}

const preGenerateOfficialImage = () => {
  if (!dayPlanItinerary.value.length) return
  generateShareImageForOfficial((tempFilePath) => {
    if (tempFilePath) {
      officialImagePath.value = tempFilePath
      console.log('[Plan] 贴图图片预生成成功')
    }
  })
}

const generateShareImageForOfficial = (callback) => {
  const ctx = uni.createCanvasContext('shareCanvas', instance)
  const canvasWidth = 750
  const padding = 40
  let currentY = 60
  ctx.setFillStyle('#FFFFFF')
  ctx.fillRect(0, 0, canvasWidth, 1600)
  ctx.setFillStyle('#000666')
  ctx.fillRect(0, 0, canvasWidth, 180)
  ctx.setFillStyle('#FFFFFF')
  ctx.setFontSize(52)
  ctx.fillText('慧游行程', padding, 90)
  ctx.setFontSize(28)
  ctx.fillText(`📅 ${new Date().toLocaleDateString()}`, padding, 145)
  currentY = 220
  const daysMap = {}
  dayPlanItinerary.value.forEach(item => {
    const key = String(item.day || 1)
    if (!daysMap[key]) daysMap[key] = []
    daysMap[key].push(item)
  })
  Object.keys(daysMap).sort().forEach(day => {
    ctx.setFontSize(36)
    ctx.setFillStyle('#000666')
    ctx.fillText(`【Day ${day}】`, padding, currentY)
    currentY += 60
    daysMap[day].forEach(item => {
      ctx.setFontSize(28)
      ctx.setFillStyle('#1A1A1A')
      ctx.fillText(`📍 ${item.name || '景点'}`, padding, currentY)
      currentY += 45
      if (item.time) {
        ctx.setFontSize(24)
        ctx.setFillStyle('#666666')
        ctx.fillText(`🕐 ${item.time}`, padding + 20, currentY)
        currentY += 35
      }
      if (item.description) {
        ctx.setFontSize(22)
        ctx.setFillStyle('#888888')
        wrapText(ctx, item.description, padding + 20, currentY, canvasWidth - padding * 2 - 20, 35, 3)
        currentY += 80
      }
    })
    currentY += 40
  })
  ctx.setFontSize(24)
  ctx.setFillStyle('#AAAAAA')
  ctx.textAlign = 'center'
  ctx.fillText('慧游 AI 旅行助手 · 智能规划您的旅程', canvasWidth / 2, currentY + 80)
  ctx.textAlign = 'left'
  ctx.draw(false, () => {
    setTimeout(() => {
      uni.canvasToTempFilePath({
        canvasId: 'shareCanvas',
        success: (res) => callback(res.tempFilePath),
        fail: () => callback(null)
      }, instance)
    }, 500)
  })
}

const generatePoster = () => {
  if (!dayPlanItinerary.value.length) {
    uni.showToast({ title: '无行程可分享', icon: 'none' })
    return
  }
  
  // 直接调用后端生成海报
  generateBackendLongPoster()
}

const generateFrontendPoster = () => {

  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '生成海报中...' })

  posterGen.generate({
    itinerarySummary: itinerarySummary.value,
    days: days.value,
    dayPlanItinerary: dayPlanItinerary.value
  }).then((tempFilePath) => {
    wx.showShareImageMenu({
      path: tempFilePath,
      needShowEntrance: true,
      entrancePath: 'pages/index/index',
      success: () => uni.showToast({ title: '分享成功', icon: 'success' }),
      fail: (err) => {
        console.error('分享失败:', err)
        uni.showToast({ title: '分享失败', icon: 'none' })
      },
      complete: () => uni.hideLoading()
    })
  }).catch((err) => {
    console.error('生成图片失败:', err)
    uni.hideLoading()
    uni.showToast({ title: '生成图片失败', icon: 'error' })
  })
  // #endif

  // #ifndef MP-WEIXIN
  uni.showToast({ title: '仅微信小程序支持图片分享', icon: 'none' })
  // #endif
}

const shareToOfficial = () => {
  if (!dayPlanItinerary.value.length) { uni.showToast({ title: '无行程可发表', icon: 'none' }); return }
  // #ifdef MP-WEIXIN
  // 开发工具模拟器不支持此 API，提示用户在真机上测试
  if (wx.getSystemInfoSync().platform === 'devtools') {
    uni.showModal({
      title: '提示',
      content: '贴图功能仅在真机微信中可用，是否改为图片分享？',
      confirmText: '图片分享',
      cancelText: '取消',
      success: (modal) => { if (modal.confirm) sharePlanImage() }
    })
    return
  }

  const title = `🌍 ${itinerarySummary.value || '慧游智能行程'}`.substring(0, 50)
  const content = generateText()
  const tags = generateTags()

  if (officialImagePath.value) {
    // 已有预生成图片，直接同步调用 API（必须在用户点击栈中）
    wx.shareToOfficialAccount({
      title,
      content,
      tags,
      images: [officialImagePath.value],
      path: '/pages/index/index',
      success: (res) => {
        console.log('贴图发表成功:', res)
        if (res.postUrl) {
          uni.showModal({
            title: '发表成功', content: '您的行程贴图已发布！', showCancel: false,
            success: () => { uni.setClipboardData({ data: res.postUrl, success: () => uni.showToast({ title: '文章链接已复制', icon: 'success' }) }) }
          })
        }
      },
      fail: (err) => {
        console.error('贴图发表失败:', err)
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          uni.showToast({ title: '发表失败: ' + (err.errMsg || ''), icon: 'none', duration: 3000 })
        }
      }
    })
  } else {
    // 图片未准备好，异步生成后提示用户再次点击
    uni.showLoading({ title: '首次准备图片...' })
    generateShareImageForOfficial((tempFilePath) => {
      uni.hideLoading()
      if (tempFilePath) {
        officialImagePath.value = tempFilePath
        uni.showToast({ title: '图片已准备好，请再次点击发表', icon: 'none', duration: 2500 })
      } else {
        uni.showToast({ title: '图片生成失败', icon: 'error' })
      }
    })
  }
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '仅微信小程序支持', icon: 'none' })
  // #endif
}

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
    title: '导出行程', content: '已将行程复制到剪贴板，可粘贴到文档中使用',
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

const generateBackendLongPoster = async () => {
  if (!dayPlanItinerary.value.length) {
    uni.showToast({ title: '无行程可生成', icon: 'none' })
    return
  }
  
  try {
    uni.showLoading({ title: '生成海报中...' })
    
    const posterData = {
      itinerarySummary: itinerarySummary.value,
      days: days.value,
      dayPlanItinerary: dayPlanItinerary.value
    }
    
    const result = await generateBackendPoster(posterData)
    
    if (result.code === 0 && result.data?.image) {
      // 将base64图片保存到本地
      const tempFilePath = await downloadPoster(result.data.image)
      
      // 调用微信分享图片菜单
      // #ifdef MP-WEIXIN
      wx.showShareImageMenu({
        path: tempFilePath,
        needShowEntrance: true,
        entrancePath: 'pages/index/index',
        success: () => {
          uni.showToast({ title: '分享成功', icon: 'success' })
        },
        fail: (err) => {
          console.error('分享失败:', err)
          // 如果分享失败，至少让用户可以预览保存
          uni.previewImage({
            urls: [tempFilePath],
            success: () => {
              uni.showToast({ title: '海报已生成，请长按保存', icon: 'none', duration: 2000 })
            }
          })
        }
      })
      // #endif
      
      // #ifndef MP-WEIXIN
      uni.previewImage({
        urls: [result.data.image],
        success: () => {
          uni.showToast({ title: '海报生成成功', icon: 'success' })
        }
      })
      // #endif
    } else {
      uni.showToast({ title: '海报生成失败', icon: 'error' })
    }
  } catch (error) {
    console.error('后端海报生成错误:', error)
    uni.showToast({ title: '生成失败: ' + (error.message || '未知错误'), icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}
</script>

<style scoped>
.plan-page { min-height: 100vh; background: var(--color-surface); }

.content { padding: 24rpx 40rpx 280rpx; }

.disclaimer {
  text-align: center;
  padding: 48rpx 40rpx 16rpx;
  font-size: 12px;
  color: #999;
}

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
  position: absolute; bottom: 0; left: 0; right: 0; padding: 48rpx;
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
.day-items { padding: 0; }

.timeline-item { display: flex; gap: 12px; margin-bottom: 24px; position: relative; }
.timeline-item.editing .item-card { border-color: var(--color-primary); border-style: dashed; }
.timeline-dot { display: flex; flex-direction: column; align-items: center; padding-top: 8px; width: 20px; flex-shrink: 0; }
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
  transition: border-color 0.2s ease;
}
.item-img-wrap { width: 96px; height: 96px; border-radius: 12px; overflow: hidden; flex-shrink: 0; }
.item-img { width: 100%; height: 100%; }
.item-info { flex: 1; min-width: 0; }
.item-header { display: flex; justify-content: space-between; align-items: flex-start; }
.item-name { font-size: 16px; font-weight: 700; color: var(--color-primary); }
.item-weather { font-size: 12px; font-weight: 500; color: var(--color-secondary); }
.item-time { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-on-surface-variant); margin-top: 4px; }
.item-desc { font-size: 13px; color: var(--color-on-surface-variant); margin-top: 8px; line-height: 1.5; }
.item-desc.skeleton-text { opacity: 0.4; font-style: italic; }

/* 时间编辑 */
.item-time-edit { margin-top: 4px; }
.time-picker-display {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 8px;
  background: var(--color-primary-fixed); font-size: 12px;
}
.time-editing-text { color: var(--color-primary); font-weight: 600; }
.time-edit-hint { font-size: 10px; color: var(--color-outline); margin-left: 4px; }

/* 编辑模式操作按钮 */
.item-edit-actions {
  display: flex; flex-direction: column; gap: 6px;
  margin-left: 8px; flex-shrink: 0; justify-content: center;
}
.edit-action-btn {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-variant);
  transition: all 0.15s ease;
}
.edit-action-btn:active { transform: scale(0.9); }
.edit-action-btn.delete-btn { color: var(--color-error); }

/* 景点操作菜单 */
.sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(6px);
  display: flex; align-items: flex-end;
}
.item-menu {
  width: 100%; padding: 32rpx 48rpx 64rpx;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.1);
}
.menu-header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--color-outline-variant); }
.menu-title { font-size: 18px; font-weight: 700; color: var(--color-primary); }
.menu-option {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 8px; font-size: 16px; font-weight: 500;
  color: var(--color-on-surface); border-radius: 12px;
}
.menu-option:active { background: var(--color-surface-container); }
.menu-option.danger { color: var(--color-error); }

.action-bar {
  position: fixed; left: 0; right: 0; z-index: 10;
  display: flex; gap: 12px; padding: 40rpx;
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
  position: fixed; right: 48rpx; z-index: 10;
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #000666 0%, #343d96 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; color: #fff;
  box-shadow: 0 8px 24px rgba(0,6,102,0.3);
}
</style>
