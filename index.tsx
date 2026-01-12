
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
let polyline: any = null;

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * 转换 Schema 类型为小写以兼容 OpenAI/DeepSeek 接口
 */
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

async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  const selectedModel = (getEl('model-selector') as HTMLSelectElement).value;
  const routePref = (getEl('route-preference') as HTMLSelectElement).value;
  
  if (!userInput) return;

  restart();
  getEl('spinner').classList.remove('hidden');
  setStatus(`AI 正在规划您的行程...`, "loading");

  try {
    if (selectedModel.startsWith('deepseek')) {
      await handleDeepSeekRequest(selectedModel, userInput);
    } else {
      await handleGeminiRequest(selectedModel, userInput, routePref);
    }

    if (dayPlanItinerary.length === 0) {
      console.warn("No nodes generated. Response text was:", itinerarySummary);
      throw new Error("AI 未能识别或生成任何地图节点。请确保您的需求中包含明确的地点，或者尝试换个模型。");
    }
    
    dayPlanItinerary.sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
    
    createCards();
    if (isPlannerMode) { 
      drawRoute(); 
      createTimeline(); 
      showTimeline(); 
    } else { 
      hideTimeline(); 
    }

    highlightCard(0, true);
    setStatus("", "hidden");
  } catch (e: any) {
    console.error("HandleRequest Error:", e);
    setStatus("⚠️ " + e.message, "error");
  } finally {
    getEl('spinner').classList.add('hidden');
  }
}

async function handleGeminiRequest(model: string, input: string, preference: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prefText = preference === 'budget' ? "【经济性价比】" : "【时间宽松深度游】";
  
  const response = await ai.models.generateContent({
    model: model,
    contents: [{
      role: 'user',
      parts: [{ text: `用户需求：${input}。旅行风格偏好：${prefText}。请规划行程。` }]
    }],
    config: {
      systemInstruction: `你是一位顶级旅游博主。
      必须遵守：
      1. 使用 googleSearch 获取目的地实时交通（具体的高铁班次号、航班状态）、天气预报。
      2. 行程中的每个具体地点都【必须】调用 location 工具进行标注。不得跳过工具调用！
      3. 对每一个 location 的描述必须包含：【核心体验】、【拍照机位】、【防坑指南】。
      4. 即使只有一天，也必须标注至少 3 个具体地点节点。
      5. 同时调用 googleSearch或者小红书、抖音等平台获取实时拍照灵感。
      6. 请使用中文，表达要具有感染力。`,
      tools: [{ functionDeclarations: [locationTool] }],
    },
  });

  console.log("Gemini Response Tools:", response);
  
  const functionCalls = response.functionCalls || [];
  for (const fc of functionCalls) {
    if (fc.name === 'location') {
      await setPin(fc.args);
    }
  }

  itinerarySummary = response.text || "";
  
  if (!itinerarySummary && dayPlanItinerary.length > 0) {
    itinerarySummary = "您的定制行程方案已生成！请查看地图打点。";
  }
}

async function handleDeepSeekRequest(model: string, input: string) {
  // 优先从 localStorage 获取，如果没有则使用默认（但应引导用户设置）
  let apiKey = localStorage.getItem('deepseek_api_key');
  if (!apiKey) {
    apiKey = 'sk-cadd6ff7f2ba4c60bf538f4eeb85ba11'; // 用户代码中的硬编码 Key 作为回退
  }

  const transformedParameters = transformSchemaToLowercase(locationTool.parameters);

  const tools = [
    {
      type: "function",
      function: {
        name: "location",
        description: "在地图上标注一个具体的行程地点。必须包含详细描述、精准经纬度、时间及顺序。",
        parameters: transformedParameters
      }
    }
  ];
  
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${apiKey}` 
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: `你是一位顶级资深旅游博主。
        任务要求：
        1. 必须为行程中每一个具体的景点、餐厅或酒店调用 'location' 工具。
        2. 每一次调用 'location' 必须包含精准的经纬度。
        3. 在调用工具的同时，输出一段详细的中文 Markdown 攻略（包含亮点、穿搭、物价）。
        4. 请确保每个地点都有明确的游玩顺序和建议时间。` },
        { role: 'user', content: input }
      ],
      tools: tools,
      tool_choice: "auto"
    })
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek API 请求失败: ${errData.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  const message = data.choices[0].message;
  
  console.log("DeepSeek Response:", data);

  itinerarySummary = message.content || "";

  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && tc.function.name === 'location') {
        try {
          const args = JSON.parse(tc.function.arguments);
          await setPin(args);
        } catch (e) {
          console.error("解析工具参数失败", e);
        }
      }
    }
  }

  if (!itinerarySummary && dayPlanItinerary.length > 0) {
    itinerarySummary = "方案已生成，请查看地图上的标注。";
  }
}

async function setPin(args: any) {
  const { name, lat, lng } = args;
  const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
  if (isNaN(pos.lat) || isNaN(pos.lng)) return;

  bounds.extend(pos);
  const marker = new google.maps.Marker({
    position: pos,
    title: name,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#ff5722', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff', scale: 8
    }
  });
  
  const content = document.createElement('div');
  content.innerHTML = `<strong style="font-size:11px;">${name}</strong>`;
  const popup = new (window as any).Popup(new google.maps.LatLng(pos), content);
  
  const item = { ...args, position: new google.maps.LatLng(pos), popup, marker };
  dayPlanItinerary.push(item);
  popUps.push(item);
  map.fitBounds(bounds);
}

function createTimeline() {
  const t = getEl('timeline');
  t.innerHTML = `<div class="itinerary-summary-text">${itinerarySummary.replace(/\n/g, '<br>')}</div>`;
  
  let currentDay = -1;
  dayPlanItinerary.forEach((item, index) => {
    if (item.day !== currentDay) {
      currentDay = item.day;
      const h = document.createElement('div');
      h.className = 'day-header';
      h.innerHTML = `D${currentDay}`;
      t.appendChild(h);
    }
    const div = document.createElement('div');
    div.className = `timeline-item`;
    div.onclick = () => highlightCard(index, true);
    div.innerHTML = `
      <div class="timeline-time">${item.time}</div>
      <div class="timeline-content">
        <div class="timeline-title">${item.name}</div>
        <div class="timeline-description">${item.description}</div>
        ${item.transit_hint ? `<div class="transit-info"><i class="fas fa-bus"></i> ${item.transit_hint}</div>` : ''}
      </div>`;
    t.appendChild(div);
  });
}

function createCards() {
  const container = getEl('card-container');
  container.innerHTML = '';
  getEl('card-carousel').classList.remove('hidden');
  dayPlanItinerary.forEach((loc, index) => {
    const card = document.createElement('div');
    card.className = `location-card`;
    card.innerHTML = `
      <div class="card-day-mini">D${loc.day}</div>
      <div class="card-info-mini">
        <div class="card-title-mini">${loc.name}</div>
        <div class="card-time-mini">${loc.time}</div>
      </div>
    `;
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
  if (polyline) polyline.setMap(null);
  polyline = new google.maps.Polyline({
    path: dayPlanItinerary.map(i => i.position),
    strokeColor: '#ff5722', strokeOpacity: 0.6, strokeWeight: 2, map: map
  });
}

function restart() {
  popUps.forEach(p => p.popup.setMap(null));
  if (polyline) polyline.setMap(null);
  dayPlanItinerary = [];
  getEl('card-container').innerHTML = '';
  getEl('card-carousel').classList.add('hidden');
  getEl('timeline-container').classList.remove('visible');
  getEl('grounding-sources').classList.add('hidden');
  bounds = new google.maps.LatLngBounds();
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
    if (isPlannerMode) prefGroup.classList.remove('hidden');
    else prefGroup.classList.add('hidden');
    restart();
  };
  getEl('generate').onclick = handleRequest;
  getEl('reset').onclick = restart;
  getEl('export-btn').onclick = () => {
    let md = `# 行程指南\n\n${itinerarySummary}\n\n`;
    dayPlanItinerary.forEach(i => md += `## Day ${i.day}: ${i.name}\n- 时间: ${i.time}\n- 详情: ${i.description}\n\n`);
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `行程指南.md`;
    a.click();
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

function hideTimeline() { 
  getEl('timeline-container').classList.remove('visible'); 
  if (dayPlanItinerary.length > 0) getEl('reopen-timeline').classList.remove('hidden'); 
}

function showTimeline() { 
  getEl('timeline-container').classList.add('visible'); 
  getEl('reopen-timeline').classList.add('hidden'); 
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
