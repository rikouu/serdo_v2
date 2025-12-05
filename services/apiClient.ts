import { Server, Domain, Provider, SystemSettings, User } from '../types'
import { aesGcmDecryptBase64, bytesToB64 } from '../utils/crypto'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'
const TOKEN_KEY = 'infravault_token'
const REVEAL_KEY_STORAGE = 'infravault_reveal_key'

// 获取或生成持久化的 REVEAL_KEY
const getRevealKey = (): string => {
  try {
    let key = sessionStorage.getItem(REVEAL_KEY_STORAGE)
    if (!key) {
      key = bytesToB64(crypto.getRandomValues(new Uint8Array(32)).buffer as any)
      sessionStorage.setItem(REVEAL_KEY_STORAGE, key)
      console.log('🔑 [REVEAL] 生成新的密钥')
    } else {
      console.log('🔑 [REVEAL] 使用已有密钥')
    }
    return key
  } catch (error) {
    console.error('❌ [REVEAL] 密钥处理失败:', error)
    // 降级方案：生成临时key
    return bytesToB64(crypto.getRandomValues(new Uint8Array(32)).buffer as any)
  }
}

const getHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  console.log('🔑 [API] getHeaders - token:', token ? `存在 (${token.length}字符)` : '不存在')
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

const req = async (path: string, init?: RequestInit) => {
  console.log(`📡 [API] 请求: ${path}`)
  
  // 在每次请求前检查 token 状态
  const tokenBefore = localStorage.getItem(TOKEN_KEY)
  console.log(`📡 [API] 请求前 token 状态: ${tokenBefore ? '存在' : '不存在'}`)
  
  try {
    const res = await fetch(`${BASE}${path}`, init)
    console.log(`📡 [API] 响应: ${path} - 状态 ${res.status}`)
    
    if (!res.ok) {
      const text = await res.text()
      console.log(`❌ [API] 错误响应: ${path} - ${text}`)
      let code = ''
      try { const j = JSON.parse(text); code = j && j.code ? String(j.code) : '' } catch {}
      
      // 只在明确的认证失败时删除 token（排除登录和验证密码接口）
      if (res.status === 401 && path !== '/auth/verify-password' && path !== '/auth/login') {
        try { 
          console.log('⚠️ [API] 即将删除 token，原因: 401 错误于', path)
          localStorage.removeItem(TOKEN_KEY) 
          console.log('🗑️ [API] Token 已删除')
        } catch (e) {
          console.error('❌ [API] 删除 token 失败:', e)
        }
      }
      
      throw new Error(code || text)
    }
    const data = await res.json()
    console.log(`✅ [API] 成功: ${path}`)
    
    // 请求后检查 token 状态
    const tokenAfter = localStorage.getItem(TOKEN_KEY)
    if (tokenBefore && !tokenAfter) {
      console.error('🚨 [API] 警告: 请求后 token 丢失!', path)
    }
    
    return data
  } catch (error: any) {
    console.error(`❌ [API] 请求失败: ${path}`, error)
    // 网络错误不删除 token，让用户可以重试
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('network_error')
    }
    throw error
  }
}

export const loginUserApi = async (username: string, password: string): Promise<User | null> => {
  console.log('🔐 [LOGIN] 开始登录请求...')
  const data = await req('/auth/login', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ username, password }) })
  console.log('🔐 [LOGIN] 登录响应:', { hasToken: !!data.token, tokenLength: data.token?.length, hasUser: !!data.user })
  
  if (data.token) {
    try {
      localStorage.setItem(TOKEN_KEY, data.token)
      // 验证是否保存成功
      const saved = localStorage.getItem(TOKEN_KEY)
      console.log('🔐 [LOGIN] Token 保存结果:', { 
        saved: !!saved, 
        savedLength: saved?.length,
        match: saved === data.token 
      })
    } catch (e) {
      console.error('❌ [LOGIN] Token 保存失败:', e)
    }
  } else {
    console.error('❌ [LOGIN] API 响应中没有 token!')
  }
  
  return data.user
}

export const logoutUserApi = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REVEAL_KEY_STORAGE) // 清除解密密钥
    console.log('🗑️ [LOGOUT] Token 和密钥已清除')
  } catch (error) {
    console.error('❌ [LOGOUT] 退出失败:', error)
  }
}

export const registerUserApi = async (username: string, email: string, password: string, inviteCode?: string): Promise<User> => {
  console.log('📝 [REGISTER] 开始注册请求...')
  const body: any = { username, email, password }
  if (inviteCode) body.inviteCode = inviteCode
  const data = await req('/auth/register', { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) })
  console.log('📝 [REGISTER] 注册响应:', { hasToken: !!data?.token, hasUser: !!data?.user })
  
  if (data && data.token) {
    try {
      localStorage.setItem(TOKEN_KEY, data.token)
      const saved = localStorage.getItem(TOKEN_KEY)
      console.log('📝 [REGISTER] Token 保存结果:', { saved: !!saved, match: saved === data.token })
    } catch (e) {
      console.error('❌ [REGISTER] Token 保存失败:', e)
    }
  } else {
    console.warn('⚠️ [REGISTER] 注册响应中没有 token')
  }
  return data.user
}

export const getMeApi = async (): Promise<{ userId: string; user: User | null; data: any }> => req('/me', { headers: getHeaders() })

export const updateMeApi = async (email?: string, password?: string, currentPassword?: string): Promise<User | null> => {
  const body: any = { email }
  if (typeof currentPassword === 'string' && currentPassword.length > 0) body.currentPassword = currentPassword
  if (password) body.password = password
  const data = await req('/me', { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body) })
  return data.user
}

export const verifyPasswordApi = async (currentPassword: string): Promise<boolean> => {
  const body = { currentPassword }
  const data = await req('/auth/verify-password', { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) })
  return !!(data && data.ok)
}

// Personal data export/import
export const exportUserDataApi = async (): Promise<any> => {
  const data = await req('/me/export', { headers: getHeaders() })
  return data?.data
}
export const importUserDataApi = async (payload: any): Promise<boolean> => {
  const data = await req('/me/import', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ data: payload }) })
  return !!(data && data.ok)
}

// Super admin
export const getAdminSettingsApi = async (): Promise<{ appName: string; inviteRequired: boolean }> => req('/admin/settings', { headers: getHeaders() })
export const updateAdminSettingsApi = async (appName: string, inviteRequired: boolean): Promise<{ appName: string; inviteRequired: boolean }> => req('/admin/settings', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ appName, inviteRequired }) })
export const generateInvitesApi = async (count: number, expiresAt: number): Promise<{ invites: { code: string; expiresAt: number }[] }> => req('/admin/invites/generate', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ count, expiresAt }) })
export const listInvitesApi = async (): Promise<{ invites: { code: string; expiresAt: number; createdAt: number; usedBy?: string }[] }> => req('/admin/invites', { headers: getHeaders() })
export const updateInviteApi = async (code: string, expiresAt: number): Promise<any> => req(`/admin/invites/${encodeURIComponent(code)}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ expiresAt }) })
export const deleteInviteApi = async (code: string): Promise<void> => { await req(`/admin/invites/${encodeURIComponent(code)}`, { method: 'DELETE', headers: getHeaders() }) }
export const listUsersApi = async (): Promise<{ users: { id: string; username: string; email: string; expiresAt: number }[] }> => req('/admin/users', { headers: getHeaders() })
export const updateUserExpiryApi = async (id: string, expiresAt: number): Promise<any> => req(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ expiresAt }) })
export const deleteUserApiAdmin = async (id: string): Promise<void> => { await req(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getHeaders() }) }

export const getServersApi = async (): Promise<Server[]> => req('/servers', { headers: getHeaders() })
export const upsertServerApi = async (s: Server): Promise<Server> => {
  const payload: any = { ...s }
  // 不再删除空密码字段，允许发送空字符串来清除密码
  // 后端会根据字段是否存在来决定是保留原值还是更新
  return req('/servers', { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) })
}
export const deleteServerApi = async (id: string): Promise<void> => { await req(`/servers/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getHeaders() }) }

export const getDomainsApi = async (): Promise<Domain[]> => req('/domains', { headers: getHeaders() })
export const upsertDomainApi = async (d: Domain): Promise<Domain> => req('/domains', { method: 'POST', headers: getHeaders(), body: JSON.stringify(d) })
export const deleteDomainApi = async (id: string): Promise<void> => { await req(`/domains/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getHeaders() }) }
export const syncDomainDnsApi = async (id: string): Promise<Domain> => req(`/domains/${encodeURIComponent(id)}/sync`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) })

export const getProvidersApi = async (): Promise<Provider[]> => req('/providers', { headers: getHeaders() })
export const upsertProviderApi = async (p: Provider): Promise<Provider> => {
  const payload: any = { ...p }
  // 不再删除空密码字段，允许发送空字符串来清除密码
  return req('/providers', { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) })
}
export const deleteProviderApi = async (id: string): Promise<void> => { await req(`/providers/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getHeaders() }) }

export const getSettingsApi = async (): Promise<SystemSettings> => req('/settings', { headers: getHeaders() })
export const updateSettingsApi = async (s: SystemSettings): Promise<SystemSettings> => {
  const payload: any = JSON.parse(JSON.stringify(s))
  if (payload.notifications) {
    const n = payload.notifications
    if (n.bark && n.bark.enabled === false) {
      n.bark = { enabled: false }
    }
    if (n.smtp && n.smtp.enabled === false) {
      n.smtp = { enabled: false }
    }
  }
  if (typeof payload.whoisApiBaseUrl === 'string' && payload.whoisApiBaseUrl.trim() === '') delete payload.whoisApiBaseUrl
  if (typeof payload.whoisApiKey === 'string' && payload.whoisApiKey.trim() === '') delete payload.whoisApiKey
  if (payload.whoisApiHeaders && typeof payload.whoisApiHeaders === 'object' && Object.keys(payload.whoisApiHeaders).length === 0) delete payload.whoisApiHeaders
  return req('/settings', { method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload) })
}

export interface WhoisTestResult {
  ok: boolean
  message?: string
  tests?: {
    whois?: {
      url: string
      success: boolean
      error?: { code: string; message: string }
      sample?: {
        domain: string
        registrar: string
        expiration_date: string
        status: string[]
      }
    }
    dns?: {
      url: string
      success: boolean
      error?: { code: string; message: string }
      sample?: {
        domain: string
        recordCount: number
        recordTypes: string[]
      }
    }
  }
  errorSummary?: string[]
  sample?: any
  status?: number
  text?: string
}

export const testWhoisApi = async (domain: string): Promise<WhoisTestResult> => {
  return req('/settings/test-whois', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ domain }) })
}

export const runAuditApi = async (): Promise<string> => {
  const data = await req('/audit/run', { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) })
  return data.report as string
}

export const checkServersApi = async (): Promise<{ results: { id: string, name: string, reachable: boolean }[] } > => {
  return req('/servers/check', { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) })
}

export const checkDomainsApi = async (): Promise<{ results: { id: string, name: string, ok: boolean, expirationDate?: string }[] } > => {
  return req('/domains/check', { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) })
}

export const pingServerApi = async (id: string): Promise<{ reachable: boolean, latencyMs: number | null }> => {
  return req(`/servers/${encodeURIComponent(id)}/ping`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) })
}
export const revealServerSecretsApi = async (id: string): Promise<{ panelPassword?: string; sshPassword?: string; providerPassword?: string }> => {
  const key = getRevealKey()
  const headers = Object.assign(getHeaders(), { 'x-reveal-key': key })
  const r = await req(`/reveal/servers/${id}`, { headers })
  const out: any = {}
  if (r.panelPassword && r.panelPassword.iv && r.panelPassword.tag && r.panelPassword.data) out.panelPassword = await aesGcmDecryptBase64(key, r.panelPassword.iv, r.panelPassword.tag, r.panelPassword.data)
  if (r.sshPassword && r.sshPassword.iv && r.sshPassword.tag && r.sshPassword.data) out.sshPassword = await aesGcmDecryptBase64(key, r.sshPassword.iv, r.sshPassword.tag, r.sshPassword.data)
  if (r.providerPassword && r.providerPassword.iv && r.providerPassword.tag && r.providerPassword.data) out.providerPassword = await aesGcmDecryptBase64(key, r.providerPassword.iv, r.providerPassword.tag, r.providerPassword.data)
  return out
}

export const revealProviderPasswordApi = async (id: string): Promise<string | undefined> => {
  const key = getRevealKey()
  const headers = Object.assign(getHeaders(), { 'x-reveal-key': key })
  const r = await req(`/reveal/providers/${id}`, { headers })
  if (r && r.password && r.password.iv && r.password.tag && r.password.data) return aesGcmDecryptBase64(key, r.password.iv, r.password.tag, r.password.data)
  return undefined
}

export const revealWhoisApiKeyApi = async (): Promise<string | undefined> => {
  const key = getRevealKey()
  const headers = Object.assign(getHeaders(), { 'x-reveal-key': key })
  const r = await req(`/reveal/settings/key`, { headers })
  if (r && r.whoisApiKey && r.whoisApiKey.iv && r.whoisApiKey.tag && r.whoisApiKey.data) return aesGcmDecryptBase64(key, r.whoisApiKey.iv, r.whoisApiKey.tag, r.whoisApiKey.data)
  return undefined
}

export const revealBarkKeyApi = async (): Promise<string | undefined> => {
  const key = getRevealKey()
  const headers = Object.assign(getHeaders(), { 'x-reveal-key': key })
  const r = await req(`/reveal/settings/bark-key`, { headers })
  if (r && r.barkKey && r.barkKey.iv && r.barkKey.tag && r.barkKey.data) return aesGcmDecryptBase64(key, r.barkKey.iv, r.barkKey.tag, r.barkKey.data)
  return undefined
}

export const revealSmtpPasswordApi = async (): Promise<string | undefined> => {
  const key = getRevealKey()
  const headers = Object.assign(getHeaders(), { 'x-reveal-key': key })
  const r = await req(`/reveal/settings/smtp-password`, { headers })
  if (r && r.smtpPassword && r.smtpPassword.iv && r.smtpPassword.tag && r.smtpPassword.data) return aesGcmDecryptBase64(key, r.smtpPassword.iv, r.smtpPassword.tag, r.smtpPassword.data)
  return undefined
}
