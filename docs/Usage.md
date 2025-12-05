# 使用说明

## 登录与注册
- 打开前端页面，选择语言后可直接登录或注册
- 默认管理员账号: `admin/admin`
- 注册信息与数据持久化到后端 `api/data/`

## 数据管理
- 服务器: 新增、编辑、删除，支持展示 SSH 信息
- 域名与 DNS: 维护记录，支持与服务器关联
- 服务商: 记录登录与支付信息
- 系统设置: 配置 DNS 提供商与通知（Bark/SMTP）

## AI 审计
- 由后端生成审计报告，展示在 Dashboard 中

## WebSSH
- 点击服务器的 SSH 图标可打开 WebSSH 终端
- 通过 WebSocket 连接后端 SSH 服务

## 配置说明

### 前端环境变量 (`.env.local`)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | API 地址 |

### 后端环境变量 (`api/.env`)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AUTH_SECRET` | - | JWT 签名密钥（必须设置） |
| `PORT` | `4000` | 服务监听端口 |
| `CORS_ORIGIN` | `*` | 允许的前端来源 |
| `REDACT_MODE` | `false` | 生产环境建议 `true` |
