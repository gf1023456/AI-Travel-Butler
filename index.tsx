
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import L from 'leaflet';
import 'leaflet.markercluster';
import { locationTool, socialRecommendationTool } from './mcp-tools';

// Application state
let map: L.Map;
let dayPlanItinerary: any[] = [];
let socialRecommendations: any[] = [];
let itinerarySummary = "";
let polylines: L.Polyline[] = [];
let tdtLayer: L.TileLayer;
let tdtAnnoLayer: L.TileLayer;

// Constants
const TDT_DEFAULT_KEY = "97f9870fb795ba80ef201d6edae71d73";
const DAY_COLORS = ['#ff5722', '#2196f3', '#4caf50', '#9c27b0', '#ffeb3b', '#00bcd4', '#795548'];
const MAX_HISTORY = 10;

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * 【最高优先级指令】解决工具调用不全（互斥）的问题
 */
const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游规划专家。
你的任务是完成一个【三位一体】的规划报告，缺少任何一部分都将被判定为任务失败。

【必须包含的三大部分】：
1. 社交分析阶段 (工具: get_social_recommendations):
   - 必须调用一次。分析当前最火的趋势，为用户提供灵感。
   
2. 地图标注阶段 (工具: location):
   - 必须针对用户要求的【每一天】调用多次。
   - 每一天的行程必须至少包含 3-4 个 location 打点（早、中、晚、交通）。
   - 禁止在调用完社交推荐后就停止！必须紧接着进行地图打点。

3. 文字总结阶段:
   - 在所有工具调用完成后，提供简洁的行程亮点说明。

【严苛禁令】：
- 严禁二选一！必须【同时】给出社交平台趋势和每日具体的地图行程。
- 严禁输出 <think> 标签内容。
- 严禁任何废话开场白，直接开始调用工具链。`;

function initApp() {
  map = L.map('map', {
    center: [39.9042, 116.4074],
    zoom: 12,
    zoomControl: false,
    attributionControl: false
  });

  const savedTdtKey = localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY;
  const savedDeepSeekKey = localStorage.getItem('deepseek_api_key') || "";
  const savedZhipuKey = localStorage.getItem('zhipu_api_key') || "";
  
  if (getEl('tdt-key-input')) (getEl('tdt-key-input') as HTMLInputElement).value = savedTdtKey;
  if (getEl('deepseek-key-input')) (getEl('deepseek-key-input') as HTMLInputElement).value = savedDeepSeekKey;
  if (getEl('zhipu-key-input')) (getEl('zhipu-key-input') as HTMLInputElement).value = savedZhipuKey;

  switchTDT('tdt_vec', savedTdtKey);
  bindEvents();
  getEl('spinner').classList.add('hidden');
}

function switchTDT(type: string, tk: string) {
  if (tdtLayer) map.removeLayer(tdtLayer);
  if (tdtAnnoLayer) map.removeLayer(tdtAnnoLayer);
  const layer = type === 'tdt_vec' ? 'vec_w' : 'img_w';
  const anno = type === 'tdt_vec' ? 'cva_w' : 'cia_w';
  tdtLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/${layer}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer.split('_')[0]}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${tk}`, {
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
  }).addTo(map);
  tdtAnnoLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/${anno}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${anno.split('_')[0]}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${tk}`, {
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
  }).addTo(map);
}

function bindEvents() {
  getEl('open-settings').onclick = () => getEl('settings-modal').classList.remove('hidden');
  getEl('close-settings').onclick = () => getEl('settings-modal').classList.add('hidden');
  
  // 历史记录
  getEl('open-history').onclick = () => {
    renderHistoryList();
    getEl('history-modal').classList.remove('hidden');
  };
  getEl('close-history').onclick = () => getEl('history-modal').classList.add('hidden');

  getEl('toggle-timeline').onclick = () => {
    getEl('timeline-container').classList.toggle('visible');
  };

  getEl('save-settings').onclick = (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const dsKey = (getEl('deepseek-key-input') as HTMLInputElement).value.trim();
    const zpKey = (getEl('zhipu-key-input') as HTMLInputElement).value.trim();
    const tdtKey = (getEl('tdt-key-input') as HTMLInputElement).value.trim();
    
    localStorage.setItem('deepseek_api_key', dsKey);
    localStorage.setItem('zhipu_api_key', zpKey);
    localStorage.setItem('tdt_api_key', tdtKey);
    
    switchTDT('tdt_vec', tdtKey);
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> 保存成功';
    btn.style.background = '#10b981';
    
    setTimeout(() => {
      getEl('settings-modal').classList.add('hidden');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 300);
    }, 800);
  };

  getEl('toggle-map-type').onclick = (e) => { e.stopPropagation(); getEl('map-type-menu').classList.toggle('hidden'); };
  
  document.querySelectorAll('.menu-item').forEach(item => {
    (item as HTMLElement).onclick = function() {
      const type = (this as HTMLElement).getAttribute('data-type')!;
      switchTDT(type, localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY);
      getEl('map-type-menu').classList.add('hidden');
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      (this as HTMLElement).classList.add('active');
    };
  });

  getEl('planner-mode-toggle').onchange = (e) => {
    const isPlanner = (e.target as HTMLInputElement).checked;
    getEl('mode-text').innerText = isPlanner ? "行程规划模式" : "景点发现模式";
    getEl('preference-toggle-group').classList.toggle('hidden', !isPlanner);
    restart();
  };

  getEl('toggle-search-ui').onclick = () => {
    getEl('sidebar-left').classList.toggle('ui-hidden');
    setTimeout(() => map.invalidateSize(), 400);
  };

  getEl('generate').onclick = handleRequest;
  getEl('reset').onclick = restart;
  getEl('close-timeline').onclick = () => getEl('timeline-container').classList.remove('visible');
  getEl('close-share').onclick = () => getEl('share-modal').classList.add('hidden');
  getEl('share-btn').onclick = () => getEl('share-modal').classList.remove('hidden');
  getEl('generate-poster-btn').onclick = generatePoster;
}

async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  if (!userInput) return;
  restart();
  getEl('spinner').classList.remove('hidden');
  getEl('error-message').classList.add('hidden');
  try {
    const model = (getEl('model-selector') as HTMLSelectElement).value;
    const pref = (getEl('route-preference') as HTMLSelectElement).value;
    
    if (model.startsWith('deepseek')) {
      await handleDeepSeekRequest(model, userInput, pref);
    } else if (model.startsWith('glm')) {
      await handleZhipuRequest(model, userInput, pref);
    } else {
      await handleGeminiRequest(model, userInput, pref);
    }
    
    if (dayPlanItinerary.length > 0 || socialRecommendations.length > 0) {
      saveToHistory(userInput);
      renderAll();
    }
  } catch (e: any) {
    getEl('error-message').innerText = "⚠️ " + (e.message || "请求失败，请检查配置或网络");
    getEl('error-message').classList.remove('hidden');
  } finally {
    getEl('spinner').classList.add('hidden');
  }
}

// 历史记录保存逻辑
function saveToHistory(prompt: string) {
  const historyStr = localStorage.getItem('travel_history') || "[]";
  let history = JSON.parse(historyStr);
  
  const title = dayPlanItinerary[0]?.name || prompt.substring(0, 15);
  const newItem = {
    id: Date.now().toString(),
    timestamp: new Date().toLocaleString(),
    title: title,
    dayPlanItinerary,
    socialRecommendations,
    itinerarySummary
  };
  
  history.unshift(newItem);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  
  localStorage.setItem('travel_history', JSON.stringify(history));
}

function renderHistoryList() {
  const historyStr = localStorage.getItem('travel_history') || "[]";
  const history = JSON.parse(historyStr);
  const container = getEl('history-list');
  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px 0;">暂无历史记录</div>';
    return;
  }
  
  history.forEach((item: any) => {
    const card = document.createElement('div');
    card.className = 'history-item-card';
    card.innerHTML = `
      <div class="history-item-info">
        <div class="history-item-title">${item.title}</div>
        <div class="history-item-time">${item.timestamp}</div>
      </div>
      <div class="history-item-actions">
        <button class="history-load-btn" data-id="${item.id}">查看</button>
        <button class="history-delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
      </div>
    `;
    
    card.querySelector('.history-load-btn')?.addEventListener('click', () => loadHistoryItem(item.id));
    card.querySelector('.history-delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
    });
    
    container.appendChild(card);
  });
}

function loadHistoryItem(id: string) {
  const historyStr = localStorage.getItem('travel_history') || "[]";
  const history = JSON.parse(historyStr);
  const item = history.find((i: any) => i.id === id);
  if (!item) return;
  
  restart();
  dayPlanItinerary = item.dayPlanItinerary || [];
  socialRecommendations = item.socialRecommendations || [];
  itinerarySummary = item.itinerarySummary || "";
  
  renderAll();
  getEl('history-modal').classList.add('hidden');
}

function deleteHistoryItem(id: string) {
  const historyStr = localStorage.getItem('travel_history') || "[]";
  let history = JSON.parse(historyStr);
  history = history.filter((i: any) => i.id !== id);
  localStorage.setItem('travel_history', JSON.stringify(history));
  renderHistoryList();
}

async function handleGeminiRequest(model: string, input: string, pref: string) {
  const apiKey = (getEl('gemini-key-input') as HTMLInputElement).value.trim() || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: model,
    contents: [{ role: 'user', parts: [{ text: `规划需求：${input}。必须输出社交趋势分析 AND 每日打点。` }] }],
    config: {
      systemInstruction: GLOBAL_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [locationTool, socialRecommendationTool] }],
    },
  });
  const functionCalls = (response.functionCalls || []) as any[];
  for (const fc of functionCalls) {
    if (fc.name === 'location') addValidItem(fc.args);
    if (fc.name === 'get_social_recommendations') socialRecommendations = fc.args.recommendations || [];
  }
  itinerarySummary = response.text || "规划已生成。";
}

async function handleDeepSeekRequest(model: string, input: string, pref: string) {
  const apiKey = localStorage.getItem('deepseek_api_key');
  if (!apiKey) throw new Error("请先在设置中配置 DeepSeek API Key");

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: model, 
      messages: [
        { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
        { role: 'user', content: `【强制执行】需求：${input}。
你需要同时执行以下两个子任务：
任务A：调用 'get_social_recommendations'。
任务B：为每一天调用多次 'location'。
请立刻开始调用工具，不要回复文字说明。` }
      ],
      tools: [
        { type: "function", function: { name: "get_social_recommendations", parameters: transformSchema(socialRecommendationTool.parameters) } },
        { type: "function", function: { name: "location", parameters: transformSchema(locationTool.parameters) } }
      ],
      tool_choice: "auto",
      max_tokens: 4000,
      temperature: 0.1
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const message = data.choices[0].message;
  itinerarySummary = message.content || "规划数据同步中...";
  
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      if (tc.function.name === 'location') addValidItem(args);
      if (tc.function.name === 'get_social_recommendations') socialRecommendations = args.recommendations || [];
    }
  }

  if (socialRecommendations.length > 0 && dayPlanItinerary.length === 0) {
    itinerarySummary = "⚠️ 模型仅返回了趋势分析，未能完成地图打点。建议再次点击“开始规划”或换用 Gemini 3 Pro。";
  }
}

async function handleZhipuRequest(model: string, input: string, pref: string) {
  const apiKey = localStorage.getItem('zhipu_api_key');
  if (!apiKey) throw new Error("请先在设置中配置 智谱 AI API Key");

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${apiKey}` 
    },
    body: JSON.stringify({ 
      model: 'glm-4.7', 
      messages: [
        { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
        { role: 'user', content: `【强制任务】规划需求：${input}。必须同时调用社交推荐和打点工具。` }
      ],
      tools: [
        { type: "function", function: { name: "get_social_recommendations", parameters: transformSchema(socialRecommendationTool.parameters) } },
        { type: "function", function: { name: "location", parameters: transformSchema(locationTool.parameters) } }
      ],
      tool_choice: "auto",
      max_tokens: 4096,
      temperature: 0.2
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const message = data.choices[0].message;
  itinerarySummary = message.content || "正在解析智谱 AI 规划结果...";
  
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      if (tc.function.name === 'location') addValidItem(args);
      if (tc.function.name === 'get_social_recommendations') socialRecommendations = args.recommendations || [];
    }
  }
}

function addValidItem(args: any) {
  const lat = parseFloat(args.lat);
  const lng = parseFloat(args.lng);
  if (!isNaN(lat) && !isNaN(lng)) {
    dayPlanItinerary.push(args);
  }
}

function renderAll() {
  dayPlanItinerary.sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
  const points: L.LatLng[] = [];
  
  dayPlanItinerary.forEach((item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const latlng = L.latLng(lat, lng);
    points.push(latlng);
    
    const color = DAY_COLORS[(item.day - 1) % DAY_COLORS.length] || '#ff5722';
    const marker = L.circleMarker(latlng, { radius: 10, fillColor: color, color: "#fff", weight: 2, fillOpacity: 1 }).addTo(map);
    
    marker.bindPopup(`
      <div style="min-width:200px; padding: 4px;">
        <b style="color:${color}; font-size:15px; display:block; margin-bottom:4px;">Day ${item.day}: ${item.name}</b>
        <span style="font-size:12px; color:#666;">${item.weather_icon || '📍'} ${item.weather_condition || ''} ${item.temperature || ''}</span>
        <hr style="margin:8px 0; border:0; border-top:1px solid #eee;">
        <p style="font-size:11px; color:#444; line-height:1.5;">${item.description}</p>
        <p style="font-size:11px; color:#ff5722; font-weight:bold; margin-top:8px; border-top:1px dashed #eee; padding-top:4px;">🚌 交通: ${item.transit_hint}</p>
      </div>
    `);
    item._marker = marker;
  });

  if (points.length > 0) {
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
  }

  if (points.length > 0 || socialRecommendations.length > 0) {
    getEl('timeline-container').classList.add('visible');
  }

  createCards();
  createTimeline();
  renderSocialRecs();
  
  if ((getEl('planner-mode-toggle') as HTMLInputElement).checked) {
    drawRoutes();
  }
}

function createCards() {
  const container = getEl('card-container');
  container.innerHTML = '';
  if (dayPlanItinerary.length === 0) {
    getEl('card-carousel').classList.add('hidden');
    return;
  }
  getEl('card-carousel').classList.remove('hidden');
  dayPlanItinerary.forEach((loc) => {
    const card = document.createElement('div');
    card.className = `location-card`;
    card.innerHTML = `<div class="card-day-mini" style="background:${DAY_COLORS[(loc.day-1)%DAY_COLORS.length]}">D${loc.day}</div><div class="card-title-mini">${loc.name}</div>`;
    card.onclick = () => {
      document.querySelectorAll('.location-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      if (loc._marker) { 
        map.setView(loc._marker.getLatLng(), 15); 
        loc._marker.openPopup(); 
      }
    };
    container.appendChild(card);
  });
}

function createTimeline() {
  const container = getEl('timeline-content');
  container.innerHTML = `<div class="itinerary-summary-box">${itinerarySummary.replace(/\n/g, '<br>')}</div>`;
  
  let curDay = -1;
  dayPlanItinerary.forEach(item => {
    if (item.day !== curDay) {
      curDay = item.day;
      const h = document.createElement('div'); h.className = 'timeline-day-header';
      h.style.color = DAY_COLORS[(curDay-1)%DAY_COLORS.length]; h.innerText = `第 ${curDay} 天行程安排`;
      container.appendChild(h);
    }
    const entry = document.createElement('div'); entry.className = 'timeline-entry';
    entry.innerHTML = `<div class="timeline-time">${item.time}</div><div class="timeline-dot" style="background:${DAY_COLORS[(curDay-1)%DAY_COLORS.length]}"></div><div class="timeline-details"><div class="timeline-title">${item.name}</div><div class="timeline-desc">${item.description}</div></div>`;
    entry.onclick = () => { if (item._marker) { map.setView(item._marker.getLatLng(), 15); item._marker.openPopup(); } };
    container.appendChild(entry);
  });
}

function drawRoutes() {
  const dailyPath = new Map<number, L.LatLng[]>();
  dayPlanItinerary.forEach(item => {
    if (!dailyPath.has(item.day)) dailyPath.set(item.day, []);
    dailyPath.get(item.day)!.push(L.latLng(parseFloat(item.lat), parseFloat(item.lng)));
  });
  dailyPath.forEach((path, day) => {
    if (path.length > 1) {
      const poly = L.polyline(path, { color: DAY_COLORS[(day-1)%DAY_COLORS.length], weight: 4, opacity: 0.6, dashArray: '8, 12' }).addTo(map);
      polylines.push(poly);
    }
  });
}

function renderSocialRecs() {
  const list = getEl('social-recs-list'); list.innerHTML = '';
  if (socialRecommendations.length > 0) {
    getEl('social-recs-section').classList.remove('hidden');
    socialRecommendations.forEach(rec => {
      const card = document.createElement('div'); 
      card.className = 'social-rec-card';
      card.innerHTML = `<div class="rec-top"><span class="rank">#${rec.rank}</span><span class="platform">${rec.platform}</span></div><div class="rec-title">${rec.title}</div><div class="rec-reason">${rec.reason}</div><div class="rec-tips">📷 拍照机位: ${rec.photo_tips || '建议参考社交媒体实时笔记'}</div>`;
      list.appendChild(card);
    });
  }
}

async function generatePoster() {
  const btn = getEl('generate-poster-btn');
  btn.innerText = "海报制作中...";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const target = dayPlanItinerary[0]?.name || "奇幻旅程";
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality cinematic travel poster for ${target}, vibrant mood, elegant typography.` }] },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    let base64 = "";
    for (const part of response.candidates[0].content.parts) { if (part.inlineData) base64 = part.inlineData.data; }
    const canvas = getEl('poster-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 800, 1422);
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 1150, 800, 272);
      ctx.fillStyle = "white"; ctx.font = "bold 64px 'PingFang SC'"; ctx.textAlign = "center";
      ctx.fillText(target, 400, 1260);
      ctx.font = "32px 'PingFang SC'"; ctx.fillText("AI 深度智能规划 · 旅行从未如此精彩", 400, 1340);
      getEl('poster-placeholder').classList.add('hidden');
      getEl('poster-result').classList.remove('hidden');
    };
  } catch (e) { btn.innerText = "制作失败"; }
}

function restart() {
  dayPlanItinerary.forEach(item => { if (item._marker) map.removeLayer(item._marker); });
  polylines.forEach(p => map.removeLayer(p));
  dayPlanItinerary = []; socialRecommendations = []; polylines = [];
  getEl('card-container').innerHTML = '';
  getEl('card-carousel').classList.add('hidden');
  getEl('social-recs-section').classList.add('hidden');
  getEl('timeline-container').classList.remove('visible');
  getEl('error-message').classList.add('hidden');
}

function transformSchema(s: any) {
  const n = JSON.parse(JSON.stringify(s));
  if (n.type) n.type = n.type.toLowerCase();
  if (n.properties) for (const k in n.properties) n.properties[k] = transformSchema(n.properties[k]);
  if (n.items) n.items = transformSchema(n.items);
  return n;
}

initApp();
