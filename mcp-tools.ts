
import { FunctionDeclaration, Type } from '@google/genai';

/**
 * 工具 1: 地图标注工具 (location)
 */
export const locationTool: FunctionDeclaration = {
  name: 'location',
  parameters: {
    type: Type.OBJECT,
    description: '在地图上标注一个具体的行程地点（景点、餐厅、酒店或交通枢纽）。',
    properties: {
      name: { type: Type.STRING, description: '地点名称' },
      description: { type: Type.STRING, description: '地点详细描述，包含该处的看点、建议游玩方式、拍照建议或避坑指南。' },
      lat: { type: Type.STRING, description: '精准纬度' },
      lng: { type: Type.STRING, description: '精准经度' },
      time: { type: Type.STRING, description: '建议在该点的时间段，例如 09:00 - 11:00' },
      day: { type: Type.NUMBER, description: '所在天数 (1, 2, ...)' },
      sequence: { type: Type.NUMBER, description: '当天游玩的先后顺序' },
      transit_hint: { type: Type.STRING, description: '到达或离开该地点的交通建议' },
      category: { type: Type.STRING, description: '地点分类：SIGHT (景点), FOOD (餐饮), TRANSIT (交通), HOTEL (住宿)' },
      weather: { type: Type.STRING, description: '预期的当地天气或气候特点描述' },
      temperature: { type: Type.STRING, description: '建议游玩的体感温度范围' }
    },
    required: ['name', 'description', 'lat', 'lng', 'time', 'day', 'sequence', 'weather', 'temperature'],
  },
};

/**
 * 工具 2: 小红书内容检索工具 (xhs_search)
 * 暂未启用，保持定义
 */
export const xhsSearchTool: FunctionDeclaration = {
  name: 'xhs_search',
  parameters: {
    type: Type.OBJECT,
    description: '从小红书检索实时旅游笔记、拍照位和用户评价。',
    properties: {
      keyword: { type: Type.STRING, description: '搜索关键词' },
      note_type: { 
        type: Type.INTEGER, 
        description: '0: 全部, 1: 视频, 2: 图文' 
      },
      sort: { 
        type: Type.STRING, 
        description: '排序方式: general(综合), time_descending(最新), popularity_descending(最热)' 
      }
    },
    required: ['keyword'],
  },
};
