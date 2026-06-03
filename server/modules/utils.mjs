/**
 * AI Travel Butler - Utility Functions
 * 各用函数库
 */


 /**
  * 获取城市中心坐标
  */
 export function getCityCenter(city) {
  const map = {
    '大理': { lat: 25.6075, lng: 100.2676 },
    '呼和浩特': { lat: 40.8426, lng: 111.7492 },
    '西安': { lat: 34.3416, lng: 108.9398 },
    '北京': { lat: 39.9042, lng: 116.4074 },
    '上海': { lat: 31.2304, lng: 121.4737 },
    '成都': { lat: 30.5728, lng: 104.0668 },
    '重庆': { lat: 29.563, lng: 106.5516 },
    '广州': { lat: 23.1291, lng: 113.2644 },
    '深圳': { lat: 22.5431, lng: 114.0579 },
    '杭州': { lat: 30.2741, lng: 120.1551 },
    '南京': { lat: 32.0603, lng: 118.7969 },
    '苏州': { lat: 31.2989, lng: 120.5853 },
    '昆明': { lat: 25.0389, lng: 102.7183 },
    '丽江': { lat: 26.8721, lng: 100.2296 }
  };
  return map[city] || { lat: 39.9042, lng: 116.4074 };
}

/**
 * 从请求中推断城市
 */
export function inferCityFromRequest(userInput, recommendations) {
  const text = String(userInput || '');
  const fromRecs = (recommendations || [])
    .map((x) => `${x.title || ''} ${x.reason || ''}`)
    .join(' ');
  const combined = `${text} ${fromRecs}`;

  const known = ['大理', '呼和浩特', '西安', '北京', '上海', '成都', '重庆', '广州', '深圳', '杭州', '南京', '苏州', '昆明', '丽江'];
  for (const city of known) {
    if (combined.includes(city)) return city;
  }
  return '';
}

/**
 * 推断请求天数
 */
export function inferRequestedDays(userInput) {
  const text = String(userInput || '');
  const direct = text.match(/(\d+)\s*[天日]/);
  if (direct) return Math.min(10, Math.max(1, Number(direct[1])));
  if (/一[天日]/.test(text)) return 1;
  if (/两[天日]|二[天日]/.test(text)) return 2;
  if (/三[天日]/.test(text)) return 3;
  if (/四[天日]/.test(text)) return 4;
  if (/五[天日]/.test(text)) return 5;
  return 1;
}

/**
 * 从输入中提取目的地
 */
export function extractDestinationFromInput(userInput) {
  const text = String(userInput || '');
  const routeMatch = text.match(/从\s*([一-龥A-Za-z]+)\s*(到|去|前往|->|→)\s*([一-龥A-Za-z]+)/);
  if (routeMatch?.[3]) return routeMatch[3];
  const toMatch = text.match(/到\s*([一-龥A-Za-z]+)/);
  if (toMatch?.[1]) return toMatch[1];
  return '';
}

/**
 * 估算天气
 */
export function estimateWeatherByHour(timeRange) {
  const firstHour = Number(String(timeRange || '').match(/(\d{1,2})/)?.[1] || 12);
  if (firstHour <= 8) return { weather_icon: '🌤️', weather_condition: '清晨晴朗', temperature: '18°C' };
  if (firstHour <= 16) return { weather_icon: '☀️', weather_condition: '白天晴朗', temperature: '25°C' };
  return { weather_icon: '🌙', weather_condition: '夜间微风', temperature: '20°C' };
}