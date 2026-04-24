# 微信小程序配置说明

## 重要提示

### 1. 网络请求配置

微信小程序的网络请求**不经过Vite代理**，需要直接配置后端服务器地址。

#### 开发环境配置

在微信开发者工具中，需要进行以下设置：

1. **关闭域名校验**（仅开发环境）
   - 打开微信开发者工具
   - 点击"详情" → "本地设置"
   - 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"

2. **配置后端地址**
   
   修改 `src/utils/request.js` 中的 `BASE_URL`：
   ```javascript
   // 开发环境 - 使用本地IP（微信小程序需要使用IP而非localhost）
   const BASE_URL = 'http://127.0.0.1:8787/api'
   
   // 或者使用局域网IP
   const BASE_URL = 'http://192.168.x.x:8787/api'
   ```

#### 生产环境配置

1. 在微信公众平台配置服务器域名：
   - 登录微信公众平台
   - 开发管理 → 开发设置 → 服务器域名
   - 添加你的后端服务器域名（必须HTTPS）

2. 修改 `src/utils/request.js`：
   ```javascript
   const BASE_URL = 'https://your-domain.com/api'
   ```

### 2. 后端CORS配置

后端已配置CORS支持，允许跨域请求：
```javascript
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Headers': 'Content-Type,X-RequestId'
'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
```

### 3. 常见问题排查

#### 问题1: timeout 错误
**原因**: 
- 后端服务未启动
- 地址配置错误
- 网络不通

**解决方案**:
1. 确认后端服务已启动：访问 `http://127.0.0.1:8787/healthz`
2. 检查 `BASE_URL` 配置是否正确
3. 确认关闭了域名校验（开发环境）

#### 问题2: createPlan is not a function
**原因**: 动态导入问题

**解决方案**: 已修复，使用静态导入方式

#### 问题3: request:fail url not in domain list
**原因**: 小程序域名未配置

**解决方案**: 
- 开发环境：关闭域名校验
- 生产环境：在微信公众平台配置域名

## 快速启动步骤

### 步骤1: 启动后端服务
```bash
# 在项目根目录
npm run dev:server
```
确认看到：`AI Travel Butler backend running on http://localhost:8787`

### 步骤2: 更新BASE_URL
编辑 `src/utils/request.js`，修改为：
```javascript
const BASE_URL = 'http://127.0.0.1:8787/api'
```

### 步骤3: 编译微信小程序
```bash
cd uni-app-travel
npm run dev:mp-weixin
```

### 步骤4: 微信开发者工具
1. 打开微信开发者工具
2. 导入项目，选择 `uni-app-travel/dist/dev/mp-weixin` 目录
3. 在"详情" → "本地设置"中勾选"不校验合法域名..."
4. 运行并测试

## API端点

后端提供的API端点：
- `POST /api/plan` - 创建行程
- `POST /api/plan/refine` - 优化行程
- `GET /api/frontend-config` - 获取前端配置
- `GET /healthz` - 健康检查

## 调试技巧

1. **查看网络请求**
   - 微信开发者工具 → 调试器 → Network
   - 查看请求的URL、状态码和响应

2. **查看Console日志**
   - 查看详细的错误信息
   - 检查API调用是否成功

3. **测试后端接口**
   ```bash
   curl -X POST http://127.0.0.1:8787/api/plan \
     -H "Content-Type: application/json" \
     -d '{"userInput":"北京三日游"}'
   ```
