<template>
  <view class="page">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 顶部导航（透明，覆盖在 hero 上） -->
    <header class="top-bar">
      <button class="back-btn" @click="goBack"><text>←</text></button>
      <text class="top-title">行程一下</text>
      <view class="top-spacer"></view>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false">

      <!-- ===== Hero 全宽封面 ===== -->
      <view class="hero">
        <image class="hero-img" :src="heroImage" mode="aspectFill" v-if="heroImage" />
        <view class="hero-placeholder" v-else>
          <text class="hero-placeholder-text">{{ destination }}</text>
        </view>
        <view class="hero-overlay"></view>
        <view class="hero-badges">
          <view class="hero-badge" v-if="daysCount">
            <text>{{ daysCount }}天{{ nightsCount }}晚</text>
          </view>
          <view class="hero-badge" v-if="totalBudget">
            <text>¥{{ totalBudget }} 预算</text>
          </view>
        </view>
        <view class="hero-bottom">
          <text class="hero-title">{{ destination }}：{{ heroSubtitle }}</text>
        </view>
      </view>

      <!-- ===== 旅行信 ===== -->
      <view class="letter-card">
        <view class="letter-header">
          <text class="letter-icon">✉</text>
          <text class="letter-label">给你的旅行信</text>
        </view>
        <view class="letter-body">
          <text class="letter-salutation">亲爱的旅人，</text>
          <text class="letter-text">{{ travelLetter }}</text>
          <text class="letter-sign">—— 行程一下</text>
        </view>
      </view>

      <!-- ===== 小红书来源 ===== -->
      <view class="note-source" v-if="plan?.noteAuthor">
        <text class="note-source-label">📖 来自小红书</text>
        <view class="note-source-info">
          <text class="note-author">@{{ plan.noteAuthor }}</text>
          <text class="note-likes" v-if="plan.noteLikes">❤ {{ plan.noteLikes }}</text>
        </view>
      </view>

      <!-- ===== 信息胶囊 ===== -->
      <view class="info-chips">
        <view class="chip" v-if="physicalLevel">
          <text class="chip-icon">💪</text>
          <text class="chip-text">{{ physicalLevel }}</text>
        </view>
        <view class="chip" v-if="paceLabel">
          <text class="chip-icon">🍃</text>
          <text class="chip-text">{{ paceLabel }}</text>
        </view>
        <view class="chip" v-if="weatherSummary">
          <text class="chip-icon">{{ weatherSummary.icon }}</text>
          <text class="chip-text">{{ weatherSummary.tempRange }} {{ weatherSummary.advice }}</text>
        </view>
        <view class="chip" v-else-if="bestSeason">
          <text class="chip-icon">🌸</text>
          <text class="chip-text">{{ bestSeason }}</text>
        </view>
      </view>

      <!-- ===== 每日行程 ===== -->
      <view v-for="(day, di) in days" :key="di" class="day-section">
        <!-- Day Header -->
        <view class="day-header">
          <view class="day-label">
            <text class="day-label-sub">DAY</text>
            <text class="day-label-num">{{ day.day }}</text>
          </view>
          <view class="day-info">
            <text class="day-theme">{{ getDayTheme(day) }}</text>
            <text class="day-destinations" v-if="getDayDestinations(day)">{{ getDayDestinations(day) }}</text>
          </view>
        </view>

        <!-- 景点列表 -->
        <view v-for="(loc, li) in day.pois" :key="li" class="spot-entry" :style="{ animationDelay: (di * 0.15 + li * 0.1) + 's' }">
          <!-- 景点照片 -->
          <view class="spot-photo" v-if="loc.image">
            <image class="spot-img" :src="loc.image" mode="aspectFill" />
          </view>

          <!-- 景点信息 -->
          <view class="spot-info">
            <view class="spot-name-row">
              <text class="spot-name">{{ loc.name }}</text>
              <text class="spot-time" v-if="loc.time">{{ formatTime(loc.time) }}</text>
            </view>

            <!-- 推荐理由（金色高亮） -->
            <view class="spot-reason" v-if="loc.reason">
              <text class="reason-star">★</text>
              <text class="reason-label">推荐理由：</text>
              <text class="reason-text">{{ loc.reason }}</text>
            </view>

            <!-- 描述 -->
            <text class="spot-desc" v-if="loc.description">{{ loc.description }}</text>

            <!-- 小提醒 -->
            <view class="spot-tips" v-if="loc.tips" style="margin-top: 8rpx;">
              <view class="tip-icon">💡</view>
              <view class="tip-content">
                <text class="tip-main">{{ loc.tips }}</text>
              </view>
            </view>

            <!-- 摄影建议 / 实用信息 -->
            <view class="spot-tips" v-if="loc.visit_duration || loc.estimated_cost || loc.weather_icon">
              <view class="tip-icon">📷</view>
              <view class="tip-content">
                <text class="tip-main" v-if="loc.visit_duration">建议停留 {{ loc.visit_duration }}</text>
                <text class="tip-main" v-if="loc.estimated_cost">人均约 ¥{{ loc.estimated_cost }}</text>
                <text class="tip-main" v-if="loc.weather_icon">{{ loc.weather_icon }} {{ loc.weather_condition }} {{ loc.temperature }}</text>
              </view>
            </view>
          </view>

          <!-- 过渡叙事 -->
          <view class="spot-transition" v-if="li < day.pois.length - 1 && loc.transit_hint">
            <text class="transition-text">{{ getTransitionText(loc, day.pois[li + 1]) }}</text>
          </view>
        </view>
      </view>

      <!-- ===== 结语 ===== -->
      <view class="closing">
        <text class="closing-main">这就是我为你准备的旅行。</text>
        <text class="closing-sub">希望这份路线，能让你看到不一样的{{ destination }}。</text>
        <text class="closing-hint">如果想调整节奏、增加美食、或者换一种玩法，随时回来找我。</text>
        <text class="closing-sign">—— 行程一下</text>
      </view>

      <!-- ===== CTA ===== -->
      <view class="cta-section" v-if="!plan.isFromHistory">
        <text class="cta-title">还想看更多？</text>
        <text class="cta-sub">我们为你整理了{{ destination }}的隐藏玩法</text>
        <button class="cta-btn" @click="goAdjust">
          <text>解锁全部玩法</text>
        </button>
      </view>

      <view style="height: 200rpx;"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="footer-bar" :style="{ paddingBottom: (12 + safeAreaBottom) + 'px' }">
      <view class="footer-btns">
        <button class="footer-btn" v-if="!plan.isFromHistory && !plan.isFromPlaza" @click="goAdjust">
          <text class="btn-icon">✏️</text>
          <text class="btn-label">微调</text>
        </button>
        <button class="footer-btn" v-if="!plan.isFromPlaza" :class="{ 'btn-disabled': saveLock }" @click="saveToHistory" :disabled="saveLock">
          <text class="btn-icon">{{ saveLock ? '✓' : '💾' }}</text>
          <text class="btn-label">{{ saveLock ? '已保存' : '保存' }}</text>
        </button>
        <button class="footer-btn" @click="sharePoster">
          <text class="btn-icon">🖼️</text>
          <text class="btn-label">分享</text>
        </button>
        <button class="footer-btn footer-btn-primary" open-type="share">
          <text class="btn-icon">👥</text>
          <text class="btn-label btn-label-light">好友共创</text>
        </button>
        <button class="footer-btn" @click="goMap">
          <text class="btn-icon">🗺️</text>
          <text class="btn-label">地图</text>
        </button>
      </view>
    </view>

    <!-- 隐藏 canvas 用于海报生成 -->
    <canvas canvas-id="posterCanvas" id="posterCanvas" style="position: fixed; left: -9999px; top: -9999px; width: 750px; height: 1200px;"></canvas>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue'
import { onLoad, onShow, onShareAppMessage } from '@dcloudio/uni-app'
import { useTravelStore } from '@/store/travel'
import { useUserStore } from '@/store/user'
import { useSafeArea } from '@/utils/safeArea.js'
import { saveHistory, getPublicPlanDetail, getSharePlan } from '@/api/history.js'
import { generatePoster as generateBackendPoster, downloadPoster } from '@/api/poster.js'

const instance = getCurrentInstance()
const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight, safeAreaBottom } = useSafeArea()

const plan = ref({})
const saveLock = ref(false)
const shareThumbnailPath = ref('')
const isLoadingShare = ref(false)

// 管理员自动发布到广场
const isPublic = computed(() => userStore.userId === 1 || userStore.userId === '1')

const days = computed(() => {
  // 格式1: plan.days = [{day, itinerary, theme}]
  if (plan.value?.days && plan.value.days.length > 0) {
    return plan.value.days.map(d => ({
      day: d.day,
      pois: d.itinerary || [],
      theme: d.theme || ''
    }))
  }
  // 格式2: plan.dayPlanItinerary = [{day, name, ...}] 扁平景点列表
  const items = plan.value?.dayPlanItinerary || []
  if (items.length) {
    const map = {}
    for (const p of items) {
      const key = p.day || 1
      if (!map[key]) map[key] = { day: key, pois: [], theme: '' }
      map[key].pois.push(p)
    }
    return Object.values(map).sort((a, b) => a.day - b.day)
  }
  // 格式3: plan.dayPlan = [{summary, items}] 或 {dayKey: items[]} 广场/探索页来源
  const dayPlan = plan.value?.dayPlan
  if (!dayPlan) return []
  if (Array.isArray(dayPlan) && dayPlan.length) {
    // 检查是否扁平格式: [{day: 1, name: "...", image: "..."}]
    if (dayPlan[0]?.name && dayPlan[0]?.day) {
      const map = {}
      for (const p of dayPlan) {
        const key = p.day || 1
        if (!map[key]) map[key] = { day: key, pois: [], theme: '' }
        map[key].pois.push(p)
      }
      return Object.values(map).sort((a, b) => a.day - b.day)
    }
    // 嵌套格式: [{summary: "第1天", items: [...]}]
    return dayPlan.map((d, i) => ({
      day: i + 1,
      pois: d.items || (Array.isArray(d) ? d : []),
      theme: d.summary || ''
    }))
  }
  if (typeof dayPlan === 'object') {
    return Object.entries(dayPlan).map(([k, v]) => ({
      day: parseInt(k) || 1,
      pois: Array.isArray(v) ? v : [],
      theme: ''
    }))
  }
  return []
})

const daysCount = computed(() => days.value.length)
const nightsCount = computed(() => Math.max(0, daysCount.value - 1))

const allSpots = computed(() => days.value.flatMap(d => d.pois))

const destination = computed(() => {
  if (plan.value?.destination) return plan.value.destination
  const firstDay = plan.value?.days?.[0]
  if (firstDay?.itinerary?.[0]?.city) return firstDay.itinerary[0].city
  const firstSpot = plan.value?.dayPlanItinerary?.[0]
  if (firstSpot?.city) return firstSpot.city
  return '目的地'
})

const heroImage = computed(() => {
  if (plan.value?.noteCoverUrl) return plan.value.noteCoverUrl
  if (plan.value?.cover) return plan.value.cover
  const spots = allSpots.value
  for (const s of spots) {
    if (s.image) return s.image
  }
  return ''
})

const heroSubtitle = computed(() => {
  const summary = plan.value?.itinerarySummary || ''
  if (summary.length > 15) return summary.slice(0, 15)
  return summary || '为你定制的旅程'
})

const totalBudget = computed(() => {
  return allSpots.value.reduce((sum, s) => sum + (s.estimated_cost || 0), 0)
})

// ===== 旅行风格检测（匹配平台7大玩法） =====
const travelStyle = computed(() => {
  const s = plan.value?.itinerarySummary || ''
  // 按优先级匹配
  if (s.includes('摄影') || s.includes('拍照') || s.includes('出片') || s.includes('机位') || s.includes('夜景')) return 'photo'
  if (s.includes('美食') || s.includes('吃') || s.includes('小吃') || s.includes('餐厅') || s.includes('咖啡')) return 'food'
  if (s.includes('情侣') || s.includes('约会') || s.includes('浪漫') || s.includes('两个人')) return 'couple'
  if (s.includes('带娃') || s.includes('亲子') || s.includes('家庭') || s.includes('小朋友') || s.includes('动物园') || s.includes('科技馆')) return 'family'
  if (s.includes('特种兵') || s.includes('暴走') || s.includes('打卡') || s.includes('穷游') || s.includes('学生')) return 'rusher'
  if (s.includes('自驾') || s.includes('环线') || s.includes('公路') || s.includes('露营') || s.includes('周边')) return 'road'
  if (s.includes('walk') || s.includes('漫步') || s.includes('闲逛') || s.includes('步行') || s.includes('深度') || s.includes('微度假')) return 'city'
  // 兜底：根据景点数量推断
  const count = allSpots.value.length
  const d = daysCount.value || 1
  const avg = count / d
  if (avg >= 5) return 'rusher'
  if (avg <= 2) return 'city'
  return 'city'
})

// ===== 天气汇总 =====
const weatherSummary = computed(() => {
  const spots = allSpots.value
  if (!spots.length) return null
  const icons = spots.map(s => s.weather_icon).filter(Boolean)
  const temps = spots.map(s => {
    const t = s.temperature?.replace('°C', '')
    return t ? parseInt(t) : null
  }).filter(t => t !== null)

  if (!icons.length && !temps.length) return null

  const mainIcon = icons.length ? icons[Math.floor(icons.length / 2)] : '🌤️'
  const minTemp = temps.length ? Math.min(...temps) : null
  const maxTemp = temps.length ? Math.max(...temps) : null
  const tempRange = minTemp !== null && maxTemp !== null
    ? (minTemp === maxTemp ? `${minTemp}°C` : `${minTemp}~${maxTemp}°C`)
    : ''

  let advice = ''
  if (mainIcon.includes('雨')) advice = '记得带伞'
  else if (maxTemp && maxTemp >= 35) advice = '注意防暑'
  else if (minTemp && minTemp <= 5) advice = '注意保暖'
  else if (mainIcon.includes('雪')) advice = '注意防滑'
  else advice = '适合出行'

  return { icon: mainIcon, tempRange, advice }
})

// ===== 旅行信（根据风格动态生成） =====
const travelLetter = computed(() => {
  const summary = plan.value?.itinerarySummary || ''
  const city = destination.value
  const d = daysCount.value
  const style = travelStyle.value
  const spots = allSpots.value
  const weather = weatherSummary.value

  // 风格化的开场（7大玩法）
  const openers = {
    city: `这次带你探索${city}的街头巷尾。`,
    photo: `这次帮你规划了${city}的摄影路线。`,
    food: `这次为你安排了${city}的美食打卡。`,
    couple: `这次为你们安排了${city}的浪漫之旅。`,
    family: `这次帮你规划了${city}的亲子路线。`,
    rusher: `这次给你规划了${city}的特种兵路线。`,
    road: `这次为你规划了${city}的自驾路线。`,
  }

  // 风格化的中段
  const mids = {
    city: `不赶路，随心走，看到喜欢的就停下来，感受这座城市的呼吸。`,
    photo: `我特意选了光线最好的时段和角度，希望能帮你拍到满意的照片。`,
    food: `从老字号到巷子深处的小店，每一家都是我精挑细选的，准备好胃口。`,
    couple: `选了几个适合两个人慢慢逛的地方，不赶时间，享受二人世界。`,
    family: `节奏安排得比较宽松，带小朋友也不会太赶，重要的是全家开心。`,
    rusher: `行程安排得比较紧凑，一天能打很多卡，量力而行。`,
    road: `路线已经规划好了，跟着导航走就行，沿途风景不要错过。`,
  }

  // 天气融入
  let weatherNote = ''
  if (weather) {
    if (weather.advice === '记得带伞') weatherNote = `出发前看了一下，${city}这几天有雨，${weather.advice}。`
    else if (weather.advice === '注意防暑') weatherNote = `${city}这几天比较热，${weather.advice}，尽量避开正午户外。`
    else if (weather.advice === '注意保暖') weatherNote = `${city}这几天偏冷，${weather.advice}。`
    else weatherNote = `${city}这几天${weather.icon}，${weather.advice}。`
  }

  const opener = openers[style] || openers.family
  const mid = mids[style] || mids.family

  let letter = `${opener}${mid}`
  if (weatherNote) letter += weatherNote
  if (summary) letter += `${summary}`
  letter += `希望这份路线，能让你感受到${city}独特的魅力。`

  return letter
})

const physicalLevel = computed(() => {
  const count = allSpots.value.length
  if (count <= 3) return '体力轻松'
  if (count <= 6) return '体力适中'
  if (count <= 9) return '体力充沛'
  return '特种兵暴走'
})

const paceLabel = computed(() => {
  const count = allSpots.value.length
  const d = daysCount.value || 1
  const avg = count / d
  if (avg <= 2) return '节奏悠闲'
  if (avg <= 3) return '节奏轻松'
  if (avg <= 4) return '节奏适中'
  return '节奏紧凑'
})

const bestSeason = computed(() => {
  const s = plan.value?.itinerarySummary || ''
  if (s.includes('雪') || s.includes('冬')) return '冬季最佳'
  if (s.includes('花') || s.includes('春')) return '春季最佳'
  if (s.includes('海') || s.includes('夏')) return '夏季最佳'
  if (s.includes('枫') || s.includes('秋')) return '秋季最佳'
  return '四季皆宜'
})

function getDayTheme(day) {
  if (day.theme) return day.theme
  const spots = day.pois || []
  if (!spots.length) return ''
  return `${spots[0]?.city || ''}探索`
}

function getDayDestinations(day) {
  const spots = day.pois || []
  if (spots.length <= 2) return spots.map(s => s.name).join(' & ')
  return `${spots[0]?.city || ''}城区`
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const match = timeStr.match(/(\d{1,2}:\d{2})/)
  if (match) {
    const hour = parseInt(match[1].split(':')[0])
    if (hour < 12) return match[1] + ' AM'
    return match[1] + ' PM'
  }
  return timeStr
}

function getTransitionText(from, to) {
  const hint = from.transit_hint || ''
  const durationMatch = hint.match(/约?\s*(\d+)\s*分钟/)
  const duration = durationMatch ? parseInt(durationMatch[1]) : 0

  if (hint.includes('步行')) {
    return duration > 15
      ? `从${from.name}出来，沿着路慢慢走，大约${duration}分钟就到${to.name}了。`
      : `从这里走到${to.name}很近，几分钟的事。`
  }
  if (hint.includes('打车') || hint.includes('包车')) {
    return duration > 20
      ? `接下来去${to.name}稍远，打车大约${duration}分钟，路上可以歇歇。`
      : `打车去${to.name}，${duration}分钟左右。`
  }
  if (hint.includes('地铁') || hint.includes('公交')) {
    return `坐地铁去${to.name}，很方便。`
  }
  if (duration > 0) {
    return `去${to.name}大约${duration}分钟，不算远。`
  }
  return `接下来去${to.name}。`
}

function goBack() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/inspiration/index' }) }) }

function goAdjust() {
  if (plan.value?.isFromHistory) return
  uni.navigateTo({ url: '/pages/skeleton-confirm/index' })
}

// ===== 保存到我的行程 =====
async function saveToHistory() {
  if (saveLock.value) return
  if (!allSpots.value.length) {
    uni.showToast({ title: '无行程可保存', icon: 'none' })
    return
  }
  saveLock.value = true

  const coverUrl = allSpots.value.find(s => s.image)?.image || ''

  try {
    uni.showLoading({ title: '保存中…' })
    const result = await saveHistory({
      userInput: plan.value?.userInput || `${destination.value}行程`,
      modelType: 'auto',
      provider: 'unknown',
      itinerarySummary: plan.value?.itinerarySummary || '',
      dayPlan: allSpots.value,
      socialRecommendations: plan.value?.socialRecommendations || [],
      evidence: [],
      warnings: [],
      category: travelStyle.value || 'city',
      is_public: isPublic.value,
      cover_url: coverUrl
    })
    uni.hideLoading()
    if (result?.id) {
      plan.value.id = result.id
      uni.showToast({ title: result.deduped ? '已存在相同方案' : '保存成功', icon: 'none' })
    } else {
      uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
  } finally {
    saveLock.value = false
  }
}

// ===== 分享海报 =====

async function sharePoster() {
  if (!allSpots.value.length) {
    uni.showToast({ title: '无行程可分享', icon: 'none' })
    return
  }

  // 优先用后端海报
  try {
    uni.showLoading({ title: '生成海报中...' })
    const result = await generateBackendPoster({
      itinerarySummary: plan.value?.itinerarySummary || '',
      days: days.value,
      dayPlanItinerary: allSpots.value
    })
    if (result?.code === 0 && result.data?.image) {
      const tempFilePath = await downloadPoster(result.data.image)
      uni.hideLoading()
      // #ifdef MP-WEIXIN
      wx.showShareImageMenu({
        path: tempFilePath,
        needShowEntrance: true,
        entrancePath: 'pages/index/index',
        success: () => uni.showToast({ title: '分享成功', icon: 'success' }),
        fail: () => {
          uni.previewImage({
            urls: [tempFilePath],
            success: () => uni.showToast({ title: '海报已生成，请长按保存', icon: 'none' })
          })
        }
      })
      // #endif
      // #ifndef MP-WEIXIN
      uni.previewImage({
        urls: [tempFilePath],
        success: () => uni.showToast({ title: '海报已生成，请长按保存', icon: 'none' })
      })
      // #endif
      return
    }
  } catch (e) {
    console.log('后端海报失败，尝试本地生成:', e)
  }

  // 后备：本地 canvas 生成
  try {
    uni.showLoading({ title: '生成海报中...' })
    const tempFilePath = await generateLocalPoster()
    uni.hideLoading()
    if (tempFilePath) {
      uni.previewImage({
        urls: [tempFilePath],
        success: () => uni.showToast({ title: '海报已生成，请长按保存', icon: 'none' })
      })
    } else {
      fallbackCopyText()
    }
  } catch (e) {
    uni.hideLoading()
    fallbackCopyText()
  }
}

function generateShareThumbnail() {
  return new Promise((resolve) => {
    const ctx = uni.createCanvasContext('posterCanvas', instance)
    const W = 750, H = 1200

    ctx.setFillStyle('#F8F4EC')
    ctx.fillRect(0, 0, W, H)

    ctx.setFillStyle('#C9A96E')
    ctx.fillRect(0, 0, W, 200)

    ctx.setFillStyle('#FFFFFF')
    ctx.setFontSize(36)
    ctx.fillText(`${destination.value} · ${daysCount.value}天行程`, 40, 100)

    ctx.setFontSize(18)
    ctx.setFillStyle('rgba(255,255,255,0.85)')
    const summary = (plan.value?.itinerarySummary || '行程一下').slice(0, 30)
    ctx.fillText(summary, 40, 145)

    ctx.setFillStyle('#C9A96E')
    ctx.setFontSize(16)
    ctx.setTextAlign('center')
    ctx.fillText('行程一下 · 让灵感即刻启程', W / 2, H - 60)
    ctx.setTextAlign('left')

    ctx.draw(false, () => {
      setTimeout(() => {
        uni.canvasToTempFilePath({
          canvasId: 'posterCanvas',
          success: (res) => resolve(res.tempFilePath),
          fail: () => resolve(null)
        }, instance)
      }, 500)
    })
  })
}

function generateLocalPoster() {
  return new Promise((resolve) => {
    const ctx = uni.createCanvasContext('posterCanvas', instance)
    const W = 750, P = 40
    let y = 60

    // 背景
    ctx.setFillStyle('#F8F4EC')
    ctx.fillRect(0, 0, W, 1200)

    // Header
    ctx.setFillStyle('#C9A96E')
    ctx.fillRect(0, 0, W, 160)
    ctx.setFillStyle('#FFFFFF')
    ctx.setFontSize(28)
    ctx.setFontStyle('bold')
    ctx.fillText(`${destination.value} · ${daysCount.value}天行程`, P, y + 20)
    y += 60
    ctx.setFontSize(16)
    ctx.setFillStyle('rgba(255,255,255,0.8)')
    ctx.fillText(plan.value?.itinerarySummary || '行程一下', P, y + 20)
    y += 80

    // 景点列表（最多6个）
    const spots = allSpots.value.slice(0, 6)
    for (const spot of spots) {
      if (y > 1050) break
      // 名称
      ctx.setFillStyle('#2C2C2C')
      ctx.setFontSize(18)
      ctx.setFontStyle('bold')
      ctx.fillText(spot.name, P, y + 10)
      // 时间
      if (spot.time) {
        ctx.setFillStyle('#7F7668')
        ctx.setFontSize(14)
        ctx.setTextAlign('right')
        ctx.fillText(spot.time, W - P, y + 10)
        ctx.setTextAlign('left')
      }
      y += 30
      // reason
      if (spot.reason) {
        ctx.setFillStyle('#C9A96E')
        ctx.setFontSize(14)
        ctx.fillText(`★ ${spot.reason}`, P, y + 10)
        y += 24
      }
      // 描述
      if (spot.description) {
        ctx.setFillStyle('#5A5A5A')
        ctx.setFontSize(14)
        const desc = spot.description.length > 40 ? spot.description.slice(0, 40) + '…' : spot.description
        ctx.fillText(desc, P, y + 10)
        y += 24
      }
      y += 16
    }

    // 底部品牌
    ctx.setFillStyle('#C9A96E')
    ctx.setFontSize(14)
    ctx.setTextAlign('center')
    ctx.fillText('行程一下 · 让灵感即刻启程', W / 2, 1140)
    ctx.setTextAlign('left')

    ctx.draw(false, () => {
      setTimeout(() => {
        uni.canvasToTempFilePath({
          canvasId: 'posterCanvas',
          success: (res) => resolve(res.tempFilePath),
          fail: () => resolve(null)
        }, instance)
      }, 500)
    })
  })
}

function fallbackCopyText() {
  uni.hideLoading()
  let text = `📍 ${destination.value} ${daysCount.value}天行程\n\n`
  for (const d of days.value) {
    text += `Day ${d.day} ${getDayTheme(d)}\n`
    for (const loc of d.pois) {
      text += `  ${loc.time || ''} ${loc.name}`
      if (loc.reason) text += ` — ${loc.reason}`
      text += '\n'
    }
    text += '\n'
  }
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '行程已复制，快发给好友吧', icon: 'none' })
  })
}

// ===== 地图 =====
function goMap() {
  // 把当前方案数据同步给地图页（地图页读 currentPlan）
  const src = plan.value
  if (src) {
    const spots = days.value.flatMap(d => d.pois)
    travelStore.currentPlan = {
      ...src,
      dayPlanItinerary: spots.map((s, i) => ({
        ...s,
        day: s.day || 1,
        sequence: s.sequence ?? (i + 1)
      }))
    }
  }
  uni.switchTab({ url: '/pages/index/index' })
}

// ===== 微信分享 =====
onShareAppMessage(() => {
  const title = `${destination.value}${daysCount.value}天行程 — ${plan.value?.itinerarySummary || '行程一下'}`
  const planId = plan.value?.id || plan.value?.historyId || ''
  const path = `/pages/ai-plan-detail/index?planId=${planId}`
  return {
    title,
    path,
    imageUrl: shareThumbnailPath.value || 'https://tonystark-ai.ccwu.cc/png/kfeng.png'
  }
})

onLoad(async (options) => {
  // 恢复用户信息（管理员自动发布依赖 userId）
  userStore.restoreFromStorage()

  const isShareLink = !!options?.planId

  if (travelStore.currentPlan && !isShareLink) {
    plan.value = travelStore.currentPlan
  } else if (travelStore.previewPlan && !isShareLink) {
    plan.value = { ...travelStore.previewPlan, isFromPlaza: true }
  } else {
    const planId = options?.planId
    if (planId) {
      isLoadingShare.value = true
      // 先本地找
      const found = (travelStore.planHistory || []).find(h => h._taskId === planId || h.requestId === planId || String(h.id) === String(planId))
      if (found) {
        plan.value = { ...found, isFromPlaza: true }
      } else {
        // 本地没有，从服务器拉取
        try {
          uni.showLoading({ title: '加载方案…' })
          const detail = await getSharePlan(planId)
          uni.hideLoading()
          if (detail) {
            const rawDays = detail.day_plan || []
            const dayPlan = Array.isArray(rawDays)
              ? rawDays.map((d, i) => typeof d === 'object' && d.items
                  ? d
                  : { summary: detail.itinerary_summary || `第 ${i + 1} 天`, items: Array.isArray(d) ? d : (d ? [d] : []) })
              : typeof rawDays === 'object'
                ? Object.entries(rawDays).map(([k, v]) => ({ summary: `第 ${k} 天`, items: Array.isArray(v) ? v : [] }))
                : []
            plan.value = {
              id: detail.id,
              title: detail.title || '',
              cover: detail.cover || '',
              userInput: detail.user_input || '',
              dayPlan,
              itinerarySummary: detail.itinerary_summary || detail.summary || '',
              category: detail.category || 'city',
              isFromPlaza: true
            }
          }
        } catch (e) {
          uni.hideLoading()
          console.warn('[PlanDetail] 从服务器加载方案失败:', e)
        } finally {
          isLoadingShare.value = false
        }
      }
    }
    if (!plan.value?.dayPlanItinerary && !plan.value?.dayPlan) {
      try {
        const cached = uni.getStorageSync('ai_current_plan')
        if (cached) plan.value = cached
      } catch (e) {}
    }
  }

  // 非分享链接、且还没有数据库 id → 自动保存（好友共创分享需要 planId）
  if (!isShareLink && plan.value && !plan.value.id && !plan.value.historyId && allSpots.value.length) {
    try {
      await saveToHistory()
    } catch (e) {
      console.warn('[PlanDetail] 自动保存失败:', e)
    }
  }

  // 预生成分享缩略图
  const thumb = await generateShareThumbnail()
  if (thumb) shareThumbnailPath.value = thumb
})

// 每次页面显示时重新从 store 读取方案（解决返回后点新方案仍显示旧方案的问题）
onShow(() => {
  // 分享链接加载中或已加载的方案不覆盖
  if (isLoadingShare.value) return
  if (plan.value?.isFromPlaza && plan.value?.id) return
  if (travelStore.currentPlan) {
    plan.value = travelStore.currentPlan
  } else if (travelStore.previewPlan) {
    plan.value = { ...travelStore.previewPlan, isFromPlaza: true }
  }
})
</script>

<style scoped>
/* ===== 设计规范色彩覆盖（本页面专用） ===== */
.page {
  min-height: 100vh;
  background: #F8F4EC;
  display: flex; flex-direction: column;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}
.status-bar { background: transparent; }

/* ===== 顶部导航 ===== */
.top-bar {
  position: fixed; top: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 80rpx 32rpx 8rpx;
  z-index: 100;
}
.back-btn {
  width: 56rpx; height: 56rpx; border-radius: 50%;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
  border: none; padding: 0; font-size: 28rpx; color: #0F4C5C;
}
.back-btn::after { border: none; }
.top-title {
  font-size: 30rpx; font-weight: 600; color: #0F4C5C;
  text-shadow: 0 1px 4px rgba(255,255,255,0.6);
}
.top-spacer { width: 56rpx; }

.content { flex: 1; }

/* ===== Hero 全宽封面 ===== */
.hero {
  position: relative; width: 100%; height: 520rpx;
  overflow: hidden;
}
.hero-img { width: 100%; height: 100%; }
.hero-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #C9A96E 0%, #A88B5A 100%);
  display: flex; align-items: center; justify-content: center;
}
.hero-placeholder-text {
  font-size: 48rpx; font-weight: 700; color: rgba(255,255,255,0.5);
}
.hero-overlay {
  position: absolute; bottom: 0; left: 0; right: 0; height: 50%;
  background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%);
}
.hero-badges {
  position: absolute; top: 100rpx; left: 32rpx;
  display: flex; gap: 12rpx;
}
.hero-badge {
  padding: 6rpx 16rpx; border-radius: 999px;
  background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
  border: 1rpx solid rgba(255,255,255,0.3);
}
.hero-badge text { font-size: 22rpx; color: #FFF; font-weight: 500; }
.hero-bottom {
  position: absolute; bottom: 32rpx; left: 32rpx; right: 32rpx;
}
.hero-title {
  font-size: 40rpx; font-weight: 700; color: #FFFFFF;
  line-height: 1.3; letter-spacing: -0.01em;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* ===== 旅行信 ===== */
.letter-card {
  margin: -40rpx 24rpx 0;
  position: relative; z-index: 10;
  background: #FFFDF8;
  border-radius: 24rpx;
  border: 1rpx solid #E5DED1;
  padding: 32rpx;
  box-shadow: 0 4px 20px rgba(44,44,44,0.04);
}
.letter-header {
  display: flex; align-items: center; gap: 10rpx;
  margin-bottom: 20rpx;
}
.letter-icon { font-size: 28rpx; }
.letter-label {
  font-size: 24rpx; font-weight: 600; color: #2C2C2C;
  letter-spacing: 0.05em;
}
.letter-body {
  padding: 0 4rpx;
}
.letter-salutation {
  display: block; font-size: 28rpx; font-weight: 600;
  color: #2C2C2C; margin-bottom: 16rpx;
}
.letter-text {
  display: block; font-size: 26rpx; line-height: 1.8;
  color: #5A5A5A; margin-bottom: 20rpx;
}
.letter-sign {
  display: block; font-size: 24rpx; color: #0F4C5C;
  text-align: right; font-weight: 500;
}

/* ===== 小红书来源 ===== */
.note-source {
  margin: 16rpx 32rpx 0;
  padding: 20rpx 24rpx;
  background: #FFFDF8;
  border: 1rpx solid #E5DED1;
  border-radius: 16rpx;
}
.note-source-label {
  font-size: 22rpx; color: #999;
}
.note-source-info {
  display: flex; align-items: center; gap: 16rpx;
  margin-top: 8rpx;
}
.note-author {
  font-size: 24rpx; color: #C9A96E; font-weight: 500;
}
.note-likes {
  font-size: 22rpx; color: #FF6B6B;
}

/* ===== 信息胶囊 ===== */
.info-chips {
  display: flex; justify-content: center; gap: 24rpx;
  padding: 28rpx 32rpx 8rpx;
}
.chip {
  display: flex; align-items: center; gap: 6rpx;
  padding: 8rpx 20rpx; border-radius: 999px;
  background: #FFFDF8;
  border: 1rpx solid #E5DED1;
}
.chip-icon { font-size: 22rpx; }
.chip-text { font-size: 22rpx; color: #5A5A5A; font-weight: 500; }

/* ===== Day 区块 ===== */
.day-section {
  padding: 32rpx 0 16rpx;
  animation: fadeUp 0.5s ease both;
}
.day-header {
  display: flex; align-items: flex-start; gap: 20rpx;
  padding: 0 32rpx 20rpx;
}
.day-label {
  display: flex; flex-direction: column; align-items: center;
  min-width: 80rpx;
}
.day-label-sub {
  font-size: 18rpx; font-weight: 600; color: #C9A96E;
  letter-spacing: 0.1em;
}
.day-label-num {
  font-size: 44rpx; font-weight: 700; color: #C9A96E;
  line-height: 1;
}
.day-info { flex: 1; padding-top: 4rpx; }
.day-theme {
  display: block; font-size: 30rpx; font-weight: 700;
  color: #2C2C2C; margin-bottom: 4rpx;
}
.day-destinations {
  display: block; font-size: 24rpx; color: #5A5A5A;
}

/* ===== 景点条目 ===== */
.spot-entry {
  padding: 0 32rpx;
  margin-bottom: 8rpx;
  animation: fadeUp 0.5s ease both;
}
.spot-photo {
  border-radius: 20rpx; overflow: hidden;
  margin-bottom: 16rpx;
  box-shadow: 0 4px 16px rgba(44,44,44,0.06);
}
.spot-img { width: 100%; height: 380rpx; }

.spot-info { padding: 0 4rpx; }
.spot-name-row {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 8rpx;
}
.spot-name {
  font-size: 30rpx; font-weight: 700; color: #2C2C2C;
}
.spot-time {
  font-size: 22rpx; color: #7F7668; font-weight: 500;
}

/* 推荐理由 */
.spot-reason {
  display: flex; align-items: flex-start; gap: 6rpx;
  margin-bottom: 10rpx;
}
.reason-star {
  font-size: 20rpx; color: #C9A96E; margin-top: 4rpx;
}
.reason-label {
  font-size: 22rpx; color: #C9A96E; font-weight: 600;
}
.reason-text {
  font-size: 22rpx; color: #C9A96E; font-weight: 500;
  line-height: 1.5;
}

.spot-desc {
  display: block; font-size: 26rpx; line-height: 1.7;
  color: #5A5A5A; margin-bottom: 12rpx;
}

/* 实用信息 */
.spot-tips {
  display: flex; align-items: flex-start; gap: 10rpx;
  padding: 14rpx 16rpx;
  background: rgba(201,169,110,0.06);
  border-radius: 12rpx;
  border-left: 4rpx solid #C9A96E;
}
.tip-icon { font-size: 22rpx; margin-top: 2rpx; }
.tip-content { flex: 1; }
.tip-main {
  display: block; font-size: 22rpx; line-height: 1.6;
  color: #5A5A5A;
}

/* 过渡叙事 */
.spot-transition {
  padding: 20rpx 0 12rpx 24rpx;
  border-left: 2rpx solid #E5DED1;
  margin-left: 8rpx;
}
.transition-text {
  font-size: 24rpx; line-height: 1.7;
  color: #7F7668; font-style: italic;
}

/* ===== 结语 ===== */
.closing {
  padding: 48rpx 40rpx 24rpx;
  text-align: center;
  animation: fadeUp 0.5s ease 0.8s both;
}
.closing-main {
  display: block; font-size: 28rpx; line-height: 1.6;
  color: #2C2C2C; font-weight: 600;
  margin-bottom: 8rpx;
}
.closing-sub {
  display: block; font-size: 26rpx; line-height: 1.6;
  color: #5A5A5A; margin-bottom: 8rpx;
}
.closing-hint {
  display: block; font-size: 24rpx; line-height: 1.6;
  color: #7F7668; margin-bottom: 20rpx;
}
.closing-sign {
  display: block; font-size: 24rpx; color: #0F4C5C;
  font-weight: 500;
}

/* ===== CTA ===== */
.cta-section {
  margin: 16rpx 32rpx 0;
  padding: 36rpx 32rpx;
  background: #FFFDF8;
  border-radius: 24rpx;
  border: 1rpx solid #E5DED1;
  text-align: center;
  animation: fadeUp 0.5s ease 1s both;
}
.cta-title {
  display: block; font-size: 30rpx; font-weight: 700;
  color: #2C2C2C; margin-bottom: 8rpx;
}
.cta-sub {
  display: block; font-size: 24rpx; color: #7F7668;
  margin-bottom: 24rpx;
}
.cta-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 48rpx; height: 80rpx;
  background: #0F4C5C; color: #FFFFFF;
  border-radius: 999px; border: none;
  font-size: 26rpx; font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(15,76,92,0.3);
}
.cta-btn::after { border: none; }
.cta-btn:active { transform: scale(0.97); }

/* ===== 底部操作栏 ===== */
.footer-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  padding: 12rpx 24rpx 0;
  background: rgba(248,244,236,0.95);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-top: 1rpx solid #E5DED1;
  z-index: 10;
}
.footer-btns {
  display: flex; gap: 8rpx;
}
.footer-btn {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  height: 96rpx; border-radius: 16rpx;
  background: #FFFDF8;
  border: 1rpx solid #E5DED1;
  padding: 0; margin: 0;
  transition: all 0.2s;
}
.footer-btn::after { border: none; }
.footer-btn:active { transform: scale(0.95); background: #F5F0E8; }
.footer-btn.btn-disabled { opacity: 0.5; }
.footer-btn-primary {
  background: #0F4C5C;
  border-color: #0F4C5C;
}
.footer-btn-primary:active { background: #0D3E4C; }
.btn-icon { font-size: 28rpx; line-height: 1; }
.btn-label {
  font-size: 18rpx; color: #5A5A5A; font-weight: 500;
  line-height: 1; margin-top: 4rpx;
}
.btn-label-light { color: #FFFFFF; }

/* 动画 */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20rpx); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
