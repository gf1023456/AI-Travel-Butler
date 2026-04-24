/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import L from 'leaflet';

// 全局地图相关变量
let map: L.Map;
let tdtLayer: L.TileLayer | null = null;
let tdtAnnoLayer: L.TileLayer | null = null;
let mapLayers: L.Layer[] = [];

// 前端配置（从后端获取）
let FRONTEND_CONFIG = {
  backendUrl: 'http://localhost:8787',  // 本地调试默认值
  tdtApiKey: '97f9870fb795ba80ef201d6edae71d73',
  mapCenter: [34.3416, 108.9398] as [number, number],
  mapZoom: 12,
  defaultMapType: 'tdt_vec' as 'tdt_vec' | 'tdt_img'
};

// 全局状态变量
let currentMapType: 'tdt_vec' | 'tdt_img' = 'tdt_vec';
let activeSheet: string | null = null;

// 行程数据
let dayPlanItinerary: any[] = [];
let socialRecommendations: any[] = [];
let itinerarySummary: string = '';
let itineraryEvidence: any[] = [];
let verifierWarnings: string[] = [];

// 颜色配置
const DAY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98FB98',
  '#DDA0DD', '#F0E68C', '#FF6347', '#BA55D3', '#9ACD32'
];

// 存储键名
const STORAGE_KEY = 'travel_history';

// 检测是否是本地调试环境
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 本地调试直接用 localhost:8787，生产环境从配置读取
const BACKEND_BASE_URL = isLocalDev 
  ? 'http://localhost:8787' 
  : FRONTEND_CONFIG.backendUrl;

// 获取前端配置
async function loadFrontendConfig(): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/frontend-config`);
    if (res.ok) {
      const data = await res.json();
      FRONTEND_CONFIG = { ...FRONTEND_CONFIG, ...data };
      console.log('Frontend config loaded:', FRONTEND_CONFIG);
    }
  } catch (e) {
    console.warn('Failed to load frontend config, using defaults:', e);
  }
}

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function initApp() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  // Initialize Map (使用配置中的中心点和缩放级别)
  map = L.map('map', {
    center: FRONTEND_CONFIG.mapCenter,
    zoom: FRONTEND_CONFIG.mapZoom,
    zoomControl: false,
    attributionControl: false
  });

  // Load saved keys - 天地图 Key 从配置读取，不再允许用户输入
  const savedTdtKey = FRONTEND_CONFIG.tdtApiKey || localStorage.getItem('tdt_api_key') || '';
  // 输入框已禁用，仅显示提示信息
  const tdtInput = getEl('tdt-key-input') as HTMLInputElement;
  if (tdtInput) {
    tdtInput.value = savedTdtKey ? '已配置' : '未配置';
  }

  switchTDT(FRONTEND_CONFIG.defaultMapType, savedTdtKey);
  
  // Initialize UI Bindings
  bindNavigation();
  bindEvents();
  getEl('loading-overlay').classList.remove('active');
  
  // Inject Toast Container
  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);

  // Open Explore sheet by default on desktop
  if (window.innerWidth > 768) {
    toggleSheet('sheet-explore');
  }
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

/**
 * Handle Bottom Dock and Sheet Logic
 */
function bindNavigation() {
  // 1. Explore Tab
  getEl('nav-explore').onclick = () => {
    setActiveTab('nav-explore');
    toggleSheet('sheet-explore');
  };
  getEl('top-search-trigger').onclick = () => {
    setActiveTab('nav-explore');
    toggleSheet('sheet-explore');
  };

  // 2. Plan Tab
  getEl('nav-plan').onclick = () => {
    setActiveTab('nav-plan');
    toggleSheet('sheet-plan');
  };

  // 3. Layers (Direct Action)
  getEl('nav-layers').onclick = () => {
    currentMapType = currentMapType === 'tdt_vec' ? 'tdt_img' : 'tdt_vec';
    const key = localStorage.getItem('tdt_api_key') || FRONTEND_CONFIG.tdtApiKey;
    switchTDT(currentMapType, key);
    
    // Toggle active state visual
    const btn = getEl('nav-layers');
    btn.classList.toggle('active');
    const label = btn.querySelector('span');
    if (label) label.innerText = currentMapType === 'tdt_img' ? '地图' : '卫星';
  };

  // 4. History (Modal)
  getEl('nav-history').onclick = () => {
    renderHistoryList();
    getEl('history-modal').classList.add('active');
  };

  // 5. Settings (Modal)
  getEl('nav-settings').onclick = () => {
    getEl('settings-modal').classList.add('active');
  };
  getEl('user-profile').onclick = () => {
    getEl('settings-modal').classList.add('active');
  };

  // Close Sheet Handlers
  document.querySelectorAll('.close-sheet-btn').forEach(btn => {
    (btn as HTMLButtonElement).onclick = (e) => {
      const targetId = (e.currentTarget as HTMLElement).dataset.target;
      if (targetId) closeSheet(targetId);
    };
  });
}

function setActiveTab(id: string) {
  document.querySelectorAll('.dock-item').forEach(el => el.classList.remove('active'));
  getEl(id).classList.add('active');
}

function toggleSheet(id: string) {
  const el = getEl(id);
  const isOpen = el.classList.contains('active');
  
  // Close all other sheets first (Mutual exclusion)
  document.querySelectorAll('.sheet-panel').forEach(sheet => {
    if (sheet.id !== id) sheet.classList.remove('active');
  });

  if (isOpen) {
    el.classList.remove('active');
    activeSheet = null;
  } else {
    el.classList.add('active');
    activeSheet = id;
  }
}

function closeSheet(id: string) {
  getEl(id).classList.remove('active');
  activeSheet = null;
}


async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  // 模型选择已禁用，由后端环境变量控制
  const modelType = 'auto'; // 让后端根据 PRIMARY_PROVIDER 选择
  const isPlannerMode = (getEl('planner-mode-toggle') as HTMLInputElement).checked;
  const travelMode = (getEl('travel-mode-selector') as HTMLSelectElement).value;

  if (!userInput) {
    showToast("请输入您的旅行想法", 'error');
    return;
  }

  restart();
  closeSheet('sheet-explore');
  getEl('loading-overlay').classList.add('active');

  try {
    const usedBackend = await tryBackendPlan(userInput, modelType, isPlannerMode, travelMode);
    if (!usedBackend) {
      throw new Error('后端规划服务不可用，请检查 server 是否启动');
    }

    renderAll();

    setTimeout(() => {
      setActiveTab('nav-plan');
      toggleSheet('sheet-plan');
    }, 500);
  } catch (e: any) {
    console.error("AI Generation Error:", e);
    const errorMsg = e?.message ? `请求失败: ${e.message}` : '服务暂时不可用，请稍后重试';
    showToast(errorMsg, 'error', 5000);
  } finally {
    getEl('loading-overlay').classList.remove('active');
  }
}

function bindEvents() {
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
       btn.innerHTML = '<i class="fas fa-magic"></i> 生成深度排期';
     } else {
       label.innerText = "🔍 景点发现 (轻量)";
       label.style.color = "#64748b";
       styleGroup.classList.add('hidden');
       btn.innerHTML = '<i class="fas fa-paper-plane"></i> 开始探索';
     }
  };

  // Save all keys - 已禁用用户输入，改为显示当前配置
  getEl('save-settings')?.remove(); // 移除保存按钮
  
  // 显示当前配置信息
  const configInfo = getEl('current-config-info');
  if (configInfo) {
    fetch(`${BACKEND_BASE_URL}/api/frontend-config`)
      .then(res => res.json())
      .then(data => {
        configInfo.innerHTML = `
          天地图 Key: ${data.tdtApiKey ? '已配置' : '未配置'}<br>
          后端地址: ${data.backendUrl || '默认'}
        `;
      })
      .catch(() => {
        configInfo.innerHTML = '加载失败';
      });
  }
  
  getEl('generate').onclick = handleRequest;
  getEl('save-itinerary-btn').onclick = saveToHistory;
  getEl('export-file-btn').onclick = exportToFile;
  getEl('share-btn').onclick = copyToClipboard;
}

async function tryBackendPlan(userInput: string, modelType: string, isPlannerMode: boolean, travelMode: string): Promise<boolean> {
=======
const GLOBAL_SYSTEM_PROMPT = `你是一位世界顶级的深度旅游规划专家。
采用思维链(CoT)方法，逐步制定最优行程。
思考步骤：
1. 明确用户目标地点和时间约束
2. 研究当地的交通连通性
3. 考虑开放时间和其他限制因素
4. 设计地理连贯的路线，优化空间连续性
5. 合理分配时间，包含交通和游玩所需时间
6. 最后输出结构化结果
【关键逻辑 - 出发地与目的地】
当用户输入"从 A 到 B"时，A 是出发地，B 是目的地；地点推荐与打点必须落在目的地 B，不得混淆。
【必需包含的三大部分】
1) 社交分析 (工具: get_social_recommendations)
   - 必须调用一次，给出趋势与理由。
2) 地图标注 (工具: location)
   - 必须针对用户要求的每一天调用多次。
   - 每天至少 3-4 个 location（早/中/晚/交通）。
   - 合成社交推荐后必须继续进行地图打点。
   - 推荐地点必须彼此地理接近，形成合理的游览路径。
3) 文字总结
   - 在工具调用后输出简短亮点。
【严苛禁令】
- 严禁只做其一：社交趋势与地图行程必须同时给出。
- 严禁输出 逛 标签内容。
- 严格按照指定城市的地理逻辑安排地点和路线，确保相邻推荐点彼此接近，最小化交通需求。`;

/**
 * Main Request Handler that dispatches to the correct AI provider
 */
async function handleRequest() {
  const userInput = (getEl('prompt-input') as HTMLTextAreaElement).value.trim();
  const modelType = (getEl('model-selector') as HTMLSelectElement).value;
  const isPlannerMode = (getEl('planner-mode-toggle') as HTMLInputElement).checked;
  const travelMode = (getEl('travel-mode-selector') as HTMLSelectElement).value;
  
  if (!userInput) {
    showToast("请输入您的旅行想法", 'error');
    return;
  }

  // API Key Validation
  if (modelType.includes('deepseek')) {
    if (!localStorage.getItem('deepseek_api_key')) {
      showToast('请先在设置中配置 DeepSeek API Key', 'error', 4000);
      setTimeout(() => getEl('settings-modal').classList.add('active'), 1000);
      return;
    }
  } else if (modelType.includes('glm')) {
    const hasKey = localStorage.getItem('zhipu_api_key') || ZHIPU_DEFAULT_KEY;
    if (!hasKey) {
       showToast('请先在设置中配置智谱 GLM API Key', 'error', 4000);
       setTimeout(() => getEl('settings-modal').classList.add('active'), 1000);
       return;
    }
  }

  restart();
  closeSheet('sheet-explore');
  getEl('loading-overlay').classList.add('active');
  
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, modelType, isPlannerMode, travelMode })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`backend ${response.status}: ${text}`);
    }

    const data = await response.json();
    dayPlanItinerary = Array.isArray(data.dayPlanItinerary) ? data.dayPlanItinerary : [];
    socialRecommendations = Array.isArray(data.socialRecommendations) ? data.socialRecommendations : [];
    itinerarySummary = data.itinerarySummary || '排期已生成';
    itineraryEvidence = Array.isArray(data.evidence) ? data.evidence : [];
    verifierWarnings = Array.isArray(data.verifierWarnings) ? data.verifierWarnings : [];
    return true;
  } catch (error) {
    console.warn('Backend planner unavailable.', error);
    return false;
  }
}

function renderAll() {
  // Sort Items
  dayPlanItinerary.sort((a, b) => (a.day - b.day) || (a.sequence - b.sequence));
  
  const container = getEl('timeline-content');
  container.innerHTML = ''; // Clear container

  // 1. Render Summary
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'timeline-card';
  summaryDiv.style.borderLeft = 'none'; // Clean look
  summaryDiv.innerHTML = `<h5 style="color:var(--text-title); font-size:15px; margin-bottom:10px;">🌟 行程综述</h5><p style="color:#3C3C43; font-size:14px; line-height:1.5;">${itinerarySummary}</p>`;
  container.appendChild(summaryDiv);

  if (itineraryEvidence.length > 0) {
    const evidenceDiv = document.createElement('div');
    evidenceDiv.className = 'timeline-card';
    const evidenceHtml = itineraryEvidence
      .slice(0, 3)
      .map((e, i) => `<p style="font-size:12px;color:#666;margin:6px 0;"><b>[${i + 1}]</b> ${e.snippet || ''}<br/><span style="opacity:.7;">来源: ${e.source || ''}</span></p>`)
      .join('');
    evidenceDiv.innerHTML = `<h5 style="color:var(--text-title); font-size:14px; margin-bottom:8px;">📚 证据引用</h5>${evidenceHtml}`;
    container.appendChild(evidenceDiv);
  }


  if (verifierWarnings.length > 0) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'timeline-card';
    warningDiv.innerHTML = `<h5 style="color:#ef6c00; font-size:14px; margin-bottom:8px;">⚠️ Verifier 检查</h5>${verifierWarnings
      .map((w) => `<p style="font-size:12px;color:#8a5a00;margin:4px 0;">• ${w}</p>`)
      .join('')}`;
    container.appendChild(warningDiv);
  }

  // 2. Render Social Recommendations
  if (socialRecommendations.length > 0) {
    const socialDiv = document.createElement('div');
    socialDiv.className = 'social-radar';
    let socialHtml = `<h4 style="margin-bottom:12px; font-size:16px;">🔥 热门打卡</h4>`;
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
    // Ensure lat/lng are usable
    if (!item.lat || !item.lng) return;
    
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    
    if (isNaN(lat) || isNaN(lng)) return;

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
        ? `<span style="background:#F2F2F7; color:#3C3C43; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:5px;">${item.city}</span>` 
        : '';

    // Popup Content
    const popupContent = `
      <div style="min-width:200px; font-family:-apple-system, sans-serif;">
        <h3 style="margin:0 0 5px 0; color:${dayColor}; font-size:16px;">
           ${item.name}
        </h3>
        <div style="font-size:12px; color:#8E8E93; margin-bottom:8px;">
           D${item.day} · ${item.time} ${cityBadge}
        </div>
        <p style="margin:0; font-size:13px; line-height:1.4; color:#333;">${item.description}</p>
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
      <h5 style="color:${dayColor}">Day ${item.day} <span style="color:#8E8E93; font-weight:normal;">${item.time}</span> ${cityBadge} ${weatherHtml}</h5>
      <div style="font-weight:700; font-size:16px; margin-bottom:4px; color:#000;">${item.name}</div>
      <p style="color:#3C3C43; font-size:14px;">${item.description}</p>
      ${item.transit_hint ? `<p style="color:#666; font-size:12px; margin-top:4px;">🚗 交通: ${item.transit_hint}</p>` : ''}
      ${item.visit_duration ? `<p style="color:#666; font-size:12px; margin-top:2px;">⏱️ 建议游玩: ${item.visit_duration}</p>` : ''}
    `;
    
    // Interaction: Click Card -> FlyTo Marker
    card.onclick = () => {
      map.flyTo(latlng, 15, { duration: 1.5 });
      marker.openPopup();
      
      // Close sheet slightly on mobile to show map (Jobs UX detail)
      if (window.innerWidth < 768) {
         // Optionally collapse sheet or just do nothing, user can drag down
      }
      
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
        weight: 5,
        opacity: 0.8,
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
  itineraryEvidence = [];
  verifierWarnings = [];
  getEl('timeline-content').innerHTML = `<div class="empty-state"><i class="fas fa-route"></i><p>正在规划中...</p></div>`;
}

// Show Toast Notification
function showToast(message: string, type: 'normal' | 'success' | 'error' = 'normal', duration = 3000) {
  const container = getEl('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Optional: Add icons based on type
  let iconHtml = '';
  if (type === 'success') iconHtml = '<i class="fas fa-check-circle"></i>';
  if (type === 'error') iconHtml = '<i class="fas fa-exclamation-circle"></i>';
  
  toast.innerHTML = `${iconHtml}<span>${message}</span>`;
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if(container.contains(toast)) container.removeChild(toast);
    }, 400); // Wait for transition to finish
  }, duration);
}

function saveToHistory() {
  if (dayPlanItinerary.length === 0) {
    showToast("当前无方案可保存", 'error');
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
  showToast("方案保存成功！", 'success');
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
      <div style="font-weight:700; font-size:15px; color:#000;">${item.prompt.substring(0, 50)}...</div>
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
      
      // Auto open plan sheet
      setActiveTab('nav-plan');
      toggleSheet('sheet-plan');
      
      showToast("方案加载成功", 'success');
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
  showToast("删除成功", 'success');
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
    showToast("没有可导出的行程数据", 'error');
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
    showToast("没有内容可复制", 'error');
    return;
  }
  
  const textContent = generatePlainTextGuide();
  
  navigator.clipboard.writeText(textContent).then(() => {
    showToast("完整旅行指南已复制", 'success');
  }).catch(() => {
    showToast("复制失败，请手动复制", 'error');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}