
import { FunctionDeclaration, Type } from '@google/genai';

/**
 * 工具 1: 地图标注工具 (location)
 */
export const locationTool: FunctionDeclaration = {
  name: 'location',
  parameters: {
    type: Type.OBJECT,
    description: '在地图上精准标注一个行程地点（景点、餐厅、酒店等），并提供实时天气和详细交通信息。',
    properties: {
      name: { type: Type.STRING, description: '地点名称，例如：故宫博物院' },
      description: { type: Type.STRING, description: '该地点的深度介绍，包含看点、避坑指南和建议游玩时长。' },
      lat: { type: Type.STRING, description: '该地点的精准纬度坐标（字符串格式，如 "39.9172"）' },
      lng: { type: Type.STRING, description: '该地点的精准经度坐标（字符串格式，如 "116.3907"）' },
      time: { type: Type.STRING, description: '建议游玩的时间点或时间段，如 "09:00 - 12:00"' },
      day: { type: Type.NUMBER, description: '行程的第几天，从 1 开始计数' },
      sequence: { type: Type.NUMBER, description: '当天行程的先后顺序，从 1 开始计数' },
      transit_hint: { type: Type.STRING, description: '到达该地点的详细交通建议（如：乘坐地铁1号线至天安门东站B口出，步行200米）。' },
      category: { type: Type.STRING, description: '分类：SIGHT(景点), FOOD(美食), HOTEL(住宿), TRANSIT(交通枢纽)' },
      weather_icon: { type: Type.STRING, description: '该地点的天气图标（Emoji，例如：☀️, ☁️, 🌧️, ❄️）' },
      weather_condition: { type: Type.STRING, description: '实时天气状况描述，例如 "晴朗"、"局部多云"、"阵雨"' },
      temperature: { type: Type.STRING, description: '该地点的当前或预计气温，例如 "22°C"' }
    },
    required: ['name', 'description', 'lat', 'lng', 'time', 'day', 'sequence', 'weather_icon', 'weather_condition', 'temperature', 'transit_hint'],
  },
};

/**
 * 工具 2: 社交平台热门推荐工具 (social_recommendations)
 */
export const socialRecommendationTool: FunctionDeclaration = {
  name: 'get_social_recommendations',
  parameters: {
    type: Type.OBJECT,
    description: '综合小红书和抖音热门笔记，提供至少5个排名靠前的热门打卡建议。',
    properties: {
      recommendations: {
        type: Type.ARRAY,
        description: '排序后的热门推荐列表（至少5项）。',
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.NUMBER, description: '排名 (1-5)' },
            title: { type: Type.STRING, description: '打卡点名称' },
            platform: { type: Type.STRING, description: '推荐来源 (小红书/抖音/综合)' },
            hot_score: { type: Type.STRING, description: '热度分数或人气描述，如 "10w+ 收藏"' },
            reason: { type: Type.STRING, description: '推荐理由：为什么它排在这个位置' },
            photo_tips: { type: Type.STRING, description: '社交平台流传的出片机位或拍照技巧' }
          },
          required: ['rank', 'title', 'platform', 'hot_score', 'reason']
        }
      }
    },
    required: ['recommendations']
  },
};
