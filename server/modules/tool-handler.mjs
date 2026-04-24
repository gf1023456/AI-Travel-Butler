/**
 * AI Travel Butler - Tool Call Handler
 * 处理来自AI模型的工具调用
 */

import { normalizeLocation, normalizeRecommendations, parseToolArguments } from './normalizer.mjs';

/**
 * 解析AI返回的工具调用结果
 */
export function mapToolCalls(toolCalls, mcpTrace, provider) {
  const dayPlanItinerary = [];
  let socialRecommendations = [];

  console.log(`[DEBUG] Processing ${toolCalls.length || 0} tool calls from ${provider}:`);
  
  for (const tc of toolCalls || []) {
    console.log(`  [RAW CALL] Name: ${tc.name || tc.function?.name || 'unknown'}, Args: ${(tc.function && tc.function.arguments) || JSON.stringify(tc.args)}`);
    
    const fnName = tc.function?.name || tc.name;
    const rawArgs = tc.function?.arguments;
    let args;
    
    // 针对DeepSeek的特殊处理 - 如果是get_social_recommendations，直接解析
    if (fnName === 'get_social_recommendations') {
      if (rawArgs) {
        try {
          args = JSON.parse(rawArgs);
        } catch (e) {
          // 针对DeepSeek可能出现的转义问题特别处理
          try {
            // 尝试处理字符串化的参数
            const cleanedArgs = rawArgs
              .replace(/\\\\\\/g, '') // 移除重复的转义斜杠
              .replace(/\\"/g, '"') // 将 \" 转换为 "
              .replace(/\\n/g, '') // 移除换行符
              .replace(/\\r/g, '') // 移除回车符
              .trim();
            
            args = JSON.parse(cleanedArgs);
            
            // 颼果解析成功但recommendations还是字符串，再次处理
            if (args.recommendations && typeof args.recommendations === 'string') {
              try {
                args.recommendations = JSON.parse(args.recommendations);
              } catch (secondaryParse) {
                console.log(`  [INFO] Recommendation data still unparseable, trying basic parse`, args.recommendations);
                // 使用基本正则解析
                const recMatches = args.recommendations.match(/\\{[^}]+\\}/g) || [args.recommendations];
                if (recMatches.length > 0) {
                  const parsedRecs = [];
                  for (const recItem of recMatches) {
                    const titleMatch = recItem.match(/"title"[^"]*"([^"]+)"/);
                    const rankMatch = recItem.match(/"rank"[^0-9]*([0-9]+)/);
                    if (titleMatch && rankMatch) {
                      parsedRecs.push({
                        title: titleMatch[1],
                        rank: parseInt(rankMatch[1])
                      });
                    }
                  }
                  if (parsedRecs.length > 0) {
                    args.recommendations = parsedRecs;
                  }
                }
              }
            }
            console.log(`[DEEPSEEK-FIX] Success parsing special-format social recommendations`);
          } catch (cleaningError) {
            console.error(`[ERROR] DeepSeek argument cleaning failed:`, cleaningError.message);
            args = { recommendations: [] }; // 默认值
          }
        }
      } else {
        args = tc.args || {};
      }
    } else {
      // 处他函数使用通用解析方法
      args = rawArgs ? parseToolArguments(rawArgs) : tc.args || {};
    }

    if (fnName === 'location') {
      console.log(`  [DEBUG] Processing location: ${args.name}, coords: (${args.lat}, ${args.lng}), city: ${args.city}`);
      const item = normalizeLocation(args, provider);
      if (item) {
        dayPlanItinerary.push(item);
        console.log(`  [SUCCESS] Normalized location: ${item.name} in ${item.city}`);
      } else {
        console.log(`  [SKIPPED] Invalid location data: ${JSON.stringify(args)}`);
      }
      mcpTrace.push(`tool:${provider}:location`);
    }

    if (fnName === 'get_social_recommendations') {
      socialRecommendations = normalizeRecommendations(args.recommendations || [], provider);
      console.log(`  [INFO] Normalized ${socialRecommendations.length} social recommendations`);
      console.log(`    Recommendations:`, socialRecommendations.slice(0, 3)); // 打印前3个以避免过多输出
      mcpTrace.push(`tool:${provider}:get_social_recommendations`);
    }
  }
  
  // 添加MCP工具处理逻辑
  const mcpResults = [];

  console.log(`[RESULT] Completed processing. Locations: ${dayPlanItinerary.length}, Social Recs: ${socialRecommendations.length}`);
  return { 
    dayPlanItinerary, 
    socialRecommendations,
    mcpResults 
  };
}