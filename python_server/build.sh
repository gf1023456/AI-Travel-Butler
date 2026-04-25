#!/bin/bash
# AI Travel Butler - Docker 镜像构建脚本

set -e

echo "========================================"
echo "  AI Travel Butler - Docker 构建"
echo "========================================"

# 进入脚本所在目录
cd "$(dirname "$0")"

# 构建镜像
echo ""
echo "📦 正在构建 Docker 镜像..."
docker build -t ai-travel-butler:latest .

echo ""
echo "✅ 镜像构建完成！"
echo ""
echo "📋 镜像信息："
docker images ai-travel-butler:latest

echo ""
echo "========================================"
echo "  部署说明"
echo "========================================"
echo ""
echo "1. 将 python_server 目录上传到服务器"
echo "2. 确保服务器上 PostgreSQL 已安装并创建数据库："
echo "   createdb -U postgres ai_travel_butler"
echo "3. 初始化数据库表（如有 schema.sql）："
echo "   psql -U postgres -d ai_travel_butler -f database/schema.sql"
echo "4. 启动服务："
echo "   docker compose up -d"
echo "5. 查看日志："
echo "   docker compose logs -f"
echo "6. 停止服务："
echo "   docker compose down"
echo ""
echo "服务地址：http://localhost:8787"
echo "健康检查：http://localhost:8787/healthz"
echo ""
