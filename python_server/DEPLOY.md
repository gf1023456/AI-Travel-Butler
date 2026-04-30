# AI Travel Butler - Docker 部署指南

## 服务器环境要求

- Docker 20.10+
- Docker Compose v2+
- PostgreSQL 14+（已安装在服务器上）

## 数据库信息

| 项目 | 值 |
|------|-----|
| 主机 | localhost |
| 端口 | 5432 |
| 用户名 | postgres |
| 密码 | postgres123 |
| 数据库 | ai_travel_butler |

## 部署步骤

### 1. 上传代码到服务器

```bash
# 方式一：使用 scp
scp -r python_server/ user@server:/opt/ai-travel-butler/

# 方式二：使用 git
git clone <your-repo> /opt/ai-travel-butler
cd /opt/ai-travel-butler/python_server
```

### 2. 确保 PostgreSQL 数据库已创建

```bash
# SSH 登录服务器
ssh user@server

# 创建数据库
sudo -u postgres createdb ai_travel_butler

# 初始化数据库表
cd /opt/ai-travel-butler/python_server
psql -U postgres -d ai_travel_butler -f database/schema.sql
```

### 3. 构建 Docker 镜像

```bash
cd /opt/ai-travel-butler/python_server
chmod +x build.sh
./build.sh
```

或者手动构建：

```bash
docker build -t ai-travel-butler:latest .
```

### 4. 启动服务

```bash
docker compose up -d
```

### 5. 验证服务

```bash
# 查看日志
docker compose logs -f

# 健康检查
curl http://localhost:8787/healthz

# 查看 API 文档
# http://localhost:8787/docs
```

## 常用命令

```bash
# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f ai-travel-butler

# 更新镜像
docker compose down
docker build -t ai-travel-butler:latest .
docker compose up -d

# 进入容器
docker exec -it ai-travel-butler bash
```

## 端口说明

| 端口 | 用途 |
|------|------|
| 8787 | FastAPI 服务端口（对外） |
| 5432 | PostgreSQL 数据库（容器内通过 host.docker.internal 访问） |

## 配置文件

- `.env` - 环境变量配置（数据库连接、API Key 等）
- `config/server.json` - 服务配置
- `docker-compose.yml` - Docker Compose 配置
- `Dockerfile` - 镜像构建配置

## 注意事项

1. **数据库连接**：容器内通过 `host.docker.internal` 访问宿主机的 PostgreSQL
2. **防火墙**：确保服务器防火墙开放 8787 端口
3. **数据安全**：生产环境请修改 `.env` 中的默认密码和 API Key
4. **日志查看**：服务日志通过 `docker compose logs` 查看
