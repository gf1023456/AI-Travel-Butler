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
  const data = await request({
    url: '/quota/check',
    method: 'GET'
  })
  
  console.log('getQuota raw:', data)
  
  let quotaData = data
  if (data && data.code === 0 && data.data) {
    quotaData = data.data
  }
  
  console.log('getQuota parsed:', quotaData)
  
  const userStore = useUserStore()
  userStore.setQuota(quotaData)
  
  return quotaData
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