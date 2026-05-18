/**
 * Pinia状态管理
 */

import { defineStore } from 'pinia'
import * as travelApi from '@/api/travel.js'
import { getQuota, useQuota } from '@/api/quota.js'

/**
 * 旅行规划Store
 */
export const useTravelStore = defineStore('travel', {
  state: () => ({
    // 当前行程
    currentPlan: null,
    // 行程历史
    planHistory: [],
    // 加载状态
    loading: false,
    // 错误信息
    error: null,
    // 用户偏好
    preferences: {
      userInput: '',
      modelType: 'auto',
      isPlannerMode: false,
      travelMode: 'deep'
    }
  }),

  getters: {
    // 获取最新行程
    latestPlan: (state) => {
      return state.planHistory.length > 0 
        ? state.planHistory[state.planHistory.length - 1] 
        : state.currentPlan
    }
  },

  actions: {
    /**
     * 创建行程
     * @param {Object} params - 包含 userInput, modelType, isPlannerMode, travelMode
     */
    async createPlan(params) {
      this.loading = true
      this.error = null
      
      try {
        // 验证必需参数
        if (!params.userInput || typeof params.userInput !== 'string') {
          throw new Error('请输入旅行需求')
        }
        if (!params.modelType || typeof params.modelType !== 'string') {
          throw new Error('请选择AI模型')
        }

        // 先检查配额是否足够
        try {
          const quotaData = await getQuota()
          console.log('[TravelStore] 配额检查:', quotaData)
          
          // 解析配额数据
          const remaining = quotaData?.remaining ?? quotaData?.data?.remaining ?? 0
          console.log('[TravelStore] 剩余配额:', remaining)
          
          if (remaining <= 0) {
            // 配额不足
            this.loading = false
            uni.showModal({
              title: '配额不足',
              content: '今日生成次数已用完，观看广告可获取额外配额',
              confirmText: '去看广告',
              cancelText: '关闭',
              success: (res) => {
                if (res.confirm) {
                  // TODO: 调用看广告接口
                  uni.showToast({ title: '广告功能开发中', icon: 'none' })
                }
              }
            })
            this.error = '今日配额已用完'
            return null  // 直接返回，不继续
          }
        } catch (quotaError) {
          // 配额检查失败（网络错误、401等），阻止生成
          console.error('[TravelStore] 配额检查失败:', quotaError.message || quotaError)
          this.loading = false
          uni.showToast({ title: '无法检查配额，请稍后重试', icon: 'none' })
          this.error = '配额检查失败'
          return null  // 直接返回，不继续
        }

        const result = await travelApi.createPlan({
          userInput: params.userInput,
          modelType: params.modelType,
          isPlannerMode: params.isPlannerMode || false,
          travelMode: params.travelMode || 'deep'
        }).catch(async (apiError) => {
          // 检查是否是配额不足的错误
          const errorMsg = apiError.message || ''
          if (errorMsg.includes('quota') || errorMsg.includes('配额') || errorMsg.includes('次数')) {
            uni.showModal({
              title: '配额不足',
              content: '今日生成次数已用完，请明天再来或分享获取额外配额',
              showCancel: false,
              confirmText: '我知道了'
            })
            this.error = '今日配额已用完'
            return null
          }
          throw apiError
        })
        
        this.currentPlan = result
        this.planHistory.push(result)
        
        // 生成成功后自动扣减配额
        try {
          await useQuota()
          console.log('[TravelStore] 配额已扣减')
        } catch (quotaError) {
          console.error('[TravelStore] 配额扣减失败:', quotaError)
          // 配额扣减失败不影响主流程
        }
        
        return result
      } catch (error) {
        this.error = error.message || '创建行程失败'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 创建行程（V2 异步轮询方案）
     */
    async createPlanV2(params) {
      this.loading = true
      this.error = null
      try {
        if (!params.userInput || typeof params.userInput !== 'string') {
          throw new Error('请输入旅行需求')
        }

        // 先检查配额是否足够
        try {
          const quotaData = await getQuota()
          console.log('[TravelStore] 配额检查:', quotaData)
          const remaining = quotaData?.remaining ?? quotaData?.data?.remaining ?? 0
          console.log('[TravelStore] 剩余配额:', remaining)
          if (remaining <= 0) {
            this.loading = false
            uni.showModal({
              title: '配额不足',
              content: '今日生成次数已用完，观看广告可获取额外配额',
              confirmText: '去看广告',
              cancelText: '关闭',
              success: (res) => {
                if (res.confirm) {
                  uni.showToast({ title: '广告功能开发中', icon: 'none' })
                }
              }
            })
            this.error = '今日配额已用完'
            return null
          }
        } catch (quotaError) {
          console.error('[TravelStore] 配额检查失败:', quotaError.message || quotaError)
          this.loading = false
          uni.showToast({ title: '无法检查配额，请稍后重试', icon: 'none' })
          this.error = '配额检查失败'
          return null
        }

        // 1. 创建异步任务（立即返回 taskId）
        const createRes = await travelApi.createPlanV2({
          userInput: params.userInput,
          modelType: params.modelType || 'auto',
          travelMode: params.travelMode || 'deep'
        }).catch((apiError) => {
          const errorMsg = apiError.message || ''
          if (errorMsg.includes('quota') || errorMsg.includes('配额') || errorMsg.includes('次数')) {
            uni.showModal({
              title: '配额不足',
              content: '今日生成次数已用完，请明天再来或分享获取额外配额',
              showCancel: false,
              confirmText: '我知道了'
            })
            this.error = '今日配额已用完'
            return null
          }
          throw apiError
        })

        if (!createRes || !createRes.taskId) {
          this.loading = false
          throw new Error('创建任务失败，未返回 taskId')
        }
        const taskId = createRes.taskId

        // 2. 轮询状态
        const pollInterval = 2000  // 每 2 秒查一次
        const maxWaitTime = 240000 // 最多等 120 秒

        return new Promise((resolve, reject) => {
          const startTime = Date.now()

          const poll = async () => {
            try {
              const elapsed = Date.now() - startTime
              if (elapsed > maxWaitTime) {
                this.loading = false
                this.error = '任务处理超时，请稍后到历史记录查看'
                reject(new Error('任务超时'))
                return
              }

              const statusRes = await travelApi.getPlanStatus(taskId)
              const status = statusRes.status

              if (status === 'completed') {
                const result = await travelApi.getPlanResult(taskId)
                this.currentPlan = result
                this.planHistory.push(result)
                this.loading = false

                // 生成成功后自动扣减配额
                try {
                  await useQuota()
                  console.log('[TravelStore] 配额已扣减')
                } catch (quotaError) {
                  console.error('[TravelStore] 配额扣减失败:', quotaError)
                }

                resolve(result)
              } else if (status === 'failed') {
                this.loading = false
                this.error = statusRes.error || '任务执行失败'
                reject(new Error(this.error))
              } else {
                // pending 或 running，继续轮询
                setTimeout(poll, pollInterval)
              }
            } catch (err) {
              this.loading = false
              this.error = err.message || '查询任务状态失败'
              reject(err)
            }
          }

          poll()
        })
      } catch (error) {
        this.loading = false
        this.error = error.message || '创建行程失败'
        throw error
      }
    },

    /**
     * 优化行程
     */
    async refinePlan(params) {
      this.loading = true
      this.error = null
      
      try {
        const result = await travelApi.refinePlan({
          userInput: params.userInput,
          modelType: params.modelType,
          isPlannerMode: params.isPlannerMode !== false,
          travelMode: params.travelMode || 'deep',
          refineInstruction: params.refineInstruction,
          basePlan: params.basePlan
        })
        this.currentPlan = result
        this.planHistory.push(result)
        return result
      } catch (error) {
        this.error = error.message || '优化行程失败'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 清除行程
     */
    clearPlan() {
      this.currentPlan = null
      this.planHistory = []
      this.error = null
    },

    /**
     * 设置用户偏好
     */
    setPreferences(prefs) {
      this.preferences = { ...this.preferences, ...prefs }
    }
  }
})

export default useTravelStore
