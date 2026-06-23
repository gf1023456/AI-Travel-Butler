<template>
  <view class="map-page" :class="themeClass">
    <!-- Fullscreen Map -->
    <map
      class="map-container"
      :longitude="center[1]"
      :latitude="center[0]"
      :scale="zoom"
      :show-location="true"
      :enable-zoom="true"
      :enable-scroll="true"
      :enable-satellite="mapType === 'satellite'"
      :polyline="polylines"
      :markers="markers"
      @markertap="onMarkerTap"
    />

    <!-- Map Overlay Gradient -->
    <view class="map-overlay"></view>

    <!-- Glass Top Bar -->
    <header class="top-nav" :style="{ paddingTop: (12 + statusBarHeight) + 'px' }">
      <view class="nav-left">
        <image class="nav-avatar" :src="userAvatar" mode="aspectFill" />
        <view class="nav-location">
          <text class="nav-brand">{{ userNickname }}</text>
          <view class="location-row">
            <text class="loc-icon">📍</text>
            <text class="loc-text">{{ locationName }}</text>
          </view>
          <view class="weather-row" v-if="weather">
            <image class="weather-icon" :src="`https://a.hecdn.net/img/common/icon/202406d/${weather.icon}.png`" mode="widthFix" />
            <text class="weather-text">{{ weather.temp }}°C {{ weather.text }}</text>
          </view>
        </view>
      </view>
      <view class="nav-actions">
        <button class="nav-btn" @click="goInspiration"><text>💡</text></button>
      </view>
    </header>

    <!-- Right Side Map Controls -->
    <view class="map-controls">
      <view class="ctrl-group">
        <button :class="['ctrl-btn', mapType === 'standard' ? 'ctrl-active' : '']" @click="mapType = 'standard'">
          <text>🗺️</text>
        </button>
        <view class="ctrl-divider"></view>
        <button :class="['ctrl-btn', mapType === 'satellite' ? 'ctrl-active' : '']" @click="mapType = 'satellite'">
          <text>🛰️</text>
        </button>
      </view>
      <button class="ctrl-btn ctrl-locate" @click="getUserLocation">
        <text>📍</text>
      </button>
    </view>

    <!-- 行程生成中提示 -->
    <view v-if="travelStore.currentPlan?.isSkeleton" class="skeleton-banner" :style="{ bottom: (250 + safeAreaBottom) + 'px' }">
      <view class="skeleton-dot"></view>
      <text class="skeleton-text">行程详情正在生成中…</text>
    </view>

    <!-- 行程优化中提示 -->
    <view v-if="travelStore.loading && travelStore.currentPlan" class="skeleton-banner refine-banner" :style="{ bottom: (250 + safeAreaBottom) + 'px' }">
      <view class="skeleton-dot refine-dot"></view>
      <text class="skeleton-text">行程优化中，预计2-3分钟…</text>
    </view>

    <!-- Itinerary Quick Card -->
    <view class="quick-card-wrapper" v-if="hasPlan && !quickCardHidden" :style="{ bottom: quickCardBottom + 'px', transition: quickCardDragging ? 'none' : 'bottom 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }">
      <view class="quick-card" @touchstart="onQuickCardTouchStart" @touchmove="onQuickCardTouchMove" @touchend="onQuickCardTouchEnd">
        <view class="quick-card-inner">
          <image class="quick-img" :src="currentQuickItem.image || planImage" mode="aspectFill" />
          <view class="quick-info">
            <view class="quick-tags">
              <text class="quick-tag">{{ planStatus }}</text>
              <text class="quick-day">Day {{ currentQuickItem.day || currentDay }} / {{ totalDays }}</text>
            </view>
            <text class="quick-title">{{ currentQuickItem.name || planTitle }}</text>
            <text class="quick-desc" v-if="currentQuickItem.description">{{ currentQuickItem.description }}</text>
            <text class="quick-next" v-else>下一个：{{ nextStop }} · {{ nextDist }}</text>
          </view>
          <button class="quick-arrow" @click="goPlan">
            <text>→</text>
          </button>
        </view>
        <view class="quick-card-dots" v-if="quickCardItems.length > 1">
          <view v-for="(item, index) in quickCardItems" :key="index" :class="['quick-dot', index === quickCardIndex ? 'quick-dot-active' : '']"></view>
        </view>
      </view>
      <button class="quick-card-hide" @click="hideQuickCard">
        <text>×</text>
      </button>
    </view>
    <!-- Hidden Quick Card Indicator -->
    <button class="quick-card-show" v-if="hasPlan && quickCardHidden" @click="showQuickCard" :style="{ bottom: (180 + safeAreaBottom) + 'px' }">
      <text>📍</text>
      <text class="show-text">显示行程</text>
    </button>

    <!-- Floating 行程一下 Butler -->
    <button v-if="false" class="ai-butler" @click="goInspiration" :style="{ bottom: (136 + safeAreaBottom) + 'px' }">
      <text class="ai-icon">✨</text>
      <text class="ai-text">快来生成你得专属攻略吧</text>
    </button>

    <!-- Detail Bottom Sheet -->
    <view v-if="showDetail" class="sheet-overlay" @click="closeDetail">
      <view class="sheet-container" @click.stop @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
        <!-- Modal Handle -->
        <view class="sheet-handle"></view>
        <!-- Swipe Indicator -->
        <view class="sheet-swipe-indicator" v-if="markers.length > 1">
          <text class="swipe-arrow">‹</text>
          <text class="swipe-text">滑动切换景点</text>
          <text class="swipe-arrow">›</text>
        </view>
        <!-- Card Header -->
        <view class="sheet-header">
          <view class="sheet-day-badge">Day {{ selectedMarker.day }}</view>
          <text class="sheet-title">{{ selectedMarker.name }}</text>
        </view>
        <!-- Content Body -->
        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-row">
            <view class="sheet-icon-wrap">
              <view class="sheet-icon-img icon-clock"></view>
            </view>
            <view class="sheet-info">
              <text class="sheet-label">时间</text>
              <text class="sheet-value">{{ selectedMarker.time || '待定' }}</text>
            </view>
          </view>
          <view class="sheet-row" v-if="selectedMarker.city">
            <view class="sheet-icon-wrap">
              <view class="sheet-icon-img icon-location"></view>
            </view>
            <view class="sheet-info">
              <text class="sheet-label">位置</text>
              <text class="sheet-value">{{ selectedMarker.city }}</text>
            </view>
          </view>
          <view class="sheet-row" v-if="selectedMarker.weather_icon">
            <view class="sheet-icon-wrap">
              <view class="sheet-icon-img icon-weather"></view>
            </view>
            <view class="sheet-info">
              <text class="sheet-label">天气</text>
              <text class="sheet-value">{{ selectedMarker.weather_icon }} {{ selectedMarker.temperature }}</text>
            </view>
          </view>
          <view class="sheet-row sheet-desc-row" v-if="selectedMarker.description">
            <view class="sheet-icon-wrap">
              <view class="sheet-icon-img icon-book"></view>
            </view>
            <view class="sheet-info">
              <text class="sheet-label">介绍</text>
              <text class="sheet-value sheet-desc-text">{{ selectedMarker.description }}</text>
            </view>
          </view>
        </scroll-view>
        <!-- Action Footer -->
        <view class="sheet-footer">
          <button class="sheet-btn-nav" @click="openNavigation">
            <view class="sheet-icon-img icon-navigate"></view>
            <span>去导航</span>
          </button>
          <button class="sheet-btn-hide" @click="closeDetail">
            <text>✕</text>
            <text>隐藏</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { useTravelStore } from '@/store/travel.js'
import { useUserStore } from '@/store/user.js'
import { computed } from 'vue'
import { getWeatherNow } from '@/api/weather.js'
import { useSafeArea } from '@/utils/safeArea.js'
import { themeClass } from '@/utils/theme.js'


export default {
  data() {
    return {
      center: [34.3416, 108.9398],
      zoom: 12,
      mapType: 'standard',
      markers: [],
      polylines: [],
      showDetail: false,
      selectedMarker: {},
      currentMarkerIndex: 0,
      quickCardHidden: false,
      quickCardIndex: 0,
      quickCardBottom: 180,
      quickCardDragY: 0,
      quickCardBottomStart: 180,
      quickCardDragging: false,
      quickCardTouchStartX: 0,
      quickCardTouchStartY: 0,
      userLocation: null,
      locationName: '获取位置中...',
      weather: null,
      _locating: false,
      statusBarHeight: 0,
      safeAreaBottom: 0
    }
  },
  computed: {
    travelStore() { return useTravelStore() },
    userStore() { return useUserStore() },
    userAvatar() {
      return this.userStore.avatarUrl || 'https://ui-avatars.com/api/?name=行程一下&background=0F4C5C&color=fff&size=64'
    },
    userNickname() {
      return this.userStore.nickname || '行程一下'
    },
    themeClass() { return themeClass.value },
    hasPlan() {
      return !!(this.travelStore.currentPlan && this.travelStore.currentPlan.dayPlanItinerary?.length)
    },
    planTitle() {
      const plan = this.travelStore.currentPlan
      return plan?.itinerarySummary?.substring(0, 20) || '深度探索'
    },
    planStatus() { return '进行中' },
    totalDays() {
      const plan = this.travelStore.currentPlan
      if (!plan?.dayPlanItinerary) return 3
      const days = new Set(plan.dayPlanItinerary.map(i => i.day))
      return days.size || 3
    },
    currentDay() { return 1 },
    nextStop() {
      const items = this.travelStore.currentPlan?.dayPlanItinerary
      if (items?.length > 1) return items[1]?.name || '下一站'
      return '目的地'
    },
    nextDist() { return '1.2km' },
    planImage() {
      return 'https://tonystark-ai.ccwu.cc/png/8c8c5e70-c661-4658-a1cf-a732fec20c4f.png'
    },
    quickCardItems() {
      const plan = this.travelStore.currentPlan
      if (!plan?.dayPlanItinerary?.length) return []
      return plan.dayPlanItinerary.filter(item => item.lat && item.lng).map((item, index) => ({
        ...item,
        id: index
      }))
    },
    currentQuickItem() {
      if (this.quickCardItems.length === 0) return {}
      return this.quickCardItems[this.quickCardIndex] || this.quickCardItems[0]
    }
  },
  methods: {
    checkLocationAuth() {
      return new Promise((resolve) => {
        uni.getSetting({
          success: (res) => {
            if (res.authSetting['scope.userLocation']) {
              resolve(true)
            } else {
              uni.authorize({
                scope: 'scope.userLocation',
                success: () => resolve(true),
                fail: () => {
                  uni.showModal({
                    title: '需要位置权限',
                    content: '行程一下需要获取您的位置信息来在地图上展示附近景点和导航路线',
                    confirmText: '去设置',
                    success: (modal) => {
                      if (modal.confirm) {
                        uni.openSetting({
                          success: (s) => resolve(!!s.authSetting['scope.userLocation'])
                        })
                      } else {
                        resolve(false)
                      }
                    }
                  })
                }
              })
            }
          },
          fail: () => resolve(false)
        })
      })
    },
    getUserLocation() {
      return new Promise((resolve) => {
        if (!this._locating) {
          this._locating = true
          this.checkLocationAuth().then((authorized) => {
            if (!authorized) {
              this._locating = false
              uni.showToast({ title: '定位未授权，显示默认地图', icon: 'none' })
              resolve(false)
              return
            }
            uni.getLocation({
              type: 'gcj02', isHighAccuracy: true, highAccuracyExpireTime: 4000,
              success: (res) => {
                this._locating = false
                this.userLocation = { latitude: res.latitude, longitude: res.longitude }
                this.center = [res.latitude, res.longitude]
                this.zoom = 15
                this.fetchWeather(res.latitude, res.longitude)
                if (res.address) {
                  this.locationName = res.address.replace(/^中国/, '').trim()
                } else {
                  this.reverseGeocode(res.latitude, res.longitude)
                }
                resolve(true)
              },
              fail: (err) => {
                this._locating = false
                console.error('getLocation失败:', err)
                uni.showToast({ title: '定位失败，使用默认位置', icon: 'none' })
                resolve(false)
              }
            })
          })
        }
      })
    },
    reverseGeocode(lat, lng) {
      this.locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      uni.request({
        url: `https://5555api.com/data/api/reverseGeocoder?longitude=${lng}&latitude=${lat}&apikey=test_app_key_5555api.com`,
        success: (res) => {
          const body = res.data
          console.log('[Geo] 5555api 响应:', JSON.stringify(body))
          const inner = body?.data?.data?.data
          if (inner && inner.city) {
            const city = inner.city || ''
            const district = inner.district || ''
            this.locationName = district ? `${city} · ${district}` : (city || inner.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
            console.log('[Geo] ✅ 5555api 解析成功:', this.locationName)
          } else {
            console.warn('[Geo] 5555api 解析失败，body:', JSON.stringify(body), 'inner:', inner)
          }
        },
        fail: (err) => {
          console.error('[Geo] 5555api 请求失败:', err)
        }
      })
    },
    loadFromStore() {
      const plan = this.travelStore.currentPlan
      if (!plan?.dayPlanItinerary?.length) return
      const itinerary = plan.dayPlanItinerary
      const DAY_CODES = ['#6366f1', '#4ECDC4', '#45B7D1', '#FFA07A', '#98FB98', '#DDA0DD']
      const getDayColor = (day) => DAY_CODES[(day - 1) % DAY_CODES.length]
      const newMarkers = []
      const pointsByDay = {}

      itinerary.forEach((item, index) => {
        if (item.lat && item.lng) {
          const lat = parseFloat(item.lat); const lng = parseFloat(item.lng)
          if (isNaN(lat) || isNaN(lng)) return
          const dayColor = getDayColor(item.day || 1)
          newMarkers.push({
            id: index, latitude: lat, longitude: lng,
            title: item.name || '未知地点',
            iconPath: '/static/images/marker-icon.png',
            width: 36, height: 36, anchor: { x: 0.5, y: 1 },
            callout: {
              content: item.name || '', display: 'BYCLICK',
              padding: 10, borderRadius: 12, fontSize: 13,
              bgColor: dayColor, color: '#ffffff', borderWidth: 2, borderColor: '#ffffff'
            },
            label: {
              content: `Day ${item.day || 1}`, color: dayColor,
              fontSize: 11, fontWeight: 'bold', bgColor: '#ffffff',
              padding: 4, anchorX: 0, anchorY: -40, display: 'ALWAYS'
            },
            detail: {
              day: item.day || 1, dayColor, name: item.name, time: item.time,
              city: item.city, description: item.description,
              transit_hint: item.transit_hint, visit_duration: item.visit_duration,
              weather_icon: item.weather_icon, temperature: item.temperature,
              latitude: lat, longitude: lng
            }
          })
          const day = item.day || 1
          if (!pointsByDay[day]) pointsByDay[day] = []
          pointsByDay[day].push({ latitude: lat, longitude: lng })
        }
      })

      if (newMarkers.length > 0) {
        this.markers = newMarkers
        const newPolylines = []
        Object.keys(pointsByDay).forEach(day => {
          if (pointsByDay[day].length > 1) {
            newPolylines.push({
              points: pointsByDay[day],
              color: getDayColor(parseInt(day)), width: 5
            })
          }
        })
        this.polylines = newPolylines
        this.center = [newMarkers[0].latitude, newMarkers[0].longitude]
        this.zoom = 14
      }
    },
    goInspiration() { uni.navigateTo({ url: '/pages/inspiration/index' }) },
    goInspiration() { uni.navigateTo({ url: '/pages/inspiration/index' }) },
    goPlan() { uni.navigateTo({ url: '/pages/ai-plan-detail/index' }) },
    goMine() { uni.navigateTo({ url: '/pages/mine/index' }) },
    // Quick Card 滑动切换方法
    onQuickCardTouchStart(e) {
      const touch = e.touches[0]
      this.quickCardTouchStartX = touch.clientX
      this.quickCardTouchStartY = touch.clientY
      this.quickCardDragging = false
      this.quickCardDragY = touch.clientY
      this.quickCardBottomStart = this.quickCardBottom
    },
    onQuickCardTouchMove(e) {
      if (e.touches.length > 1) return
      const touch = e.touches[0]
      const deltaX = touch.clientX - this.quickCardTouchStartX
      const deltaY = touch.clientY - this.quickCardTouchStartY
      
      // 垂直拖动 → 移动卡片
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 4) {
        this.quickCardDragging = true
        const newBottom = this.quickCardBottomStart - deltaY
        // 限制范围：top 20px ~ bottom -40px
        const viewH = uni.getSystemInfoSync().safeArea.bottom
        this.quickCardBottom = Math.max(-20, Math.min(viewH - 40, newBottom))
      }
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        e.preventDefault()
      }
    },
    onQuickCardTouchEnd(e) {
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - this.quickCardTouchStartX
      const deltaY = touch.clientY - this.quickCardTouchStartY
      
      this.quickCardDragging = false
      
      // 垂直拖动松手 → 超出屏幕底部就隐藏
      if (Math.abs(deltaY) > 5 && Math.abs(deltaY) > Math.abs(deltaX)) {
        const viewH = uni.getSystemInfoSync().safeArea.bottom
        if (this.quickCardBottom > viewH * 0.7) {
          this.hideQuickCard()
          this.quickCardBottom = 180 + this.safeAreaBottom
        }
        return
      }
      
      if (Math.abs(deltaX) > 30 && Math.abs(deltaY) < 50) {
        if (deltaX > 50) {
          this.switchQuickCard(this.quickCardIndex - 1)
        } else if (deltaX < -50) {
          this.switchQuickCard(this.quickCardIndex + 1)
        }
      }
    },
    switchQuickCard(index) {
      if (index < 0) index = this.quickCardItems.length - 1
      if (index >= this.quickCardItems.length) index = 0
      this.quickCardIndex = index
      
      // 聚焦到对应的标记点
      const item = this.quickCardItems[index]
      if (item && item.lat && item.lng) {
        this.center = [parseFloat(item.lat), parseFloat(item.lng)]
        this.zoom = 15
      }
    },
    hideQuickCard() {
      this.quickCardHidden = true
    },
    showQuickCard() {
      this.quickCardBottom = 180 + this.safeAreaBottom
      this.quickCardHidden = false
    },
    onMarkerTap(e) {
      const marker = this.markers.find(m => m.id === e.detail.markerId)
      if (marker?.detail) { 
        this.selectedMarker = marker.detail;
        // 找到当前 marker 的索引
        const index = this.markers.findIndex(m => m.id === e.detail.markerId);
        if (index !== -1) {
          this.currentMarkerIndex = index;
        }
        this.showDetail = true 
      }
    },
    onTouchStart(e) {
      const touch = e.touches[0]
      this.touchStartX = touch.clientX
      this.touchStartY = touch.clientY
      this.touchStartTime = Date.now()
    },
    onTouchMove(e) {
      if (e.touches.length > 1) return
      
      const touch = e.touches[0]
      const deltaX = touch.clientX - this.touchStartX
      const deltaY = touch.clientY - this.touchStartY
      
      // 水平滑动距离大于垂直滑动距离时才处理
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        e.preventDefault() // 阻止默认滚动行为
      }
    },
    onTouchEnd(e) {
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - this.touchStartX
      const deltaY = touch.clientY - this.touchStartY
      const deltaTime = Date.now() - this.touchStartTime
      
      // 检查是否为有效滑动手势
      if (Math.abs(deltaX) > 30 && Math.abs(deltaY) < 50 && deltaTime < 500) {
        if (deltaX > 50) {
          // 向右滑动，切换到上一个
          this.switchToMarker(this.currentMarkerIndex - 1)
        } else if (deltaX < -50) {
          // 向左滑动，切换到下一个
          this.switchToMarker(this.currentMarkerIndex + 1)
        }
      }
    },
    switchToMarker(index) {
      if (index < 0) index = this.markers.length - 1
      if (index >= this.markers.length) index = 0
      
      if (this.markers[index]) {
        this.selectedMarker = this.markers[index].detail
        this.currentMarkerIndex = index
        
        // 聚焦到新的标记点
        this.center = [this.markers[index].latitude, this.markers[index].longitude]
        this.zoom = 15
      }
    },
    closeDetail() { this.showDetail = false },
    openNavigation() {
      const m = this.selectedMarker
      if (!m || !m.latitude || !m.longitude) {
        uni.showToast({ title: '该地点暂无坐标信息', icon: 'none' })
        return
      }
      uni.openLocation({
        latitude: parseFloat(m.latitude),
        longitude: parseFloat(m.longitude),
        name: m.name || '目的地',
        address: m.city || '',
        scale: 16
      })
    },
    async fetchWeather(lat, lng) {
      const CACHE_KEY = 'weather_cache'
      const CACHE_TTL = 30 * 60 * 1000
      const cached = uni.getStorageSync(CACHE_KEY)
      if (cached) {
        try {
          const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
          if (parsed.lat === lat && parsed.lng === lng && Date.now() - parsed.timestamp < CACHE_TTL) {
            this.weather = parsed.data
            return
          }
        } catch (e) {}
      }
      try {
        const res = await getWeatherNow(lng, lat)
        if (res.code === 0) {
          this.weather = res.data
          uni.setStorageSync(CACHE_KEY, { data: res.data, lat, lng, timestamp: Date.now() })
        }
      } catch (e) {
        console.error('获取天气失败:', e)
      }
    }
  },
  onLoad() {
    const { statusBarHeight, safeAreaBottom } = useSafeArea()
    this.statusBarHeight = statusBarHeight
    this.safeAreaBottom = safeAreaBottom
    this.quickCardBottom = 180 + safeAreaBottom
    this.userStore.restoreFromStorage()
    this.getUserLocation().then(() => this.loadFromStore())
    wx.showShareMenu({
      withShareTicket: false,  // 是否带 shareTicket（用于群聊信息）
      menus: ['shareAppMessage', 'shareTimeline'],  // 显示两个分享按钮
      success: () => {
        console.log('分享菜单设置成功')
      },
      fail: (err) => {
        console.error('设置失败:', err)
      }
    })
  },
  onShow() {
    this.userStore.restoreFromStorage()
    this.loadFromStore()
    if (this.userLocation) {
      this.fetchWeather(this.userLocation.latitude, this.userLocation.longitude)
    }
  }
}
</script>

<style scoped>
.map-page { flex: 1; height: 100vh; position: relative; background: #f8f9fa; }
.map-container { width: 100%; height: 100%; }
.map-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.05), transparent, rgba(0,0,0,0.1));
  pointer-events: none; z-index: 1;
}

.top-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 24rpx 48rpx 24rpx;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-bottom: 1px solid rgba(255,255,255,0.5);
}
.nav-left { display: flex; align-items: center; gap: 16px; }
.nav-avatar { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.nav-brand { font-size: 24px; font-weight: 700; color: var(--color-primary); letter-spacing: -0.01em; line-height: 32px; }
.location-row { display: flex; align-items: center; gap: 4px; margin-top: 0; }
.loc-icon { font-size: 14px; }
.loc-text { font-size: 12px; font-weight: 500; letter-spacing: 0.05em; color: var(--color-on-surface-variant); }
.weather-row { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.weather-icon { width: 18px; height: 18px; }
.weather-text { font-size: 12px; font-weight: 500; color: var(--color-on-surface-variant); }
.nav-actions { display: flex; gap: 12px; }
.nav-btn {
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255,255,255,0.75); backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.nav-btn::after { border: none; }

.map-controls {
  position: fixed; right: 48rpx; top: 112px; z-index: 10;
  display: flex; flex-direction: column; gap: 24px;
}
.ctrl-group {
  display: flex; flex-direction: column;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-radius: 20px; padding: 6px; overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
.ctrl-btn {
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; border-radius: 14px;
  color: var(--color-on-surface-variant);
}
.ctrl-active { background: var(--color-primary-container); color: var(--color-on-primary-container); }
.ctrl-divider { width: 32px; height: 1px; margin: 4px auto; background: var(--color-outline-variant); opacity: 0.3; }
.ctrl-locate {
  background: rgba(255,255,255,0.7); backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-radius: 50%; box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}

.quick-card-wrapper {
  position: fixed; left: 48rpx; right: 48rpx; z-index: 10;
  max-width: 360px; margin: 0 auto;
  display: flex; align-items: flex-start; gap: 8px;
}
.skeleton-banner {
  position: fixed; left: 48rpx; right: 48rpx; z-index: 11;
  max-width: 360px; margin: 0 auto;
  display: flex; align-items: center; gap: 12rpx;
  padding: 18rpx 28rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, rgba(15,76,92,0.92), rgba(20,184,166,0.92));
  color: #fff; font-size: 12px;
  box-shadow: 0 4rpx 16rpx rgba(15,76,92,0.25);
}
.skeleton-banner.refine-banner {
  background: linear-gradient(90deg, rgba(245,158,11,0.92), rgba(251,191,36,0.92));
  box-shadow: 0 4rpx 16rpx rgba(245,158,11,0.25);
}
.skeleton-dot {
  width: 12rpx; height: 12rpx; border-radius: 50%;
  background: #fff;
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}
.skeleton-dot.refine-dot {
  animation: refine-spin 1s linear infinite;
  border-radius: 0;
  width: 14rpx; height: 14rpx;
  border: 2rpx solid transparent;
  border-top-color: #fff;
  border-right-color: #fff;
  background: transparent;
}
.skeleton-text { font-weight: 500; }
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
@keyframes refine-spin {
  to { transform: rotate(360deg); }
}
.quick-card {
  flex: 1;
  background: rgba(255,255,255,0.7); backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 28px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  overflow: hidden;
}
.quick-card-inner {
  display: flex; align-items: center; gap: 40rpx;
  padding: 40rpx;
}
.quick-img {
  width: 96px; height: 96px; border-radius: 16px; flex-shrink: 0;
}
.quick-info { flex: 1; min-width: 0; }
.quick-tags { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.quick-tag {
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
  color: var(--color-primary);
  background: rgba(15,76,92,0.1); padding: 2px 10px; border-radius: 999px;
}
.quick-day { font-size: 12px; font-weight: 500; letter-spacing: 0.05em; color: var(--color-on-surface-variant); }
.quick-title {
  font-size: 20px; font-weight: 700; color: var(--color-primary);
  line-height: 28px; margin-bottom: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.quick-desc {
  font-size: 13px; color: var(--color-on-surface-variant);
  line-height: 1.4;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.quick-next { font-size: 14px; color: var(--color-on-surface-variant); font-weight: 500; }
.quick-arrow {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 50%, #2DD4BF 100%);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; font-weight: 700;
  flex-shrink: 0;
}
.quick-card-dots {
  display: flex; justify-content: center; gap: 6px;
  padding: 8px 0 12px;
}
.quick-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-outline-variant);
  transition: all 0.3s;
}
.quick-dot-active {
  background: var(--color-primary);
  width: 20px; border-radius: 10px;
}
.quick-card-hide {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255,255,255,0.8); backdrop-filter: blur(20px);
  display: flex; align-items: center; justify-content: center;
  color: var(--color-on-surface-variant); font-size: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  flex-shrink: 0;
}
.quick-card-show {
  position: fixed; left: 48rpx; z-index: 10;
  display: flex; align-items: center; gap: 8px;
  padding: 24rpx 40rpx;
  background: rgba(255,255,255,0.8); backdrop-filter: blur(30px);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  color: var(--color-primary); font-size: 14px; font-weight: 600;
}
.show-text { font-size: 14px; }

.ai-butler {
  position: fixed; right: 48rpx; bottom: 136px; z-index: 10;
  display: flex; align-items: center; gap: 12px;
  padding: 32rpx 40rpx;
  background: linear-gradient(135deg, #0F4C5C 0%, #14B8A6 50%, #2DD4BF 100%);
  border-radius: 22px 22px 22px 4px;
  box-shadow: 0 8px 24px rgba(15,76,92,0.2);
  color: #fff; border: 1px solid rgba(255,255,255,0.2);
}
.ai-icon { font-size: 22px; }
.ai-text { font-size: 14px; font-weight: 600; line-height: 22px; white-space: nowrap; }

.sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(6px);
  display: flex; align-items: flex-end;
}
.sheet-container {
  width: 100%; height: 85%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 32px 32px 0 0;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.sheet-handle {
  width: 36px; height: 5px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2.5px;
  margin: 12px auto;
  flex-shrink: 0;
}
.sheet-swipe-indicator {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 0 0 8px; flex-shrink: 0;
}
.swipe-arrow {
  font-size: 14px; color: var(--color-on-surface-variant); opacity: 0.4;
  line-height: 1;
}
.swipe-text {
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--color-on-surface-variant); opacity: 0.6;
}
.sheet-header {
  padding: 8px 24px 12px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.sheet-day-badge {
  align-self: flex-start;
  background: rgba(26,35,126,0.08);
  padding: 4px 14px; border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: #0F4C5C;
}
.sheet-title {
  font-size: 28px; font-weight: 700; color: #0F4C5C;
  letter-spacing: -0.02em; line-height: 36px;
}
.sheet-body {
  flex: 1; overflow-y: auto; padding: 8px 24px 16px;
}
.sheet-row {
  display: flex; gap: 16px; padding: 16px 0;
  border-bottom: 1px solid rgba(198,197,212,0.15);
}
.sheet-row:first-child { padding-top: 8px; }
.sheet-row:last-child { border-bottom: none; }
.sheet-icon-wrap {
  width: 36px; height: 36px; border-radius: 8px;
  background: rgba(26,35,126,0.05);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sheet-icon-img {
  width: 18px; height: 18px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.icon-clock {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a237e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E");
}
.icon-location {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a237e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'/%3E%3Cpath d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'/%3E%3C/svg%3E");
}
.icon-weather {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a237e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z'/%3E%3C/svg%3E");
}
.icon-book {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a237e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'/%3E%3C/svg%3E");
}
.icon-navigate {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6L12 18M12 6L8 10M12 6L16 10'/%3E%3C/svg%3E");
}
.sheet-info { flex: 1; display: flex; flex-direction: column; gap: 2px; justify-content: center; }
.sheet-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-outline); text-transform: uppercase;
}
.sheet-value { font-size: 14px; font-weight: 500; color: var(--color-on-surface); line-height: 1.5; }
.sheet-desc-row { align-items: flex-start; }
.sheet-desc-text { line-height: 1.6; font-size: 13px; color: var(--color-on-surface-variant); }
.sheet-footer {
  padding: 16px 24px; flex-shrink: 0;
  background: rgba(255,255,255,0.5); backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255,255,255,0.4);
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
}
.sheet-btn-nav {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: #0F4C5C; color: #fff;
  padding: 16px 10px; border-radius: 999px;
  font-size: 17px; font-weight: 700;
  box-shadow: 0 4px 14px 0 rgba(26, 35, 126, 0.39);
  transition: all 0.15s;
}
.sheet-btn-nav:active { transform: scale(0.95); }
.sheet-btn-nav .icon-navigate { width: 20px; height: 20px; }
.sheet-btn-hide {
  display: flex; align-items: center; gap: 4px;
  color: var(--color-outline); font-weight: 500; font-size: 14px;
  padding: 12px 8px; flex-shrink: 0;
}
.sheet-btn-hide:active { opacity: 0.6; }
</style>
