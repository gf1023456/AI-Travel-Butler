/**
 * AI Travel Butler - Data Normalize & Validation Utilities
 * AI旅行助手 - 数据标准化和验证工具
 */

// 常规城市坐标数据库
const CITY_COORDINATES = {
  '西安': { lat: 34.3416, lng: 108.9398 },
  '北京': { lat: 39.9042, lng: 116.4074 },
  '上海': { lat: 31.2304, lng: 121.4737 },
  '成都': { lat: 30.5728, lng: 104.0668 },
  '重庆': { lat: 29.5630, lng: 106.5516 },
  '广州': { lat: 23.1291, lng: 113.2644 },
  '深圳': { lat: 22.5431, lng: 114.0579 },
  '杭州': { lat: 30.2741, lng: 120.1551 },
  '南京': { lat: 32.0603, lng: 118.7969 },
  '武汉': { lat: 30.5929, lng: 114.3055 },
  '天津': { lat: 39.3434, lng: 117.3616 },
  '苏州': { lat: 31.2989, lng: 120.5853 },
  '东莞': { lat: 23.0213, lng: 113.7517 },
  '佛山': { lat: 23.0217, lng: 113.1216 },
  '中山': { lat: 22.5184, lng: 113.3494 },
  '珠海': { lat: 22.3021, lng: 113.5618 },
  '江门': { lat: 22.5782, lng: 113.0655 },
  '惠州': { lat: 23.1131, lng: 114.4166 },
  '汕头': { lat: 23.3537, lng: 116.6855 },
  '厦门': { lat: 24.4798, lng: 118.0894 },
  '青岛': { lat: 36.0671, lng: 120.3826 },
  '沈阳': { lat: 41.8057, lng: 123.4314 },
  '大连': { lat: 38.9140, lng: 121.6147 },
  '郑州': { lat: 34.7474, lng: 113.6249 },
  '长沙': { lat: 28.1978, lng: 112.9717 },
  '福州': { lat: 26.0745, lng: 109.3187 },
  '石家庄': { lat: 38.0423, lng: 114.5143 },
  '合肥': { lat: 31.8206, lng: 117.2272 },
  '南宁': { lat: 22.8154, lng: 108.3571 },
  '哈尔滨': { lat: 45.8037, lng: 126.5349 },
  '西安': { lat: 34.3416, lng: 108.9398 },
  '昆明': { lat: 25.0211, lng: 102.7123 },
  '乌鲁木齐': { lat: 43.7934, lng: 87.6294 },
  '南昌': { lat: 28.4527, lng: 115.9115 },
  '兰州': { lat: 36.0611, lng: 103.8343 },
  '太原': { lat: 37.8705, lng: 112.5489 },
  '贵阳': { lat: 26.5981, lng: 106.7127 },
  '海口': { lat: 20.0173, lng: 110.3492 },
  '银川': { lat: 38.4871, lng: 106.2307 },
  '西宁': { lat: 36.6209, lng: 101.7775 },
  '拉萨': { lat: 29.6456, lng: 91.1172 },
  '呼和浩特': { lat: 40.8183, lng: 111.7675 },
  '长春': { lat: 43.8171, lng: 125.3235 },
  '唐山': { lat: 39.6305, lng: 118.1804 },
  '淄博': { lat: 36.8117, lng: 118.0560 },
  '扬州': { lat: 32.3921, lng: 119.4209 },
  '烟台': { lat: 37.4636, lng: 121.4480 },
  '温州': { lat: 28.0005, lng: 120.6919 },
  '绍兴': { lat: 30.0305, lng: 120.5690 },
  '嘉兴': { lat: 30.7525, lng: 120.7500 },
  '金华': { lat: 29.0792, lng: 120.0044 },
  '泰州': { lat: 32.4849, lng: 119.9152 },
  '镇江': { lat: 32.2042, lng: 119.4552 },
  '盐城': { lat: 33.3776, lng: 120.1399 },
  '潍坊': { lat: 36.7161, lng: 119.1071 },
  '临沂': { lat: 35.0523, lng: 117.9981 },
  '济宁': { lat: 35.4151, lng: 116.5910 },
  '芜湖': { lat: 31.3526, lng: 118.3759 },
  '安庆': { lat: 30.5075, lng: 117.0476 },
  '蚌埠': { lat: 32.9162, lng: 117.3894 },
  '九江': { lat: 29.7064, lng: 115.9924 },
  '洛阳': { lat: 34.6189, lng: 112.4543 },
  '安阳': { lat: 36.0999, lng: 114.3562 },
  '南阳': { lat: 32.9903, lng: 112.5291 },
  '秦皇岛': { lat: 39.9388, lng: 119.5831 },
  '廊坊': { lat: 39.5362, lng: 116.6965 },
  '淄博': { lat: 36.8117, lng: 118.0560 },
  '邢台': { lat: 37.0701, lng: 114.4949 },
  '保定': { lat: 38.8634, lng: 115.4823 },
  '张家口': { lat: 40.7684, lng: 114.8861 },
  '承德': { lat: 40.9551, lng: 117.9556 },
  '沧州': { lat: 38.3042, lng: 116.8380 },
  '衡水': { lat: 37.5379, lng: 115.6649 },
  '邯郸': { lat: 36.5881, lng: 114.4775 },
  '大同': { lat: 40.0742, lng: 113.3089 },
  '包头': { lat: 40.6582, lng: 109.8422 },
  '鄂尔多斯': { lat: 39.6040, lng: 109.7813 },
  '东营': { lat: 37.4355, lng: 118.6699 },
  '威海': { lat: 37.5125, lng: 122.0877 },
  '日照': { lat: 35.4160, lng: 119.5273 },
  '枣庄': { lat: 34.8053, lng: 117.3239 },
  '德州': { lat: 37.4535, lng: 116.2996 },
  '聊城': { lat: 36.4570, lng: 115.9849 },
  '滨州': { lat: 37.3745, lng: 118.0191 },
  '菏泽': { lat: 35.2419, lng: 115.4694 },
  '莱芜': { lat: 36.2107, lng: 117.6668 },
  '泰安': { lat: 36.1949, lng: 117.1278 },
  '济宁': { lat: 35.4151, lng: 116.5910 },
  '临沂': { lat: 35.0523, lng: 117.9981 },
  '台州': { lat: 28.6562, lng: 121.4225 },
  '湖州': { lat: 30.8945, lng: 120.0883 },
  '嘉兴': { lat: 30.7525, lng: 120.7500 },
  '舟山': { lat: 30.0154, lng: 122.2060 },
  '衢州': { lat: 28.9412, lng: 118.8745 },
  '丽水': { lat: 28.4507, lng: 119.9190 },
  '马鞍山': { lat: 31.7302, lng: 118.5320 },
  '淮北': { lat: 33.9557, lng: 116.7891 },
  '铜陵': { lat: 30.9458, lng: 117.8165 },
  '安庆': { lat: 30.5075, lng: 117.0476 },
  '黄山': { lat: 29.7089, lng: 118.3424 },
  '滁州': { lat: 32.3195, lng: 118.3398 },
  '阜阳': { lat: 32.9346, lng: 115.7785 },
  '宿州': { lat: 33.6413, lng: 116.9849 },
  '六安': { lat: 31.7341, lng: 116.4957 },
  '亳州': { lat: 33.8555, lng: 115.7869 },
  '池州': { lat: 30.6639, lng: 117.5797 },
  '宣城': { lat: 30.9408, lng: 118.7572 },
  '福州': { lat: 26.0745, lng: 119.3062 },
  '厦门': { lat: 24.4798, lng: 118.0894 },
  '泉州': { lat: 24.8464, lng: 118.6762 },
  '漳州': { lat: 24.5199, lng: 117.6782 },
  '南平': { lat: 26.6356, lng: 118.1705 },
  '三明': { lat: 26.2640, lng: 117.6391 },
  '莆田': { lat: 25.4396, lng: 119.0059 },
  '龙岩': { lat: 25.0458, lng: 117.0177 },
  '宁德': { lat: 26.6590, lng: 119.5225 },
  '鹰潭': { lat: 28.2345, lng: 117.0864 },
  '新余': { lat: 27.8049, lng: 114.9173 },
  '赣州': { lat: 25.8292, lng: 114.9336 },
  '宜春': { lat: 27.7990, lng: 114.3828 },
  '吉安': { lat: 27.1167, lng: 114.9829 },
  '上饶': { lat: 28.4441, lng: 117.9421 },
  '景德镇': { lat: 29.2927, lng: 117.2079 },
  '萍乡': { lat: 27.6443, lng: 113.8557 },
  '抚州': { lat: 27.9552, lng: 116.3664 },
  '九江': { lat: 29.7064, lng: 115.9924 },
  '遵义': { lat: 27.7257, lng: 106.9025 },
  '六盘水': { lat: 26.5823, lng: 104.8016 },
  '安顺': { lat: 26.2453, lng: 105.9288 },
  '毕节': { lat: 27.3018, lng: 105.2859 },
  '铜仁': { lat: 27.7199, lng: 109.1858 },
  '黔东南': { lat: 26.5781, lng: 107.9792 },
  '黔南': { lat: 26.2553, lng: 107.5225 },
  '黔西南': { lat: 25.0881, lng: 104.9038 },
  '昆明': { lat: 25.0211, lng: 102.7123 },
  '曲靖': { lat: 25.5049, lng: 103.7921 },
  '玉溪': { lat: 24.3505, lng: 102.5442 },
  '保山': { lat: 25.1238, lng: 99.1695 },
  '昭通': { lat: 27.3427, lng: 103.7149 },
  '丽江': { lat: 26.8748, lng: 100.2330 },
  '普洱': { lat: 22.7752, lng: 100.9722 },
  '临沧': { lat: 23.8869, lng: 100.0894 },
  '楚雄': { lat: 25.0325, lng: 101.5286 },
  '红河': { lat: 23.3646, lng: 102.4398 },
  '文山': { lat: 23.3695, lng: 104.2425 },
  '西双版纳': { lat: 22.0025, lng: 100.7997 },
  '大理': { lat: 25.6823, lng: 100.2539 },
  '德宏': { lat: 24.4374, lng: 98.5836 },
  '怒江': { lat: 25.8226, lng: 98.8569 },
  '迪庆': { lat: 27.8233, lng: 99.7026 },
  '成都': { lat: 30.5728, lng: 104.0668 },
  '自贡': { lat: 29.3579, lng: 104.7740 },
  '攀枝花': { lat: 26.5823, lng: 101.7185 },
  '泸州': { lat: 28.8891, lng: 105.4433 },
  '德阳': { lat: 31.1356, lng: 104.3955 },
  '绵阳': { lat: 31.4724, lng: 104.7417 },
  '广元': { lat: 32.4427, lng: 105.7173 },
  '遂宁': { lat: 30.5328, lng: 105.5928 },
  '内江': { lat: 29.5820, lng: 105.0578 },
  '乐山': { lat: 29.6017, lng: 103.7658 },
  '南充': { lat: 30.8375, lng: 106.1107 },
  '眉山': { lat: 31.0962, lng: 103.8231 },
  '宜宾': { lat: 28.7516, lng: 104.6416 },
  '广安': { lat: 30.4736, lng: 106.6351 },
  '达州': { lat: 31.2094, lng: 107.4687 },
  '雅安': { lat: 29.9871, lng: 103.0349 },
  '巴中': { lat: 32.1312, lng: 106.8755 },
  '资阳': { lat: 30.1222, lng: 105.1790 },
  '阿坝': { lat: 31.8998, lng: 102.2346 },
  '甘孜': { lat: 30.0510, lng: 101.9630 },
  '凉山': { lat: 27.8868, lng: 102.2587 },
  '拉萨': { lat: 29.6456, lng: 91.1172 },
  '昌都': { lat: 31.1368, lng: 97.1789 },
  '山南': { lat: 29.2271, lng: 91.7731 },
  '日喀则': { lat: 29.2666, lng: 88.8785 },
  '那曲': { lat: 31.4758, lng: 92.0602 },
  '阿里': { lat: 32.5032, lng: 80.1645 },
  '林芝': { lat: 29.6451, lng: 94.3586 }
};

/**
 * 验证和修复JSON参数
 */
export function parseToolArguments(rawArgs) {
  try {
    return JSON.parse(rawArgs);
  } catch (e) {
    console.error(`[ERROR] Failed to parse JSON arguments:`, rawArgs);
    // 尝试使用更高阶的修复策略处理可能的转义问题
    try {
      // 首先尝试去除双重转义
      let correctedArgsStr = rawArgs;
      // 处理常见的双重转义问题
      correctedArgsStr = correctedArgsStr
        .replace(/\\\\\\"/g, '"')  // 将 \\" 转换为 "
        .replace(/\\"/g, '"')     // 将 \" 转换为普通引号
        .replace(/\\\\n/g, '')    // 去除换行符转义
        .replace(/'/g, '"')       // 将单引号转换为双引号
        .replace(/([{,])\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":'); // 补全未加引号的键
      
      // 尝试解析修复后的字符串
      const parsed = JSON.parse(correctedArgsStr);
      console.log(`[PARSED-FIXED] Successfully recovered malformed JSON via escape cleanup`);
      return parsed;
    } catch (parseErr) {
      console.error(`[ERROR] Second attempt to fix malformed JSON also failed:`, parseErr.message);
      // 如果仍不成功，检查原始字符串中是否包含有用信息
      // 从错误字符串中提取可用信息，例如如果字符串看起来像是参数的开始
      try {
        const result = {};
        // 查找和提取基本的JSON结构元素
        const matches = rawArgs.match(/"([^"]+)"\s*:\s*"([^"]+)"/g);
        if (matches) {
          for (const match of matches) {
            const parts = match.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
            if (parts && parts[1] && parts[2]) {
              result[parts[1]] = parts[2].replace(/\\"/g, '"');  // 清理可能的转义字符
            }
          }
        }
        
        if (Object.keys(result).length > 0) {
          console.log(`[PARSED-BASIC] Recovering basic arguments:`, result);
          return result;
        }
      } catch (basicParseErr) {
        console.error(`[ERROR] Could not extract any args from input:`, basicParseErr.message);
      }
      
      // 如果所有尝试都失败，则返回一个默认的空对象
      console.warn('[WARN] Using fallback empty args object');
      return {};
    }
  }
}

/**
 * 标准化地理位置信息
 */
export function normalizeLocation(item = {}, provider) {
  if (!item.name || !item.lat || !item.lng) {
    // 修正：如果关键字段缺失，则进行预测或使用备用逻辑
    if (!item.name) {
      // 预测默认名称
      console.log(`[INFO] Missing location name, generating default`);
      item.name = '未知地点';
    } 
  
    if (!item.lat || !item.lng) {
      // 根据城市信息或其他线索估计位置
      console.log(`[INFO] Missing coordinates, using fallback city center`);
      // 使用默认位置（西安）
      const city = item.city || '西安'; 
      const fallbackCenter = CITY_COORDINATES[city] || CITY_COORDINATES['西安'];
      item.lat = fallbackCenter.lat.toString();
      item.lng = fallbackCenter.lng.toString();
    }
  }

  return {
    name: String(item.name),
    city: String(item.city || ''),
    description: String(item.description || ''),
    lat: String(item.lat),
    lng: String(item.lng),
    time: String(item.time || ''),
    day: Number(item.day || 1),
    sequence: Number(item.sequence || 1),
    transit_hint: String(item.transit_hint || ''),
    category: item.category && typeof item.category === 'string' ? String(item.category) : undefined,
    weather_icon: item.weather_icon && typeof item.weather_icon === 'string' ? String(item.weather_icon) : undefined,
    weather_condition: item.weather_condition && typeof item.weather_condition === 'string' ? String(item.weather_condition) : undefined,
    temperature: item.temperature && typeof item.temperature === 'string' ? String(item.temperature) : undefined,
    source: item.source || `provider:${provider}:location`,
    source_timestamp: new Date().toISOString(),
    confidence: typeof item.confidence === 'number' ? item.confidence : 0.6
  };
}

/**
 * 标准化社交推荐
 */
export function normalizeRecommendations(list, provider) {
  return (list || []).map((r, idx) => ({
    rank: Number(r.rank || idx + 1),
    title: String(r.title || ''),
    platform: String(r.platform || '综合'),
    hot_score: String(r.hot_score || 'N/A'),
    reason: String(r.reason || ''),
    photo_tips: r.photo_tips ? String(r.photo_tips) : undefined,
    source: r.source || `provider:${provider}:social`,
    source_timestamp: new Date().toISOString(),
    confidence: typeof r.confidence === 'number' ? r.confidence : 0.6
  }));
}