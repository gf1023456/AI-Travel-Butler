/**
 * 旅行规划相关API
 */

import { post } from '@/utils/request.js'
import { get } from '@/utils/request.js'

/**
 * 生成初始行程计划
 * @param {Object} params - 行程参数
 * @param {string} params.userInput - 用户输入（必需）
 * @param {string} params.modelType - 模型类型（必需）
 * @param {boolean} params.isPlannerMode - 是否为规划模式
 * @param {string} params.travelMode - 旅行风格
 * @returns {Promise}
 */
export const createPlan = (params) => {
  return post('/plan', {
    userInput: params.userInput,
    modelType: params.modelType,
    isPlannerMode: params.isPlannerMode || false,
    travelMode: params.travelMode || 'deep'
  })
}

export const createPlanV2 = (params) => {
  return post('/plan/v3', {
    userInput: params.userInput,
    modelType: params.modelType || 'auto',
    travelMode: params.travelMode || 'deep'
  })
}

/**
 * 查询任务状态
 * @param {string} taskId - 任务ID
 * @returns {Promise}
 */
export const getPlanStatus = (taskId) => {
  return get(`/plan/v3/status/${taskId}`)
}

/**
 * 获取任务结果
 * @param {string} taskId - 任务ID
 * @returns {Promise}
 */
export const getPlanResult = (taskId) => {
  return get(`/plan/v3/result/${taskId}`)
}

/**
 * 创建行程（V4 骨架优先异步方案）
 * @param {Object} params - 行程参数
 * @returns {Promise}
 */
export const createPlanV4 = (params) => {
  return post('/plan/v4', {
    userInput: params.userInput,
    modelType: params.modelType || 'auto',
    travelMode: params.travelMode || 'deep'
  })
}

/**
 * 创建行程（V3 骨架优先 + 完整状态流转）
 * 状态流转：pending → running → skeleton_ready → filling → completed
 * @param {Object} params - 行程参数
 * @returns {Promise}
 */
export const createPlanV3 = (params) => {
  return post('/plan/v3', {
    userInput: params.userInput,
    modelType: params.modelType || 'auto',
    travelMode: params.travelMode || 'deep'
  })
}

/**
 * 查询 V3 任务状态
 * @param {string} taskId - 任务ID
 * @returns {Promise}
 */
export const getPlanV3Status = (taskId) => {
  return get(`/plan/v3/status/${taskId}`)
}

/**
 * 获取 V3 任务结果
 * @param {string} taskId - 任务ID
 * @returns {Promise}
 */
export const getPlanV3Result = (taskId) => {
  return get(`/plan/v3/result/${taskId}`)
}

/**
 * 查询 V4 任务状态
 * @param {string} taskId - 任务ID
 * @returns {Promise}
 */
export const getPlanV4Status = (taskId) => {
  return get(`/plan/v4/status/${taskId}`)
}

/**
 * 获取 V4 任务结果
 * @param {string} taskId - 任务ID
 * @returns {Promise}
 */
export const getPlanV4Result = (taskId) => {
  return get(`/plan/v4/result/${taskId}`)
}

/**
 * 优化现有行程
 * @param {Object} params - 优化参数
 * @returns {Promise}
 */
export const refinePlan = (params) => {
  return post('/plan/refine', {
    userInput: params.userInput,
    modelType: params.modelType,
    isPlannerMode: params.isPlannerMode !== false,
    travelMode: params.travelMode || 'deep',
    refineInstruction: params.refineInstruction,
    basePlan: params.basePlan
  })
}

/**
 * 获取前端配置
 * @returns {Promise}
 */
export const getFrontendConfig = () => {
  return post('/frontend-config', {})
}

/**
 * 获取当前激活的AI模型名称
 * @returns {Promise}
 */
export const getCurrentModel = () => {
  return get('/getModel', {})
}

export default {
  createPlan,
  createPlanV2,
  getPlanStatus,
  getPlanResult,
  createPlanV4,
  getPlanV4Status,
  getPlanV4Result,
  createPlanV3,
  getPlanV3Status,
  getPlanV3Result,
  refinePlan,
  getFrontendConfig,
  getCurrentModel
}
