# 旅行规划 SKILL

## 业务流程

用户表达旅行意向 → `generateTravelPlan` 生成行程 → 原子组件展示预览卡片 → 用户点击"查看完整行程"打开半屏页面 → 用户可点击景点追问详情或要求调整

## 用户意图入口

1. "我想去XX玩N天" → 调用 `generateTravelPlan`，参数提取 destination/days
2. "推荐一下XX有什么好玩的" → 调用 `generateTravelPlan`，days 默认 3，style 默认深度文化
3. "XX周末去哪" → 调用 `generateTravelPlan`，days=2，style=休闲

## 接口依赖

- `generateTravelPlan`：无前置依赖，独立调用
- 所有业务 ID（如 planId）取自 `generateTravelPlan` 返回的 requestId 原值

## 业务约束

- `generateTravelPlan` 返回后必须出 GUI 卡片展示行程摘要
- 用户点击"查看完整行程"时，通过 `openDetailPage` 打开半屏页面
- 用户点击景点时，通过 `sendFollowUpMessage` 上行"介绍一下XXX"由模型回复
- 严禁在未调用 `generateTravelPlan` 前向用户承诺已生成方案
