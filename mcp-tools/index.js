/**
 * AI Travel Butler - MCP Tools Standard Interface
 * 标准MCP格式导出，支持与其他系统交互
 */

import { ALL_MCP_TOOLS, SOCIAL_RECOMMENDATION_TOOL } from './tools.js';
import { dispatchBatchMcpCalls } from './dispatcher.js';

// 为MCP标准导出工具定义
export function getMcpToolsDefinitions() {
  // 转换为MCP标准格式 - OpenAPI工具规范
  const tools = [];
  
  // 遾换所有MCP工具定义
  Object.values(ALL_MCP_TOOLS).forEach(def => {
    tools.push({
      type: 'function',
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters
      }
    });
  });
  
  // 添加社交推荐工具
  tools.push({
    type: 'function',
    function: {
      name: 'get_social_recommendations',
      description: SOCIAL_RECOMMENDATION_TOOL.description,
      parameters: SOCIAL_RECOMMENDATION_TOOL.parameters
    }
  });
  
  return tools;
}

// 配套的处理函数
export async function handleMcpInvocation(invocation) {
  // 解析MCP调用并转发到合适的实现
  const result = await dispatchBatchMcpCalls([invocation]);
  return result[0];
}

// 批处理版本
export async function handleBatchMcpInvocations(invocations) {
  return await dispatchBatchMcpCalls(invocations);
}

// 用于向AI模型提供的可用工具列表
export const AVAILABLE_MCP_TOOLS = getMcpToolsDefinitions();

export default {
  AVAILABLE_MCP_TOOLS,
  handleMcpInvocation,
  handleBatchMcpInvocations
};