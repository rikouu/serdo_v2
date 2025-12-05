function isStr(v) { return typeof v === 'string' && v.trim().length > 0 }
function isEmail(v) { return typeof v === 'string' && /.+@.+\..+/.test(v) }
function isBool(v) { return typeof v === 'boolean' }
function isNum(v) { return typeof v === 'number' && !Number.isNaN(v) }
function inSet(v, arr) { return arr.includes(String(v)) }
// 检查是否是有效的密文字段值：非空字符串、空字符串（清除）、或 __KEEP__ 占位符
function isSecretField(v) { return typeof v === 'string' }

function validateRegister(b) {
  if (!isStr(b.username)) return false
  if (!isEmail(b.email)) return false
  if (!isStr(b.password) || b.password.length < 6) return false
  return true
}

function validateLogin(b) {
  if (!isStr(b.username)) return false
  if (!isStr(b.password)) return false
  return true
}

function validateUpdateMe(b) {
  if (typeof b.email !== 'undefined' && !isEmail(b.email)) return false
  if (typeof b.password !== 'undefined') {
    if (!isStr(b.password) || b.password.length < 6) return false
    if (!isStr(b.currentPassword) || b.currentPassword.length < 1) return false
  }
  return true
}

function validateSettings(s) {
  if (typeof s !== 'object' || !s) return false
  if (typeof s.dnsApiProvider !== 'undefined' && !inSet(s.dnsApiProvider, ['cloudflare','google','quad9'])) return false
  if (typeof s.dnsFailover !== 'undefined' && !isBool(s.dnsFailover)) return false
  if (typeof s.whoisApiBaseUrl !== 'undefined' && typeof s.whoisApiBaseUrl !== 'string') return false
  // whoisApiKey 可以是任意字符串（包括 __KEEP__ 和空字符串）
  if (typeof s.whoisApiKey !== 'undefined' && !isSecretField(s.whoisApiKey)) return false
  if (typeof s.whoisApiMethod !== 'undefined' && !inSet(String(s.whoisApiMethod).toUpperCase(), ['GET','POST'])) return false
  if (typeof s.serverAutoCheckEnabled !== 'undefined' && !isBool(s.serverAutoCheckEnabled)) return false
  if (typeof s.serverAutoCheckIntervalHours !== 'undefined' && !(isNum(s.serverAutoCheckIntervalHours) && s.serverAutoCheckIntervalHours >= 1 && s.serverAutoCheckIntervalHours <= 168)) return false
  if (typeof s.domainAutoCheckEnabled !== 'undefined' && !isBool(s.domainAutoCheckEnabled)) return false
  if (typeof s.domainAutoCheckFrequency !== 'undefined' && !inSet(s.domainAutoCheckFrequency, ['daily','weekly','monthly'])) return false
  if (typeof s.notifications !== 'undefined') {
    const n = s.notifications
    if (typeof n !== 'object' || !n) return false
    if (typeof n.bark !== 'undefined') {
      const b = n.bark
      if (typeof b !== 'object' || !b) return false
      const ben = !!b.enabled
      if (typeof b.enabled !== 'undefined' && !isBool(b.enabled)) return false
      if (ben) {
        if (!isStr(b.serverUrl)) return false
        // key 可以是 __KEEP__ 或空字符串（清除），所以只检查类型
        if (typeof b.key !== 'undefined' && !isSecretField(b.key)) return false
      } else {
        if (typeof b.serverUrl !== 'undefined' && typeof b.serverUrl !== 'string') return false
        if (typeof b.key !== 'undefined' && typeof b.key !== 'string') return false
      }
    }
    if (typeof n.smtp !== 'undefined') {
      const m = n.smtp
      if (typeof m !== 'object' || !m) return false
      const enabled = !!m.enabled
      if (typeof m.enabled !== 'undefined' && !isBool(m.enabled)) return false
      if (enabled) {
        if (!isStr(m.host)) return false
        if (!(isNum(m.port) && m.port > 0 && m.port < 65536)) return false
      } else {
        if (typeof m.host !== 'undefined' && typeof m.host !== 'string') return false
        if (typeof m.port !== 'undefined' && !(isNum(m.port) || typeof m.port === 'string')) return false
      }
      if (typeof m.secure !== 'undefined' && !isBool(m.secure)) return false
      if (typeof m.requireTLS !== 'undefined' && !isBool(m.requireTLS)) return false
      if (enabled) {
        if (!isStr(m.username)) return false
        // password 可以是 __KEEP__ 或空字符串（清除），所以只检查类型
        if (typeof m.password !== 'undefined' && !isSecretField(m.password)) return false
        if (!isEmail(m.fromEmail)) return false
      } else {
        if (typeof m.username !== 'undefined' && !(typeof m.username === 'string')) return false
        if (typeof m.password !== 'undefined' && !(typeof m.password === 'string')) return false
        if (typeof m.fromEmail !== 'undefined' && !(m.fromEmail === '' || isEmail(m.fromEmail))) return false
      }
    }
    if (typeof n.preferences !== 'undefined') {
      const p = n.preferences
      if (typeof p !== 'object' || !p) return false
      if (typeof p.notifyServerDown !== 'undefined' && !isBool(p.notifyServerDown)) return false
      if (typeof p.notifyDomainExpiring !== 'undefined' && !isBool(p.notifyDomainExpiring)) return false
    }
  }
  return true
}

function validateSmtpTest(b) {
  if (typeof b !== 'object' || !b) return false
  const s = b.smtp || {}
  if (!isStr(s.host)) return false
  if (!isNum(Number(s.port))) return false
  if (!isStr(s.username)) return false
  if (!isStr(s.password)) return false
  if (!isEmail(s.fromEmail)) return false
  if (typeof b.to !== 'undefined' && !isEmail(b.to)) return false
  if (typeof b.subject !== 'undefined' && !isStr(b.subject)) return false
  if (typeof b.body !== 'undefined' && !isStr(b.body)) return false
  return true
}

module.exports = { validateRegister, validateLogin, validateUpdateMe, validateSettings, validateSmtpTest }
