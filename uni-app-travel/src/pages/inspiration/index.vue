<template>
  <view class="inspiration-page" :class="themeClass">
    <header class="top-bar" :style="{ paddingTop: (8 + statusBarHeight) + 'px' }">
      <view class="top-row">
        <text class="top-title">行程一下</text>
        <button class="top-avatar-btn">
          <image class="top-avatar" :src="userAvatar" mode="aspectFill" />
        </button>
      </view>
      <scroll-view scroll-x class="category-scroll" :show-scrollbar="false">
        <text
          v-for="(cat, idx) in categories"
          :key="cat.slug"
          :class="['cat-chip', activeCategory === cat.slug ? 'cat-active' : '']"
          @click="onCategoryClick(cat)"
        >{{ cat.icon ? cat.icon + ' ' : '' }}{{ cat.name }}</text>
      </scroll-view>
    </header>

    <scroll-view scroll-y class="content" show-scrollbar="false" :scroll-top="scrollTop" :scroll-with-animation="true" :refresher-enabled="true" :refresher-triggered="plazaRefreshing" refresher-background="transparent" @refresherrefresh="onPlazaRefresh" @scrolltolower="onScrollToLower" @scroll="onScroll">

      <!-- 瀑布流方案列表 -->
      <view v-if="planList.length > 0" class="waterfall">
        <view class="waterfall-col">
          <view class="plan-card" v-for="(plan, idx) in leftCol" :key="'l'+idx" @click="onPlanCardClick(plan)">
            <image class="card-img" :src="plan.cover || getPlaceholderImg(idx)" mode="widthFix" />
            <view class="card-body">
              <text class="card-title">{{ plan.title || '精选旅行方案' }}</text>
              <view class="card-footer">
                <text class="card-desc">{{ plan.user_input || '点击使用此灵感' }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="waterfall-col">
          <view class="plan-card" v-for="(plan, idx) in rightCol" :key="'r'+idx" @click="onPlanCardClick(plan)">
            <image class="card-img" :src="plan.cover || getPlaceholderImg(idx + 3)" mode="widthFix" />
            <view class="card-body">
              <text class="card-title">{{ plan.title || '精选旅行方案' }}</text>
              <view class="card-footer">
                <text class="card-desc">{{ plan.user_input || '点击使用此灵感' }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!plazaLoading && planList.length === 0" class="empty-hint">
        <text class="empty-icon">🌍</text>
        <text class="empty-text">还没有灵感方案，点击右下角+号创建</text>
      </view>

      <!-- 加载更多 / 全部加载完 -->
      <view v-if="plazaLoadingMore" class="loading-hint">
        <text>加载更多…</text>
      </view>
      <view v-else-if="!plazaHasMore && planList.length > 0" class="loading-hint">
        <text>— 已经到底啦 —</text>
      </view>

      <!-- 首次加载中 -->
      <view v-if="plazaLoading" class="loading-hint">
        <text>加载更多灵感...</text>
      </view>

      <!-- 底部间距 -->
      <view style="height: 100rpx;"></view>
    </scroll-view>

    <!-- 返回顶部 -->
    <view v-if="showBackTop" class="back-top" :style="{ bottom: (120 + safeAreaBottom) + 'px' }" @click="scrollToTop">
      <text>↑</text>
    </view>

    <!-- 悬浮+号按钮 -->
    <view
      :class="['fab-btn', isGenerating ? 'fab-btn-busy' : '']"
      :style="{ bottom: (40 + safeAreaBottom) + 'px' }"
      @click="onFabClick"
    >
      <text v-if="!isGenerating" class="fab-icon">+</text>
      <view v-else class="fab-spinner"></view>
    </view>

    <!-- FAB 菜单 -->
    <view v-if="showFabMenu" class="fab-menu-mask" @click="showFabMenu = false">
      <view class="fab-menu" @click.stop :style="{ bottom: (100 + safeAreaBottom) + 'px' }">
        <view class="fab-menu-item" @click="showFabMenu = false; showCreateSheet = true">
          <text class="fab-menu-icon">✨</text>
          <text class="fab-menu-text">生成行程</text>
        </view>
        <view class="fab-menu-item" @click="showFabMenu = false; showImportSheet = true">
          <text class="fab-menu-icon">📋</text>
          <text class="fab-menu-text">从链接导入</text>
        </view>
      </view>
    </view>

    <!-- 导入笔记底部弹窗 -->
    <view v-if="showImportSheet" class="sheet-mask" @click="showImportSheet = false">
      <view class="sheet-panel" @click.stop>
        <view class="sheet-handle"></view>
        <text class="sheet-title">导入小红书笔记</text>
        <text class="sheet-sub">粘贴分享内容，自动提取链接解析</text>
        <textarea
          v-model="importUrl"
          class="import-textarea"
          placeholder="粘贴小红书分享内容..."
          :disabled="importing"
          auto-height
          :maxlength="-1"
        />
        <view class="sheet-actions">
          <button class="sheet-btn-cancel" @click="showImportSheet = false">取消</button>
          <button class="sheet-btn-primary" @click="importFromXhs" :disabled="importing || !importUrl">
            {{ importing ? '导入中...' : '导入' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 生成方案底部弹窗 -->
    <view v-if="showCreateSheet" class="sheet-mask" @click="showCreateSheet = false">
      <view class="sheet-panel" @click.stop>
        <view class="sheet-handle"></view>
        <text class="sheet-title">✨ 生成旅行方案</text>
        <text class="sheet-sub">描述你的旅行想法，为你规划专属行程</text>

        <!-- 旅行风格选择 -->
        <view class="style-row">
          <view
            v-for="(style, idx) in travelStyles"
            :key="idx"
            :class="['style-pill', travelModeIndex === idx ? 'style-pill-active' : '']"
            @click="travelModeIndex = idx"
          >
            <text>{{ style.icon }}</text>
            <text>{{ style.name }}</text>
          </view>
        </view>

        <!-- 输入 -->
        <view class="sheet-input-wrap">
          <textarea
            class="sheet-textarea"
            v-model="userInput"
            placeholder="想去上海看展，住在外滩附近，对法租界的咖啡馆感兴趣..."
            :maxlength="500"
          />
          <view class="sheet-input-footer">
            <view class="quick-tags">
              <text class="quick-tag" @click="userInput = '上海 3天 深度游'">上海 3天</text>
              <text class="quick-tag" @click="userInput = '东京 樱花季 4天'">东京 樱花季</text>
              <text class="quick-tag" @click="userInput = '成都 美食之旅 3天'">成都 美食</text>
            </view>
            <text class="char-count">{{ charCount }}/500</text>
          </view>
        </view>

        <!-- 随机转盘 -->
        <view class="wheel-section">
          <button v-if="!showWheel" class="wheel-trigger" @click.stop="startRandomWheel">
            <text>🎯</text>
            <text>随机选个目的地试试</text>
          </button>
          <view v-if="showWheel" class="wheel-container">
            <view class="wheel-wrap">
              <view class="wheel-glow-ring"></view>
              <view class="wheel" :class="{ 'wheel-spinning': isSpinning }" :style="wheelAnimStyle">
                <view class="wheel-segment" v-for="(dest, i) in wheelDestinations" :key="i"
                  :style="getSegmentStyle(i)">
                  <text class="wheel-text">{{ dest.name }}</text>
                </view>
                <view class="wheel-center"><text>🎯</text></view>
              </view>
              <view class="wheel-pointer"><text>▼</text></view>
              <view class="wheel-sparkle s1">✦</view>
              <view class="wheel-sparkle s2">✦</view>
              <view class="wheel-sparkle s3">✦</view>
              <view class="wheel-sparkle s4">✦</view>
              <view class="wheel-sparkle s5">✦</view>
              <view class="wheel-sparkle s6">✦</view>
            </view>
            <view v-if="wheelResult.name" class="wheel-result-show">
              <view class="result-confetti">
                <text class="confetti c1">🎉</text>
                <text class="confetti c2">✨</text>
                <text class="confetti c3">🎊</text>
              </view>
              <text class="wheel-result-text">{{ wheelResult.name }}</text>
              <text class="wheel-result-desc" v-if="wheelResult.desc">{{ wheelResult.desc }}</text>
              <text class="wheel-result-hint">已自动填入输入框，点击「开始生成」即可</text>
            </view>
          </view>
        </view>

        <!-- 生成按钮 -->
        <view class="sheet-action">
          <button class="generate-btn" :class="{ disabled: !userInput.trim() || isGenerating }" :disabled="!userInput.trim() || isGenerating" @click="handleGenerate">
            <text>✨ 开始生成</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 配额不足弹窗 -->
    <view v-if="showQuotaModal" class="sheet-mask" @click="showQuotaModal = false">
      <view class="sheet-panel" @click.stop>
        <view class="sheet-handle"></view>
        <view class="quota-modal-icon">📊</view>
        <text class="quota-modal-title">今日次数已用完</text>
        <text class="quota-modal-desc">每天可免费生成 {{ userStore.quota.max }} 次，邀请好友可立即获得额外配额</text>
        <view class="quota-modal-actions">
          <button class="quota-modal-btn primary" open-type="share" @success="onShareSuccess">
            <text>📤 分享给好友 +3 次</text>
          </button>
          <button class="quota-modal-btn secondary" @click="showQuotaModal = false">
            我知道了
          </button>
        </view>
      </view>
    </view>

    <!-- 生成中状态 -->
    <view v-if="isGenerating" class="skeleton-status">
      <view class="skeleton-icon">🧭</view>
      <view class="skeleton-info">
        <text class="skeleton-title">{{ skeletonStatusText }}</text>
        <text class="skeleton-sub" v-if="skeletonElapsed">耗时: {{ skeletonElapsed }}s</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { getPublicPlans, getPublicPlanDetail } from '@/api/history.js'
import { getRandomCities, importXhsNote } from '@/api/travel.js'
import { getQuota, addBonus } from '@/api/quota.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'
import { TRAVEL_STYLES } from '@/constants/travelStyles.js'

const travelStore = useTravelStore()
const userStore = useUserStore()
const { statusBarHeight, safeAreaBottom } = useSafeArea()

const userAvatar = computed(() => userStore.avatarUrl || 'https://ui-avatars.com/api/?name=行程一下&background=0F4C5C&color=fff&size=64')

onMounted(async () => {
  userStore.restoreFromStorage()
  loadPlazaPlans()
})

onShow(() => {
  if (!travelStore.loading && isGenerating.value) {
    cleanup()
  }
})

// 首页不需要返回按钮
const goBack = () => {
  loadPlazaPlans(false)
  uni.showToast({ title: '已刷新', icon: 'none', duration: 800 })
}

// Categories（7大玩法体系）
const categories = [
  { slug: 'all', name: '全部', icon: '' },
  { slug: 'city', ...TRAVEL_STYLES.city },
  { slug: 'photo', ...TRAVEL_STYLES.photo },
  { slug: 'food', ...TRAVEL_STYLES.food },
  { slug: 'couple', ...TRAVEL_STYLES.couple },
  { slug: 'family', ...TRAVEL_STYLES.family },
  { slug: 'rusher', ...TRAVEL_STYLES.rusher },
  { slug: 'road', ...TRAVEL_STYLES.road },
]
const activeCategory = ref('all')

// Plaza plan list
const planList = ref([])
const plazaLoading = ref(false)
const leftCol = computed(() => planList.value.filter((_, i) => i % 2 === 0))
const rightCol = computed(() => planList.value.filter((_, i) => i % 2 === 1))

// 分页
const plazaPage = ref(1)
const plazaPageSize = 12
const plazaHasMore = ref(true)
const plazaLoadingMore = ref(false)
const plazaRefreshing = ref(false)

const onPlazaRefresh = async () => {
  plazaRefreshing.value = true
  try {
    await loadPlazaPlans(false)
  } finally {
    plazaRefreshing.value = false
  }
}

// 返回顶部
const scrollTop = ref(0)
const showBackTop = ref(false)
const onScroll = (e) => {
  const top = e?.detail?.scrollTop || 0
  showBackTop.value = top > 600
}
const scrollToTop = () => {
  scrollTop.value = 1
  setTimeout(() => { scrollTop.value = 0 }, 50)
}

const loadPlazaPlans = async (append = false) => {
  if (!append) {
    plazaLoading.value = true
    plazaPage.value = 1
    plazaHasMore.value = true
  } else {
    plazaLoadingMore.value = true
  }
  try {
    const data = await getPublicPlans({
      page: plazaPage.value,
      pageSize: plazaPageSize,
      category: activeCategory.value,
      sort: 'new'
    })
    const list = data?.list || []
    if (append) {
      planList.value = planList.value.concat(list)
    } else {
      planList.value = list.length > 0 ? list : getFallbackPlans()
    }
    plazaHasMore.value = list.length >= plazaPageSize
  } catch (e) {
    console.error('[inspiration] 加载灵感库失败:', e)
    if (!append) {
      planList.value = []
      uni.showToast({ title: '灵感库加载失败', icon: 'none' })
    }
  } finally {
    plazaLoading.value = false
    plazaLoadingMore.value = false
  }
}

const onCategoryClick = (cat) => {
  if (activeCategory.value === cat.slug) return
  activeCategory.value = cat.slug
  loadPlazaPlans(false)
}

const onScrollToLower = () => {
  if (plazaLoading.value || plazaLoadingMore.value || !plazaHasMore.value) return
  plazaPage.value += 1
  loadPlazaPlans(true)
}

// 移除点赞功能

const getFallbackPlans = () => [
  { id: 1, title: '上海3日深度游：外滩法租界美食探索', user_input: '上海 3天 深度游，住外滩附近', cover: 'https://aixian.online/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png' },
  { id: 2, title: '东京樱花季4天行程攻略', user_input: '东京 樱花季 4天', cover: 'https://aixian.online/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png' },
  { id: 3, title: '成都美食之旅3天', user_input: '成都 美食之旅 3天', cover: 'https://aixian.online/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png' },
  { id: 4, title: '三亚5天海滨度假', user_input: '三亚 5天 度假', cover: 'https://aixian.online/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png' },
  { id: 5, title: '西安古都文化深度游', user_input: '西安 3天 文化游', cover: 'https://aixian.online/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png' },
  { id: 6, title: '丽江大理7天慢旅行', user_input: '丽江大理 7天', cover: 'https://aixian.online/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png' },
  { id: 7, title: '新疆伊犁5天花海之旅', user_input: '新疆 伊犁 5天 花海', cover: 'https://aixian.online/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png' },
  { id: 8, title: '杭州西湖3天诗意漫游', user_input: '杭州 西湖 3天 漫游', cover: 'https://aixian.online/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png' },
  { id: 9, title: '桂林阳朔4天山水画卷', user_input: '桂林 阳朔 4天 山水', cover: 'https://aixian.online/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png' },
  { id: 10, title: '重庆3天火锅江湖之旅', user_input: '重庆 3天 火锅', cover: 'https://aixian.online/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png' },
  { id: 11, title: '大理洱海5天环湖慢生活', user_input: '大理 洱海 5天 环湖', cover: 'https://aixian.online/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png' },
  { id: 12, title: '哈尔滨冰雪7天奇幻之旅', user_input: '哈尔滨 冰雪 7天', cover: 'https://aixian.online/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png' },
]

const getPlaceholderImg = (idx) => {
  const imgs = [
    'https://aixian.online/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png',
    'https://aixian.online/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png',
    'https://aixian.online/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png'
  ]
  return imgs[idx % imgs.length]
}

// Plan detail - 点击查看方案详情
const onPlanCardClick = async (plan) => {
  if (!plan.id) return
  
  uni.showLoading({ title: '加载中...' })
  try {
    const detail = await getPublicPlanDetail(plan.id)
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
      
      travelStore.currentPlan = null  // 清掉旧方案，避免 onLoad 取到历史残留
      travelStore.previewPlan = {
        id: detail.id,
        title: detail.title || plan.title,
        cover: detail.cover || plan.cover,
        userInput: detail.user_input || plan.user_input || '',
        dayPlan: dayPlan,
        itinerarySummary: detail.itinerary_summary || detail.summary || '',
        category: detail.category || plan.category || 'city',
        noteAuthor: detail.note_meta?.author || '',
        noteLikes: detail.note_meta?.likes || 0,
        noteCoverUrl: detail.note_meta?.cover_url || '',
        noteImages: detail.note_meta?.images || [],
        noteContent: detail.note_meta?.content || ''
      }
      uni.navigateTo({ url: '/pages/ai-plan-detail/index' })
    }
  } catch (e) {
    uni.hideLoading()
    console.warn('[Inspiration] 加载方案详情失败:', e)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  }
}

// 分享成功 → 加配额
const onShareSuccess = async () => {
  try {
    await addBonus('share')
    uni.showToast({ title: '分享成功 +3 次配额', icon: 'success' })
  } catch (err) {
    console.warn('[Inspiration] 分享加分失败:', err)
  }
}

// Quota check
const showQuotaModal = ref(false)

// Create sheet
const showCreateSheet = ref(false)
const showFabMenu = ref(false)
const showImportSheet = ref(false)
const importUrl = ref('')
const importing = ref(false)
const userInput = ref('')
const travelModeIndex = ref(0)
const charCount = computed(() => userInput.value.length)

// 7 风格（平台主推）
const travelStyles = [
  { slug: 'city',    name: TRAVEL_STYLES.city.name,    icon: TRAVEL_STYLES.city.icon },
  { slug: 'photo',   name: TRAVEL_STYLES.photo.name,   icon: TRAVEL_STYLES.photo.icon },
  { slug: 'food',    name: TRAVEL_STYLES.food.name,    icon: TRAVEL_STYLES.food.icon },
  { slug: 'couple',  name: TRAVEL_STYLES.couple.name,  icon: TRAVEL_STYLES.couple.icon },
  { slug: 'family',  name: TRAVEL_STYLES.family.name,  icon: TRAVEL_STYLES.family.icon },
  { slug: 'rusher',  name: TRAVEL_STYLES.rusher.name,  icon: TRAVEL_STYLES.rusher.icon },
  { slug: 'road',    name: TRAVEL_STYLES.road.name,    icon: TRAVEL_STYLES.road.icon },
]

// Spinning wheel
const showWheel = ref(false)
const isSpinning = ref(false)
const wheelResult = ref({ name: '', desc: '' })
const wheelAngle = ref(0)
const wheelAnimStyle = ref({})

const wheelDestinations = ref([
  { name: '加载中...', province: '', tags: [], desc: '', color: '#0F4C5C' },
  { name: '加载中...', province: '', tags: [], desc: '', color: '#14B8A6' },
  { name: '加载中...', province: '', tags: [], desc: '', color: '#0D9488' },
  { name: '加载中...', province: '', tags: [], desc: '', color: '#2DD4BF' },
  { name: '加载中...', province: '', tags: [], desc: '', color: '#516161' },
  { name: '加载中...', province: '', tags: [], desc: '', color: '#0F4C5C' }
])

const wheelColors = ['#0F4C5C', '#14B8A6', '#0D9488', '#2DD4BF', '#516161', '#0F4C5C']

const getSegmentStyle = (i) => {
  const deg = i * (360 / wheelDestinations.value.length)
  return { transform: `rotate(${deg}deg)`, background: wheelColors[i % wheelColors.length] }
}

// 生成丰富的旅行描述
const generateRichInput = (dest) => {
  const dayCount = [2, 2, 3, 3, 3, 4, 4, 5][Math.floor(Math.random() * 8)]
  const tagWord = dest.tags && dest.tags.length > 0
    ? dest.tags[Math.floor(Math.random() * dest.tags.length)]
    : '深度游'
  const province = dest.province ? dest.province : ''
  const prompts = [
    `去${dest.name}${dest.desc ? '，' + dest.desc : ''}，${dayCount}天${tagWord}`,
    `${province}${dest.name} ${tagWord}之旅，${dayCount}天行程`,
    `到${dest.name}感受${tagWord}，${dayCount}天畅游`,
    `${dest.name} ${dayCount}天${tagWord}，${dest.tags && dest.tags.length > 1 ? dest.tags.slice(0, 2).join(' ') : ''}`
  ]
  return prompts[Math.floor(Math.random() * prompts.length)]
}

const startRandomWheel = async () => {
  showWheel.value = true
  isSpinning.value = true
  wheelResult.value = { name: '', desc: '' }

  // 从后端获取随机城市
  try {
    const res = await getRandomCities(6)
    if (res?.code === 0 && res.data?.length > 0) {
      wheelDestinations.value = res.data.map((c, i) => ({
        ...c,
        color: wheelColors[i % wheelColors.length]
      }))
    }
  } catch (e) {
    console.warn('[Inspiration] 获取随机城市失败，使用默认:', e)
    const fallback = ['上海', '成都', '西安', '丽江', '桂林', '三亚']
    wheelDestinations.value = fallback.map((name, i) => ({
      name, province: '', tags: [], desc: '', color: wheelColors[i]
    }))
  }

  const segCount = wheelDestinations.value.length
  const segAngle = 360 / segCount

  // 炫酷转盘：5~8圈 + 随机偏移，使用自然缓动
  const totalRotation = 1800 + Math.random() * 1080
  const randomOffset = Math.random() * 360
  const finalAngle = totalRotation + randomOffset

  wheelAnimStyle.value = {
    transform: `rotate(${finalAngle}deg)`,
    transition: `transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)`
  }

  setTimeout(() => {
    isSpinning.value = false

    const effectiveAngle = finalAngle % 360
    const pointerAngle = (360 - effectiveAngle + segAngle / 2) % 360
    const selectedIdx = Math.floor(pointerAngle / segAngle) % segCount
    const dest = wheelDestinations.value[selectedIdx] || wheelDestinations.value[0]

    userInput.value = generateRichInput(dest)

    wheelResult.value = {
      name: `🎉 ${dest.name}`,
      desc: dest.desc
        ? `${dest.desc}${dest.tags && dest.tags.length > 0 ? ' · ' + dest.tags.slice(0, 3).join(' ') : ''}`
        : dest.tags && dest.tags.length > 0
          ? dest.tags.slice(0, 3).join(' · ')
          : ''
    }

    setTimeout(() => {
      showWheel.value = false
      wheelAngle.value = 0
      wheelAnimStyle.value = {}
    }, 4000)
  }, 4400)
}

// Generate
const isGenerating = ref(false)
const skeletonStatusText = ref('正在规划行程...')
const skeletonElapsed = ref(0)
let skeletonStartTime = 0
let skeletonTimer = null

watch(() => travelStore.loading, (loading) => {
  if (loading && !isGenerating.value) {
    isGenerating.value = true
    skeletonStartTime = Date.now()
    skeletonElapsed.value = 0
    skeletonStatusText.value = '正在规划行程...'
    updateSkeleton()
  } else if (!loading && isGenerating.value) {
    cleanup()
  }
})

const updateSkeleton = () => {
  if (!isGenerating.value) return
  skeletonElapsed.value = Math.round((Date.now() - skeletonStartTime) / 1000)
  skeletonStatusText.value = skeletonElapsed.value > 3 ? `正在规划行程... ${skeletonElapsed.value}s` : '正在规划行程...'
  if (isGenerating.value) skeletonTimer = setTimeout(updateSkeleton, 1000)
}

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

  // 检查配额
  try {
    const quota = await getQuota()
    const canUse = quota ? (quota.remaining > 0) : true
    if (!canUse) {
      showCreateSheet.value = false
      showQuotaModal.value = true
      return
    }
  } catch {
    // 获取配额失败，允许继续
  }

  try {
    isGenerating.value = true
    showCreateSheet.value = false
    skeletonStartTime = Date.now()
    updateSkeleton()

    const result = await travelStore.createPlanV4({
      userInput: userInput.value,
      modelType: 'auto',
      travelMode: travelStyles[travelModeIndex.value].slug
    })

    cleanup()
    if (result && result.dayPlanItinerary?.length > 0) {
      // P0-2: 不reLaunch，而是跳转到确认/调整页
      uni.navigateTo({ url: '/pages/skeleton-confirm/index' })
    }
  } catch {
    cleanup()
    uni.showToast({ title: '生成失败，请稍后重试', icon: 'none' })
  }
}

const cleanup = () => {
  isGenerating.value = false
  if (skeletonTimer) { clearTimeout(skeletonTimer); skeletonTimer = null }
}

// 防止生成中重复点击 + 号
const onFabClick = () => {
  if (isGenerating.value) {
    uni.showToast({ title: '方案生成中，请稍候…', icon: 'none' })
    return
  }
  showFabMenu.value = true
}

async function importFromXhs() {
  if (!importUrl.value || importing.value) return
  importing.value = true
  try {
    const res = await importXhsNote({ url: importUrl.value })
    if (res.code === 0) {
      const data = res.data
      travelStore.currentPlan = {
        itinerarySummary: data.itinerary_summary,
        dayPlan: data.day_plan,
        socialRecommendations: [],
        evidence: [],
        warnings: [],
        category: data.category,
        noteCoverUrl: data.note?.cover_url || '',
        noteImages: data.note?.images || [],
        noteContent: data.note?.content || '',
        noteAuthor: data.note?.author || '',
        noteLikes: data.note?.likes || 0,
        isFromHistory: true,
        historyId: data.plan_id,
      }
      showImportSheet.value = false
      importUrl.value = ''
      uni.navigateTo({ url: '/pages/ai-plan-detail/index' })
    } else {
      uni.showToast({ title: res.msg || '导入失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '导入失败: ' + (e.message || '网络错误'), icon: 'none' })
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.inspiration-page {
  height: 100vh;
  display: flex; flex-direction: column;
  background: #f8f9fa;
  overflow: hidden;
}

.top-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  padding: 0 24rpx;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.top-row {
  display: flex; align-items: center; justify-content: space-between;
  height: 44px;
}
.top-title { font-size: 20px; font-weight: 700; color: var(--color-primary); }
.top-avatar { width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.4); }
.top-avatar-btn { padding: 0; margin: 0; border: none; background: transparent; line-height: 0; }
.top-avatar-btn::after { border: none; }

.content {
  flex: 1; min-height: 0;
  padding: 260rpx 24rpx 80rpx;
  box-sizing: border-box;
}

.category-scroll {
  display: flex; gap: 8px; padding: 4rpx 0 12rpx;
  white-space: nowrap;
}
.category-scroll::-webkit-scrollbar { display: none; }
.cat-chip {
  padding: 5px 14px; border-radius: 999px;
  font-size: 12px; font-weight: 500;
  background: rgba(0,0,0,0.04); border: 1px solid transparent;
  color: var(--color-on-surface-variant); flex-shrink: 0;
}
.cat-active {
  background: linear-gradient(135deg, #0F4C5C, #14B8A6);
  color: #fff; border-color: transparent;
  box-shadow: 0 4px 12px rgba(15,76,92,0.2);
}

/* Waterfall */
.waterfall { display: flex; gap: 16rpx; }
.waterfall-col { flex: 1; display: flex; flex-direction: column; gap: 16rpx; }
.plan-card {
  background: #fff; border-radius: 16px; overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: transform 0.2s;
}
.plan-card:active { transform: scale(0.97); }
.card-img { width: 100%; display: block; min-height: 140px; }
.card-body { padding: 12px 14px 14px; }
.card-title {
  font-size: 14px; font-weight: 600; color: var(--color-on-surface);
  line-height: 1.5; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.card-footer {
  display: flex; align-items: center; margin-top: 10px;
}
.card-desc {
  font-size: 11px;
  color: var(--color-on-surface-variant);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.empty-hint { display: flex; flex-direction: column; align-items: center; padding: 80rpx 0; }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-text { font-size: 14px; color: var(--color-on-surface-variant); opacity: 0.6; }
.loading-hint { text-align: center; padding: 32rpx; font-size: 13px; color: var(--color-outline); opacity: 0.6; }

.back-top {
  position: fixed; right: 32rpx; z-index: 18;
  width: 64rpx; height: 64rpx; border-radius: 50%;
  background: linear-gradient(135deg, #0F4C5C, #14B8A6);
  color: #fff; font-size: 28rpx; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(15,76,92,0.30);
}
.back-top:active { transform: scale(0.92); }

/* FAB */
.fab-btn {
  position: fixed; right: 48rpx; z-index: 50;
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 50%, #2DD4BF 100%);
  box-shadow: 0 8px 24px rgba(15,76,92,0.35);
  display: flex; align-items: center; justify-content: center;
}
.fab-btn:active { transform: scale(0.92); }
.fab-btn-busy { opacity: 0.7; pointer-events: none; }
.fab-icon { font-size: 32px; font-weight: 300; color: #fff; line-height: 1; margin-bottom: -2px; }
.fab-spinner {
  width: 28px; height: 28px;
  border: 3px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: fab-spin 0.8s linear infinite;
}
@keyframes fab-spin { to { transform: rotate(360deg); } }

/* FAB Menu */
.fab-menu-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 55;
  background: rgba(0,0,0,0.25);
}
.fab-menu {
  position: fixed; right: 32rpx; z-index: 56;
  display: flex; flex-direction: column; gap: 10px;
}
.fab-menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 14px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  white-space: nowrap;
  animation: fabItemIn 0.2s ease-out;
}
.fab-menu-item:active { transform: scale(0.96); background: #f5f5f5; }
.fab-menu-icon { font-size: 16px; }
.fab-menu-text { font-size: 13px; color: #2C2C2C; font-weight: 600; }
@keyframes fabItemIn { from { opacity: 0; transform: translateY(8px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }

/* Import Sheet */
.import-input {
  width: 100%; height: 48px; margin: 16px 0 24px;
  padding: 0 16px; border: 1.5px solid rgba(0,0,0,0.08); border-radius: 14px;
  font-size: 15px; color: #2C2C2C; background: rgba(255,255,255,0.7);
  box-sizing: border-box;
}
.import-input:disabled { opacity: 0.5; }
.import-textarea {
  width: 100%; min-height: 80px; max-height: 200px; margin: 16px 0 24px;
  padding: 12px 16px; border: 1.5px solid rgba(0,0,0,0.08); border-radius: 14px;
  font-size: 14px; color: #2C2C2C; background: rgba(255,255,255,0.7);
  box-sizing: border-box; line-height: 1.5;
}
.import-textarea:disabled { opacity: 0.5; }
.sheet-actions { display: flex; gap: 12px; }
.sheet-btn-cancel {
  flex: 1; height: 48px; border-radius: 14px;
  background: rgba(0,0,0,0.04); border: none;
  font-size: 15px; font-weight: 600; color: #5A5A5A;
  display: flex; align-items: center; justify-content: center;
}
.sheet-btn-cancel::after { border: none; }
.sheet-btn-primary {
  flex: 1; height: 48px; border-radius: 14px;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 50%, #2DD4BF 100%);
  border: none;
  font-size: 15px; font-weight: 700; color: #fff;
  box-shadow: 0 4px 16px rgba(15,76,92,0.2);
  display: flex; align-items: center; justify-content: center;
}
.sheet-btn-primary::after { border: none; }
.sheet-btn-primary:active { transform: scale(0.97); }
.sheet-btn-primary:disabled { opacity: 0.4; }

/* Sheet */
.sheet-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 500;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end;
}
.sheet-panel {
  width: 100%; background: #ffffff;
  border-radius: 32px 32px 0 0;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 40px rgba(0,0,0,0.15);
  animation: sheetUp 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.sheet-handle { width: 36px; height: 5px; border-radius: 999px; background: rgba(0,0,0,0.1); margin: 0 auto 20px; }
.sheet-title { font-size: 22px; font-weight: 700; color: var(--color-primary); display: block; margin-bottom: 4px; }
.sheet-sub { font-size: 13px; color: var(--color-on-surface-variant); opacity: 0.6; display: block; margin-bottom: 24px; }

.style-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
.style-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 999px;
  font-size: 13px; font-weight: 600;
  background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.06);
  color: var(--color-on-surface-variant);
}
.style-pill-active {
  background: rgba(15,76,92,0.08); border-color: var(--color-primary); color: var(--color-primary);
}

.sheet-input-wrap {
  background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.06);
  border-radius: 20px; padding: 28rpx;
}
.sheet-textarea {
  width: 100%; min-height: 100px; background: transparent; border: none; resize: none;
  font-size: 15px; line-height: 24px; color: var(--color-on-surface);
}
.sheet-textarea::placeholder { color: var(--color-on-surface-variant); opacity: 0.4; }
.sheet-input-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 16rpx; margin-top: 16rpx;
  border-top: 1px solid rgba(0,0,0,0.04);
}
.quick-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.quick-tag {
  padding: 6px 14px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
  background: rgba(15,76,92,0.06); color: var(--color-primary);
}
.char-count { font-size: 11px; color: var(--color-outline); opacity: 0.5; }

/* Wheel */
.wheel-section { margin-top: 24rpx; }
.wheel-trigger {
  width: 100%; height: auto;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 18rpx 24rpx; border-radius: 12px;
  background: linear-gradient(135deg, rgba(15,76,92,0.08), rgba(20,184,166,0.12));
  color: #0F4C5C;
  font-size: 14px; font-weight: 600;
  border: 1px solid rgba(15,76,92,0.15);
}
.wheel-trigger::after { border: none; }
.wheel-trigger:active { opacity: 0.7; }
.wheel-container {
  display: flex; flex-direction: column; align-items: center;
  padding: 24rpx 0;
}
.wheel-wrap {
  position: relative; width: 210px; height: 210px;
}
/* 发光环 */
.wheel-glow-ring {
  position: absolute; inset: -8px;
  border-radius: 50%;
  background: conic-gradient(#0F4C5C, #14B8A6, #2DD4BF, #0D9488, #0F4C5C);
  opacity: 0.5;
  animation: glow-spin 3s linear infinite;
  filter: blur(6px);
}
@keyframes glow-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.wheel {
  width: 210px; height: 210px;
  border-radius: 50%;
  position: relative; overflow: hidden;
  box-shadow: 0 4px 16px rgba(15,76,92,0.2), inset 0 0 20px rgba(255,255,255,0.1);
  border: 2px solid rgba(255,255,255,0.6);
  z-index: 1;
}
.wheel-spinning {
  animation: wheel-glow 1.5s ease-in-out infinite;
}
@keyframes wheel-glow {
  0%, 100% { box-shadow: 0 4px 16px rgba(15,76,92,0.2), inset 0 0 20px rgba(255,255,255,0.1); }
  50% { box-shadow: 0 4px 30px rgba(15,76,92,0.4), 0 0 40px rgba(20,184,166,0.15), inset 0 0 25px rgba(255,255,255,0.2); }
}
.wheel-segment {
  position: absolute; inset: 0;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12px;
  transform-origin: center center;
  clip-path: polygon(50% 50%, 0% 0%, 100% 0%);
}
.wheel-text {
  font-size: 12px; font-weight: 700; color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  margin-top: -2px;
  white-space: nowrap;
}
/* 指针 */
.wheel-pointer {
  position: absolute; top: -10px; left: 50%;
  transform: translateX(-50%);
  font-size: 24px; color: #0F4C5C; z-index: 10;
  line-height: 1;
  filter: drop-shadow(0 2px 6px rgba(15,76,92,0.5));
}
/* 中心 */
.wheel-center {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #fff, #f0f4f8);
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; z-index: 2;
}
/* 星光粒子 */
.wheel-sparkle {
  position: absolute; font-size: 10px; color: #2DD4BF;
  z-index: 3; pointer-events: none;
  animation: sparkle-twinkle 1.2s ease-in-out infinite;
}
.wheel-sparkle.s1 { top: -12px; left: 50%; transform: translateX(-50%); }
.wheel-sparkle.s2 { top: 20%; right: -16px; animation-delay: 0.2s; }
.wheel-sparkle.s3 { bottom: -12px; left: 50%; transform: translateX(-50%); animation-delay: 0.4s; }
.wheel-sparkle.s4 { top: 20%; left: -16px; animation-delay: 0.6s; }
.wheel-sparkle.s5 { top: -4px; right: 10%; animation-delay: 0.8s; }
.wheel-sparkle.s6 { bottom: -4px; left: 10%; animation-delay: 1s; }
@keyframes sparkle-twinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
}
/* 结果展示 */
.wheel-result-show {
  margin-top: 20px; text-align: center;
  animation: result-pop 0.5s cubic-bezier(0.17, 0.67, 0.12, 0.99);
}
@keyframes result-pop {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.wheel-result-text { font-size: 18px; font-weight: 800; color: #0F4C5C; display: block; }
.wheel-result-desc { font-size: 13px; color: #14B8A6; margin-top: 6px; display: block; font-weight: 600; }
.wheel-result-hint { font-size: 11px; color: #999; margin-top: 10px; display: block; }
/* 彩屑 */
.result-confetti { position: relative; height: 0; }
.confetti {
  position: absolute; font-size: 20px;
  animation: confetti-fall 1.5s ease-in-out forwards;
}
.confetti.c1 { left: -60px; top: -10px; animation-delay: 0s; }
.confetti.c2 { left: -30px; top: -20px; animation-delay: 0.15s; }
.confetti.c3 { left: 10px; top: -15px; animation-delay: 0.3s; }
@keyframes confetti-fall {
  0% { transform: translateY(-20px) rotate(0deg) scale(0.5); opacity: 0; }
  30% { transform: translateY(-5px) rotate(120deg) scale(1.2); opacity: 1; }
  100% { transform: translateY(30px) rotate(360deg) scale(0.6); opacity: 0; }
}

.sheet-action { margin-top: 24rpx; }
.generate-btn {
  width: 100%; height: 52px;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 50%, #2DD4BF 100%);
  border-radius: 16px; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 17px; font-weight: 700;
  box-shadow: 0 8px 24px rgba(15,76,92,0.25); border: none;
}
.generate-btn::after { border: none; }
.generate-btn:active { transform: scale(0.97); }
.generate-btn.disabled { opacity: 0.4; }

/* Quota modal */
.quota-modal-icon { text-align: center; font-size: 48px; margin-bottom: 16px; display: block; }
.quota-modal-title { text-align: center; font-size: 22px; font-weight: 700; color: var(--color-primary); display: block; margin-bottom: 12px; }
.quota-modal-desc { text-align: center; font-size: 14px; color: var(--color-on-surface-variant); line-height: 1.6; display: block; margin-bottom: 32px; }
.quota-modal-actions { display: flex; flex-direction: column; gap: 12px; }
.quota-modal-btn {
  width: 100%; height: 52px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 600; border: none;
}
.quota-modal-btn::after { border: none; }
.quota-modal-btn.secondary {
  background: var(--color-surface-container); color: var(--color-on-surface-variant);
}
.quota-modal-btn.secondary:active { opacity: 0.7; }
.quota-modal-btn.primary {
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%);
  color: #ffffff; box-shadow: 0 8px 24px rgba(15,76,92,0.25);
}
.quota-modal-btn.primary:active { transform: scale(0.97); }

/* Skeleton status */
.skeleton-status {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 600;
  display: flex; align-items: center; gap: 12px;
  padding: 32rpx 40rpx;
  background: rgba(255,255,255,0.9); backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}
.skeleton-icon { font-size: 24px; }
.skeleton-info { }
.skeleton-title { font-size: 14px; font-weight: 600; color: var(--color-primary); display: block; }
.skeleton-sub { font-size: 12px; color: var(--color-on-surface-variant); margin-top: 2px; display: block; }
</style>