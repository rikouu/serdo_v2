# 密码显示功能优化文档

## 概述

本文档详细说明了系统设置中密码字段的显示/隐藏功能优化。

---

## 修复内容

### 1. API Key 显示逻辑优化

#### 问题
点击 "Show" 按钮后，即使没有修改内容，也会显示 "Modified, will be saved" 提示。

#### 原因
```typescript
// 错误的逻辑：点击 Show 按钮时就标记为已编辑
setSecretFieldsEdited(prev => ({ ...prev, whoisApiKey: true }));
```

#### 修复
```typescript
// 修复后：只在点击 Show 时显示，不标记为已编辑
// 只有在 input onChange 时才标记为已编辑
setSettings({ ...(settings as any), whoisApiKey: k || '', _whoisKeyVisible: true });
// 不调用 setSecretFieldsEdited
```

**文件位置**：`components/SystemSettings.tsx:433-447`

---

### 2. Bark Device Key 添加显示/隐藏按钮

#### 修复前
```typescript
<input 
  type={secretFieldsEdited.barkKey ? 'text' : 'password'} 
  // 没有显示/隐藏按钮
/>
```

#### 修复后
```typescript
<div className="flex items-center gap-2">
  <input 
    type={(settings.notifications.bark as any)._barkKeyVisible ? 'text' : 'password'} 
    // ...
  />
  <button onClick={() => {
    // 切换显示/隐藏
    setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, _barkKeyVisible: !visible}}});
  }}>
    {visible ? <EyeOff /> : <Eye />}
  </button>
</div>
```

**新增功能**：
- ✅ 添加眼睛图标按钮
- ✅ 点击切换显示/隐藏
- ✅ 不会触发 "Modified" 提示
- ✅ 更新提示文案："Device Key 已保存（点击眼睛图标可查看）"

**文件位置**：`components/SystemSettings.tsx:697-743`

---

### 3. SMTP Password 添加显示/隐藏按钮

#### 修复前
```typescript
<input 
  type="password"  // 固定为 password 类型
  // 没有显示/隐藏按钮
/>
```

#### 修复后
```typescript
<div className="flex items-center gap-2">
  <input 
    type={(settings.notifications.smtp as any)._smtpPasswordVisible ? 'text' : 'password'} 
    // ...
  />
  <button onClick={() => {
    // 切换显示/隐藏
    setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, _smtpPasswordVisible: !visible}}});
  }}>
    {visible ? <EyeOff /> : <Eye />}
  </button>
</div>
```

**新增功能**：
- ✅ 添加眼睛图标按钮
- ✅ 点击切换显示/隐藏
- ✅ 不会触发 "Modified" 提示
- ✅ 更新提示文案："密码已保存（点击眼睛图标可查看）"

**文件位置**：`components/SystemSettings.tsx:819-865`

---

### 4. 清理临时字段

#### 修复
在保存设置时，清理所有临时的显示状态字段：

```typescript
// 清理临时字段
delete saveData._whoisKeyVisible;
delete saveData.hasWhoisApiKey;
if (saveData.notifications?.bark) {
  delete saveData.notifications.bark.hasKey;
  delete saveData.notifications.bark._barkKeyVisible;  // 新增
}
if (saveData.notifications?.smtp) {
  delete saveData.notifications.smtp.hasPassword;
  delete saveData.notifications.smtp._smtpPasswordVisible;  // 新增
}
```

**文件位置**：`components/SystemSettings.tsx:169-178`

---

### 5. 导入图标

#### 修复
添加 `Eye` 和 `EyeOff` 图标：

```typescript
import { Globe, Bell, Mail, Save, ChevronDown, Check, LayoutGrid, List, MousePointerClick, Menu, Eye, EyeOff } from 'lucide-react';
```

**文件位置**：`components/SystemSettings.tsx:8`

---

## 功能对比

### 修复前

| 字段 | 显示/隐藏按钮 | 点击 Show 后提示 |
|------|--------------|-----------------|
| API Key | ✅ 有 | ❌ 错误提示 "Modified" |
| Bark Device Key | ❌ 无 | - |
| SMTP Password | ❌ 无 | - |

### 修复后

| 字段 | 显示/隐藏按钮 | 点击 Show 后提示 | 修改后提示 |
|------|--------------|-----------------|-----------|
| API Key | ✅ 有 | ✅ 无误提示 | ✅ "Modified, will be saved" |
| Bark Device Key | ✅ 有 | ✅ 无误提示 | ✅ "已修改，保存后生效" |
| SMTP Password | ✅ 有 | ✅ 无误提示 | ✅ "已修改，保存后生效" |

---

## 用户体验改进

### 1. 一致性
所有密码/密钥字段都有统一的显示/隐藏功能。

### 2. 清晰的状态提示

#### 已保存状态
```
✓ API Key 已保存（点击显示可查看或修改）
✓ Device Key 已保存（点击眼睛图标可查看）
✓ 密码已保存（点击眼睛图标可查看）
```

#### 已修改状态
```
⚠ 已修改，保存后生效
⚠ Modified, will be saved
```

### 3. 正确的编辑状态跟踪

- **点击显示按钮**：只显示内容，不标记为已编辑
- **修改输入框内容**：标记为已编辑，显示保存提示

---

## 技术实现

### 状态管理

#### 临时显示状态（不保存到后端）
```typescript
_whoisKeyVisible: boolean       // API Key 是否可见
_barkKeyVisible: boolean        // Bark Key 是否可见
_smtpPasswordVisible: boolean   // SMTP 密码是否可见
```

#### 编辑状态（触发保存提示）
```typescript
secretFieldsEdited: {
  whoisApiKey: boolean,
  barkKey: boolean,
  smtpPassword: boolean
}
```

### 显示逻辑

```typescript
// 1. 如果点击了显示按钮，显示明文
if (_visible) return actualValue

// 2. 如果用户已编辑，显示用户输入
if (edited) return inputValue

// 3. 如果服务器有保存，显示占位符
if (hasValue) return '••••••••'

// 4. 否则显示空
return ''
```

---

## 测试验证

### 测试场景 1：API Key 显示
1. 系统设置 → Whois API 配置
2. 点击 "显示" 按钮
3. **预期结果**：
   - ✅ API Key 显示明文
   - ✅ 不显示 "Modified" 提示
   - ✅ 可以点击 "隐藏" 按钮

### 测试场景 2：API Key 修改
1. 点击 "显示" 按钮
2. 修改输入框内容
3. **预期结果**：
   - ✅ 显示 "已修改，保存后生效" 提示
   - ✅ 点击保存后，新值被保存

### 测试场景 3：Bark Device Key
1. 通知设置 → Bark Notification
2. 点击眼睛图标
3. **预期结果**：
   - ✅ Device Key 显示明文
   - ✅ 不显示 "Modified" 提示
   - ✅ 可以点击眼睛图标隐藏

### 测试场景 4：SMTP Password
1. 通知设置 → Email Notification
2. 点击眼睛图标
3. **预期结果**：
   - ✅ 密码显示明文
   - ✅ 不显示 "Modified" 提示
   - ✅ 可以点击眼睛图标隐藏

---

## REDACT_MODE 兼容性

### REDACT_MODE=false
- 密码字段直接返回明文
- 显示/隐藏按钮正常工作
- 不需要调用 reveal API

### REDACT_MODE=true
- 密码字段返回 `hasPassword: true`
- 点击显示按钮时调用 reveal API
- 密码加密传输（AES-256-GCM）
- 显示/隐藏按钮正常工作

---

## 总结

✅ **已完成**：
1. 修复 API Key 显示逻辑，不再误提示 "Modified"
2. 为 Bark Device Key 添加显示/隐藏按钮
3. 为 SMTP Password 添加显示/隐藏按钮
4. 统一所有密码字段的用户体验
5. 优化状态提示文案

🎯 **效果**：
- 所有密码字段都有显示/隐藏功能
- 点击显示不会触发误提示
- 只有真正修改内容才显示 "Modified" 提示
- 用户体验更加一致和友好

📝 **相关文档**：
- `REDACT_MODE_OPTIMIZATION.md` - REDACT_MODE 详细说明
- `README.md` - 项目整体文档

