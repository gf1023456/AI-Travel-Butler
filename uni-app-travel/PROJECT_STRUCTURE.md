# AI Travel Butler - UniApp项目结构说明

## 目录结构总览

```
uni-app-travel/
├── src/                      # 源代码目录
│   ├── pages/               # 页面目录
│   │   ├── index/          # 首页 - 创建行程
│   │   ├── plan/           # 行程详情页面
│   │   └── refine/         # 行程优化页面
│   │
│   ├── components/         # 公共组件目录（待扩展）
│   │
│   ├── api/                # API接口目录
│   │   └── travel.js       # 旅行规划相关API
│   │
│   ├── store/              # Pinia状态管理
│   │   └── travel.js       # 旅行状态管理Store
│   │
│   ├── utils/              # 工具函数目录
│   │   └── request.js      # HTTP请求封装
│   │
│   ├── static/             # 静态资源目录
│   │   └── common.css      # 全局样式
│   │
│   ├── App.vue             # 根组件
│   ├── main.js             # 应用入口
│   ├── pages.json          # 页面路由配置
│   └── manifest.json       # 应用配置
│
├── index.html              # H5入口文件
├── package.json            # 项目依赖配置
├── vite.config.ts          # Vite构建配置
├── .gitignore             # Git忽略文件
└── README.md              # 项目说明
```

## 核心文件说明

### 1. 配置文件

- **package.json**: 项目依赖和脚本命令
  - `dev:h5` / `build:h5`: H5端开发/构建
  - `dev:mp-weixin` / `build:mp-weixin`: 微信小程序开发/构建
  - `dev:app` / `build:app`: App端开发/构建

- **vite.config.ts**: Vite构建工具配置
  - 配置了API代理：`/api` → `http://localhost:3001`
  - 集成uni-app插件

- **pages.json**: 页面路由和窗口样式配置
  - 定义了3个页面路由
  - 配置全局导航栏样式

- **manifest.json**: 应用配置
  - 配置应用名称、版本号
  - 配置各平台特有参数

### 2. 核心代码

- **main.js**: 应用入口文件
  - 创建SSR应用实例
  - 注册Pinia状态管理

- **App.vue**: 根组件
  - 引入全局样式
  - 应用生命周期钩子

### 3. 业务逻辑

- **store/travel.js**: 旅行状态管理
  - `currentPlan`: 当前行程
  - `planHistory`: 行程历史
  - `preferences`: 用户偏好
  - 提供`createPlan`和`refinePlan`方法

- **api/travel.js**: API接口封装
  - `createPlan`: 创建行程
  - `refinePlan`: 优化行程
  - `getFrontendConfig`: 获取配置

- **utils/request.js**: HTTP请求工具
  - 封装uni.request
  - 提供get/post方法

### 4. 页面

- **pages/index/index.vue**: 首页
  - 输入目的地、天数、预算
  - 调用API生成行程

- **pages/plan/plan.vue**: 行程详情页
  - 显示生成的行程内容
  - 提供优化和重新规划功能

- **pages/refine/refine.vue**: 行程优化页
  - 输入优化需求
  - 调用API优化现有行程

## 技术特点

✅ **Vue3 Composition API**: 使用setup语法糖
✅ **Pinia状态管理**: 现代化状态管理方案
✅ **跨平台支持**: H5、微信小程序、App
✅ **响应式设计**: 适配不同屏幕尺寸
✅ **模块化架构**: 清晰的代码组织
✅ **API代理**: 开发环境自动代理到后端

## 下一步开发建议

1. **组件扩展**: 在`components/`目录下添加可复用组件
2. **地图集成**: 添加Leaflet或高德地图组件
3. **用户认证**: 实现登录注册功能
4. **离线缓存**: 添加本地缓存支持
5. **国际化**: 支持多语言切换
6. **主题定制**: 支持暗色模式
