import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PORT || 8787);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 2);

const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游规划专家。
你的任务是完成一个【三位一体】的规划报告。
1) 社交分析(get_social_recommendations)
2) 地图标注(location)
3) 文字总结。`;

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

function constructUserPrompt(userInput, isPlannerMode, travelMode) {
  if (isPlannerMode) {
    return `旅行风格：${travelMode}。请生成详细每日行程：${userInput}`;
  }
  return `请推荐 5-10 个地点并标注地图：${userInput}`;
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

function normalizeLocation(item = {}) {
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
    temperature: item.temperature ? String(item.temperature) : undefined
  };
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

      console.error(`[${requestId}] ${provider} attempt ${attempt + 1} failed`, {
        message: error?.message,
        retryable
      });

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

  if (!lastError.statusCode) lastError.statusCode = 502;
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
      const item = normalizeLocation(args);
      if (item) dayPlanItinerary.push(item);
      mcpTrace.push(`tool:${provider}:location`);
    }

    if (fnName === 'get_social_recommendations') {
      socialRecommendations = args.recommendations || [];
      mcpTrace.push(`tool:${provider}:get_social_recommendations`);
    }
  }

  return { dayPlanItinerary, socialRecommendations };
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

async function callCompatible({ endpoint, apiKey, model, userInput, provider, mcpTrace, requestId }) {
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
          { role: 'user', content: `需求：${userInput}。必须同时调用 get_social_recommendations 与 location。` }
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
  const prompt = constructUserPrompt(payload.userInput, payload.isPlannerMode, payload.travelMode);

  if (payload.modelType?.startsWith('gemini')) {
    return callGemini(payload.modelType, prompt, mcpTrace, requestId);
  }

  if (payload.modelType?.includes('deepseek')) {
    if (!process.env.DEEPSEEK_API_KEY) {
      const error = new Error('Missing DEEPSEEK_API_KEY on server');
      error.statusCode = 500;
      throw error;
    }
    return callCompatible({
      endpoint: 'https://api.deepseek.com/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: payload.modelType,
      userInput: payload.userInput,
      provider: 'deepseek',
      mcpTrace,
      requestId
    });
  }

  if (!process.env.ZHIPU_API_KEY) {
    const error = new Error('Missing ZHIPU_API_KEY on server');
    error.statusCode = 500;
    throw error;
  }

  return callCompatible({
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: process.env.ZHIPU_API_KEY,
    model: payload.modelType || 'glm-4-flash',
    userInput: payload.userInput,
    provider: 'zhipu',
    mcpTrace,
    requestId
  });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Request body must be a JSON object';
  }
  if (!payload.userInput || typeof payload.userInput !== 'string') {
    return 'userInput is required';
  }
  if (!payload.modelType || typeof payload.modelType !== 'string') {
    return 'modelType is required';
  }
  return null;
}

const server = createServer(async (req, res) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') return json(res, 204, {}, requestId);

  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true, service: 'ai-travel-butler-server', city: 'xian' }, requestId);
  }

  if (req.method === 'POST' && req.url === '/api/plan') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const validationError = validatePayload(payload);
        if (validationError) {
          return json(res, 400, { error: validationError, requestId }, requestId);
        }

        const started = Date.now();
        const data = await generatePlan(payload, requestId);
        data.mcpTrace.push(`request:${requestId}:completed:ms:${Date.now() - started}`);
        return json(res, 200, { ...data, requestId }, requestId);
      } catch (error) {
        const status = error?.statusCode || 500;
        console.error(`[${requestId}] /api/plan failed`, error?.message || error);
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
