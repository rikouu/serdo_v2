/**
 * API 客户端 - 统一的 API 请求处理
 * 
 * 功能：
 * 1. 统一的错误处理
 * 2. 自动添加认证头
 * 3. Token 过期自动处理
 * 4. 密码解密支持
 */

import { Server, Domain, Provider, SystemSettings, User } from '../types'
import {
  getAuthHeaders,
  getRevealHeaders,
  getToken,
  handleLoginSuccess,
  handleLogout,
  isTokenExpired,
} from './authService'
import { decryptSecret } from '../utils/crypto'

// API 配置
const getApiBaseUrl = (): string => {
  // 优先使用环境变量配置
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl) return envUrl
  
  // 默认使用相对路径（同域部署）
  return '/api/v1'
}

// 错误类型
export class ApiError extends Error {
  code: string
  status: number
  
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/**
 * 基础请求方法
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = true
): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${path}`
  
  // 检查 Token 是否过期
  if (requireAuth && isTokenExpired()) {
    handleLogout()
    throw new ApiError('会话已过期，请重新登录', 'session_expired', 401)
  }
  
  // 构建请求配置
  const config: RequestInit = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  }
  
  try {
    const response = await fetch(url, config)
    
    // 处理非 JSON 响应
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw new ApiError(
          `请求失败: ${response.statusText}`,
          'request_failed',
          response.status
        )
      }
      return {} as T
    }
    
    const data = await response.json()
    
    // 处理错误响应
    if (!response.ok) {
      const code = data.code || 'unknown_error'
      const message = getErrorMessage(code, response.status)
      
      // 401 错误清除认证状态（但不包括登录接口）
      if (response.status === 401 && !path.includes('/auth/login')) {
        handleLogout()
      }
      
      throw new ApiError(message, code, response.status)
    }
    
    return data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    
    // 网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('网络连接失败，请检查网络', 'network_error', 0)
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : '未知错误',
      'unknown_error',
      0
    )
  }
}

/**
 * 获取友好的错误信息
 */
function getErrorMessage(code: string, status: number): string {
  const messages: Record<string, string> = {
    unauthorized: '未授权，请登录',
    session_expired: '会话已过期，请重新登录',
    invalid_credentials: '用户名或密码错误',
    account_expired: '账户已过期',
    username_taken: '用户名已被占用',
    invalid_email: '邮箱格式不正确',
    weak_password: '密码长度至少6位',
    invalid_invite: '邀请码无效',
    invite_expired: '邀请码已过期',
    invite_required: '需要邀请码',
    forbidden: '没有权限执行此操作',
    not_found: '资源不存在',
    rate_limited: '请求过于频繁，请稍后再试',
    internal_error: '服务器内部错误',
  }
  
  return messages[code] || `请求失败 (${status})`
}

// ============================================================================
// 认证相关 API
// ============================================================================

interface LoginResponse {
  token: string
  user: User
}

interface MeResponse {
  userId: string
  user: User
  data: {
    servers: Server[]
    domains: Domain[]
    providers: Provider[]
    settings: SystemSettings
  }
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<User> {
  const data = await request<LoginResponse>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
    false // 登录不需要认证
  )
  
  if (data.token && data.user) {
    handleLoginSuccess(data.token, data.user)
  }
  
  return data.user
}

/**
 * 用户注册
 */
export async function register(
  username: string,
  email: string,
  password: string,
  inviteCode?: string
): Promise<User> {
  const body: Record<string, string> = { username, email, password }
  if (inviteCode) body.inviteCode = inviteCode
  
  const data = await request<LoginResponse>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    false
  )
  
  if (data.token && data.user) {
    handleLoginSuccess(data.token, data.user)
  }
  
  return data.user
}

/**
 * 登出
 */
export function logout(): void {
  handleLogout()
}

/**
 * 获取当前用户信息
 */
export async function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/me')
}

/**
 * 更新用户信息
 */
export async function updateMe(
  email?: string,
  password?: string,
  currentPassword?: string
): Promise<User> {
  const body: Record<string, string> = {}
  if (email) body.email = email
  if (password) body.password = password
  if (currentPassword) body.currentPassword = currentPassword
  
  const data = await request<{ user: User }>('/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  
  return data.user
}

/**
 * 验证当前密码
 */
export async function verifyPassword(currentPassword: string): Promise<boolean> {
  try {
    await request('/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword }),
    })
    return true
  } catch {
    return false
  }
}

// ============================================================================
// 服务器相关 API
// ============================================================================

/**
 * 获取服务器列表
 */
export async function getServers(): Promise<Server[]> {
  return request<Server[]>('/servers')
}

/**
 * 创建或更新服务器
 */
export async function upsertServer(server: Server): Promise<Server> {
  return request<Server>('/servers', {
    method: 'POST',
    body: JSON.stringify(server),
  })
}

/**
 * 删除服务器
 */
export async function deleteServer(id: string): Promise<void> {
  await request(`/servers/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/**
 * Ping 单个服务器
 */
export async function pingServer(
  id: string
): Promise<{ reachable: boolean; latencyMs: number | null }> {
  return request(`/servers/${encodeURIComponent(id)}/ping`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

/**
 * 批量检查服务器
 */
export async function checkServers(): Promise<{
  results: { id: string; name: string; reachable: boolean }[]
}> {
  return request('/servers/check', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ============================================================================
// 域名相关 API
// ============================================================================

/**
 * 获取域名列表
 */
export async function getDomains(): Promise<Domain[]> {
  return request<Domain[]>('/domains')
}

/**
 * 创建或更新域名
 */
export async function upsertDomain(domain: Domain): Promise<Domain> {
  return request<Domain>('/domains', {
    method: 'POST',
    body: JSON.stringify(domain),
  })
}

/**
 * 删除域名
 */
export async function deleteDomain(id: string): Promise<void> {
  await request(`/domains/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/**
 * 同步域名 DNS
 */
export async function syncDomainDns(id: string): Promise<Domain> {
  return request(`/domains/${encodeURIComponent(id)}/sync`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

/**
 * 批量检查域名
 */
export async function checkDomains(): Promise<{
  results: { id: string; name: string; ok: boolean; expirationDate?: string }[]
}> {
  return request('/domains/check', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ============================================================================
// 服务商相关 API
// ============================================================================

/**
 * 获取服务商列表
 */
export async function getProviders(): Promise<Provider[]> {
  return request<Provider[]>('/providers')
}

/**
 * 创建或更新服务商
 */
export async function upsertProvider(provider: Provider): Promise<Provider> {
  return request<Provider>('/providers', {
    method: 'POST',
    body: JSON.stringify(provider),
  })
}

/**
 * 删除服务商
 */
export async function deleteProvider(id: string): Promise<void> {
  await request(`/providers/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ============================================================================
// 设置相关 API
// ============================================================================

/**
 * 获取系统设置
 */
export async function getSettings(): Promise<SystemSettings> {
  return request<SystemSettings>('/settings')
}

/**
 * 更新系统设置
 */
export async function updateSettings(
  settings: Partial<SystemSettings>
): Promise<SystemSettings> {
  return request<SystemSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

/**
 * 测试 WHOIS API
 * 注意：此 API 在测试失败时返回 400 状态码，但仍包含有用的错误信息
 */
export async function testWhoisApi(domain: string): Promise<{
  ok: boolean
  message?: string
  tests?: Record<string, unknown>
  errorSummary?: string[]
}> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const url = `${baseUrl}/settings/test-whois`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ domain }),
    })
    
    const data = await response.json()
    
    // 即使是 400 错误，也返回完整的响应数据（包含测试详情）
    if (response.status === 400 && data) {
      return {
        ok: false,
        message: data.message,
        tests: data.tests,
        errorSummary: data.errorSummary,
      }
    }
    
    if (!response.ok) {
      throw new Error(data.message || `请求失败 (${response.status})`)
    }
    
    return data
  } catch (error) {
    // 网络错误等
    throw error
  }
}

// ============================================================================
// 密码解密 API
// ============================================================================

interface EncryptedSecret {
  iv: string
  tag: string
  data: string
}

interface ServerSecretsResponse {
  panelPassword?: EncryptedSecret | null
  sshPassword?: EncryptedSecret | null
  providerPassword?: EncryptedSecret | null
}

/**
 * 获取并解密服务器密码
 */
export async function revealServerSecrets(
  id: string
): Promise<{
  panelPassword?: string
  sshPassword?: string
  providerPassword?: string
}> {
  const response = await request<ServerSecretsResponse>(
    `/reveal/servers/${encodeURIComponent(id)}`,
    {
      headers: getRevealHeaders(),
    }
  )
  
  const result: {
    panelPassword?: string
    sshPassword?: string
    providerPassword?: string
  } = {}
  
  const revealKey = (await import('./authService')).getRevealKey()
  
  if (response.panelPassword?.iv) {
    result.panelPassword = await decryptSecret(revealKey, response.panelPassword)
  }
  if (response.sshPassword?.iv) {
    result.sshPassword = await decryptSecret(revealKey, response.sshPassword)
  }
  if (response.providerPassword?.iv) {
    result.providerPassword = await decryptSecret(revealKey, response.providerPassword)
  }
  
  return result
}

/**
 * 获取并解密服务商密码
 */
export async function revealProviderPassword(id: string): Promise<string | undefined> {
  const response = await request<{ password?: EncryptedSecret | null }>(
    `/reveal/providers/${encodeURIComponent(id)}`,
    {
      headers: getRevealHeaders(),
    }
  )
  
  if (!response.password?.iv) return undefined
  
  const revealKey = (await import('./authService')).getRevealKey()
  return decryptSecret(revealKey, response.password)
}

/**
 * 获取并解密 WHOIS API Key
 */
export async function revealWhoisApiKey(): Promise<string | undefined> {
  const response = await request<{ whoisApiKey?: EncryptedSecret | null }>(
    '/reveal/settings/key',
    {
      headers: getRevealHeaders(),
    }
  )
  
  if (!response.whoisApiKey?.iv) return undefined
  
  const revealKey = (await import('./authService')).getRevealKey()
  return decryptSecret(revealKey, response.whoisApiKey)
}

/**
 * 获取并解密 Bark Key
 */
export async function revealBarkKey(): Promise<string | undefined> {
  const response = await request<{ barkKey?: EncryptedSecret | null }>(
    '/reveal/settings/bark-key',
    {
      headers: getRevealHeaders(),
    }
  )
  
  if (!response.barkKey?.iv) return undefined
  
  const revealKey = (await import('./authService')).getRevealKey()
  return decryptSecret(revealKey, response.barkKey)
}

/**
 * 获取并解密 SMTP 密码
 */
export async function revealSmtpPassword(): Promise<string | undefined> {
  const response = await request<{ smtpPassword?: EncryptedSecret | null }>(
    '/reveal/settings/smtp-password',
    {
      headers: getRevealHeaders(),
    }
  )
  
  if (!response.smtpPassword?.iv) return undefined
  
  const revealKey = (await import('./authService')).getRevealKey()
  return decryptSecret(revealKey, response.smtpPassword)
}

// ============================================================================
// 管理员 API
// ============================================================================

interface AdminSettings {
  appName: string
  inviteRequired: boolean
}

interface Invite {
  code: string
  expiresAt: number
  createdAt?: number
  usedBy?: string
}

interface AdminUser {
  id: string
  username: string
  email: string
  expiresAt: number
}

/**
 * 获取管理员设置
 */
export async function getAdminSettings(): Promise<AdminSettings> {
  return request<AdminSettings>('/admin/settings')
}

/**
 * 更新管理员设置
 */
export async function updateAdminSettings(
  settings: Partial<AdminSettings>
): Promise<AdminSettings> {
  return request<AdminSettings>('/admin/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

/**
 * 生成邀请码
 */
export async function generateInvites(
  count: number,
  expiresAt: number
): Promise<{ invites: Invite[] }> {
  return request('/admin/invites/generate', {
    method: 'POST',
    body: JSON.stringify({ count, expiresAt }),
  })
}

/**
 * 获取邀请码列表
 */
export async function listInvites(): Promise<{ invites: Invite[] }> {
  return request('/admin/invites')
}

/**
 * 更新邀请码
 */
export async function updateInvite(
  code: string,
  expiresAt: number
): Promise<Invite> {
  return request(`/admin/invites/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify({ expiresAt }),
  })
}

/**
 * 删除邀请码
 */
export async function deleteInvite(code: string): Promise<void> {
  await request(`/admin/invites/${encodeURIComponent(code)}`, { method: 'DELETE' })
}

/**
 * 获取用户列表
 */
export async function listUsers(): Promise<{ users: AdminUser[] }> {
  return request('/admin/users')
}

/**
 * 更新用户过期时间
 */
export async function updateUserExpiry(
  id: string,
  expiresAt: number
): Promise<AdminUser> {
  return request(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ expiresAt }),
  })
}

/**
 * 删除用户
 */
export async function deleteUser(id: string): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ============================================================================
// 数据导入导出
// ============================================================================

/**
 * 导出用户数据
 */
export async function exportUserData(): Promise<unknown> {
  const response = await request<{ data: unknown }>('/me/export')
  return response.data
}

/**
 * 导入用户数据
 */
export async function importUserData(data: unknown): Promise<boolean> {
  await request('/me/import', {
    method: 'POST',
    body: JSON.stringify({ data }),
  })
  return true
}

// ============================================================================
// 检查日志
// ============================================================================

export interface CheckLog {
  id: string
  type: 'server' | 'domain'
  trigger: 'manual' | 'auto'
  timestamp: number
  total: number
  success: number
  failed: number
  duration: number
  failedItems?: string[]
  expiringItems?: { name: string; expirationDate: string; days: number }[]
  errors?: string[]
  notificationSent: boolean
}

/**
 * 获取检查日志
 */
export async function getCheckLogs(
  page = 1,
  pageSize = 5,
  type?: 'server' | 'domain'
): Promise<{
  logs: CheckLog[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (type) params.set('type', type)
  
  return request(`/check-logs?${params}`)
}

/**
 * 获取自动检查状态
 */
export async function getCheckStatus(): Promise<{
  server: {
    enabled: boolean
    intervalHours: number
    lastCheckAt: number
    nextCheckAt: number
  }
  domain: {
    enabled: boolean
    frequency: string
    lastCheckAt: number
    nextCheckAt: number
  }
  currentTime: number
}> {
  return request('/check-status')
}

