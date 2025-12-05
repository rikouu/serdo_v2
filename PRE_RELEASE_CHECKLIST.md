# Serdo 发布前检查清单

## 检查日期
$(date '+%Y年%m月%d日')

## ✅ 构建状态

### 前端构建
- ✅ 构建成功: `npm run build` 通过
- ⚠️ 警告: 存在动态导入警告（apiClient.ts被同时静态和动态导入）
  - 影响: 可能影响代码分割效率
  - 建议: 统一为动态导入或配置manualChunks
- ⚠️ 包体积提醒:
  - vendor-charts (356KB / 106KB gzipped) - recharts
  - vendor-terminal (284KB / 71KB gzipped) - xterm
  - 建议: 考虑按需加载或路由级代码分割

### TypeScript类型检查
- ❌ 存在类型错误需要修复:
  1. `App.tsx`: ViewState类型缺少'superAdmin'
  2. `App.tsx`: User接口缺少role属性
  3. `components/SuperAdmin.tsx`: 邀请码对象缺少createdAt属性
  4. `components/SystemSettings.tsx`: 类型推断错误

## ⚠️ 需要修复的问题

### 1. TypeScript类型定义
```typescript
// types.ts 需要添加:
export type ViewState = 'dashboard' | 'servers' | 'domains' | 'providers' | 'profile' | 'settings' | 'superAdmin';

export interface User {
  id: string;
  username: string;
  email: string;
  role?: 'admin' | 'user'; // 添加role字段
}
```

### 2. 邀请码类型
```typescript
// SuperAdmin.tsx 中的邀请码需要包含createdAt
interface InviteCode {
  code: string;
  createdAt: number;
  expiresAt: number;
  usedBy?: string;
}
```

## ✅ 配置文件检查

### 环境变量
- ✅ 前端 `.env.example` 存在
- ✅ 后端 `api/.env.example` 存在
- ✅ 包含必要的配置项:
  - VITE_USE_API
  - VITE_API_BASE_URL
  - GEMINI_API_KEY
  - AUTH_SECRET (后端)
  - CORS_ORIGIN (后端)
  - USE_SQLITE (后端)

### 包依赖
- ✅ 前端依赖完整
- ✅ 后端依赖完整（包含better-sqlite3）

## ✅ 部署配置

### Docker配置
- ✅ `Dockerfile.web` (前端)
- ✅ `api/Dockerfile` (后端)
- ✅ `docker-compose.yml`
- ✅ `nginx.conf`

### 部署脚本
- ✅ `scripts/release.sh` - 打包脚本
- ✅ `scripts/migrate-users-to-sqlite.js` - 数据迁移
- ✅ `scripts/cleanup-users-json.sh` - 清理脚本
- ✅ `scripts/detect-double-write.js` - 双写检测

### 模板文件
- ✅ `deploy/templates/serdo-api.service` - systemd服务
- ✅ `deploy/templates/nginx-serdo.conf` - Nginx配置

## ✅ API后端检查

### 核心文件
- ✅ server.js - 服务入口
- ✅ routes.js - API路由
- ✅ auth.js - 认证逻辑
- ✅ userStore.js - 用户存储
- ✅ storage.js - 数据存储
- ✅ whoisService.js - WHOIS服务

### 安全特性
- ✅ JWT认证
- ✅ 密码加密
- ✅ CORS配置
- ✅ 速率限制
- ✅ 脱敏模式 (REDACT_MODE)
- ✅ AES-256-GCM加密存储

### 数据库
- ✅ SQLite支持（默认启用）
- ✅ JSON文件存储（备选方案）
- ✅ 数据迁移脚本

## ⚠️ 发布前必须操作

### 1. 修复TypeScript错误
```bash
# 更新types.ts中的ViewState定义
# 在User接口添加role字段
# 修复SuperAdmin.tsx中的类型问题
```

### 2. 生成生产环境密钥
```bash
openssl rand -base64 48
```

### 3. 配置生产环境变量
后端 `.env`:
```
AUTH_SECRET=<生成的强随机密钥>
REDACT_MODE=true
CORS_ORIGIN=https://your-domain.com
USE_SQLITE=true
PORT=4000
RATE_LIMIT_MAX=300
API_SSH_ALLOW_PASSWORD=false
```

前端 `.env.production`:
```
VITE_USE_API=true
VITE_API_BASE_URL=/api/v1
```

### 4. 测试清单
- [ ] 本地构建测试
- [ ] 用户注册/登录
- [ ] 服务器CRUD
- [ ] 域名CRUD
- [ ] 服务商CRUD
- [ ] WebSSH连接
- [ ] 健康检查
- [ ] 域名同步
- [ ] 通知功能（Bark/SMTP）
- [ ] 密码加密/解密
- [ ] API脱敏模式

### 5. 性能检查
- [ ] 首屏加载时间 < 3秒
- [ ] API响应时间 < 100ms
- [ ] 数据库查询优化
- [ ] 静态资源CDN（可选）

### 6. 安全检查
- [ ] 所有敏感信息使用环境变量
- [ ] 生产环境启用REDACT_MODE
- [ ] HTTPS配置
- [ ] CORS正确配置
- [ ] JWT密钥强度
- [ ] SQL注入防护
- [ ] XSS防护

## 📝 部署步骤建议

1. **准备服务器**
   - 安装Node.js 18+
   - 安装Nginx
   - 配置域名解析
   - 开放80/443端口

2. **上传代码**
   ```bash
   bash scripts/release.sh
   # 上传生成的 serdo-release-*.zip
   ```

3. **后端部署**
   ```bash
   cd /opt/serdo/api
   npm install
   # 配置.env
   # 设置systemd服务
   systemctl enable --now serdo-api
   ```

4. **前端部署**
   ```bash
   # 配置Nginx指向 /opt/serdo/dist
   # 配置反向代理 /api/ -> http://127.0.0.1:4000/api/
   # 申请SSL证书
   ```

5. **验证**
   ```bash
   curl http://127.0.0.1:4000/api/v1/health
   # 浏览器访问前端域名
   # 测试登录和基本功能
   ```

## 📊 当前项目统计

- 前端组件: 19个
- API路由: 完整RESTful
- 数据库: SQLite + JSON备份
- 支持语言: 中文/英文
- 部署方式: Docker / 传统部署 / 1Panel

## ✨ 主要功能

1. 服务器管理（IP、状态、SSH、面板）
2. 域名管理（DNS记录、WHOIS、到期提醒）
3. 服务商管理（账号、支付方式）
4. WebSSH终端
5. 健康监控
6. 通知集成
7. 多语言支持
8. 数据加密存储

## 🚀 准备发布

完成上述检查和修复后，项目可以发布到生产环境。

---
生成时间: $(date '+%Y-%m-%d %H:%M:%S')
