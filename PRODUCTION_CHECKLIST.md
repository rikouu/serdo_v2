# 🚀 Serdo 生产环境上线检查清单

## 📋 检查概览

本文档提供了将 Serdo 部署到生产环境前的完整检查清单。

---

## ✅ 安全性检查

### 1. 认证与授权
- [x] **JWT 认证**: 使用 HS256 算法，7天过期
- [x] **密码加密**: 使用 scrypt + salt 存储用户密码
- [x] **数据加密**: AES-256-GCM 加密敏感数据（密码、密钥等）
- [ ] **AUTH_SECRET 配置**: 必须设置强随机值（至少32字节）
  ```bash
  # 生成方法
  openssl rand -base64 48
  ```

### 2. CORS 配置
- [ ] **生产环境 CORS**: 设置具体的域名，不使用 `*`
  ```env
  CORS_ORIGIN=https://serdo.example.com
  ```
- [x] **CORS 验证**: 支持多个来源，逗号分隔
- [x] **凭证支持**: credentials: true

### 3. 数据保护
- [x] **脱敏模式**: 生产环境启用 `REDACT_MODE=true`
- [x] **密码字段**: API 返回时自动脱敏
- [x] **WebCrypto 解密**: 前端本地解密，不传输明文
- [x] **静态数据加密**: 所有敏感数据落盘加密

### 4. 速率限制
- [x] **API 限流**: 默认 300 次/分钟
- [ ] **生产环境调整**: 根据实际需求调整 `RATE_LIMIT_MAX`

### 5. SSH 安全
- [x] **SSH 密码限制**: 默认禁止明文密码登录
- [ ] **生产环境配置**: `API_SSH_ALLOW_PASSWORD=false`

---

## 🔧 环境配置检查

### 1. 后端环境变量 (api/.env)

**必需配置**:
```env
✅ AUTH_SECRET=<强随机值>
✅ CORS_ORIGIN=<生产域名>
```

**推荐配置**:
```env
✅ PORT=4000
✅ USE_SQLITE=true
✅ REDACT_MODE=true
✅ RATE_LIMIT_MAX=300
✅ API_SSH_ALLOW_PASSWORD=false
```

### 2. 前端环境变量 (.env.production)

```env
✅ VITE_USE_API=true
✅ VITE_API_BASE_URL=/api/v1  # 同域部署
```

### 3. 环境变量验证
- [ ] 所有必需变量已设置
- [ ] 没有硬编码的敏感信息
- [ ] `.env` 文件已添加到 `.gitignore`

---

## 📦 依赖项检查

### 1. 后端依赖
```bash
cd api && npm audit
```

**当前状态**:
- ⚠️ **nodemailer**: 1个中等漏洞
  - 影响: 邮件通知功能
  - 修复: `npm audit fix --force` 或更新到 v7.0.11+
  - 优先级: 中等（如不使用邮件通知可忽略）

**建议**:
```bash
cd api
npm update nodemailer
npm audit fix
```

### 2. 前端依赖
```bash
npm audit
```

**当前状态**:
- ✅ **无漏洞**: 前端依赖安全

### 3. Node.js 版本
- ⚠️ **当前版本**: v18.20.8
- ⚠️ **推荐版本**: >= 20.0.0 (部分依赖需要)
- **影响**: @google/genai, @vitejs/plugin-react
- **建议**: 升级到 Node.js 20 LTS

---

## 💾 数据库与存储检查

### 1. SQLite 配置
- [x] **默认启用**: USE_SQLITE=true
- [x] **外键约束**: PRAGMA foreign_keys = ON
- [x] **数据加密**: 敏感字段加密存储
- [ ] **数据目录权限**: `chmod 700 api/data`

### 2. 数据持久化
- [x] **SQLite 主存储**: api/data/serdo.db
- [x] **JSON 备份**: api/data/user_*.json
- [x] **用户数据**: api/data/users.json
- [ ] **备份策略**: 定期备份数据库

### 3. 数据备份
```bash
# 创建备份脚本
cp api/data/serdo.db backups/serdo-$(date +%Y%m%d).db
```

---

## 🔍 错误处理与日志

### 1. 错误处理
- [x] **全局错误处理**: Express 错误中间件
- [x] **JWT 验证**: 401 未授权
- [x] **权限检查**: 403 禁止访问
- [x] **资源不存在**: 404 未找到
- [x] **业务错误**: 自定义错误码

### 2. 日志系统
- [x] **结构化日志**: logger.js
- [x] **审计日志**: 用户操作记录
- [ ] **日志轮转**: 配置 logrotate
- [ ] **日志监控**: 集成 Sentry 或其他监控

### 3. 生产日志配置
```bash
# 查看日志
sudo journalctl -u serdo-api -f

# 日志轮转
sudo nano /etc/logrotate.d/serdo
```

---

## 🌐 API 路由检查

### 1. 认证路由
- [x] POST /api/v1/auth/register - 用户注册
- [x] POST /api/v1/auth/login - 用户登录
- [x] POST /api/v1/auth/verify-password - 密码验证

### 2. 用户路由
- [x] GET /api/v1/me - 获取用户信息
- [x] PATCH /api/v1/me - 更新用户信息
- [x] GET /api/v1/me/export - 导出数据
- [x] POST /api/v1/me/import - 导入数据

### 3. 资源路由
- [x] GET/POST/DELETE /api/v1/servers - 服务器管理
- [x] GET/POST/DELETE /api/v1/domains - 域名管理
- [x] GET/POST/DELETE /api/v1/providers - 服务商管理
- [x] GET/PUT /api/v1/settings - 设置管理

### 4. 功能路由
- [x] POST /api/v1/servers/check - 批量检查服务器
- [x] POST /api/v1/domains/check - 批量检查域名
- [x] POST /api/v1/domains/:id/sync - 同步域名信息
- [x] POST /api/v1/settings/test-whois - 测试 WHOIS API

### 5. 管理员路由
- [x] GET/POST /api/v1/admin/settings - 管理员设置
- [x] GET/POST/DELETE /api/v1/admin/invites - 邀请码管理
- [x] GET/PATCH/DELETE /api/v1/admin/users - 用户管理

---

## 🎨 前端构建检查

### 1. 构建配置
- [x] **Vite 配置**: vite.config.ts
- [x] **代码分割**: 智能分包
- [x] **生产优化**: 去除 console 和 debugger
- [x] **TypeScript**: 100% 类型覆盖

### 2. 构建优化
- [x] **包体积优化**: 已优化
  - vendor-terminal: 284KB (xterm)
  - 主 bundle: 合理范围
- [x] **Gzip 压缩**: Nginx 配置
- [x] **静态资源缓存**: 1年缓存

### 3. 构建测试
```bash
# TypeScript 类型检查
npx tsc --noEmit

# 构建测试
npm run build

# 预览构建结果
npm run preview
```

---

## 🚀 部署检查

### 1. 服务器准备
- [ ] Node.js >= 18 (推荐 20 LTS)
- [ ] Nginx 已安装
- [ ] SQLite3 已安装
- [ ] 防火墙配置正确

### 2. 文件权限
```bash
# 数据目录
chmod 700 api/data

# 日志目录
chmod 755 /var/log/serdo

# 服务文件
chmod 644 /etc/systemd/system/serdo-api.service
```

### 3. Systemd 服务
```bash
# 检查服务状态
sudo systemctl status serdo-api

# 启用开机自启
sudo systemctl enable serdo-api

# 查看日志
sudo journalctl -u serdo-api -f
```

### 4. Nginx 配置
- [ ] 前端静态文件路径正确
- [ ] API 反向代理配置
- [ ] WebSocket 支持 (Upgrade 头)
- [ ] Gzip 压缩启用
- [ ] 静态资源缓存配置
- [ ] HTTPS 证书配置

### 5. HTTPS 配置
```bash
# 使用 Certbot
sudo certbot --nginx -d serdo.example.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 🧪 功能测试

### 1. 后端健康检查
```bash
curl http://localhost:4000/api/v1/health
# 预期: {"ok":true}
```

### 2. 用户认证测试
```bash
# 注册
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"test123"}'

# 登录
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

### 3. 前端访问测试
- [ ] 首页加载正常
- [ ] 登录功能正常
- [ ] 服务器管理功能
- [ ] 域名管理功能
- [ ] WebSSH 连接测试

---

## 📊 性能检查

### 1. 响应时间
- [ ] API 响应 < 100ms
- [ ] 首屏加载 < 3s
- [ ] WebSSH 延迟 < 500ms

### 2. 并发测试
```bash
# 使用 ab 进行压力测试
ab -n 1000 -c 10 http://localhost:4000/api/v1/health
```

### 3. 资源监控
```bash
# 内存使用
ps aux | grep node

# CPU 使用
top -p $(pgrep -f "node server.js")
```

---

## 🔐 安全加固

### 1. 系统安全
- [ ] SSH 密钥登录
- [ ] 禁用 root 登录
- [ ] 防火墙配置 (ufw/firewalld)
- [ ] 定期更新系统

### 2. 应用安全
- [ ] 非 root 用户运行
- [ ] 最小权限原则
- [ ] 定期更新依赖
- [ ] 安全审计日志

### 3. 网络安全
- [ ] HTTPS 强制跳转
- [ ] HSTS 头配置
- [ ] CSP 策略
- [ ] X-Frame-Options

---

## 📝 上线前最终检查

### 必须完成项
- [ ] ✅ AUTH_SECRET 已设置强随机值
- [ ] ✅ REDACT_MODE=true
- [ ] ✅ CORS_ORIGIN 设置为生产域名
- [ ] ✅ 数据目录权限正确
- [ ] ✅ HTTPS 证书已配置
- [ ] ✅ 备份策略已制定
- [ ] ✅ 监控告警已配置

### 推荐完成项
- [ ] ⭐ Node.js 升级到 20 LTS
- [ ] ⭐ nodemailer 漏洞修复
- [ ] ⭐ 日志轮转配置
- [ ] ⭐ Sentry 错误监控
- [ ] ⭐ 性能监控配置

---

## 🐛 已知问题

### 1. 依赖项问题
- **nodemailer 漏洞**: 1个中等漏洞，影响邮件功能
  - **状态**: 可修复
  - **修复**: `npm audit fix --force`
  - **影响**: 如不使用邮件通知可忽略

### 2. Node.js 版本
- **当前**: v18.20.8
- **推荐**: >= 20.0.0
- **影响**: 部分依赖警告，不影响功能
- **建议**: 升级到 Node.js 20 LTS

### 3. 默认密码
- **admin/admin**: 首次登录后必须修改
- **建议**: 强制用户首次登录修改密码

---

## 📞 上线后监控

### 1. 日志监控
```bash
# 实时日志
sudo journalctl -u serdo-api -f

# 错误日志
sudo journalctl -u serdo-api -p err -f
```

### 2. 性能监控
- CPU 使用率
- 内存使用率
- 磁盘空间
- API 响应时间

### 3. 安全监控
- 失败登录次数
- 异常 API 调用
- 速率限制触发

---

## ✅ 检查清单总结

### 🔴 严重 (必须修复)
- [ ] AUTH_SECRET 设置强随机值
- [ ] 生产环境启用 REDACT_MODE
- [ ] CORS_ORIGIN 设置具体域名
- [ ] HTTPS 证书配置

### 🟡 警告 (建议修复)
- [ ] Node.js 升级到 20 LTS
- [ ] nodemailer 漏洞修复
- [ ] 数据备份策略
- [ ] 日志轮转配置

### 🟢 建议 (可选)
- [ ] Sentry 错误监控
- [ ] 性能监控配置
- [ ] 负载均衡配置
- [ ] CDN 加速

---

## 📚 相关文档

- [README.md](./README.md) - 项目概览
- [Installation.md](./docs/Installation.md) - 安装指南
- [Development.md](./docs/Development.md) - 开发指南
- [ProjectSummary.md](./docs/ProjectSummary.md) - 项目总结

---

**最后更新**: 2024-12-05
**版本**: 1.0.0

