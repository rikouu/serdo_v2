# 🧪 密码查看功能测试指南

## 快速测试步骤

### 1. 开发环境测试 ✅

**前提**: 前端和后端都在运行
- 前端: http://localhost:3000
- 后端: http://localhost:4000

**测试步骤**:

```bash
# 打开浏览器访问
http://localhost:3000

# 打开浏览器控制台 (F12)
```

#### 测试1: 首次查看密码

1. 登录系统 (admin/admin)
2. 进入"服务器管理"
3. 添加一个测试服务器，填写密码
4. 保存后，点击密码字段的"👁️ 查看"按钮
5. **预期结果**:
   - ✅ 密码正常显示
   - ✅ 控制台显示: `🔑 [REVEAL] 生成新的密钥`

#### 测试2: 刷新页面后查看

1. 在测试1的基础上
2. 按 **F5** 刷新页面
3. 重新点击"👁️ 查看"按钮
4. **预期结果**:
   - ✅ 密码仍然正常显示 (这是关键！)
   - ✅ 控制台显示: `🔑 [REVEAL] 使用已有密钥`

#### 测试3: 复制功能

1. 点击密码旁的"📋 复制"按钮
2. **预期结果**:
   - ✅ 显示"复制成功"提示
   - ✅ 剪贴板包含正确的密码

#### 测试4: 多次刷新

1. 连续刷新页面 3-5 次 (F5)
2. 每次刷新后都点击"查看"
3. **预期结果**:
   - ✅ 每次都能正常显示密码
   - ✅ 控制台显示: `🔑 [REVEAL] 使用已有密钥`

#### 测试5: 关闭标签页重开

1. 关闭当前标签页
2. 重新打开 http://localhost:3000
3. 登录后查看密码
4. **预期结果**:
   - ✅ 密码正常显示
   - ✅ 控制台显示: `🔑 [REVEAL] 生成新的密钥` (因为sessionStorage已清除)

### 2. 验证 sessionStorage

在浏览器控制台执行：

```javascript
// 1. 检查密钥是否存在
sessionStorage.getItem('infravault_reveal_key')
// 应该返回一个长字符串（如果已经查看过密码）

// 2. 手动清除密钥测试
sessionStorage.removeItem('infravault_reveal_key')
// 刷新页面后，再次查看密码，应该生成新密钥

// 3. 查看所有 sessionStorage
for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    console.log(key, ':', sessionStorage.getItem(key));
}
```

### 3. 检查控制台日志

正常的日志应该类似：

```
🔑 [API] getHeaders - token: 存在 (123字符)
📡 [API] 请求: /reveal/servers/abc123
🔑 [REVEAL] 使用已有密钥
📡 [API] 响应: /reveal/servers/abc123 - 状态 200
✅ [API] 成功: /reveal/servers/abc123 {panelPassword: {...}, ...}
```

### 4. 测试其他密码字段

所有这些字段都应该能正常查看和复制：

- ✅ 服务器面板密码
- ✅ 服务器 SSH 密码
- ✅ 供应商密码
- ✅ Whois API Key
- ✅ Bark Key
- ✅ SMTP 密码

## 🐛 常见问题排查

### 问题: 仍然显示空白

```bash
# 1. 检查浏览器控制台是否有错误
# 2. 清除浏览器缓存
Ctrl+Shift+Delete -> 清除所有

# 3. 检查 sessionStorage 是否被禁用
sessionStorage.setItem('test', 'ok')
// 如果报错，说明 sessionStorage 被禁用

# 4. 尝试无痕模式
Ctrl+Shift+N (Chrome)
Ctrl+Shift+P (Firefox)
```

### 问题: "cannot reveal key" 错误

```bash
# 1. 检查后端是否启用了 REDACT_MODE
# 查看后端日志或 .env 文件

# 2. 清除所有数据重新登录
localStorage.clear()
sessionStorage.clear()
# 刷新页面重新登录

# 3. 检查控制台是否有 API 错误
```

### 问题: 复制功能不工作

```bash
# 1. 确认密码能正常显示
# 2. 检查浏览器剪贴板权限
# 3. 尝试手动选择文本复制
```

## 📊 生产环境测试清单

部署到生产环境后，需要测试：

- [ ] 清除浏览器缓存
- [ ] 访问生产环境 URL
- [ ] 登录系统
- [ ] 添加新服务器并设置密码
- [ ] 点击查看密码 → 应该正常显示
- [ ] F5 刷新页面
- [ ] 再次点击查看 → 应该仍然正常显示 ✅
- [ ] 测试复制功能
- [ ] 关闭浏览器重新打开
- [ ] 重新登录并查看密码
- [ ] 检查其他密码字段（域名、供应商等）

## 🔍 调试技巧

### 查看网络请求

1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 点击"查看密码"
4. 查找 `/reveal/` 开头的请求
5. 检查:
   - Request Headers 中的 `x-reveal-key`
   - Response 中的加密数据

### 模拟旧版本行为

如果想验证修复效果，可以临时注释掉修复代码：

```javascript
// const key = getRevealKey()  // 新代码
const key = bytesToB64(crypto.getRandomValues(new Uint8Array(32)).buffer)  // 旧代码
```

这样就会重现旧的问题（刷新后无法查看）。

## ✅ 成功标志

所有测试通过后，应该看到：

1. ✅ 密码可以正常查看
2. ✅ 刷新页面后仍然可以查看
3. ✅ 复制功能正常
4. ✅ 关闭标签页后重开正常
5. ✅ 控制台没有错误
6. ✅ 日志显示正确的密钥使用

---

**测试完成**: 🎉  
**问题修复**: ✅  
**可以部署**: 👍

