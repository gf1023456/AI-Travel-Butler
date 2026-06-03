# AI Travel Butler - UniApp版本

基于uni-app + Vue3的智能旅行规划移动端应用

## 技术栈

- **框架**: uni-app (支持H5、微信小程序、App等多端)
- **前端**: Vue 3 (Composition API)
- **状态管理**: Pinia
- **构建工具**: Vite
- **后端API**: 原有Node.js后端服务

## 项目结构

```
uni-app-travel/
├── src/
│   ├── pages/              # 页面文件
│   │   ├── index/         # 首页 - 创建行程
│   │   ├── plan/          # 行程详情页
│   │   └── refine/        # 行程优化页
│   ├── components/        # 公共组件
│   ├── api/               # API接口
│   │   └── travel.js      # 旅行规划相关API
│   ├── store/             # Pinia状态管理
│   │   └── travel.js      # 旅行状态管理
│   ├── utils/             # 工具函数
│   │   └── request.js     # HTTP请求封装
│   ├── static/            # 静态资源
│   ├── App.vue            # 根组件
│   ├── main.js            # 入口文件
│   ├── pages.json         # 页面路由配置
│   └── manifest.json      # 应用配置
├── package.json           # 项目依赖
└── vite.config.ts         # Vite配置
```

## 快速开始

### 1. 安装依赖

```bash
cd uni-app-travel
npm install
```

### 2. 启动后端服务

确保后端服务已启动（在项目根目录）：

```bash
cd ..
npm run dev:server
```

### 3. 运行前端

#### H5端
```bash
npm run dev:h5
```

#### 微信小程序
```bash
npm run dev:mp-weixin
```

#### App端
```bash
npm run dev:app
```

## 构建发布

### H5
```bash
npm run build:h5
```

### 微信小程序
```bash
npm run build:mp-weixin
```

### App
```bash
npm run build:app
```

## 功能特性

- ✅ 智能行程生成
- ✅ 行程优化与调整
- ✅ 多端支持（H5、微信小程序、App）
- ✅ 响应式设计
- ✅ 状态管理（Pinia）
- ✅ API代理配置

## 后端API对接

项目通过Vite代理与后端服务通信：
- 开发环境：`/api` → `http://localhost:3001`
- 生产环境：配置实际后端服务器地址

## 注意事项

1. 确保后端服务已正确配置并运行
2. 需要在`server/config.json`中配置有效的AI提供商API密钥
3. 微信小程序需要配置合法的appId
4. 首次运行前需要执行`npm install`安装依赖
