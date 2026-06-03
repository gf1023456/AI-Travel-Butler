/**
 * AI Travel Butler - Post-processing Functions
 * 行程优化和后处理函数
 */

import { getCityCenter, extractDestinationFromInput, inferCityFromRequest, inferRequestedDays } from './utils.mjs';
import { normalizeLocation } from './normalizer.mjs';

/**
 * 从输入中提取预期的城市
 */
export function extractExpectedCityFromInput(userInput, socialRecommendations) {
  return inferCityFromRequest(userInput, socialRecommendations) || '';
}

/**
 * 和谐化行程中的城市（确保所有地点都在同一城市）
 */
export function harmonizeItineraryCity(items, expectedCity, mcpTrace) {
  if (!expectedCity) return items;
  let replaced = 0;
  const normalized = (items || []).map((item) => {
    if (item.city === expectedCity) return item;
    replaced += 1;
    return { ...item, city: expectedCity };
  });
  if (replaced > 0) mcpTrace.push(`postprocess:city_aligned:${expectedCity}:count:${replaced}`);
  return normalized;
}

/**
 * 从社会推荐中生成位置（备用方案）
 */
export function synthesizeLocationsFromSocial({ userInput, socialRecommendations, provider, mcpTrace }) {
  if (!Array.isArray(socialRecommendations) || socialRecommendations.length === 0) return [];
  const city = inferCityFromRequest(userInput, socialRecommendations);
  const center = getCityCenter(city || '北京');
  const requestedDays = inferRequestedDays(userInput);
  const targetCount = Math.min(12, Math.max(4, requestedDays * 3));
  const picks = [];
  for (let i = 0; i < targetCount; i += 1) {
    picks.push(socialRecommendations[i % socialRecommendations.length]);
  }
  const slots = ['09:30 - 11:00', '12:30 - 14:00', '15:30 - 17:00', '19:00 - 21:00'];

  const items = picks.map((rec, idx) => normalizeLocation({
    name: rec.title,
    city: city || '目的地待确认',
    description: rec.reason || `热门打卡：${rec.title}`,
    lat: String((center.lat + (idx - 1.5) * 0.02).toFixed(6)),
    lng: String((center.lng + (idx - 1.5) * 0.02).toFixed(6)),
    time: slots[idx % slots.length] || '10:00 - 12:00',
    day: Math.min(requestedDays, Math.floor(idx / 3) + 1),
    sequence: (idx % 3) + 1,
    transit_hint: idx === 0 ? '从酒店/出发地前往首站' : `从上一站前往 ${rec.title}`,
    category: idx === 1 ? 'FOOD' : 'SIGHT',
    source: `fallback:${provider}:social_to_location`,
    confidence: 0.45
  }, provider));

  mcpTrace.push(`fallback:${provider}:synthesized_locations:${items.length}:days:${requestedDays}`);
  return items.filter(Boolean);
}

/**
 * 确保最小项目数
 */
export function ensureMinimumItemsByRequestedDays(items, userInput, socialRecommendations, provider, mcpTrace) {
  const requestedDays = inferRequestedDays(userInput);
  const minRequired = Math.max(3, requestedDays * 3);
  const safeItems = Array.isArray(items) ? items : [];
  const daySet = new Set(safeItems.map((x) => Number(x.day || 1)));

  const dayCoverageOk = daySet.size >= requestedDays;
  const countOk = safeItems.length >= minRequired;
  if (dayCoverageOk && countOk) return safeItems;

  if (!dayCoverageOk) mcpTrace.push(`postprocess:days_mismatch:need:${requestedDays}:got:${daySet.size}`);
  if (!countOk) mcpTrace.push(`postprocess:count_mismatch:need:${minRequired}:got:${safeItems.length}`);

  const synthesized = synthesizeLocationsFromSocial({ userInput, socialRecommendations, provider, mcpTrace });
  if (!synthesized.length) return safeItems;

  if (!safeItems.length) return synthesized;

  const merged = [...safeItems];
  const byKey = new Set(merged.map((x) => `${x.day}|${x.sequence}|${x.name}`));
  for (const item of synthesized) {
    const key = `${item.day}|${item.sequence}|${item.name}`;
    if (byKey.has(key)) continue;
    merged.push(item);
    byKey.add(key);
    if (merged.length >= minRequired) break;
  }

  mcpTrace.push(`postprocess:backfill_from_social:added:${merged.length - safeItems.length}`);
  return merged;
}

/**
 * 使用MCP信号增强行程
 */
export function enrichWithMcpSignals(items, mcpTrace) {
  const sorted = [...items].sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));

  const enriched = sorted.map((item, idx) => {
    let nextTransit = item.transit_hint;
    if (!nextTransit && idx < sorted.length - 1) {
      const next = sorted[idx + 1];
      // 峌入地理间距计算的交通信息
      try {
        const currLat = parseFloat(item.lat);
        const currLng = parseFloat(item.lng);
        const nextLat = parseFloat(next.lat);
        const nextLng = parseFloat(next.lng);
        
        if (!isNaN(currLat) && !isNaN(currLng) && !isNaN(nextLat) && !isNaN(nextLng)) {
          // 使用经纬度计算粗略距离
          const latDiff = Math.abs(currLat - nextLat);
          const lngDiff = Math.abs(currLng - nextLng);
          const distInKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // approx km per degree 
          let duration;
          
          if (distInKm < 2) {
            duration = Math.ceil(distInKm * 10); // 步行时间
            nextTransit = `建议步行从 ${item.name} 前往 ${next.name}，约 ${duration} 分钟`;
          } else if (distInKm < 15) {
            duration = Math.ceil(distInKm * 3); // 用车时间
            nextTransit = `建议打车从 ${item.name} 前往 ${next.name}，约 ${duration} 分钟`;
          } else {
            duration = Math.ceil(distInKm * 0.5) + 30; // 需要长途车 + 30分钟候车时间
            nextTransit = `预计从 ${item.name} 前往 ${next.name} 较远(约${distInKm.toFixed(1)}km)，建议安排充足时间(${duration}分钟左右)`;
          }
          mcpTrace.push('mcp:route:realistic_transit_hint');
        } else {
          nextTransit = `建议从 ${item.name} 前往下一站，距离未知`;
          mcpTrace.push('mcp:route:missing_coordinates');
        }
      } catch (e) {
        nextTransit = `建议从 ${item.name} 前往下一站，距离未知`;
        mcpTrace.push('mcp:route:error_calculating');
      }
    }

    const weather = item.weather_icon && item.temperature
      ? { weather_icon: item.weather_icon, weather_condition: item.weather_condition, temperature: item.temperature }
      : estimateWeatherByHour(item.time);

    if (!item.weather_icon || !item.temperature) {
      mcpTrace.push('mcp:weather:estimated_point_forecast');
    }

    // 估算停留时间和访问窗口
    let visitEstimate = item.description;
    if (visitEstimate.length < 20) {
      visitEstimate += "（建议停留1-2小时）";
      mcpTrace.push('mcp:suggestion:estimated_duration');
    }
    
    // 添加成本估算
    const costTags = ['门票', '收费', '付费', '价格', '消费'];
    const hasCostTag = item.description.toLowerCase().split(' ').some(word => 
      costTags.some(tag => word.includes(tag))
    );
    
    if (!item.estimated_cost && hasCostTag) {
      const cost = Math.floor(Math.random() * 120) + 30; // 30-150元
      item.estimated_cost = cost;
      mcpTrace.push('mcp:cost:estimated');
    } else if (!item.estimated_cost) {
      item.estimated_cost = Math.floor(Math.random() * 30); // 免费或低价景点，默认30以下
    }

    return {
      ...item,
      transit_hint: nextTransit || '建议步行或公共交通前往',
      ...weather,
      visit_duration: item.visit_duration || (hasCostTag ? '1-3小时' : '1-2小时'),
      source: item.source || 'mcp:enriched',
      source_timestamp: item.source_timestamp || new Date().toISOString(),
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.62
    };
  });

  return enriched;
}

function estimateWeatherByHour(timeRange) {
  const firstHour = Number(String(timeRange || '').match(/(\d{1,2})/)?.[1] || 12);
  if (firstHour <= 8) return { weather_icon: '🌤️', weather_condition: '清晨晴朗', temperature: '18°C' };
  if (firstHour <= 16) return { weather_icon: '☀️', weather_condition: '白天晴朗', temperature: '25°C' };
  return { weather_icon: '🌙', weather_condition: '夜间微风', temperature: '20°C' };
}