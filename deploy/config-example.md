# Serdo 配置说明

## 前端配置

创建 `.env.local`（开发）或 `.env.production`（生产）文件：

```env
# API 服务器地址
# 同域部署使用相对路径，跨域部署使用完整地址
VITE_API_BASE_URL=/api/v1

# 可选: 应用名称
VITE_APP_NAME=Serdo

# 可选: 调试模式
VITE_DEBUG=false

# 可选: Gemini API Key
VITE_GEMINI_API_KEY=
```

## 后端配置

创建 `api/.env` 文件：

```env
# =============================================================================
# 必须配置
# =============================================================================

# JWT 签名密钥 [必须修改]
# 生成方法: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
AUTH_SECRET=your_random_secret_key_here

# 允许的前端地址
CORS_ORIGIN=http://localhost:3000

# =============================================================================
# 安全配置（生产环境推荐值）
# =============================================================================

# 密码脱敏模式 - API 不返回明文密码
REDACT_MODE=true

# SSH 密码认证 - 禁用更安全
API_SSH_ALLOW_PASSWORD=false

# =============================================================================
# 服务器配置
# =============================================================================

# 监听端口
PORT=4000

# 速率限制（每分钟每 IP）
RATE_LIMIT_MAX=300

# =============================================================================
# 数据存储
# =============================================================================

# 使用 SQLite 数据库
USE_SQLITE=true

# 数据目录
DATA_DIR=./data
```

## 安全注意事项

### 开发环境 vs 生产环境

| 配置项 | 开发环境 | 生产环境 |
|--------|----------|----------|
| AUTH_SECRET | 可使用默认值 | **必须修改** |
| REDACT_MODE | `false` | `true` |
| CORS_ORIGIN | `*` 或 localhost | 实际域名 |
| API_SSH_ALLOW_PASSWORD | `true` | `false` |

### 密码传输安全

1. **HTTPS 环境**：所有密码通过 HTTPS 加密传输
2. **HTTP 环境**：密码通过 AES-256-GCM 加密后传输（需要启用 REDACT_MODE）
3. **localhost**：被视为安全环境，可以明文传输

### 生成安全密钥

```bash
# 生成 AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# 或使用 openssl
openssl rand -base64 48
```


