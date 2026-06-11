function groupByDay(pois) {
  const map = {}
  for (const p of pois) {
    if (!map[p.day]) map[p.day] = { day: p.day, pois: [] }
    map[p.day].pois.push(p)
  }
  return Object.values(map).sort((a, b) => a.day - b.day)
}

function extractWeatherSummary(days) {
  return days.map(d => {
    const first = d.pois.find(p => p.weather_icon)
    return first ? { icon: first.weather_icon, temp: first.temperature } : null
  }).filter(Boolean)
}

Component({
  lifetimes: {
    created() {
      const modelCtx = wx.modelContext.getContext(this)
      const { NotificationType } = wx.modelContext

      modelCtx.on(NotificationType.Result, (data) => {
        const plan = data.result.structuredContent
        const pois = plan.dayPlanItinerary || []
        const days = groupByDay(pois)
        const hasCoords = pois.some(p => p.lat && p.lng)

        this.setData({
          destination: plan.destination || plan.city || '目的地',
          daysNum: plan.days || days.length,
          style: plan.itinerarySummary?.includes('文化') ? '🍵 深度文化' :
                 plan.itinerarySummary?.includes('打卡') ? '🔥 特种兵' : '🏖️ 休闲',
          weatherSummary: extractWeatherSummary(days),
          previewDays: days.slice(0, 1),
          socialRecommendations: (plan.socialRecommendations || []).slice(0, 5),
          hasCoordinates: hasCoords,
          planId: plan.requestId || '',
          _fullDays: days,
          _fullSocial: plan.socialRecommendations || []
        })

        const viewCtx = wx.modelContext.getViewContext(this)
        viewCtx.setRelatedPage({ query: `planId=${plan.requestId || ''}` })
      })
    }
  },
  methods: {
    onPoiTap(e) {
      const { day, index } = e.currentTarget.dataset
      const poi = this.data._fullDays.find(d => d.day === day)?.pois[index]
      if (!poi) return
      wx.modelContext.getContext(this).sendFollowUpMessage({
        content: [{ type: 'text', text: `介绍一下${poi.name}` }]
      })
    },
    onRecommendTap(e) {
      const name = e.currentTarget.dataset.name
      wx.modelContext.getContext(this).sendFollowUpMessage({
        content: [{ type: 'text', text: `${name}有什么好玩的` }]
      })
    },
    onViewDetail() {
      const viewCtx = wx.modelContext.getViewContext(this)
      viewCtx.openDetailPage({ url: `/pages/plan-detail/index?planId=${this.data.planId}` })
    },
    onViewMap() {
      wx.modelContext.getContext(this).sendFollowUpMessage({
        content: [{ type: 'text', text: '在地图上标出这些景点位置' }]
      })
    }
  }
})
