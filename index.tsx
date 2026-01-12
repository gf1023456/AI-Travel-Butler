
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FunctionDeclaration, GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

declare const google: any;

// Application state
let map: any;
let markers: any[] = [];
let popUps: any[] = [];
let bounds: any;
let activeCardIndex = 0;
let isPlannerMode = false;
let isUiHidden = false;
let dayPlanItinerary: any[] = [];
let itinerarySummary = "";
let polyline: any = null;

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Initialize Map
 */
async function initApp() {
  try {
    const { Map } = await google.maps.importLibrary('maps');
    const { LatLngBounds } = await google.maps.importLibrary('core');
    
    bounds = new LatLngBounds();
    map = new Map(getEl('map'), {
      center: { lat: 39.9042, lng: 116.4074 },
      zoom: 12,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      styles: [
        { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffffff" }] },
        { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 13 }] },
        { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 20 }] },
        { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 20 }] },
        { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 21 }] },
        { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 17 }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0d0d0d" }, { "lightness": 17 }] }
      ]
    });

    setupPopupClass();
    bindEvents();
    setupKeyboardShortcuts();
    
    getEl('spinner').classList.add('hidden');
  } catch (err) {
    console.error("Map Load Failed", err);
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
      const anchor = document.createElement('div');
      anchor.classList.add('popup-anchor');
      this.containerDiv.appendChild(anchor);
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

const locationFunctionDeclaration: FunctionDeclaration = {
  name: 'location',
  parameters: {
    type: Type.OBJECT,
    description: '标注地点信息。必须严格根据用户需求产出完整的多天行程。',
    properties: {
      name: { type: Type.STRING, description: '地点名称' },
      description: { type: Type.STRING, description: '详细博主级建议：必看、避雷、网红机位、必点菜。' },
      lat: { type: Type.STRING },
      lng: { type: Type.STRING },
      time: { type: Type.STRING, description: '时间段，如 14:00 - 17:00' },
      day: { type: Type.NUMBER, description: '所属天数。如果用户要3天，你必须产出 Day 1, 2, 3 的节点。' },
      sequence: { type: Type.NUMBER, description: '当天顺序编号。' },
      transit_hint: { type: Type.STRING, description: '具体交通方式（高铁班次、打车、地铁线）。' },
      type: { type: Type.STRING, description: 'SIGHT, FOOD, TRANSIT, HOTEL' },
      weather: { type: Type.STRING, description: '通过联网检索得到的该地点当前的实时天气状况（如：晴、多云、小雨）。' },
      temperature: { type: Type.STRING, description: '该地点当天的实时温度范围或当前气温（如：25°C / 18°C）。' }
    },
    required: ['name', 'description', 'lat', 'lng', 'time', 'day', 'sequence', 'weather', 'temperature'],
  },
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  if (!userInput) {
    setStatus("请输入您的想法或目的地！", "error");
    return;
  }

  restart();
  getEl('spinner').classList.remove('hidden');
  
  const statusMsg = isPlannerMode 
    ? "🗺️ 正在通过 Google Search 检索实时天气、高铁和各大平台真实反馈，为您规划完整多天方案..." 
    : "🌟 正在为您搜寻全网实时热门宝藏地点与网红机位...";
  setStatus(statusMsg, "loading");

  try {
    let systemInstruction = `你是一个顶级深度定制旅游博主。
    1. **必须联网**：使用 googleSearch 检索目的地当前真实的实时天气、气温、交通（高铁具体班次/航班）和景点开放状态。
    2. **完整规划**：必须识别并严格执行用户要求的天数。如果用户要“3天”，你必须在一次回答中完整调用 location 函数产出 Day 1, Day 2 和 Day 3 的全部节点，严禁遗漏任何一天。
    3. **细节至上**：描述中必须包含【必打卡点】、【避雷攻略】、【省力路线】。
    4. **实时天气**：通过搜索获取准确的天气和温度，并填入 location 函数的对应字段。
    5. 在 text 响应部分提供一段行程亮点总述。`;

    let promptPrefix = `用户需求：${userInput}。
    
    你必须：
    - 如果用户提到具体天数（如 3天），必须完整返回这 3 天的行程节点，每一天至少包含 3-5 个节点。
    - 联网查询目的地的【当前实时天气】和【实时气温】，体现在每个节点的 weather 和 temperature 字段中。
    - 针对交通，联网搜索最优的具体高铁班次（如：G652次）或航班建议。
    - 参考小红书、大众点评的最新高分评价。`;

    if (!isPlannerMode) {
      systemInstruction = "你是一个全网通的旅游挖掘博主，擅长提供最新、最真实、带实时天气的宝藏地推荐。";
      promptPrefix = `请联网搜索推荐 6-10 个关于“${userInput}”的打卡点。每个点必须包含真实的【实时天气】和【气温】。`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: promptPrefix,
      config: {
        thinkingConfig: { thinkingBudget: isPlannerMode ? 5500 : 2500 },
        systemInstruction,
        tools: [{ googleSearch: {} }, { functionDeclarations: [locationFunctionDeclaration] }],
      },
    });

    const textPart = response.candidates?.[0]?.content?.parts.find(p => p.text);
    if (textPart) itinerarySummary = textPart.text || "";

    const calls = response.candidates?.[0]?.content?.parts.filter(p => p.functionCall) || [];
    for (const part of calls) {
      const fn = part.functionCall;
      if (fn && fn.name === 'location') await setPin(fn.args);
    }

    const grounding = response.candidates?.[0]?.groundingMetadata;
    if (grounding && grounding.groundingChunks) displaySources(grounding.groundingChunks);

    if (dayPlanItinerary.length === 0) throw new Error("AI 未能获取到实时细节，请尝试输入更具体的内容（如：城市+天数）。");

    dayPlanItinerary.sort((a, b) => {
      const d1 = Number(a.day) || 1;
      const d2 = Number(b.day) || 1;
      if (d1 !== d2) return d1 - d2;
      return (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
    });

    if (isPlannerMode) {
      drawRoute();
      createTimeline();
      showTimeline();
    }
    
    createCards();
    highlightCard(0, true);
    setStatus("", "hidden");
  } catch (e: any) {
    setStatus("⚠️ " + e.message, "error");
    console.error(e);
  } finally {
    getEl('spinner').classList.add('hidden');
  }
}

function displaySources(chunks: any[]) {
  const list = getEl('source-list');
  const container = getEl('grounding-sources');
  list.innerHTML = '';
  const uniqueUrls = new Set();
  chunks.forEach(chunk => {
    if (chunk.web?.uri && !uniqueUrls.has(chunk.web.uri)) {
      uniqueUrls.add(chunk.web.uri);
      const li = document.createElement('li');
      li.innerHTML = `<a href="${chunk.web.uri}" target="_blank"><i class="fas fa-link"></i> ${chunk.web.title || chunk.web.uri}</a>`;
      list.appendChild(li);
    }
  });
  if (uniqueUrls.size > 0) container.classList.remove('hidden');
}

async function setPin(args: any) {
  const pos = { lat: Number(args.lat), lng: Number(args.lng) };
  bounds.extend(pos);

  const marker = new google.maps.Marker({
    map: map,
    position: pos,
    title: args.name,
    animation: google.maps.Animation.DROP,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: args.type === 'TRANSIT' ? '#2196F3' : args.type === 'FOOD' ? '#FFC107' : '#ff5722',
      fillOpacity: 1,
      strokeWeight: 3,
      strokeColor: '#fff',
      scale: 11
    }
  });
  
  markers.push(marker);
  map.fitBounds(bounds);

  const content = document.createElement('div');
  content.innerHTML = `<div style="padding: 5px; min-width: 130px;"><strong>${args.name}</strong><br><small style="color:#666">Day ${args.day} | ${args.time}<br>🌡️ ${args.temperature} | ${args.weather}</small></div>`;
  const popup = new (window as any).Popup(new google.maps.LatLng(pos), content);
  
  const item = { ...args, position: new google.maps.LatLng(pos), popup, marker };
  dayPlanItinerary.push(item);
  popUps.push(item);

  marker.addListener('click', () => {
    highlightCard(dayPlanItinerary.indexOf(item), true);
  });
}

function drawRoute() {
  if (polyline) polyline.setMap(null);
  polyline = new google.maps.Polyline({
    path: dayPlanItinerary.map(i => i.position),
    geodesic: true,
    strokeColor: '#ff5722',
    strokeOpacity: 0.8,
    strokeWeight: 5,
    icons: [{
      icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, strokeColor: '#fff', scale: 2 },
      offset: '100%',
      repeat: '120px'
    }],
    map: map
  });
}

function createCards() {
  const container = getEl('card-container');
  const indicators = getEl('carousel-indicators');
  container.innerHTML = ''; indicators.innerHTML = '';
  document.querySelector('.card-carousel')!.classList.remove('hidden');
  
  dayPlanItinerary.forEach((loc, index) => {
    const card = document.createElement('div');
    card.className = `location-card type-${loc.type || 'SIGHT'}`;
    card.innerHTML = `
      <div class="card-badge">Day ${loc.day} - ${loc.sequence}</div>
      <div class="card-weather"><i class="fas fa-cloud-sun"></i> ${loc.temperature}</div>
      <div class="card-title">${loc.name}</div>
      <div class="card-description">${loc.description}</div>
    `;
    card.onclick = () => highlightCard(index, true);
    container.appendChild(card);

    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    dot.onclick = () => highlightCard(index, true);
    indicators.appendChild(dot);
  });
}

function createTimeline() {
  const t = getEl('timeline');
  t.innerHTML = '';
  
  if (itinerarySummary) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'timeline-summary';
    summaryDiv.innerHTML = `<i class="fas fa-info-circle"></i> <strong>行程总括与建议：</strong><br>${itinerarySummary.replace(/\n/g, '<br>')}`;
    t.appendChild(summaryDiv);
  }

  let currentDay = -1;
  dayPlanItinerary.forEach((item, index) => {
    if (item.day !== currentDay) {
      currentDay = item.day;
      const dayHeader = document.createElement('div');
      dayHeader.className = 'day-header';
      dayHeader.innerHTML = `<i class="fas fa-calendar-day"></i> <span>第 ${currentDay} 天行程规划 (实时天气：${item.weather} ${item.temperature})</span>`;
      t.appendChild(dayHeader);
    }

    const div = document.createElement('div');
    div.className = `timeline-item type-${item.type || 'SIGHT'}`;
    div.onclick = () => highlightCard(index, true);
    div.innerHTML = `
      <div class="timeline-time">${item.time} <span class="weather-pill">${item.temperature}</span></div>
      <div class="timeline-content">
        <div class="timeline-title">${item.name}</div>
        <div class="timeline-description">${item.description}</div>
      </div>
    `;
    t.appendChild(div);

    if (index < dayPlanItinerary.length - 1 && item.transit_hint) {
      if (dayPlanItinerary[index+1].day === item.day) {
        const transitDiv = document.createElement('div');
        transitDiv.className = 'transit-info';
        transitDiv.innerHTML = `<i class="fas fa-shuttle-van"></i> <strong>交通细节：</strong>${item.transit_hint}`;
        t.appendChild(transitDiv);
      }
    }
  });
}

function exportItinerary() {
  if (dayPlanItinerary.length === 0) return;
  let md = `# AI 深度全域旅游手册\n\n`;
  if (itinerarySummary) md += `## 行程前瞻\n${itinerarySummary}\n\n`;
  let currentDay = -1;
  dayPlanItinerary.forEach((item, i) => {
    if (item.day !== currentDay) {
      currentDay = item.day;
      md += `\n# --- DAY ${currentDay} (实时天气: ${item.weather} ${item.temperature}) ---\n\n`;
    }
    md += `### ${item.sequence}. ${item.name} (${item.time})\n`;
    md += `> **实时状况:** ${item.weather} / ${item.temperature}\n\n`;
    md += `> **深度建议:**\n${item.description}\n\n`;
    if (item.transit_hint) md += `**🚀 交通指南:** ${item.transit_hint}\n\n`;
    md += `\n`;
  });
  md += `\n---\n### 数据来源与参考:\n`;
  const sources = getEl('source-list').querySelectorAll('a');
  sources.forEach(a => md += `- [${a.innerText}](${a.getAttribute('href')})\n`);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `我的深度旅行手册_${new Date().toLocaleDateString()}.md`;
  a.click();
}

function highlightCard(index: number, scroll: boolean = false) {
  popUps.forEach(p => p.popup.setMap(null));
  activeCardIndex = Math.max(0, Math.min(index, dayPlanItinerary.length - 1));
  const cards = document.querySelectorAll('.location-card');
  const dots = document.querySelectorAll('.carousel-dot');
  cards.forEach((c, i) => c.classList.toggle('card-active', i === activeCardIndex));
  dots.forEach((d, i) => d.classList.toggle('active', i === activeCardIndex));
  const item = dayPlanItinerary[activeCardIndex];
  if (item) {
    item.popup.setMap(map);
    map.panTo(item.position);
    item.marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(() => item.marker.setAnimation(null), 1200);
  }
  if (scroll && cards[activeCardIndex]) {
    getEl('card-container').scrollTo({ 
      left: (cards[activeCardIndex] as HTMLElement).offsetLeft - (getEl('card-container').offsetWidth / 2) + 120, 
      behavior: 'smooth' 
    });
  }
}

function setStatus(msg: string, type: 'loading' | 'error' | 'hidden') {
  const err = getEl('error-message');
  if (type === 'hidden') {
    err.classList.add('hidden');
    return;
  }
  err.innerText = msg;
  err.className = `error ${type}`;
  err.classList.remove('hidden');
}

function showTimeline() {
  getEl('timeline-container').classList.add('visible');
  getEl('map-container').classList.add('shifted');
  getEl('reopen-timeline').classList.add('hidden');
}

function hideTimeline() {
  getEl('timeline-container').classList.remove('visible');
  getEl('map-container').classList.remove('shifted');
  if (dayPlanItinerary.length > 0 && isPlannerMode) getEl('reopen-timeline').classList.remove('hidden');
}

function restart() {
  markers.forEach(m => m.setMap(null));
  popUps.forEach(p => p.popup.setMap(null));
  if (polyline) polyline.setMap(null);
  markers = []; popUps = []; dayPlanItinerary = []; itinerarySummary = "";
  getEl('card-container').innerHTML = '';
  getEl('source-list').innerHTML = '';
  getEl('grounding-sources').classList.add('hidden');
  document.querySelector('.card-carousel')!.classList.add('hidden');
  setStatus("", "hidden");
  hideTimeline();
  bounds = new google.maps.LatLngBounds();
}

function bindEvents() {
  getEl('planner-mode-toggle').onchange = (e) => {
    isPlannerMode = (e.target as HTMLInputElement).checked;
    getEl('preference-toggle-group').classList.toggle('hidden', !isPlannerMode);
    getEl('mode-text').innerText = isPlannerMode ? "行程规划模式 (支持多天+实时天气)" : "景点发现模式";
    (getEl('prompt-input') as HTMLTextAreaElement).placeholder = isPlannerMode 
      ? "输入行程：如“下周带孩子去北京玩3天，带实时天气和具体高铁班次建议”" 
      : "输入兴趣点（如：杭州西湖看日落的网红位置）";
    restart();
  };
  getEl('generate').onclick = handleRequest;
  getEl('export-btn').onclick = exportItinerary;
  getEl('reset').onclick = restart;
  getEl('close-timeline').onclick = hideTimeline;
  getEl('reopen-timeline').onclick = showTimeline;
  getEl('toggle-search-ui').onclick = () => {
    isUiHidden = !isUiHidden;
    getEl('search-container').classList.toggle('ui-hidden', isUiHidden);
    getEl('toggle-search-ui').innerHTML = isUiHidden ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
  };
  getEl('prompt-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRequest(); }
  });
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || "")) return;
    if (e.key === 'ArrowRight') highlightCard(activeCardIndex + 1, true);
    if (e.key === 'ArrowLeft') highlightCard(activeCardIndex - 1, true);
    if (e.key.toLowerCase() === 'r') restart();
  });
}

initApp();
