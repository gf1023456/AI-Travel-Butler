/**
 * AI Travel Butler - MCP Tools Implementation
 * 实现MCP工具的真实API功能逻辑
 */

/**
 * 通过外部服务获取地理编码
 */
export async function geocodeAddress(addressOrArgs, cityOrUndefined = undefined) {
  // 为了向前兼容，检查调用方式
  let address, city;
  
  if (typeof addressOrArgs === 'object' && addressOrArgs !== null) {
    // 被作为参数对象调用，如 {address: "...", city: "..."}  
    address = addressOrArgs.address || '';
    city = addressOrArgs.city || '';
  } else {
    // 被作为单独参数调用，如 ("address", "city")
    address = addressOrArgs;
    city = cityOrUndefined || '';
  }
  
  const { external_apis = {} } = globalThis.SERVER_CONFIG || {};
  const apiKey = external_apis.amapApiKey || process.env.AMAP_API_KEY || '';
  
  try {
    // 如果提供了有效的外部API密钥，则调用真实API
    if (apiKey && apiKey !== '') {
      const encodedAddress = encodeURIComponent(address);
      const encodedCity = encodeURIComponent(city);
      const geocodeUrl = `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodedAddress}${city ? `&city=${encodedCity}` : ''}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      try {
        const response = await fetch(geocodeUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
            const location = data.geocodes[0].location.split(',');
            return {
              lat: parseFloat(location[1]),
              lng: parseFloat(location[0]),
              formatted_address: data.geocodes[0].formatted_address || `${address}, ${city}`,
              accuracy: data.geocodes[0].level || 'point'
            };
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn('[MCP] Geocode request timed out for:', address);
        } else {
          console.warn('[MCP] Geocode fetch error:', err.message);
        }
      }
    }
    
    console.log(`[MCP] Geocode fallback for: ${address}, ${city}`);
    return mockFallbackGeocode(address);
  } catch (error) {
    console.error(`[MCP] Failed to geocode address: ${address}`, error);
    return mockFallbackGeocode(address);
  }
}

/**
 * 通过外部服务获取逆地理编码
 */
export async function reverseGeocode(latOrArgs, lngOrUndefined) {
  let latitude, longitude;
  
  if (typeof latOrArgs === 'object' && latOrArgs !== null) {
    // 被作为参数对象调用，如 {latitude: 39.9042, longitude: 116.4074}
    latitude = latOrArgs.latitude;
    longitude = latOrArgs.longitude;
  } else {
    // 被作为独立参数调用，如 (39.9042, 116.4074)
    latitude = latOrArgs;
    longitude = lngOrUndefined;
  }
  
  try {
    const { external_apis = {} } = globalThis.SERVER_CONFIG || {};
    const apiKey = external_apis.amapApiKey || process.env.AMAP_API_KEY || '';
    
    if (apiKey && apiKey !== '') {
      const reverseUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${longitude},${latitude}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      try {
        const response = await fetch(reverseUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === '1' && data.regeocode) {
            const addr = data.regeocode.formatted_address;
            return {
              address: addr,
              city: data.regeocode.addressComponent.city,
              province: data.regeocode.addressComponent.province,
              district: data.regeocode.addressComponent.district,
              country: '中国',
              postal_code: data.regeocode.addressComponent.adcode,
              accuracy: 'precise'
            };
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn('[MCP] Reverse geocode request timed out for:', latitude, longitude);
        } else {
          console.warn('[MCP] Reverse geocode fetch error:', err.message);
        }
      }
    }
    
    console.log(`[MCP] Reverse geocode fallback for: ${latitude}, ${longitude}`);
    return mockFallbackReverseGeocode(latitude, longitude);
  } catch (error) {
    console.error(`[MCP] Failed to reverse geocode: ${latitude}, ${longitude}`, error);
    return mockFallbackReverseGeocode(latitude, longitude);
  }
}

/**
 * 通过外部服务获取路线规划
 */
export async function getRoute(fromLatOrArgs, fromLngOrObject, toLatOrUndef, toLngOrUndef, modeOrUndef = 'driving') {
  let from_lat, from_lng, to_lat, to_lng, mode;
  
  if (typeof fromLatOrArgs === 'object' && fromLatOrArgs !== null) {
    // 作为参数对象调用
    from_lat = fromLatOrArgs.from_lat;
    from_lng = fromLatOrArgs.from_lng;
    to_lat = fromLatOrArgs.to_lat;
    to_lng = fromLatOrArgs.to_lng;
    mode = fromLatOrArgs.mode || 'driving';
  } else {
    // 作为独立参数调用
    from_lat = fromLatOrArgs;
    from_lng = fromLngOrObject;
    to_lat = toLatOrUndef;
    to_lng = toLngOrUndef;
    mode = modeOrUndef;
  }
  
  try {
    const { external_apis = {} } = globalThis.SERVER_CONFIG || {};
    const apiKey = external_apis.amapApiKey || process.env.AMAP_API_KEY || '';
    
    if (apiKey && apiKey !== '') {
      const routeUrl = `https://restapi.amap.com/v3/direction/${mode}?key=${apiKey}&origin=${from_lng},${from_lat}&destination=${to_lng},${to_lat}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
      
      try {
        const response = await fetch(routeUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === '1' && data.route && data.route.paths && data.route.paths.length > 0) {
            const path = data.route.paths[0];
            const steps = path.steps ? path.steps.map(step => ({
              instruction: step.instruction,
              distance: `${step.distance} 米`,
              duration: `${Number(step.duration)} 秒`
            })) : [];
            
            return {
              distance: `${Number(path.distance)} 米`,
              duration: `${Math.ceil(Number(path.duration) / 60)} 分钟`,
              steps: steps,
              tolls: Number(path.tolls) || 0,
              tolls_amount: Number(path.toll_costs) || 0
            };
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn('[MCP] Route request timed out for path:', from_lat, from_lng, 'to', to_lat, to_lng);
        } else {
          console.warn('[MCP] Route fetch error:', err.message);
        }
      }
    }
    
    console.log(`[MCP] Route fallback for: (${from_lat},${from_lng}) -> (${to_lat},${to_lng})`);
    return calculateRouteEstimate(from_lat, from_lng, to_lat, to_lng, mode);
  } catch (error) {
    console.error(`[MCP] Failed to get route from (${from_lat},${from_lng}) to (${to_lat},${to_lng})`, error);
    return calculateRouteEstimate(from_lat, from_lng, to_lat, to_lng, mode);
  }
}

/**
 * 通过外部服务获取天气信息
 */
export async function getWeather(latOrArgs, lonOrDate, dateOrUndef = null) {
  let latitude, longitude, date;
  
  if (typeof latOrArgs === 'object' && latOrArgs !== null) {
    // 作为参数对象调用，如 {latitude: ..., longitude: ..., date: ...}
    latitude = latOrArgs.latitude;
    longitude = latOrArgs.longitude;
    date = latOrArgs.date || null;
  } else {
    // 作为独立参数调用，如 (39.9042, 116.4074, null)
    latitude = latOrArgs;
    longitude = lonOrDate;
    date = dateOrUndef;
  }
  
  try {
    const { external_apis = {} } = globalThis.SERVER_CONFIG || {};
    const weatherApiKey = external_apis.weatherApiKeyKeyName || process.env.WEATHER_API_KEY || '';
    
    if (weatherApiKey && weatherApiKey !== '') {
      // 使用和风天气或其他天气服务API
      const weatherUrl = `https://devapi.qweather.com/v7/weather/now?location=${longitude},${latitude}&key=${weatherApiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      try {
        const response = await fetch(weatherUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          
          if (data.code === '200' && data.now) {
            return {
              location: data.station ? data.station.name : 'Location Unknown',
              temperature: `${data.now.temp}°C`,
              condition: data.now.text,
              feels_like: `${data.now.feelsLike}°C`,
              humidity: `${data.now.humidity}%`,
              wind_speed: `${data.now.windScale}级`,
              wind_direction: data.now.windDir,
              wind_power: data.now.windPower,
              pressure: `${data.now.pressure} hPa`,
              visibility: `${data.now.vis} km`,
              uv_index: data.now.uvIndex,
              date: date || new Date().toISOString().split('T')[0],
              source: 'real-api'
            };
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn('[MCP] Weather request timed out for:', latitude, longitude);
        } else {
          console.warn('[MCP] Weather fetch error:', err.message);
        }
      }
    }
    
    console.log(`[MCP] Weather fallback for: ${latitude}, ${longitude}`);
    return generateMockWeather(latitude, longitude, date);
  } catch (error) {
    console.error(`[MCP] Failed to get weather for (${latitude},${longitude})`, error);
    return generateMockWeather(latitude, longitude, date);
  }
}

/* 模拟API调用函数（备用/没有API密钥时使用） */


function mockFallbackGeocode(address) {
  // 基于名称的粗略估算
  if (address.includes('西安')) {
    return {
      lat: 34.3416,
      lng: 108.9398,
      formatted_address: address,
      accuracy: 'city'
    };
  } else if (address.includes('北京')) {
    return {
      lat: 39.9042,
      lng: 116.4074,
      formatted_address: address,
      accuracy: 'city'
    };
  }
  // 默认返回西安附近的一个点
  return {
    lat: 34.3416,
    lng: 108.9398,
    formatted_address: address,
    accuracy: 'approximate'
  };
}

function mockFallbackReverseGeocode(lat, lng) {
  return {
    address: `位置近似于纬度${lat.toFixed(4)}, 经度${lng.toFixed(4)}`,
    city: '西安',  // 默认城市
    country: '中国',
    accuracy: 'coordinate-approximate'
  };
}

function calculateRouteEstimate(from_lat, from_lng, to_lat, to_lng, mode = 'driving') {
  const distance = calculateDistance(from_lat, from_lng, to_lat, to_lng);
  const timeEstimates = {
    driving: distance * 3,  // 每公里3分钟
    walking: distance * 15, // 每公里15分钟
    bicycling: distance * 5 // 每公里5分钟
  };
  
  return {
    distance: `${distance.toFixed(2)} 公里`,
    duration: `${Math.ceil(timeEstimates[mode || 'driving'])} 分钟`,
    steps: [
      { instruction: `从起点驶向目标位置`, distance: `${distance.toFixed(2)} km`, duration: `${Math.ceil(timeEstimates[mode])} min` }
    ],
    estimated: true
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // 使用球面几何计算距离
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); // distance in km
}

function generateMockWeather(lat, lng, date) {
  const temp = Math.floor(Math.random() * 25) + 10;
  const conditions = ['晴', '多云', '阴', '小雨', '霾'];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  
  return {
    location: '位置预估',
    temperature: `${temp}°C`,
    condition: condition,
    humidity: `${Math.floor(Math.random() * 40) + 40}%`,
    wind_speed: `${Math.floor(Math.random() * 5) + 1}级`,
    precipitation_probability: `${Math.floor(Math.random() * 30)}%`,
    date: date || new Date().toISOString().split('T')[0],
    source: 'estimate'
  };
}

function generateMockPoiInfo(name, lat, lng, city) {
  return {
    name: name,
    city: city,
    rating: (Math.random() * 2 + 3).toFixed(1),
    review_count: Math.floor(Math.random() * 5000) + 100,
    category: '未定义',
    opening_hours: '09:00-17:00',
    phone: null,
    ticket_info: '价格未知',
    estimated_visit_time: '2-3小时',
    description: `${name}是一个不错的地方.`,
    source: 'estimate'
  };
}

// 简单的字符串相似度计算函数
function levenshteinDistance(str1, str2) {
  const matrix = [];

  // 首先设置第一行
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  // 然后设置第一列
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // 计算矩阵
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 删除
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}