/**
 * HTTP请求工具
 * 适配微信小程序环境
 */
import { API_CONFIG } from '@/config/index.js'
import { useUserStore } from '@/store/user.js'

// 请求配置
const BASE_URL = API_CONFIG.BASE_URL
let isRedirecting = false  // 防止多次跳转

function getAuthHeader() {
  try {
    const userStore = useUserStore()
    // 确保 store 状态是最新的
    if (!userStore.accessToken) {
      userStore.restoreFromStorage()
    }
    
    var token = userStore.accessToken
    var header = token ? 'Bearer ' + token : ''
    console.log('[Request] getAuthHeader:', {
      hasToken: !!token,
      header: header ? header.substring(0, 50) + '...' : '',
      storeToken: token ? token.substring(0, 20) + '...' : null
    })
    return header
  } catch (e) {
    console.error('[Request] getAuthHeader error:', e)
    return ''
  }
}

export function request(options) {
  return new Promise(function(resolve, reject) {
    var startTime = Date.now()
    var authHeader = getAuthHeader()
    
    console.log('发起请求:', BASE_URL + options.url)
    console.log('请求方法:', options.method || 'POST')
    console.log('Auth Header:', authHeader ? '已设置' : '未设置')
    
    var header = {
      'Content-Type': 'application/json'
    }
    
    if (authHeader) {
      header['Authorization'] = authHeader
      console.log('已设置 Authorization header:', authHeader.substring(0, 50) + '...')
    } else {
      console.log('未设置 Authorization header，可能未登录或 token 丢失')
    }
    
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'POST',
      data: options.data || {},
      header: header,
      timeout: 180000,
      complete: function(req) {
        console.log('请求完成:', {
          url: req.url,
          method: req.method,
          header: req.header
        })
      },
      success: function(res) {
        var duration = Date.now() - startTime
        console.log('响应状态码:', res.statusCode, '耗时:', duration + 'ms')
        
        if (res.statusCode === 200) {
          var responseData = res.data
          
          if (typeof responseData === 'string') {
            try {
              responseData = JSON.parse(responseData)
            } catch (e) {
              console.error('解析JSON失败', e)
            }
          }
          
          resolve(responseData)
        } else if (res.statusCode === 404) {
          reject(new Error('接口不存在'))
        } else if (res.statusCode === 401) {
          console.log('检测到401未授权错误，准备跳转登录')
          // 防止重复跳转
          if (!isRedirecting) {
            isRedirecting = true
            uni.showToast({
              title: '请先登录',
              icon: 'none',
              duration: 2000
            })
            setTimeout(() => {
              // 确保清除登录信息再跳转
              try {
                uni.removeStorageSync('user_token')
                uni.removeStorageSync('user_refresh_token')
                uni.removeStorageSync('user_info')
              } catch (e) {
                console.log('清除本地存储完成')
              }
              // 使用reLaunch确保栈顶只有一个页面
              uni.reLaunch({ 
                url: '/pages/login/index',
                complete: () => {
                  isRedirecting = false  // 跳转完成后重置状态
                }
              })
            }, 1500)
          }
          reject(new Error('请先登录'))
        } else if (res.statusCode === 403) {
          // 403 配额不足
          console.log('检测到403配额不足:', res.data)
          var responseData = res.data
          var errorMsg = '今日次数已用完，邀请好友可获得额外配额'
          
          if (typeof responseData === 'object' && responseData.detail) {
            if (typeof responseData.detail === 'string') {
              errorMsg = responseData.detail
            }
          }
          
          reject(new Error(errorMsg))
        } else if (res.statusCode === 400) {
          // 400 请求错误
          var responseData = res.data
          var errorMsg = '请求参数错误'
          
          if (typeof responseData === 'object' && responseData.detail) {
            if (typeof responseData.detail === 'string') {
              errorMsg = responseData.detail
            }
          }
          
          reject(new Error(errorMsg))
        } else if (res.statusCode === 422) {
          // 422 可能是未登录、token 过期、或配额不足
          console.log('检测到422验证错误:', res.data)
          var responseData = res.data
          var errorMsg = ''
          
          if (typeof responseData === 'object' && responseData.detail) {
            // 尝试提取错误信息
            if (typeof responseData.detail === 'string') {
              errorMsg = responseData.detail
            } else if (Array.isArray(responseData.detail)) {
              errorMsg = responseData.detail.map(d => typeof d === 'object' ? d.msg || d.message || JSON.stringify(d) : d).join(', ')
            } else if (typeof responseData.detail === 'object') {
              errorMsg = responseData.detail.msg || responseData.detail.message || JSON.stringify(responseData.detail)
            }
            
            // 检查是否是认证相关的错误
            var detailStr = JSON.stringify(responseData.detail).toLowerCase()
            var isAuthError = detailStr.includes('authorization') || detailStr.includes('token') || detailStr.includes('header') || detailStr.includes('credential')
            
            if (isAuthError) {
              console.log('检测到422认证错误，准备跳转登录')
              if (!isRedirecting) {
                isRedirecting = true
                uni.showToast({
                  title: '请先登录',
                  icon: 'none',
                  duration: 2000
                })
                setTimeout(() => {
                  try {
                    uni.removeStorageSync('user_token')
                    uni.removeStorageSync('user_refresh_token')
                    uni.removeStorageSync('user_info')
                  } catch (e) {
                    console.log('清除本地存储完成')
                  }
                  uni.reLaunch({
                    url: '/pages/login/index',
                    complete: () => {
                      isRedirecting = false
                    }
                  })
                }, 1500)
              }
              reject(new Error('请先登录'))
              return
            }
          }
          // 422 错误但不是认证错误，传递详细错误信息
          reject(new Error(errorMsg || '请求验证失败'))
        } else {
          reject(new Error('请求失败: ' + res.statusCode))
        }
      },
      fail: function(err) {
        var errMsg = err && err.errMsg ? err.errMsg : '未知错误'
        console.error('请求失败:', errMsg)
        if (errMsg.indexOf('timeout') !== -1) {
          reject(new Error('请求超时（180秒）'))
        } else {
          reject(new Error('网络连接失败'))
        }
      }
    })
  })
}

export function get(url, params) {
  return request({
    url: url,
    method: 'GET',
    data: params || {}
  })
}

export function post(url, data) {
  return request({
    url: url,
    method: 'POST',
    data: data || {}
  })
}

export default {
  request: request,
  get: get,
  post: post
}