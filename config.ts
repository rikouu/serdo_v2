/**
 * 前端配置文件
 * 
 * 配置说明：
 * - 所有配置均可通过环境变量覆盖（VITE_ 前缀）
 * - 生产环境构建时会内嵌配置值
 * 
 * 使用方法：
 * 1. 开发环境：在项目根目录创建 .env.local 文件
 * 2. 生产环境：在构建命令中设置环境变量或使用 .env.production 文件
 */

// 获取环境变量，支持默认值
function getEnv(key: string, defaultValue: string): string {
  return import.meta.env[key] ?? defaultValue
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = import.meta.env[key]
  if (value === undefined) return defaultValue
  return value === 'true' || value === '1'
}

/**
 * 应用配置
 */
export const config = {
  /**
   * API 服务器地址
   * 
   * 同域部署时使用相对路径: /api/v1
   * 跨域部署时使用完整地址: http://api.example.com/api/v1
   * 
   * 环境变量: VITE_API_BASE_URL
   */
  apiBaseUrl: getEnv('VITE_API_BASE_URL', '/api/v1'),
  
  /**
   * 应用名称（显示在标题栏和登录页）
   * 
   * 环境变量: VITE_APP_NAME
   */
  appName: getEnv('VITE_APP_NAME', 'Serdo'),
  
  /**
   * 是否启用调试模式
   * 开启后会在控制台输出详细日志
   * 
   * 环境变量: VITE_DEBUG
   */
  debug: getEnvBool('VITE_DEBUG', false),
  
  /**
   * Gemini API Key（可选，用于 AI 功能）
   * 
   * 环境变量: VITE_GEMINI_API_KEY
   */
  geminiApiKey: getEnv('VITE_GEMINI_API_KEY', ''),
} as const

/**
 * 判断当前是否为开发环境
 */
export const isDev = import.meta.env.DEV

/**
 * 判断当前是否为生产环境
 */
export const isProd = import.meta.env.PROD

/**
 * 判断当前是否为安全上下文（HTTPS 或 localhost）
 */
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false
  
  // localhost 和 127.0.0.1 被视为安全上下文
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true
  }
  
  // HTTPS 协议
  return window.location.protocol === 'https:'
}

/**
 * 调试日志
 */
export function debugLog(category: string, message: string, ...args: unknown[]): void {
  if (!config.debug) return
  console.log(`[${category}]`, message, ...args)
}

export default config


