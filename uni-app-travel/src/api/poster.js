/**
 * 海报生成API
 * 调用后端Python服务生成海报
 */

import { post } from '@/utils/request.js'

/**
 * 生成海报
 * @param {Object} data - 海报数据
 * @param {string} data.itinerarySummary - 行程摘要
 * @param {Array} data.days - 天数列表
 * @param {Array} data.dayPlanItinerary - 行程详情
 * @returns {Promise<Object>} - 返回base64编码的图片数据
 */
export async function generatePoster(data) {
  return await post('/generate-poster-base64', data)
}

/**
 * 下载海报
 * @param {string} imageBase64 - base64编码的图片数据
 * @returns {Promise<string>} - 返回临时文件路径
 */
export async function downloadPoster(imageBase64) {
  return new Promise((resolve, reject) => {
    // 处理base64数据
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    
    // #ifdef MP-WEIXIN
    const fs = wx.getFileSystemManager()
    const fileName = `poster_${Date.now()}.png`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    
    try {
      fs.writeFileSync(filePath, base64Data, 'base64')
      resolve(filePath)
    } catch (error) {
      console.error('保存海报失败:', error)
      reject(error)
    }
    // #endif
    
    // #ifndef MP-WEIXIN
    // H5环境直接返回base64
    resolve(imageBase64)
    // #endif
  })
}
