FROM node:20-alpine

WORKDIR /app

# 安装依赖（包含 vite 用于 preview）
COPY package*.json ./
RUN npm install

# 构建前端
COPY index.html index.tsx index.css auth.ts auth.css ./
COPY vite.config.ts tsconfig.json ./
RUN npm run build

# 复制应用文件
COPY server/ ./server/
COPY mcp-tools/ ./mcp-tools/
COPY knowledge/ ./knowledge/

# 复制前端配置模板
COPY server/frontend.config.json ./server/

# 创建空配置文件（用户通过环境变量注入 API Key）
RUN echo '{"providers":{"geminiApiKey":"","deepseekApiKey":"","zhipuApiKey":"","dashscopeApiKey":""}}' > server/config.json

EXPOSE 8787 3000

# 启动脚本
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]