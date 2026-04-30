#!/bin/bash
# AI Travel Butler - 模拟登录测试

# 测试1: 健康检查
echo "=== 测试1: 健康检查 ==="
curl -s http://localhost:8787/healthz | jq .

# 测试2: 模拟微信登录 (直接用openid测试)
echo ""
echo "=== 测试2: 模拟登录测试 ==="
echo "注意: 需要配置 WECHAT_APPID 和 WECHAT_SECRET 才能测试真实微信登录"

# 测试3: 检查配额接口 (需要先登录)
echo ""
echo "=== 测试3: 模拟配额检查 ==="
# 需要先有token才能测试，这里只是示例
echo "curl http://localhost:8787/api/quota -H 'Authorization: Bearer <token>'"

# 测试4: 生成行程 (需要先登录)
echo ""
echo "=== 测试4: 生成行程 (需要先登录获取token) ==="
echo "curl -X POST http://localhost:8787/api/plan \\"
echo "  -H 'Authorization: Bearer <token>' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"userInput\": \"去成都三天\", \"modelType\": \"auto\"}'"