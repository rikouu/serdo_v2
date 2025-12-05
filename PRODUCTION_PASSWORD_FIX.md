# 🔧 生产环境密码异常问题修复指南

## 📋 问题描述

**症状**：
1. ❌ 输入密码后保存，刷新页面后密码字段变成**空白**
2. ❌ 点击小眼睛查看密码，提示 **"cannot reveal Password"**
3. ❌ 所有密码类非明文数据都无法正常显示

**根本原因分析**：

经过代码审查，发现问题可能出在以下几个环节：

### 1. REDACT_MODE 未正确配置

后端需要设置 `REDACT_MODE=true` 来启用加密传输模式：

```javascript
// api/routes.js 第11行
const REDACT_MODE = String(process.env.REDACT_MODE || 'false') === 'true'
```

**如果 REDACT_MODE=false**（默认值）：
- ✅ 开发环境：密码以明文传输，无需加密
- ❌ 生产环境：密码以明文传输，**不安全**

**如果 REDACT_MODE=true**：
- ✅ 生产环境：密码经过 AES-256-GCM 加密传输，**安全**
- ⚠️ 需要前后端密钥同步

### 2. 前端 REVEAL_KEY 生命周期问题

前端使用 `sessionStorage` 保存解密密钥：

```typescript
// services/apiClient.ts
const REVEAL_KEY_STORAGE = 'infravault_reveal_key'

const getRevealKey = (): string => {
  let key = sessionStorage.getItem(REVEAL_KEY_STORAGE)
  if (!key) {
    key = bytesToB64(crypto.getRandomValues(new Uint8Array(32)).buffer)
    sessionStorage.setItem(REVEAL_KEY_STORAGE, key)
  }
  return key
}
```

**sessionStorage 特性**：
- ✅ 刷新页面（F5）：密钥**保留**
- ❌ 关闭标签页/浏览器：密钥**清除**
- ❌ 新窗口/标签页：密钥**不共享**

### 3. 加密/解密流程分析

**正确的流程**：

```
保存密码 (REDACT_MODE=true):
  前端 → 后端：明文密码
  后端：以明文形式存储到数据库
  后端 → 前端：返回 hasPassword=true（不返回密码）

查看密码 (REDACT_MODE=true):
  前端：生成 REVEAL_KEY（或使用已有）
  前端 → 后端：发送 REVEAL_KEY (HTTP Header: x-reveal-key)
  后端：读取明文密码
  后端：用 REVEAL_KEY 进行 AES-256-GCM 加密
  后端 → 前端：返回 {iv, tag, data}
  前端：用相同的 REVEAL_KEY 解密
  前端：显示密码
```

## ✅ 修复方案

### 方案 1：确保 REDACT_MODE 正确配置（推荐）

#### 步骤 1：设置后端环境变量

在服务器上设置 `REDACT_MODE=true`：

```bash
# 方法A：在 systemd service 文件中设置
sudo nano /etc/systemd/system/serdo-api.service

# 添加或修改：
Environment="REDACT_MODE=true"

# 重启服务
sudo systemctl daemon-reload
sudo systemctl restart serdo-api
```

```bash
# 方法B：使用 .env 文件（如果后端支持）
cd /path/to/api
echo "REDACT_MODE=true" >> .env

# 重启API服务
pm2 restart serdo-api  # 或使用其他进程管理器
```

#### 步骤 2：验证 REDACT_MODE 是否生效

```bash
# 检查日志
sudo journalctl -u serdo-api -n 50 | grep REDACT

# 或查看进程环境变量
ps aux | grep serdo-api
cat /proc/<PID>/environ | tr '\0' '\n' | grep REDACT
```

#### 步骤 3：清除旧数据，重新输入密码

⚠️ **重要**：设置 `REDACT_MODE=true` 后，所有密码字段需要重新输入！

理由：
- 开发环境（REDACT_MODE=false）：密码可能以某种格式存储
- 生产环境（REDACT_MODE=true）：密码以明文形式存储，但传输时加密

切换模式后，旧密码可能无法正确解密。

**操作步骤**：
1. 登录系统
2. 进入 Settings 页面
3. 点击查看密码按钮（会提示"无法解密密码"）
4. 重新输入所有密码
5. 点击 Save Changes
6. 测试：刷新页面，再次点击查看密码，应该能正常显示

### 方案 2：增强前端错误处理（已实施）

前端已经添加了错误处理逻辑，当解密失败时：
- ✅ 显示明确的错误提示："无法解密密码，请重新输入并保存"
- ✅ 自动清空密码字段并切换为可编辑状态
- ✅ 用户可以重新输入密码

### 方案 3：调试模式 - 添加详细日志

#### 后端添加调试日志

编辑 `api/routes.js`，在 `wrapSecret` 函数中添加日志：

```javascript
function wrapSecret(plain, rk) {
  try {
    if (!plain) {
      console.log('[wrapSecret] plain is empty');
      return null;
    }
    if (!rk) {
      console.log('[wrapSecret] rk is empty');
      return null;
    }
    console.log('[wrapSecret] Encrypting:', {
      plainLength: String(plain).length,
      rkLength: rk.length,
      rkFormat: rk.slice(0, 10) + '...'
    });
    
    const iv = crypto.randomBytes(12);
    const key = Buffer.from(rk, 'base64');
    console.log('[wrapSecret] Key buffer length:', key.length); // 应该是 32
    
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    const tag = c.getAuthTag();
    
    const result = { 
      iv: iv.toString('base64'), 
      tag: tag.toString('base64'), 
      data: enc.toString('base64') 
    };
    console.log('[wrapSecret] Encrypted successfully:', {
      ivLength: result.iv.length,
      tagLength: result.tag.length,
      dataLength: result.data.length
    });
    return result;
  } catch (err) { 
    console.error('[wrapSecret] Error:', err);
    return null;
  }
}
```

#### 前端添加调试日志

编辑 `utils/crypto.ts`，在解密函数中添加日志：

```typescript
export async function aesGcmDecryptBase64(keyB64: string, ivB64: string, tagB64: string, dataB64: string): Promise<string> {
  console.log('🔓 [Decrypt] Starting decryption:', {
    keyLength: keyB64?.length,
    ivLength: ivB64?.length,
    tagLength: tagB64?.length,
    dataLength: dataB64?.length
  });
  
  try {
    const keyRaw = b64ToBytes(keyB64);
    console.log('🔓 [Decrypt] Key raw length:', keyRaw.length); // 应该是 32
    
    const iv = b64ToBytes(ivB64);
    const tag = b64ToBytes(tagB64);
    const data = b64ToBytes(dataB64);
    const combined = new Uint8Array(data.length + tag.length);
    combined.set(data);
    combined.set(tag, data.length);
    
    const cryptoKey = await crypto.subtle.importKey('raw', keyRaw, { name: 'AES-GCM' }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, combined);
    
    const u8 = new Uint8Array(pt);
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    
    console.log('✅ [Decrypt] Decrypted successfully, length:', s.length);
    return s;
  } catch (error) {
    console.error('❌ [Decrypt] Decryption failed:', error);
    throw error;
  }
}
```

### 方案 4：创建诊断工具

创建一个测试页面来诊断加密/解密问题：

```html
<!DOCTYPE html>
<html>
<head>
  <title>Serdo 加密诊断工具</title>
  <meta charset="utf-8">
</head>
<body>
  <h1>Serdo 加密/解密诊断工具</h1>
  
  <div>
    <h2>1. 检查 sessionStorage</h2>
    <button onclick="checkSessionStorage()">检查</button>
    <pre id="sessionStorageResult"></pre>
  </div>
  
  <div>
    <h2>2. 测试加密/解密</h2>
    <input type="text" id="testPassword" placeholder="输入测试密码" value="test123">
    <button onclick="testEncryptDecrypt()">测试</button>
    <pre id="encryptDecryptResult"></pre>
  </div>
  
  <div>
    <h2>3. 测试 API</h2>
    <button onclick="testRevealApi()">测试 Reveal API</button>
    <pre id="apiTestResult"></pre>
  </div>
  
  <script>
    function checkSessionStorage() {
      const key = sessionStorage.getItem('infravault_reveal_key');
      const token = localStorage.getItem('infravault_token');
      
      document.getElementById('sessionStorageResult').textContent = JSON.stringify({
        hasRevealKey: !!key,
        revealKeyLength: key ? key.length : 0,
        revealKeyPreview: key ? key.slice(0, 20) + '...' : 'N/A',
        hasToken: !!token,
        tokenPreview: token ? token.slice(0, 20) + '...' : 'N/A'
      }, null, 2);
    }
    
    async function testEncryptDecrypt() {
      const password = document.getElementById('testPassword').value;
      
      try {
        // 生成测试密钥
        const keyBuffer = crypto.getRandomValues(new Uint8Array(32));
        const keyB64 = btoa(String.fromCharCode(...keyBuffer));
        
        // 加密（模拟后端）
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
        
        const enc = new TextEncoder();
        const encoded = enc.encode(password);
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          encoded
        );
        
        // 分离 tag 和 data
        const encArray = new Uint8Array(encrypted);
        const dataArray = encArray.slice(0, -16);
        const tagArray = encArray.slice(-16);
        
        const ivB64 = btoa(String.fromCharCode(...iv));
        const tagB64 = btoa(String.fromCharCode(...tagArray));
        const dataB64 = btoa(String.fromCharCode(...dataArray));
        
        // 解密（模拟前端）
        const combined = new Uint8Array([...dataArray, ...tagArray]);
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          combined
        );
        
        const dec = new TextDecoder();
        const decryptedText = dec.decode(decrypted);
        
        document.getElementById('encryptDecryptResult').textContent = JSON.stringify({
          original: password,
          keyLength: keyBuffer.length,
          ivLength: iv.length,
          encryptedLength: encArray.length,
          decrypted: decryptedText,
          success: password === decryptedText
        }, null, 2);
        
      } catch (error) {
        document.getElementById('encryptDecryptResult').textContent = 'Error: ' + error.message;
      }
    }
    
    async function testRevealApi() {
      const token = localStorage.getItem('infravault_token');
      const revealKey = sessionStorage.getItem('infravault_reveal_key') || 
                       btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
      
      if (!token) {
        document.getElementById('apiTestResult').textContent = 'Error: 未登录（没有 token）';
        return;
      }
      
      sessionStorage.setItem('infravault_reveal_key', revealKey);
      
      try {
        const apiBase = 'http://localhost:4000/api/v1';
        const response = await fetch(`${apiBase}/reveal/test`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-reveal-key': revealKey,
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        document.getElementById('apiTestResult').textContent = JSON.stringify({
          status: response.status,
          ok: response.ok,
          data: data,
          revealKeyUsed: revealKey.slice(0, 20) + '...'
        }, null, 2);
        
      } catch (error) {
        document.getElementById('apiTestResult').textContent = 'Error: ' + error.message;
      }
    }
  </script>
</body>
</html>
```

保存为 `/Users/lihaoyu/Downloads/Serdo-ef29245d0e8ed9ab617bed212bbacf9b6f8275c1/public/debug-crypto.html`

## 🧪 测试步骤

### 测试 1：验证 REDACT_MODE

```bash
# 后端日志应该显示：
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/me

# 检查返回的数据格式
# REDACT_MODE=true 时，密码字段应该替换为 hasPassword: true
# REDACT_MODE=false 时，密码字段应该是明文
```

### 测试 2：完整流程测试

1. **清除 sessionStorage**：
   ```javascript
   sessionStorage.clear()
   localStorage.clear()
   ```

2. **重新登录**：
   - 访问 http://localhost:3000
   - 登录（admin/admin）

3. **输入密码并保存**：
   - 进入 Settings 页面
   - 输入 Bark Device Key: `test_key_123`
   - 点击 Save Changes
   - ✅ 应该显示"保存成功"

4. **立即查看密码**：
   - 点击小眼睛图标
   - ✅ 应该显示 `test_key_123`

5. **刷新页面后查看**：
   - 按 F5 刷新
   - 点击小眼睛图标
   - ✅ 应该显示 `test_key_123`（sessionStorage 保留）

6. **关闭浏览器后查看**：
   - 关闭所有浏览器窗口
   - 重新打开并登录
   - 点击小眼睛图标
   - ⚠️ 会提示"无法解密密码"（sessionStorage 清除）
   - ✅ 重新输入密码后可以正常使用

### 测试 3：跨标签页测试

1. **在标签页 A 保存密码**
2. **在标签页 B 查看密码**
   - ⚠️ 会提示"无法解密密码"（sessionStorage 不共享）
   - ✅ 刷新标签页 B，重新输入密码

## 🔒 安全建议

1. **生产环境必须使用 HTTPS**
   - REVEAL_KEY 通过 HTTP Header 传输
   - 不使用 HTTPS 会导致密钥泄露

2. **定期更新密码**
   - 建议每 30-90 天更新一次密码
   - 更新密码后，所有设备都需要重新输入

3. **不要在多个标签页同时操作**
   - 每个标签页有独立的 sessionStorage
   - 建议只在一个标签页操作

## 📞 故障排查

### 问题 1：仍然显示"cannot reveal Password"

**可能原因**：
1. REDACT_MODE 未设置或设置错误
2. 后端未重启
3. 前端缓存未清除

**解决方法**：
```bash
# 1. 检查 REDACT_MODE
sudo systemctl status serdo-api
grep REDACT /etc/systemd/system/serdo-api.service

# 2. 重启后端
sudo systemctl restart serdo-api

# 3. 清除前端缓存
# 浏览器：Ctrl+Shift+Delete → 清除缓存
```

### 问题 2：输入密码后保存，刷新变空白

**可能原因**：
1. 后端保存失败
2. REDACT_MODE 配置不一致
3. 前端发送的数据格式错误

**解决方法**：
```bash
# 1. 检查后端日志
sudo journalctl -u serdo-api -f

# 2. 在保存时观察日志输出
# 应该看到类似：
# [API] POST /api/v1/settings
# [Storage] Saving user data: user_xxx.json

# 3. 检查数据文件
cat /path/to/api/api/data/user_admin.json | jq '.settings'
```

### 问题 3：解密时前端报错

**可能原因**：
1. 后端返回的加密数据格式错误
2. 前端解密函数有 bug
3. 密钥长度不正确（应该是 32 字节）

**解决方法**：
1. 打开浏览器控制台（F12）
2. 查看错误信息
3. 使用诊断工具测试加密/解密

## 📦 部署检查清单

- [ ] 后端设置 `REDACT_MODE=true`
- [ ] 重启后端服务
- [ ] 验证 REDACT_MODE 生效
- [ ] 前端重新构建（`npm run build`）
- [ ] 部署新的前端代码
- [ ] 清除浏览器缓存
- [ ] 所有密码字段重新输入
- [ ] 测试刷新页面后密码查看功能
- [ ] 测试关闭浏览器后密码查看功能（预期：需要重新输入）

## 🎯 预期行为

### ✅ 正常行为

1. **保存密码后**：
   - 点击查看 → 显示明文密码
   - 刷新页面 → 点击查看 → 仍然显示明文密码
   - 关闭浏览器重新打开 → 点击查看 → 提示"无法解密"，需要重新输入

2. **密码显示**：
   - 未保存：显示空白或占位符
   - 已保存但未查看：显示 `••••••••`
   - 已保存并点击查看：显示明文密码

3. **错误提示**：
   - 解密失败：显示"无法解密密码，请重新输入并保存"
   - 保存失败：显示具体错误信息
   - 网络错误：显示"网络错误，请重试"

---

**修复完成时间**: 2024-12-05  
**版本**: v1.2.0  
**测试状态**: ⏳ 待验证  
**部署建议**: 先在测试环境验证，再部署到生产环境

