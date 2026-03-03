# AI-Travel-Butler 使用文档（验证版）

> 这份文档用于你快速验证当前版本：后端编排、RAG 检索、Verifier、灰度发布、回滚、告警与指标能力。

---

## 1. 环境准备

### 1.1 Node 版本
建议 Node.js 18+（推荐 20+）。

### 1.2 安装依赖
```bash
npm install
```

---

## 2. 配置环境变量（后端）

在启动后端前，至少配置一个可用 Provider Key。

### 2.1 必填（至少一组）
- Gemini: `GEMINI_API_KEY`（或 `API_KEY`）
- DeepSeek: `DEEPSEEK_API_KEY`
- Zhipu: `ZHIPU_API_KEY`

### 2.2 可选（运行时控制）
- `REQUEST_TIMEOUT_MS`：请求超时（默认 `20000`）
- `MAX_RETRIES`：重试次数（默认 `2`）
- `RAG_TOP_K`：知识检索返回条数（默认 `3`）
- `KNOWLEDGE_FILE`：知识库文件路径（默认 `knowledge/processed/chunks.jsonl`）

### 2.3 发布/成本控制（W11-W12）
- `ENABLE_CANARY`：是否启用灰度（`1` 开启）
- `CANARY_PERCENT`：灰度流量比例（默认 `10`）
- `PRIMARY_PROVIDER`：主 Provider（默认 `gemini`）
- `CANARY_PROVIDER`：灰度 Provider（默认 `zhipu`）
- `AUTO_ROLLBACK_ON_FAILURE`：灰度失败自动回滚（默认开启）
- `CACHE_TTL_MS`：响应缓存 TTL（默认 `120000`）
- `COST_ALERT_THRESHOLD`：估算成本阈值（默认 `2` USD）

---

## 3. 启动方式

### 3.1 启动后端
```bash
npm run dev:server
```
默认监听：`http://localhost:8787`

### 3.2 启动前端（新终端）
```bash
npm run dev
```
默认前端会请求：`http://localhost:8787/api/plan`

---

## 4. HTTP 接口验证清单

## 4.1 健康检查
```bash
curl -sS http://localhost:8787/healthz
```
预期：返回 `ok: true`。

## 4.2 知识检索（RAG）
```bash
curl -sS "http://localhost:8787/api/knowledge/search?q=西安 夜景"
```
预期：返回 `evidence[]`，包含 snippet/source/chunk_id。

## 4.3 生成方案
```bash
curl -sS -X POST http://localhost:8787/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "西安两日游，偏夜景和美食",
    "modelType": "auto",
    "isPlannerMode": true,
    "travelMode": "deep"
  }'
```
预期：返回字段包含：
- `dayPlanItinerary`
- `socialRecommendations`
- `evidence`
- `verifierWarnings`
- `mcpTrace`
- `execution_log_id`

## 4.4 方案微调（refine）
```bash
curl -sS -X POST http://localhost:8787/api/plan/refine \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "西安两日游",
    "modelType": "auto",
    "refineInstruction": "预算降到1500，并增加夜景",
    "basePlan": {"itinerarySummary": "初版摘要"}
  }'
```

## 4.5 指标查看
```bash
curl -sS http://localhost:8787/api/metrics
```
预期可见：
- `totalRequests/planRequests/refineRequests/failedRequests`
- `providerCounts`
- `cacheHits/totalEstimatedCost`
- `executionLogSize/cacheSize/alertCount`

## 4.6 告警查看
```bash
curl -sS http://localhost:8787/api/alerts
```
可观察：`rollout_rollback`、`cost_threshold` 等。

## 4.7 发布状态查看
```bash
curl -sS http://localhost:8787/api/release/status
```
可观察当前灰度/回滚配置是否生效。

## 4.8 执行日志查询
先从 `/api/plan` 响应里拿 `execution_log_id`，然后：
```bash
curl -sS http://localhost:8787/api/execution-log/<execution_log_id>
```

---

## 5. 前端验证要点

1. 设置页里 Provider Key 输入已移除，显示“后端统一管理”提示。
2. 生成后应能看到：
   - 行程综述
   - 热门打卡
   - `📚 证据引用`
   - `⚠️ Verifier 检查`（有冲突时）

---

## 6. 常见问题

### Q1: 返回 `Missing GEMINI_API_KEY on server`
说明后端缺少对应 Provider Key，请先设置环境变量后重启。

### Q2: `/api/plan` 400 报 `userInput is required`
请求体缺少 `userInput` 或 JSON 格式错误。

### Q3: RAG 没命中
检查：
- 查询词是否包含目的地关键词（如“西安 夜景”）
- `KNOWLEDGE_FILE` 是否存在且可读
- `RAG_TOP_K` 是否过小

---

## 7. 当前能力边界（便于你验收）

已支持：
- 后端统一模型编排
- RAG 检索与证据回传
- Verifier 轻量校验
- MCP 风格补全（天气/交通 fallback）
- 指标、执行日志、告警
- 灰度配置与失败自动回滚

仍建议后续增强：
- 持久化存储（当前 metrics/logs/cache 为内存）
- 自动评测脚本与基准任务集
- 更真实的路线/天气 MCP 实时接入

