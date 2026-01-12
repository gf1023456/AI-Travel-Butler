/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';

declare const google: any;

// Application state
let map: any;
let points: any[] = [];
let markers: any[] = [];
let lines: any[] = [];
let popUps: any[] = [];
let bounds: any;
let activeCardIndex = 0;
let isPlannerMode = false;
let dayPlanItinerary: any[] = [];

// Weather System State
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null;
let animationId: number;
let particles: any[] = [];

// DOM Elements
const mapContainer = document.querySelector('#map-container') as HTMLDivElement;
const generateButton = document.querySelector('#generate') as HTMLButtonElement;
const resetButton = document.querySelector('#reset') as HTMLButtonElement;
const cardContainer = document.querySelector('#card-container') as HTMLDivElement;
const carouselIndicators = document.querySelector('#carousel-indicators') as HTMLDivElement;
const prevCardButton = document.querySelector('#prev-card') as HTMLButtonElement;
const nextCardButton = document.querySelector('#next-card') as HTMLButtonElement;
const cardCarousel = document.querySelector('.card-carousel') as HTMLDivElement;
const plannerModeToggle = document.querySelector('#planner-mode-toggle') as HTMLInputElement;
const timelineContainer = document.querySelector('#timeline-container') as HTMLDivElement;
const timeline = document.querySelector('#timeline') as HTMLDivElement;
const spinner = document.querySelector('#spinner') as HTMLDivElement;
const errorMessage = document.querySelector('#error-message') as HTMLDivElement;
const promptInput = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const closeTimelineButton = document.querySelector('#close-timeline') as HTMLButtonElement;

/**
 * 初始化天气 Canvas
 */
function initWeatherCanvas() {
  if (document.getElementById('weather-canvas')) return;
  canvas = document.createElement('canvas');
  canvas.id = 'weather-canvas';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '5';
  document.getElementById('map-container')?.appendChild(canvas);
  ctx = canvas.getContext('2d');

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * 天气动画渲染引擎
 */
function startWeatherAnimation(type: string) {
  if (!ctx) return;
  particles = [];
  if (animationId) cancelAnimationFrame(animationId);

  const createParticle = () => {
    if (type === 'rainy' || type === 'stormy') {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        l: Math.random() * 20 + 10,
        v: Math.random() * 10 + 10
      };
    } else if (type === 'snowy') {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3 + 1,
        v: Math.random() * 2 + 1,
        wind: Math.random() * 1 - 0.5
      };
    }
    return null;
  };

  if (['rainy', 'stormy', 'snowy'].includes(type)) {
    for (let i = 0; i < 150; i++) {
      const p = createParticle();
      if (p) particles.push(p);
    }
  }

  function animate() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (type === 'rainy' || type === 'stormy') {
      ctx.strokeStyle = 'rgba(174, 194, 224, 0.6)';
      ctx.lineWidth = 1;
      particles.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.l);
        ctx.stroke();
        p.y += p.v;
        if (p.y > canvas.height) p.y = -p.l;
      });
      if (type === 'stormy' && Math.random() > 0.97) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else if (type === 'snowy') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.v;
        p.x += p.wind;
        if (p.y > canvas.height) p.y = -p.r;
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
      });
    } else if (type === 'sunny') {
      const gradient = ctx.createRadialGradient(canvas.width / 2, 100, 0, canvas.width / 2, 100, 400);
      gradient.addColorStop(0, 'rgba(255, 255, 180, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (type === 'cloudy') {
      ctx.fillStyle = 'rgba(100, 100, 100, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    animationId = requestAnimationFrame(animate);
  }
  animate();
}

/**
 * 初始化地图应用
 */
async function initApp() {
  try {
    const { Map } = await google.maps.importLibrary('maps');
    const { LatLngBounds } = await google.maps.importLibrary('core');

    bounds = new LatLngBounds();
    map = new Map(document.getElementById('map'), {
      center: { lat: 34.2634, lng: 108.9487 }, // 西安
      zoom: 6,
      mapId: '4504f8b37365c3d0',
      gestureHandling: 'greedy',
      disableDefaultUI: true
    });

    initWeatherCanvas();

    // 自定义弹出窗口类
    (window as any).Popup = class Popup extends google.maps.OverlayView {
      position: any; containerDiv: HTMLDivElement;
      constructor(position: any, content: HTMLElement) {
        super();
        this.position = position;
        
        this.containerDiv = document.createElement('div');
        this.containerDiv.classList.add('custom-map-popup');
        
        const anchor = document.createElement('div');
        anchor.classList.add('popup-anchor');
        
        const bubble = document.createElement('div');
        bubble.classList.add('popup-bubble');
        bubble.appendChild(content);
        
        this.containerDiv.appendChild(bubble);
        this.containerDiv.appendChild(anchor);
        
        google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.containerDiv);
      }
      onAdd() { (this as any).getPanes().floatPane.appendChild(this.containerDiv); }
      onRemove() { if (this.containerDiv.parentElement) this.containerDiv.parentElement.removeChild(this.containerDiv); }
      draw() {
        const divPosition = (this as any).getProjection().fromLatLngToDivPixel(this.position);
        if (divPosition) {
          this.containerDiv.style.left = divPosition.x + 'px';
          this.containerDiv.style.top = divPosition.y + 'px';
        }
      }
    };
  } catch (err) {
    console.error('地图加载失败:', err);
    errorMessage.innerText = '地图初始化失败，请检查网络连接。';
  }
}

// 启动应用
initApp();

// Gemini 配置
const locationFunctionDeclaration: FunctionDeclaration = {
  name: 'location',
  parameters: {
    type: Type.OBJECT,
    description: '获取地点的坐标、天气和描述信息。',
    properties: {
      name: { type: Type.STRING, description: '地点名称。' },
      description: { type: Type.STRING, description: '地点相关的趣味描述。' },
      lat: { type: Type.STRING, description: '纬度。' },
      lng: { type: Type.STRING, description: '经度。' },
      weather: { type: Type.STRING, description: '天气类型：sunny, rainy, snowy, cloudy, stormy' },
      temp: { type: Type.STRING, description: '模拟温度（如 22°C）。' },
      time: { type: Type.STRING, description: '建议游览时间。' },
      duration: { type: Type.STRING, description: '停留时长。' },
      sequence: { type: Type.NUMBER, description: '行程中的顺序。' },
    },
    required: ['name', 'description', 'lat', 'lng', 'weather'],
  },
};

const lineFunctionDeclaration: FunctionDeclaration = {
  name: 'line',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      start: { type: Type.OBJECT, properties: { lat: { type: Type.STRING }, lng: { type: Type.STRING } } },
      end: { type: Type.OBJECT, properties: { lat: { type: Type.STRING }, lng: { type: Type.STRING } } },
      transport: { type: Type.STRING },
      travelTime: { type: Type.STRING },
    },
    required: ['name', 'start', 'end'],
  },
};

const systemInstructions = `你是一个具备实时天气感知能力的地理专家，使用中文进行交流。
## 核心指南
1. 为用户探索中国及全球各地的位置。
2. 必须为每个地点通过 'location' 函数返回天气状况（weather）和温度（temp）。
3. 模拟不同城市间的天气差异。例如：西安此时可能是晴天(sunny)，但延安可能是暴雪(snowy)。
4. 两种模式：
   - 通用探索：展示多个地标。
   - 行程规划：创建一个有序的 4-6 个点的行程，包含 'time' 和 'sequence'。
5. 永远不要在没有地理位置数据的情况下只回复文字。`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function sendText(prompt: string) {
  if (!prompt.trim()) return;
  
  spinner.classList.remove('hidden');
  generateButton.classList.add('loading');
  errorMessage.innerHTML = '';
  
  restart();

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: prompt + (isPlannerMode ? " 规划一个详细的单日行程" : ""),
      config: {
        systemInstruction: systemInstructions,
        tools: [{ functionDeclarations: [locationFunctionDeclaration, lineFunctionDeclaration] }],
      },
    });

    let hasData = false;
    for await (const chunk of response) {
      const fns = chunk.functionCalls ?? [];
      for (const fn of fns) {
        if (fn.name === 'location') { await setPin(fn.args); hasData = true; }
        if (fn.name === 'line') { await setLeg(fn.args); hasData = true; }
      }
    }

    if (!hasData) throw new Error('未能生成有效的地理数据，请尝试更具体的提示。');
    
    createLocationCards();
    if (popUps.length > 0) highlightCard(0, true);
    
    if (isPlannerMode) {
      dayPlanItinerary.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      createTimeline();
      showTimeline();
    }
  } catch (e: any) {
    errorMessage.innerHTML = `错误: ${e.message || '未知错误'}`;
    console.error(e);
  } finally {
    spinner.classList.add('hidden');
    generateButton.classList.remove('loading');
  }
}

async function setPin(args: any) {
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  const point = { lat: Number(args.lat), lng: Number(args.lng) };
  
  points.push(point);
  bounds.extend(point);
  
  const marker = new AdvancedMarkerElement({ map, position: point, title: args.name });
  markers.push(marker);
  map.fitBounds(bounds);

  const content = document.createElement('div');
  content.className = 'popup-inner-content';
  const weatherEmoji = args.weather === 'snowy' ? '❄️' : args.weather === 'rainy' ? '🌧️' : args.weather === 'cloudy' ? '☁️' : '☀️';
  
  content.innerHTML = `
    <div class="popup-title-row">
      <span class="popup-emoji">${weatherEmoji}</span>
      <span class="popup-name">${args.name}</span>
    </div>
    <div class="popup-body-text">${args.description}</div>
    <div class="popup-footer-tag">${args.temp || ''}</div>
  `;
  
  const popup = new (window as any).Popup(new google.maps.LatLng(point), content);
  popup.setMap(map);

  const locInfo = { ...args, position: new google.maps.LatLng(point), popup, content };
  popUps.push(locInfo);
  if (isPlannerMode) dayPlanItinerary.push(locInfo);
}

async function setLeg(args: any) {
  const start = { lat: Number(args.start.lat), lng: Number(args.start.lng) };
  const end = { lat: Number(args.end.lat), lng: Number(args.end.lng) };
  bounds.extend(start); bounds.extend(end);
  map.fitBounds(bounds);
  
  const poly = new google.maps.Polyline({
    path: [start, end],
    strokeColor: '#2196F3',
    strokeOpacity: 0.8,
    strokeWeight: 4,
    map
  });
  lines.push({ poly, name: args.name });
}

function createLocationCards() {
  cardContainer.innerHTML = '';
  carouselIndicators.innerHTML = '';
  cardCarousel.style.display = 'block';

  popUps.forEach((loc, index) => {
    const card = document.createElement('div');
    card.className = 'location-card';
    card.dataset.index = index.toString();
    const weatherIcon = loc.weather === 'snowy' ? 'fa-snowflake' : loc.weather === 'rainy' ? 'fa-cloud-showers-heavy' : loc.weather === 'stormy' ? 'fa-bolt' : 'fa-sun';
    card.innerHTML = `
      <div class="card-weather-overlay"><i class="fas ${weatherIcon}"></i> ${loc.temp || ''}</div>
      <div class="card-content">
        <h3 class="card-title">${loc.name}</h3>
        <p class="card-description">${loc.description}</p>
        <div class="card-weather-tag">${loc.weather}</div>
      </div>
    `;
    card.onclick = () => highlightCard(index, true);
    cardContainer.appendChild(card);
    
    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    dot.onclick = (e) => {
      e.stopPropagation();
      highlightCard(index, true);
    };
    carouselIndicators.appendChild(dot);
  });
}

// 防抖变量用于同步滚动
let scrollTimeout: number;

function highlightCard(index: number, shouldScroll: boolean = false) {
  if (activeCardIndex === index && !shouldScroll) return;
  activeCardIndex = index;

  const cards = cardContainer.querySelectorAll('.location-card');
  cards.forEach((c, i) => c.classList.toggle('card-active', i === index));
  
  const dots = carouselIndicators.querySelectorAll('.carousel-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === index));

  const loc = popUps[index];
  if (loc) {
    map.panTo(loc.position);
    startWeatherAnimation(loc.weather);
  }

  // 如果是因为点击导致的跳转，需要平滑滚动到相应卡片
  if (shouldScroll) {
    const targetCard = cards[index] as HTMLElement;
    if (targetCard) {
      cardContainer.scrollTo({
        left: targetCard.offsetLeft - (cardContainer.offsetWidth / 2) + (targetCard.offsetWidth / 2),
        behavior: 'smooth'
      });
    }
  }
}

// 监听卡片容器滚动，实现滑动自动同步地图
cardContainer.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = window.setTimeout(() => {
    const containerWidth = cardContainer.offsetWidth;
    const scrollLeft = cardContainer.scrollLeft;
    const center = scrollLeft + containerWidth / 2;
    
    const cards = cardContainer.querySelectorAll('.location-card');
    let closestIndex = 0;
    let minDistance = Infinity;

    cards.forEach((card, i) => {
      const cardCenter = (card as HTMLElement).offsetLeft + (card as HTMLElement).offsetWidth / 2;
      const distance = Math.abs(center - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    });

    if (closestIndex !== activeCardIndex) {
      highlightCard(closestIndex, false);
    }
  }, 100); // 100ms 防抖，确保停止滑动后才跳转
});

function createTimeline() {
  if (!timeline) return;
  timeline.innerHTML = '';
  dayPlanItinerary.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.onclick = () => highlightCard(popUps.indexOf(item), true);
    div.innerHTML = `
      <div class="timeline-time">${item.time || '安排中'}</div>
      <div class="timeline-connector"><div class="timeline-dot"></div><div class="timeline-line"></div></div>
      <div class="timeline-content">
        <div class="timeline-title">${item.name}</div>
        <div class="timeline-description">${item.description}</div>
      </div>
    `;
    timeline.appendChild(div);
  });
}

function showTimeline() {
  timelineContainer.style.display = 'block';
  setTimeout(() => {
    timelineContainer.classList.add('visible');
    mapContainer.classList.add('shifted');
  }, 10);
}

function hideTimeline() {
  timelineContainer.classList.remove('visible');
  mapContainer.classList.remove('shifted');
  setTimeout(() => {
    timelineContainer.style.display = 'none';
  }, 300);
}

function restart() {
  points = [];
  bounds = new google.maps.LatLngBounds();
  markers.forEach(m => m.setMap(null));
  markers = [];
  lines.forEach(l => l.poly.setMap(null));
  lines = [];
  popUps.forEach(p => p.popup.setMap(null));
  popUps = [];
  dayPlanItinerary = [];
  cardContainer.innerHTML = '';
  cardCarousel.style.display = 'none';
  if (animationId) cancelAnimationFrame(animationId);
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  hideTimeline();
}

// 绑定事件
promptInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendText(promptInput.value);
  }
});

generateButton.addEventListener('click', () => sendText(promptInput.value));
resetButton.addEventListener('click', restart);
closeTimelineButton.addEventListener('click', hideTimeline);

plannerModeToggle.addEventListener('change', () => {
  isPlannerMode = plannerModeToggle.checked;
  promptInput.placeholder = isPlannerMode ? "输入你想去的地方规划行程..." : "探索地点、历史、活动...";
  if (!isPlannerMode) hideTimeline();
});
