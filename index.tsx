
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import L from 'leaflet';
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
const STORAGE_KEY = 'travel_pro_history_v2';

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * 核心系统提示词 - 强化社交与打卡约束
 */
const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游规划专家。
你的任务是完成一个【三位一体】的规划报告，缺少任何一部分都将被判定为任务失败。

【必须包含的三大部分】：
1. 社交分析阶段 (工具: get_social_recommendations):
   - 必须调用一次。分析当前最火的趋势（小红书/抖音），为用户提供打卡灵感。
   
2. 地图标注阶段 (工具: location):
   - 必须针对用户要求的【每一天】调用多次。
   - 每一天的行程必须包含具体的时间、天气、交通和深度描述并提供预估花费。

3. 文字总结阶段:
   - 提供丰富的行程亮点说明。最后必须包含【行程花费预估】。

【严苛禁令】：
- 必须【同时】给出社交平台趋势和每日具体的地图行程。
- 严禁输出 <think> 标签内容。
- 直接开始调用工具链，严禁废话。`;

function initApp() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  map = L.map('map', {
    center: [30.5728, 104.0668],
    zoom: 12,
    zoomControl: false,
    attributionControl: false
  });

  const savedTdtKey = localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY;
  switchTDT('tdt_vec', savedTdtKey);
  
  (getEl('tdt-key-input') as HTMLInputElement).value = savedTdtKey;
  (getEl('deepseek-key-input') as HTMLInputElement).value = localStorage.getItem('deepseek_api_key') || "";
  (getEl('zhipu-key-input') as HTMLInputElement).value = localStorage.getItem('zhipu_api_key') || "";

  bindHUD();
  bindEvents();
  getEl('spinner').classList.remove('active');
}

function switchTDT(type: string, tk: string) {
  if (tdtLayer) map.removeLayer(tdtLayer);
  if (tdtAnnoLayer) map.removeLayer(tdtAnnoLayer);
  const layer = type === 'tdt_vec' ? 'vec_w' : 'img_w';
  const anno = type === 'tdt_vec' ? 'cva_w' : 'cia_w';
  tdtLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/${layer}/wmts?tk=${tk}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer.split('_')[0]}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}`, {
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
  }).addTo(map);
  tdtAnnoLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/${anno}/wmts?tk=${tk}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${anno.split('_')[0]}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}`, {
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
  }).addTo(map);
}

function bindHUD() {
  getEl('hud-toggle-input').onclick = () => {
    getEl('sidebar-left').classList.toggle('ui-hidden');
    getEl('hud-toggle-input').classList.toggle('active');
  };

  getEl('hud-toggle-itinerary').onclick = () => {
    if (dayPlanItinerary.length === 0) {
      alert("请先生成排期方案！");
      return;
    }
    getEl('timeline-container').classList.toggle('visible');
    getEl('hud-toggle-itinerary').classList.toggle('active');
    getEl('hud-toggle-itinerary').classList.remove('pulse');
  };

  getEl('hud-toggle-layers').onclick = () => {
    const currentTk = localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY;
    const isVec = tdtLayer.getContainer()?.innerHTML.includes('vec_w');
    switchTDT(isVec ? 'tdt_img' : 'tdt_vec', currentTk);
    getEl('hud-toggle-layers').classList.toggle('active');
  };

  getEl('hud-open-history').onclick = () => {
    renderHistoryList();
    getEl('history-modal').classList.add('active');
  };

  getEl('hud-open-settings').onclick = () => getEl('settings-modal').classList.add('active');
}

function bindEvents() {
  getEl('close-console').onclick = () => {
    getEl('sidebar-left').classList.add('ui-hidden');
    getEl('hud-toggle-input').classList.remove('active');
  };

  getEl('close-itinerary').onclick = () => {
    getEl('timeline-container').classList.remove('visible');
    getEl('hud-toggle-itinerary').classList.remove('active');
  };

  getEl('save-settings').onclick = () => {
    const tdtKey = (getEl('tdt-key-input') as HTMLInputElement).value.trim();
    if (tdtKey) localStorage.setItem('tdt_api_key', tdtKey);
    localStorage.setItem('deepseek_api_key', (getEl('deepseek-key-input') as HTMLInputElement).value.trim());
    localStorage.setItem('zhipu_api_key', (getEl('zhipu-key-input') as HTMLInputElement).value.trim());
    switchTDT('tdt_vec', tdtKey || TDT_DEFAULT_KEY);
    getEl('settings-modal').classList.remove('active');
  };

  getEl('close-settings').onclick = () => getEl('settings-modal').classList.remove('active');
  getEl('close-history').onclick = () => getEl('history-modal').classList.remove('active');

  getEl('planner-mode-toggle').onchange = (e) => {
    const isPlanner = (e.target as HTMLInputElement).checked;
    getEl('mode-label-text').innerText = isPlanner ? "全城交通连线模式" : "景点发现模式";
    getEl('preference-toggle-group').classList.toggle('hidden', !isPlanner);
  };

  getEl('save-itinerary-btn').onclick = saveToHistory;
  getEl('export-file-btn').onclick = exportToFile;
  getEl('share-btn').onclick = copyToClipboard;
  getEl('generate').onclick = handleRequest;
}

function getFormattedText() {
  let text = `AI Travel Pro - 深度游指南\n`;
  text += `====================================\n`;
  text += `生成时间: ${new Date().toLocaleString()}\n\n`;
  text += `【AI 专家建议】\n${itinerarySummary}\n\n`;
  
  if (socialRecommendations.length > 0) {
    text += `【社交平台热度打卡】\n`;
    socialRecommendations.forEach(r => {
      text += `· [${r.platform}] ${r.title} (${r.hot_score})\n  理由: ${r.reason}\n`;
    });
    text += `\n`;
  }

  text += `【每日深度排期】\n`;
  const sorted = [...dayPlanItinerary].sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
  let lastDay = 0;
  sorted.forEach(item => {
    if (item.day !== lastDay) {
      text += `--- 第 ${item.day} 天 ---\n`;
      lastDay = item.day;
    }
    text += `[${item.time}] ${item.name}\n`;
    text += `详情: ${item.description}\n`;
    text += `交通: ${item.transit_hint}\n\n`;
  });
  
  return text;
}

function exportToFile() {
  if (dayPlanItinerary.length === 0) return;
  const content = getFormattedText();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AI-Travel-Pro-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard() {
  if (dayPlanItinerary.length === 0) return;
  const content = getFormattedText();
  try {
    await navigator.clipboard.writeText(content);
    const btn = getEl('share-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => btn.innerHTML = original, 2000);
  } catch (err) {
    alert("复制失败");
  }
}

function saveToHistory() {
  if (dayPlanItinerary.length === 0) return;
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const newItem = {
    id: Date.now(),
    timestamp: new Date().toLocaleString(),
    prompt: (getEl('prompt-input') as HTMLTextAreaElement).value,
    summary: itinerarySummary,
    itinerary: dayPlanItinerary,
    recommendations: socialRecommendations,
    mode: (getEl('planner-mode-toggle') as HTMLInputElement).checked
  };
  history.unshift(newItem);
  if (history.length > 30) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  const btn = getEl('save-itinerary-btn');
  btn.style.color = '#4caf50';
  setTimeout(() => btn.style.color = '', 2000);
}

function renderHistoryList() {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const container = getEl('history-list');
  container.innerHTML = history.length === 0 ? `<div style="text-align:center; padding:40px; opacity:0.5;">暂无记录</div>` : '';
  
  history.forEach((item: any) => {
    const card = document.createElement('div');
    card.className = 'history-item-card';
    card.style.cssText = `background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-bottom: 12px; cursor: pointer;`;
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px; opacity:0.5;">
        <span>${item.timestamp}</span>
        <button class="del-hist" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash-alt"></i></button>
      </div>
      <div style="font-weight:900; color:var(--text-title); font-size:14px;">${item.prompt.substring(0, 50)}...</div>
    `;
    card.onclick = (e) => {
      if ((e.target as HTMLElement).closest('.del-hist')) {
        let h = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        h = h.filter((i: any) => i.id !== item.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
        renderHistoryList();
        return;
      }
      loadHistoryItem(item);
    };
    container.appendChild(card);
  });
}

function loadHistoryItem(item: any) {
  restart();
  dayPlanItinerary = item.itinerary;
  itinerarySummary = item.summary;
  socialRecommendations = item.recommendations;
  (getEl('prompt-input') as HTMLTextAreaElement).value = item.prompt;
  (getEl('planner-mode-toggle') as HTMLInputElement).checked = item.mode;
  renderAll();
  getEl('history-modal').classList.remove('active');
  getEl('timeline-container').classList.add('visible');
}

async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  if (!userInput) return;
  restart();
  getEl('spinner').classList.add('active');
  getEl('error-message').classList.add('hidden');
  
  try {
    const model = (getEl('model-selector') as HTMLSelectElement).value;
    const targetModel = model.includes('gemini') ? model : 'gemini-3-pro-preview';
    await handleGeminiRequest(targetModel, userInput);
    if (dayPlanItinerary.length > 0) {
      renderAll();
      getEl('timeline-container').classList.add('visible');
    } else {
      throw new Error("未生成有效排期");
    }
  } catch (e: any) {
    getEl('error-text').innerText = e.message;
    getEl('error-message').classList.remove('hidden');
  } finally {
    getEl('spinner').classList.remove('active');
  }
}

async function handleGeminiRequest(model: string, input: string) {
  const apiKey = (localStorage.getItem('gemini_api_key') as string) || (process.env.API_KEY as string);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: model,
    contents: input,
    config: {
      systemInstruction: GLOBAL_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [locationTool, socialRecommendationTool] }],
    },
  });
  
  const fcs = response.functionCalls || [];
  fcs.forEach((fc: any) => {
    if (fc.name === 'location') dayPlanItinerary.push(fc.args);
    if (fc.name === 'get_social_recommendations') socialRecommendations = fc.args.recommendations || [];
  });
  itinerarySummary = response.text || "方案已生成。";
}

function renderAll() {
  dayPlanItinerary.sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
  const points: L.LatLng[] = [];
  const container = getEl('timeline-content');
  
  // 1. 概览模块
  let html = `
    <div style="padding:20px; font-size:15px; line-height:1.7; background:#fff; border-radius:24px; margin-bottom:20px; border:1.5px dashed var(--primary-glow);">
      <span style="color:var(--primary); font-weight:900;"><i class="fas fa-quote-left"></i> AI 深度建议：</span><br>${itinerarySummary.replace(/\n/g, '<br>')}
    </div>
  `;

  // 2. 社交平台热度打卡模块 (找回的功能)
  if (socialRecommendations && socialRecommendations.length > 0) {
    html += `
      <div style="margin-bottom:24px;">
        <h4 style="font-weight:900; color:var(--text-title); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-fire-alt" style="color:#ff5722;"></i> 社交平台灵感雷达
        </h4>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${socialRecommendations.map(r => `
            <div style="background:white; padding:15px; border-radius:18px; border:1px solid #f1f5f9; position:relative; overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                <span style="font-weight:900; font-size:14px; color:var(--text-title);">#${r.rank} ${r.title}</span>
                <span style="font-size:10px; padding:3px 8px; border-radius:6px; background:${r.platform.includes('小红书') ? '#ff2442' : '#000'}; color:white; font-weight:800;">
                  ${r.platform}
                </span>
              </div>
              <p style="font-size:12px; color:var(--text-body); line-height:1.4;">${r.reason}</p>
              <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; color:var(--primary); font-weight:700;"><i class="fas fa-chart-line"></i> ${r.hot_score}</span>
                <span style="font-size:10px; color:#64748b;"><i class="fas fa-camera"></i> ${r.photo_tips || '机位见详情'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  html += `<h4 style="font-weight:900; color:var(--text-title); margin-bottom:12px;"><i class="fas fa-route"></i> 每日深度行程</h4>`;
  container.innerHTML = html;

  // 3. 每日行程卡片
  dayPlanItinerary.forEach((item) => {
    const latlng = L.latLng(parseFloat(item.lat), parseFloat(item.lng));
    points.push(latlng);
    const color = DAY_COLORS[(item.day - 1) % DAY_COLORS.length];
    
    const marker = L.circleMarker(latlng, {
      radius: 14, fillColor: color, color: "#fff", weight: 4, fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(`
      <div style="min-width:200px;">
        <h4 style="margin:0 0 8px; color:${color}; font-weight:900;">D${item.day}: ${item.name}</h4>
        <p style="margin:0; font-size:13px; line-height:1.4;">${item.description}</p>
      </div>
    `);
    
    const card = document.createElement('div');
    card.className = 'timeline-card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="padding:4px 10px; background:${color}; color:white; border-radius:8px; font-size:11px; font-weight:900;">D${item.day} · ${item.time}</span>
        <span style="font-size:18px;">${item.weather_icon || '☀️'}</span>
      </div>
      <h4 style="font-weight:900; color:var(--text-title); margin-bottom:6px;">${item.name}</h4>
      <p style="font-size:13px; opacity:0.8; line-height:1.5;">${item.description}</p>
      <div style="margin-top:10px; font-size:11px; color:#64748b; background:#f8fafc; padding:8px; border-radius:10px;">
        <i class="fas fa-map-marker-alt"></i> ${item.transit_hint}
      </div>
    `;
    
    card.onclick = () => {
      document.querySelectorAll('.timeline-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      map.flyTo(latlng, 15, { duration: 1.5 });
      marker.openPopup();
    };
    container.appendChild(card);
  });

  if ((getEl('planner-mode-toggle') as HTMLInputElement).checked) {
    drawRoutes();
  }
  if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [100, 100] });
}

function drawRoutes() {
  const dailyPath = new Map<number, L.LatLng[]>();
  dayPlanItinerary.forEach(item => {
    if (!dailyPath.has(item.day)) dailyPath.set(item.day, []);
    dailyPath.get(item.day)!.push(L.latLng(parseFloat(item.lat), parseFloat(item.lng)));
  });
  dailyPath.forEach((path, day) => {
    if (path.length > 1) {
      const poly = L.polyline(path, {
        color: DAY_COLORS[(day-1) % DAY_COLORS.length],
        weight: 4,
        opacity: 0.6,
        dashArray: '8, 12'
      }).addTo(map);
      polylines.push(poly);
    }
  });
}

function restart() {
  map.eachLayer(layer => { 
    if (layer instanceof L.CircleMarker || layer instanceof L.Polyline) map.removeLayer(layer); 
  });
  dayPlanItinerary = [];
  socialRecommendations = [];
  polylines = [];
  getEl('timeline-content').innerHTML = '';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
