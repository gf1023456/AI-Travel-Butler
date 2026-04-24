/**
 * AI Travel Butler - MCP Router/Dispatcher
 * 负责解析、调度和执行MCP工具调用
 */

import { getToolByName, getAllToolNames } from './tools.js';
import * as mcpImplementations from './implementations.js';

/**
 * 根据工具名执行对应的函数
 */
export async function executeMcpTool(toolName, args) {
  // 根据工具名映射到具体实现
  switch(toolName) {
    case 'geocode_address':
      return await mcpImplementations.geocodeAddress(args);
    case 'reverse_geocode':
      return await mcpImplementations.reverseGeocode(args.latitude, args.longitude);
    case 'get_weather':  // 修正：使用与定义相符的名称
      return await mcpImplementations.getWeather(args.latitude, args.longitude, args.date);
    case 'get_poi_info':  // 修正：使用与定义相符的名称
      return await mcpImplementations.getPoiInfo(
        args.name,
        args.latitude, 
        args.longitude,
        args.city
      );
    case 'get_route':
      return await mcpImplementations.getRoute(
        args.from_lat, 
        args.from_lng, 
        args.to_lat, 
        args.to_lng, 
        args.mode
      );
    case 'location':
    case 'get_social_recommendations':
      // 这些是旅行规划的返回类型，不需要额外处理，作为结果即可
      return args;
    default:
      throw new Error(`Unknown MCP tool: ${toolName}`);
  }
}

/**
 * 解析工具调用结果
 */
export async function dispatchMcpCall(toolCall) {
  try {
    const { name: toolName, args } = toolCall;
    // 直接获取工具定义而不是通过函数
    const toolDefinition = getToolByName(toolName);
    
    if (!toolDefinition) {
      // 通过错误消息显示可用的工具来帮助调试
      console.log(`[MCP DISPATCHER DEBUG] Available tools in getToolByName:`, getAllToolNames());
      console.warn(`[MCP DISPATCHER DEBUG] Tool requested but not found in definitions: ${toolName}`);
      return {
        toolName: toolCall.name,
        args: toolCall.args,
        error: `Unknown MCP tool requested: ${toolName}`,
        executedAt: new Date().toISOString(),
        success: false
      };
    }

    // 传入参数执行工具
    const result = await executeMcpTool(toolName, args);
    
    return {
      toolName,
      args,
      result,
      executedAt: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    return {
      toolName: toolCall.name,
      args: toolCall.args,
      error: error.message,
      executedAt: new Date().toISOString(),
      success: false
    };
  }
}

/**
 * 批量调度多个MCP工具调用
 */
export async function dispatchBatchMcpCalls(toolCalls) {
  const results = await Promise.allSettled(
    toolCalls.map(call => dispatchMcpCall(call))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        toolName: toolCalls[index].name,
        args: toolCalls[index].args,
        error: result.reason.message,
        executedAt: new Date().toISOString(),
        success: false
      };
    }
  });
}