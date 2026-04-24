/**
 * AI Travel Butler - MCP Enhancement Tools
 * 使用MCP工具增强行程数据
 */

import { handleBatchMcpInvocations } from '../../mcp-tools/index.js';

/**
 * 使用MCP工具增强行程数据
 */
export async function enrichWithMcpData(items, mcpTrace) {
  if (!items || items.length === 0) return [];

  // 为行程中的每个地点调用MCP工具来获取更多信息
  // 但仅限于非fallback和合理坐标范围内的地点
  const mcpToolCalls = [];

  for (const item of items) {
    // 验证坐标是否有效，以及避免处理由社交推荐生成的假坐标
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    const cityName = item.city;
    const placeName = item.name;

    // 验证坐标是否在合理范围内（地球坐标的大概范围）
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.log(`[MCP DEBUG] Skipping location with invalid coordinates: ${placeName} (${item.lat}, ${item.lng})`);
      continue;
    }

    // 遵活处理各种来源的位置（包括social_to_location生成的位置等）
    if (lat && lng && placeName) {
      mcpToolCalls.push({
        name: 'get_weather',
        args: {
          latitude: lat,
          longitude: lng
        }
      });

      mcpToolCalls.push({
        name: 'get_poi_info',
        args: {
          name: placeName,
          latitude: lat,
          longitude: lng,
          city: cityName
        }
      });
    }
  }

  // 如果没有有效的MCP工具调用，返回空数组
  if (mcpToolCalls.length === 0) {
    console.log('[MCP DEBUG] No valid MCP tool calls generated.');
    return [];
  }

  // 调用MCP工具来获取信息
  console.log(`[MCP DEBUG] Executing ${mcpToolCalls.length} MCP tool calls`);
  const results = await handleBatchMcpInvocations(mcpToolCalls);
  
  // 记录MCP工具调用结果
  results.forEach(result => {
    mcpTrace.push(`mcp-call:${result.toolName}:${result.success ? 'success' : 'fail'}`);
  });

  return results;
}

/**
 * 将MCP结果整合到行程计划中
 */
export function incorporateMcpResults(planResult, mcpResults) {
  // 将MCP获取的实时数据整合到计划结果中
  if (!mcpResults || mcpResults.length === 0) {
    return planResult;
  }
  
  const updatedPlan = { ...planResult };
  
  // 创建一个按名称/坐标查找的索引，使匹配MCP结果到正确的地点
  const locationMap = new Map();
  if (updatedPlan.dayPlanItinerary && Array.isArray(updatedPlan.dayPlanItinerary)) {
    updatedPlan.dayPlanItinerary.forEach((location, index) => {
      const key = `${location.name}_${location.city}_${location.lat}_${location.lng}`;
      locationMap.set(key, index);
    });
  }
  
  // 遍历MCP结果并更新计划中的地点信息
  for (const mcpResult of mcpResults) {
    if (mcpResult.success && mcpResult.result) {
      // 根据MCP工具类型更新相应信息
      switch(mcpResult.toolName) {
        case 'get_weather':
          // 更新相关位置的天气信息
          if (updatedPlan.dayPlanItinerary) {
            updatedPlan.dayPlanItinerary = updatedPlan.dayPlanItinerary.map(location => {
              // 基于位置坐标判断哪些地点受影响（容差0.01度）
              const locationLat = parseFloat(location.lat);
              const locationLng = parseFloat(location.lng);
              const targetLat = mcpResult.args.latitude;
              const targetLng = mcpResult.args.longitude;
              
              if (
                targetLat && 
                targetLng && 
                locationLat && 
                locationLng &&
                Math.abs(locationLat - targetLat) < 0.01 &&
                Math.abs(locationLng - targetLng) < 0.01
              ) {
                return {
                  ...location,
                  weather_icon: mcpResult.result.condition ? getWeatherIcon(mcpResult.result.condition) : location.weather_icon,
                  weather_condition: mcpResult.result.condition || location.weather_condition,
                  temperature: mcpResult.result.temperature || location.temperature
                };
              }
              return location;
            });
          }
          break;
          
        case 'get_poi_info':
          // 更新POI信息
          if (updatedPlan.dayPlanItinerary) {
            updatedPlan.dayPlanItinerary = updatedPlan.dayPlanItinerary.map(location => {
              if (
                location.name === mcpResult.args.name && 
                mcpResult.args.latitude && 
                mcpResult.args.longitude &&
                Math.abs(parseFloat(location.lat) - mcpResult.args.latitude) < 0.01 &&
                Math.abs(parseFloat(location.lng) - mcpResult.args.longitude) < 0.01
              ) {
                return {
                  ...location,
                  description: mcpResult.result.description || location.description,
                  opening_hours: mcpResult.result.opening_hours || undefined,
                  rating: mcpResult.result.rating || undefined,
                  estimated_cost: mcpResult.result.ticket_info ? 
                    parseInt(mcpResult.result.ticket_info.replace(/[^\d]/g, '')) || location.estimated_cost :
                    location.estimated_cost,
                  visit_duration: mcpResult.result.estimated_visit_time || location.visit_duration,
                  address: mcpResult.result.address || undefined,
                  phone: mcpResult.result.phone || undefined,
                  website: mcpResult.result.website || undefined
                };
              }
              return location;
            });
          }
          break;
          
        case 'get_route':
          // 更新路线交通信息
          break; // 当前我们不在route信息上做特殊处理
      }
    }
  }
  
  return updatedPlan;
}

// 天气图标映射
function getWeatherIcon(condition) {
  const iconMap = {
    '晴': '☀️',
    '多云': '⛅',
    '阴': '☁️',
    '雨': '🌧️',
    '雪': '❄️',
    '雾': '🌫️',
    '霾': '😶‍🌫️'
  };
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (condition.includes(key)) return icon;
  }
  
  return '🌤️'; // 默认天气图标
}