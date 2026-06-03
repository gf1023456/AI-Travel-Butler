/**
 * AI Travel Butler - Plan Validator
 * 行程验证和校验工具
 */

export function verifyPlan(items, mcpTrace) {
  const warnings = [];
  if (!items || items.length === 0) {
    warnings.push('未生成任何地图标注点，请重试或切换模型。');
    mcpTrace.push('agent:verifier:warnings:1:no_locations');
    return warnings;
  }
  const byDay = new Map();
  for (const item of items) {
    if (!byDay.has(item.day)) byDay.set(item.day, []);
    byDay.get(item.day).push(item);
  }

  for (const [day, dayItems] of byDay.entries()) {
    if (dayItems.length < 3) {
      warnings.push(`Day ${day} 行程点位少于 3 个，建议补充早餐/晚间活动/交通节点。`);
    }
    const seq = dayItems.map((x) => Number(x.sequence || 0)).sort((a, b) => a - b);
    for (let i = 1; i < seq.length; i += 1) {
      if (seq[i] === seq[i - 1]) {
        warnings.push(`Day ${day} 存在重复 sequence=${seq[i]}，可能导致顺序冲突。`);
        break;
      }
    }
    
    // 增强: 检查地理连贯性
    for (let i = 0; i < dayItems.length - 1; i++) {
      const current = dayItems[i];
      const next = dayItems[i + 1];
      
      // 解析经纬度字符串为数值
      const currLat = parseFloat(current.lat);
      const currLng = parseFloat(current.lng);
      const nextLat = parseFloat(next.lat);
      const nextLng = parseFloat(next.lng);
      
      if (!isNaN(currLat) && !isNaN(currLng) && !isNaN(nextLat) && !isNaN(nextLng)) {
        // 计算两点之间的欧氏距离（简化）- 如果相隔太远可能地理不连贯
        const latDiff = Math.abs(currLat - nextLat);
        const lngDiff = Math.abs(currLng - nextLng);
        if (latDiff > 0.5 && lngDiff > 0.5) { // 距离阈值约为50公里（粗略估计）
          warnings.push(`Day ${day} 中 ${current.name} 和 ${next.name} 之间距离过远，可能不连贯。`);
          mcpTrace.push(`agent:verifier:geo_gap_warning:day_${day}`);
        }
      }
    }
    
    // 增强: 验证时间安排合理性
    const sortedByTime = dayItems.sort((a, b) => {
      // 简单比较时间字符串 HH:MM 格式
      return a.time.localeCompare(b.time);
    });
    let prevTime = null;
    for (const item of sortedByTime) {
      if (prevTime && item.time && prevTime === item.time) {
        warnings.push(`Day ${day} 存在时间冲突：${item.name} 和 ${byDay.get(day)[sortedByTime.indexOf(item)].name} 安排在同一时间。`);
      }
      prevTime = item.time;
    }
    
    // 增强: 颺算约束检查（基于估算）
    if (dayItems.some(item => item.estimated_cost && parseInt(item.estimated_cost) > 500)) {
      warnings.push(`Day ${day} 包含较高消费景点，可能超出低预算预期。`);
      mcpTrace.push('agent:verifier:budget_warning');
    }
  }

  // 检查是否所有地点都在同一个城市，如果不一致可能行程不连贯
  const uniqueCities = [...new Set(items.map(item => item.city))];
  if (uniqueCities.length > 1) {
    warnings.push(`行程包含了多个城市: ${uniqueCities.join(', ')}，不符合目的地要求。`);
    mcpTrace.push('agent:verifier:multi_city_warning');
  }

  if (warnings.length === 0) {
    mcpTrace.push('agent:verifier:pass');
  } else {
    mcpTrace.push(`agent:verifier:warnings:${warnings.length}`);
  }

  return warnings;
}