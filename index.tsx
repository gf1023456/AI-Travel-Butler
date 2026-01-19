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
let mapLayers: L.Layer[] = []; // Store markers and polylines to clear them easily
let tdtLayer: L.TileLayer;
let tdtAnnoLayer: L.TileLayer;
let currentMapType: 'tdt_vec' | 'tdt_img' = 'tdt_vec'; // Track map type
let activeSheet: string | null = null; // Track currently open sheet

// Constants
const TDT_DEFAULT_KEY = "97f9870fb795ba80ef201d6edae71d73";
const ZHIPU_DEFAULT_KEY = "b8aa2e50a2484cc1bd0fd45527217880.UJk1UbZRdZi6zgOx";
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
  (getEl('zhipu-key-input') as HTMLInputElement).value = localStorage.getItem('zhipu_api_key') || ZHIPU_DEFAULT_KEY;

  switchTDT('tdt_vec', savedTdtKey);
  
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
    const key = localStorage.getItem('tdt_api_key') || TDT_DEFAULT_KEY;
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
    showToast("配置已保存", 'success');
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
- 严禁任何废话开场白，直接开始调用工具链。。`;

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
    let finalPrompt = constructUserPrompt(userInput, isPlannerMode, travelMode);

    if (modelType.startsWith('gemini')) {
        // --- GOOGLE GEMINI (Use SDK) ---
        await callGemini(modelType, finalPrompt);
    } else if (modelType.includes('deepseek')) {
        // --- DEEPSEEK ---
        await handleDeepSeekRequest(modelType, userInput, finalPrompt);
    } else if (modelType.includes('GLM') || modelType.includes('glm')) {
        // --- ZHIPU GLM ---
        await handleZhipuRequest(modelType, userInput, finalPrompt);
    }
    
    renderAll();
    
    // Automatically open the Plan sheet after generation
    setTimeout(() => {
        setActiveTab('nav-plan');
        toggleSheet('sheet-plan');
    }, 500);

  } catch (e: any) {
    console.error("AI Generation Error:", e);
    
    // Robust Error Handling with User Feedback
    let errorMsg = "服务暂时不可用，请稍后重试";
    let isAuthError = false;
    
    if (e.message) {
        // Check for common API errors
        if (e.message.includes('401') || e.message.includes('API key') || e.message.includes('Unauthenticated')) {
            errorMsg = "鉴权失败：API Key 无效或未配置";
            isAuthError = true;
        } else if (e.message.includes('429') || e.message.includes('quota') || e.message.includes('Resource has been exhausted')) {
            errorMsg = "请求过快：API 配额已耗尽或被限制";
        } else if (e.message.includes('Failed to parse')) {
            errorMsg = "数据解析错误：模型返回格式异常";
        } else if (e.message.includes('fetch') || e.message.includes('network')) {
            errorMsg = "网络连接失败，请检查您的网络设置";
        } else {
            // Truncate long error messages
            errorMsg = `请求失败: ${e.message.length > 50 ? e.message.substring(0, 50) + '...' : e.message}`;
        }
    }
    
    showToast(errorMsg, 'error', 5000);
    
    // If it's an auth error, guide user to settings
    if (isAuthError) {
        setTimeout(() => {
            getEl('settings-modal').classList.add('active');
            showToast("请检查并更新您的 API Key", 'normal', 4000);
        }, 1500);
    }

  } finally {
    getEl('loading-overlay').classList.remove('active');
  }
}

function constructUserPrompt(userInput: string, isPlannerMode: boolean, travelMode: string) {
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
      return `${modeInstruction}\n\n请为我生成一份详细的每日行程规划，严格区分出发地和目的地，不要混淆城市景点。需求：${userInput}`;
    } else {
      // 景点发现模式
      return `【核心指令：景点发现模式】
用户不需要完整的时间表，只需要你根据需求推荐一组值得去的地方。
1. 请列出符合用户需求的 5-10 个地点（集中在用户想去的目的地）。
2. 在地图上进行标注。
3. 提供简短的文字介绍和推荐理由。
用户需求：${userInput}`;
    }
}

// Transform Google GenAI schema to OpenAI JSON schema
function transformSchema(schema: any): any {
  if (!schema) return undefined;
  const newSchema: any = JSON.parse(JSON.stringify(schema));
  
  if (newSchema.type) {
    newSchema.type = newSchema.type.toLowerCase();
  }
  
  if (newSchema.properties) {
    const newProps: any = {};
    for (const key in newSchema.properties) {
      newProps[key] = transformSchema(newSchema.properties[key]);
    }
    newSchema.properties = newProps;
  }
  
  if (newSchema.items) {
    newSchema.items = transformSchema(newSchema.items);
  }
  
  // Clean up fields that might strictly offend OpenAI validation if they exist
  // but are undefined. (Mostly handled by JSON.stringify above)
  
  return newSchema;
}

function addValidItem(item: any) {
  if (!item) return;
  // Validations
  if (!item.name || !item.lat || !item.lng) return;
  
  // Normalize data types
  if (typeof item.day === 'string') item.day = parseInt(item.day) || 1;
  if (typeof item.sequence === 'string') item.sequence = parseInt(item.sequence) || 1;
  
  dayPlanItinerary.push(item);
}

async function callGemini(modelName: string, prompt: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: GLOBAL_SYSTEM_PROMPT + "严禁输出 <think> 标签内容。直接调用工具。",
        tools: [{ functionDeclarations: [locationTool, socialRecommendationTool] }],
      },
    });
    
    const fcs = response.functionCalls || [];
    fcs.forEach((fc: any) => {
      if (fc.name === 'location') addValidItem(fc.args);
      if (fc.name === 'get_social_recommendations') socialRecommendations = fc.args.recommendations || [];
    });
    itinerarySummary = response.text || "排期已生成";
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

  if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek Error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("DeepSeek 返回数据为空");
  
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
  // Use user provided key or default
  const apiKey = localStorage.getItem('zhipu_api_key') || ZHIPU_DEFAULT_KEY;
  if (!apiKey) throw new Error("请先在设置中配置 智谱 AI API Key");

  // Use model from arguments if available, otherwise default to user preference
  const modelName = model || 'glm-4-flash';

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${apiKey}` 
    },
    body: JSON.stringify({ 
      model: modelName, 
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
      max_tokens: 4096,
      temperature: 0.2
    })
  });

  if (!response.ok) {
     const errText = await response.text();
     throw new Error(`Zhipu GLM Error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Zhipu AI 返回数据为空");

  itinerarySummary = message.content || "正在解析智谱 AI 规划结果...";
  
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      if (tc.function.name === 'location') addValidItem(args);
      if (tc.function.name === 'get_social_recommendations') socialRecommendations = args.recommendations || [];
    }
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