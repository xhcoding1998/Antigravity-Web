# 🚀 部署指南

本文档介绍如何将 Antigravity Chat 部署到生产环境。

---

## 📋 部署前准备

### 1. 环境检查

确保你的服务器满足以下要求：

- **Node.js**: `^20.19.0` 或 `>=22.12.0`
- **包管理器**: npm / yarn / pnpm / bun
- **Web 服务器**: Nginx / Apache / Caddy（可选）

### 2. 构建项目

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build
```

构建完成后，`dist` 目录将包含所有静态文件。

---

## 🌐 部署方式

### 方案 1: 静态文件托管

#### Vercel (推荐)

1. 安装 Vercel CLI：
```bash
npm i -g vercel
```

2. 部署：
```bash
vercel
```

3. 按照提示完成配置即可。

#### Netlify

1. 创建 `netlify.toml`：
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. 连接 GitHub 仓库自动部署，或使用 CLI：
```bash
npm i -g netlify-cli
netlify deploy --prod
```

#### GitHub Pages

1. 修改 `vite.config.js`，添加 base 路径：
```javascript
export default defineConfig({
  base: '/your-repo-name/',
  // ...
})
```

2. 构建并推送到 `gh-pages` 分支：
```bash
npm run build
git subtree push --prefix dist origin gh-pages
```

---

### 方案 2: 自托管服务器

#### Nginx 配置

1. 上传 `dist` 目录到服务器：
```bash
scp -r dist/* user@your-server:/var/www/antigravity-chat/
```

2. 配置 Nginx（`/etc/nginx/sites-available/antigravity-chat`）：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/antigravity-chat;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

3. 启用站点并重启 Nginx：
```bash
sudo ln -s /etc/nginx/sites-available/antigravity-chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### HTTPS 配置（Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### 方案 3: Docker 部署

#### 创建 Dockerfile

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 创建 nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 构建和运行

```bash
# 构建镜像
docker build -t antigravity-chat .

# 运行容器
docker run -d -p 80:80 --name antigravity-chat antigravity-chat

# 使用 Docker Compose
docker-compose up -d
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
```

---

## ⚙️ 环境变量配置

由于 Antigravity Chat 使用浏览器端存储，所有配置都在客户端完成，不需要服务器端环境变量。

用户首次访问时需要在设置中配置：
- API Base URL
- API Key

这些信息会安全地存储在浏览器的 LocalStorage 中。

---

## 🔒 安全建议

### 1. HTTPS 强制

生产环境必须使用 HTTPS：

```nginx
# 重定向 HTTP 到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # ... 其他配置
}
```

### 2. 安全头部

添加安全相关的 HTTP 头：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;
```

### 3. 速率限制

防止 API 滥用：

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api {
    limit_req zone=api burst=20 nodelay;
    # ...
}
```

---

## 📊 性能优化

### 1. Gzip 压缩

确保启用了 Gzip 压缩（参见上面的 Nginx 配置）。

### 2. 缓存策略

静态资源设置长期缓存：
- JS/CSS/图片: 1 年
- HTML: 不缓存或短期缓存

### 3. CDN 加速

将静态资源上传到 CDN：

1. 修改 `vite.config.js`：
```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
```

2. 上传 `dist/assets` 到 CDN
3. 更新 HTML 中的资源路径

---

## 🔍 监控和日志

### 日志收集

使用 Nginx 日志收集访问信息：

```nginx
access_log /var/log/nginx/antigravity-chat-access.log combined;
error_log /var/log/nginx/antigravity-chat-error.log warn;
```

### 性能监控

推荐使用以下工具：
- **Google Analytics** - 用户行为分析
- **Sentry** - 错误追踪
- **Grafana + Prometheus** - 服务器性能监控

---

## 🆘 故障排查

### 问题 1: 页面空白

**原因**: Base URL 配置错误

**解决**:
```javascript
// vite.config.js
export default defineConfig({
  base: '/',  // 确保 base 设置正确
})
```

### 问题 2: 路由 404

**原因**: 服务器未配置 SPA 路由

**解决**: 参见上面的 Nginx 配置，添加 `try_files` 规则。

### 问题 3: API 跨域

**原因**: CORS 配置问题

**解决**: 在 API 服务器添加 CORS 头，或使用 Nginx 反向代理。

---

## 📞 获取帮助

如果遇到部署问题：

1. 查看 [GitHub Issues](https://github.com/yourusername/antigravity-web/issues)
2. 阅读 [常见问题](FAQ.md)
3. 提交新的 Issue

---

**祝部署顺利！🎉**
