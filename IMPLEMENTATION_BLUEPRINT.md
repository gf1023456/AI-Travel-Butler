# AI Travel Butler 实施草图（知识库 / MCP / RAG）

## 1. 目标定义
将当前项目从“单次行程生成器”升级为“可持续演进的旅行智能体平台”。

**北极星输出：**
- 结构化行程（可校验 JSON）
- 地图可视化路线
- 每条推荐附带证据来源（RAG/MCP）
- 支持约束优化（预算、时间、出行方式、营业时间）

---

## 2. 分层架构草图

### 2.1 Frontend（现有）
保留当前 Vite + TypeScript + Leaflet 前端。

新增 UI 面板建议：
- 数据来源开关：`仅模型 / 模型+知识库 / 模型+知识库+实时API`
- 规划约束：预算、每日步行上限、兴趣权重（美食/摄影/亲子）
- 证据展示：每个推荐点显示来源与时间戳

### 2.2 Orchestrator（新增后端）
新增 `server/` 服务，统一处理：
1. 请求路由（Gemini / DeepSeek / GLM）
2. RAG 检索与重排
3. MCP 工具调用调度
4. 约束校验与修复
5. 结构化响应给前端

### 2.3 Knowledge Layer（新增）
- 结构化库：景点、交通、营业时间、价格区间
- 非结构化库：攻略、点评、FAQ、本地文档
- 向量库：语义召回（RAG）

### 2.4 Tool Layer（MCP）
以 MCP 方式接入：
- Geo（地理编码）
- Route（路径耗时）
- Weather（天气）
- POI（景点详情）
- Pricing（酒店/门票，后续）

---

## 3. 目录结构建议

```txt
AI-Travel-Butler/
  index.tsx
  mcp-tools.ts
  IMPLEMENTATION_BLUEPRINT.md
  server/
    src/
      app.ts
      routes/
        plan.ts
      orchestrator/
        planner.ts
        verifier.ts
        narrator.ts
      rag/
        retrieve.ts
        rerank.ts
        citations.ts
      mcp/
        client.ts
        tools/
          geo.ts
          route.ts
          weather.ts
      schemas/
        trip-request.ts
        trip-plan.ts
        evidence.ts
      storage/
        vector-store.ts
        poi-repo.ts
    package.json
  knowledge/
    raw/
      chengdu.md
      chongqing.md
    processed/
      chunks.jsonl
```

---

## 4. 核心数据模型（先定义再开发）

### 4.1 TripRequest
- origin / destination
- date_range
- travelers（成人/儿童）
- budget_level
- travel_style
- constraints（步行上限、作息、忌口、无障碍）

### 4.2 PoiCandidate
- id, name, city
- lat, lng
- tags
- open_hours
- estimated_cost
- source, source_timestamp
- confidence

### 4.3 DayPlan
- day
- items[]（含 sequence/time/transit_hint）
- daily_cost_estimate
- total_transit_time

### 4.4 EvidenceItem
- claim（推荐结论）
- source（文档 / MCP 工具）
- snippet
- fetched_at

---

## 5. RAG 实施路线

### Phase A（MVP）
1. 选 1~3 个城市做本地知识库
2. 文档切片 + embedding + 向量检索
3. 将 top-k 检索结果注入规划 prompt
4. 输出中带 citations

### Phase B（增强）
- 混合检索：BM25 + 向量
- reranker 精排
- 地名歧义消解（实体解析）

### Phase C（约束感知）
- 检索过滤：营业时间、预算、距离、天气适配
- 对候选点打 feasibility score

---

## 6. MCP 接入优先级

1. **Geo**：地理编码/逆地理编码
2. **Route**：多点路径与耗时
3. **Weather**：逐小时天气
4. **POI**：门票、拥挤度、开放信息
5. **Pricing**（后续）

**统一要求：**
- 每个工具返回 `source/timestamp/confidence`
- 失败可降级（fallback）
- 调用链路可追踪（execution log）

---

## 7. Agent 拆分建议

### Planner Agent
产出“候选行程骨架”（按天 + 时段 + 地点）

### Verifier Agent
校验冲突：
- 时间冲突
- 地理不合理绕路
- 营业时间不匹配
- 预算超标

### Narrator Agent
生成面向用户的解释文本：
- 为什么这么排
- 备选方案
- 风险提示（天气/排队）

---

## 8. 接口草案

### `POST /api/plan`
输入：`TripRequest`
输出：
- `summary`
- `days[]`
- `map_points[]`
- `social_recommendations[]`
- `evidence[]`
- `execution_log_id`

### `POST /api/plan/refine`
输入：
- 原计划 ID
- 新约束（如“预算降到 1000”）
输出：更新后的计划 diff

---

## 9. 可观测性与评测

### 9.1 观测指标
- 模型 token 消耗
- 工具调用成功率/时延
- 检索命中率
- 用户采纳率（保存/导出/分享）

### 9.2 评测集
至少准备 50 条任务：
- 单城市一日游
- 跨城市多日游
- 特殊约束（亲子/雨天/低预算）

关键指标：
- 可执行性
- 推荐准确度
- 路线合理性
- 证据覆盖率

---

## 10. 12 周里程碑

### W1-W2
- 新建后端 orchestrator
- 前端改为统一 `/api/plan`

### W3-W4
- 最小 RAG 上线（1~3 城市）
- 结果附证据

### W5-W6
- 接入 Geo + Route + Weather MCP
- 完成调用日志

### W7-W8
- 约束校验器（时间/预算/营业）
- 自动修复冲突

### W9-W10
- 评测集与自动评测脚本
- 提升稳定性与准确率

### W11-W12
- 灰度发布 + 回滚方案
- 指标告警与成本优化

---

## 11. 当下最小可执行动作（Next Step）

1. 新建 `server/`，先实现 `POST /api/plan` 空壳
2. 把前端模型调用迁移到后端
3. 接入一个最小向量检索（仅 1 城市文档）
4. 给每条推荐增加 `source` 字段

完成以上四步后，项目就具备“可扩展到 MCP + RAG + 多智能体”的稳定地基。
