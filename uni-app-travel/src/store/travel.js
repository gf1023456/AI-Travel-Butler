/**
 * Pinia状态管理
 */

import { defineStore } from 'pinia'
import * as travelApi from '@/api/travel.js'

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

        const result = await travelApi.createPlan({
          userInput: params.userInput,
          modelType: params.modelType,
          isPlannerMode: params.isPlannerMode || false,
          travelMode: params.travelMode || 'deep'
        })
        
        this.currentPlan = result
        this.planHistory.push(result)
        return result
      } catch (error) {
        this.error = error.message || '创建行程失败'
        throw error
      } finally {
        this.loading = false
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
