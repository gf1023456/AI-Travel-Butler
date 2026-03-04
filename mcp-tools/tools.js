/**
 * AI Travel Butler - MCP (Model Context Protocol) Tools Interface
 * 定义标准的MCP工具接口用于旅行规划
 */

// 地理位置相关工具
export const GEOLOCATION_TOOLS = {
  /**
   * 地理编码：将地址转换为坐标
   */
  geocode: {
    name: 'geocode_address',
    description: '将文本地址转换为经纬度坐标',
    parameters: {
      type: 'object',
      properties: {
        address: { type: 'string', description: '输入地址，例如："西安钟楼"' },
        city: { type: 'string', description: '所在城市，用于提高精度' }
      },
      required: ['address']
    }
  },

  /**
   * 逆地理编码：将坐标转换为地址
   */
  reverseGeocode: {
    name: 'reverse_geocode',
    description: '根据经纬度坐标获取详细的地址信息',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: '纬度坐标' },
        longitude: { type: 'number', description: '经度坐标' }
      },
      required: ['latitude', 'longitude']
    }
  }
};

// 路径规划工具
export const ROUTING_TOOLS = {
  /**
   * 获取两地间路线
   */
  getRoute: {
    name: 'get_route',
    description: '获取两点之间的路线规划，包括距离和预估时间',
    parameters: {
      type: 'object',
      properties: {
        from_lat: { type: 'number', description: '起点纬度' },
        from_lng: { type: 'number', description: '起点经度' },
        to_lat: { type: 'number', description: '终点纬度' },
        to_lng: { type: 'number', description: '终点经度' },
        mode: { 
          type: 'string', 
          description: '交通方式', 
          enum: ['driving', 'walking', 'bicycling', 'transit']
        }
      },
      required: ['from_lat', 'from_lng', 'to_lat', 'to_lng']
    }
  }
};

// 天气信息工具
export const WEATHER_TOOLS = {
  /**
   * 获取指定位置天气
   */
  get_weather: {  // 修正名称，让其与AI调用的名称匹配
    name: 'get_weather',
    description: '获取指定地点的当前天气状况',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: '纬度坐标' },
        longitude: { type: 'number', description: '经度坐标' },
        date: { type: 'string', description: '日期，格式：YYYY-MM-DD，留空表示当前天气' }
      },
      required: ['latitude', 'longitude']
    }
  }
};

// POI信息工具
export const POI_TOOLS = {
  /**
   * 获取POI详细信息
   */
  get_poi_info: { // 修正名称，让其与AI调用的名称匹配
    name: 'get_poi_info',
    description: '获取指定地点的详细信息，包括营业时间、评分、价格等',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '地点名称' },
        latitude: { type: 'number', description: '纬度坐标' },
        longitude: { type: 'number', description: '经度坐标' },
        city: { type: 'string', description: '所在城市' }
      },
      required: ['name', 'latitude', 'longitude', 'city']
    }
  }
};

// 旅行规划核心工具
export const TRAVEL_TOOLS = {
  location: {
    name: 'location',
    description: '在地图上精准标注一个行程地点（景点、餐厅、酒店等），并提供实时天气和详细交通信息。',
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
        category: { 
          type: 'string', 
          description: '分类：SIGHT(景点), FOOD(美食), HOTEL(住宿), TRANSIT(交通枢纽)',
          enum: ['SIGHT', 'FOOD', 'HOTEL', 'TRANSIT']
        },
        weather_icon: { type: 'string', description: '该地点的天气图标（Emoji，例如：☀️, ☁️, 🌧️, ❄️）' },
        weather_condition: { type: 'string', description: '实时天气状况描述，例如 "晴朗"、"局部多云"、"阵雨"' },
        temperature: { type: 'string', description: '该地点的当前或预计气温，例如 "22°C"' }
      },
      required: ['name', 'city', 'description', 'lat', 'lng', 'time', 'day', 'sequence', 'weather_icon', 'weather_condition', 'temperature', 'transit_hint'],
    },
  }
};

export const SOCIAL_RECOMMENDATION_TOOL = {
  name: 'get_social_recommendations',
  description: '综合小红书和抖音热门笔记，提供至少5个排名靠前的热门打卡建议。',
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
  },
};

// 合并所有工具
export const ALL_MCP_TOOLS = {
  ...GEOLOCATION_TOOLS,
  ...ROUTING_TOOLS,
  ...WEATHER_TOOLS,
  ...POI_TOOLS,
  ...TRAVEL_TOOLS
};

export function getToolByName(name) {
  const allTools = { 
    ...GEOLOCATION_TOOLS,
    ...ROUTING_TOOLS,
    ...WEATHER_TOOLS,
    ...POI_TOOLS,
    ...TRAVEL_TOOLS,
    get_social_recommendations: SOCIAL_RECOMMENDATION_TOOL 
  };
  return allTools[name];
}

export function getAllToolNames() {
  const allTools = { 
    ...GEOLOCATION_TOOLS,
    ...ROUTING_TOOLS,
    ...WEATHER_TOOLS,
    ...POI_TOOLS,
    ...TRAVEL_TOOLS,
    get_social_recommendations: SOCIAL_RECOMMENDATION_TOOL 
  };
  return Object.keys(allTools);
}