# AI Travel Butler Docker 部署指南

## 🚀 一键部署

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置，填入你的 API Key
vim .env
```

**必填项**：
- `GEMINI_API_KEY` - Gemini API Key（推荐，免费额度大）
- `DEEPSEEK_API_KEY` - DeepSeek API Key
- `ZHIPU_API_KEY` - 智谱 API Key
- `DASHSCOPE_API_KEY` - 阿里云 DashScope API Key

### 2. 启动服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 3. 访问服务

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8787

---

## 🔒 配置安全说明

### ✅ 不会暴露的配置

| 配置项 | 存储位置 | 安全性 |
|--------|----------|--------|
| API Key | Docker 环境变量 | ✅ 不在文件中 |
| 配置文件 | 容器内部 | ✅ 外部无法访问 |

### ⚠️ 注意事项

- **不要把 .env 文件上传到 Git**
- **不要把 API Key 写在 docker-compose.yml 里**
- **生产环境建议用 Docker Secrets**

---

## 🌐 Nginx 代理配置

如果需要通过域名访问，参考 `nginx.conf.example`：

```nginx
location /aiTraver/ {
    proxy_pass http://127.0.0.1:8787/;
    ...
}
```

---

## 🔧 环境变量完整列表

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `GEMINI_API_KEY` | Gemini API Key | 推荐 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 可选 |
| `ZHIPU_API_KEY` | 智谱 API Key | 可选 |
| `DASHSCOPE_API_KEY` | 阿里云 DashScope | 可选 |
| `BACKEND_URL` | 后端访问地址 | 可选 |
| `TDT_API_KEY` | 天地图 Key | 可选 |

---

## 📝 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```