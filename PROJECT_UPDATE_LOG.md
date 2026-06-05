# 慧游 AI 旅行助手 - 项目更新日志 & 服务信息

> 最后更新：2026-06-04

---

## 一、项目概览

| 项 | 值 |
|---|---|
| 项目名 | 慧游 (AI Travel Butler) |
| 运行环境 | uni-app (微信小程序) |
| 前端框架 | Vue 3 + Pinia |
| 后端 | Python (python_server/) |
| 源码目录 | `uni-app-travel/src/` |
| 编译产物 | `uni-app-travel/dist/dev/mp-weixin/` |
| 设计系统 | Material Design 3 风格 + 毛玻璃 |


## 二、页面路由 (pages.json)

| 路由 | 页面 | 说明 |
|------|------|------|
| `pages/index/index` | 地图首页 | 地图 + QuickCard + 底部导航 |
| `pages/login/index` | 登录页 | 微信登录 |
| `pages/mine/index` | 我的 | 用户资料 + 配额 + 设置入口 |
| `pages/plan/plan` | 行程详情 | 时间轴 + 编辑 + 分享海报 |
| `pages/refine/refine` | 行程优化 | AI 自然语言优化 |
| `pages/explore/index` | 灵感探索 | 行程生成入口 |
| `pages/history/index` | 历史记录 | 过往行程管理 |
| `pages/settings/index` | 设置 | 主题/通知/存储管理 |
| `pages/settings/feedback` | 帮助与反馈 | - |
| `pages/agreement/user` | 用户协议 | - |
| `pages/agreement/privacy` | 隐私政策 | - |
| `pages/guide/index` | 引导页 | 首次启动3页滑动引导 🆕 |


## 三、公共组件 (`src/components/`)

> 本次重构新增，所有页面复用

| 组件 | 文件 | Props | 使用页面 |
|------|------|-------|----------|
| **NavBar** | `NavBar.vue` | `title`, `brand`, `showBack`, `showAvatar`, `showNotif`, `placeholder`, `backUrl` | explore/plan/refine/history/mine/settings |
| **BottomSheet** | `BottomSheet.vue` | `visible`, `title`, `closeOnOverlay` | index/history |
| **BottomNav** | `BottomNav.vue` | `currentItem`, `explorePath` | index/mine |
| **GlassCard** | `GlassCard.vue` | `heavy`, `panel`, `radius`, `padding` | 任意 |
| **BrandButton** | `BrandButton.vue` | `icon`, `size`, `block`, `disabled` | 任意 |
| **EmptyState** | `EmptyState.vue` | `icon`, `title`, `description`, `actionText` (+ `@action`) | plan/history |
| **UserAvatar** | `UserAvatar.vue` | `showName`, `size` | 任意 |
| **Skeleton** | `Skeleton.vue` | `type`(card/timeline/quick-card/inline), `count`, `icon`, `statusText`, `elapsed`, `progress` | explore/plan |


## 四、行程数据结构

```js
// travelStore.currentPlan
{
  itinerarySummary: string,       // 行程摘要
  dayPlanItinerary: [{           // 扁平数组，每项一个景点
    name: string,                // 景点名称
    day: number,                 // 第几天
    sequence: number,            // 当天顺序
    lat: number,                 // 纬度
    lng: number,                 // 经度
    description: string,         // 景点介绍
    image: string,               // 图片URL
    time: string,                // 时间 "09:00"
    city: string,                // 城市
    weather_icon: string,        // 天气图标
    temperature: string,         // 温度
    transit_hint: string,        // 交通提示
    visit_duration: string       // 游览时长
  }],
  socialRecommendations: [],
  evidence: [],
  warnings: [],
  isFromHistory: boolean,
  historyId: number
}
```


## 五、行程生成流程 (V4 骨架优先)

```
用户输入 → POST /plan/create → taskId
  → 轮询 getPlanV4Status(taskId)
    ├── pending/running → 继续轮询 (3s)
    ├── skeleton_ready → 存储骨架 → reLaunch 首页 → 后台继续轮询
    ├── completed → 存储完整数据 → 扣减配额
    └── failed → 提示失败
```


## 六、API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/plan/create` | 创建行程任务 |
| POST | `/plan/createV4` | V4 骨架优先创建 |
| GET | `/plan/status/{taskId}` | 查询任务状态 |
| GET | `/plan/result/{taskId}` | 获取任务结果 |
| POST | `/plan/refine` | 优化行程 |
| POST | `/user/info` | 获取用户信息 |
| POST | `/user/update` | 更新用户信息 |
| POST | `/user/verify` | 验证 token |
| GET | `/quota` | 查询配额 |
| POST | `/quota/use` | 扣减配额 |
| GET | `/history/list` | 历史记录列表 |
| GET | `/history/detail/{id}` | 历史详情 |
| DELETE | `/history/{id}` | 删除历史 |
| POST | `/poster/generate` | 生成海报 |
| GET | `/weather/now` | 实时天气 |


## 七、颜色/主题变量

主品牌色：`#000666` (深蓝黑) → `#1a237e` (靛蓝) → `#6366f1` (亮蓝紫)

CSS 变量文件：`src/static/common.css`

关键变量：
- `--color-primary: #000666`
- `--color-surface: #f8f9fa`
- `--gradient-brand: linear-gradient(135deg, #000666 0%, #1a237e 100%)`
- `--gradient-shimmer: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`
- 毛玻璃预设：`.glass-card`, `.glass-card-heavy`, `.glass-panel`
- 品牌渐变预设：`.brand-gradient`


## 八、工具函数

| 文件 | 导出 | 说明 |
|------|------|------|
| `utils/safeArea.js` | `useSafeArea()` | 返回 `{ statusBarHeight, safeAreaBottom }` |
| `utils/theme.js` | `themeClass`, `initTheme()`, `setTheme()`, `isFollowSystem()` | 主题切换 |
| `utils/poster.js` | `PosterGenerator` | Canvas 海报生成 |


## 九、本次更新记录 (2026-06-04)

### 新增
- ✅ 8个公共组件（NavBar/BottomSheet/BottomNav/GlassCard/BrandButton/EmptyState/UserAvatar/Skeleton）
- ✅ 引导页 `pages/guide/index` — 3页滑动引导（智能规划/地图交互/一键分享海报），首次启动自动跳转
- ✅ 行程编辑能力：编辑模式切换、上下排序、删除景点、修改时间、长按操作菜单、单景点AI优化
- ✅ 骨架屏动画：大尺寸品牌色卡片式生成动画（中央弹跳图标+扩散圆环脉冲+跳跳点+渐变进度条）

### 修改
- ✅ 7个页面重构为组件调用，清理大量重复CSS和代码
- ✅ BottomNav 增加 `explorePath` prop，修复地图页"探索"按钮无响应
- ✅ 去掉各页面顶部"慧游"品牌名，改为有意义的页面名称（"当前位置"/"灵感探索"/"历史记录"/"我的"）
- ✅ 历史页详情弹窗去除"模型"、"供应商"字段，改为毛玻璃卡片布局
- ✅ explore 页骨架屏去掉 `uni.showLoading` 系统遮罩，改用骨架组件视觉反馈
- ✅ 骨架屏从横条样式升级为大卡片样式，配色统一品牌渐变

### 文件变更清单
```
新增:
  src/components/NavBar.vue
  src/components/BottomSheet.vue
  src/components/BottomNav.vue
  src/components/GlassCard.vue
  src/components/BrandButton.vue
  src/components/EmptyState.vue
  src/components/UserAvatar.vue
  src/components/Skeleton.vue
  src/pages/guide/index.vue

修改:
  src/pages.json                  (注册 guide 路由)
  src/App.vue                     (首次启动引导检测)
  src/pages/index/index.vue       (BottomNav + 顶部文字)
  src/pages/explore/index.vue     (NavBar + Skeleton + 去loading)
  src/pages/plan/plan.vue         (NavBar + Skeleton + EmptyState + 编辑功能)
  src/pages/history/index.vue     (NavBar + EmptyState + 详情UI重写)
  src/pages/mine/index.vue        (NavBar + BottomNav)
  src/pages/refine/refine.vue     (NavBar + focus参数支持)
  src/pages/settings/index.vue    (NavBar)
  src/store/travel.js             (未改)
```

---

## 十、注意事项

1. **index.vue 使用 Options API**（`export default {}`），导入组件需注册到 `components: {}`
2. 其他页面使用 `<script setup>`，组件导入即用
3. Skeleton 组件的 `inline` 类型用于生成等待动画（explore/plan），`timeline` 类型用于行程骨架占位（plan）
4. 引导页完成标记存储在 `uni.getStorageSync('onboarding_completed')`，值为 `'true'`
5. 主题色修改需同时改 `common.css` 中的 light/dark 两组变量
