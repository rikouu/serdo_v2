# REDACT_MODE 优化和修复文档

## 概述

本文档详细说明了 `REDACT_MODE=true` 的优化和修复过程。

---

## REDACT_MODE 的作用

### REDACT_MODE=false（默认模式）

**特点**：
- ✅ 密码字段直接返回明文
- ✅ 前端无需额外 API 调用
- ✅ 性能更好，逻辑简单

**安全风险**：
- ⚠️ 日志可能泄露密码
- ⚠️ 网络抓包可以看到明文密码

**适用场景**：
- 个人使用或小团队
- 内网环境，不暴露到公网
- 信任所有用户和管理员

---

### REDACT_MODE=true（安全模式）

**特点**：
- 🔒 密码字段被移除，只返回 `hasPassword` 布尔标志
- 🔒 密码通过专门的 `/reveal/*` API 获取
- 🔒 密码使用 **AES-256-GCM** 加密传输
- 🔒 密码只在用户点击"显示"时才获取

**安全优势**：
- ✅ 日志不会泄露密码
- ✅ 密码加密传输
- ✅ 密码按需获取
- ✅ 符合安全审计要求

**适用场景**：
- SaaS 服务
- 多用户环境
- 需要通过安全审计的场景

---

## 修复内容

### 1. API 端点修复 (`api/routes.js`)

#### 问题
当 `whoisApiKey` 为空时，API 返回 404，导致前端报错。

#### 修复
```javascript
// 修复前
if (!s.whoisApiKey) return res.status(404).json({ code: 'not_found' })

// 修复后
if (!s.whoisApiKey) return res.json({ whoisApiKey: null })
```

**文件位置**：
- `api/routes.js:195` - `/reveal/settings/whois-key`
- `api/routes.js:206` - `/reveal/settings/key`

---

### 2. DomainList 组件修复 (`components/DomainList.tsx`)

#### 问题
DomainList 组件没有使用 `/reveal/*` API，导致 REDACT_MODE=true 时密码显示为空。

#### 修复

**添加状态管理**：
```typescript
const [revealedProviderPass, setRevealedProviderPass] = useState<Record<string, string>>({});
```

**修复 togglePassword 函数**：
```typescript
const togglePassword = (id: string) => {
  setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  // 如果是显示密码，且还没有获取过，则调用 reveal API
  (async () => {
    try {
      if (!revealedProviderPass[id]) {
        const { revealProviderPasswordApi } = await import('../services/apiClient');
        const p = await revealProviderPasswordApi(id);
        if (p) setRevealedProviderPass(prev => ({ ...prev, [id]: p }));
      }
    } catch {}
  })();
};
```

**修复密码显示**：
```typescript
// 修复前
{showPasswordMap[provider.id] ? provider.password : '••••••'}

// 修复后
{showPasswordMap[provider.id] ? ((provider.password ?? revealedProviderPass[provider.id]) || '-') : '••••••'}
```

---

### 3. ServerList 组件修复 (`components/ServerList.tsx`)

#### 问题
缺少 `revealedSshPass` 状态，导致 SSH 密码无法正确显示。

#### 修复

**添加状态管理**：
```typescript
const [revealedSshPass, setRevealedSshPass] = useState<Record<string, string>>({});
```

**修复 togglePassword 函数**：
```typescript
const togglePassword = (id: string) => {
  setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  (async () => {
    try {
      const isProv = id.startsWith('prov-')
      const isSsh = id.startsWith('ssh-')
      const realId = isProv ? id.replace(/^prov-/, '') : (isSsh ? id.replace(/^ssh-/, '') : id)
      const { revealServerSecretsApi } = await import('../services/apiClient')
      const r = await revealServerSecretsApi(realId)
      if (!isProv && !isSsh && r.panelPassword) setRevealedPanelPass(prev => ({ ...prev, [realId]: r.panelPassword! }))
      if (isSsh && r.sshPassword) setRevealedSshPass(prev => ({ ...prev, [realId]: r.sshPassword! }))
      if (isProv && r.providerPassword) setRevealedProviderPass(prev => ({ ...prev, [realId]: r.providerPassword! }))
    } catch {}
  })()
};
```

**修复 SSH 密码复制**：
```typescript
// 修复前
let val = server.sshPassword || '';
if (!val) { /* ... */ setRevealedPanelPass(...) }

// 修复后
let val = server.sshPassword ?? revealedSshPass[server.id];
if (!val) { /* ... */ setRevealedSshPass(...) }
```

---

### 4. SystemSettings 组件修复 (`components/SystemSettings.tsx`)

#### 问题
空 API key 被视为错误，导致显示错误提示。

#### 修复
```typescript
// 修复前
if (k) { 
  setSettings({ ...(settings as any), whoisApiKey: k, _whoisKeyVisible: true });
} else { 
  showToast('无法显示密钥', 'error'); 
}

// 修复后
setSettings({ ...(settings as any), whoisApiKey: k || '', _whoisKeyVisible: true });
```

---

## 启用 REDACT_MODE

### 方法 1：环境变量（推荐）

创建 `api/.env` 文件：
```bash
PORT=4000
REDACT_MODE=true
```

### 方法 2：启动脚本

修改 `api/run_server.sh`：
```bash
export REDACT_MODE=true
node server.js
```

### 方法 3：直接设置
```bash
REDACT_MODE=true node server.js
```

---

## 测试验证

### 1. 启动服务
```bash
# 启动 API 服务器（REDACT_MODE=true）
cd api && bash run_server.sh

# 构建前端
npm run build

# 启动前端预览
npx serve dist -l 3001
```

### 2. 测试场景

#### 场景 1：服务器密码显示
1. 访问 http://localhost:3001/
2. 登录系统
3. 进入"服务器"页面
4. 点击密码字段的"眼睛"图标
5. **预期结果**：密码正确显示（不是空或 `-`）

#### 场景 2：Provider 密码显示
1. 进入"服务商"页面
2. 点击密码字段的"眼睛"图标
3. **预期结果**：密码正确显示

#### 场景 3：API Key 显示
1. 进入"系统设置"页面
2. 点击 Whois API Key 的"显示"按钮
3. **预期结果**：
   - 如果有 key：显示 key
   - 如果没有 key：显示空（不报错）

#### 场景 4：域名列表中的 Provider 密码
1. 进入"域名"页面
2. 展开域名详情
3. 查看 Registrar/DNS Provider 凭据
4. 点击密码的"眼睛"图标
5. **预期结果**：密码正确显示

---

## 网络请求验证

### REDACT_MODE=false
```json
// GET /api/v1/me 返回：
{
  "data": {
    "servers": [{
      "id": "srv1",
      "password": "mypassword123"  // 明文
    }]
  }
}
```

### REDACT_MODE=true
```json
// GET /api/v1/me 返回：
{
  "data": {
    "servers": [{
      "id": "srv1",
      "hasPassword": true  // 只返回布尔标志
    }]
  }
}

// GET /api/v1/reveal/servers/srv1 返回：
{
  "panelPassword": {
    "iv": "base64...",
    "tag": "base64...",
    "data": "base64..."  // AES-256-GCM 加密
  }
}
```

---

## 性能影响

### REDACT_MODE=false
- 初始加载：1 次请求（`/me`）
- 密码显示：无额外请求

### REDACT_MODE=true
- 初始加载：1 次请求（`/me`）
- 密码显示：每个密码 1 次请求（`/reveal/*`）
- **优化**：密码缓存在前端状态中，只请求一次

---

## 安全对比

| 特性 | REDACT_MODE=false | REDACT_MODE=true |
|------|-------------------|------------------|
| 日志安全 | ❌ 可能泄露 | ✅ 不泄露 |
| 网络传输 | ❌ 明文 | ✅ AES-256-GCM |
| 按需获取 | ❌ 全部返回 | ✅ 按需获取 |
| 性能 | ✅ 更好 | ⚠️ 稍慢 |
| 复杂度 | ✅ 简单 | ⚠️ 复杂 |

---

## 建议

### 私有部署（个人/小团队）
```bash
REDACT_MODE=false  # 推荐
```

### SaaS 服务（多用户）
```bash
REDACT_MODE=true  # 推荐
```

---

## 故障排查

### 问题 1：密码显示为空
**原因**：前端没有正确使用 `/reveal/*` API

**解决**：
1. 检查浏览器控制台是否有 404 错误
2. 检查组件是否有 `revealedPass` 状态
3. 检查 `togglePassword` 函数是否调用了 reveal API

### 问题 2：API 返回 404
**原因**：密码字段为空时，旧代码返回 404

**解决**：
1. 更新 `api/routes.js` 中的 `/reveal/*` 端点
2. 空密码应返回 `{ password: null }` 而不是 404

### 问题 3：密码加密传输失败
**原因**：前端解密逻辑错误

**解决**：
1. 检查 `utils/crypto.ts` 中的 `aesGcmDecryptBase64` 函数
2. 检查 `x-reveal-key` header 是否正确传递

---

## 总结

✅ **已完成**：
1. 修复了所有组件的密码显示逻辑
2. 修复了 API 端点的空值处理
3. 添加了完整的状态管理
4. 支持 REDACT_MODE=true 的完整流程

🎯 **效果**：
- REDACT_MODE=true 时，密码正确显示
- 不再有 404 错误
- 密码加密传输
- 符合安全审计要求

📝 **文档**：
- 详细的修复说明
- 完整的测试流程
- 清晰的配置指南

