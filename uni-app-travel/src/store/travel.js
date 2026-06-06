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
    // 方案预览（用于探索页 → 方案详情页）
    previewPlan: null,
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
          throw new Error('请选择模型')
        }

        // 先检查配额是否足够
        try {
          const quotaData = await getQuota()
          console.log('[TravelStore] 配额检查:', quotaData)
          
          // 解析配额数据
          const remaining = (quotaData && quotaData.remaining) || (quotaData && quotaData.data && quotaData.data.remaining) || 0
          console.log('[TravelStore] 剩余配额:', remaining)
          
          if (remaining <= 0) {
            // 配额不足 - 引导邀请好友
            this.loading = false
            uni.showModal({
              title: '配额不足',
              content: '生成次数已用完，每成功邀请1位好友即可获得3次额外额度！',
              confirmText: '邀请好友',
              cancelText: '取消',
              success: (res) => {
                if (res.confirm) {
                  uni.reLaunch({ url: '/pages/mine/index' })
                }
              }
            })
            this.error = '配额已用完'
            return null
          }
        } catch (quotaError) {
          // 配额检查失败（网络错误、401等），阻止生成
          console.error('[TravelStore] 配额检查失败:', quotaError.message || quotaError)
          this.loading = false
          uni.showToast({ title: '无法检查配额，请稍后重试', icon: 'none' })
          this.error = '配额检查失败'
          return null
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
          const remaining = (quotaData && quotaData.remaining) || (quotaData && quotaData.data && quotaData.data.remaining) || 0
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
     * 创建行程（V3 骨架优先 + 完整状态流转）
     * 状态流转：pending → running → skeleton_ready → filling → completed
     * V3 与 V4 的区别：V3 增加了 filling 状态，填充阶段也能实时更新 UI
     */
    async createPlanV3(params) {
      this.loading = true
      this.error = null
      try {
        if (!params.userInput || typeof params.userInput !== 'string') {
          throw new Error('请输入旅行需求')
        }

        // 检查配额
        try {
          const quotaData = await getQuota()
          const remaining = (quotaData && quotaData.remaining) || (quotaData && quotaData.data && quotaData.data.remaining) || 0
          if (remaining <= 0) {
            this.loading = false
            uni.showModal({
              title: '配额不足',
              content: '今日生成次数已用完',
              showCancel: false,
              confirmText: '我知道了'
            })
            this.error = '今日配额已用完'
            return null
          }
        } catch (quotaError) {
          this.loading = false
          uni.showToast({ title: '无法检查配额，请稍后重试', icon: 'none' })
          this.error = '配额检查失败'
          return null
        }

        // 1. 创建异步任务
        const createRes = await travelApi.createPlanV3({
          userInput: params.userInput,
          modelType: params.modelType || 'auto',
          travelMode: params.travelMode || 'deep'
        }).catch((apiError) => {
          const errorMsg = apiError.message || ''
          if (errorMsg.includes('quota') || errorMsg.includes('配额') || errorMsg.includes('次数')) {
            uni.showModal({
              title: '配额不足',
              content: '今日生成次数已用完',
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
          throw new Error('创建任务失败')
        }
        const taskId = createRes.taskId

        // 2. 轮询状态（支持完整 5 个状态流转）
        const pollInterval = 3000
        const maxWaitTime = 240000

        return new Promise((resolve, reject) => {
          const startTime = Date.now()

          const poll = async () => {
            try {
              const elapsed = Date.now() - startTime
              if (elapsed > maxWaitTime) {
                this.loading = false
                this.error = '任务超时'
                reject(new Error('任务超时'))
                return
              }

              const statusRes = await travelApi.getPlanV3Status(taskId)
              const status = statusRes.status
              console.log('[TravelStore V3] Status:', status)

              // pending / running: 任务创建或正在生成骨架
              if (status === 'pending' || status === 'running') {
                // 更新 loading 提示
                uni.showLoading({ title: '正在规划...' })
                setTimeout(poll, pollInterval)
                return
              }

              // skeleton_ready: 骨架已就绪，存储骨架数据
              if (status === 'skeleton_ready') {
                const skeleton = await travelApi.getPlanV3Result(taskId)
                console.log('[TravelStore V3] Skeleton ready, locations:', (skeleton.dayPlanItinerary && skeleton.dayPlanItinerary.length) || 0)
                
                // 存储骨架数据（不在 store 内部跳转，让调用方处理）
                this.currentPlan = skeleton
                this.planHistory.push(skeleton)
                
                // 继续后台轮询直到完成
                this._v3BackgroundPoll(taskId)
                resolve(skeleton)
                return
              }

              // filling: 正在填充详细信息（V3 特有状态）
              if (status === 'filling') {
                // 尝试获取最新结果（可能包含部分填充数据）
                try {
                  const result = await travelApi.getPlanV3Result(taskId)
                  // 更新当前数据，让页面实时显示填充进度
                  this.currentPlan = result
                  console.log('[TravelStore V3] Filling phase, updated data')
                } catch (e) {
                  console.log('[TravelStore V3] Filling phase result fetch failed')
                }
                setTimeout(poll, pollInterval)
                return
              }

              // completed: 任务完成
              if (status === 'completed') {
                const result = await travelApi.getPlanV3Result(taskId)
                this.currentPlan = result
                this.planHistory.push(result)
                this.loading = false

                try {
                  await useQuota()
                  console.log('[TravelStore V3] 配额已扣减')
                } catch (quotaError) {
                  console.error('[TravelStore V3] 配额扣减失败:', quotaError)
                }

                resolve(result)
              } else if (status === 'failed') {
                this.loading = false
                this.error = statusRes.error || '任务执行失败'
                reject(new Error(this.error))
              } else {
                // 其他状态，继续轮询
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
     * 后台轮询更新 V3 骨架数据（支持 filling 状态）
     */
    _v3BackgroundPoll(taskId) {
      const pollInterval = 3000
      const maxWaitTime = 240000
      const startTime = Date.now()
      
      const doPoll = async () => {
        try {
          const elapsed = Date.now() - startTime
          if (elapsed > maxWaitTime) {
            console.warn('[TravelStore V3] 后台轮询超时')
            return
          }

          const statusRes = await travelApi.getPlanV3Status(taskId)
          const status = statusRes.status
          console.log('[TravelStore V3] Background poll - status:', status)

          if (status === 'filling') {
            // filling 状态也更新数据
            try {
              const result = await travelApi.getPlanV3Result(taskId)
              this.currentPlan = result
              console.log('[TravelStore V3] Filling - updated with partial data')
            } catch (e) {
              console.log('[TravelStore V3] Filling phase fetch failed')
            }
            setTimeout(doPoll, pollInterval)
            return
          }

          if (status === 'completed') {
            const result = await travelApi.getPlanV3Result(taskId)
            this.currentPlan = result
            console.log('[TravelStore V3] 后台轮询完成，数据已更新')
            uni.showToast({ title: '行程详情已生成', icon: 'success', duration: 2000 })
            return
          }

          if (status === 'failed') {
            console.warn('[TravelStore V3] 后台任务失败:', statusRes.error)
            return
          }

          // pending / running / skeleton_ready，继续轮询
          setTimeout(doPoll, pollInterval)
        } catch (err) {
          console.error('[TravelStore V3] 后台轮询出错:', err)
          setTimeout(doPoll, pollInterval)
        }
      }

      doPoll()
    },

    async createPlanV4(params) {
      this.loading = true
      this.error = null
      try {
        if (!params.userInput || typeof params.userInput !== 'string') {
          throw new Error('请输入旅行需求')
        }

        // 检查配额
        try {
          const quotaData = await getQuota()
          const remaining = (quotaData && quotaData.remaining) || (quotaData && quotaData.data && quotaData.data.remaining) || 0
          if (remaining <= 0) {
            this.loading = false
            uni.showModal({
              title: '配额不足',
              content: '生成次数已用完，每成功邀请1位好友即可获得3次额外额度！',
              confirmText: '邀请好友',
              cancelText: '取消',
              success: (res) => {
                if (res.confirm) {
                  uni.reLaunch({ url: '/pages/mine/index' })
                }
              }
            })
            this.error = '配额已用完'
            return null
          }
        } catch (quotaError) {
          this.loading = false
          uni.showToast({ title: '无法检查配额，请稍后重试', icon: 'none' })
          this.error = '配额检查失败'
          return null
        }

        // 1. 创建异步任务
        const createRes = await travelApi.createPlanV4({
          userInput: params.userInput,
          modelType: params.modelType || 'auto',
          travelMode: params.travelMode || 'deep'
        }).catch((apiError) => {
          const errorMsg = apiError.message || ''
          if (errorMsg.includes('quota') || errorMsg.includes('配额') || errorMsg.includes('次数')) {
            uni.showModal({
              title: '配额不足',
              content: '今日生成次数已用完',
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
          throw new Error('创建任务失败')
        }
        const taskId = createRes.taskId

        // 2. 轮询状态（支持骨架优先）
        const pollInterval = 3000
        const maxWaitTime = 240000

        return new Promise((resolve, reject) => {
          const startTime = Date.now()

          const poll = async () => {
            try {
              const elapsed = Date.now() - startTime
              if (elapsed > maxWaitTime) {
                this.loading = false
                this.error = '任务超时'
                reject(new Error('任务超时'))
                return
              }

              const statusRes = await travelApi.getPlanV4Status(taskId)
              const status = statusRes.status
              console.log('[TravelStore V4] Status:', status)

              if (status === 'skeleton_ready') {
                // 骨架已就绪，立即存储并跳转，让用户有感知
                const skeleton = await travelApi.getPlanV4Result(taskId)
                console.log('[TravelStore V4] Skeleton ready, locations:', (skeleton.dayPlanItinerary && skeleton.dayPlanItinerary.length) || 0)

                // 标记为骨架态：保存/分享按钮要禁用，等填充完毕才放开
                skeleton.isSkeleton = true
                skeleton._taskId = taskId

                // 先存储骨架数据，让前端可以立即展示
                this.currentPlan = skeleton
                this.planHistory.push(skeleton)

                // 骨架阶段立即扣减配额，让用户感知"已开始使用"
                try {
                  await useQuota()
                  console.log('[TravelStore V4] 骨架就绪，配额已扣减')
                } catch (quotaError) {
                  console.error('[TravelStore V4] 配额扣减失败:', quotaError)
                }

                // 骨架阶段就先跳转页面，用户可以看到行程列表
                uni.hideLoading()
                this.loading = false // 重置 loading 状态
                uni.showToast({ title: '骨架已生成，正在填充详情...', icon: 'none', duration: 2000 })
                uni.reLaunch({ url: '/pages/index/index' })

                // 继续在后台轮询直到完成（不影响用户操作）
                this._v4BackgroundPoll(taskId)
                resolve(skeleton)
                return
              }

              if (status === 'completed') {
                const result = await travelApi.getPlanV4Result(taskId)
                result.isSkeleton = false
                this.currentPlan = result
                this.planHistory.push(result)
                this.loading = false // 重置 loading 状态
                resolve(result)
              } else if (status === 'failed') {
                this.loading = false // 重置 loading 状态
                this.error = '生成失败，请稍后重试'
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
        const errMsg = error.message || ''
        if (errMsg.includes('骨架') || errMsg.includes('模型') || errMsg.includes('为空')) {
          this.error = '服务繁忙，请稍后重试'
        } else {
          this.error = error.message || '创建行程失败'
        }
        throw new Error(this.error)
      }
    },

    /**
     * 后台轮询更新 V4 骨架数据（骨架阶段后继续更新）
     */
    _v4BackgroundPoll(taskId) {
      const pollInterval = 3000
      const maxWaitTime = 240000
      const startTime = Date.now()
      
      const doPoll = async () => {
        try {
          const elapsed = Date.now() - startTime
          if (elapsed > maxWaitTime) {
            console.warn('[TravelStore V4] 后台轮询超时')
            return
          }

          const statusRes = await travelApi.getPlanV4Status(taskId)
          const status = statusRes.status
          console.log('[TravelStore V4] Background poll - status:', status)

          if (status === 'completed') {
            const result = await travelApi.getPlanV4Result(taskId)
            result.isSkeleton = false
            // 更新完整数据
            this.currentPlan = result

            // 同步更新 planHistory 里那条骨架：用 taskId 找到并替换
            const idx = this.planHistory.findIndex(p => p && p._taskId === taskId)
            if (idx >= 0) {
              this.planHistory.splice(idx, 1, result)
              console.log('[TravelStore V4] planHistory 已同步完整数据 idx=', idx)
            }

            console.log('[TravelStore V4] 后台轮询完成，数据已更新')
            uni.showToast({ title: '行程详情已生成', icon: 'success', duration: 2000 })
            return
          }

          if (status === 'failed') {
            console.warn('[TravelStore V4] 后台任务失败:', statusRes.error)
            // 即使失败，也要把 isSkeleton 清掉，避免一直卡在禁用态
            if (this.currentPlan && this.currentPlan._taskId === taskId) {
              this.currentPlan.isSkeleton = false
              this.currentPlan.fillFailed = true
            }
            uni.showToast({ title: '填充详情失败，请稍后重试', icon: 'none' })
            return
          }

          // 继续轮询
          setTimeout(doPoll, pollInterval)
        } catch (err) {
          console.error('[TravelStore V4] 后台轮询出错:', err)
          // 出错也继续轮询几次
          setTimeout(doPoll, pollInterval)
        }
      }

      doPoll()
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
        this.error = '优化失败，请稍后重试'
        throw new Error(this.error)
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
    },

    /**
     * 行程编辑：上下移动景点
     */
    reorderItem({ day, fromIndex, direction }) {
      if (!this.currentPlan?.dayPlanItinerary) return
      // 获取同天的项目
      const dayItems = this.currentPlan.dayPlanItinerary
        .map((item, idx) => ({ ...item, _idx: idx }))
        .filter(item => item.day === day)
        .sort((a, b) => a.sequence - b.sequence)

      const posInDay = dayItems.findIndex(item => item._idx === fromIndex)
      if (posInDay < 0) return

      const targetPos = direction === 'up' ? posInDay - 1 : posInDay + 1
      if (targetPos < 0 || targetPos >= dayItems.length) return

      // 交换 sequence
      const itemA = this.currentPlan.dayPlanItinerary[dayItems[posInDay]._idx]
      const itemB = this.currentPlan.dayPlanItinerary[dayItems[targetPos]._idx]
      const tmpSeq = itemA.sequence
      itemA.sequence = itemB.sequence
      itemB.sequence = tmpSeq

      // 触发响应式更新
      this.currentPlan = { ...this.currentPlan }
    },

    /**
     * 行程编辑：删除景点
     */
    deleteItem(index) {
      if (!this.currentPlan?.dayPlanItinerary) return
      this.currentPlan.dayPlanItinerary.splice(index, 1)
      // 重新计算 sequence
      this.currentPlan.dayPlanItinerary.forEach((item, idx) => {
        item.sequence = idx + 1
      })
      this.currentPlan = { ...this.currentPlan }
    },

    /**
     * 行程编辑：修改景点时间
     */
    updateItemTime({ index, time }) {
      if (!this.currentPlan?.dayPlanItinerary) return
      this.currentPlan.dayPlanItinerary[index].time = time
      this.currentPlan = { ...this.currentPlan }
    }
  }
})

export default useTravelStore
