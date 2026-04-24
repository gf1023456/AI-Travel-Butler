# 前端配置说明

## 📋 配置文件位置

所有后端服务配置统一在 `src/config/index.js` 文件中管理。

## 🔧 配置项说明

### API_CONFIG - 后端服务配置

| 配置项 | 说明 | 开发环境值 | 生产环境值 |
|--------|------|-----------|-----------|
| `BASE_URL` | 后端API基础地址 | `http://127.0.0.1:8787/api` | `https://your-domain.com/api` |
| `PORT` | 后端端口号 | `8787` | `8787` |
| `TIMEOUT.NORMAL` | 普通请求超时 | `60000ms` (60秒) | `60000ms` |
| `TIMEOUT.AI_GENERATE` | AI生成请求超时 | `180000ms` (180秒) | `180000ms` |
| `RETRY.MAX_RETRIES` | 最大重试次数 | `3` | `3` |
| `RETRY.RETRY_DELAY` | 重试延迟 | `1000ms` | `1000ms` |

### APP_CONFIG - 业务配置

| 配置项 | 说明 | 值 |
|--------|------|-----|
| `NAME` | 应用名称 | `AI Travel Pro` |
| `VERSION` | 应用版本 | `1.0.0` |
| `MAX_HISTORY` | 最大历史记录数 | `30` |
| `SHARE_QUOTA_BONUS` | 分享配额奖励 | `3` |
| `MAX_INPUT_LENGTH` | 输入框最大字符数 | `500` |

## 📝 使用方法

### 在代码中导入配置

```javascript
// 导入完整配置
import config from '@/config/index.js'

// 或导入特定配置
import { API_CONFIG, APP_CONFIG } from '@/config/index.js'

// 使用配置
const baseURL = API_CONFIG.BASE_URL
const timeout = API_CONFIG.TIMEOUT.AI_GENERATE
```

### 在文件中的应用示例

**request.js**
```javascript
import { API_CONFIG } from '@/config/index.js'

const BASE_URL = API_CONFIG.BASE_URL
const TIMEOUT = API_CONFIG.TIMEOUT.NORMAL
```

**API文件**
```javascript
import { API_CONFIG } from '@/config/index.js'

export const getUserInfo = () => {
  return get(`${API_CONFIG.BASE_URL}/userInfo`, {})
}
```

## 🌍 环境切换

配置文件会根据 `process.env.NODE_ENV` 自动切换环境：

- **开发环境** (`NODE_ENV=development`)
  - 使用本地后端地址：`http://127.0.0.1:8787/api`
  
- **生产环境** (`NODE_ENV=production`)
  - 使用HTTPS域名：`https://your-domain.com/api`
  - ⚠️ 部署前必须修改为实际域名

## ⚠️ 注意事项

1. **禁止硬编码**：不要在代码中直接写后端地址，必须从配置文件导入
2. **生产部署**：部署前必须修改 `BASE_URL` 为实际的HTTPS域名
3. **端口修改**：如后端端口变更，只需修改 `PORT` 和 `BASE_URL` 中的端口号
4. **超时调整**：AI生成类请求超时建议不低于180秒
5. **单一数据源**：所有配置以 `src/config/index.js` 为准

## 🚀 快速修改示例

### 修改后端端口

假设后端端口从 8787 改为 9000：

```javascript
// src/config/index.js
export const API_CONFIG = {
  BASE_URL: isDevelopment 
    ? 'http://127.0.0.1:9000/api'  // 修改这里
    : 'https://your-domain.com/api',
  
  PORT: 9000,  // 修改这里
  
  // ... 其他配置
}
```

修改一处即可，所有引用该配置的文件会自动生效！

## 📁 相关文件

- `src/config/index.js` - 配置文件（唯一需要修改的地方）
- `src/utils/request.js` - 请求工具（自动使用配置）
- `src/api/*.js` - API接口（自动使用配置）
- `src/store/*.js` - 状态管理（自动使用配置）
