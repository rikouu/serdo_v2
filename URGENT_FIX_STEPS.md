# 🚨 紧急修复步骤 - 会话刷新问题

## 问题原因
**缺少环境配置文件 `.env.local`**，导致系统使用本地存储模式而不是 API 模式。

---

## ✅ 修复步骤（必须按顺序执行）

### 步骤 1: 停止前端服务
在运行前端的终端中：
```bash
按 Ctrl + C
```

### 步骤 2: 确认环境文件
```bash
cd /Users/lihaoyu/Downloads/Serdo-ef29245d0e8ed9ab617bed212bbacf9b6f8275c1
cat .env.local
```

应该看到：
```
VITE_USE_API=true
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### 步骤 3: 重新启动前端
```bash
npm run dev
```

### 步骤 4: 清除浏览器数据
1. 打开 http://localhost:3000
2. 按 F12 打开开发者工具
3. 进入 `Application` 标签页
4. 点击 `Clear storage`
5. 点击 `Clear site data` 按钮

### 步骤 5: 重新登录并测试
1. 刷新浏览器
2. 使用 admin/admin 登录
3. 登录成功后，按 F5 刷新页面
4. **应该自动保持登录状态** ✅

---

## 🔍 验证步骤

### 检查 1: 环境变量
在浏览器控制台执行：
```javascript
console.log('VITE_USE_API:', import.meta.env.VITE_USE_API)
console.log('API Base:', import.meta.env.VITE_API_BASE_URL)
```

**预期输出**:
```
VITE_USE_API: true
API Base: http://localhost:4000/api/v1
```

### 检查 2: Token 存储
登录后，在浏览器控制台执行：
```javascript
console.log('Token:', localStorage.getItem('infravault_token'))
```

**预期输出**: 一个长字符串（JWT token）

### 检查 3: 查看调试日志
刷新页面后，在控制台应该看到：
```
🔍 [Session] 开始会话恢复检查
🔍 [Session] useApi = true
🔍 [Session] savedToken = 存在 (XXX字符)
⏳ [Session] 正在调用 getMeApi()...
📡 [API] 请求: /me
📡 [API] 响应: /me - 状态 200
✅ [API] 成功: /me
✅ [Session] 会话恢复成功，用户: admin
🏁 [Session] 会话检查完成
```

---

## ❓ 如果还是不行

### 方案 A: 完全重置
```bash
# 1. 停止所有服务
# 前端终端: Ctrl+C
# 后端终端: Ctrl+C

# 2. 清除缓存
rm -rf node_modules/.vite
rm -rf dist

# 3. 重启后端
cd api
node server.js

# 4. 重启前端（新终端）
cd ..
npm run dev

# 5. 清除浏览器所有数据
# F12 -> Application -> Clear storage -> Clear site data

# 6. 重新访问和登录
```

### 方案 B: 检查具体错误
查看控制台中以下关键日志：
- `🔍 [Session]` - 会话恢复流程
- `📡 [API]` - API 调用情况
- `❌` - 错误信息
- `🗑️` - Token 被删除的原因

---

## 📊 问题对照表

| 现象 | 原因 | 状态 |
|------|------|------|
| 控制台无错误但刷新退出 | 缺少 .env.local | ✅ 已修复 |
| 控制台显示 useApi = false | 环境变量未加载 | 需重启 |
| 控制台显示 useApi = undefined | 同上 | 需重启 |
| 控制台显示 token 不存在 | 需重新登录 | 正常 |

---

## 🎯 预期结果

完成修复后：

✅ 登录后，localStorage 中会保存 `infravault_token`
✅ 刷新页面后，自动调用 `/api/v1/me` 恢复会话
✅ 无需重新登录，直接进入主界面
✅ 控制台显示详细的调试日志

---

## 📞 如果仍有问题

请提供以下信息：

1. 控制台的完整日志（包括所有 🔍 [Session] 和 📡 [API] 日志）
2. localStorage 中的 token 值（前20个字符即可）
3. 浏览器和操作系统版本

这样我可以进一步帮助你排查！

