<template>
  <view class="container">
    <!-- 地图 -->
    <map
      class="map-container"
      :longitude="center[1]"
      :latitude="center[0]"
      :scale="zoom"
      :show-location="true"
      :enable-zoom="true"
      :enable-scroll="true"
      :enable-rotate="false"
      :enable-satellite="mapType === 'satellite'"
      :polyline="polylines"
      :markers="markers"
      @markertap="onMarkerTap"
    />

    <!-- 底部导航 -->
    <view class="bottom-nav">
      <view class="nav-item" @click="goExplore">
        <text class="nav-icon">🧭</text>
        <text class="nav-label">探索</text>
      </view>
      <view class="nav-item" @click="goPlan">
        <text class="nav-icon">📅</text>
        <text class="nav-label">行程</text>
      </view>
      <view class="nav-item" @click="toggleMapType">
        <text class="nav-icon">{{ mapType === 'satellite' ? '🛰️' : '🗺️' }}</text>
        <text class="nav-label">{{ mapType === 'satellite' ? '卫星图' : '标准图' }}</text>
      </view>
      <view class="nav-item" @click="goHistory">
        <text class="nav-icon">🕐</text>
        <text class="nav-label">历史</text>
      </view>
      <view class="nav-item" @click="goMine">
        <text class="nav-icon">👤</text>
        <text class="nav-label">我的</text>
      </view>
    </view>

    <!-- 详情弹窗 -->
    <view v-if="showDetail" class="detail-modal" @click="closeDetail">
      <view class="modal-content" @click.stop>
        <view class="modal-header" :style="{ background: `linear-gradient(135deg, ${selectedMarker.dayColor}, ${selectedMarker.dayColor}cc)` }">
          <view class="header-content">
            <view class="day-tag">Day {{ selectedMarker.day }}</view>
            <text class="detail-title">{{ selectedMarker.name }}</text>
            <text v-if="selectedMarker.city" class="city-tag">{{ selectedMarker.city }}</text>
          </view>
          <view class="modal-close" @click="closeDetail">✕</view>
        </view>
        <scroll-view scroll-y class="modal-body">
          <view class="detail-row">
            <text class="detail-label">📅 时间</text>
            <text class="detail-value">{{ selectedMarker.time }}</text>
          </view>
          <view v-if="selectedMarker.weather_icon && selectedMarker.temperature" class="detail-row">
            <text class="detail-label">🌤️ 天气</text>
            <text class="detail-value">{{ selectedMarker.weather_icon }} {{ selectedMarker.temperature }}</text>
          </view>
          <view v-if="selectedMarker.description" class="detail-row">
            <text class="detail-label">📖 介绍</text>
            <text class="detail-value detail-desc">{{ selectedMarker.description }}</text>
          </view>
          <view v-if="selectedMarker.transit_hint" class="detail-row">
            <text class="detail-label">🚗 交通</text>
            <text class="detail-value">{{ selectedMarker.transit_hint }}</text>
          </view>
          <view v-if="selectedMarker.visit_duration" class="detail-row">
            <text class="detail-label">⏱️ 游玩时长</text>
            <text class="detail-value">{{ selectedMarker.visit_duration }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script>
// 在 uni-app 传统 script 中定义页面级生命周期
import { useTravelStore } from '@/store/travel.js'

export default {
  data() {
    return {
      // 地图状态
      center: [34.3416, 108.9398],
      zoom: 12,
      mapType: 'satellite',
      // 标记和路径  
      markers: [],
      polylines: [],
      // 弹窗状态
      showDetail: false,
      selectedMarker: {}
    }
  },
  
  computed: {
    travelStore() {
      return useTravelStore()
    }
  },
  
  methods: {
    // 从store加载数据
    loadFromStore() {
      console.log('[地图] 检查store中的行程数据')
      const plan = this.travelStore.currentPlan
      if (!plan || !plan.dayPlanItinerary || !Array.isArray(plan.dayPlanItinerary)) {
        console.log('[地图] 没有有效行程数据:', !!plan, plan && 'dayPlanItinerary' in plan ? plan.dayPlanItinerary.length : 'N/A')
        return
      }
      
      console.log('[地图] 发现行程数据，开始处理', plan.dayPlanItinerary.length)
      const itinerary = plan.dayPlanItinerary
      const newMarkers = []
      const pointsByDay = {}
      
      const DAY_CODES = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98FB98', '#DDA0DD', '#F0E68C', '#FF6347', '#BA55D3', '#9ACD32']
      const getDayColor = (day) => DAY_CODES[(day - 1) % DAY_CODES.length]

      itinerary.forEach((item, index) => {
        if (item.lat && item.lng) {
          const lat = parseFloat(item.lat)
          const lng = parseFloat(item.lng)
          if (!isNaN(lat) && !isNaN(lng)) {
            const dayColor = getDayColor(item.day || 1)

            // 为每个项目创建地图标记
            newMarkers.push({
              id: index,
              latitude: lat,
              longitude: lng,
              title: item.name || '未知地点',
              iconPath: '/static/images/marker-icon.png',  // 确保图标存在
              width: 32,
              height: 32,
              anchor: { x: 0.5, y: 1 },
              callout: {
                content: item.name || '未知地点',
                display: 'BYCLICK',
                padding: 8,
                borderRadius: 10,
                fontSize: 12,
                bgColor: dayColor,
                color: '#ffffff',
                textAlign: 'center',
                borderWidth: 2,
                borderColor: '#ffffff'
              },
              label: {
                content: `Day ${(item.day === undefined || item.day === null) ? 1 : item.day}`,
                color: dayColor,
                fontSize: 12,
                fontWeight: 'bold',
                borderRadius: 5,
                bgColor: '#ffffff',
                padding: 3,
                anchorX: 0,
                anchorY: -40,
                display: 'ALWAYS'
              },
              detail: { // 存储详细信息到标记中
                day: (item.day === undefined || item.day === null) ? 1 : item.day,
                dayColor: dayColor,
                name: item.name || '未知地点',
                time: item.time,
                city: item.city,
                description: item.description,
                transit_hint: item.transit_hint,
                visit_duration: item.visit_duration,
                weather_icon: item.weather_icon,
                temperature: item.temperature,
                lat: lat,
                lng: lng
              }
            })
            
            // 按天分组坐标点
            const day = (item.day === undefined || item.day === null) ? 1 : item.day
            if (!pointsByDay[day]) {
              pointsByDay[day] = []
            }
            pointsByDay[day].push({
              latitude: lat,
              longitude: lng
            })
          }
        }
      })

      // 更新地图标记
      if (newMarkers.length > 0) {
        this.markers = newMarkers
        
        // 创建每日路径连接线
        const newPolylines = []
        Object.keys(pointsByDay).forEach(day => {
          if (pointsByDay[day].length > 1) {
            const dayColor = getDayColor(parseInt(day))
            newPolylines.push({
              points: pointsByDay[day],
              color: dayColor,
              width: 5,
              dottedLine: false,
              arrowLine: false,
              borderColor: '#ffffff',
              borderWidth: 2
            })
          }
        })
        this.polylines = newPolylines
        
        // 更新地图中心和缩放级别到第一个标记点
        this.center = [newMarkers[0].latitude, newMarkers[0].longitude]
        this.zoom = 14
        
        console.log(`[地图] 成功加载 ${newMarkers.length} 个标记点和 ${newPolylines.length} 条路线`)
      } else {
        console.log('[地图] 未找到需要渲染的标记点')
        this.markers = []
        this.polylines = []
      }
    },
    
    // 页面导航函数
    goExplore() {
      uni.navigateTo({ url: '/pages/explore/index' })
    },

    goPlan() {
      uni.navigateTo({ url: '/pages/plan/plan' })
    },

    goHistory() {
      uni.navigateTo({ url: '/pages/history/index' })
    },

    goMine() {
      uni.navigateTo({ url: '/pages/mine/index' })
    },
    
    toggleMapType() {
      this.mapType = this.mapType === 'satellite' ? 'standard' : 'satellite'
      uni.showToast({
        title: this.mapType === 'satellite' ? '已切换卫星地图' : '已切换普通地图',
        icon: 'none'
      })
    },
    
    // 处理标记点击
    onMarkerTap(e) {
      const markerId = e.detail.markerId
      console.log(`标记被点击: ${markerId}`)
      const marker = this.markers.find(m => m.id === markerId)
      if (marker && marker.detail) {
        this.selectedMarker = marker.detail
        this.showDetail = true
        console.log(`显示标记详情: ${marker.title}`)
      }
    },
    
    // 关闭详情弹窗
    closeDetail() {
      this.showDetail = false
    }
  },
  
  // Uni-app 页面生命周期
  onLoad() {
    console.log('[地图页面] onLoad 生命周期')
    // 初始化地图数据
    this.loadFromStore()
  },
  
  onShow() {
    console.log('[地图页面] onShow 生命周期，重新加载数据')
    // 在每次页面显示时重新加载数据
    this.loadFromStore()
  }
}
</script>

<style>
.container {
  flex: 1;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.map-container {
  width: 100%;
  height: calc(100vh - 120rpx);
}

.bottom-nav {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: #fff;
  border-top: 1px solid #eee;
  padding: 10rpx 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.nav-icon {
  font-size: 40rpx;
  margin-bottom: 6rpx;
}

.nav-label {
  font-size: 24rpx;
  color: #666;
}

.nav-item.active .nav-label,
.nav-item.active .nav-icon {
  color: #46bd87;
}

.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fff;
  border-radius: 20rpx;
  margin: 20rpx;
  max-height: 80vh;
  width: 90%;
  overflow: hidden;
}

.modal-header {
  padding: 30rpx;
  color: white;
}

.header-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.day-tag {
  background-color: rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  margin-right: 16rpx;
  margin-bottom: 10rpx;
}

.detail-title {
  font-size: 36rpx;
  font-weight: bold;
  display: block;
  color: white;
  margin-bottom: 10rpx;
  flex: 1;
}

.city-tag {
  background-color: rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  display: inline-block;
}

.modal-close {
  position: absolute;
  top: 30rpx;
  right: 30rpx;
  font-size: 36rpx;
  color: white;
  width: 50rpx;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 20rpx 30rpx 30rpx;
  max-height: 50vh;
}

.detail-row {
  margin-bottom: 20rpx;
}

.detail-label {
  display: inline-block;
  width: 120rpx;
  font-size: 28rpx;
  color: #666;
}

.detail-value {
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

.detail-desc {
  display: block;
  margin-top: 8rpx;
}
</style>