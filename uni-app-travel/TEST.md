# 快速测试脚本

## 测试1: 验证后端服务

```bash
# 测试健康检查
curl http://127.0.0.1:8787/healthz

# 期望输出:
# {"ok":true,"service":"ai-travel-butler-server","city":"xian"}
```

## 测试2: 测试API接口

```bash
# 测试创建行程接口
curl -X POST http://127.0.0.1:8787/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "北京三日游",
    "travelMode": "休闲"
  }'

# 期望输出: 返回行程JSON数据
```

## 测试3: 检查端口是否被占用

```bash
# Windows PowerShell
netstat -ano | findstr :8787

# 如果看到LISTENING，说明后端已启动
```

## 测试4: 微信小程序网络测试

在微信开发者工具的Console中执行：

```javascript
// 测试后端连接
uni.request({
  url: 'http://127.0.0.1:8787/healthz',
  success: (res) => {
    console.log('后端连接成功:', res.data)
  },
  fail: (err) => {
    console.error('后端连接失败:', err)
  }
})
```

## 完整测试流程

### 步骤1: 启动后端
```bash
cd e:\ai-travel\AI-Travel-Butler
npm run dev:server
```

等待看到：`AI Travel Butler backend running on http://localhost:8787`

### 步骤2: 验证后端
```bash
curl http://127.0.0.1:8787/healthz
```

### 步骤3: 编译小程序
```bash
cd uni-app-travel
npm run dev:mp-weixin
```

### 步骤4: 微信开发者工具
1. 打开微信开发者工具
2. 导入 `uni-app-travel/dist/dev/mp-weixin`
3. 勾选"不校验合法域名"
4. 测试创建行程功能

### 步骤5: 验证功能
- [ ] 首页能正常显示
- [ ] 可以输入目的地和天数
- [ ] 点击"生成行程"按钮
- [ ] 显示加载状态
- [ ] 成功跳转到行程详情页
- [ ] 行程内容正常显示

## 预期结果

✅ 后端服务启动成功  
✅ API接口正常响应  
✅ 小程序页面正常显示  
✅ 创建行程功能正常工作  
✅ 无timeout错误  
✅ 无function not found错误  

## 如果测试失败

参考 `TROUBLESHOOTING.md` 文档进行排查。
