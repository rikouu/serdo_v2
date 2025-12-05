/**
 * 认证服务 - 统一管理用户身份验证和会话持久化
 * 
 * 设计原则：
 * 1. Token 存储在 localStorage 中，刷新页面后可恢复
 * 2. 敏感操作使用 sessionStorage 中的临时密钥
 * 3. 自动处理 Token 过期和刷新
 * 4. 提供清晰的错误处理机制
 */

import { User } from '../types'

// 存储键名常量
const STORAGE_KEYS = {
  TOKEN: 'serdo_auth_token',
  USER: 'serdo_user_cache',
  REVEAL_KEY: 'serdo_reveal_key',
} as const

// 认证状态
interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
}

// 事件监听器类型
type AuthStateListener = (state: AuthState) => void

// 认证状态变更监听器
const listeners: Set<AuthStateListener> = new Set()

/**
 * 获取当前认证状态
 */
export function getAuthState(): AuthState {
  const token = getToken()
  const user = getCachedUser()
  return {
    isAuthenticated: !!token && !!user,
    user,
    token,
  }
}

/**
 * 订阅认证状态变更
 */
export function subscribeAuthState(listener: AuthStateListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * 通知所有监听器
 */
function notifyListeners() {
  const state = getAuthState()
  listeners.forEach(listener => {
    try {
      listener(state)
    } catch (e) {
      console.error('[Auth] Listener error:', e)
    }
  })
}

/**
 * 安全地读取 localStorage
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    console.warn(`[Auth] Cannot read ${key}:`, e)
    return null
  }
}

/**
 * 安全地写入 localStorage
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.error(`[Auth] Cannot write ${key}:`, e)
    return false
  }
}

/**
 * 安全地删除 localStorage 项
 */
function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn(`[Auth] Cannot remove ${key}:`, e)
  }
}

/**
 * 安全地读取 sessionStorage
 */
function safeSessionGetItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch (e) {
    console.warn(`[Auth] Cannot read session ${key}:`, e)
    return null
  }
}

/**
 * 安全地写入 sessionStorage
 */
function safeSessionSetItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value)
    return true
  } catch (e) {
    console.error(`[Auth] Cannot write session ${key}:`, e)
    return false
  }
}

/**
 * 安全地删除 sessionStorage 项
 */
function safeSessionRemoveItem(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch (e) {
    console.warn(`[Auth] Cannot remove session ${key}:`, e)
  }
}

/**
 * 获取存储的 Token
 */
export function getToken(): string | null {
  return safeGetItem(STORAGE_KEYS.TOKEN)
}

/**
 * 存储 Token
 */
export function setToken(token: string): boolean {
  const success = safeSetItem(STORAGE_KEYS.TOKEN, token)
  if (success) {
    notifyListeners()
  }
  return success
}

/**
 * 清除 Token
 */
export function clearToken(): void {
  safeRemoveItem(STORAGE_KEYS.TOKEN)
  notifyListeners()
}

/**
 * 获取缓存的用户信息
 */
export function getCachedUser(): User | null {
  const cached = safeGetItem(STORAGE_KEYS.USER)
  if (!cached) return null
  try {
    return JSON.parse(cached) as User
  } catch {
    return null
  }
}

/**
 * 缓存用户信息
 */
export function setCachedUser(user: User): boolean {
  const success = safeSetItem(STORAGE_KEYS.USER, JSON.stringify(user))
  if (success) {
    notifyListeners()
  }
  return success
}

/**
 * 清除用户缓存
 */
export function clearCachedUser(): void {
  safeRemoveItem(STORAGE_KEYS.USER)
  notifyListeners()
}

/**
 * 获取或生成密码解密密钥（用于敏感数据解密）
 * 存储在 sessionStorage 中，关闭标签页后自动清除
 */
export function getRevealKey(): string {
  let key = safeSessionGetItem(STORAGE_KEYS.REVEAL_KEY)
  if (!key) {
    // 生成新的 32 字节随机密钥
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    key = btoa(String.fromCharCode(...bytes))
    safeSessionSetItem(STORAGE_KEYS.REVEAL_KEY, key)
  }
  return key
}

/**
 * 清除解密密钥
 */
export function clearRevealKey(): void {
  safeSessionRemoveItem(STORAGE_KEYS.REVEAL_KEY)
}

/**
 * 登录成功后的处理
 */
export function handleLoginSuccess(token: string, user: User): void {
  setToken(token)
  setCachedUser(user)
}

/**
 * 登出处理
 */
export function handleLogout(): void {
  clearToken()
  clearCachedUser()
  clearRevealKey()
}

/**
 * 检查 Token 是否可能已过期
 * 简单解析 JWT 检查 exp 字段
 */
export function isTokenExpired(): boolean {
  const token = getToken()
  if (!token) return true
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp !== 'number') return false // 没有过期时间则假设未过期
    
    // 提前 5 分钟认为过期，避免临界情况
    const nowSeconds = Math.floor(Date.now() / 1000)
    return nowSeconds >= (payload.exp - 300)
  } catch {
    return true
  }
}

/**
 * 构建带认证头的请求配置
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

/**
 * 构建带解密密钥的请求头
 */
export function getRevealHeaders(): Record<string, string> {
  return {
    ...getAuthHeaders(),
    'X-Reveal-Key': getRevealKey(),
  }
}


