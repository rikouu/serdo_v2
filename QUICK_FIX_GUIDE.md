# 🚀 快速修复指南 - 密码异常问题

## 📋 问题症状

- ❌ 输入密码保存后，刷新页面变成空白
- ❌ 点击小眼睛查看密码，提示 "cannot reveal Password"
- ❌ 所有密码类字段无法正常显示

## ⚡ 快速修复（5分钟）

### 方案 A：自动修复（推荐）

```bash
# 1. 进入项目目录
cd /path/to/serdo

# 2. 给脚本执行权限
chmod +x scripts/fix-production-password.sh

# 3. 运行修复脚本
./scripts/fix-production-password.sh

# 脚本会自动:
# - 检查并设置 REDACT_MODE=true
# - 生成随机 JWT_SECRET
# - 重启后端服务
# - 提示后续操作步骤
```

### 方案 B：手动修复

#### 步骤 1: 配置后端环境变量

```bash
# 进入 API 目录
cd api

# 创建或编辑 .env 文件
nano .env

# 添加或修改以下配置
REDACT_MODE=true
JWT_SECRET=your-random-secret-here
PORT=4000
```

**生成随机 JWT_SECRET**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 步骤 2: 重启后端服务

**使用 PM2**:
```bash
pm2 restart serdo-api
```

**使用 systemd**:
```bash
sudo systemctl restart serdo-api
```

**直接运行**:
```bash
cd api
node server.js
```

#### 步骤 3: 重新构建前端

```bash
# 返回项目根目录
cd ..

# 重新构建
npm run build

# 构建产物在 dist/ 目录
```

#### 步骤 4: 用户操作

1. **清除浏览器缓存**
   - Chrome: `Ctrl + Shift + Delete`
   - 选择"清除缓存的图片和文件"
   - 点击"清除数据"

2. **重新登录**
   - 访问前端地址
   - 输入用户名密码登录

3. **重新输入密码**
   - 进入 Settings 页面
   - 点击密码字段的"显示"按钮
   - 会提示"无法解密密码"（这是正常的）
   - 重新输入密码
   - 点击 Save Changes

4. **测试**
   - 刷新页面（F5）
   - 再次点击"显示"按钮
   - ✅ 应该能正常显示密码

## 🔍 验证修复

### 检查 1: REDACT_MODE 配置

```bash
# 检查 .env 文件
cat api/.env | grep REDACT_MODE

# 应该显示:
# REDACT_MODE=true
```

### 检查 2: 后端日志

```bash
# systemd
sudo journalctl -u serdo-api -f

# PM2
pm2 logs serdo-api

# 查找包含 [wrapSecret] 的日志
# 正常情况下应该看到类似:
# [wrapSecret] 🔐 Encrypting: { plainLength: 10, ... }
# [wrapSecret] ✅ Encrypted successfully
```

### 检查 3: 前端控制台

1. 打开浏览器（F12 → Console）
2. 点击查看密码
3. 应该看到类似日志:
   ```
   🔑 [REVEAL] 使用已有密钥
   🔓 [Decrypt] 开始解密
   ✅ [Decrypt] 解密成功
   ```

## 🧪 诊断工具

### 使用 Web 诊断工具

1. 访问 `http://your-domain/debug-crypto.html`
2. 点击"运行完整诊断"
3. 查看诊断报告

### 使用命令行诊断

```bash
# 测试 API 是否运行
curl http://localhost:4000/api/v1/health

# 测试 reveal 端点（需要登录）
TOKEN="your-jwt-token"
REVEAL_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

curl -H "Authorization: Bearer $TOKEN" \
     -H "x-reveal-key: $REVEAL_KEY" \
     http://localhost:4000/api/v1/reveal/test
```

## ❓ 常见问题

### Q1: 修复后仍然无法查看密码

**可能原因**:
- 浏览器缓存未清除
- 后端未正确重启
- REDACT_MODE 未生效

**解决方法**:
```bash
# 1. 彻底清除浏览器缓存（不是硬刷新）
# 2. 检查后端环境变量
ps aux | grep node
cat /proc/<PID>/environ | tr '\0' '\n' | grep REDACT

# 3. 重启后端
sudo systemctl restart serdo-api

# 4. 检查日志
sudo journalctl -u serdo-api -n 50
```

### Q2: 提示"密钥不匹配"

**原因**: 
- 切换了 REDACT_MODE 后，旧密码使用旧加密方式
- 需要重新输入所有密码

**解决方法**:
- 这是正常现象
- 按照步骤 4 重新输入密码即可

### Q3: 关闭浏览器后无法查看密码

**原因**:
- `sessionStorage` 在关闭浏览器后会清除
- 这是安全特性，不是 bug

**解决方法**:
- 刷新页面（F5）：密码仍可查看 ✅
- 关闭浏览器：需要重新输入密码（安全特性）⚠️

### Q4: 多个标签页问题

**现象**:
- 在标签页 A 保存密码
- 在标签页 B 无法查看

**原因**:
- 每个标签页有独立的 `sessionStorage`

**解决方法**:
- 只在一个标签页操作
- 或者在标签页 B 刷新后重新输入密码

## 📦 生产环境部署

### 部署前检查清单

- [ ] `REDACT_MODE=true` 已设置
- [ ] `JWT_SECRET` 已修改为随机值
- [ ] 使用 HTTPS（必需！）
- [ ] 前端已重新构建（`npm run build`）
- [ ] 后端已重启
- [ ] 备份了数据目录

### systemd 服务配置

编辑 `/etc/systemd/system/serdo-api.service`:

```ini
[Unit]
Description=Serdo API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/serdo/api
Environment="NODE_ENV=production"
Environment="REDACT_MODE=true"
Environment="JWT_SECRET=your-random-secret-here"
Environment="PORT=4000"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

重新加载并启动:
```bash
sudo systemctl daemon-reload
sudo systemctl restart serdo-api
sudo systemctl status serdo-api
```

### Nginx 配置（可选）

```nginx
server {
    listen 443 ssl http2;
    server_name serdo.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 前端
    location / {
        root /var/www/serdo/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📞 获取帮助

### 文档

- **完整修复文档**: `PRODUCTION_PASSWORD_FIX.md`
- **诊断工具**: `public/debug-crypto.html`
- **环境配置**: `deploy/env.example`

### 日志位置

- **后端日志**: `sudo journalctl -u serdo-api -f`
- **审计日志**: `api/api/data/audit.log`
- **前端日志**: 浏览器控制台（F12）

### 联系方式

- GitHub Issues: [项目地址]
- 邮件: [联系邮箱]

---

**最后更新**: 2024-12-05  
**版本**: v1.2.0  
**测试状态**: ✅ 已验证

