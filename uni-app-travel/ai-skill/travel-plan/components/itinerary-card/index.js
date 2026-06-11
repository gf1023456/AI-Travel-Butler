Component({
  lifetimes: {
    created() {
      const modelCtx = wx.modelContext.getContext(this)
      const { NotificationType } = wx.modelContext

      modelCtx.on(NotificationType.Result, (data) => {
        const plan = data.result.structuredContent
        const pois = plan.dayPlanItinerary || []
        const days = groupByDay(pois)

        this.setData({
          destination: plan.destination || '目的地',
          daysNum: plan.days || days.length,
          style: guessStyle(plan.itinerarySummary),
          weatherSummary: plan.weatherSummary || extractWeather(pois),
          previewDays: days.slice(0, 1),
          moreDays: Math.max(0, days.length - 1),
          socialRecommendations: (plan.socialRecommendations || []).slice(0, 5),
          planId: plan.requestId || ''
        })

        this._fullDays = days
        this._fullPois = pois
        this._planData = plan

        const viewCtx = wx.modelContext.getViewContext(this)
        viewCtx.setRelatedPage({ query: `planId=${plan.requestId || ''}` })
      })
    }
  },
  methods: {
    onPoiTap(e) {
      const { day, seq } = e.currentTarget.dataset
      const poi = this._fullPois.find(p => p.day === day && p.sequence === seq)
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
      wx.modelContext.getViewContext(this).openDetailPage({
        url: `/pages/ai-plan-detail/index?planId=${this.data.planId}`
      })
    }
  }
})

function groupByDay(pois) {
  const map = {}
  for (const p of pois) {
    const key = p.day || 1
    if (!map[key]) map[key] = { day: key, pois: [], theme: p.dayTheme || '' }
    map[key].pois.push(p)
  }
  return Object.values(map).sort((a, b) => a.day - b.day)
}

function extractWeather(pois) {
  const seen = new Set()
  const result = []
  for (const p of pois) {
    if (p.weather_icon && !seen.has(p.day)) {
      seen.add(p.day)
      result.push({ day: p.day, icon: p.weather_icon, temp: p.temperature })
    }
  }
  return result
}

function guessStyle(summary) {
  if (!summary) return ''
  if (summary.includes('文化')) return '🍵 深度文化'
  if (summary.includes('打卡')) return '🔥 特种兵'
  if (summary.includes('休闲')) return '🏖️ 休闲'
  if (summary.includes('摄影')) return '📸 摄影'
  return ''
}
