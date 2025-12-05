const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const useSqlite = String(process.env.USE_SQLITE || 'true') === 'true'
let db = null

const AUTH_SECRET = String(process.env.AUTH_SECRET || '')

function getKey() {
  const h = crypto.createHash('sha256').update(AUTH_SECRET || 'serdo_default_secret').digest()
  return h // 32 bytes
}

function encString(plain) {
  try {
    if (!plain) return plain
    const iv = crypto.randomBytes(12)
    const key = getKey()
    const c = crypto.createCipheriv('aes-256-gcm', key, iv)
    const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()])
    const tag = c.getAuthTag()
    return `enc:gcm:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
  } catch { return plain }
}

function decString(value) {
  try {
    if (typeof value !== 'string') return value
    if (!/^enc:gcm:/i.test(value)) return value
    const [, , ivB64, tagB64, dataB64] = String(value).split(':')
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const data = Buffer.from(dataB64, 'base64')
    const key = getKey()
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv)
    d.setAuthTag(tag)
    const out = Buffer.concat([d.update(data), d.final()])
    return out.toString('utf8')
  } catch { return '' }
}

function encryptAtRest(obj) {
  try {
    const clone = JSON.parse(JSON.stringify(obj || {}))
    clone.servers = (clone.servers || []).map(s => {
      const next = Object.assign({}, s)
      if (typeof next.password === 'string' && next.password) next.password = encString(next.password)
      if (typeof next.sshPassword === 'string' && next.sshPassword) next.sshPassword = encString(next.sshPassword)
      if (typeof next.providerPassword === 'string' && next.providerPassword) next.providerPassword = encString(next.providerPassword)
      return next
    })
    clone.providers = (clone.providers || []).map(p => {
      const next = Object.assign({}, p)
      if (typeof next.password === 'string' && next.password) next.password = encString(next.password)
      return next
    })
    const s = clone.settings || {}
    const noti = s.notifications || {}
    const smtp = Object.assign({}, noti.smtp || {})
    const bark = Object.assign({}, noti.bark || {})
    if (typeof smtp.password === 'string' && smtp.password) smtp.password = encString(smtp.password)
    if (typeof bark.key === 'string' && bark.key) bark.key = encString(bark.key)
    if (typeof s.whoisApiKey === 'string' && s.whoisApiKey) s.whoisApiKey = encString(s.whoisApiKey)
    clone.settings = Object.assign({}, s, { notifications: Object.assign({}, noti, { smtp, bark }) })
    return clone
  } catch { return obj }
}

function decryptForUse(obj) {
  try {
    const clone = JSON.parse(JSON.stringify(obj || {}))
    clone.servers = (clone.servers || []).map(s => {
      const next = Object.assign({}, s)
      if (typeof next.password === 'string') next.password = decString(next.password)
      if (typeof next.sshPassword === 'string') next.sshPassword = decString(next.sshPassword)
      if (typeof next.providerPassword === 'string') next.providerPassword = decString(next.providerPassword)
      return next
    })
    clone.providers = (clone.providers || []).map(p => {
      const next = Object.assign({}, p)
      if (typeof next.password === 'string') next.password = decString(next.password)
      return next
    })
    const s = clone.settings || {}
    const noti = s.notifications || {}
    const smtp = Object.assign({}, noti.smtp || {})
    const bark = Object.assign({}, noti.bark || {})
    if (typeof smtp.password === 'string') smtp.password = decString(smtp.password)
    if (typeof bark.key === 'string') bark.key = decString(bark.key)
    if (typeof s.whoisApiKey === 'string') s.whoisApiKey = decString(s.whoisApiKey)
    clone.settings = Object.assign({}, s, { notifications: Object.assign({}, noti, { smtp, bark }) })
    return clone
  } catch { return obj }
}

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
}

function init() {
  if (!useSqlite) return
  try {
    const Database = require('better-sqlite3')
    const dataDir = path.join(process.cwd(), 'api', 'data')
    ensureDir(dataDir)
    const file = path.join(dataDir, 'serdo.db')
    db = new Database(file)
    db.exec(`PRAGMA foreign_keys = ON;`)
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)
  } catch {
    db = null
  }
}

function loadUserData(userId) {
  if (db) {
    const row = db.prepare('SELECT data FROM user_data WHERE user_id = ?').get(userId)
    if (row && row.data) {
      try { return decryptForUse(JSON.parse(row.data)) } catch {}
    }
  }
  const dataDir = path.join(process.cwd(), 'api', 'data')
  ensureDir(dataDir)
  const file = path.join(dataDir, userId + '.json')
  try {
    const s = fs.readFileSync(file, 'utf-8')
    return decryptForUse(JSON.parse(s))
  } catch {
    // 默认设置（不含硬编码密钥）
    return { 
      providers: [], 
      servers: [], 
      domains: [], 
      settings: { 
        whoisApiBaseUrl: 'http://whois.of.ci/api/whois/{domain}', 
        whoisApiKey: '', 
        whoisApiMethod: 'GET', 
        serverAutoCheckEnabled: false, 
        serverAutoCheckIntervalHours: 6, 
        domainAutoCheckEnabled: false, 
        domainAutoCheckFrequency: 'daily', 
        serverAutoCheckLastAt: 0, 
        domainAutoCheckLastAt: 0, 
        notifications: { 
          bark: { enabled: false, serverUrl: 'https://api.day.app', key: '' }, 
          smtp: { enabled: false, host: 'smtp.gmail.com', port: 587, username: '', password: '', fromEmail: '' },
          preferences: { notifyServerDown: true, notifyDomainExpiring: true }
        } 
      } 
    }
  }
}

function saveUserData(userId, data) {
  if (db) {
    const js = JSON.stringify(encryptAtRest(data))
    db.prepare('INSERT INTO user_data (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(userId, js)
    return
  }
  const dataDir = path.join(process.cwd(), 'api', 'data')
  ensureDir(dataDir)
  const file = path.join(dataDir, userId + '.json')
  fs.writeFileSync(file, JSON.stringify(encryptAtRest(data), null, 2))
}

init()

module.exports = { loadUserData, saveUserData }
