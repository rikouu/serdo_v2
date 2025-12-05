# 🚨 生产环境 React 加载错误修复

## 错误信息

```
TypeError: undefined is not an object (evaluating 'te.forwardRef')
```

## 问题分析

### 根本原因

`te.forwardRef` 中的 `te` 是压缩后的 React 对象，说明 React 没有正确加载或初始化。

### 可能的原因

1. **模块加载顺序错误**
   - vendor-react 没有在其他模块之前加载
   - 使用 `modulepreload` 而非 `<script>` 标签

2. **React 重复打包**
   - 虽然配置了 dedupe，但某些 React 模块可能被打包到多个 chunk

3. **正则表达式过于严格**
   - `/\/node_modules\/react\//` 可能没有匹配所有 React 相关文件

## ✅ 解决方案

### 方案 1: 修复模块加载顺序（推荐）

修改 `vite.config.ts`，确保 React 使用正确的加载策略：

```typescript
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  
  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // React 核心库 - 更宽松的匹配
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              // 但排除 react-markdown 等
              if (!id.includes('react-markdown') && !id.includes('react-router')) {
                return 'vendor-react';
              }
            }
            
            // ... 其他配置
          }
        }
      }
    }
  };
});
```

### 方案 2: 强制 React 外部化

如果方案 1 无效，使用 CDN 加载 React：

```typescript
build: {
  rollupOptions: {
    external: ['react', 'react-dom'],
    output: {
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM'
      }
    }
  }
}
```

然后在 `index.html` 添加：

```html
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
```

### 方案 3: 禁用代码分割（临时方案）

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: undefined  // 禁用自定义分包
    }
  }
}
```

## 🔍 诊断步骤

### 1. 检查构建产物

```bash
cd "/Users/lihaoyu/Documents/代码项目/serdo/Serdo 2"
npm run build

# 检查 vendor-react 大小
ls -lh dist/assets/vendor-react-*.js

# 应该约 190KB (未压缩)
```

### 2. 检查服务器文件

```bash
# 在服务器上
ls -lh /opt/serdo/dist/assets/*.js

# 确认所有文件都存在且大小正确
```

### 3. 检查浏览器加载

打开浏览器 DevTools → Network：

| 文件 | 状态 | 大小 | 顺序 |
|------|------|------|------|
| vendor-react-*.js | 200 | ~190KB | 应该最先加载 |
| vendor-others-*.js | 200 | ~169KB | 之后 |
| index-*.js | 200 | ~252KB | 最后 |

### 4. 测试 React 加载

在浏览器 Console 中运行：

```javascript
// 检查 React 是否存在
console.log(typeof React);  // 应该是 "object"
console.log(typeof React.forwardRef);  // 应该是 "function"

// 检查是否有多个 React 实例
console.log(window.React === require('react'));  // 应该是 true
```

## 🛠️ 立即修复

### 步骤 1: 修改 vite.config.ts

```typescript
// 改为更宽松的匹配
manualChunks(id) {
  // React - 使用 includes 但排除特定包
  if (id.includes('node_modules/react')) {
    if (id.includes('react-markdown') || 
        id.includes('react-router') ||
        id.includes('react-icons')) {
      // 这些不放入 vendor-react
    } else {
      return 'vendor-react';
    }
  }
  
  // react-dom 也要检查
  if (id.includes('node_modules/react-dom')) {
    return 'vendor-react';
  }
  
  // ... 其他配置
}
```

### 步骤 2: 重新构建

```bash
rm -rf dist/ node_modules/.vite
npm run build
```

### 步骤 3: 验证构建

```bash
# 检查 vendor-react 文件
cat dist/index.html | grep vendor-react

# 应该看到类似：
# <link rel="modulepreload" crossorigin href="/assets/vendor-react-*.js">
```

### 步骤 4: 上传到服务器

```bash
# 打包
bash scripts/release.sh

# 上传
scp release/serdo-frontend-*.zip user@server:/tmp/

# 解压
ssh user@server
cd /opt/serdo
sudo mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
sudo unzip /tmp/serdo-frontend-*.zip -d /opt/serdo/
sudo chown -R www-data:www-data /opt/serdo/dist
sudo systemctl restart nginx
```

### 步骤 5: 清除缓存测试

1. **清除浏览器缓存**
2. **硬刷新**: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
3. **检查 Console**: 不应该有错误

## 🔄 替代方案：简化配置

如果上述方法都无效，最简单的方案是**不分割 React**：

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        // 跳过 React，让它保持在主 bundle
        // if (id.includes('node_modules/react')) {
        //   return 'vendor-react';
        // }
        
        // 只分割大型库
        if (id.includes('node_modules/recharts')) {
          return 'vendor-charts';
        }
        if (id.includes('node_modules/xterm')) {
          return 'vendor-terminal';
        }
        if (id.includes('node_modules')) {
          return 'vendor-others';
        }
      }
    }
  }
}
```

这样 React 会被打包到 `index.js` 中，避免加载顺序问题。

## 📊 预期结果

### 修复前
```
vendor-react: 190KB (但 React 未正确导出)
vendor-others: 169KB
index: 252KB
```

### 修复后（方案 1）
```
vendor-react: 190KB (正确导出 React)
vendor-others: 169KB  
index: 252KB
```

### 修复后（简化方案）
```
vendor-others: 169KB
vendor-charts: 211KB
vendor-terminal: 284KB
index: 442KB (包含 React)
```

## 🆘 仍然报错？

如果问题依然存在，请提供：

1. **浏览器完整错误信息**
   ```
   F12 → Console → 完整堆栈跟踪
   ```

2. **Network 标签截图**
   ```
   显示所有 JS 文件的加载顺序和状态
   ```

3. **服务器文件列表**
   ```bash
   ls -lh /opt/serdo/dist/assets/*.js
   ```

4. **构建输出**
   ```bash
   npm run build 2>&1 | tee build.log
   ```

---

**最后更新**: 2024-12-05  
**适用版本**: v1.0.1  
**状态**: 待测试

