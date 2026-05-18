<template>
  <view class="map-page">
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
          <text class="nav-brand">慧游</text>
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
        <button class="nav-btn"><text>🔍</text></button>
        <button class="nav-btn"><text>🔔</text></button>
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

    <!-- Itinerary Quick Card -->
    <view class="quick-card" v-if="hasPlan" :style="{ bottom: (180 + safeAreaBottom) + 'px' }">
      <view class="quick-card-inner">
        <image class="quick-img" :src="planImage" mode="aspectFill" />
        <view class="quick-info">
          <view class="quick-tags">
            <text class="quick-tag">{{ planStatus }}</text>
            <text class="quick-day">Day {{ currentDay }} / {{ totalDays }}</text>
          </view>
          <text class="quick-title">{{ planTitle }}</text>
          <text class="quick-next">下一个：{{ nextStop }} · {{ nextDist }}</text>
        </view>
        <button class="quick-arrow" @click="goPlan">
          <text>→</text>
        </button>
      </view>
    </view>

    <!-- Floating AI Butler -->
    <button class="ai-butler" @click="goExplore" :style="{ bottom: (136 + safeAreaBottom) + 'px' }">
      <text class="ai-icon">✨</text>
      <text class="ai-text">为您推荐附近的百年书屋</text>
    </button>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav" :style="{ bottom: (32 + safeAreaBottom) + 'px' }">
      <button :class="['nav-item', 'nav-active']" @click="goExplore">
        <text class="nav-item-icon">🧭</text>
        <text class="nav-item-label">探索</text>
      </button>
      <button class="nav-item" @click="goPlan">
        <text class="nav-item-icon">📅</text>
        <text class="nav-item-label">行程</text>
      </button>
      <button class="nav-item" @click="goMine">
        <text class="nav-item-icon">👤</text>
        <text class="nav-item-label">我的</text>
      </button>
    </nav>

    <!-- Detail Bottom Sheet -->
    <view v-if="showDetail" class="sheet-overlay" @click="closeDetail">
      <view class="sheet-container" @click.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-header" :style="{ background: `linear-gradient(135deg, ${selectedMarker.dayColor || '#000666'}, ${selectedMarker.dayColor ? selectedMarker.dayColor + 'cc' : '#1a237e'})` }">
          <view class="sheet-day-badge">Day {{ selectedMarker.day }}</view>
          <text class="sheet-title">{{ selectedMarker.name }}</text>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-row">
            <view class="sheet-icon-wrap"><text class="sheet-icon">📅</text></view>
            <view class="sheet-info">
              <text class="sheet-label">时间</text>
              <text class="sheet-value">{{ selectedMarker.time || '待定' }}</text>
            </view>
          </view>
          <view v-if="selectedMarker.city" class="sheet-row">
            <view class="sheet-icon-wrap"><text class="sheet-icon">📍</text></view>
            <view class="sheet-info">
              <text class="sheet-label">位置</text>
              <text class="sheet-value">{{ selectedMarker.city }}</text>
            </view>
          </view>
          <view v-if="selectedMarker.weather_icon" class="sheet-row">
            <view class="sheet-icon-wrap"><text class="sheet-icon">🌤️</text></view>
            <view class="sheet-info">
              <text class="sheet-label">天气</text>
              <text class="sheet-value">{{ selectedMarker.weather_icon }} {{ selectedMarker.temperature }}</text>
            </view>
          </view>
          <view v-if="selectedMarker.description" class="sheet-row sheet-desc">
            <view class="sheet-icon-wrap"><text class="sheet-icon">📖</text></view>
            <view class="sheet-info">
              <text class="sheet-label">介绍</text>
              <text class="sheet-value sheet-desc-text">{{ selectedMarker.description }}</text>
            </view>
          </view>
          <view v-if="selectedMarker.transit_hint" class="sheet-row">
            <view class="sheet-icon-wrap"><text class="sheet-icon">🚗</text></view>
            <view class="sheet-info">
              <text class="sheet-label">交通建议</text>
              <text class="sheet-value">{{ selectedMarker.transit_hint }}</text>
            </view>
          </view>
          <view v-if="selectedMarker.visit_duration" class="sheet-row">
            <view class="sheet-icon-wrap"><text class="sheet-icon">⏱️</text></view>
            <view class="sheet-info">
              <text class="sheet-label">游玩时长</text>
              <text class="sheet-value">{{ selectedMarker.visit_duration }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="sheet-footer">
          <button class="sheet-btn sheet-btn-primary" @click="closeDetail">关闭</button>
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
      return this.userStore.avatarUrl || 'https://ui-avatars.com/api/?name=慧游&background=1a237e&color=fff&size=64'
    },
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
                    content: '慧游需要获取您的位置信息来在地图上展示附近景点和导航路线',
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
              weather_icon: item.weather_icon, temperature: item.temperature
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
    goExplore() { uni.navigateTo({ url: '/pages/explore/index' }) },
    goPlan() { uni.navigateTo({ url: '/pages/plan/plan' }) },
    goMine() { uni.navigateTo({ url: '/pages/mine/index' }) },
    onMarkerTap(e) {
      const marker = this.markers.find(m => m.id === e.detail.markerId)
      if (marker?.detail) { this.selectedMarker = marker.detail; this.showDetail = true }
    },
    closeDetail() { this.showDetail = false },
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
    this.userStore.restoreFromStorage()
    this.getUserLocation().then(() => this.loadFromStore())
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
.map-page { flex: 1; height: 100vh; position: relative; background: var(--color-surface); }
.map-container { width: 100%; height: 100%; }
.map-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.05), transparent, rgba(0,0,0,0.1));
  pointer-events: none; z-index: 1;
}

.top-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px 12px;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
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

.map-controls {
  position: fixed; right: 24px; top: 112px; z-index: 10;
  display: flex; flex-direction: column; gap: 24px;
}
.ctrl-group {
  display: flex; flex-direction: column;
  background: rgba(255,255,255,0.75); backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
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
  background: rgba(255,255,255,0.75); backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 50%; box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}

.quick-card {
  position: fixed; left: 24px; right: 24px; bottom: 180px; z-index: 10;
  max-width: 360px; margin: 0 auto;
}
.quick-card-inner {
  background: rgba(255,255,255,0.75); backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 28px; padding: 20px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  display: flex; align-items: center; gap: 20px;
}
.quick-img {
  width: 96px; height: 96px; border-radius: 16px; flex-shrink: 0;
}
.quick-info { flex: 1; }
.quick-tags { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.quick-tag {
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
  color: var(--color-primary);
  background: rgba(0,6,102,0.1); padding: 2px 10px; border-radius: 999px;
}
.quick-day { font-size: 12px; font-weight: 500; letter-spacing: 0.05em; color: var(--color-on-surface-variant); }
.quick-title {
  font-size: 20px; font-weight: 700; color: var(--color-primary);
  line-height: 28px; margin-bottom: 4px;
}
.quick-next { font-size: 14px; color: var(--color-on-surface-variant); font-weight: 500; }
.quick-arrow {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg, #1a237e 0%, #4c56af 50%, #6366f1 100%);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; font-weight: 700;
}

.ai-butler {
  position: fixed; right: 24px; bottom: 136px; z-index: 10;
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #1a237e 0%, #4c56af 50%, #6366f1 100%);
  border-radius: 22px 22px 22px 4px;
  box-shadow: 0 8px 24px rgba(0,6,102,0.2);
  color: #fff; border: 1px solid rgba(255,255,255,0.2);
}
.ai-icon { font-size: 22px; }
.ai-text { font-size: 14px; font-weight: 600; line-height: 22px; white-space: nowrap; }

.bottom-nav {
  position: fixed; left: 24px; right: 24px; z-index: 10;
  display: flex; align-items: center; justify-content: space-around;
  height: 72px; padding: 0 8px;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 999px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 8px 24px; border-radius: 999px;
  color: var(--color-on-surface-variant); opacity: 0.6;
}
.nav-active {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container); opacity: 1;
  box-shadow: 0 4px 12px rgba(0,6,102,0.15);
}
.nav-item-icon { font-size: 22px; margin-bottom: 2px; }
.nav-item-label { font-size: 10px; font-weight: 700; letter-spacing: 0.02em; }

.sheet-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(6px);
  display: flex; align-items: flex-end;
}
.sheet-container {
  width: 100%; max-height: 78vh;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border-radius: 32px 32px 0 0;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.08);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.sheet-handle {
  width: 36px; height: 5px; border-radius: 999px;
  background: var(--color-outline-variant); opacity: 0.5;
  align-self: center; margin: 12px auto 4px;
}
.sheet-header {
  padding: 24px 24px 20px; color: #fff; position: relative;
  display: flex; flex-direction: column; gap: 12px;
}
.sheet-day-badge {
  align-self: flex-start;
  background: rgba(255,255,255,0.25); backdrop-filter: blur(8px);
  padding: 4px 14px; border-radius: 999px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
}
.sheet-title {
  font-size: 24px; font-weight: 700; line-height: 32px;
  letter-spacing: -0.01em;
}
.sheet-body { flex: 1; overflow-y: auto; padding: 16px 24px; }
.sheet-row {
  display: flex; gap: 16px; padding: 14px 0;
  border-bottom: 1px solid rgba(198,197,212,0.15);
}
.sheet-row:last-child { border-bottom: none; }
.sheet-icon-wrap {
  width: 40px; height: 40px; border-radius: 12px;
  background: var(--color-surface-container-low);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sheet-icon { font-size: 18px; }
.sheet-info { flex: 1; display: flex; flex-direction: column; gap: 4px; justify-content: center; }
.sheet-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
  color: var(--color-outline); text-transform: uppercase;
}
.sheet-value { font-size: 14px; font-weight: 500; color: var(--color-on-surface); line-height: 1.5; }
.sheet-desc { align-items: flex-start; }
.sheet-desc-text { line-height: 1.6; }
.sheet-footer {
  padding: 16px 24px 28px;
  border-top: 1px solid rgba(198,197,212,0.1);
}
.sheet-btn {
  width: 100%; height: 52px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 600;
}
.sheet-btn-primary {
  background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
  color: #fff; box-shadow: 0 8px 24px rgba(0,6,102,0.2);
}
.sheet-btn-primary:active { transform: scale(0.97); }
</style>
