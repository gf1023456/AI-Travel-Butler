# AI Travel Butler - 项目说明文档

## 1. 项目概述

AI Travel Butler 是一款智能旅游行程规划应用程序，通过AI助手生成定制旅行方案，并在地图上可视化展示行程路线和标注点。

## 2. 核心架构

### 功能模块
- **Explore (探索模块)** - AI行程生成入口
- **Plan (行程模块)** - 行程详情和管理  
- **Index (地图模块)** - 地图可视化展示
- **History (历史模块)** - 历史记录管理
- **Mine (个人模块)** - 用户中心

### 数据流转
```
[用户输入] → Explore 页面 → API → AI 后端 → Plan 数据 → Store → Index 页面 → 地图标记展示
```

## 3. 交互流程

### 3.1 核心功能流程
1. **行程规划**  
   `Explore页面` → 输入旅行需求 → API请求 → AI生成方案 → 保存到Store → 地图展示  

2. **地图展示**  
   `Index页面` → 读取Store数据 → 解析行程数组 → 生成标记点 → 渲染路线轨迹  

3. **数据持久化**  
   `Explore/Save` → API请求 → 数据库 → 降级到本地存储  

### 3.2 页面状态同步
- 新行程生成 → Store更新 → 地图重载 → 实时显示标记点和路线
- 历史记录访问 → API → 数据加载 → 重新计算地图路径

## 4. 技术实现

### 4.1 状态管理 (Pinia)
- `travelStore.currentPlan` - 存储当前行程方案
- `dayPlanItinerary` 格式支持按天分组对象格式和纯数组格式
- 自动映射到地图组件需要的 marker/polyline 数据

### 4.2 地图功能
- **标记支持** - 按天分配色方案
- **轨迹连线** - 同一天内点位自动连线 
- **详情弹窗** - 点击标记显示行程详情
- **数据驱动** - 数据更新时自动重绘所有标注

### 4.3 前端API
```
- POST /api/plan: 生成新行程 (字段: userInput, modelType, isPlannerMode, travelMode)
- POST /api/history/save: 保存历史 (字段: userInput, modelType, provider, itinerary_summary...)
- GET /api/history/list: 获取历史 (返回: {list: [Item], total: N})
```

## 5. 交互问题分析

### 5.1 当前交互痛点
1. **导航过于复杂** - 多层页面跳转用户体验不佳
2. **加载反馈不足** - API调用时没有明确加载提示
3. **数据异步性** - 生成后需手工刷新地图状态

### 5.2 潜在改进点

#### A. 导航优化
**现状**：Explore → Plan → Index (多次跳转)
```javascript
// 当前做法
uni.navigateTo({url: '/pages/plan/plan'})
// ...然后手工跳转地图
```

**建议优化**：直接返回带有状态指示
```javascript
// 生成完成后直接展示地图
uni.redirectTo({url: '/pages/index/index?refresh=now&message=行程已生成'})
```

#### B. 用户反馈机制
**现状**：静默保存 + 无进度提示
**建议**：
- 在index/index.vue中添加API进度指示器
- 生成过程中实时状态更新

#### C. 地图自动定位
**现状**：地图不会自动跳转到新生成行程
**建议**：
```vue
// index.vue组件中
const updateMapData = () => {
  const plan = travelStore.currentPlan
  if (plan.newGenerated) { // 检查是否新生成
    // 自动飞转到首地点
    const firstPoint = plan.dayPlanItinerary[0]
    mapContext.moveToLocation(firstPoint.lat, firstPoint.lng)
    travelStore.currentPlan.newGenerated = false
  }
}
```

## 6. 部署和运行

### 运行环境
- 必需：AI后端服务正常启动
- 端口：默认API端口 `8787`

### 前端资源
- 地图组件依赖：需要有效的天地图API密钥
- 网络配置：确保 `request合法域名` 设置正确

## 7. 未来优化方向

### 7.1 性能优化
- 标记聚类：高密度标记点性能处理
- 路径缓存：复杂路径计算缓存策略

### 7.2 交互增强
- 实时预览：生成过程中预览标记
- 拖拉排序：手动调整日程顺序
- 离线地图：支持部分离线功能

### 7.3 数据拓展
- 更多来源：接入POI数据、天气数据
- 多格式导出：PDF/Excel行程表

---

**备注**: 项目采用MVVM架构，前后端分离设计。地图和行程数据的联动是核心特色功能。