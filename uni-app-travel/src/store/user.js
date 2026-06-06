/**
 * 用户状态管理
 */

import { defineStore } from 'pinia'
import { API_CONFIG } from '@/config/index.js'

// 用户状态管理
const BASE_URL = API_CONFIG.BASE_URL

export const useUserStore = defineStore('user', {
  state: () => ({
    userId: null,
    openid: '',
    accessToken: '',
    refreshToken: '',
    expiresAt: '',
    refreshExpiresAt: '',
    nickname: '',
    avatarUrl: '',
    inviteCode: '',  // 来自分享链接的邀请码
    isLoggedIn: false,
    quota: {
      used: 0,
      bonus: 0,
      max: 1,
      remaining: 1
    }
  }),

  getters: {
    hasToken: (state) => !!state.accessToken,
    canUseQuota: (state) => state.quota.remaining > 0
  },

  actions: {
    // 保存登录信息
    setLoginData(data) {
      console.log('[UserStore] setLoginData:', data)
      this.userId = data.user_id
      this.openid = data.openid
      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token
      this.expiresAt = data.expires_at
      this.refreshExpiresAt = data.refresh_expires_at
      this.isLoggedIn = true
      this.saveToStorage()
    },

    // 更新用户信息
    setUserInfo(info) {
      this.nickname = info.nickname || ''
      this.avatarUrl = info.avatar_url || ''
      this.userId = info.id
      if (info.total_plans !== undefined) {
        // 可以保存总计划数
      }
      this.saveToStorage()
    },

    // 更新配额
    setQuota(quota) {
      this.quota = {
        used: quota.used || 0,
        bonus: quota.bonus || 0,
        max: quota.max || 10,
        remaining: quota.remaining || 0
      }
    },

    // 减少配额
    useQuota() {
      if (this.quota.remaining > 0) {
        this.quota.remaining--
        this.quota.used++
      }
    },

    // 增加配额
    addBonus(bonus = 3) {
      this.quota.bonus += bonus
      this.quota.remaining += bonus
    },

    // 获取请求头
    getAuthHeader() {
      return `Bearer ${this.accessToken}`
    },

    // 保存到本地存储
    saveToStorage() {
      try {
        console.log('[UserStore] saveToStorage:', {
          accessToken: this.accessToken ? this.accessToken.substring(0, 20) + '...' : null
        })
        uni.setStorageSync('user_token', this.accessToken)
        uni.setStorageSync('user_refresh_token', this.refreshToken)
        uni.setStorageSync('user_info', {
          userId: this.userId,
          openid: this.openid,
          nickname: this.nickname,
          avatarUrl: this.avatarUrl,
          inviteCode: this.inviteCode
        })
        console.log('[UserStore] saveToStorage 完成')
      } catch (e) {
        console.error('保存用户信息失败:', e)
      }
    },

    // 从本地存储恢复
    restoreFromStorage() {
      try {
        const token = uni.getStorageSync('user_token')
        const refreshToken = uni.getStorageSync('user_refresh_token')
        const userInfo = uni.getStorageSync('user_info')

        console.log('[UserStore] restoreFromStorage:', {
          hasToken: !!token,
          hasUserInfo: !!userInfo
        })

        if (token) {
          this.accessToken = token
          this.refreshToken = refreshToken || ''
          this.isLoggedIn = true
        }
        if (userInfo) {
          this.userId = userInfo.userId
          this.openid = userInfo.openid
          this.nickname = userInfo.nickname
          this.avatarUrl = userInfo.avatarUrl
          this.inviteCode = userInfo.inviteCode || ''
        }
      } catch (e) {
        console.error('恢复用户信息失败:', e)
      }
    },

    // 清除登录信息
    clearLogin() {
      this.userId = null
      this.openid = ''
      this.accessToken = ''
      this.refreshToken = ''
      this.expiresAt = ''
      this.refreshExpiresAt = ''
      this.nickname = ''
      this.avatarUrl = ''
      this.inviteCode = ''
      this.isLoggedIn = false
      this.quota = { used: 0, bonus: 0, max: 1, remaining: 1 }

      try {
        uni.removeStorageSync('user_token')
        uni.removeStorageSync('user_refresh_token')
        uni.removeStorageSync('user_info')
        uni.removeStorageSync('weather_cache')
      } catch (e) {
        console.error('清除用户信息失败:', e)
      }
    }
  }
})