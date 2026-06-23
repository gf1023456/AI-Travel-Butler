/**
 * 历史记录相关 API
 */
import { request } from '../utils/request.js'

/**
 * 获取历史记录列表
 */
export async function getHistoryList(page = 1, pageSize = 20, favoriteOnly = false) {
  const data = await request({
    url: `/history/list?page=${page}&page_size=${pageSize}&favorite_only=${favoriteOnly}`,
    method: 'GET'
  })
  
  if (data && data.code === 0) {
    // API返回的是 { code: 0, data: { list: [...], total: 0, ... } } 结构
    if (data.data) {
      console.log('从服务端获取历史记录:', data.data.list?.length, '条')
      return data.data
    }
    return { list: [], total: 0 }
  }
  return { list: [], total: 0 }
}

/**
 * 获取历史记录详情
 */
export async function getHistoryDetail(planId) {
  const data = await request({
    url: `/history/detail/${planId}`,
    method: 'GET'
  })
  
  if (data && data.code === 0 && data.data) {
    console.log('从服务端获取历史详情:', data.data.id)
    return data.data
  }
  return null
}

/**
 * 保存行程到历史记录
 */
export async function saveHistory(planData) {
  try {
    // 验证数据
    if (!planData.userInput && !planData.user_input) {
      console.error('[API] 参数错误：缺少userInput字段')
      throw new Error('userInput字段不能为空')
    }
    
    // 重新组织数据以符合后端期望格式
    const requestBody = {
      // 确保字段名与后端API匹配
      user_input: planData.userInput || planData.user_input || '',
      model_type: planData.modelType || planData.model_type || 'auto',
      provider: planData.provider || 'unknown',
      itinerary_summary: planData.itinerarySummary || planData.itinerary_summary || '',
      // day_plan字段兼容对象格式(按天分组)和数组格式(扁平列表)
      // 后端接受任意JSON格式，优先保持原有数据结构
      day_plan: planData.dayPlanItinerary || planData.day_plan || planData.dayPlan || [],
      // 社交推荐字段
      social_recommendations: planData.socialRecommendations || planData.social_recommendations,
      // 其他字段
      evidence: planData.evidence || [],
      warnings: planData.warnings || [],
      generation_time_ms: planData.generation_time_ms || planData.generationTimeMs || null,
      mcp_trace: planData.mcpTrace || planData.mcp_trace || [],
      tokens_used: planData.tokens_used || null,
      cost_estimate: planData.cost_estimate || null,
      // v1.1 广场字段
      category: planData.category || null,
      is_public: planData.is_public === true,
      cover_url: planData.cover_url || planData.coverUrl || '',
      note_meta: planData.note_meta || planData.noteMeta || null
    };
    
    console.log('[API] 发送到后端的请求参数:', requestBody);
    
    const response = await request({
      url: '/history/save',
      method: 'POST',
      data: requestBody
    });
    
    console.log('[API] 后端返回:', response);
    
    if (response && response.code === 0 && response.data) {
      console.log('[API] 保存成功，ID:', response.data.id, response.data.deduped ? '(去重复用)' : '(新建)');
      return response.data;
    } else {
      console.error('[API] 保存失败，响应:', response);
      throw new Error(response.msg || '保存失败');
    }
  } catch (error) {
    console.error('[API] 保存行程历史失败:', error.message || error);
    // 降级到本地保存作为后备
    try {
      const localHistory = JSON.parse(uni.getStorageSync('travelHistory') || '[]');
      const newEntry = {
        id: Date.now(),
        user_input: planData.userInput || planData.user_input || '',
        model_type: planData.modelType || planData.model_type || 'auto',
        itinerary_summary: planData.itinerarySummary || planData.itinerary_summary || '',
        day_plan: planData.dayPlanItinerary || planData.day_plan || [],
        created_at: new Date().toISOString(),
        social_recommendations: planData.socialRecommendations || planData.social_recommendations || []
      };
      localHistory.unshift(newEntry);
      uni.setStorageSync('travelHistory', JSON.stringify(localHistory));
      console.log('[API] 降级到本地保存成功');
      return { id: newEntry.id };
    } catch (localError) {
      console.error('[API] 本地保存也失败:', localError);
      throw error; // 重新抛出原始错误
    }
  }
}

/**
 * 切换收藏状态
 */
export async function toggleFavorite(planId) {
  const data = await request({
    url: '/history/favorite',
    method: 'POST',
    data: { plan_id: planId }
  })
  
  if (data && data.code === 0 && data.data) {
    return data.data.is_favorite
  }
  return null
}

/**
 * 删除历史记录
 */
export async function deleteHistory(planId) {
  const data = await request({
    url: `/history/${planId}`,
    method: 'DELETE'
  })
  
  return data && data.code === 0
}

/**
 * 获取公开方案列表（广场）
 * @param {Object} options { page, pageSize, category, sort }
 *   category: 'all' | 'city' | 'photo' | 'food' | 'couple' | 'family' | 'rusher' | 'road' | 'hot'
 *   sort: 'hot'(按点赞) | 'new'(按时间)
 */
export async function getPublicPlans({ page = 1, pageSize = 6, category = 'all', sort = 'hot' } = {}) {
  try {
    const qs = `page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}`
    const data = await request({
      url: `/history/public?${qs}`,
      method: 'GET'
    })
    if (data && data.code === 0 && data.data) {
      return data.data
    }
    console.warn('[getPublicPlans] 后端返回非 0:', data)
    return { list: [], total: 0, page, page_size: pageSize }
  } catch (e) {
    console.error('[getPublicPlans] 请求失败:', e)
    // 降级返回示例数据
    return {
      list: [
        { id: 1, title: '东京樱花季5日游', author: '旅行达人小王', category: 'city', likes: 128, is_liked: false, cover: 'https://tonystark-ai.ccwu.cc/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png' },
        { id: 2, title: '成都美食探店3日', author: '吃货阿杰', category: 'food', likes: 89, is_liked: false, cover: 'https://tonystark-ai.ccwu.cc/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png' },
        { id: 3, title: '三亚亲子度假4日', author: '幸福家庭', category: 'family', likes: 256, is_liked: false, cover: 'https://tonystark-ai.ccwu.cc/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png' },
        { id: 4, title: '丽江古城慢生活', author: '文艺青年', category: 'city', likes: 67, is_liked: false, cover: 'https://tonystark-ai.ccwu.cc/png/fed79683-fbb6-44ac-9327-44c2f269cc47.png' },
        { id: 5, title: '上海外滩深度游', author: '都市漫步者', category: 'photo', likes: 193, is_liked: false, cover: 'https://tonystark-ai.ccwu.cc/png/600dc4e1-70ed-491a-85d4-a0edea269eb8.png' },
        { id: 6, title: '西安古都探秘', author: '历史爱好者', category: 'rusher', likes: 145, is_liked: false, cover: 'https://tonystark-ai.ccwu.cc/png/79b1c1f7-445f-49bc-a075-e44c66b289d8.png' }
      ],
      total: 6,
      page,
      page_size: pageSize
    }
  }
}

/**
 * 获取公开方案详情（无需登录，广场点击查看）
 */
export async function getPublicPlanDetail(planId) {
  try {
    const data = await request({
      url: `/history/public/${planId}`,
      method: 'GET'
    })
    if (data && data.code === 0 && data.data) {
      return data.data
    }
    return null
  } catch {
    return null
  }
}

/**
 * 切换点赞（公开方案） - 返回 { is_liked, likes }
 */
export async function likePlan(planId) {
  const data = await request({
    url: `/plan/${planId}/like`,
    method: 'POST',
    data: {}
  })
  if (data && data.code === 0 && data.data) {
    return data.data
  }
  throw new Error(data?.msg || '点赞失败')
}

/**
 * 好友共创：通过 planId 查询方案详情（无需登录）
 */
export async function getSharePlan(planId) {
  const data = await request({
    url: `/history/share/${planId}`,
    method: 'GET'
  })
  if (data && data.code === 0 && data.data) {
    return data.data
  }
  return null
}