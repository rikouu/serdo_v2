# 🔍 白屏问题排查指南

## 当前状态

✅ **开发服务器已启动**: http://localhost:3000/  
✅ **构建配置正确**: vite.config.ts 已优化  
✅ **入口文件正常**: index.html 和 index.tsx 配置正确

---

## 立即检查步骤

### 1. 打开浏览器开发者工具

**快捷键**:
- Chrome/Edge: `F12` 或 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- Firefox: `F12` 或 `Cmd+Option+K` (Mac) / `Ctrl+Shift+K` (Windows)
- Safari: `Cmd+Option+C` (需先在设置中启用开发者菜单)

### 2. 检查 Console 标签

在 Console 标签中查看是否有**红色错误信息**：

#### 常见错误类型

**A. 模块加载错误**
```
Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type...
```

**解决方案**: 
- 刷新页面 (Cmd+R 或 Ctrl+R)
- 硬刷新 (Cmd+Shift+R 或 Ctrl+Shift+R)

---

**B. React 错误**
```
Uncaught Error: Element type is invalid...
```

**解决方案**: 检查组件导入是否正确

---

**C. API 连接错误**
```
Failed to fetch
Network request failed
```

**这是正常的！** 开发环境中，如果后端 API 未启动，这些错误不会影响页面显示。

---

**D. 环境变量错误**
```
process is not defined
```

**解决方案**: 
```bash
# 创建 .env 文件
echo "VITE_USE_API=false" > .env
echo "VITE_API_BASE_URL=/api/v1" >> .env
```

---

### 3. 检查 Network 标签

1. 打开 Network 标签
2. 刷新页面 (Cmd+R)
3. 查看请求列表

#### 关键文件检查

| 文件 | 状态 | 说明 |
|------|------|------|
| `index.html` | ✅ 200 | HTML 入口文件 |
| `index.tsx` | ✅ 200 | React 入口 |
| `App.tsx` | ✅ 200 | 主应用组件 |
| `@vite/client` | ✅ 200 | Vite 客户端 |

**如果任何文件显示 404**:
- 检查文件路径是否正确
- 重启开发服务器

---

### 4. 检查 Elements 标签

打开 Elements 标签，查看 DOM 结构：

**正常情况**:
```html
<body>
  <div id="root">
    <div class="...">
      <!-- React 渲染的内容 -->
    </div>
  </div>
</body>
```

**白屏情况**:
```html
<body>
  <div id="root"></div>  <!-- 空的！-->
</body>
```

如果 `#root` 是空的，说明 React 应用没有成功挂载。

---

## 常见问题和解决方案

### 问题 1: npm 损坏

**症状**:
```
Error: Cannot find module 'proc-log'
```

**解决方案**:
```bash
# 方案 1: 重新安装 npm (推荐)
nvm install 18
nvm use 18

# 方案 2: 直接运行 vite
cd "/Users/lihaoyu/Documents/代码项目/serdo/Serdo 2"
node_modules/.bin/vite
```

---

### 问题 2: 端口被占用

**症状**:
```
Port 3000 is in use
```

**解决方案**:
```bash
# 杀死占用端口的进程
lsof -ti:3000 | xargs kill -9

# 或使用其他端口
node_modules/.bin/vite --port 3001
```

---

### 问题 3: 浏览器缓存

**症状**: 页面不更新或显示旧内容

**解决方案**:
1. 硬刷新: `Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows)
2. 清除缓存:
   - Chrome: DevTools → Network → 勾选 "Disable cache"
   - 或: Settings → Privacy → Clear browsing data

---

### 问题 4: React StrictMode 警告

**症状**: Console 中有黄色警告

**说明**: 这些是开发环境的警告，不会导致白屏。生产构建时会自动移除。

---

### 问题 5: Tailwind CSS 未加载

**症状**: 页面有内容但没有样式

**检查**: 在 Console 中运行
```javascript
document.querySelector('script[src*="tailwindcss"]')
```

如果返回 `null`，检查 `index.html` 中是否有：
```html
<script src="https://cdn.tailwindcss.com"></script>
```

---

## 逐步排查流程

### 第 1 步: 确认服务器运行

```bash
cd "/Users/lihaoyu/Documents/代码项目/serdo/Serdo 2"

# 方式 1: 直接运行 vite
node_modules/.bin/vite

# 方式 2: 如果 npm 正常
npm run dev
```

**期望输出**:
```
VITE v6.4.1  ready in 130 ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.18:3000/
```

---

### 第 2 步: 访问页面

在浏览器中打开: http://localhost:3000/

---

### 第 3 步: 打开 DevTools

按 `F12` 或右键 → "检查"

---

### 第 4 步: 查看 Console

**如果看到错误**: 复制完整错误信息，继续排查

**如果没有错误**: 检查 Network 和 Elements 标签

---

### 第 5 步: 检查关键文件

在 Console 中运行以下命令：

```javascript
// 检查 React 是否加载
console.log(React)

// 检查 root 元素
console.log(document.getElementById('root'))

// 检查 App 组件
console.log(window.location.href)
```

---

## 调试技巧

### 技巧 1: 添加调试日志

编辑 `index.tsx`，添加日志：

```typescript
console.log('1. index.tsx 开始执行');

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('2. 模块导入成功');

const rootElement = document.getElementById('root');
console.log('3. root 元素:', rootElement);

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
console.log('4. ReactDOM.createRoot 成功');

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('5. 渲染完成');
```

刷新页面，查看 Console 中打印到哪一步。

---

### 技巧 2: 简化 App 组件

临时替换 `App.tsx` 为最简版本：

```typescript
import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Hello World!</h1>
      <p>如果你看到这个，说明 React 正常工作</p>
    </div>
  );
};

export default App;
```

如果这样可以显示，说明问题在原 App 组件中。

---

### 技巧 3: 禁用 StrictMode

编辑 `index.tsx`，临时移除 StrictMode：

```typescript
root.render(<App />);
```

刷新页面，看是否有改善。

---

## 收集诊断信息

如果问题依然存在，请提供以下信息：

### 1. 浏览器 Console 输出

```
F12 → Console → 右键 → "Save as..." 或截图
```

### 2. Network 请求列表

```
F12 → Network → 刷新页面 → 右键 → "Save all as HAR"
```

### 3. 系统信息

```bash
# 运行以下命令
node -v
cd "/Users/lihaoyu/Documents/代码项目/serdo/Serdo 2"
ls -la | head -20
cat package.json | grep "\"version\""
```

### 4. 浏览器信息

- 浏览器名称和版本
- 操作系统版本

---

## 快速修复脚本

创建一个修复脚本 `fix-dev.sh`：

```bash
#!/bin/bash

echo "🔧 修复开发环境..."

cd "/Users/lihaoyu/Documents/代码项目/serdo/Serdo 2"

echo "1️⃣ 清理缓存..."
rm -rf node_modules/.vite
rm -rf dist

echo "2️⃣ 检查环境变量..."
if [ ! -f .env ]; then
  echo "VITE_USE_API=false" > .env
  echo "VITE_API_BASE_URL=/api/v1" >> .env
  echo "✅ 创建 .env 文件"
fi

echo "3️⃣ 启动开发服务器..."
node_modules/.bin/vite

echo "✅ 完成！访问 http://localhost:3000/"
```

使用方法：
```bash
chmod +x fix-dev.sh
./fix-dev.sh
```

---

## 联系支持

如果以上方法都无法解决，请提供：

1. **浏览器 Console 截图**（必须）
2. **完整错误信息**（如果有）
3. **DevTools Network 标签截图**
4. **是否是全新安装还是更新后出现**
5. **之前是否正常工作过**

---

**最后更新**: 2024-12-05  
**适用版本**: v1.0.1  
**开发服务器**: ✅ 已启动 http://localhost:3000/

