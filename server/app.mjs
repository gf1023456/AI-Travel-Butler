import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PORT || 8787);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 2);
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 3);
const KNOWLEDGE_FILE = process.env.KNOWLEDGE_FILE || 'knowledge/processed/chunks.jsonl';
const ENABLE_CANARY = process.env.ENABLE_CANARY === '1';
const CANARY_PERCENT = Number(process.env.CANARY_PERCENT || 10);
const PRIMARY_PROVIDER = process.env.PRIMARY_PROVIDER || 'gemini';
const CANARY_PROVIDER = process.env.CANARY_PROVIDER || 'zhipu';
const AUTO_ROLLBACK_ON_FAILURE = process.env.AUTO_ROLLBACK_ON_FAILURE !== '0';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 120000);
const COST_ALERT_THRESHOLD = Number(process.env.COST_ALERT_THRESHOLD || 2);

const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游规划专家。
你的任务是完成一个【三位一体】的规划报告。
1) 社交分析(get_social_recommendations)
2) 地图标注(location)
3) 文字总结。
请优先利用提供的本地知识上下文（如存在）来提高准确性。`;

const locationTool = {
  name: 'location',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' }, city: { type: 'string' }, description: { type: 'string' },
      lat: { type: 'string' }, lng: { type: 'string' }, time: { type: 'string' },
      day: { type: 'number' }, sequence: { type: 'number' }, transit_hint: { type: 'string' },
      category: { type: 'string' }, weather_icon: { type: 'string' }, weather_condition: { type: 'string' }, temperature: { type: 'string' }
    },
    required: ['name', 'city', 'description', 'lat', 'lng', 'time', 'day', 'sequence', 'transit_hint']
  }
};

const socialRecommendationTool = {
  name: 'get_social_recommendations',
  parameters: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rank: { type: 'number' }, title: { type: 'string' }, platform: { type: 'string' },
            hot_score: { type: 'string' }, reason: { type: 'string' }, photo_tips: { type: 'string' }
          },
          required: ['rank', 'title', 'platform', 'hot_score', 'reason']
        }
      }
    },
    required: ['recommendations']
  }
};

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
  providerCounts: { gemini: 0, deepseek: 0, zhipu: 0, unknown: 0 },
  lastError: null
};



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
  }

  const bucket = stableBucket(payload.userInput);
  const canaryHit = ENABLE_CANARY && bucket < CANARY_PERCENT;
  const provider = canaryHit ? CANARY_PROVIDER : PRIMARY_PROVIDER;
  const modelType = provider === 'gemini'
    ? (process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.5-flash')
    : provider === 'deepseek'
      ? (process.env.DEFAULT_DEEPSEEK_MODEL || 'deepseek-chat')
      : (process.env.DEFAULT_ZHIPU_MODEL || 'glm-4-flash');

  return { provider, modelType, rollout: canaryHit ? 'canary' : 'primary' };
}

function estimateCostUsd(result) {
  const poi = Array.isArray(result.dayPlanItinerary) ? result.dayPlanItinerary.length : 0;
  const evidence = Array.isArray(result.evidence) ? result.evidence.length : 0;
  return Number((0.002 + poi * 0.0004 + evidence * 0.0002).toFixed(4));
}

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
  if (isPlannerMode) {
    return `旅行风格：${travelMode}。请生成详细每日行程：${userInput}${ragContext}`;
  }
  return `请推荐 5-10 个地点并标注地图：${userInput}${ragContext}`;
}

function json(res, status, payload, requestId) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Request-Id',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'X-Request-Id': requestId || ''
  });
  res.end(JSON.stringify(payload));
}

function normalizeLocation(item = {}, provider) {
  if (!item.name || !item.lat || !item.lng) return null;
  return {
    name: String(item.name),
    city: String(item.city || '西安'),
    description: String(item.description || ''),
    lat: String(item.lat),
    lng: String(item.lng),
    time: String(item.time || ''),
    day: Number(item.day || 1),
    sequence: Number(item.sequence || 1),
    transit_hint: String(item.transit_hint || ''),
    category: item.category ? String(item.category) : undefined,
    weather_icon: item.weather_icon ? String(item.weather_icon) : undefined,
    weather_condition: item.weather_condition ? String(item.weather_condition) : undefined,
    temperature: item.temperature ? String(item.temperature) : undefined,
    source: item.source || `provider:${provider}:location`,
    source_timestamp: new Date().toISOString(),
    confidence: typeof item.confidence === 'number' ? item.confidence : 0.6
  };
}

function normalizeRecommendations(list, provider) {
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
      const isAbort = error?.name === 'AbortError';
      const retryable = isAbort || error?.isRetryable || false;
      mcpTrace.push(`provider:${provider}:attempt:${attempt + 1}:error:${isAbort ? 'timeout' : 'exception'}:ms:${elapsed}`);
      console.error(`[${requestId}] ${provider} attempt ${attempt + 1} failed`, { message: error?.message, retryable });

      if (!retryable || attempt >= MAX_RETRIES) break;
      await wait(300 * (attempt + 1));
      attempt += 1;
    }
  }

  if (lastError?.name === 'AbortError') {
    const timeoutError = new Error(`${provider} timeout after ${REQUEST_TIMEOUT_MS}ms`);
    timeoutError.statusCode = 504;
    throw timeoutError;
  }

  if (!lastError?.statusCode) lastError.statusCode = 502;
  throw lastError;
}

function mapToolCalls(toolCalls, mcpTrace, provider) {
  const dayPlanItinerary = [];
  let socialRecommendations = [];

  for (const tc of toolCalls || []) {
    const fnName = tc.function?.name || tc.name;
    const rawArgs = tc.function?.arguments;
    const args = rawArgs ? JSON.parse(rawArgs) : tc.args || {};

    if (fnName === 'location') {
      const item = normalizeLocation(args, provider);
      if (item) dayPlanItinerary.push(item);
      mcpTrace.push(`tool:${provider}:location`);
    }

    if (fnName === 'get_social_recommendations') {
      socialRecommendations = normalizeRecommendations(args.recommendations || [], provider);
      mcpTrace.push(`tool:${provider}:get_social_recommendations`);
    }
  }

  return { dayPlanItinerary, socialRecommendations };
}



function estimateWeatherByHour(timeRange) {
  const firstHour = Number(String(timeRange || '').match(/(\d{1,2})/)?.[1] || 12);
  if (firstHour <= 8) return { weather_icon: '🌤️', weather_condition: '清晨晴朗', temperature: '18°C' };
  if (firstHour <= 16) return { weather_icon: '☀️', weather_condition: '白天晴朗', temperature: '25°C' };
  return { weather_icon: '🌙', weather_condition: '夜间微风', temperature: '20°C' };
}

function enrichWithMcpSignals(items, mcpTrace) {
  const sorted = [...items].sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));

  const enriched = sorted.map((item, idx) => {
    let nextTransit = item.transit_hint;
    if (!nextTransit && idx < sorted.length - 1) {
      const next = sorted[idx + 1];
      nextTransit = `建议打车前往下一站 ${next.name}，约 ${15 + (idx % 3) * 10} 分钟`;
      mcpTrace.push('mcp:route:estimated_transit_hint');
    }

    const weather = item.weather_icon && item.temperature
      ? { weather_icon: item.weather_icon, weather_condition: item.weather_condition, temperature: item.temperature }
      : estimateWeatherByHour(item.time);

    if (!item.weather_icon || !item.temperature) {
      mcpTrace.push('mcp:weather:estimated_point_forecast');
    }

    return {
      ...item,
      transit_hint: nextTransit || '建议步行或公共交通前往',
      ...weather,
      source: item.source || 'mcp:enriched',
      source_timestamp: item.source_timestamp || new Date().toISOString(),
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.62
    };
  });

  return enriched;
}

function verifyPlan(items, mcpTrace) {
  const warnings = [];
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
  }

  if (warnings.length === 0) {
    mcpTrace.push('agent:verifier:pass');
  } else {
    mcpTrace.push(`agent:verifier:warnings:${warnings.length}`);
  }

  return warnings;
}

async function callGemini(modelType, prompt, mcpTrace, requestId) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY on server');
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
          tools: [{ functionDeclarations: [locationTool, socialRecommendationTool] }]
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

  const { dayPlanItinerary, socialRecommendations } = mapToolCalls(response.functionCalls || [], mcpTrace, 'gemini');

  return {
    provider: 'gemini',
    itinerarySummary: response.text || '排期已生成',
    dayPlanItinerary,
    socialRecommendations,
    mcpTrace
  };
}

async function callCompatible({ endpoint, apiKey, model, userInput, provider, mcpTrace, requestId, prompt }) {
  const response = await requestWithRetry({
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
          { role: 'user', content: `需求：${userInput}。${prompt}。必须同时调用 get_social_recommendations 与 location。` }
        ],
        tools: [
          { type: 'function', function: { name: 'get_social_recommendations', parameters: socialRecommendationTool.parameters } },
          { type: 'function', function: { name: 'location', parameters: locationTool.parameters } }
        ],
        tool_choice: 'auto'
      })
    },
    mcpTrace
  });

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    const error = new Error(`${provider} returned empty response`);
    error.statusCode = 502;
    throw error;
  }

  const { dayPlanItinerary, socialRecommendations } = mapToolCalls(message.tool_calls || [], mcpTrace, provider);

  return {
    provider,
    itinerarySummary: message.content || '规划已生成',
    dayPlanItinerary,
    socialRecommendations,
    mcpTrace
  };
}

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
      if (!process.env.DEEPSEEK_API_KEY) {
        const error = new Error('Missing DEEPSEEK_API_KEY on server');
        error.statusCode = 500;
        throw error;
      }
      plan = await callCompatible({
        endpoint: 'https://api.deepseek.com/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: chosen.modelType,
        userInput: payload.userInput,
        provider: 'deepseek',
        mcpTrace,
        requestId,
        prompt
      });
    } else {
      if (!process.env.ZHIPU_API_KEY) {
        const error = new Error('Missing ZHIPU_API_KEY on server');
        error.statusCode = 500;
        throw error;
      }
      plan = await callCompatible({
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        apiKey: process.env.ZHIPU_API_KEY,
        model: chosen.modelType,
        userInput: payload.userInput,
        provider: 'zhipu',
        mcpTrace,
        requestId,
        prompt
      });
    }
  } catch (error) {
    if (AUTO_ROLLBACK_ON_FAILURE && chosen.rollout === 'canary') {
      mcpTrace.push('rollout:rollback:triggered');
      pushAlert('warning', 'rollout_rollback', 'Canary provider failed, fallback to primary provider', { requestId });
      if (PRIMARY_PROVIDER === 'gemini') {
        plan = await callGemini(process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.5-flash', prompt, mcpTrace, requestId);
      } else if (PRIMARY_PROVIDER === 'deepseek') {
        if (!process.env.DEEPSEEK_API_KEY) throw error;
        plan = await callCompatible({
          endpoint: 'https://api.deepseek.com/chat/completions',
          apiKey: process.env.DEEPSEEK_API_KEY,
          model: process.env.DEFAULT_DEEPSEEK_MODEL || 'deepseek-chat',
          userInput: payload.userInput,
          provider: 'deepseek',
          mcpTrace,
          requestId,
          prompt
        });
      } else {
        if (!process.env.ZHIPU_API_KEY) throw error;
        plan = await callCompatible({
          endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          apiKey: process.env.ZHIPU_API_KEY,
          model: process.env.DEFAULT_ZHIPU_MODEL || 'glm-4-flash',
          userInput: payload.userInput,
          provider: 'zhipu',
          mcpTrace,
          requestId,
          prompt
        });
      }
    } else {
      throw error;
    }
  }

  const enrichedItinerary = enrichWithMcpSignals(plan.dayPlanItinerary || [], mcpTrace);
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

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Request body must be a JSON object';
  if (!payload.userInput || typeof payload.userInput !== 'string') return 'userInput is required';
  if (!payload.modelType || typeof payload.modelType !== 'string') return 'modelType is required';
  return null;
}

function toRefinePayload(payload) {
  const baseSummary = payload.basePlan?.itinerarySummary || '';
  return {
    userInput: `${payload.userInput || ''}\n\n请基于已有方案继续调整：${payload.refineInstruction || ''}\n已有摘要：${baseSummary}`.trim(),
    modelType: payload.modelType,
    isPlannerMode: payload.isPlannerMode !== false,
    travelMode: payload.travelMode || 'deep'
  };
}



function getProviderFromModel(modelType) {
  if (String(modelType || '').startsWith('gemini')) return 'gemini';
  if (String(modelType || '').includes('deepseek')) return 'deepseek';
  if (String(modelType || '').toLowerCase().includes('glm')) return 'zhipu';
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
      ENABLE_CANARY, CANARY_PERCENT, PRIMARY_PROVIDER, CANARY_PROVIDER, AUTO_ROLLBACK_ON_FAILURE, requestId
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
