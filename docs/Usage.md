# 使用说明

## 登录与注册
- 打开前端页面，选择语言后可直接登录或注册
- 本地演示账号: `admin/admin`
- API 模式下，注册信息与数据持久化到后端 `api/data/`

## 数据管理
- 服务器: 新增、编辑、删除，支持展示 SSH 信息
- 域名与 DNS: 维护记录，支持与服务器关联
- 服务商: 记录登录与支付信息
- 系统设置: 配置 DNS 提供商与通知（Bark/SMTP）

## AI 审计
- 前端本地模式: 需在 `.env.local` 配置 `GEMINI_API_KEY`，按钮触发生成 Markdown 报告
- API 模式: 由后端生成基础审计报告（示例），返回并展示

## WebSSH
- 当前为前端模拟窗口，未连接真实 SSH
- API 规划包含 WebSocket 通道，未来可替换为真实后端代理

## 切换数据源
- 通过 `.env.local` 的 `VITE_USE_API` 切换：
  - `true`: 使用后端 API，登录/注册/CRUD/设置均走网络
  - `false`: 使用浏览器 `localStorage`，适合离线演示
