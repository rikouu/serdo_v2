import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        // 确保正确解析依赖
        dedupe: ['react', 'react-dom', 'lucide-react']
      },
      build: {
        sourcemap: !isProd,
        rollupOptions: {
          output: {
            // 优化分包策略 - 最保险方案：最小化代码分割
            manualChunks(id) {
              // 🎯 最终策略：只分割超大型独立库，其他全部保留在主 bundle
              // 避免任何依赖关系和加载顺序问题
              
              // 终端库 - 最大的库，完全独立，可以安全分割
              if (id.includes('node_modules/xterm')) {
                return 'vendor-terminal';
              }
              
              // 其他所有依赖（包括 React, lucide-react, recharts, @dnd-kit）
              // 全部保留在主 bundle 中，确保加载顺序正确
            },
            // 确保 chunk 文件名稳定
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          }
        },
        chunkSizeWarningLimit: 800,
        cssCodeSplit: true,
        minify: 'esbuild',
        target: 'es2020',
        assetsInlineLimit: 4096,
      },
      // 优化依赖预构建
      optimizeDeps: {
        include: ['react', 'react-dom', 'lucide-react'],
        exclude: ['@google/genai']
      },
      esbuild: {
        drop: isProd ? ['console', 'debugger'] : [],
        jsx: 'automatic',
        jsxImportSource: 'react',
        // 确保正确处理 JSX
        logOverride: { 'this-is-undefined-in-esm': 'silent' }
      },
      base: '/'
    };
});
