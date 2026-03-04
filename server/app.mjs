import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';

// 引入MCP工具
import { handleBatchMcpInvocations } from '../mcp-tools/index.js';

// 引入分离的工具模块
import { tools } from './modules/tools.mjs';
import { mapToolCalls } from './modules/tool-handler.mjs';
import { 
  enrichWithMcpData, 
  incorporateMcpResults 
} from './modules/mcp-enhancements.mjs';
import { 
  extractExpectedCityFromInput,
  harmonizeItineraryCity,
  synthesizeLocationsFromSocial,
  ensureMinimumItemsByRequestedDays,
  enrichWithMcpSignals  
} from './modules/post-processor.mjs';
import { verifyPlan } from './modules/verifier.mjs';
import { normalizeRecommendations } from './modules/normalizer.mjs';

// 加载和配置管理
const CONFIG_FILE = process.argv[2] || 'server/config.json';

const DEFAULT_CONFIG = {
  server: {
    port: 8787,
    requestTimeoutMs: 20000,
    maxRetries: 2
  },
  rag: {
    topK: 3,
    knowledgeFile: 'knowledge/processed/chunks.jsonl'
  },
  rollout: {
    enableCanary: false,
    canaryPercent: 10,
    primaryProvider: 'gemini',
    canaryProvider: 'dashscope',
    autoRollbackOnFailure: true
  },
  performance: {
    cacheTtlMs: 120000,
    costAlertThreshold: 2
  },
  providers: {
    geminiApiKey: '',
    deepseekApiKey: '',
    zhipuApiKey: '',
    dashscopeApiKey: '',
    defaultGeminiModel: 'gemini-2.5-flash',
    defaultDeepseekModel: 'deepseek-chat',
    defaultZhipuModel: 'glm-4-flash',
    defaultDashscopeModel: 'qwen-plus'
  }
};

function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error(`Config file not found: ${CONFIG_FILE}. Please copy server/config.example.json to server/config.json and fill provider keys.`);
  }
  const raw = await readFile(CONFIG_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return deepMerge(DEFAULT_CONFIG, parsed);
}

const CONFIG = await loadConfig();

// 为mcp模块设置全局配置
globalThis.SERVER_CONFIG = CONFIG;

const EXTERNAL_APIS_CONFIG = CONFIG.external_apis || {}; // 获取外部API配置
const PORT = Number(CONFIG.server.port || 8787);
const REQUEST_TIMEOUT_MS = Number(CONFIG.server.requestTimeoutMs || 20000);
const MAX_RETRIES = Number(CONFIG.server.maxRetries || 2);
const RAG_TOP_K = Number(CONFIG.rag.topK || 3);
const KNOWLEDGE_FILE = CONFIG.rag.knowledgeFile || 'knowledge/processed/chunks.jsonl';
const ENABLE_CANARY = Boolean(CONFIG.rollout.enableCanary);
const CANARY_PERCENT = Number(CONFIG.rollout.canaryPercent || 10);
const PRIMARY_PROVIDER = CONFIG.rollout.primaryProvider || 'gemini';
const CANARY_PROVIDER = CONFIG.rollout.canaryProvider || 'zhipu';
const AUTO_ROLLBACK_ON_FAILURE = CONFIG.rollout.autoRollbackOnFailure !== false;
const CACHE_TTL_MS = Number(CONFIG.performance.cacheTtlMs || 120000);
const COST_ALERT_THRESHOLD = Number(CONFIG.performance.costAlertThreshold || 2);

const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游规划专家。
采用思维链(CoT)方法，逐步制定最优行程。
思考步骤：
1. 明确用户目标地点和时间约束
2. 研究当地的交通连通性
3. 考虑开放时间和其他限制因素
4. 设计地理连贯的路线，优化空间连续性
5. 合理分配时间，包含交通和游玩所需时间
6. 最后输出结构化结果
【关键逻辑 - 出发地与目的地】
当用户输入"从 A 到 B"时，A 是出发地，B 是目的地；地点推荐与打点必须落在目的地 B，不得混淆。
【必需包含的三大部分】
1) 社交分析 (工具: get_social_recommendations)
   - 必须调用一次，给出趋势与理由。
2) 地图标注 (工具: location)
   - 必须针对用户要求的每一天调用多次。
   - 每天至少 3-4 个 location（早/中/晚/交通）。
   - 合成社交推荐后必须继续进行地图打点。
   - 推荐地点必须彼此地理接近，形成合理的游览路径。
3) 文字总结
   - 在工具调用后输出简短亮点。
【严苛禁令】
- 严禁只做其一：社交趋势与地图行程必须同时给出。
- 严禁输出 逛 标签内容。
- 严格按照指定城市的地理逻辑安排地点和路线，确保相邻推荐点彼此接近，最小化交通需求。`;

// 将全局变量和辅助函数
import { getCityCenter, extractDestinationFromInput, inferCityFromRequest, inferRequestedDays } from './modules/utils.mjs';

function pushAlert(level, code, message, extra = {}) {
  alerts.unshift({ level, code, message, at: new Date().toISOString(), ...extra });
  if (alerts.length > 100) alerts.pop();
}

function cacheKeyOf(payload) {
  return JSON.stringify({
    userInput: payload.userInput,
    modelType: payload.modelType,
    isPlannerMode: payload.isPlannerMode,
    travelMode: payload.travelMode
  });
}

function stableBucket(text) {
  const src = String(text || '');
  let h = 0;
  for (let i = 0; i < src.length; i += 1) h = (h * 31 + src.charCodeAt(i)) % 100;
  return h;
}

function chooseRolloutProvider(payload) {
  const requested = String(payload.modelType || '').toLowerCase();
  if (requested && requested !== 'auto') {
    if (requested.startsWith('gemini')) return { provider: 'gemini', modelType: payload.modelType, rollout: 'fixed' };
    if (requested.includes('deepseek')) return { provider: 'deepseek', modelType: payload.modelType, rollout: 'fixed' };
    if (requested.includes('glm')) return { provider: 'zhipu', modelType: payload.modelType, rollout: 'fixed' };
    if (requested.includes('qwen')) return { provider: 'dashscope', modelType: payload.modelType, rollout: 'fixed' };
  }

  const bucket = stableBucket(payload.userInput);
  const canaryHit = ENABLE_CANARY && bucket < CANARY_PERCENT;
  const provider = canaryHit ? CANARY_PROVIDER : PRIMARY_PROVIDER;
  const modelType = provider === 'gemini'
    ? (CONFIG.providers.defaultGeminiModel || 'gemini-2.5-flash')
    : provider === 'deepseek'
      ? (CONFIG.providers.defaultDeepseekModel || 'deepseek-chat')
      : provider === 'zhipu'
        ? (CONFIG.providers.defaultZhipuModel || 'glm-4.6v')
        : (CONFIG.providers.defaultDashscopeModel || 'qwen-plus');

  return { provider, modelType, rollout: canaryHit ? 'canary' : 'primary' };
}

function estimateCostUsd(result) {
  const poi = Array.isArray(result.dayPlanItinerary) ? result.dayPlanItinerary.length : 0;
  const evidence = Array.isArray(result.evidence) ? result.evidence.length : 0;
  return Number((0.002 + poi * 0.0004 + evidence * 0.0002).toFixed(4));
}

// 引入的模块函数
async function loadKnowledgeChunks() {
  if (knowledgeCache) return knowledgeCache;
  try {
    const raw = await readFile(KNOWLEDGE_FILE, 'utf8');
    knowledgeCache = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return knowledgeCache;
  } catch {
    knowledgeCache = [];
    return knowledgeCache;
  }
}

function toKeywords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function keywordScore(query, chunk) {
  const q = new Set(toKeywords(query));
  const content = `${chunk.city || ''} ${chunk.tags?.join(' ') || ''} ${chunk.snippet || ''}`.toLowerCase();
  let score = 0;
  for (const token of q) {
    if (content.includes(token)) score += 1;
  }
  return score;
}

async function retrieveEvidence(query, topK) {
  const chunks = await loadKnowledgeChunks();
  const scored = chunks
    .map((chunk) => ({ chunk, score: keywordScore(query, chunk) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((x) => ({
    claim: `与需求相关：${x.chunk.city || '目的地'}知识片段`,
    source: x.chunk.source || KNOWLEDGE_FILE,
    snippet: x.chunk.snippet,
    fetched_at: new Date().toISOString(),
    score: x.score,
    chunk_id: x.chunk.id
  }));
}

function buildRagContext(evidence) {
  if (!evidence.length) return '';
  const lines = evidence.map((e, i) => `${i + 1}. ${e.snippet}（source: ${e.source}）`);
  return `\n\n【本地知识库检索上下文】\n${lines.join('\n')}\n请优先参考以上信息。`;
}

function constructUserPrompt(userInput, isPlannerMode, travelMode, ragContext) {
  const hardConstraints = '硬性要求：必须输出与用户目标城市一致；若输入包含"从A到B"，地点必须全部落在B；必须覆盖用户要求的天数（如"三天/3天"则 day 至少包含 1,2,3）；每一天至少 3 个 location 点位；location.city 必须是目标城市，不得填写其他城市。';
  if (isPlannerMode) {
    return `旅行风格：${travelMode}。请生成详细每日行程：${userInput}。${hardConstraints}${ragContext}`;
  }
  return `请推荐 5-10 个地点并标注地图：${userInput}。${hardConstraints}${ragContext}`;
}

function json(res, status, payload, requestId) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-RequestId',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'X-Request-Id': requestId || ''
  });
  res.end(JSON.stringify(payload));
}

// 延迟工具函数
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestWithRetry({ provider, requestId, url, options, mcpTrace }) {
  let attempt = 0;
  let lastError;

  while (attempt <= MAX_RETRIES) {
    const start = Date.now();
    try {
      mcpTrace.push(`provider:${provider}:attempt:${attempt + 1}:start`);
      const response = await fetchWithTimeout(url, options, REQUEST_TIMEOUT_MS);
      const elapsed = Date.now() - start;
      mcpTrace.push(`provider:${provider}:attempt:${attempt + 1}:status:${response.status}:ms:${elapsed}`);

      if (!response.ok) {
        const body = await response.text();
        const err = new Error(`${provider} upstream status=${response.status} body=${body.slice(0, 240)}`);
        err.statusCode = isRetryableStatus(response.status) ? 502 : 400;
        err.isRetryable = isRetryableStatus(response.status);
        throw err;
      }

      return response;
    } catch (error) {
      lastError = error;
      const elapsed = Date.now() - start;
      const isAbort = error.name === 'AbortError';
      const retryable = isAbort || error.isRetryable || false;
      mcpTrace.push(`provider:${provider}:attempt:${attempt + 1}:error:${isAbort ? 'timeout' : 'exception'}:ms:${elapsed}`);
      console.error(`[${requestId}] ${provider} attempt ${attempt + 1} failed`, { message: error.message, retryable });

      if (!retryable || attempt >= MAX_RETRIES) break;
      await wait(300 * (attempt + 1));
      attempt += 1;
    }
  }

  if (lastError.name === 'AbortError') {
    const timeoutError = new Error(`${provider} timeout after ${REQUEST_TIMEOUT_MS}ms`);
    timeoutError.statusCode = 504;
    throw timeoutError;
  }

  if (!lastError.statusCode) lastError.statusCode = 502;
  throw lastError;
}

// 延迟工具调用函数（重命名以避免冲突）
function callCompatibleExternal({ endpoint, apiKey, model, userInput, provider, mcpTrace, requestId, prompt }) {
  // 实际的具体外部调用实现
  return { provider, itinerarySummary: '兼容模式调用待扩展', dayPlanItinerary: [], socialRecommendations: [], mcpTrace };
}

// AI服务调用
async function callGemini(modelType, prompt, mcpTrace, requestId) {
  const apiKey = CONFIG.providers.geminiApiKey;
  if (!apiKey) {
    const error = new Error('Missing geminiApiKey in config');
    error.statusCode = 500;
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey });
  let response;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    const start = Date.now();
    try {
      mcpTrace.push(`provider:gemini:attempt:${attempt}:start`);
      response = await ai.models.generateContent({
        model: modelType,
        contents: prompt,
        config: {
          systemInstruction: GLOBAL_SYSTEM_PROMPT,
          tools: [{ functionDeclarations: [tools.location, tools.socialRecommendations] }]
        }
      });
      mcpTrace.push(`provider:gemini:attempt:${attempt}:ok:ms:${Date.now() - start}`);
      break;
    } catch (error) {
      mcpTrace.push(`provider:gemini:attempt:${attempt}:error:ms:${Date.now() - start}`);
      console.error(`[${requestId}] gemini attempt ${attempt} failed`, error?.message || error);
      if (attempt > MAX_RETRIES) {
        const e = new Error(`gemini upstream failure: ${error?.message || 'unknown'}`);
        e.statusCode = 502;
        throw e;
      }
      await wait(300 * attempt);
    }
  }

  const mapped = mapToolCalls(response.functionCalls || [], mcpTrace, 'gemini');
  let dayPlanItinerary = mapped.dayPlanItinerary;
  const socialRecommendations = mapped.socialRecommendations;

  if (dayPlanItinerary.length === 0 && socialRecommendations.length > 0) {
    dayPlanItinerary = synthesizeLocationsFromSocial({ userInput: prompt, socialRecommendations, provider: 'gemini', mcpTrace });
  }

  // 现在调用更详尽的MCP工具来补充实时信息
  const mcpResults = await enrichWithMcpData(dayPlanItinerary, mcpTrace);

  return {
    provider: 'gemini',
    itinerarySummary: response.text || '排期已生成',
    dayPlanItinerary,
    socialRecommendations,
    mcpTrace,
    mcpResults
  };
}

async function callCompatible({ endpoint, apiKey, model, userInput, provider, mcpTrace, requestId, prompt }) {
  const MAX_TOOL_ROUNDS = 10;
  
  let messages = [
    { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
    { role: 'user', content: `【强制执行】需求：${userInput}。${prompt}。你需要同时执行两个子任务：任务A 调用 get_social_recommendations；任务B 为每一天多次调用 location。请立刻开始调用工具，不要回复文字说明。` }
  ];
  
  let dayPlanItinerary = [];
  let socialRecommendations = [];
  let finalMessage = null;
  
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    mcpTrace.push(`tool_round:${round}:start`);
    
    const response = await requestWithRetry({
      provider,
      requestId,
      url: endpoint,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          tools: [
            { type: 'function', function: { name: 'get_social_recommendations', parameters: tools.socialRecommendations.parameters } },
            { type: 'function', function: { name: 'location', parameters: tools.location.parameters } }
          ],
          tool_choice: 'auto',
          max_tokens: 4096,
          temperature: 0.1,
          ...(provider === 'zhipu' && { top_p: 0.8 }),
          ...(provider === 'deepseek' && { frequency_penalty: 0.1, presence_penalty: 0.1 }),
          ...(provider === 'dashscope' && { top_p: 0.7, seed: Math.floor(Math.random() * 1000) })
        })
      },
      mcpTrace
    });

    const data = await response.json();
    
    let message;
    if (provider === 'zhipu' && data.response) {
      message = data.response;
    } else {
      message = data.choices?.[0]?.message;
    }
    
    if (!message) {
      const error = new Error(`${provider} returned empty response`);
      error.statusCode = 502;
      throw error;
    }

    console.log(`[RAW-MODEL-OUTPUT] ${provider} round ${round}:`, message);

    messages.push(message);
    
    const toolCalls = message.tool_calls || [];
    
    if (toolCalls.length === 0) {
      finalMessage = message;
      mcpTrace.push(`tool_round:${round}:no_more_calls`);
      break;
    }

    for (const tc of toolCalls) {
      const fnName = tc.function?.name || tc.name;
      const rawArgs = tc.function?.arguments;
      let args = rawArgs ? JSON.parse(rawArgs) : tc.args || {};
      
      console.log(`[TOOL_CALL] ${fnName}:`, args);
      
      if (fnName === 'get_social_recommendations') {
        const result = await handleBatchMcpInvocations([{ name: 'get_social_recommendations', args }]);
        const toolResult = JSON.stringify(result);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id || `call_${round}_${fnName}`,
          content: toolResult
        });
        mcpTrace.push(`tool:${provider}:get_social_recommendations:executed`);
      } else if (fnName === 'location') {
        const result = await handleBatchMcpInvocations([{ name: 'location', args }]);
        const toolResult = JSON.stringify(result);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id || `call_${round}_${fnName}`,
          content: toolResult
        });
        mcpTrace.push(`tool:${provider}:location:executed`);
      }
    }

    const mapped = mapToolCalls(toolCalls, mcpTrace, provider);
    dayPlanItinerary = [...dayPlanItinerary, ...mapped.dayPlanItinerary];
    if (mapped.socialRecommendations.length > 0 && socialRecommendations.length === 0) {
      socialRecommendations = mapped.socialRecommendations;
    }
    
    mcpTrace.push(`tool_round:${round}:completed:${toolCalls.length}_calls`);
  }

  if (dayPlanItinerary.length === 0) {
    mcpTrace.push(`tool:${provider}:location:retry:forced`);
    const forcedResponse = await requestWithRetry({
      provider,
      requestId,
      url: endpoint,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
            { role: 'user', content: `仅补齐 location 工具调用。需求：${userInput}。要求：必须给出 day/sequence/time/transit_hint/lat/lng/city；若输入是"从A到B"，city 必须是 B；若用户要求三天，day 至少覆盖 1,2,3。` }
          ],
          tools: [
            { type: 'function', function: { name: 'location', parameters: tools.location.parameters } }
          ],
          tool_choice: { type: 'function', function: { name: 'location' } },
          max_tokens: 2048,
          temperature: 0.1,
          ...(provider === 'zhipu' && { top_p: 0.85 }),
          ...(provider === 'deepseek' && { frequency_penalty: 0.1, presence_penalty: 0.1 }),
          ...(provider === 'dashscope' && { top_p: 0.75, seed: Math.floor(Math.random() * 1000) + 1 })
        })
      },
      mcpTrace
    });
    const forcedData = await forcedResponse.json();
    let forcedMessage;
    if (provider === 'zhipu' && forcedData.response) {
      forcedMessage = forcedData.response;
    } else {
      forcedMessage = forcedData.choices?.[0]?.message || {};
    }
    const forcedMapped = mapToolCalls(forcedMessage.tool_calls || [], mcpTrace, provider);
    dayPlanItinerary = forcedMapped.dayPlanItinerary;
    if (socialRecommendations.length === 0) socialRecommendations = normalizeRecommendations([], provider);
  }

  if (dayPlanItinerary.length === 0 && socialRecommendations.length > 0) {
    dayPlanItinerary = synthesizeLocationsFromSocial({ userInput, socialRecommendations, provider, mcpTrace });
  }

  const mcpResults = await enrichWithMcpData(dayPlanItinerary, mcpTrace);

  return {
    provider,
    itinerarySummary: finalMessage?.content || finalMessage?.reasoning_content || '规划已生成',
    dayPlanItinerary,
    socialRecommendations,
    mcpTrace,
    mcpResults
  };
}
 
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Request body must be a JSON object';
  if (!payload.userInput || typeof payload.userInput !== 'string') return 'userInput is required';
  if (!payload.modelType || typeof payload.modelType !== 'string') return 'modelType is required';
  return null;
}

function toRefinePayload(payload) {
  const baseSummary = payload.basePlan?.itinerarySummary || '';
  return {
    userInput: `${payload.userInput || ''}\n\n请基於已有方案继续调整：${payload.refineInstruction || ''}\n已有摘要：${baseSummary}`.trim(),
    modelType: payload.modelType,
    isPlannerMode: payload.isPlannerMode !== false,
    travelMode: payload.travelMode || 'deep'
  };
}

function getProviderFromModel(modelType) {
  if (String(modelType || '').startsWith('gemini')) return 'gemini';
  if (String(modelType || '').includes('deepseek')) return 'deepseek';
  if (String(modelType || '').toLowerCase().includes('glm')) return 'zhipu';
  if (String(modelType || '').toLowerCase().includes('qwen')) return 'dashscope';
  return 'unknown';
}

function recordExecutionLog({ requestId, route, payload, response, startedAt, failed, errorMessage }) {
  const entry = {
    requestId,
    route,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(startedAt).getTime(),
    modelType: payload?.modelType,
    provider: getProviderFromModel(payload?.modelType),
    userInputPreview: String(payload?.userInput || '').slice(0, 120),
    mcpTraceCount: Array.isArray(response?.mcpTrace) ? response.mcpTrace.length : 0,
    evidenceCount: Array.isArray(response?.evidence) ? response.evidence.length : 0,
    itineraryCount: Array.isArray(response?.dayPlanItinerary) ? response.dayPlanItinerary.length : 0,
    failed: Boolean(failed),
    errorMessage: errorMessage || null
  };

  executionLogStore.set(requestId, entry);
  if (executionLogStore.size > 200) {
    const oldest = executionLogStore.keys().next().value;
    executionLogStore.delete(oldest);
  }
}

function snapshotMetrics() {
  return {
    ...metrics,
    executionLogSize: executionLogStore.size,
    cacheSize: responseCache.size,
    alertCount: alerts.length,
    updatedAt: new Date().toISOString()
  };
}

// 全局缓存和辅助数据结构
let knowledgeCache;
const executionLogStore = new Map();
const responseCache = new Map();
const alerts = [];
const metrics = {
  totalRequests: 0,
  planRequests: 0,
  refineRequests: 0,
  failedRequests: 0,
  cacheHits: 0,
  totalEstimatedCost: 0,
  providerCounts: { gemini: 0, deepseek: 0, zhipu: 0, dashscope: 0, unknown: 0 },
  lastError: null
};

async function generatePlan(payload, requestId) {
  const mcpTrace = [`request:${requestId}:received`];
  const cacheKey = cacheKeyOf(payload);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    metrics.cacheHits += 1;
    const cloned = JSON.parse(JSON.stringify(cached.value));
    cloned.mcpTrace = [...(cloned.mcpTrace || []), 'cache:hit'];
    return cloned;
  }

  const evidence = await retrieveEvidence(payload.userInput, RAG_TOP_K);
  mcpTrace.push(`rag:retrieved:${evidence.length}`);
  const ragContext = buildRagContext(evidence);
  const prompt = constructUserPrompt(payload.userInput, payload.isPlannerMode, payload.travelMode, ragContext);

  let plan;
  const chosen = chooseRolloutProvider(payload);
  mcpTrace.push(`rollout:${chosen.rollout}:provider:${chosen.provider}:model:${chosen.modelType}`);

  try {
    if (chosen.provider === 'gemini') {
      plan = await callGemini(chosen.modelType, prompt, mcpTrace, requestId);
    } else if (chosen.provider === 'deepseek') {
      if (!CONFIG.providers.deepseekApiKey) {
        const error = new Error('Missing deepseekApiKey in config');
        error.statusCode = 500;
        throw error;
      }
      plan = await callCompatible({
        endpoint: 'https://api.deepseek.com/chat/completions',
        apiKey: CONFIG.providers.deepseekApiKey,
        model: chosen.modelType,
        userInput: payload.userInput,
        provider: 'deepseek',
        mcpTrace,
        requestId,
        prompt
      });
    } else if (chosen.provider === 'zhipu') {
      if (!CONFIG.providers.zhipuApiKey) {
        const error = new Error('Missing zhipuApiKey in config');
        error.statusCode = 500;
        throw error;
      }
      plan = await callCompatible({
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        apiKey: CONFIG.providers.zhipuApiKey,
        model: chosen.modelType,
        userInput: payload.userInput,
        provider: 'zhipu',
        mcpTrace,
        requestId,
        prompt
      });
    } else if (chosen.provider === 'dashscope') {
      if (!CONFIG.providers.dashscopeApiKey) {
        const error = new Error('Missing dashscopeApiKey in config');
        error.statusCode = 500;
        throw error;
      }
      plan = await callCompatible({
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        apiKey: CONFIG.providers.dashscopeApiKey,
        model: chosen.modelType,
        userInput: payload.userInput,
        provider: 'dashscope',
        mcpTrace,
        requestId,
        prompt
      });
    }
    
    // 将MCP结果合并到计划中
    if (plan.mcpResults && Array.isArray(plan.mcpResults)) {
      plan = incorporateMcpResults(plan, plan.mcpResults);
    }
  } catch (error) {
    if (AUTO_ROLLBACK_ON_FAILURE && chosen.rollout === 'canary') {
      mcpTrace.push('rollout:rollback:triggered');
      pushAlert('warning', 'rollout_rollback', 'Canary provider failed, fallback to primary provider', { requestId });
      if (PRIMARY_PROVIDER === 'gemini') {
        plan = await callGemini(CONFIG.providers.defaultGeminiModel || 'gemini-2.5-flash', prompt, mcpTrace, requestId);
      } else if (PRIMARY_PROVIDER === 'deepseek') {
        if (!CONFIG.providers.deepseekApiKey) throw error;
        plan = await callCompatible({
          endpoint: 'https://api.deepseek.com/chat/completions',
          apiKey: CONFIG.providers.deepseekApiKey,
          model: CONFIG.providers.defaultDeepseekModel || 'deepseek-chat',
          userInput: payload.userInput,
          provider: 'deepseek',
          mcpTrace,
          requestId,
          prompt
        });
      } else if (PRIMARY_PROVIDER === 'zhipu') {
        if (!CONFIG.providers.zhipuApiKey) throw error;
        plan = await callCompatible({
          endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          apiKey: CONFIG.providers.zhipuApiKey,
          model: CONFIG.providers.defaultZhipuModel || 'glm-4.5-air',
          userInput: payload.userInput,
          provider: 'zhipu',
          mcpTrace,
          requestId,
          prompt
        });
      } else if (PRIMARY_PROVIDER === 'dashscope') {
        if (!CONFIG.providers.dashscopeApiKey) throw error;
        plan = await callCompatible({
          endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
          apiKey: CONFIG.providers.dashscopeApiKey,
          model: CONFIG.providers.defaultDashscopeModel || 'qwen-plus',
          userInput: payload.userInput,
          provider: 'dashscope',
          mcpTrace,
          requestId,
          prompt
        });
      }
      
      // 对於回退的计划同样整合MCP数据
      if (plan.mcpResults && Array.isArray(plan.mcpResults)) {
        plan = incorporateMcpResults(plan, plan.mcpResults);
      }
    } else {
      throw error;
    }
  }

  const expectedCity = extractExpectedCityFromInput(payload.userInput, plan.socialRecommendations || []);
  let originalItinerary = plan.dayPlanItinerary || [];
  let alignedItinerary = harmonizeItineraryCity(originalItinerary, expectedCity, mcpTrace);
  alignedItinerary = ensureMinimumItemsByRequestedDays(alignedItinerary, payload.userInput, plan.socialRecommendations || [], plan.provider || chosen.provider, mcpTrace);
  const enrichedItinerary = enrichWithMcpSignals(alignedItinerary, mcpTrace);
  const verifierWarnings = verifyPlan(enrichedItinerary, mcpTrace);

  const result = {
    ...plan,
    dayPlanItinerary: enrichedItinerary,
    verifierWarnings,
    evidence,
    execution_log_id: requestId
  };

  const estCost = estimateCostUsd(result);
  metrics.totalEstimatedCost += estCost;
  if (metrics.totalEstimatedCost >= COST_ALERT_THRESHOLD) {
    pushAlert('warning', 'cost_threshold', `Estimated cumulative cost exceeded threshold ${COST_ALERT_THRESHOLD} USD`, {
      totalEstimatedCost: Number(metrics.totalEstimatedCost.toFixed(4))
    });
  }

  responseCache.set(cacheKey, { at: Date.now(), value: result });
  if (responseCache.size > 200) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }

  return result;
}

// 服务器定义
const server = createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  metrics.totalRequests += 1;

  if (req.method === 'OPTIONS') return json(res, 204, {}, requestId);

  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true, service: 'ai-travel-butler-server', city: 'xian' }, requestId);
  }

  if (req.method === 'GET' && req.url === '/api/metrics') {
    return json(res, 200, snapshotMetrics(), requestId);
  }

  if (req.method === 'GET' && req.url === '/api/alerts') {
    return json(res, 200, { alerts, requestId }, requestId);
  }

  if (req.method === 'GET' && req.url === '/api/release/status') {
    return json(res, 200, {
      ENABLE_CANARY, CANARY_PERCENT, PRIMARY_PROVIDER, CANARY_PROVIDER, AUTO_ROLLBACK_ON_FAILURE, configFile: CONFIG_FILE, requestId
    }, requestId);
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/execution-log/')) {
    const id = req.url.split('/').pop();
    const log = executionLogStore.get(id);
    if (!log) return json(res, 404, { error: 'execution log not found', requestId }, requestId);
    return json(res, 200, { log, requestId }, requestId);
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/knowledge/search')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const q = url.searchParams.get('q') || '';
    const evidence = await retrieveEvidence(q, RAG_TOP_K);
    return json(res, 200, { q, evidence, requestId }, requestId);
  }

  if (req.method === 'POST' && (req.url === '/api/plan' || req.url === '/api/plan/refine')) {
    let body = '';
    const startedAt = new Date().toISOString();
    if (req.url === '/api/plan') metrics.planRequests += 1;
    if (req.url === '/api/plan/refine') metrics.refineRequests += 1;

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });

    req.on('end', async () => {
      let payload;
      try {
        const rawPayload = JSON.parse(body || '{}');
        payload = req.url === '/api/plan/refine' ? toRefinePayload(rawPayload) : rawPayload;

        const validationError = validatePayload(payload);
        if (validationError) {
          metrics.failedRequests += 1;
          metrics.lastError = { message: validationError, at: new Date().toISOString(), route: req.url };
          recordExecutionLog({ requestId, route: req.url, payload, startedAt, failed: true, errorMessage: validationError });
          return json(res, 400, { error: validationError, requestId }, requestId);
        }

        const started = Date.now();
        const data = await generatePlan(payload, requestId);
        data.mcpTrace.push(`request:${requestId}:completed:ms:${Date.now() - started}`);

        const provider = data.provider || getProviderFromModel(payload.modelType);
        metrics.providerCounts[provider] = (metrics.providerCounts[provider] || 0) + 1;
        recordExecutionLog({ requestId, route: req.url, payload, response: data, startedAt, failed: false });

        return json(res, 200, { ...data, requestId }, requestId);
      } catch (error) {
        const status = error?.statusCode || 500;
        metrics.failedRequests += 1;
        metrics.lastError = { message: error?.message || 'Planner error', at: new Date().toISOString(), route: req.url };
        recordExecutionLog({ requestId, route: req.url, payload, startedAt, failed: true, errorMessage: error?.message || 'Planner error' });
        console.error(`[${requestId}] ${req.url} failed`, error?.message || error);
        return json(res, status, { error: error?.message || 'Planner error', requestId }, requestId);
      }
    });
    return;
  }

  return json(res, 404, { error: 'Not found', requestId }, requestId);
});

server.listen(PORT, () => {
  console.log(`AI Travel Butler backend running on http://localhost:${PORT}`);
});