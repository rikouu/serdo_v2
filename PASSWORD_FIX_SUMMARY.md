# 密码异常问题修复摘要

## 📋 问题

部署到服务器后：
- ❌ 输入密码保存，刷新页面后变空白
- ❌ 点击小眼睛查看提示 "cannot reveal Password"
- ❌ 所有密码类非明文数据异常

## 🎯 根本原因

**环境变量 `REDACT_MODE` 未正确配置**

```javascript
// api/routes.js
const REDACT_MODE = String(process.env.REDACT_MODE || 'false') === 'true'
```

- `REDACT_MODE=false` (默认): 密码明文传输，开发环境
- `REDACT_MODE=true` (需要): 密码加密传输，生产环境

**问题流程**:
1. 生产环境默认 `REDACT_MODE=false`
2. 密码保存后，后端以明文存储
3. 前端尝试用加密方式获取密码
4. 加密/解密不匹配 → 解密失败 → 显示空白

## ✅ 解决方案

### 快速修复（推荐）

```bash
# 运行自动修复脚本
./scripts/fix-production-password.sh

# 脚本会:
# 1. 设置 REDACT_MODE=true
# 2. 生成随机 JWT_SECRET
# 3. 重启后端服务
# 4. 提供后续操作指引
```

### 手动修复

#### 1. 配置后端

```bash
# 创建 api/.env 文件
cd api
cat > .env << 'EOF'
REDACT_MODE=true
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
PORT=4000
EOF
```

#### 2. 重启服务

```bash
# PM2
pm2 restart serdo-api

# systemd
sudo systemctl restart serdo-api
```

#### 3. 重建前端

```bash
cd ..
npm run build
```

#### 4. 用户操作

1. 清除浏览器缓存 (`Ctrl+Shift+Delete`)
2. 重新登录
3. 重新输入所有密码
4. 测试：刷新后能正常查看

## 🔧 已实施的修复

### 后端增强

```javascript
// api/routes.js - wrapSecret 函数
function wrapSecret(plain, rk) {
  // ✅ 添加详细的错误检查
  // ✅ 添加调试日志
  // ✅ 验证密钥长度（32字节）
  // ✅ 更友好的错误提示
}
```

### 前端增强

```typescript
// utils/crypto.ts - aesGcmDecryptBase64 函数
export async function aesGcmDecryptBase64(...) {
  // ✅ 添加参数验证
  // ✅ 添加详细日志
  // ✅ 更好的错误处理
  // ✅ 友好的错误信息
}
```

### 前端组件

```typescript
// components/SystemSettings.tsx
// ✅ 检查解密结果是否为空
// ✅ 显示明确的错误提示
// ✅ 自动清空并允许重新输入
// ✅ 加载动画和成功提示
```

## 📦 新增文件

```
/
├── PRODUCTION_PASSWORD_FIX.md      # 完整修复文档
├── QUICK_FIX_GUIDE.md              # 快速修复指南
├── PASSWORD_FIX_SUMMARY.md         # 本文件
├── deploy/
│   ├── env.example                 # 环境变量示例
│   └── env.production              # 生产环境配置
├── scripts/
│   └── fix-production-password.sh  # 自动修复脚本
└── public/
    └── debug-crypto.html           # Web 诊断工具
```

## 🧪 验证

### 1. 检查配置

```bash
# 查看 REDACT_MODE
cat api/.env | grep REDACT_MODE
# 应显示: REDACT_MODE=true

# 检查进程环境变量
ps aux | grep serdo-api
cat /proc/<PID>/environ | tr '\0' '\n' | grep REDACT
```

### 2. 检查日志

```bash
# 后端日志应该显示
sudo journalctl -u serdo-api -f | grep wrapSecret
# [wrapSecret] 🔐 Encrypting: ...
# [wrapSecret] ✅ Encrypted successfully
```

### 3. 浏览器控制台

```
🔑 [REVEAL] 使用已有密钥
🔓 [Decrypt] 开始解密
✅ [Decrypt] 解密成功, 长度: 10
```

## 📝 重要说明

### sessionStorage 特性

| 操作 | sessionStorage | 密码查看 |
|------|---------------|---------|
| 刷新页面 (F5) | ✅ 保留 | ✅ 可以查看 |
| 关闭浏览器 | ❌ 清除 | ⚠️ 需重新输入 |
| 新标签页 | ❌ 独立 | ⚠️ 需重新输入 |

**这不是bug，是安全特性！**

### 切换 REDACT_MODE 的影响

| REDACT_MODE | 传输方式 | 旧密码 | 操作 |
|-------------|---------|-------|------|
| false → true | 明文 → 加密 | ❌ 无法解密 | 重新输入 |
| true → false | 加密 → 明文 | ⚠️ 不安全 | 不推荐 |

**生产环境必须使用 `REDACT_MODE=true`**

## 🔒 安全最佳实践

1. ✅ 生产环境使用 HTTPS
2. ✅ 设置 `REDACT_MODE=true`
3. ✅ 使用强随机 JWT_SECRET
4. ✅ 定期轮换密钥（30-90天）
5. ✅ 配置防火墙规则
6. ✅ 启用审计日志
7. ✅ 定期备份数据

## 📞 获取帮助

### 使用诊断工具

```bash
# Web 工具
打开浏览器访问: http://your-domain/debug-crypto.html
点击 "运行完整诊断"

# 命令行工具
./scripts/fix-production-password.sh
```

### 查看文档

- **快速开始**: `QUICK_FIX_GUIDE.md`
- **完整文档**: `PRODUCTION_PASSWORD_FIX.md`
- **环境配置**: `deploy/env.example`

### 日志位置

```bash
# 后端日志
sudo journalctl -u serdo-api -f

# 审计日志
tail -f api/api/data/audit.log

# 前端日志
浏览器控制台 (F12 → Console)
```

## ✅ 测试检查清单

- [ ] REDACT_MODE 已设置为 true
- [ ] 后端服务已重启
- [ ] 前端已重新构建
- [ ] 浏览器缓存已清除
- [ ] 所有密码已重新输入
- [ ] 刷新页面后密码可以查看
- [ ] 后端日志显示加密成功
- [ ] 前端日志显示解密成功
- [ ] 诊断工具测试通过

---

**修复日期**: 2024-12-05  
**版本**: v1.2.0  
**状态**: ✅ 完成  
**测试**: ⏳ 待用户验证

