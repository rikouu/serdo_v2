# Serdo 开发文档

> 本文档用于快速了解项目结构、API 路由、配置项和开发规范，避免重复阅读代码。

---

## 📌 项目概述

Serdo 是一个轻量级的服务器与域名一站式管理面板，适合中小团队与个人运维使用。

### 核心功能

| 功能模块 | 描述 |
|---------|------|
| 服务器管理 | VPS/独服/云主机管理，健康检查（TCP Ping），到期提醒 |
| 域名管理 | 域名与 DNS 记录管理，WHOIS 同步到期时间，状态检测 |
| 服务商管理 | 统一维护云服务商、注册商账号信息 |
| WebSSH | 浏览器内 SSH 终端（基于 xterm + ssh2） |
| 通知集成 | Bark (iOS) 与 SMTP 邮件通知 |
| 多语言 | 中英文切换 |

---

## 🏗️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| Vite | 6.x | 构建工具 |
| TypeScript | 5.8.x | 类型系统 |
| lucide-react | 0.555+ | 图标库 |
| recharts | 3.5+ | 图表组件 |
| xterm | 5.3+ | WebSSH 终端 |
| react-markdown | 10.1+ | Markdown 渲染（AI 审计） |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行时 |
| Express | 4.19+ | Web 框架 |
| ssh2 | 1.13+ | SSH 客户端 |
| ws | 8.18+ | WebSocket 服务 |
| undici | 6.20+ | HTTP 客户端 |
| nodemailer | 6.9+ | SMTP 邮件 |
| better-sqlite3 | (可选) | SQLite 数据库 |

---

## 📁 目录结构

```
/
├── App.tsx                 # 主应用组件（路由、状态管理、布局）
├── index.tsx               # React 入口
├── index.html              # HTML 模板
├── types.ts                # TypeScript 类型定义
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # 前端依赖
│
├── components/             # React 组件
│   ├── Dashboard.tsx       # 概览仪表盘
│   ├── ServerList.tsx      # 服务器列表
│   ├── DomainList.tsx      # 域名列表
│   ├── ProviderList.tsx    # 服务商列表
│   ├── UserProfile.tsx     # 个人资料
│   ├── SystemSettings.tsx  # 系统设置
│   ├── SuperAdmin.tsx      # 超级管理员（邀请码、用户管理）
│   ├── Login.tsx           # 登录页
│   ├── Register.tsx        # 注册页
│   ├── WebSSH.tsx          # WebSSH 终端组件
│   ├── EmptyState.tsx      # 空状态引导
│   └── NotifyHost.tsx      # 全局通知组件
│
├── services/               # 前端服务层
│   ├── apiClient.ts        # API 请求封装（Bearer Token 认证）
│   ├── api.ts              # 核心 API 请求方法
│   └── authService.ts      # 认证 token 管理
│
├── utils/                  # 工具函数
│   ├── translations.ts     # 多语言翻译
│   ├── crypto.ts           # AES-GCM 解密（前端）
│   ├── clipboard.ts        # 剪贴板操作
│   └── notify.ts           # Toast 通知
│
├── api/                    # 后端（Express）
│   ├── server.js           # 服务入口（CORS、限流、健康检查）
│   ├── routes.js           # REST API 路由
│   ├── auth.js             # 认证逻辑（JWT、注册、登录）
│   ├── userStore.js        # 用户存储（JSON/SQLite）
│   ├── storage.js          # 用户数据存储（AES-GCM 加密）
│   ├── adminStore.js       # 管理员配置（应用名称、邀请码）
│   ├── ssh.js              # WebSSH 服务（WebSocket + ssh2）
│   ├── logger.js           # 日志与审计
│   ├── validate.js         # 数据校验
│   ├── schema.js           # 请求 Schema 校验
│   └── data/               # 数据文件
│       ├── users.json      # 用户列表（JSON 模式）
│       ├── admin.json      # 管理员配置
│       ├── user_*.json     # 用户业务数据
│       ├── audit.log       # 审计日志
│       └── serdo.db        # SQLite 数据库（可选）
│
├── scripts/                # 运维脚本
│   ├── release.sh          # 打包发布脚本
│   ├── migrate-users-to-sqlite.js  # JSON → SQLite 迁移
│   ├── cleanup-users-json.sh       # 清理旧 JSON 文件
│   └── detect-double-write.js      # 双写检测
│
├── deploy/templates/       # 部署模板
│   ├── serdo-api.service   # systemd 服务配置
│   └── nginx-serdo.conf    # Nginx 反代配置
│
└── docs/                   # 文档
    ├── DEV.md              # 开发文档（本文件）
    └── ...
```

---

## 🔌 API 路由参考

### 基础路径
- 开发环境: `http://localhost:4000/api/v1`
- 生产环境: `/api/v1`（Nginx 反代）

### 认证相关

| 方法 | 路径 | 描述 | 需认证 |
|------|------|------|--------|
| POST | `/auth/register` | 用户注册 | ❌ |
| POST | `/auth/login` | 用户登录 | ❌ |
| POST | `/auth/verify-password` | 验证当前密码 | ✅ |
| GET | `/me` | 获取当前用户和数据 | ✅ |
| PATCH | `/me` | 更新邮箱/密码 | ✅ |
| GET | `/me/export` | 导出用户数据 | ✅ |
| POST | `/me/import` | 导入用户数据 | ✅ |

### 服务器管理

| 方法 | 路径 | 描述 | 需认证 |
|------|------|------|--------|
| GET | `/servers` | 获取服务器列表 | ✅ |
| POST | `/servers` | 创建/更新服务器 | ✅ |
| DELETE | `/servers/:id` | 删除服务器 | ✅ |
| POST | `/servers/check` | 批量健康检查 | ✅ |
| POST | `/servers/:id/ping` | 单服务器 Ping | ✅ |

### 域名管理

| 方法 | 路径 | 描述 | 需认证 |
|------|------|------|--------|
| GET | `/domains` | 获取域名列表 | ✅ |
| POST | `/domains` | 创建/更新域名 | ✅ |
| DELETE | `/domains/:id` | 删除域名 | ✅ |
| POST | `/domains/:id/sync` | 同步 DNS 和 WHOIS | ✅ |
| POST | `/domains/check` | 批量检查到期时间 | ✅ |

### 服务商管理

| 方法 | 路径 | 描述 | 需认证 |
|------|------|------|--------|
| GET | `/providers` | 获取服务商列表 | ✅ |
| POST | `/providers` | 创建/更新服务商 | ✅ |
| DELETE | `/providers/:id` | 删除服务商 | ✅ |

### 系统设置

| 方法 | 路径 | 描述 | 需认证 |
|------|------|------|--------|
| GET | `/settings` | 获取系统设置 | ✅ |
| PUT | `/settings` | 更新系统设置 | ✅ |
| POST | `/settings/test-whois` | 测试 WHOIS API | ✅ |
| POST | `/notifications/smtp/test` | SMTP 发送测试 | ✅ (admin) |

### 密文解密（脱敏模式）

| 方法 | 路径 | 描述 | 需认证 |
|------|------|------|--------|
| POST | `/reveal/session` | 获取解密密钥 | ✅ |
| GET | `/reveal/servers/:id` | 获取服务器密文 | ✅ |
| GET | `/reveal/providers/:id` | 获取服务商密文 | ✅ |
| GET | `/reveal/settings/key` | 获取 WHOIS Key 密文 | ✅ |

### 管理员接口（admin）

| 方法 | 路径 | 描述 | 需认证 |
|------|------|------|--------|
| GET | `/admin/settings` | 获取管理配置 | ✅ (admin) |
| POST | `/admin/settings` | 更新管理配置 | ✅ (admin) |
| GET | `/admin/invites` | 获取邀请码列表 | ✅ (admin) |
| POST | `/admin/invites/generate` | 生成邀请码 | ✅ (admin) |
| PATCH | `/admin/invites/:code` | 更新邀请码 | ✅ (admin) |
| DELETE | `/admin/invites/:code` | 删除邀请码 | ✅ (admin) |
| GET | `/admin/users` | 获取用户列表 | ✅ (admin) |
| PATCH | `/admin/users/:id` | 更新用户到期时间 | ✅ (admin) |
| DELETE | `/admin/users/:id` | 删除用户 | ✅ (admin) |

### WebSocket

| 路径 | 描述 |
|------|------|
| `ws://host:port/api/v1/ssh?token=xxx&serverId=xxx` | WebSSH 终端 |

### 其他

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/metrics` | Prometheus 指标 |
| POST | `/audit/run` | 生成审计报告 (admin) |

---

## ⚙️ 环境变量

### 前端 (.env / .env.production)

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | API 地址，同域用 `/api/v1` |

### 后端 (.env / 环境变量)

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `AUTH_SECRET` | `dev_secret_change_me` | **必须**：JWT 签名密钥 |
| `PORT` | `4000` | 监听端口 |
| `CORS_ORIGIN` | `http://localhost:3000` | 允许的前端来源，多个用逗号分隔，或 `*` |
| `REDACT_MODE` | `false` | 生产建议 `true`，接口返回脱敏数据 |
| `USE_SQLITE` | `false` | `true` 使用 SQLite，需安装 `better-sqlite3` |
| `RATE_LIMIT_MAX` | `300` | 每分钟请求上限 |
| `API_SSH_ALLOW_PASSWORD` | `false` | 是否允许 SSH 密码登录 |

---

## 🗃️ 数据模型

### User（用户）

```typescript
interface User {
  id: string;           // user_<timestamp>_<random>
  username: string;
  email: string;
  expiresAt?: number;   // 账号过期时间（毫秒），0 表示永不过期
}
```

### Server（服务器）

```typescript
interface Server {
  id: string;
  name: string;
  ip: string;
  provider: string;           // 显示名称
  providerId?: string;        // 关联服务商 ID
  region: string;
  os: string;
  status: 'running' | 'stopped' | 'expired' | 'maintenance';
  expirationDate: string;     // ISO 日期
  cpu: string;
  ram: string;
  disk: string;
  
  // 面板信息
  panelUrl?: string;
  username?: string;
  password?: string;          // AES-GCM 加密存储
  notes?: string;
  
  // 服务商信息
  providerUrl?: string;
  providerUsername?: string;
  providerPassword?: string;  // AES-GCM 加密存储
  providerNotes?: string;
  
  // SSH 信息
  sshPort?: string;
  sshUsername?: string;
  sshPassword?: string;       // AES-GCM 加密存储
  
  // 运行时
  lastPingMs?: number;        // 最近延迟
}
```

### Domain（域名）

```typescript
interface Domain {
  id: string;
  name: string;
  registrar: string;          // 注册商名称
  registrarProviderId?: string;
  dnsProvider: string;        // DNS 服务商名称
  dnsProviderId?: string;
  expirationDate: string;     // ISO 日期
  autoRenew: boolean;
  records: DNSRecord[];
  status?: string[];          // EPP 状态
  state?: 'normal' | 'expiring_soon' | 'expired' | 'pending_delete' | 'redemption' | 'suspended' | 'no_dns' | 'unknown';
}

interface DNSRecord {
  id: string;
  type: 'A' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  name: string;
  value: string;
  ttl: number;
  linkedServerId?: string;    // 关联服务器（A 记录）
}
```

### Provider（服务商）

```typescript
interface Provider {
  id: string;
  name: string;
  loginUrl: string;
  username: string;
  password: string;           // AES-GCM 加密存储
  categories: ('server' | 'domain')[];
  paymentMethod: 'CreditCard' | 'PayPal' | 'Alipay' | 'WeChat' | 'Other';
  paymentAccount: string;
}
```

### SystemSettings（系统设置）

```typescript
interface SystemSettings {
  dnsApiProvider: 'cloudflare' | 'google' | 'quad9';
  dnsFailover: boolean;
  actionButtonsLayout?: 'fixed' | 'floating';
  
  // WHOIS API
  whoisApiBaseUrl?: string;
  whoisApiKey?: string;       // AES-GCM 加密存储
  whoisApiMethod?: 'GET' | 'POST';
  
  // 自动检查
  serverAutoCheckEnabled?: boolean;
  serverAutoCheckIntervalHours?: number;
  domainAutoCheckEnabled?: boolean;
  domainAutoCheckFrequency?: 'daily' | 'weekly' | 'monthly';
  serverAutoCheckLastAt?: number;
  domainAutoCheckLastAt?: number;
  
  // 通知
  notifications: {
    bark: {
      enabled: boolean;
      serverUrl: string;
      key: string;            // AES-GCM 加密存储
    };
    smtp: {
      enabled: boolean;
      host: string;
      port: number;
      secure?: boolean;
      requireTLS?: boolean;
      username: string;
      password: string;       // AES-GCM 加密存储
      fromEmail: string;
    };
    preferences?: {
      notifyServerDown: boolean;
      notifyDomainExpiring: boolean;
    };
  };
}
```

---

## 🔐 安全机制

### JWT 认证

- 算法: HS256
- 有效期: 7 天
- Payload: `{ sub: userId, role: 'admin' | 'user', iat, exp }`
- Header: `Authorization: Bearer <token>`

### 密码哈希

- 算法: scrypt (salt=16 bytes, keylen=32)
- 格式: `{ password: hex(hash), salt: hex(salt) }`

### 数据加密 (REST)

- 算法: AES-256-GCM
- 密钥: SHA256(AUTH_SECRET)
- 格式: `enc:gcm:<iv_base64>:<tag_base64>:<data_base64>`
- 适用字段: password, sshPassword, providerPassword, smtp.password, bark.key, whoisApiKey

### 脱敏模式 (REDACT_MODE=true)

- 读接口不返回明文密码
- 返回 `hasPassword: true` 标记
- 前端通过 `/reveal/*` 获取密文，本地 WebCrypto 解密

---

## 🖥️ 组件说明

### App.tsx

主应用组件，负责：
- 路由状态管理 (`currentView`)
- 用户认证状态 (`currentUser`)
- 数据加载和保存（调用 `apiClient`）
- 侧边导航和移动端响应式布局
- WebSSH 终端状态管理

### Dashboard.tsx

概览面板，展示：
- 服务器/域名总数
- 到期统计（30 天内）
- 系统健康状态
- 饼图分布（按服务商/注册商）
- AI 审计（调用 Gemini API）

### ServerList.tsx

服务器管理，功能：
- 服务器卡片列表
- 添加/编辑/删除服务器
- 面板/服务商信息展示
- SSH 信息与终端入口
- 关联域名展示
- 单服务器 Ping 检测

### DomainList.tsx

域名管理，功能：
- 域名卡片列表
- 添加/编辑/删除域名
- DNS 记录展示
- WHOIS 同步（单个/批量）
- 域名状态标签
- 服务器关联

### ProviderList.tsx

服务商管理，功能：
- 服务商卡片列表
- 添加/编辑/删除服务商
- 分类标签（server/domain）
- 支付方式展示

### SystemSettings.tsx

系统设置页面，包含：
- UI 设置（按钮布局）
- DNS 配置
- WHOIS API 配置
- 自动检查设置
- 通知设置（Bark/SMTP）
- SMTP 测试功能

### SuperAdmin.tsx

超级管理员页面（仅 admin 可见）：
- 应用名称设置
- 邀请码开关
- 邀请码生成和管理
- 用户列表与到期时间管理

### WebSSH.tsx

WebSSH 终端组件：
- xterm.js 终端渲染
- WebSocket 连接后端 SSH
- 支持最小化/最大化
- 自动重连机制

---

## 🚀 开发命令

### 前端

```bash
# 安装依赖
npm install

# 启动开发服务器 (http://localhost:3000)
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### 后端

```bash
# 进入后端目录
cd api

# 安装依赖
npm install

# 启动开发服务器
AUTH_SECRET=your_secret node server.js

# 或使用 .env 文件
# api/.env 内容:
# AUTH_SECRET=your_secret
# PORT=4000
# CORS_ORIGIN=http://localhost:3000
```

### 打包发布

```bash
# 一键打包（生成 release/ 目录）
bash scripts/release.sh
```

---

## 🔧 常见开发场景

### 添加新的 API 路由

1. 在 `api/routes.js` 添加路由处理
2. 如需校验，在 `api/schema.js` 添加 schema
3. 前端在 `services/apiClient.ts` 添加对应方法
4. 组件中调用 API 方法

### 添加新的数据字段

1. 在 `types.ts` 更新类型定义
2. 后端 `api/routes.js` 处理新字段
3. 如为敏感字段，在 `storage.js` 的 `encryptAtRest` 和 `decryptForUse` 添加处理
4. 如需脱敏，在 `routes.js` 的 `redactData` 添加处理

### 添加新的翻译

1. 在 `utils/translations.ts` 的 `en` 和 `zh` 对象中添加键值
2. 组件中使用 `t.newKey`

### 添加新组件

1. 在 `components/` 创建 `.tsx` 文件
2. 在 `App.tsx` 导入并添加路由
3. 如需导航入口，在侧边栏添加 `NavItem`

---

## 📋 注意事项

### 密码处理

- 保存时，空字符串不会覆盖旧值（防误清空）
- 前端发送时，空密码字段会被 `delete`
- 后端 merge 逻辑会保留原有密码

### 多用户数据隔离

- 每个用户的数据存储在独立文件 `user_<id>.json`
- SQLite 模式下存储在 `user_data` 表
- 所有业务数据读写都通过 `loadUserData` / `saveUserData`

### 错误处理

- 前端 `req` 函数统一处理错误码
- 401 错误自动清除 token
- 组件显示 `loadError` 错误提示

### 自动检查

- 后端每 5 分钟执行一次 `runAutoChecks`
- 根据用户设置的间隔判断是否执行
- 触发通知需用户在设置中启用

---

## 🐛 已知问题与待优化

### 已修复 ✅

| 问题 | 修复时间 | 说明 |
|------|----------|------|
| `whoisProxyFetch` 未定义 | 2024-12 | 添加 `whoisApiFetch` 函数，修复域名同步崩溃 |
| 重复 WHOIS 请求 | 2024-12 | 移除冗余的第二次请求，节省 API 配额 |
| 硬编码 WHOIS API Key | 2024-12 | 移除默认密钥，改为空字符串 |
| 首包体积过大 | 2024-12 | 添加 `manualChunks` 分包配置 |

### 待优化 🔄

1. **WebSSH 不支持密钥认证**: 当前仅支持密码，建议添加 `privateKey` 选项
2. **WHOIS 解析兼容性**: 不同注册商返回格式差异大，可能解析失败
3. **SQLite 并发**: better-sqlite3 是同步的，高并发场景可能有瓶颈
4. **空 catch 块**: 部分错误被静默吞掉，建议添加日志

---

## 🔄 更新日志

### 2024-12-04

- 🐛 修复 `whoisProxyFetch` 函数未定义导致域名同步失败
- 🐛 修复 `whoisProxyFetchLocal` 调用错误（改用 `whoisOfciFetchLocal`）
- 🔧 移除 `storage.js` 中硬编码的 WHOIS API Key
- ⚡ 添加 Vite `manualChunks` 分包优化（react/recharts/xterm/lucide 分离）
- 📝 新增开发文档 `docs/DEV.md`

---

## 📚 相关文档

- [README.md](../README.md) - 项目介绍与部署指南
- [Installation.md](./Installation.md) - 安装指南
- [Usage.md](./Usage.md) - 使用指南
- [ProjectSummary.md](./ProjectSummary.md) - 项目总结

---

*最后更新: 2024-12-04*

