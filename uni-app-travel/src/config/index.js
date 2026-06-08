/**
 * 前端配置文件
 * 集中管理后端服务地址、端口、超时等配置参数
 */

// ==================== 环境配置 ====================
const isDevelopment = process.env.NODE_ENV === 'development'
 // const isDevelopment = process.env.NODE_ENV === 'pord'

// ==================== 后端服务配置 ====================
export const API_CONFIG = {
  // 后端服务地址
  BASE_URL: isDevelopment 
    ? 'http://127.0.0.1:8787/api'  // 开发环境
    : 'https://tonystark-ai.ccwu.cc/travel/api', // 生产环境（需替换为实际域名）
  
  // 后端端口（仅用于显示和日志）
  PORT: 8787,
  
  // 请求超时时间（毫秒）
  TIMEOUT: {
    NORMAL: 60000,      // 普通请求：60秒
    AI_GENERATE: 180000 // AI生成请求：180秒（3分钟）
  },
  
  // 重试配置
  RETRY: {
    MAX_RETRIES: 3,           // 最大重试次数
    RETRY_DELAY: 1000         // 重试延迟（毫秒）
  }
}

// ==================== 业务配置 ====================
export const APP_CONFIG = {
  // 应用名称
  NAME: '行程一下',
  
  // 版本
  VERSION: '1.0.0',
  
  // 最大历史记录数
  MAX_HISTORY: 30,
  
  // 分享配额奖励
  SHARE_QUOTA_BONUS: 3,
  
  // 输入框最大字符数
  MAX_INPUT_LENGTH: 500
}

// ==================== 导出完整配置 ====================
export default {
  API_CONFIG,
  APP_CONFIG
}
