# 项目状态文档

## 当前分支
- `opencode-tra`

## 最近修复的问题
1. 多轮工具调用支持 (DeepSeek/Zhipu/DashScope)
2. 智谱响应格式解析 (response vs choices[0].message)
3. handleBatchMcpInvocations 参数格式修复
4. DeepSeek 单引号 JSON 解析问题

## 待测试
- [x] DeepSeek 多轮工具调用
- [x] Zhipu 多轮工具调用
- [ ] DashScope 多轮工具调用

## 关键文件
- `server/app.mjs` - 主服务入口，包含多轮调用逻辑
- `server/modules/tool-handler.mjs` - 工具调用解析
- `server/modules/normalizer.mjs` - JSON 参数解析
- `mcp-tools/` - MCP 工具实现
- `README_zh.md` - 中文文档

## API Key 配置
需要配置 `server/config.json`:
- geminiApiKey
- deepseekApiKey
- zhipuApiKey
- dashscopeApiKey

## 运行命令
```bash
npm run dev:server  # 后端
npm run dev        # 前端
```

## 服务端口
- 后端: 8787
- 前端: 5173 (vite 默认)
