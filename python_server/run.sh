#!/bin/bash
# AI Travel Butler - 本地运行脚本

set -e

echo "=========================================="
echo "  AI Travel Butler - Local Dev Server"
echo "=========================================="

# 加载环境变量
if [ -f .env ]; then
    echo "Loading .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# 检查 Python 依赖
if ! pip show fastapi > /dev/null 2>&1; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# 启动服务
echo "Starting server on port ${PORT:-8787}..."
python -m uvicorn python_server.app:app --host 0.0.0.0 --port ${PORT:-8787} --reload

echo "Server stopped."