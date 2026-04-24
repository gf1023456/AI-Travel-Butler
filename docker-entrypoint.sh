#!/bin/sh
# Docker 启动入口脚本

cd /app

# 创建配置文件目录
mkdir -p server

# 生成后端配置文件（使用 printf 避免 sed 问题）
cat > server/config.json << EOF
{
  "server": {
    "port": 8787,
    "requestTimeoutMs": 20000,
    "maxRetries": 2
  },
  "rag": {
    "topK": 5,
    "knowledgeFile": "knowledge/processed/chunks.jsonl"
  },
  "rollout": {
    "enableCanary": false,
    "canaryPercent": 10,
    "primaryProvider": "gemini",
    "canaryProvider": "dashscope",
    "autoRollbackOnFailure": true
  },
  "performance": {
    "cacheTtlMs": 120000,
    "costAlertThreshold": 2
  },
  "external_apis": {
    "amapApiKey": "${AMAP_API_KEY:-}",
    "weatherApiKey": "${WEATHER_API_KEY:-}"
  },
  "providers": {
    "geminiApiKey": "${GEMINI_API_KEY:-}",
    "deepseekApiKey": "${DEEPSEEK_API_KEY:-}",
    "zhipuApiKey": "${ZHIPU_API_KEY:-}",
    "dashscopeApiKey": "${DASHSCOPE_API_KEY:-}",
    "defaultGeminiModel": "gemini-2.5-flash",
    "defaultDeepseekModel": "deepseek-chat",
    "defaultZhipuModel": "glm-4-flash",
    "defaultDashscopeModel": "qwen3.5-plus"
  }
}
EOF

# 生成前端配置文件
cat > server/frontend.config.json << EOF
{
  "backendUrl": "${BACKEND_URL:-http://localhost:8787}",
  "tdtApiKey": "${TDT_API_KEY:-97f9870fb795ba80ef201d6edae71d73}",
  "mapCenter": [30.5728, 104.0668],
  "mapZoom": 12,
  "defaultMapType": "tdt_vec"
}
EOF

echo "📝 配置已生成"
echo "   GEMINI_API_KEY: ${GEMINI_API_KEY:-未设置}"
echo "   DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-未设置}"
echo "   ZHIPU_API_KEY: ${ZHIPU_API_KEY:-未设置}"
echo "   DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:-未设置}"

echo "🚀 启动后端服务..."
node server/app.mjs &
BACKEND_PID=$!

sleep 2

echo "🌐 启动前端服务..."
npx vite preview --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动！"
echo "   后端: http://localhost:8787"
echo "   前端: http://localhost:3000"

# 保持容器运行
wait