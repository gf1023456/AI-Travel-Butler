/**
 * AI Travel Butler - Tools Definitions Module
 * 定义AI工具接口规范
 */

export const locationTool = {
  name: 'location',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '地点名称，例如：故宫博物院' },
      city: { type: 'string', description: '该地点所属的城市名称，例如 "北京"。关键字段：用于区分出发地和目的地。' },
      description: { type: 'string', description: '该地点的深度介绍，包含看点、避坑指南和建议游玩时长。' },
      lat: { type: 'string', description: '该地点的精准纬度坐标（字符串格式，如 "39.9172"）' },
      lng: { type: 'string', description: '该地点的精准经度坐标（字符串格式，如 "116.3907"）' },
      time: { type: 'string', description: '建议游玩的时间点或时间段，如 "09:00 - 12:00"' },
      day: { type: 'number', description: '行程的第几天，从 1 开始计数' },
      sequence: { type: 'number', description: '当天行程的先后顺序，从 1 开始计数' },
      transit_hint: { type: 'string', description: '到达该地点的详细交通建议（如：乘坐地铁1号线至天安门东站B口出，步行200米）。' },
      category: { type: 'string', description: '分类：SIGHT(景点), FOOD(美食), HOTEL(住宿), TRANSIT(交通枢纽)', enum: ['SIGHT', 'FOOD', 'HOTEL', 'TRANSIT'] },
      weather_icon: { type: 'string', description: '该地点的天气图标（Emoji，例如：☀️, ☁️, 🌧️, ❄️）' },
      weather_condition: { type: 'string', description: '实时天气状况描述，例如 "晴朗"、"局部多云"、"阵雨"' },
      temperature: { type: 'string', description: '该地点的当前或预计气温，例如 "22°C"' }
    },
    required: ['name', 'city', 'description', 'lat', 'lng', 'time', 'day', 'sequence', 'transit_hint']
  }
};

export const socialRecommendationTool = {
  name: 'get_social_recommendations',
  parameters: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        description: '排序后的热门推荐列表（至少5项）。',
        items: {
          type: 'object',
          properties: {
            rank: { type: 'number', description: '排名 (1-5)' },
            title: { type: 'string', description: '打卡点名称' },
            platform: { 
              type: 'string', 
              description: '推荐来源 (小红书/抖音/综合)', 
              enum: ['xiaohongshu', 'douyin', 'weibo', 'all'] 
            },
            hot_score: { type: 'string', description: '热度分数或人气描述，如 "10w+ 收藏"' },
            reason: { type: 'string', description: '推荐理由：为什么它排在这个位置' },
            photo_tips: { type: 'string', description: '社交平台流传的出片机位或拍照技巧' }
          },
          required: ['rank', 'title', 'platform', 'hot_score', 'reason']
        }
      }
    },
    required: ['recommendations']
  }
};

export const tools = {
  location: locationTool,
  socialRecommendations: socialRecommendationTool
};