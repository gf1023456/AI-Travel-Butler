#!/bin/bash
# AI Travel Butler - 数据库初始化脚本

set -e

echo "=========================================="
echo "  AI Travel Butler - Database Setup"
echo "=========================================="

# 加载环境变量
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# 数据库配置
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASS=${DB_PASS:-147258}
DB_NAME=${DB_NAME:-ai_travel_butler}

echo "数据库: $DB_NAME@$DB_HOST:$DB_PORT"

# 创建数据库
echo "1. 创建数据库..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"

# 执行SQL脚本
echo "2. 创建表结构..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/schema.sql

echo ""
echo "=========================================="
echo "  数据库初始化完成!"
echo "=========================================="
echo "表:"
echo "  - users (用户表)"
echo "  - user_sessions (会话表)"
echo "  - travel_plans (行程记录表)"
echo "  - user_feedback (用户反馈表)"
echo "  - system_configs (系统配置表)"