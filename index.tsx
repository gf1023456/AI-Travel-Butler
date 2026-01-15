
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

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * 极端强化后的核心系统提示词
 */
const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游行程规划专家，集成 MCP 社交推荐服务。
【极端强制规范 - 违者重罚】:
1. **完整性压倒一切**: 如果用户要求 N 天行程，你必须调用 'location' 工具【至少 N*3 次】。例如：3天行程必须标注至少 9-12 个地点。严禁只标注 1 个点就结束任务。
2. **社交趋势先行**: 必须首先调用 'get_social_recommendations' 工具，从小红书/抖音获取当前最火的机位。
3. **函数调用链**:
    - 你必须通过【多次连续】调用 'location' 工具来构建完整的行程流水线。
    - 每一天必须包含：早餐/上午景点、午餐、下午景点、晚餐/夜游。
4. **打点细节要求**: 
    - lat & lng: 必须是真实的十进制地理坐标。
    - category: 必须分类为 SIGHT, FOOD, HOTEL, 或 TRANSIT。
    - transit_hint: 必须包含具体的交通路线（如：地铁X号线XX站出）。
5. **拒绝开场白**: 禁止说“我将为您规划...”，禁止输出 <think> 标签内容。直接调用工具，最后返回 Markdown 格式的避坑指南和机位汇总。
6. **循环任务**: 如果你发现天数没规划完，请继续调用 'location' 工具直到所有天数都覆盖。`;

function initApp() {
  map = L.map('map', {
    center: [39.9042, 116.4074],
    zoom: 12,
    zoomControl: false,
    attributionControl: false
  });

  const savedTdtKey = localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY;
  const savedDeepSeekKey = localStorage.getItem('deepseek_api_key') || "";
  
  if (getEl('tdt-key-input')) (getEl('tdt-key-input') as HTMLInputElement).value = savedTdtKey;
  if (getEl('deepseek-key-input')) (getEl('deepseek-key-input') as HTMLInputElement).value = savedDeepSeekKey;

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
  
  // 重新打开行程指南的按钮逻辑
  getEl('toggle-timeline').onclick = () => {
    const container = getEl('timeline-container');
    container.classList.toggle('visible');
  };

  getEl('save-settings').onclick = (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const dsKey = (getEl('deepseek-key-input') as HTMLInputElement).value.trim();
    const tdtKey = (getEl('tdt-key-input') as HTMLInputElement).value.trim();
    
    localStorage.setItem('deepseek_api_key', dsKey);
    localStorage.setItem('tdt_api_key', tdtKey);
    
    btn.innerHTML = '<i class="fas fa-check"></i> 已保存';
    btn.style.background = '#10b981';
    
    setTimeout(() => {
      getEl('settings-modal').classList.add('hidden');
      window.location.reload();
    }, 500);
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
    } else {
      await handleGeminiRequest(model, userInput, pref);
    }
    renderAll();
  } catch (e: any) {
    getEl('error-message').innerText = "⚠️ " + (e.message || "请求失败，请检查配置");
    getEl('error-message').classList.remove('hidden');
  } finally {
    getEl('spinner').classList.add('hidden');
  }
}

async function handleGeminiRequest(model: string, input: string, pref: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: model,
    contents: [{ role: 'user', parts: [{ text: `需求：${input}。请按照${pref === 'budget' ? '经济游' : '深度游'}标准，【必须】规划完整天数行程，每天不少于3个点。` }] }],
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
  itinerarySummary = response.text || "行程规划已就绪。";
}

async function handleDeepSeekRequest(model: string, input: string, pref: string) {
  const apiKey = localStorage.getItem('deepseek_api_key');
  if (!apiKey) throw new Error("请先配置 DeepSeek API Key");

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: model, 
      messages: [
        { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
        { role: 'user', content: `我的行程需求：${input}。请严格按规范提供每一天的每个打点，不要遗漏天数。` }
      ],
      tools: [
        { type: "function", function: { name: "location", parameters: transformSchema(locationTool.parameters) } },
        { type: "function", function: { name: "get_social_recommendations", parameters: transformSchema(socialRecommendationTool.parameters) } }
      ],
      tool_choice: "auto",
      max_tokens: 4000
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const message = data.choices[0].message;
  itinerarySummary = message.content || "正在渲染多天行程计划...";
  
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
      <div style="min-width:180px;">
        <b style="color:${color}; font-size:15px;">${item.name}</b><br>
        <span style="font-size:12px;">${item.weather_icon || '📍'} ${item.weather_condition || ''} ${item.temperature || ''}</span><hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
        <p style="font-size:11px; color:#444;">${item.description}</p>
        <p style="font-size:11px; color:#ff5722; font-weight:bold; margin-top:5px;">🚌 ${item.transit_hint}</p>
      </div>
    `);
    item._marker = marker;
  });

  if (points.length > 0) {
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    // 规划成功后自动打开行程指南
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
      h.style.color = DAY_COLORS[(curDay-1)%DAY_COLORS.length]; h.innerText = `第 ${curDay} 天行程规划`;
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
      card.innerHTML = `<div class="rec-top"><span class="rank">#${rec.rank}</span><span class="platform">${rec.platform}</span></div><div class="rec-title">${rec.title}</div><div class="rec-reason">${rec.reason}</div><div class="rec-tips">📷 ${rec.photo_tips || '暂无拍照攻略'}</div>`;
      list.appendChild(card);
    });
  }
}

async function generatePoster() {
  const btn = getEl('generate-poster-btn');
  btn.innerText = "正在设计海报...";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const target = dayPlanItinerary[0]?.name || "奇幻之旅";
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality travel poster for ${target}, cinematic lighting, elegant design.` }] },
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
      ctx.font = "32px 'PingFang SC'"; ctx.fillText("AI 深度智能规划 · 旅行从未如此简单", 400, 1340);
      getEl('poster-placeholder').classList.add('hidden');
      getEl('poster-result').classList.remove('hidden');
    };
  } catch (e) { btn.innerText = "生成失败"; }
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
