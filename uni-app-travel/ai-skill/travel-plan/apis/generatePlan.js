async function generateTravelPlan({ destination, days, style, preferences }) {
  try {
    const userInput = [
      `我想去${destination}玩`,
      days ? `${days}天` : '',
      style || '',
      preferences || ''
    ].filter(Boolean).join('，')

    const res = await wx.request({
      url: `${getBaseUrl()}/api/plan`,
      method: 'POST',
      timeout: 120000,
      data: {
        userInput,
        isPlannerMode: true,
        travelMode: style === '特种兵极限打卡' ? 'fast' :
                     style === '深度文化慢游' ? 'deep' : 'normal'
      }
    })

    const plan = res.data

    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: `已为${destination}${days ? days + '天' : ''}生成行程方案，共 ${(plan.dayPlanItinerary || []).length} 个景点。请展示行程卡片。`
        }
      ],
      structuredContent: {
        destination: plan.city || destination,
        days: countDays(plan.dayPlanItinerary),
        dayPlanItinerary: plan.dayPlanItinerary || [],
        socialRecommendations: plan.socialRecommendations || [],
        weatherSummary: extractWeather(plan.dayPlanItinerary),
        itinerarySummary: plan.itinerarySummary || '',
        requestId: plan.requestId || ''
      }
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `生成行程方案时出错了：${err.errMsg || err.message || '未知错误'}。请告诉用户稍后再试。`
        }
      ]
    }
  }
}

function countDays(pois) {
  if (!pois || !pois.length) return 1
  const days = new Set(pois.map(p => p.day))
  return days.size
}

function extractWeather(pois) {
  if (!pois || !pois.length) return []
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

function getBaseUrl() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    if (accountInfo.miniProgram.envVersion === 'develop') {
      return 'http://localhost:8787'
    }
  } catch (e) {}
  return 'https://tonystark-ai.ccwu.cc/travel'
}

module.exports = generateTravelPlan
