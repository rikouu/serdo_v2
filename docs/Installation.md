# 安装与配置说明

- 前端根目录: `Serdo/`
- 后端目录: `Serdo/api/`

## 前端安装
- 依赖要求: Node.js >= 16
- 先复制环境文件: 将 `.env.example` 复制为 `.env.local`
- 配置变量:
  - `VITE_USE_API=true` 启用后端 API 模式；`false` 使用本地存储
  - `VITE_API_BASE_URL=http://localhost:4000/api/v1` 指向后端
  - `GEMINI_API_KEY=<你的Gemini密钥>` 用于本地 AI 审计（API 模式下由后端处理则可留空）
- 安装依赖并启动:
  - `npm install`
  - `npm run dev`

## 后端安装
- 依赖要求: Node.js >= 16
- 切换到 `api/` 目录
- 复制环境文件: 将 `api/.env.example` 复制为 `api/.env`
- 可用变量:
  - `PORT=4000`
- 安装依赖并启动:
  - `npm install`
  - `npm run dev`

## 端口与跨域
- 前端默认 `http://localhost:3000`
- 后端默认 `http://localhost:4000`
- 后端已启用 `CORS`，允许本地开发联调

## 数据持久化
- 后端数据采用 JSON 文件存储，位于 `api/data/` 下，以 `userId.json` 命名
- 用户信息存储在 `api/data/users.json`

## 依赖说明
- 前端: `React`, `TypeScript`, `Vite`, `lucide-react`, `recharts`, `react-markdown`
- 后端: `express`, `cors`, `dotenv`, `zod`
