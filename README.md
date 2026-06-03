<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Travel Butler - 智能旅行规划助手

本项目包含在本地运行 AI 旅行规划应用所需的一切。

[English Version](./README.md)

## 本地运行

**前置条件：** Node.js

1. 安装依赖：
   `npm install`
2. 复制 `server/config.example.json` 到 `server/config.json` 并填写 API Key
3. 运行后端和前端：
   `npm run dev:server` (后端)
   `npm run dev` (前端)


## 后端服务 (西安试点)

在 `server/` 目录下添加了新的后端编排服务，作为将模型调用从前端迁移到后端并扩展 MCP 集成的第一步。

1. 安装依赖：
   `npm install`
2. 启动后端：
   `npm run dev:server`
3. 另开终端启动前端：
   `npm run dev`

前端现在将规划请求路由到 `http://localhost:8787/api/plan`（提供商调用集中在后端）。


### 后端配置文件

服务端从 `server/config.json` 读取配置（前端不再存储提供商密钥）。

1. 复制 `server/config.example.json` 为 `server/config.json`
2. 编辑 `server/config.json` 填写你的 API Key：
   - `providers.geminiApiKey`
   - `providers.deepseekApiKey`
   - `providers.zhipuApiKey`
   - `providers.dashscopeApiKey`
3. 可调整 `server`、`rag`、`rollout`、`performance` 等配置项


### 新增后端接口

- `POST /api/plan` : 生成初始行程
- `POST /api/plan/refine` : 根据新指令优化现有行程
- `GET /api/knowledge/search?q=...` : 查看本地 RAG 检索结果
- `GET /api/metrics` : 服务级计数器和提供商使用情况
- `GET /api/execution-log/:id` : 通过 execution_log_id 获取执行日志
- `GET /api/alerts` : 列出运行时告警（回滚/成本阈值）
- `GET /api/release/status` : 查看灰度/回滚运行时配置


### 本地知识库 (RAG MVP)

- 种子数据文件：`knowledge/processed/chunks.jsonl`
- 通过 `KNOWLEDGE_FILE` 和 `RAG_TOP_K` 配置


### 验证器 + MCP 增强

`POST /api/plan` 响应现在包含：
- `verifierWarnings`: 轻量级日程检查（如 POI 不足/重复序号）
- POI 项目的 MCP 增强字段（`weather_*`、`transit_hint`、`source`、`confidence`）


### 发布与成本控制

在 `server/config.json` 中配置：
- `rollout.enableCanary`
- `rollout.canaryPercent`
- `rollout.primaryProvider` / `rollout.canaryProvider`
- `rollout.autoRollbackOnFailure`
- `performance.cacheTtlMs`
- `performance.costAlertThreshold`

你也可以在请求 payload 中设置 `modelType` 为 `auto` 来使用后端灰度策略。


### 地图点回退行为

如果提供商只返回社交推荐而没有 `location` 工具调用，后端将从社交推荐合成最小地图点，以保持地图/导出/历史功能可用。追踪键：`fallback:<provider>:social_to_location:*`。


### 多轮工具调用支持

后端现在支持对原生不支持的提供商（DeepSeek、智谱、DashScope）实现多轮工具调用。

**工作原理：**
- Gemini：SDK 原生自动处理多轮
- 其他提供商：后端实现循环（最多 10 轮）
  1. 发送带工具的请求
  2. 模型返回工具调用
  3. 后端执行工具并返回结果
  4. 模型继续下一次工具调用
  5. 重复直到没有更多工具调用

**支持的工具：**
- `get_social_recommendations`：获取城市的社交媒体推荐
- `location`：添加带坐标、时间、交通提示的地图点

追踪键：`tool_round:N:start`、`tool_round:N:completed:N_calls`、`tool:${provider}:location:executed`、`tool:${provider}:get_social_recommendations:executed`


### 支持的 AI 提供商

| 提供商 | 模型 | 多轮支持 | 备注 |
|--------|------|---------|------|
| Gemini | gemini-2.5-flash | 原生 | 自动工具调用 |
| DeepSeek | deepseek-chat | 多轮 | 需要后端循环 |
| 智谱 | glm-4-flash | 多轮 | 自定义响应格式 |
| DashScope | qwen-plus | 多轮 | 需要后端循环 |


### MCP 工具集成

后端集成了 MCP（模型上下文协议）工具以增强功能：

**MCP 模块 (`server/modules/`)：**
- `tool-handler.mjs`：解析模型响应中的工具调用
- `mcp-enhancements.mjs`：用 MCP 数据丰富行程
- `post-processor.mjs`：城市验证、日期对齐、回退合成
- `normalizer.mjs`：标准化位置和推荐格式
- `verifier.mjs`：验证行程完整性

**MCP 工具 (`mcp-tools/`)：**
- `tools.js`：工具定义
- `dispatcher.js`：将工具调用路由到实现
- `implementations.js`：实际工具实现


### 最近更新 (opencode-tra 分支)

- 为 DeepSeek/智谱/DashScope 添加多轮工具调用支持
- 修复智谱响应格式解析（`response` vs `choices[0].message`）
- 添加 `message.reasoning_content` 备用
- 修复 `handleBatchMcpInvocations` 参数格式
- 添加 MCP 工具模块集成
- 改进追踪日志以便调试工具执行
