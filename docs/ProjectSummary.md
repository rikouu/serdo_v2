# 项目总结与后续开发规划（v1）

- 路径索引: 本文引用仓库内关键文件，采用 `file_path:line_number` 模式，便于快速定位。
- 更新时间: 2025-12-03

## 项目总结

### 架构与技术栈
- 前端框架与语言: `React` + `TypeScript`（`package.json:11-18`）
- 构建工具与开发脚本: `Vite`，`npm run dev|build|preview`（`package.json:6-10`，`vite.config.ts:5-16`）
- 样式: `Tailwind CSS` 通过 `CDN` 注入（`index.html:7`）；无本地 PostCSS/Purge 配置
- 入口与挂载: `index.tsx` 挂载 `App`（`index.tsx:1-15`）；页面模板在 `index.html`（`index.html:17-27,31-33`）
- 别名与环境: `@` 指向项目根；注入 `GEMINI_API_KEY` 到 `process.env`（`vite.config.ts:8-11,13-16,17-21`）
- 类型与配置: `tsconfig.json` 设定 `jsx: react-jsx`，`ES2022`，`paths`（`tsconfig.json:2-28`）

### 目录与状态管理
- 目录: `components/`（UI 组件），`services/`（数据与外部服务），`utils/`（国际化），根级 `App.tsx`、`types.ts`
- 路由: 无 `react-router`；通过 `currentView` 手动切页（`App.tsx:21,174-205`）
- 全局状态: 顶层 `App` 管理 `servers/domains/providers/currentUser/language` 并下发 props（`App.tsx:18-33`）
- 数据加载与持久化: 登录后加载数据，变更后保存到 `localStorage`（`App.tsx:34-46,48-64`）

### 功能模块
- 仪表盘: 总览、到期提醒、图表、AI 审计触发（`components/Dashboard.tsx:61-66,173-234`）
- 服务器管理: 列表、编辑、关联域名、SSH 信息展示（`components/ServerList.tsx:169-201,558-572`）
- 域名管理: 域名资料、DNS 记录 CRUD、绑定服务器（`components/DomainList.tsx:423-453`）
- 服务商管理: 供应商资料、登录/支付信息记录（`components/ProviderList.tsx:88-114,212-237`）
- 用户资料: 查看/更新邮箱与密码（`components/UserProfile.tsx:132-141`）
- 系统设置: DNS 与通知（Bark、SMTP）（`components/SystemSettings.tsx:41-60,81-101,117-158,165-175`）
- 认证: 登录与注册（`components/Login.tsx:21-30,56-83`；`components/Register.tsx:22-37,60-107`）
- WebSSH: 前端模拟终端窗体（最小化/最大化）（`components/WebSSH.tsx:48-58,62-71,85-96`）

### UI 组件清单
- `Dashboard`、`ServerList`、`DomainList`、`ProviderList`、`UserProfile`、`SystemSettings`、`Login`、`Register`、`WebSSH`

### 数据与 API 逻辑
- 数据模型: `types.ts` 定义 `Server/Domain/DNSRecord/Provider/User/SystemSettings`（`types.ts:15-45,47-66,68-76,78-82,84-102,104-106`）
- 本地数据源: 以 `userId` 分区写入 `localStorage`；提供 `get/set` 方法（`services/dataService.ts:140-147,149-156,158-165,192-199`）
- 认证流程: 注册写入本地用户表；登录校验，含 `admin/admin` 种子数据（`services/dataService.ts:73-97,99-117,110-114`）
- 初始数据: 服务器/域名/服务商与默认系统设置（`services/dataService.ts:9-35,36-61,63-70`）
- AI 审计: 使用 `Gemini` 生成 Markdown 报告（取 `API_KEY`）（`services/geminiService.ts:4-11,13-45`）

### 依赖与第三方
- UI 与图表: `lucide-react` 图标，`recharts` 图表（`package.json:11-18`）
- Markdown: `react-markdown`（`package.json:11-18`）
- 构建: `vite`，`@types/node` 等（`package.json:6-18`）
- Tailwind: 通过 `CDN`，非 NPM 依赖（`index.html:7`）

### 已知问题与优化点
- 安全: 密码明文存储（示例性质），需改为哈希（`types.ts:75-76`）
- 架构: 无真实后端与网络调用，数据仅本地；`WebSSH` 纯前端模拟
- 路由: 手动视图切换，建议使用 `react-router` 提升可维护性
- 样式: Tailwind 以 CDN 注入无法按需裁剪，建议本地集成并启用 Purge
- 测试: 无单测/集成测试与 Lint 规则，建议补齐
- 配置: `.env.local` 未随仓库提供（`README.md:16-20`），需规范化环境管理

## 后端开发规划

### 数据库设计（推荐 `PostgreSQL` + `Prisma`）
- `users`: `id(uuid)`, `username(uniq)`, `email(uniq)`, `password_hash`, `role(enum: admin/user)`, `mfa_secret(nullable)`, `created_at`
- `providers`: `id`, `name`, `login_url`, `username`, `credential_ref(nullable)`, `payment_method(enum)`, `payment_account`, `categories(jsonb: ["server","domain"])`, `owner_user_id`
- `servers`: `id`, `name`, `ip`, `region`, `os`, `status(enum)`, `expiration_date`, `cpu`, `ram`, `disk`, `panel_url`, `panel_username`, `panel_secret_ref`, `provider_id(fk)`, `ssh_port`, `ssh_username`, `ssh_secret_ref`, `notes`, `owner_user_id`
- `domains`: `id`, `name(uniq per user)`, `registrar_provider_id(fk)`, `dns_provider_id(fk)`, `expiration_date`, `auto_renew`, `owner_user_id`
- `dns_records`: `id`, `domain_id(fk)`, `type(enum: A|CNAME|MX|TXT|NS)`, `name`, `value`, `ttl`, `linked_server_id(fk nullable)`
- `system_settings`: `id`, `owner_user_id(uniq fk)`, `dns_api_provider(enum)`, `dns_failover`, `bark_enabled`, `bark_server_url`, `bark_key`, `smtp_enabled`, `smtp_host`, `smtp_port`, `smtp_username`, `smtp_secret_ref`, `smtp_from_email`
- `server_domain_links`（可选，若需显式多对多）: `id`, `server_id`, `domain_id`, `relation_type`
- `audit_reports`: `id`, `owner_user_id`, `trigger_source(enum: dashboard/manual)`, `input_snapshot(jsonb)`, `output_md(text)`, `model`, `cost_ms`, `created_at`
- 关系模型: `users` 一对多 `providers/servers/domains/dns_records/audit_reports`；`domains` 一对多 `dns_records`；`servers` 可被 `dns_records.linked_server_id` 关联

### API 接口（RESTful，前缀 `/api/v1`）
- 认证
  - `POST /auth/register`（`{username,email,password}`）
  - `POST /auth/login`（`{username,password}`）→ `{access_token,refresh_token,user}`
  - `POST /auth/refresh`（`{refresh_token}`）
  - `POST /auth/logout`
  - `POST /auth/mfa/setup|verify`（可选）
- 用户
  - `GET /me`，`PATCH /me`（更新 `UserProfile`，参考 `types.ts:78-82`）
- 服务商
  - `GET /providers`，`POST /providers`，`GET /providers/:id`，`PUT/PATCH /providers/:id`，`DELETE /providers/:id`
- 服务器
  - `GET /servers`（支持分页、筛选 `status/region/providerId`）
  - `POST /servers`，`GET /servers/:id`，`PUT/PATCH /servers/:id`，`DELETE /servers/:id`
  - `POST /servers/:id/link-domain/:domainId`（或通过 DNS 记录隐式关联）
- 域名与 DNS
  - `GET /domains`，`POST /domains`，`GET /domains/:id`，`PUT/PATCH /domains/:id`，`DELETE /domains/:id`
  - `GET /domains/:id/records`，`POST /domains/:id/records`，`PUT/PATCH /domains/:id/records/:recordId`，`DELETE /domains/:id/records/:recordId`
- 系统设置
  - `GET /settings`（当前用户），`PUT/PATCH /settings`
- 审计与 AI
  - `POST /audit/run`（以当前数据快照传入后端，由后端调用 `Gemini` 并存储报告）
  - `GET /audit/reports`，`GET /audit/reports/:id`
- WebSSH（建议 WebSocket）
  - `WS /ssh/connect`（后端代理到 SSH，基于会话与权限隔离；前端 `WebSSH` 对接）

### 认证与授权
- 认证: `JWT`（短期 `access` + 长期 `refresh`）；密码哈希用 `argon2` 或 `bcrypt`
- 授权: 资源级所有权（`owner_user_id`）+ 角色（`admin/user`）；中间件校验资源归属
- 会话安全: `HTTP-only` Cookie 或 Bearer Token；支持 IP 与设备指纹可选
- 密钥管理: 敏感字段不直接存储明文，使用 `secret_ref` 指向密钥存储（如 `Vault`/`KMS`）

### 数据验证与错误处理
- 验证: DTO 层使用 `zod` 或 `class-validator`（请求体/查询参数/路径参数）
- 错误模型: 统一返回 `{code,message,details,requestId}`；区分 4xx/5xx
- 防御式编程: 速率限制（登录、审计）、输入长度与格式限制、文件/命令黑白名单（WebSSH）

### 缓存与性能
- 缓存: `Redis` 缓存高频只读接口（如 `/servers`、`/domains` 列表）；用户维度 key 前缀
- 客户端优化: `ETag/Last-Modified` 与 `If-None-Match/If-Modified-Since`
- 分页与索引: 为 `servers(ip,status,provider_id)`、`domains(name,registrar_provider_id)`、`dns_records(domain_id,type,name)` 建索引
- 合理批量: 批量创建/更新 `dns_records`；防止 N+1（ORM `include`/`select`）

### 测试计划
- 单元测试: 后端服务层与验证器（`jest` 或 `vitest`）
- 集成测试: 控制器 + 数据库（`supertest` + 事务回滚）
- 合同测试: 前后端接口契约（可选 `pact`）
- 端到端: 前端配合真实后端或 Mock（`Playwright`/`Cypress`），覆盖登录、CRUD、审计触发、设置更新
- 安全测试: 认证绕过、权限检查、速率限制、WebSocket 注入

### 部署与 CI/CD
- 构建: 前端 `Vite` 产出静态资源；后端 `Node.js`（推荐 `NestJS` 或 `Express` + `TypeScript`）
- 容器化: `Docker` 多阶段构建；`docker-compose` 启动 `web/api/db/redis`
- 环境管理: `.env` 分环境；Secrets 用平台管理（GitHub/Cloud）
- CI: GitHub Actions 流程（Lint→Test→Build→Docker→Deploy）；分支保护与预览环境
- 运行: 反向代理（`Nginx`），HTTPS，蓝绿或滚动部署；日志与指标（`OpenTelemetry` + `pino`）

## 开发计划

### 优先级任务清单
- P0
  - 后端基础框架与项目骨架（API、ORM、配置）
  - 用户认证与授权（注册/登录/JWT/角色/资源归属）
  - 服务器/域名/服务商/设置的 CRUD 接口
  - DNS 记录接口与与服务器的关联机制
- P1
  - 审计服务对接 `Gemini`（后端调用与报告存储）
  - WebSSH 后端代理通道（WebSocket，最小可用）
  - 前端接入真实 API（替换 `localStorage`，统一 API 客户端）
- P2
  - 缓存策略与分页优化（Redis/ETag）
  - 测试完善（单元/集成/E2E）与 CI/CD
  - 样式体系本地化（Tailwind NPM 集成与 Purge）
  - 路由重构（`react-router`）

### 预估工时（工作日，含评审与基本测试）
- 后端骨架（NestJS/Express + Prisma + Postgres/Redis）: 8-12h
- 认证授权（注册/登录/JWT/角色/所有权中间件）: 8-12h
- Providers/Servers/Domains/DNS CRUD + 关系: 12-16h
- 系统设置接口（通知与 DNS 设定）: 6-8h
- 审计服务（Gemini 后端封装与报告存储）: 6-8h
- WebSSH 代理通道（安全最小实现）: 8-12h
- 前端 API 客户端与数据迁移（localStorage→API）: 10-14h
- 缓存/分页/索引优化: 6-8h
- 测试与 CI/CD 初版: 8-12h
- Tailwind 本地化与路由重构: 8-12h

### 集成测试方案
- 测试环境: `docker-compose` 启动 `api/db/redis`，前端指向测试 API 基址
- 用例覆盖
  - 认证: 注册/登录/刷新/退出；错误分支（密码错误、锁定、速率限制）
  - 资源: Providers/Servers/Domains/DNS 完整 CRUD 与所有权校验
  - 设置: 读取/更新与通知字段校验
  - 审计: 触发审计→后端调用→报告落库→前端展示
  - WebSSH: 授权建立连接、命令透传、会话关闭
- 工具与流程: `supertest` + 事务回滚；`Playwright` 前端场景；单测覆盖率阈值 80%+

### 项目里程碑
- M1（周1）: 后端骨架、数据库迁移、基础健康检查
- M2（周2）: 认证授权完成、核心 CRUD 完成
- M3（周3）: 前端切换到真实 API、审计服务打通
- M4（周4）: WebSSH MVP、缓存与分页优化
- M5（周5）: 测试与 CI/CD 完成、样式与路由重构、性能与安全加固

### 风险与应对
- 数据迁移风险（localStorage→后端）: 提供一键导入导出工具与数据兼容层；灰度启用
- 安全风险（凭据与 SSH）: 严禁明文；密钥引用与最小权限；审计日志与速率限制
- 外部 AI 服务不稳定/成本: 增加重试与超时；缓存最近报告；可配置开关与配额
- 架构演进复杂度（路由/样式重构）: 渐进式迁移与路由适配层；按模块切换
- 测试不足导致回归: 设定强制覆盖率与 PR 必跑流水；关键路径端到端用例

## 实现建议

### 前端
- 引入 `react-router` 统一路由与导航守卫；建立全局 `QueryClient`（`react-query`）管理数据
- 建立统一 `apiClient`（`fetch` 或 `axios`）与拦截器（Token/错误处理/重试）
- Tailwind 本地化安装，启用 `postcss` 与 Purge/`content` 配置；组件按原子类规范化

### 后端
- 采用 `NestJS`（模块清晰：Auth/Users/Providers/Servers/Domains/DNS/Settings/Audit/SSH）
- 验证器与错误过滤器全局化；日志结构化与请求关联 `requestId`
- Redis 缓存与队列（审计异步化可选），WebSocket 网关用于 SSH 与通知推送

