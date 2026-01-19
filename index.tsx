
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';
import L from 'leaflet';
import { locationTool, socialRecommendationTool } from './mcp-tools';
import { initAuth } from './auth';

// Application state
let map: L.Map;
let dayPlanItinerary: any[] = [];
let socialRecommendations: any[] = [];
let itinerarySummary = "";
let mapLayers: L.Layer[] = []; // Store markers and polylines to clear them easily
let tdtLayer: L.TileLayer;
let tdtAnnoLayer: L.TileLayer;
let currentMapType: 'tdt_vec' | 'tdt_img' = 'tdt_vec'; // Track map type

// Constants
const TDT_DEFAULT_KEY = "97f9870fb795ba80ef201d6edae71d73";
const DAY_COLORS = ['#ff5722', '#2196f3', '#4caf50', '#9c27b0', '#ffeb3b', '#00bcd4', '#795548'];
const STORAGE_KEY = 'travel_pro_history_v2';

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function initApp() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  // Initialize Map
  map = L.map('map', {
    center: [30.5728, 104.0668],
    zoom: 12,
    zoomControl: false,
    attributionControl: false
  });

  // Load saved keys
  const savedTdtKey = localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY;
  (getEl('tdt-key-input') as HTMLInputElement).value = savedTdtKey;
  (getEl('deepseek-key-input') as HTMLInputElement).value = localStorage.getItem('deepseek_api_key') || '';
  (getEl('zhipu-key-input') as HTMLInputElement).value = localStorage.getItem('zhipu_api_key') || '';

  switchTDT('tdt_vec', savedTdtKey);
  
  // Initialize Authentication Module
  initAuth();

  // Initialize UI Bindings
  bindHUD();
  bindEvents();
  getEl('loading-overlay').classList.remove('active');
  
  // Inject Toast Container
  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);
}

function switchTDT(type: string, tk: string) {
  if (tdtLayer) map.removeLayer(tdtLayer);
  if (tdtAnnoLayer) map.removeLayer(tdtAnnoLayer);
  
  const layer = type === 'tdt_vec' ? 'vec_w' : 'img_w';
  const anno = type === 'tdt_vec' ? 'cva_w' : 'cia_w'; // cva_w for vector anno, cia_w for img anno
  
  tdtLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/${layer}/wmts?tk=${tk}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer.split('_')[0]}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}`, {
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
  }).addTo(map);
  
  tdtAnnoLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/${anno}/wmts?tk=${tk}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${anno.split('_')[0]}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}`, {
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
  }).addTo(map);
}

function bindHUD() {
  getEl('hud-toggle-input').onclick = () => getEl('sidebar-left').classList.toggle('ui-hidden');
  getEl('hud-toggle-itinerary').onclick = () => getEl('timeline-container').classList.toggle('visible');
  getEl('hud-open-history').onclick = () => { renderHistoryList(); getEl('history-modal').classList.add('active'); };
  getEl('hud-open-settings').onclick = () => getEl('settings-modal').classList.add('active');
  getEl('user-profile').onclick = () => getEl('settings-modal').classList.add('active');
  
  // Restore Satellite/Vector toggle
  getEl('hud-toggle-layers').onclick = () => {
    currentMapType = currentMapType === 'tdt_vec' ? 'tdt_img' : 'tdt_vec';
    const key = localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY;
    switchTDT(currentMapType, key);
    
    // Optional: Visual feedback on button
    const btn = getEl('hud-toggle-layers');
    if (currentMapType === 'tdt_img') {
      btn.style.background = '#333';
      btn.style.color = '#fff';
    } else {
      btn.style.background = '';
      btn.style.color = '';
    }
  };
}

function bindEvents() {
  getEl('close-console').onclick = () => getEl('sidebar-left').classList.add('ui-hidden');
  getEl('close-itinerary').onclick = () => getEl('timeline-container').classList.remove('visible');
  getEl('close-settings').onclick = () => getEl('settings-modal').classList.remove('active');
  getEl('close-history').onclick = () => getEl('history-modal').classList.remove('active');
  
  // Toggle Switch Logic
  const toggle = getEl('planner-mode-toggle') as HTMLInputElement;
  toggle.onchange = () => {
     const label = getEl('mode-label-text');
     const styleGroup = getEl('style-selector-group');
     const btn = getEl('generate');
     
     if (toggle.checked) {
       label.innerText = "📅 深度排期 (完整)";
       label.style.color = "var(--primary)";
       styleGroup.classList.remove('hidden');
       btn.innerText = "生成深度排期";
     } else {
       label.innerText = "🔍 景点发现 (轻量)";
       label.style.color = "#64748b";
       styleGroup.classList.add('hidden');
       btn.innerText = "开始探索";
     }
  };

  // Save all keys
  getEl('save-settings').onclick = () => {
    const tdtKey = (getEl('tdt-key-input') as HTMLInputElement).value;
    const deepseekKey = (getEl('deepseek-key-input') as HTMLInputElement).value;
    const zhipuKey = (getEl('zhipu-key-input') as HTMLInputElement).value;

    if (tdtKey) localStorage.setItem('tdt_api_key', tdtKey);
    localStorage.setItem('deepseek_api_key', deepseekKey);
    localStorage.setItem('zhipu_api_key', zhipuKey);
    
    // Refresh map if key changed
    switchTDT(currentMapType, tdtKey || TDT_DEFAULT_KEY);
    getEl('settings-modal').classList.remove('active');
    showToast("设置已保存");
  };
  
  getEl('generate').onclick = handleRequest;
  getEl('save-itinerary-btn').onclick = saveToHistory;
  getEl('export-file-btn').onclick = exportToFile;
  getEl('share-btn').onclick = copyToClipboard;
}

const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游规划专家。
你的任务是完成一个【三位一体】的规划报告。

【关键逻辑 - 出发地与目的地】：
当用户输入 "从 A 到 B" (例如：从成都到重庆) 时，你必须严格遵守：
1. **区分身份**：A 是出发地，B 是目的地。
2. **行程分配**：
   - 第一天(Day 1)：通常包含从 A 离开，乘坐交通工具前往 B。
   - 后续天数(Day 2+)：必须 **100%** 在目的地 B 进行游玩。
3. **严禁错误推荐**：严禁在到达 B 之后（例如 Day 2, Day 3），推荐 A 城市的景点。
   - 错误示例：用户去重庆，Day 2 却推荐了成都的宽窄巷子。
   - 正确示例：用户去重庆，Day 2 推荐洪崖洞、解放碑。

【必须包含的三大部分】：
1. 社交分析阶段 (工具: get_social_recommendations):
   - 分析**目的地**最火的趋势（小红书/抖音），为用户提供打卡灵感。
   
2. 地图标注阶段 (工具: location):
   - 必须针对用户要求的【每一天】调用多次。
   - 如果发生城市转移，必须生成一个 category="TRANSIT" 的节点，描述详细交通方案（高铁/飞机班次）。
   - **务必准确填写 city 字段**，确保生成的地点属于正确的城市。

3. 文字总结阶段:
   - 提供丰富的行程亮点说明。最后必须包含【行程花费预估】。

严禁输出 <think> 标签内容。直接调用工具。`;

async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  const modelType = (getEl('model-selector') as HTMLSelectElement).value;
  const isPlannerMode = (getEl('planner-mode-toggle') as HTMLInputElement).checked;
  const travelMode = (getEl('travel-mode-selector') as HTMLSelectElement).value;
  
  if (!userInput) {
    showToast("请输入您的旅行想法");
    return;
  }

  // API Key Validation
  if (modelType.includes('deepseek')) {
    if (!localStorage.getItem('deepseek_api_key')) {
      showToast('请先配置 DeepSeek API Key');
      getEl('settings-modal').classList.add('active');
      return;
    }
  } else if (modelType.includes('glm')) {
    if (!localStorage.getItem('zhipu_api_key')) {
       showToast('请先配置智谱 GLM API Key');
       getEl('settings-modal').classList.add('active');
       return;
    }
  }

  restart();
  getEl('loading-overlay').classList.add('active');
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = modelType.startsWith('gemini') ? modelType : 'gemini-3-pro-preview';

    let finalPrompt = "";
    
    if (isPlannerMode) {
      // 深度排期模式
      let modeInstruction = "";
      switch (travelMode) {
        case 'special':
          modeInstruction = `【核心指令：特种兵模式】\n1. 时间利用率最大化：行程必须极度紧凑，每天安排至少5-7个点。\n2. 路线规划：必须是最优顺路方案，精确计算交通时间。\n3. 风格：高效率打卡。`;
          break;
        case 'deep':
          modeInstruction = `【核心指令：深度文化慢游】\n1. 拒绝走马观花：每天景点不超过3个，注重深度体验。\n2. 留白：每个地点预留充分的游览时间。`;
          break;
        case 'relax':
          modeInstruction = `【核心指令：休闲度假】\n1. 睡到自然醒，行程开始时间不早于10:30。\n2. 享受为主：重点推荐环境好的餐厅和酒店。`;
          break;
        case 'photo':
          modeInstruction = `【核心指令：摄影出片】\n1. 追逐光影：根据日出日落时间安排行程。\n2. 机位优先：重点标注热门机位。`;
          break;
      }
      finalPrompt = `${modeInstruction}\n\n请为我生成一份详细的每日行程规划，严格区分出发地和目的地，不要混淆城市景点。需求：${userInput}`;
    } else {
      // 景点发现模式
      finalPrompt = `【核心指令：景点发现模式】
用户不需要完整的时间表，只需要你根据需求推荐一组值得去的地方。
1. 请列出符合用户需求的 5-10 个地点（集中在用户想去的目的地）。
2. 在地图上进行标注 (使用 location 工具)。
3. 提供简短的文字介绍和推荐理由。
用户需求：${userInput}`;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: finalPrompt,
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
    itinerarySummary = response.text || "排期已生成";
    renderAll();
    getEl('timeline-container').classList.add('visible');
  } catch (e: any) {
    alert(`请求失败: ${e.message}`);
  } finally {
    getEl('loading-overlay').classList.remove('active');
  }
}

function renderAll() {
  // Sort Items
  dayPlanItinerary.sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
  
  const container = getEl('timeline-content');
  container.innerHTML = ''; // Clear container

  // 1. Render Summary
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'itinerary-summary';
  summaryDiv.innerHTML = itinerarySummary;
  container.appendChild(summaryDiv);
  
  // 2. Render Social Recommendations
  if (socialRecommendations.length > 0) {
    const socialDiv = document.createElement('div');
    socialDiv.className = 'social-radar';
    let socialHtml = `<h4><i class="fas fa-fire"></i> 社交热度打卡</h4>`;
    socialRecommendations.forEach(r => {
      socialHtml += `<div class="social-item"><span>${r.platform}</span><b>${r.title}</b><p>${r.reason}</p></div>`;
    });
    socialDiv.innerHTML = socialHtml;
    container.appendChild(socialDiv);
  }

  // 3. Render Map Items & Polylines
  const pointsByDay: Record<number, L.LatLng[]> = {};
  const bounds = L.latLngBounds([]);

  // Helper to get color
  const getColor = (day: number) => DAY_COLORS[(day - 1) % DAY_COLORS.length];

  dayPlanItinerary.forEach((item, index) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    const latlng = L.latLng(lat, lng);
    const dayColor = getColor(item.day);

    // Track points for polylines
    if (!pointsByDay[item.day]) pointsByDay[item.day] = [];
    pointsByDay[item.day].push(latlng);
    bounds.extend(latlng);

    // Create Marker on Map
    const marker = L.circleMarker(latlng, {
      radius: 12,
      fillColor: dayColor,
      color: '#fff',
      weight: 3,
      fillOpacity: 1
    }).addTo(map);
    
    // City Badge Logic
    const cityBadge = item.city 
        ? `<span style="background:#eee; color:#333; padding:1px 5px; border-radius:4px; font-size:10px; margin-left:5px;">${item.city}</span>` 
        : '';

    // Popup Content
    const popupContent = `
      <div style="min-width:220px; font-family:sans-serif;">
        <h3 style="margin:0 0 5px 0; color:${dayColor}; border-bottom:1px solid #eee; padding-bottom:5px;">
           <span style="font-size:12px; background:${dayColor}; color:#fff; padding:2px 6px; border-radius:4px; margin-right:4px;">D${item.day}</span>
           ${item.name}
        </h3>
        <div style="font-size:12px; color:#666; margin-bottom:8px;">
           <i class="far fa-clock"></i> ${item.time} ${cityBadge}
        </div>
        <p style="margin:0; font-size:13px; line-height:1.4; color:#333;">${item.description}</p>
        <div style="margin-top:8px; font-size:12px; background:#f8fafc; padding:6px; border-radius:4px; color:#64748b;">
            🚗 ${item.transit_hint || '暂无详细交通建议'}
        </div>
      </div>
    `;
    marker.bindPopup(popupContent);
    mapLayers.push(marker); // Track for cleanup

    // Create Sidebar Card
    const card = document.createElement('div');
    card.className = 'timeline-card';
    card.style.borderLeft = `5px solid ${dayColor}`;
    
    // Add Weather Info to card
    const weatherHtml = item.weather_icon && item.temperature 
      ? `<span class="weather-badge">${item.weather_icon} ${item.temperature}</span>` 
      : '';
      
    card.innerHTML = `
      <h5 style="color:${dayColor}">D${item.day} <span style="color:#94a3b8; font-weight:normal; font-size:12px;">${item.time}</span> ${cityBadge} ${weatherHtml}</h5>
      <div style="font-weight:bold; font-size:15px; margin-bottom:4px;">${item.name}</div>
      <p>${item.description}</p>
    `;
    
    // Interaction: Click Card -> FlyTo Marker
    card.onclick = () => {
      map.flyTo(latlng, 15, { duration: 1.5 });
      marker.openPopup();
      
      // Highlight card visually
      document.querySelectorAll('.timeline-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };

    container.appendChild(card);
  });

  // Draw Polylines for each day
  Object.keys(pointsByDay).forEach(dayKey => {
    const day = parseInt(dayKey);
    const points = pointsByDay[day];
    if (points.length > 1) {
      const polyline = L.polyline(points, {
        color: getColor(day),
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10', // Dashed line to indicate path
        lineCap: 'round'
      }).addTo(map);
      mapLayers.push(polyline);
    }
  });

  // Fit map to show all points
  if (dayPlanItinerary.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

function restart() {
  // Clear map layers
  mapLayers.forEach(layer => map.removeLayer(layer));
  mapLayers = [];
  
  dayPlanItinerary = [];
  socialRecommendations = [];
  getEl('timeline-content').innerHTML = '';
}

// Show Toast Notification
function showToast(message: string) {
  const container = getEl('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => container.removeChild(toast), 300);
  }, 3000);
}

function saveToHistory() {
  if (dayPlanItinerary.length === 0) {
    showToast("当前无方案可保存");
    return;
  }
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  
  // Simple check to avoid exact duplicates
  const currentPrompt = (getEl('prompt-input') as HTMLTextAreaElement).value;
  if (history.length > 0 && history[0].prompt === currentPrompt && JSON.stringify(history[0].itinerary) === JSON.stringify(dayPlanItinerary)) {
    showToast("该方案已在历史记录中");
    return;
  }

  const newItem = {
    id: Date.now(),
    timestamp: new Date().toLocaleString(),
    prompt: currentPrompt,
    summary: itinerarySummary,
    itinerary: dayPlanItinerary,
    recommendations: socialRecommendations
  };
  
  history.unshift(newItem);
  if (history.length > 30) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  showToast("方案保存成功！");
}

function renderHistoryList() {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const container = getEl('history-list');
  container.innerHTML = history.length === 0 ? `<div style="text-align:center; padding:40px; opacity:0.5;">暂无记录</div>` : '';
  
  history.forEach((item: any) => {
    const card = document.createElement('div');
    card.className = 'history-item-card';
    
    // Content
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px; opacity:0.5; padding-right: 20px;">
        <span>${item.timestamp}</span>
      </div>
      <div style="font-weight:900; font-size:14px;">${item.prompt.substring(0, 50)}...</div>
    `;
    
    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'history-delete-btn';
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.title = "删除此记录";
    delBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent triggering card click
      if(confirm('确定删除这条历史记录吗？')) {
        deleteHistoryItem(item.id);
      }
    };
    
    // Load Action
    card.onclick = () => {
      restart();
      dayPlanItinerary = item.itinerary;
      itinerarySummary = item.summary;
      socialRecommendations = item.recommendations || [];
      (getEl('prompt-input') as HTMLTextAreaElement).value = item.prompt;
      renderAll();
      getEl('history-modal').classList.remove('active');
      getEl('timeline-container').classList.add('visible');
      showToast("方案加载成功");
    };
    
    card.appendChild(delBtn);
    card.appendChild(contentDiv);
    container.appendChild(card);
  });
}

function deleteHistoryItem(id: number) {
  let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  history = history.filter((item: any) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderHistoryList(); // Refresh list
  showToast("删除成功");
}

/**
 * 生成自然语言格式的旅行指南文本
 */
function generatePlainTextGuide(): string {
  const prompt = (getEl('prompt-input') as HTMLTextAreaElement).value;
  let text = `🌍 AI Travel Pro 深度智游指南\n`;
  text += `📅 生成时间: ${new Date().toLocaleString()}\n`;
  text += `🎯 用户需求: ${prompt}\n\n`;

  // 1. 行程总览
  if (itinerarySummary) {
    text += `📝 行程亮点总结\n${itinerarySummary}\n\n`;
  }

  // 2. 社交推荐
  if (socialRecommendations.length > 0) {
    text += `🔥 社交热度风向标\n`;
    socialRecommendations.forEach((item, idx) => {
      text += `${idx + 1}. ${item.title} [${item.platform}]\n`;
      text += `   热度: ${item.hot_score} | 推荐理由: ${item.reason}\n`;
    });
    text += `\n`;
  }

  // 3. 详细行程
  if (dayPlanItinerary.length > 0) {
    text += `🗺️ 每日详细行程安排\n`;
    
    // 按天分组
    const days: Record<string, any[]> = {};
    dayPlanItinerary.forEach(item => {
      if (!days[item.day]) days[item.day] = [];
      days[item.day].push(item);
    });

    Object.keys(days).sort((a,b) => Number(a)-Number(b)).forEach(dayNum => {
      text += `\n【Day ${dayNum}】\n`;
      days[dayNum].forEach((item: any) => {
         const city = item.city ? `(${item.city})` : '';
         const weather = (item.weather_icon && item.temperature) ? ` [${item.weather_icon} ${item.temperature}]` : '';
         text += `📍 ${item.sequence}. ${item.name} ${city}\n`;
         text += `   ⏰ 时间: ${item.time}${weather}\n`;
         text += `   📖 玩法: ${item.description}\n`;
         if (item.transit_hint) text += `   🚗 交通: ${item.transit_hint}\n`;
         text += `   --------------------------------\n`;
      });
    });
  }

  return text;
}

function exportToFile() {
  if (dayPlanItinerary.length === 0) {
    showToast("没有可导出的行程数据");
    return;
  }

  const textContent = generatePlainTextGuide();
  const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(textContent);
  
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "travel_guide_" + Date.now() + ".txt");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  showToast("文件下载已开始 (.txt)");
}

function copyToClipboard() { 
  if (dayPlanItinerary.length === 0 && !itinerarySummary) {
    showToast("没有内容可复制");
    return;
  }
  
  const textContent = generatePlainTextGuide();
  
  navigator.clipboard.writeText(textContent).then(() => {
    showToast("完整旅行指南已复制");
  }).catch(() => {
    showToast("复制失败，请手动复制");
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
