/**
 * 配额相关 API
 */
import { request } from '../utils/request.js'
import { useUserStore } from '../store/user.js'

/**
 * 检查今日配额
 */
export async function checkQuota() {
  const data = await request({
    url: '/quota/check',
    method: 'GET'
  })
  
  const userStore = useUserStore()
  userStore.setQuota(data)
  
  return data
}

/**
 * 获取配额信息
 */
export async function getQuota() {
  console.log('[quota.js] getQuota 开始请求')
  try {
    const data = await request({
      url: '/quota/check',
      method: 'GET'
    })
    
    console.log('[quota.js] getQuota raw:', JSON.stringify(data))
    
    // 处理返回数据格式：可能是 {code: 0, data: {...}} 或直接返回 {...}
    let quotaData = null
    if (data && typeof data === 'object') {
      // 情况1: {code: 0, data: {...}} -> 取 data
      if (data.code === 0 && data.data) {
        quotaData = data.data
      }
      // 情况2: 直接返回 {...} -> 直接使用
      else if (data.remaining !== undefined || data.max !== undefined) {
        quotaData = data
      }
    }
    
    console.log('[quota.js] getQuota parsed:', JSON.stringify(quotaData))
    
    // 保存到 store
    const userStore = useUserStore()
    if (quotaData) {
      userStore.setQuota(quotaData)
    }
    
    return quotaData
  } catch (error) {
    console.error('[quota.js] getQuota 请求失败:', error)
    throw error
  }
}

/**
 * 使用配额
 */
export async function useQuota() {
  const data = await request({
    url: '/quota/use',
    method: 'POST'
  })
  
  const userStore = useUserStore()
  userStore.useQuota()
  
  return data
}

/**
 * 增加配额奖励
 */
export async function addQuotaBonus(amount = 3) {
  const data = await request({
    url: '/quota/bonus',
    method: 'POST',
    data: { bonus_type: 'share', amount }
  })
  
  const userStore = useUserStore()
  userStore.setQuota(data)
  
  return data
}

/**
 * 增加奖励次数
 */
export async function addBonus(bonusType = 'share') {
  const data = await request({
    url: '/quota/bonus',
    method: 'POST',
    data: { bonus_type: bonusType }
  })
  
  const userStore = useUserStore()
  userStore.setQuota(data)
  
  return data
}