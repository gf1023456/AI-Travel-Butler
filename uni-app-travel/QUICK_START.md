# 快速启动指南

## 前置条件

确保您的系统已安装：
- Node.js (推荐 v16+)
- npm 或 yarn

## 安装与运行步骤

### 第一步：安装依赖

```bash
cd uni-app-travel
npm install
```

### 第二步：启动后端服务

在新终端中，进入项目根目录并启动后端：

```bash
cd ..
npm install  # 如果还未安装过根目录依赖
npm run dev:server
```

后端服务将在 `http://localhost:3001` 启动

### 第三步：启动前端应用

回到uni-app目录，选择要运行的平台：

#### 选项1：H5端（推荐用于开发调试）
```bash
npm run dev:h5
```
访问：`http://localhost:3000`

#### 选项2：微信小程序
```bash
npm run dev:mp-weixin
```
然后用微信开发者工具打开生成的目录

#### 选项3：App端
```bash
npm run dev:app
```
需要使用HBuilderX或配置相应的开发环境

## 验证安装

1. 访问 `http://localhost:3000`
2. 您应该看到"AI旅行助手"的首页
3. 输入目的地（如"北京"）
4. 输入天数（如"3"）
5. 点击"生成行程"按钮
6. 如果后端配置正确，将生成行程并跳转

## 常见问题

### Q: 请求失败或404错误
**A**: 确保后端服务已启动并运行在3001端口

### Q: 端口冲突
**A**: 修改 `vite.config.ts` 中的 `server.port` 配置

### Q: npm install 失败
**A**: 尝试清除缓存后重试：
```bash
npm cache clean --force
npm install
```

### Q: 需要配置API密钥
**A**: 确保根目录的 `server/config.json` 已配置至少一个AI提供商的API密钥

## 生产构建

```bash
# H5端
npm run build:h5

# 微信小程序
npm run build:mp-weixin

# 构建产物在 dist/ 目录下
```

## 项目定制

### 修改API地址
编辑 `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://your-server-address:port',
      changeOrigin: true
    }
  }
}
```

### 修改主题色
编辑 `src/static/common.css` 中的CSS变量

### 添加新页面
1. 在 `src/pages/` 下创建新页面
2. 在 `src/pages.json` 中注册路由

## 技术支持

如有问题，请查看：
- README.md - 项目概述
- PROJECT_STRUCTURE.md - 详细项目结构
