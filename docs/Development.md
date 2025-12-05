# 开发说明

## 项目结构
- 前端: 见 `docs/ProjectSummary.md` 的架构与组件清单
- 后端: `api/` 目录，Express + TypeScript，文件存储

## 开发环境
- 前端: `npm run dev` 启动 Vite，端口 `3000`
- 后端: `npm run dev` 启动 API，端口 `4000`
- 通过 `.env.local` 设置 `VITE_USE_API` 控制数据源

## 接口约定（RESTful /api/v1）
- 认证
  - `POST /auth/register` → `{user}`
  - `POST /auth/login` → `{token,user}`；`Authorization: Bearer <token>` 访问其他接口
- 资源
  - `GET/POST/DELETE /providers`
  - `GET/POST/DELETE /servers`
  - `GET/POST/DELETE /domains`
- 设置
  - `GET /settings`，`PUT /settings`
- 审计
  - `POST /audit/run` → `{report}`

## 数据模型
- 详见 `api/src/types.ts` 与前端 `types.ts`
- 后端使用 `api/data/<userId>.json` 按用户分区持久化

## 测试与联调建议
- 后端: 使用 `curl` 或 `REST Client` 验证接口
- 前端: 将 `VITE_USE_API=true`，登录后进行 CRUD 操作验证
- 建议增加端到端测试（`Playwright`/`Cypress`），覆盖登录、CRUD、设置、审计

## 部署与 CI/CD（建议）
- 容器化: 分别构建前端静态资源与后端 Node 服务
- 反向代理: `Nginx` 配置前端静态与 `/api` 转发
- CI: GitHub Actions（Lint→Test→Build→Docker→Deploy）
- 环境与密钥: 使用平台 Secrets 管理；禁用明文存储

## 后续演进
- 替换文件存储为数据库（PostgreSQL + Prisma）
- 引入 `react-router` 与 `react-query` 增强前端数据管理
- 实现 WebSSH 后端代理与权限控制
