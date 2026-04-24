/**
 * 用户相关API
 */

import { post, get } from '@/utils/request.js'
import { API_CONFIG } from '@/config/index.js'
import { useUserStore } from '@/store/user.js'

// 用户相关API
const BASE_URL = API_CONFIG.BASE_URL

/**
 * 微信登录
 * @param {Object} params - 登录参数 {nickname, avatar_url, phone, phone_code, encrypted_data, iv}
 */
export async function wechatLogin(params = {}) {
  return new Promise((resolve, reject) => {
    // 1. 获取微信登录凭证
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('获取code失败'))
          return
        }
        
        console.log('[WeChat] 登录凭证:', loginRes.code)
        
        // 2. 构建用户信息
        const userInfoData = {
          nickname: params.nickname || '微信用户',
          avatar_url: params.avatar_url || '',
          phone: params.phone || '',
          gender: 0,
          country: '',
          province: '',
          city: '',
          language: 'zh_CN'
        }
        
        // 3. 构建请求数据
        const requestData = { 
          code: loginRes.code,
          user_info: userInfoData
        }
        
        // 4. 如果有手机号授权信息，添加到请求中
        if (params.phone_code) {
          requestData.phone_code = params.phone_code
          requestData.encrypted_data = params.encrypted_data || ''
          requestData.iv = params.iv || ''
          console.log('[WeChat] 包含手机号授权信息')
        }
        
        try {
          // 5. 发送到后端换取 token
          const response = await uni.request({
            url: `${BASE_URL}/login`,
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: requestData
          })
          
          console.log('[WeChat] 后端响应:', response.data)
          
          const result = response.data
          
          if (result.code === 0) {
            const userStore = useUserStore()
            userStore.setLoginData(result.data)
            userStore.setUserInfo({
              nickname: userInfoData.nickname,
              avatar_url: userInfoData.avatar_url
            })
            resolve(result.data)
          } else {
            reject(new Error(result.msg || '登录失败'))
          }
        } catch (error) {
          console.error('[WeChat] 请求失败:', error)
          reject(error)
        }
      },
      fail: (err) => {
        console.error('[WeChat] 登录失败:', err)
        reject(new Error('微信登录失败: ' + (err.errMsg || '未知错误')))
      }
    })
  })
}

/**
 * 获取用户信息
 */
export async function getUserInfo() {
  const userStore = useUserStore()
  const data = await get('/userInfo', {})
  console.log('getUserInfo raw response:', JSON.stringify(data))
  
  if (data && data.code === 0 && data.data) {
    userStore.setUserInfo(data.data)
    console.log('getUserInfo parsed:', data.data)
    return data.data
  }
  
  if (data && data.msg === '未登录') {
    throw new Error('请先登录')
  }
  
  return null
}

/**
 * 更新用户信息
 */
export async function updateUserInfo(info) {
  return await post('/userInfo', info)
}

/**
 * 检查是否已登录（只检查本地状态，不验证 token）
 */
export function checkLogin() {
  const userStore = useUserStore()
  userStore.restoreFromStorage()
  return userStore.hasToken
}

/**
 * 验证 token（后台静默验证）
 */
export async function verifyToken() {
  const userStore = useUserStore()
  
  if (!userStore.hasToken) {
    return false
  }
  
  try {
    await getUserInfo()
    return true
  } catch (error) {
    // token 过期，清理状态
    userStore.clearLogin()
    return false
  }
}

/**
 * 刷新 Token
 */
export async function refreshToken() {
  const userStore = useUserStore()
  
  if (!userStore.refreshToken) {
    return false
  }
  
  try {
    const response = await uni.request({
      url: `${BASE_URL}/refreshToken`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { refresh_token: userStore.refreshToken }
    })
    
    if (response.data.code === 0) {
      const data = response.data.data
      userStore.accessToken = data.access_token
      userStore.refreshToken = data.refresh_token
      userStore.expiresAt = data.expires_at
      userStore.refreshExpiresAt = data.refresh_expires_at
      userStore.saveToStorage()
      return true
    }
  } catch (error) {
    console.error('刷新Token失败:', error)
  }
  
  return false
}