
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { locationTool } from './mcp-tools';

declare const google: any;

// Application state
let map: any;
let markers: any[] = [];
let popUps: any[] = [];
let bounds: any;
let markerCluster: any;
let activeCardIndex = 0;
let isPlannerMode = false;
let isUiHidden = false;
let dayPlanItinerary: any[] = [];
let itinerarySummary = "";
let polylines: any[] = []; 

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const DAY_COLORS = ['#ff5722', '#2196f3', '#4caf50', '#9c27b0', '#ffeb3b', '#00bcd4', '#795548'];

function transformSchemaToLowercase(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const newSchema = Array.isArray(schema) ? [...schema] : { ...schema };
  if (newSchema.type && typeof newSchema.type === 'string') {
    newSchema.type = newSchema.type.toLowerCase();
  }
  if (newSchema.properties) {
    for (const key in newSchema.properties) {
      newSchema.properties[key] = transformSchemaToLowercase(newSchema.properties[key]);
    }
  }
  if (newSchema.items) {
    newSchema.items = transformSchemaToLowercase(newSchema.items);
  }
  return newSchema;
}

async function initApp() {
  try {
    const { Map } = await google.maps.importLibrary('maps') as any;
    const { LatLngBounds } = await google.maps.importLibrary('core') as any;
    const mapEl = getEl('map');
    if (!mapEl) return;
    bounds = new LatLngBounds();
    map = new Map(mapEl, {
      center: { lat: 39.9042, lng: 116.4074 }, 
      zoom: 12,
      disableDefaultUI: true,
      gestureHandling: 'greedy', 
      mapId: 'DEMO_MAP_ID',
    });
    try {
      markerCluster = new MarkerClusterer({ map, markers: [] });
    } catch (e) {}
    setupPopupClass();
    bindEvents();
    const savedKey = localStorage.getItem('deepseek_api_key');
    if (savedKey) {
      (getEl('deepseek-key-input') as HTMLInputElement).value = savedKey;
    }
    await loadPlanFromUrl();
    getEl('spinner').classList.add('hidden');
  } catch (err) {
    console.error("Map Initialization Failed", err);
    setStatus("地图初始化失败，请检查网络", "error");
  }
}

function setupPopupClass() {
  (window as any).Popup = class Popup extends google.maps.OverlayView {
    position: any; containerDiv: HTMLDivElement;
    constructor(position: any, content: HTMLElement) {
      super();
      this.position = position;
      this.containerDiv = document.createElement('div');
      this.containerDiv.classList.add('custom-map-popup');
      const bubble = document.createElement('div');
      bubble.classList.add('popup-bubble');
      bubble.appendChild(content);
      this.containerDiv.appendChild(bubble);
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.containerDiv);
    }
    onAdd() { (this as any).getPanes().floatPane.appendChild(this.containerDiv); }
    onRemove() { if (this.containerDiv.parentElement) this.containerDiv.parentElement.removeChild(this.containerDiv); }
    draw() {
      const divPosition = (this as any).getProjection().fromLatLngToDivPixel(this.position);
      if (divPosition) { this.containerDiv.style.left = divPosition.x + 'px'; this.containerDiv.style.top = divPosition.y + 'px'; }
    }
  };
}

function encodeStateToUrl() {
  if (dayPlanItinerary.length === 0) return null;
  const simplifiedItinerary = dayPlanItinerary.map(item => ({
    name: item.name, description: item.description, lat: item.lat, lng: item.lng,
    time: item.time, day: item.day, sequence: item.sequence, transit_hint: item.transit_hint,
    weather_icon: item.weather_icon, temperature: item.temperature
  }));
  const data = { summary: itinerarySummary, items: simplifiedItinerary, isPlanner: isPlannerMode };
  const jsonStr = JSON.stringify(data);
  const base64 = btoa(encodeURIComponent(jsonStr));
  const url = new URL(window.location.href);
  url.searchParams.set('plan', base64);
  return url.toString();
}

async function loadPlanFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const base64 = params.get('plan');
  if (!base64) return;
  try {
    const jsonStr = decodeURIComponent(atob(base64));
    const data = JSON.parse(jsonStr);
    itinerarySummary = data.summary || "";
    isPlannerMode = data.isPlanner || false;
    const toggle = getEl('planner-mode-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = isPlannerMode;
      getEl('mode-text').innerText = isPlannerMode ? "行程规划模式" : "景点发现模式";
      if (isPlannerMode) getEl('preference-toggle-group').classList.remove('hidden');
    }
    for (const item of data.items) { await setPin(item); }
    if (dayPlanItinerary.length > 0) {
      dayPlanItinerary.sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
      createCards();
      if (isPlannerMode) { drawRoute(); createTimeline(); showTimeline(); }
      highlightCard(0, true);
    }
  } catch (e) { console.error("URL Load Failed", e); }
}

async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  const selectedModel = (getEl('model-selector') as HTMLSelectElement).value;
  const routePref = (getEl('route-preference') as HTMLSelectElement).value;
  if (!userInput) return;
  restart();
  getEl('spinner').classList.remove('hidden');
  setStatus(`AI 正在深度检索并规划您的全天候行程...`, "loading");
  try {
    if (selectedModel.startsWith('deepseek')) {
      await handleDeepSeekRequest(selectedModel, userInput);
    } else {
      await handleGeminiRequest(selectedModel, userInput, routePref);
    }
    if (dayPlanItinerary.length === 0) throw new Error("AI 未能识别地图节点。请尝试提供更明确的地点信息。");
    dayPlanItinerary.sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
    createCards();
    if (isPlannerMode) { drawRoute(); createTimeline(); showTimeline(); } else { hideTimeline(); }
    highlightCard(0, true);
    setStatus("", "hidden");
  } catch (e: any) {
    console.error("HandleRequest Error:", e);
    setStatus("⚠️ " + (e.message || "请求失败"), "error");
  } finally {
    getEl('spinner').classList.add('hidden');
  }
}

async function handleGeminiRequest(model: string, input: string, preference: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prefText = preference === 'budget' ? "注重经济性价比" : "注重时间宽松和深度体验";
  
  const response = await ai.models.generateContent({
    model: model,
    contents: [{
      role: 'user',
      parts: [{ text: `目的地及需求：${input}。偏好：${prefText}。要求：如果是多天行程，请务必生成全部天数的行程点，严禁只返回第一天。` }]
    }],
    config: {
      systemInstruction: `你是一位世界顶级的旅游行程规划专家，具备实时联网搜索能力。
      
      【严格执行规范】:
      1. **完整性承诺**: 严禁只返回第一天行程！如果用户需求涉及多天（如“3天2夜”），你必须为【每一天】的【每一个】景点、餐厅和酒店分别调用 'location' 工具。
      2. **实时搜索 (googleSearch)**: 必须先搜索目的地最新的天气、交通（高铁/航班）和避坑指南。
      3. **函数调用优先级**: 先执行所有的 'location' 工具调用，确保地图标记覆盖全部行程，最后再输出 Markdown 文本总结。
      4. **打点要求**: 
         - weather_icon: 必须使用 Emoji (☀️, 🌧️ 等)。
         - temperature: 基于搜索结果给出气温。
         - description: 包含该地点的“避坑指南”和“博主拍照位”。
      5. **Markdown 攻略**: 文本部分应不少于 800 字，包含每日穿搭、转场攻略和实时信息。
      6. 使用中文，语言生动形象，充满博主感。`,
      tools: [{ googleSearch: {} }, { functionDeclarations: [locationTool] }],
    },
  });

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) displayGroundingSources(groundingChunks);

  const functionCalls = response.functionCalls || [];
  for (const fc of functionCalls) {
    if (fc.name === 'location') await setPin(fc.args);
  }

  itinerarySummary = response.text || "行程规划已完成。";
}

async function handleDeepSeekRequest(model: string, input: string) {
  let apiKey = localStorage.getItem('deepseek_api_key') || '';
  const tools = [{
    type: "function",
    function: { name: "location", description: "在地图上标注行程地点。必须包含多天完整信息。", parameters: transformSchemaToLowercase(locationTool.parameters) }
  }];
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: `你是一位顶级旅游博主。必须为行程中每一天的每一个具体地点调用 'location' 工具。严禁只返回第一天！` },
        { role: 'user', content: input }
      ],
      tools: tools, tool_choice: "auto"
    })
  });
  if (!response.ok) throw new Error(`DeepSeek 请求失败: ${response.statusText}`);
  const data = await response.json();
  const message = data.choices[0].message;
  itinerarySummary = message.content || "";
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      if (tc.function.name === 'location') await setPin(JSON.parse(tc.function.arguments));
    }
  }
}

function displayGroundingSources(chunks: any[]) {
  const sourceList = getEl('source-list');
  const groundingContainer = getEl('grounding-sources');
  sourceList.innerHTML = '';
  const uniqueSources = new Set();
  chunks.forEach(chunk => {
    if (chunk.web && chunk.web.uri) {
      if (!uniqueSources.has(chunk.web.uri)) {
        uniqueSources.add(chunk.web.uri);
        const li = document.createElement('li');
        li.innerHTML = `<a href="${chunk.web.uri}" target="_blank"><i class="fas fa-link"></i> ${chunk.web.title || chunk.web.uri}</a>`;
        sourceList.appendChild(li);
      }
    }
  });
  if (uniqueSources.size > 0) groundingContainer.classList.remove('hidden');
}

async function setPin(args: any) {
  const { name, lat, lng, weather_icon, temperature, day } = args;
  const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
  if (isNaN(pos.lat) || isNaN(pos.lng)) return;
  bounds.extend(pos);
  const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
  const marker = new google.maps.Marker({
    position: pos, title: name, map: map,
    icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff', scale: 8 }
  });
  const content = document.createElement('div');
  content.innerHTML = `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:14px;">${weather_icon || '📍'}</span><strong style="font-size:11px;">${name}</strong></div>`;
  const popup = new (window as any).Popup(new google.maps.LatLng(pos), content);
  const item = { ...args, position: new google.maps.LatLng(pos), popup, marker };
  dayPlanItinerary.push(item);
  popUps.push(item);
  map.fitBounds(bounds);
}

let draggedIndex: number | null = null;
function createTimeline() {
  const t = getEl('timeline');
  t.innerHTML = `<div class="itinerary-summary-text">${itinerarySummary.replace(/\n/g, '<br>')}</div>`;
  let currentDay = -1;
  dayPlanItinerary.forEach((item, index) => {
    if (item.day !== currentDay) {
      currentDay = item.day;
      const h = document.createElement('div');
      h.className = 'day-header';
      h.style.background = DAY_COLORS[(currentDay - 1) % DAY_COLORS.length];
      h.innerHTML = `第 ${currentDay} 天`;
      t.appendChild(h);
    }
    const div = document.createElement('div');
    div.className = `timeline-item draggable-item`;
    div.setAttribute('draggable', 'true');
    div.dataset.index = index.toString();
    div.innerHTML = `
      <div class="drag-handle"><i class="fas fa-grip-vertical"></i></div>
      <div class="timeline-time" style="display:flex; justify-content:space-between; align-items:center;">
        <span>${item.time}</span>
        <span class="weather-badge" style="background:#fff2ef; color:#ff5722; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold;">${item.weather_icon || '☀️'} ${item.temperature || ''}</span>
      </div>
      <div class="timeline-content">
        <div class="timeline-title">${item.name}</div>
        <div class="timeline-description">${item.description}</div>
        ${item.transit_hint ? `<div class="transit-info"><i class="fas fa-bus"></i> ${item.transit_hint}</div>` : ''}
      </div>`;
    div.addEventListener('dragstart', (e: DragEvent) => { draggedIndex = index; div.classList.add('dragging'); });
    div.addEventListener('dragend', () => { div.classList.remove('dragging'); draggedIndex = null; document.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('drag-over')); });
    div.addEventListener('dragover', (e: DragEvent) => { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => { div.classList.remove('drag-over'); });
    div.addEventListener('drop', (e: DragEvent) => { e.preventDefault(); const targetIndex = parseInt(div.dataset.index || "0"); if (draggedIndex !== null && draggedIndex !== targetIndex) reorderItinerary(draggedIndex, targetIndex); });
    div.onclick = () => highlightCard(index, true);
    t.appendChild(div);
  });
}

function reorderItinerary(from: number, to: number) {
  const item = dayPlanItinerary.splice(from, 1)[0];
  dayPlanItinerary.splice(to, 0, item);
  createTimeline(); createCards(); drawRoute(); highlightCard(to, true);
}

function createCards() {
  const container = getEl('card-container');
  container.innerHTML = '';
  getEl('card-carousel').classList.remove('hidden');
  dayPlanItinerary.forEach((loc, index) => {
    const card = document.createElement('div');
    card.className = `location-card`;
    card.innerHTML = `
      <div class="card-day-mini" style="background: ${DAY_COLORS[(loc.day - 1) % DAY_COLORS.length]}">D${loc.day}</div>
      <div class="card-info-mini"><div class="card-title-mini">${loc.weather_icon || '📍'} ${loc.name}</div><div class="card-time-mini">${loc.time} · ${loc.temperature || ''}</div></div>`;
    card.onclick = () => highlightCard(index, true);
    container.appendChild(card);
  });
}

function highlightCard(index: number, scroll: boolean = false) {
  popUps.forEach(p => p.popup.setMap(null));
  activeCardIndex = Math.max(0, Math.min(index, dayPlanItinerary.length - 1));
  const item = dayPlanItinerary[activeCardIndex];
  if (item) {
    item.popup.setMap(map);
    map.panTo(item.position);
    if (scroll) {
      const cards = document.querySelectorAll('.location-card');
      cards[activeCardIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      cards.forEach(c => c.classList.remove('active'));
      cards[activeCardIndex]?.classList.add('active');
    }
  }
}

function drawRoute() {
  polylines.forEach(p => p.setMap(null));
  polylines = [];
  const routesByDay: { [key: number]: any[] } = {};
  dayPlanItinerary.forEach(item => { if (!routesByDay[item.day]) routesByDay[item.day] = []; routesByDay[item.day].push(item.position); });
  Object.keys(routesByDay).forEach(dayStr => {
    const day = parseInt(dayStr);
    const path = routesByDay[day];
    if (path.length < 2) return;
    const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
    const poly = new google.maps.Polyline({ path, strokeColor: color, strokeOpacity: 0.8, strokeWeight: 4, map, icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW }, offset: '50%', repeat: '100px' }] });
    polylines.push(poly);
  });
}

function restart() {
  popUps.forEach(p => p.popup.setMap(null));
  polylines.forEach(p => p.setMap(null));
  polylines = [];
  dayPlanItinerary.forEach(item => { if (item.marker) item.marker.setMap(null); });
  dayPlanItinerary = [];
  getEl('card-container').innerHTML = '';
  getEl('card-carousel').classList.add('hidden');
  getEl('timeline-container').classList.remove('visible');
  getEl('grounding-sources').classList.add('hidden');
  getEl('source-list').innerHTML = '';
  bounds = new google.maps.LatLngBounds();
  const url = new URL(window.location.href);
  url.searchParams.delete('plan');
  window.history.replaceState({}, '', url.toString());
  setStatus("", "hidden");
}

function setStatus(msg: string, type: string) {
  const err = getEl('error-message');
  if (type === 'hidden') { err.classList.add('hidden'); return; }
  err.innerText = msg; err.className = `error ${type}`; err.classList.remove('hidden');
}

function bindEvents() {
  getEl('planner-mode-toggle').onchange = (e) => {
    isPlannerMode = (e.target as HTMLInputElement).checked;
    getEl('mode-text').innerText = isPlannerMode ? "行程规划模式" : "景点发现模式";
    const prefGroup = getEl('preference-toggle-group');
    if (isPlannerMode) prefGroup.classList.remove('hidden'); else prefGroup.classList.add('hidden');
    restart();
  };
  getEl('generate').onclick = handleRequest;
  getEl('reset').onclick = restart;
  getEl('export-btn').onclick = () => {
    let md = `# 行程指南\n\n${itinerarySummary}\n\n`;
    dayPlanItinerary.forEach(i => md += `## 第 ${i.day} 天: ${i.name}\n- 时间: ${i.time}\n- 天气: ${i.weather_icon} ${i.temperature}\n- 详情: ${i.description}\n\n`);
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `行程指南.md`;
    a.click();
  };
  getEl('share-btn').onclick = () => {
    const url = encodeStateToUrl();
    if (url) { navigator.clipboard.writeText(url).then(() => alert("行程链接已复制到剪贴板！")).catch(e => alert("复制失败，请重试")); }
    else alert("请先生成行程");
  };
  getEl('close-timeline').onclick = hideTimeline;
  getEl('reopen-timeline').onclick = showTimeline;
  getEl('toggle-search-ui').onclick = () => {
    isUiHidden = !isUiHidden;
    getEl('search-container').classList.toggle('ui-hidden', isUiHidden);
    getEl('toggle-search-ui').innerHTML = isUiHidden ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
  };
  getEl('open-settings').onclick = () => getEl('settings-modal').classList.remove('hidden');
  getEl('close-settings').onclick = () => getEl('settings-modal').classList.add('hidden');
  getEl('save-settings').onclick = () => {
    const val = (getEl('deepseek-key-input') as HTMLInputElement).value.trim();
    localStorage.setItem('deepseek_api_key', val);
    getEl('settings-modal').classList.add('hidden');
  };
}

function hideTimeline() { getEl('timeline-container').classList.remove('visible'); document.body.classList.remove('timeline-open'); if (dayPlanItinerary.length > 0) getEl('reopen-timeline').classList.remove('hidden'); }
function showTimeline() { getEl('timeline-container').classList.add('visible'); document.body.classList.add('timeline-open'); getEl('reopen-timeline').classList.add('hidden'); }

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }
