/**
 * 后端配置文件
 * 
 * 所有配置均可通过环境变量覆盖
 * 推荐使用 .env 文件管理配置
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })

/**
 * 获取环境变量，支持默认值
 */
function getEnv(key, defaultValue) {
  return process.env[key] ?? defaultValue
}

function getEnvBool(key, defaultValue) {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  return value === 'true' || value === '1'
}

function getEnvInt(key, defaultValue) {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * 配置对象
 */
const config = {
  // ==========================================================================
  // 服务器配置
  // ==========================================================================
  
  /**
   * 服务监听端口
   * 环境变量: PORT
   * 默认值: 4000
   */
  port: getEnvInt('PORT', 4000),
  
  // ==========================================================================
  // 安全配置
  // ==========================================================================
  
  /**
   * JWT 签名密钥（必须设置！）
   * 生成方法: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   * 
   * 环境变量: AUTH_SECRET
   * 警告: 使用默认值将导致安全风险
   */
  authSecret: getEnv('AUTH_SECRET', 'CHANGE_THIS_SECRET_IN_PRODUCTION'),
  
  /**
   * 密码脱敏模式
   * 启用后，API 响应不返回明文密码，前端需要通过 reveal API 获取加密密码
   * 
   * 生产环境强烈建议设置为 true
   * 
   * 环境变量: REDACT_MODE
   * 默认值: true（生产环境安全）
   */
  redactMode: getEnvBool('REDACT_MODE', true),
  
  /**
   * 是否允许 SSH 明文密码
   * 禁用后，SSH 连接只能使用密钥认证
   * 
   * 环境变量: API_SSH_ALLOW_PASSWORD
   * 默认值: false（安全）
   */
  sshAllowPassword: getEnvBool('API_SSH_ALLOW_PASSWORD', false),
  
  // ==========================================================================
  // CORS 配置
  // ==========================================================================
  
  /**
   * 允许的跨域来源
   * 多个来源用逗号分隔
   * 使用 * 允许所有来源（不推荐用于生产环境）
   * 
   * 例如: http://localhost:3000,https://serdo.example.com
   * 
   * 环境变量: CORS_ORIGIN
   * 默认值: http://localhost:3000
   */
  corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
  
  // ==========================================================================
  // 速率限制
  // ==========================================================================
  
  /**
   * 每分钟最大请求数（针对单个 IP）
   * 
   * 环境变量: RATE_LIMIT_MAX
   * 默认值: 300
   */
  rateLimitMax: getEnvInt('RATE_LIMIT_MAX', 300),
  
  // ==========================================================================
  // 数据存储
  // ==========================================================================
  
  /**
   * 是否使用 SQLite 数据库
   * 禁用后使用 JSON 文件存储
   * 
   * 环境变量: USE_SQLITE
   * 默认值: true
   */
  useSqlite: getEnvBool('USE_SQLITE', true),
  
  /**
   * 数据目录路径
   * 
   * 环境变量: DATA_DIR
   * 默认值: ./data
   */
  dataDir: getEnv('DATA_DIR', './data'),
  
  // ==========================================================================
  // 可选功能
  // ==========================================================================
  
  /**
   * Sentry DSN（错误监控，可选）
   * 
   * 环境变量: SENTRY_DSN
   */
  sentryDsn: getEnv('SENTRY_DSN', ''),
}

/**
 * 验证必要配置
 */
function validateConfig() {
  const warnings = []
  const errors = []
  
  // 检查 AUTH_SECRET
  if (config.authSecret === 'CHANGE_THIS_SECRET_IN_PRODUCTION') {
    if (process.env.NODE_ENV === 'production') {
      errors.push('AUTH_SECRET 必须在生产环境中设置')
    } else {
      warnings.push('AUTH_SECRET 使用默认值，请在生产环境中修改')
    }
  }
  
  // 检查 CORS_ORIGIN
  if (config.corsOrigin === '*' && process.env.NODE_ENV === 'production') {
    warnings.push('CORS_ORIGIN 设置为 *，这在生产环境中不安全')
  }
  
  // 输出警告
  warnings.forEach(w => console.warn('[Config Warning]', w))
  
  // 输出错误并退出
  if (errors.length > 0) {
    errors.forEach(e => console.error('[Config Error]', e))
    process.exit(1)
  }
}

// 启动时验证配置
validateConfig()

module.exports = config


