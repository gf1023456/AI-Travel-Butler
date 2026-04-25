#!/bin/bash

# AI Travel Butler Docker 镜像导出脚本
# 导出到 /mnt/e/ai-travel/AI-Travel-Butler/python_server

set -e

OUTPUT_DIR="/mnt/e/ai-travel/AI-Travel-Butler/python_server"
IMAGE_NAME="ai-travel-butler"
IMAGE_TAG="latest"

echo "🚀 开始导出 AI Travel Butler Docker 镜像..."

# 检查镜像是否存在
if ! docker images | grep -q "^${IMAGE_NAME}"; then
    echo "🔨 镜像不存在，先构建..."
    docker-compose build
fi

# 保存镜像
echo "💾 保存镜像到 ${OUTPUT_DIR}/${IMAGE_NAME}.tar..."
docker save -o "${OUTPUT_DIR}/${IMAGE_NAME}.tar" "${IMAGE_NAME}:${IMAGE_TAG}"

# 压缩镜像
echo "📦 压缩镜像..."
gzip -f "${OUTPUT_DIR}/${IMAGE_NAME}.tar"

echo "✅ 导出完成！"
echo ""
echo "镜像文件: ${OUTPUT_DIR}/${IMAGE_NAME}.tar.gz"
echo ""
echo "导入镜像命令:"
echo "  docker load -i ${IMAGE_NAME}.tar.gz"
echo ""
echo "文件大小:"
ls -lh "${OUTPUT_DIR}/${IMAGE_NAME}.tar.gz"