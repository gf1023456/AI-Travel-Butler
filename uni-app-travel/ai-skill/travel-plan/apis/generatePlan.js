function wxRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({ ...options, success(res) { resolve(res) }, fail(err) { reject(err) } })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function generateTravelPlan({ destination, days, style, preferences, modelType }) {
  try {
    const userInput = [
      `我想去${destination}玩`,
      days ? `${days}天` : '',
      style || '',
      preferences || ''
    ].filter(Boolean).join('，')

    const res = await wxRequest({
      url: `${getBaseUrl()}/api/plan/v4`,
      method: 'POST',
      timeout: 15000,
      data: {
        userInput,
        modelType: modelType || 'auto',
        travelMode: style === '特种兵极限打卡' ? 'fast' :
                     style === '深度文化慢游' ? 'deep' : 'normal'
      }
    })

    if (res.statusCode !== 200) {
      return errorResult('服务暂不可用，请稍后再试。')
    }

    const taskId = res.data.taskId
    if (!taskId) {
      return errorResult('创建行程任务失败，请稍后再试。')
    }

    let status = 'pending'
    const maxWait = 200000
    const pollInterval = 2000
    const startTime = Date.now()

    while (status !== 'completed') {
      if (Date.now() - startTime > maxWait) {
        return errorResult('行程生成超时，请稍后重试。')
      }
      await sleep(pollInterval)
      const statusRes = await wxRequest({
        url: `${getBaseUrl()}/api/plan/v4/status/${taskId}`,
        method: 'GET',
        timeout: 10000
      })
      if (statusRes.statusCode !== 200) break
      status = statusRes.data.status
      if (status === 'failed') break
    }

    const resultRes = await wxRequest({
      url: `${getBaseUrl()}/api/plan/v4/result/${taskId}`,
      method: 'GET',
      timeout: 15000
    })

    if (resultRes.statusCode !== 200) {
      return errorResult('获取行程数据失败，请稍后再试。')
    }

    const plan = resultRes.data
    if (!plan || !Array.isArray(plan.dayPlanItinerary)) {
      return errorResult('行程数据异常，请稍后再试。')
    }

    return {
      isError: false,
      content: [{
        type: 'text',
        text: `已为${destination}${days ? days + '天' : ''}生成行程方案，共 ${plan.dayPlanItinerary.length} 个景点。`
      }],
      structuredContent: {
        destination: plan.city || destination,
        days: countDays(plan.dayPlanItinerary),
        dayPlanItinerary: plan.dayPlanItinerary,
        socialRecommendations: plan.socialRecommendations || [],
        weatherSummary: extractWeather(plan.dayPlanItinerary),
        itinerarySummary: plan.itinerarySummary || '',
        requestId: plan.requestId || taskId
      }
    }
  } catch (err) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `生成行程方案时出错了：${err.errMsg || err.message || '未知错误'}。请告诉用户稍后再试。`
      }]
    }
  }
}

function errorResult(msg) {
  return { isError: true, content: [{ type: 'text', text: msg }] }
}

function countDays(pois) {
  if (!pois || !pois.length) return 1
  return new Set(pois.map(p => p.day)).size
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
    if (accountInfo.miniProgram.envVersion === 'develops') {
      return 'http://localhost:8787'
    }
  } catch (e) {}
  return 'https://tonystark-ai.ccwu.cc/travel'
}

module.exports = generateTravelPlan