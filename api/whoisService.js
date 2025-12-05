/**
 * WHOIS & DNS 查询服务
 * 基于 http://whois.of.ci/api 优化
 * 
 * API 文档: http://whois.of.ci/api/docs
 * 端点:
 * - GET /api/whois/{domain} - WHOIS 查询
 * - GET /api/dns/{domain} - DNS 查询
 * - GET /api/lookup/{domain} - 综合查询（推荐）
 */

const { log } = require('./logger')

// 默认 API 配置
const DEFAULT_API_BASE = 'http://whois.of.ci/api'

/**
 * 构建请求头
 */
function buildHeaders(apiKey) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['X-API-Key'] = String(apiKey)
  }
  return headers
}

/**
 * 发送 API 请求并处理响应
 */
async function apiRequest(url, headers, timeout = 15000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    log('WHOIS API request', { url: url.replace(/X-API-Key=[^&]+/, 'X-API-Key=***') })
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const statusCode = response.status
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return {
        success: false,
        error: {
          code: `HTTP_${statusCode}`,
          message: getErrorMessage(statusCode, errorText),
          status: statusCode,
          details: errorText.slice(0, 500)
        }
      }
    }
    
    const data = await response.json()
    
    // API 返回格式: { success: true, data: {...}, error: null }
    if (data.success === false && data.error) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: String(data.error),
          details: data
        }
      }
    }
    
    return {
      success: true,
      data: data.data || data
    }
  } catch (err) {
    clearTimeout(timeoutId)
    
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: '请求超时，API 响应时间过长'
        }
      }
    }
    
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `网络请求失败: ${err.message}`
      }
    }
  }
}

/**
 * 根据 HTTP 状态码返回友好错误信息
 */
function getErrorMessage(status, responseText) {
  const messages = {
    400: '请求参数错误，请检查域名格式',
    401: 'API Key 无效或已过期',
    403: 'API Key 权限不足或请求被拒绝',
    404: '域名不存在或未注册',
    429: '请求频率过高，请稍后重试',
    500: 'WHOIS 服务器内部错误',
    502: 'WHOIS 上游服务不可用',
    503: '服务暂时不可用，请稍后重试'
  }
  
  let baseMsg = messages[status] || `未知错误 (${status})`
  
  // 尝试解析响应中的错误详情
  try {
    const parsed = JSON.parse(responseText)
    if (parsed.detail) baseMsg += `: ${parsed.detail}`
    else if (parsed.message) baseMsg += `: ${parsed.message}`
  } catch {}
  
  return baseMsg
}

/**
 * 解析日期字符串为标准格式 (YYYY-MM-DD)
 */
function parseDate(text) {
  if (!text || typeof text !== 'string') return null
  
  // ISO 格式: 2025-12-31 或 2025-12-31T00:00:00Z
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }
  
  // 日期时间格式: 2025-12-31 00:00:00
  const dtMatch = text.match(/(\d{4})-(\d{2})-(\d{2})\s/)
  if (dtMatch) {
    return `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`
  }
  
  // DD/MM/YYYY 格式
  const dmyMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  }
  
  // DD-Mon-YYYY 格式 (e.g., 31-Dec-2025)
  const monMatch = text.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/)
  if (monMatch) {
    const months = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04',
      May: '05', Jun: '06', Jul: '07', Aug: '08',
      Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    }
    const mm = months[monMatch[2]] || '01'
    const dd = String(monMatch[1]).padStart(2, '0')
    return `${monMatch[3]}-${mm}-${dd}`
  }
  
  return null
}

/**
 * 标准化域名状态
 */
function normalizeStatus(statusArray) {
  if (!Array.isArray(statusArray)) {
    statusArray = typeof statusArray === 'string' ? [statusArray] : []
  }
  
  const normalized = new Set()
  
  for (const status of statusArray) {
    const s = String(status).toLowerCase()
    
    // 提取 EPP 状态码 (e.g., "clientDeleteProhibited https://icann.org/epp#...")
    const eppMatch = s.match(/^([a-z]+)[\s#]/)
    const code = eppMatch ? eppMatch[1] : s
    
    // 映射常见状态
    if (code.includes('clienthold') || s.includes('client hold')) {
      normalized.add('clientHold')
    } else if (code.includes('serverhold') || s.includes('server hold')) {
      normalized.add('serverHold')
    } else if (code.includes('pendingdelete') || s.includes('pending delete')) {
      normalized.add('pendingDelete')
    } else if (code.includes('redemption')) {
      normalized.add('redemptionPeriod')
    } else if (code.includes('clientdeleteprohibited')) {
      normalized.add('clientDeleteProhibited')
    } else if (code.includes('clienttransferprohibited')) {
      normalized.add('clientTransferProhibited')
    } else if (code.includes('clientupdateprohibited')) {
      normalized.add('clientUpdateProhibited')
    } else if (code === 'ok' || code === 'active') {
      normalized.add('active')
    } else if (code.includes('inactive')) {
      normalized.add('inactive')
    }
  }
  
  return Array.from(normalized)
}

/**
 * 计算域名健康状态
 */
function computeDomainState(status, records, expirationDate) {
  const statusLower = (status || []).map(s => String(s).toLowerCase())
  
  // 检查域名状态
  const hasHold = statusLower.some(s => 
    s.includes('clienthold') || s.includes('serverhold') ||
    s.includes('client hold') || s.includes('server hold')
  )
  const isPendingDelete = statusLower.some(s => 
    s.includes('pendingdelete') || s.includes('pending delete')
  )
  const isRedemption = statusLower.some(s => s.includes('redemption'))
  
  // 检查 DNS 记录
  const hasDns = Array.isArray(records) && records.length > 0
  
  // 计算剩余天数
  let daysRemaining = null
  if (expirationDate) {
    try {
      daysRemaining = Math.floor(
        (new Date(expirationDate).getTime() - Date.now()) / (1000 * 3600 * 24)
      )
    } catch {}
  }
  
  // 返回状态
  if (!hasDns) return { state: 'no_dns', daysRemaining }
  if (hasHold) return { state: 'suspended', daysRemaining }
  if (isPendingDelete) return { state: 'pending_delete', daysRemaining }
  if (isRedemption) return { state: 'redemption', daysRemaining }
  
  if (typeof daysRemaining === 'number') {
    if (daysRemaining < 0) return { state: 'expired', daysRemaining }
    if (daysRemaining <= 30) return { state: 'expiring_soon', daysRemaining }
  }
  
  return { state: 'normal', daysRemaining }
}

/**
 * 解析 DNS 记录
 */
function parseDnsRecords(dnsData, domainName) {
  const records = []
  
  // API 返回格式: { domain, records: [...], query_time }
  if (Array.isArray(dnsData.records)) {
    for (const r of dnsData.records) {
      records.push({
        id: `rec-${Date.now()}-${records.length}`,
        type: String(r.type || '').toUpperCase(),
        name: String(r.name || domainName).replace(/\.$/, ''),
        value: String(r.value || r.data || r.target || ''),
        ttl: Number(r.ttl || r.TTL || 300)
      })
    }
    return records
  }
  
  // 兼容其他格式
  const data = dnsData.data || dnsData
  
  if (Array.isArray(data.records)) {
    for (const r of data.records) {
      records.push({
        id: `rec-${Date.now()}-${records.length}`,
        type: String(r.type || '').toUpperCase(),
        name: String(r.name || r.host || domainName).replace(/\.$/, ''),
        value: String(r.value || r.data || r.target || r.answer || ''),
        ttl: Number(r.ttl || r.TTL || 300)
      })
    }
    return records
  }
  
  // 按类型解析
  for (const type of ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA']) {
    const arr = data[type] || data[type.toLowerCase()] || []
    for (const r of (Array.isArray(arr) ? arr : [])) {
      records.push({
        id: `rec-${Date.now()}-${records.length}`,
        type,
        name: String(r.name || r.host || domainName).replace(/\.$/, ''),
        value: String(r.value || r.data || r.target || r.answer || ''),
        ttl: Number(r.ttl || r.TTL || 300)
      })
    }
  }
  
  return records
}

/**
 * 解析 WHOIS 数据
 */
function parseWhoisData(whoisData) {
  const data = whoisData.data || whoisData
  
  const result = {
    registrar: null,
    creationDate: null,
    expirationDate: null,
    updatedDate: null,
    nameServers: [],
    status: [],
    dnssec: null,
    rawText: null
  }
  
  // 注册商
  result.registrar = data.registrar || null
  
  // 日期解析
  if (data.expiration_date) {
    result.expirationDate = parseDate(data.expiration_date)
  }
  if (data.creation_date) {
    result.creationDate = parseDate(data.creation_date)
  }
  if (data.updated_date) {
    result.updatedDate = parseDate(data.updated_date)
  }
  
  // 域名服务器
  if (Array.isArray(data.name_servers)) {
    result.nameServers = data.name_servers.map(ns => String(ns).toLowerCase())
  }
  
  // 状态
  if (data.status) {
    const rawStatus = Array.isArray(data.status) ? data.status : [data.status]
    result.status = normalizeStatus(rawStatus)
  }
  
  // DNSSEC
  result.dnssec = data.dnssec || null
  
  // 原始文本
  result.rawText = data.raw_text || null
  
  return result
}

/**
 * 综合查询域名 (推荐使用 /api/lookup/{domain})
 */
async function lookupDomain(domainName, settings = {}) {
  const apiBase = settings.whoisApiBaseUrl || DEFAULT_API_BASE
  const apiKey = settings.whoisApiKey || ''
  
  // 清理 API Base URL
  const baseUrl = apiBase
    .replace(/\/+$/, '')
    .replace(/\/whois\/\{domain\}$/, '')
    .replace(/\/whois$/, '')
    .replace(/\/api$/, '/api')
  
  const headers = buildHeaders(apiKey)
  
  // 尝试使用综合查询端点
  const lookupUrl = `${baseUrl}/lookup/${encodeURIComponent(domainName)}`
  const lookupResult = await apiRequest(lookupUrl, headers)
  
  if (lookupResult.success && lookupResult.data) {
    const data = lookupResult.data
    
    // 解析综合查询结果
    const dnsRecords = data.dns ? parseDnsRecords(data.dns, domainName) : []
    const whoisInfo = data.whois ? parseWhoisData(data.whois) : {}
    
    const { state, daysRemaining } = computeDomainState(
      whoisInfo.status,
      dnsRecords,
      whoisInfo.expirationDate
    )
    
    return {
      success: true,
      domain: domainName,
      dns: {
        records: dnsRecords,
        queryTime: data.dns?.query_time || data.query_time
      },
      whois: whoisInfo,
      state,
      daysRemaining,
      source: 'lookup'
    }
  }
  
  // 如果综合查询失败，回退到分别查询
  log('Lookup endpoint failed, falling back to separate queries', { 
    domain: domainName, 
    error: lookupResult.error 
  })
  
  // DNS 查询
  const dnsUrl = `${baseUrl}/dns/${encodeURIComponent(domainName)}`
  const dnsResult = await apiRequest(dnsUrl, headers)
  
  // WHOIS 查询
  const whoisUrl = `${baseUrl}/whois/${encodeURIComponent(domainName)}`
  const whoisResult = await apiRequest(whoisUrl, headers)
  
  // 处理结果
  const dnsRecords = dnsResult.success ? parseDnsRecords(dnsResult.data, domainName) : []
  const whoisInfo = whoisResult.success ? parseWhoisData(whoisResult.data) : {}
  
  // 如果两个查询都失败，返回错误
  if (!dnsResult.success && !whoisResult.success) {
    return {
      success: false,
      domain: domainName,
      error: {
        code: 'QUERY_FAILED',
        message: '域名查询失败',
        dnsError: dnsResult.error,
        whoisError: whoisResult.error
      }
    }
  }
  
  const { state, daysRemaining } = computeDomainState(
    whoisInfo.status,
    dnsRecords,
    whoisInfo.expirationDate
  )
  
  return {
    success: true,
    domain: domainName,
    dns: {
      records: dnsRecords,
      error: dnsResult.error
    },
    whois: whoisInfo,
    whoisError: whoisResult.error,
    state,
    daysRemaining,
    source: 'separate'
  }
}

/**
 * 测试 API 配置
 */
async function testApiConfig(settings = {}, testDomain = 'example.com') {
  const apiBase = settings.whoisApiBaseUrl || DEFAULT_API_BASE
  const apiKey = settings.whoisApiKey || ''
  
  const results = {
    ok: false,
    apiBase,
    hasApiKey: !!apiKey,
    tests: {}
  }
  
  const baseUrl = apiBase
    .replace(/\/+$/, '')
    .replace(/\/whois\/\{domain\}$/, '')
    .replace(/\/whois$/, '')
    .replace(/\/api$/, '/api')
  
  const headers = buildHeaders(apiKey)
  
  // 测试 WHOIS 端点
  const whoisUrl = `${baseUrl}/whois/${encodeURIComponent(testDomain)}`
  const whoisResult = await apiRequest(whoisUrl, headers, 10000)
  
  results.tests.whois = {
    url: whoisUrl,
    success: whoisResult.success,
    error: whoisResult.error,
    sample: whoisResult.success ? {
      domain: whoisResult.data?.domain,
      registrar: whoisResult.data?.registrar,
      expiration_date: whoisResult.data?.expiration_date,
      status: whoisResult.data?.status?.slice(0, 3)
    } : null
  }
  
  // 测试 DNS 端点
  const dnsUrl = `${baseUrl}/dns/${encodeURIComponent(testDomain)}`
  const dnsResult = await apiRequest(dnsUrl, headers, 10000)
  
  results.tests.dns = {
    url: dnsUrl,
    success: dnsResult.success,
    error: dnsResult.error,
    sample: dnsResult.success ? {
      domain: dnsResult.data?.domain,
      recordCount: dnsResult.data?.records?.length || 0,
      recordTypes: [...new Set((dnsResult.data?.records || []).map(r => r.type))]
    } : null
  }
  
  // 整体状态
  results.ok = whoisResult.success && dnsResult.success
  
  if (!results.ok) {
    results.errorSummary = []
    if (!whoisResult.success) {
      results.errorSummary.push(`WHOIS: ${whoisResult.error?.message || 'Unknown error'}`)
    }
    if (!dnsResult.success) {
      results.errorSummary.push(`DNS: ${dnsResult.error?.message || 'Unknown error'}`)
    }
  }
  
  return results
}

/**
 * 验证日期格式
 */
function isValidDateString(s) {
  if (!s || typeof s !== 'string') return false
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return year >= 1970 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31
}

module.exports = {
  lookupDomain,
  testApiConfig,
  parseDate,
  normalizeStatus,
  computeDomainState,
  parseDnsRecords,
  parseWhoisData,
  isValidDateString,
  DEFAULT_API_BASE
}





