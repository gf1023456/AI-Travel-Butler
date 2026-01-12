
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
      throw new Error("AI 未能识别或生成任何地图节点。请尝试更具体的关键词。");
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
  
  // 核心修复：确保 contents 使用显式的 Content 对象数组格式，并保持 tools 配置单一性
  const response = await ai.models.generateContent({
    model: model,
    contents: [{
      role: 'user',
      parts: [{ text: `用户需求：${input}。旅行风格偏好：${prefText}。请规划并提供详细的 Markdown 格式旅行指南，并针对每个地点进行地图打点。` }]
    }],
    config: {
      systemInstruction: `你是一位顶级资深旅游规划专家和博主。
      任务流程：
      1. 深度分析用户的旅行需求，构思完美的行程。
      2. 【打点要求】：行程中每一个具体的景点、餐厅、酒店和交通枢纽都必须调用 location 工具进行标注。必须提供精准的经纬度和详细的描述。
      3. 【文本要求】：除了工具调用，必须返回一段完整的 Markdown 格式旅游攻略（不少于 500 字）。攻略需包含：每日行程总览、避坑指南、建议穿搭、当地美食推荐及拍照机位建议。
      4. 即使是短途行程，也请至少提供 3 个以上的重要节点标注。
      5. 所有的交流必须使用中文，语气专业且充满亲和力。
      6.必须完整得天数，不得只有一天
      7.调用googleSearch或者联网搜索当天得天气情况并选渲染`,
      tools: [{ functionDeclarations: [locationTool] }],
    },
  });
  console.log(response.functionCalls)
  // 处理工具调用
  const functionCalls = response.functionCalls || [];
  for (const fc of functionCalls) {
    if (fc.name === 'location') {
      await setPin(fc.args);
    }
  }

  // 获取生成的文本指南
  itinerarySummary = response.text || "";
  
  if (!itinerarySummary && dayPlanItinerary.length > 0) {
    itinerarySummary = "您的定制行程方案已生成！请查看地图上的标注节点以及侧边栏的简要信息。";
  }
}

async function handleDeepSeekRequest(model: string, input: string) {
  const apiKey = 'sk-cadd6ff7f2ba4c60bf538f4eeb85ba11';
  if (!apiKey) throw new Error("请先在设置中配置 DeepSeek API Key");

  const transformedParameters = transformSchemaToLowercase(locationTool.parameters);

  const tools = [
    {
      type: "function",
      function: {
        name: "location",
        description: "在地图上标注一个具体的行程地点。必须包含详细描述、精准经纬度、建议游玩时间、顺序及天气信息。",
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
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `你是一位顶级资深旅游博主。
        你的任务：
        1. 为用户规划完美的旅行行程。
        2. 语言风格要吸引人，使用 Markdown 格式美化排版。
       必须遵守：
      1. 行程中的每个具体地点都【必须】调用 location 工具进行标注。不得跳过工具调用！
      2. 对每一个 location 的描述必须包含：【核心体验】、【拍照机位】、【防坑指南】。
      3. 即使只有一天，也必须标注至少 3 个具体地点节点。
      4. 【强制】在工具调用之后或同时，必须输出一段详细的中文旅行攻略文本（包含：行程亮点、穿搭建议、避坑指南、当地物价）。攻略应具有深度，不得少于 500 字。` },
        { role: 'user', content: input }
      ],
      tools: tools,
      tool_choice: "auto"
    })
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek API 请求失败 (${response.status}): ${errData.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  const message = data.choices[0].message;
   console.log(data)
  console.log(message)
  // 保存文本内容
  itinerarySummary = message.content || "";

  // 解析并处理工具调用
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
  // 使用 pre-wrap 保持换行，增强 Markdown 文本渲染的可读性
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
