#!/bin/bash
# AI Travel Butler 一键启动脚本

cd "$(dirname "$0")"

echo "🚀 启动 AI Travel Butler..."

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
fi

# 检查配置文件
if [ ! -f "server/config.json" ]; then
    echo "⚙️ 配置文件不存在，正在创建..."
    cp server/config.example.json server/config.json
    echo "⚠️ 请编辑 server/config.json 配置你的 API Key"
fi

# 构建前端（如果 dist 不存在）
if [ ! -d "dist" ]; then
    echo "🏗️ 正在构建前端..."
    npm run build
fi

# 启动后端
echo "🔧 启动后端服务 (端口 8787)..."
cd server && node app.mjs &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 2

# 启动前端
echo "🌐 启动前端服务 (端口 3000)..."
npm run preview &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动！"
echo "   后端: http://localhost:8787"
echo "   前端: http://localhost:3000"
echo ""
echo "📝 配置文件位置: server/config.json"
echo "   请确保已填写以下 API Key:"
echo "   - geminiApiKey"
echo "   - deepseekApiKey"
echo "   - zhipuApiKey"
echo "   - dashscopeApiKey"
echo ""
echo "🛑 停止服务: kill $BACKEND_PID $FRONTEND_PID"
echo ""

# 等待进程
wait