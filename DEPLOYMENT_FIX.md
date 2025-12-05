# 部署错误修复指南

## 问题描述

在服务器部署后出现错误：
```
TypeError: undefined is not an object (evaluating 'q.Activity=B')
```

这是由于 `lucide-react` 图标库在生产环境中的加载顺序问题导致的。

## 解决方案

### 方案 1: 重新构建（推荐）

1. **更新 vite.config.ts**（已完成）
   - 添加更严格的 esbuild 配置
   - 确保 JSX 自动转换
   - 设置正确的 base 路径

2. **重新构建前端**
```bash
cd /opt/serdo  # 或你的项目路径

# 清理旧的构建产物
rm -rf dist/

# 重新安装依赖（可选，确保依赖正确）
npm install

# 重新构建
npm run build
```

3. **验证构建产物**
```bash
# 检查 dist 目录
ls -lh dist/assets/

# 应该看到类似这样的文件：
# vendor-react-*.js
# vendor-icons-*.js  (这个包含 lucide-react)
# vendor-others-*.js
# index-*.js
```

### 方案 2: 检查 Nginx 配置

确保 Nginx 正确配置了静态资源：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /opt/serdo/dist;
    index index.html;

    # 前端路由 - SPA 必需
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        
        # 重要：允许跨域加载（如果需要）
        add_header Access-Control-Allow-Origin "*";
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
```

### 方案 3: 检查环境变量

确保前端构建时使用了正确的环境变量：

**.env.production** (在项目根目录):
```env
VITE_USE_API=true
VITE_API_BASE_URL=/api/v1
```

如果是分域部署：
```env
VITE_USE_API=true
VITE_API_BASE_URL=https://api.your-domain.com/api/v1
```

### 方案 4: 浏览器缓存清理

如果重新构建后问题依然存在，清理浏览器缓存：

1. **Chrome/Edge**: Ctrl+Shift+Delete → 清除缓存和 Cookie
2. **Firefox**: Ctrl+Shift+Delete → 清除缓存
3. **Safari**: Command+Option+E

或者使用隐私/无痕模式测试。

## 完整部署步骤

### 1. 本地重新构建

```bash
# 在本地开发机器
cd /path/to/serdo

# 清理
rm -rf dist/

# 安装依赖
npm install

# 构建生产版本
npm run build

# 打包
bash scripts/release.sh
```

### 2. 上传到服务器

```bash
# 方式 1: 使用 scp
scp release/serdo-release-*.zip user@server:/tmp/

# 方式 2: 使用 rsync
rsync -avz --delete dist/ user@server:/opt/serdo/dist/
```

### 3. 服务器端操作

```bash
# SSH 登录服务器
ssh user@server

# 备份旧版本
cd /opt/serdo
mv dist dist.backup.$(date +%Y%m%d_%H%M%S)

# 解压新版本
unzip /tmp/serdo-release-*.zip
# 或如果使用 rsync，跳过此步骤

# 设置权限
chown -R www-data:www-data dist/
chmod -R 755 dist/

# 重启 Nginx（如果需要）
sudo systemctl restart nginx

# 清理 Nginx 缓存（如果配置了）
sudo rm -rf /var/cache/nginx/*
```

### 4. 验证部署

```bash
# 检查文件是否存在
ls -lh /opt/serdo/dist/assets/

# 测试静态文件访问
curl -I https://your-domain.com/assets/index-*.js

# 应该返回 200 OK
```

## 常见问题排查

### Q1: 依然报同样的错误

**A**: 清除所有缓存并硬刷新：
- Chrome: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
- 或者在 DevTools 打开时右键刷新按钮 → 清空缓存并硬性重新加载

### Q2: 某些图标不显示

**A**: 检查浏览器控制台，可能是：
1. 网络请求失败 - 检查 Network 标签
2. CORS 问题 - 检查 Console 是否有 CORS 错误
3. 路径问题 - 确认 `base: '/'` 在 vite.config.ts 中正确设置

### Q3: 只在生产环境出错，本地正常

**A**: 这通常是构建配置或服务器配置问题：
1. 检查生产构建是否成功完成
2. 对比本地和服务器的 dist/ 目录内容
3. 检查服务器的 Node.js 版本是否 >= 18
4. 确认 Nginx 配置中的 root 路径正确

## 预防措施

### 1. 使用 CI/CD

建议使用 GitHub Actions 自动构建和部署：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Server

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          source: "dist/*"
          target: "/opt/serdo/"
```

### 2. 本地测试生产构建

在本地测试生产构建：

```bash
# 构建
npm run build

# 预览（使用 Vite 预览服务器）
npm run preview

# 或使用 serve
npx serve dist
```

### 3. 版本控制

在部署时记录版本信息：

```bash
# 在 dist/ 目录创建版本文件
echo "Build: $(date)" > dist/VERSION.txt
echo "Commit: $(git rev-parse --short HEAD)" >> dist/VERSION.txt
```

## 联系支持

如果问题依然存在，请提供：
1. 浏览器控制台完整错误信息
2. Network 标签中失败的请求
3. 服务器 Nginx 错误日志: `tail -100 /var/log/nginx/error.log`
4. 构建输出: `npm run build` 的完整输出
5. dist/ 目录结构: `ls -lR dist/`

---

**最后更新**: 2024-12-05  
**状态**: 已修复 vite.config.ts 配置
