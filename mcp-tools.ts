
import { FunctionDeclaration, Type } from '@google/genai';

/**
 * 工具 1: 地图标注工具 (location)
 */
export const locationTool: FunctionDeclaration = {
  name: 'location',
  parameters: {
    type: Type.OBJECT,
    description: '在地图上精准标注一个行程地点（景点、餐厅、酒店等）。',
    properties: {
      name: { type: Type.STRING, description: '地点名称，例如：故宫博物院' },
      description: { type: Type.STRING, description: '该地点的深度介绍，包含看点、避坑指南和建议游玩时长。' },
      lat: { type: Type.STRING, description: '该地点的精准纬度坐标（字符串格式，如 "39.9172"）' },
      lng: { type: Type.STRING, description: '该地点的精准经度坐标（字符串格式，如 "116.3907"）' },
      time: { type: Type.STRING, description: '建议游玩的时间点或时间段，如 "09:00 - 12:00"' },
      day: { type: Type.NUMBER, description: '行程的第几天，从 1 开始计数' },
      sequence: { type: Type.NUMBER, description: '当天行程的先后顺序，从 1 开始计数' },
      transit_hint: { type: Type.STRING, description: '到达该地点的交通建议' },
      category: { type: Type.STRING, description: '分类：SIGHT(景点), FOOD(美食), HOTEL(住宿), TRANSIT(交通枢纽)' },
      weather_icon: { type: Type.STRING, description: '该地点的天气图标（Emoji，例如：☀️, ☁️, 🌧️, ❄️）' },
      temperature: { type: Type.STRING, description: '该地点的预计气温，例如 "22°C"' }
    },
    required: ['name', 'description', 'lat', 'lng', 'time', 'day', 'sequence', 'weather_icon', 'temperature'],
  },
};

/**
 * 工具 2: 小红书内容检索工具 (xhs_search) - 暂未启用
 */
export const xhsSearchTool: FunctionDeclaration = {
  name: 'xhs_search',
  parameters: {
    type: Type.OBJECT,
    description: '从小红书检索实时旅游笔记和拍照位建议。',
    properties: {
      keyword: { type: Type.STRING, description: '搜索关键词' }
    },
    required: ['keyword'],
  },
};
