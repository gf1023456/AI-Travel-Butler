import { createServer } from 'node:http';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PORT || 8787);

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
      day: { type: 'number' }, sequence: { type: 'number' }, transit_hint: { type: 'string' }
    },
    required: ['name', 'lat', 'lng']
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
            hot_score: { type: 'string' }, reason: { type: 'string' }
          }
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

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
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
    transit_hint: String(item.transit_hint || '')
  };
}

async function callGemini(modelType, prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY on server');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: modelType,
    contents: prompt,
    config: {
      systemInstruction: GLOBAL_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [locationTool, socialRecommendationTool] }]
    }
  });

  const dayPlanItinerary = [];
  let socialRecommendations = [];
  for (const fc of response.functionCalls || []) {
    if (fc.name === 'location') {
      const item = normalizeLocation(fc.args);
      if (item) dayPlanItinerary.push(item);
    }
    if (fc.name === 'get_social_recommendations') socialRecommendations = fc.args?.recommendations || [];
  }
  return {
    provider: 'gemini',
    itinerarySummary: response.text || '排期已生成',
    dayPlanItinerary,
    socialRecommendations,
    mcpTrace: ['backend:gemini:function-calls', 'placeholder:mcp:route', 'placeholder:mcp:weather']
  };
}

async function callCompatible({ endpoint, apiKey, model, userInput, provider }) {
  const response = await fetch(endpoint, {
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
  });
  if (!response.ok) throw new Error(`${provider} failed with ${response.status}`);
  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error(`${provider} returned empty response`);

  const dayPlanItinerary = [];
  let socialRecommendations = [];
  for (const tc of message.tool_calls || []) {
    const args = JSON.parse(tc.function?.arguments || '{}');
    if (tc.function?.name === 'location') {
      const item = normalizeLocation(args);
      if (item) dayPlanItinerary.push(item);
    }
    if (tc.function?.name === 'get_social_recommendations') socialRecommendations = args.recommendations || [];
  }

  return {
    provider,
    itinerarySummary: message.content || '规划已生成',
    dayPlanItinerary,
    socialRecommendations,
    mcpTrace: [`backend:${provider}:function-calls`, 'placeholder:mcp:route', 'placeholder:mcp:weather']
  };
}

async function generatePlan(payload) {
  const prompt = constructUserPrompt(payload.userInput, payload.isPlannerMode, payload.travelMode);
  if (payload.modelType?.startsWith('gemini')) return callGemini(payload.modelType, prompt);
  if (payload.modelType?.includes('deepseek')) {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error('Missing DEEPSEEK_API_KEY on server');
    return callCompatible({ endpoint: 'https://api.deepseek.com/chat/completions', apiKey: process.env.DEEPSEEK_API_KEY, model: payload.modelType, userInput: payload.userInput, provider: 'deepseek' });
  }
  if (!process.env.ZHIPU_API_KEY) throw new Error('Missing ZHIPU_API_KEY on server');
  return callCompatible({ endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', apiKey: process.env.ZHIPU_API_KEY, model: payload.modelType || 'glm-4-flash', userInput: payload.userInput, provider: 'zhipu' });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true, service: 'ai-travel-butler-server', city: 'xian' });
  }

  if (req.method === 'POST' && req.url === '/api/plan') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!payload.userInput || !payload.modelType) return json(res, 400, { error: 'userInput and modelType are required' });
        const data = await generatePlan(payload);
        return json(res, 200, data);
      } catch (error) {
        return json(res, 500, { error: error.message || 'Planner error' });
      }
    });
    return;
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`AI Travel Butler backend running on http://localhost:${PORT}`);
});
