# 🔍 会话持久化调试指南

## 问题：F5刷新后自动退出

### 📋 调试步骤

#### 步骤 1: 清除浏览器缓存
```bash
# 方法1: 硬刷新（推荐）
Mac: Cmd + Shift + R
Windows/Linux: Ctrl + Shift + R

# 方法2: 清除所有缓存
1. 打开浏览器开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"
```

#### 步骤 2: 检查 LocalStorage
1. 打开浏览器开发者工具 (F12)
2. 进入 `Application` 标签页
3. 展开 `Local Storage` -> `http://localhost:3000`
4. 查找 `infravault_token` 键

**预期结果**:
- 登录前: 无 `infravault_token` ✅
- 登录后: 有 `infravault_token`，值为长字符串 ✅
- 刷新后: `infravault_token` 依然存在 ✅

#### 步骤 3: 检查控制台日志
1. 打开浏览器控制台 (F12 -> Console)
2. 登录系统
3. 按 F5 刷新
4. 查看控制台输出

**查找以下日志**:
```javascript
// 成功情况
✅ 无错误日志，自动恢复登录

// 失败情况（看看是哪种）
❌ "Session restore failed: unauthorized"  // token 无效
❌ "Session restore failed: network_error" // 网络问题
❌ "Token removed due to 401 error on: /me" // API 返回 401
```

#### 步骤 4: 手动测试 API
```javascript
// 在浏览器控制台执行以下代码

// 1. 检查 token 是否存在
console.log('Token:', localStorage.getItem('infravault_token'))

// 2. 测试 API 调用
fetch('http://localhost:4000/api/v1/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('infravault_token'),
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('API Response:', data))
.catch(err => console.error('API Error:', err))
```

#### 步骤 5: 检查环境变量
```bash
# 确认前端配置
cat .env.local || cat .env

# 应该包含:
VITE_USE_API=true
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

---

## 🐛 常见问题和解决方案

### 问题 1: Token 没有保存
**症状**: 登录后刷新，localStorage 中没有 token

**解决方案**:
1. 检查登录是否真正成功
2. 查看浏览器是否禁用了 localStorage
3. 检查隐私模式（无痕模式会禁用 localStorage）

### 问题 2: Token 存在但依然退出
**症状**: localStorage 中有 token，但刷新后还是退出

**可能原因**:
```javascript
// A. 后端返回 401（token 过期或无效）
// 解决：重新登录获取新 token

// B. CORS 错误
// 解决：检查后端 CORS 配置

// C. 前端代码未加载
// 解决：硬刷新浏览器
```

### 问题 3: 浏览器缓存问题
**症状**: 修改代码后没有生效

**解决方案**:
```bash
# 停止前端服务
Ctrl + C

# 清理缓存
rm -rf node_modules/.vite
rm -rf dist

# 重新启动
npm run dev
```

---

## 🔧 手动修复步骤

如果上述步骤都失败了，尝试以下手动修复：

### 方法 1: 完全重启
```bash
# 1. 停止所有服务
# 终端1: Ctrl + C (停止前端)
# 终端2: Ctrl + C (停止后端)

# 2. 清除浏览器数据
# 打开 http://localhost:3000
# F12 -> Application -> Clear storage -> Clear site data

# 3. 重启服务
cd api
node server.js &

cd ..
npm run dev
```

### 方法 2: 临时调试代码
在 `App.tsx` 第 109 行后添加调试日志：

```typescript
const savedToken = localStorage.getItem('infravault_token');
console.log('🔍 [DEBUG] Saved token:', savedToken ? 'EXISTS' : 'NOT FOUND');
console.log('🔍 [DEBUG] Token length:', savedToken?.length || 0);

if (!savedToken) {
  console.log('❌ [DEBUG] No token found, showing login page');
  setIsAuthChecking(false);
  return;
}
```

### 方法 3: 使用浏览器扩展
安装 `React Developer Tools`:
1. 打开扩展
2. 查看 `App` 组件的 state
3. 确认 `currentUser` 和 `isAuthChecking` 的值

---

## 📊 预期行为对比表

| 操作 | 预期行为 | 实际行为 |
|------|---------|---------|
| 首次访问 | 显示登录页 | ? |
| 登录成功 | 保存 token，显示主界面 | ? |
| F5 刷新 | 自动恢复登录，显示主界面 | ? |
| 登出 | 清除 token，显示登录页 | ? |
| Token 过期 | 清除 token，显示登录页 | ? |

请在上表中标记实际行为。

---

## 🚨 紧急临时方案

如果需要立即使用，可以临时禁用会话检查：

```typescript
// App.tsx 第 104-105 行
// 临时注释掉这两行
// setIsAuthChecking(false);
// return;

// 改为直接恢复会话
setIsAuthChecking(false);
// 不再 return，继续执行
```

**警告**: 此方案仅用于调试，不建议用于生产环境。

---

## 📝 收集信息清单

请提供以下信息以便进一步诊断：

- [ ] 浏览器类型和版本: _______
- [ ] 是否在隐私模式/无痕模式: 是 / 否
- [ ] LocalStorage 中是否有 `infravault_token`: 是 / 否
- [ ] 控制台是否有错误: 是 / 否
- [ ] 错误消息: _______
- [ ] 后端服务是否正常运行: 是 / 否
- [ ] API 健康检查 (curl localhost:4000/api/v1/health): _______

---

## 💡 下一步

根据调试结果：

1. **如果 token 不存在** → 检查登录流程
2. **如果 token 存在但 401** → 检查后端 JWT 验证
3. **如果网络错误** → 检查后端服务和 CORS
4. **如果代码未更新** → 硬刷新浏览器

需要更详细的帮助，请提供上述信息。

