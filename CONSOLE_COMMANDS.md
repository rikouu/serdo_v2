# 🔧 浏览器控制台调试命令

## ✅ 可以直接在控制台运行的命令

### 1. 检查 Token 是否存在
```javascript
console.log('Token:', localStorage.getItem('infravault_token') ? '✅ 存在' : '❌ 不存在');
console.log('Token长度:', localStorage.getItem('infravault_token')?.length || 0);
```

### 2. 测试登录 API
```javascript
fetch('http://localhost:4000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin' })
})
.then(r => r.json())
.then(data => {
  console.log('✅ 登录成功:', data);
  if (data.token) {
    localStorage.setItem('infravault_token', data.token);
    console.log('✅ Token已保存');
  }
})
.catch(e => console.error('❌ 登录失败:', e));
```

### 3. 测试会话恢复（调用 /me）
```javascript
fetch('http://localhost:4000/api/v1/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('infravault_token'),
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('✅ 会话恢复成功:', data))
.catch(e => console.error('❌ 会话恢复失败:', e));
```

### 4. 检查后端健康
```javascript
fetch('http://localhost:4000/api/v1/health')
.then(r => r.json())
.then(data => console.log('✅ 后端正常:', data))
.catch(e => console.error('❌ 后端异常:', e));
```

### 5. 完整测试流程（一键运行）
```javascript
(async () => {
  console.log('🔍 开始完整测试...\n');
  
  // 1. 检查后端
  try {
    const health = await fetch('http://localhost:4000/api/v1/health').then(r => r.json());
    console.log('✅ 后端健康:', health);
  } catch (e) {
    console.error('❌ 后端连接失败:', e.message);
    return;
  }
  
  // 2. 检查现有 Token
  const existingToken = localStorage.getItem('infravault_token');
  console.log('\n📦 现有Token:', existingToken ? `存在 (${existingToken.length}字符)` : '不存在');
  
  // 3. 如果有 Token，测试会话恢复
  if (existingToken) {
    try {
      const me = await fetch('http://localhost:4000/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${existingToken}`,
          'Content-Type': 'application/json'
        }
      }).then(r => r.json());
      
      console.log('\n✅ 会话恢复成功!');
      console.log('   用户:', me.user.username);
      console.log('   角色:', me.user.role);
      console.log('\n🎉 刷新功能正常！');
    } catch (e) {
      console.error('\n❌ 会话恢复失败:', e.message);
      console.log('   建议：重新登录');
    }
  } else {
    console.log('\n⚠️  没有Token，尝试登录...');
    
    // 4. 自动登录
    try {
      const loginData = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' })
      }).then(r => r.json());
      
      if (loginData.token) {
        localStorage.setItem('infravault_token', loginData.token);
        console.log('\n✅ 登录成功! Token已保存');
        console.log('   现在可以刷新页面测试会话保持功能');
      }
    } catch (e) {
      console.error('\n❌ 登录失败:', e.message);
    }
  }
})();
```

### 6. 清除所有数据（重新开始）
```javascript
localStorage.clear();
console.log('✅ 所有数据已清除');
```

---

## 🎯 快速诊断

### 场景 1: 首次测试
```javascript
// 复制并运行这个
localStorage.clear();
fetch('http://localhost:4000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin' })
})
.then(r => r.json())
.then(data => {
  localStorage.setItem('infravault_token', data.token);
  console.log('✅ 登录成功，现在刷新页面(F5)看看是否保持登录');
});
```

### 场景 2: 测试会话恢复
```javascript
// 如果已经登录，运行这个测试
fetch('http://localhost:4000/api/v1/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('infravault_token'),
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ 会话恢复成功:', data.user.username);
  console.log('🎉 说明刷新功能正常！');
})
.catch(e => console.error('❌ 失败:', e));
```

---

## 📊 判断标准

### ✅ 成功的输出：
```
✅ 后端健康: {ok: true}
📦 现有Token: 存在 (XXX字符)
✅ 会话恢复成功!
   用户: admin
   角色: admin
🎉 刷新功能正常！
```

### ❌ 失败的输出：
```
❌ 后端连接失败
或
❌ 会话恢复失败
或
📦 现有Token: 不存在
```

---

## 🔧 根据输出采取行动

| 输出 | 问题 | 解决方案 |
|------|------|----------|
| 后端连接失败 | 后端未运行 | 启动后端服务 |
| Token不存在 | 未登录 | 运行登录命令 |
| 会话恢复失败 | Token无效 | 清除并重新登录 |
| 会话恢复成功 | 功能正常 | ✅ 可以正常使用 |

---

## 💡 注意事项

1. **import.meta 错误**：这是正常的，在控制台不能用，要用上面提供的命令
2. **刷新测试**：在控制台测试成功后，按 F5 刷新页面，看是否保持登录
3. **硬刷新**：如果看到旧页面，用 Cmd+Shift+R (Mac) 或 Ctrl+Shift+R (Windows)

