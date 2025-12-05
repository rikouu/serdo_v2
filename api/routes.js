const express = require('express')
const { register, login, getUserIdFromToken, getUserById, updateUser, getTokenPayload, verifyUserPassword, signJwt } = require('./auth')
const { loadUserData, saveUserData } = require('./storage')
const { validateProvider, validateServer, validateDomain } = require('./validate')
const { validateRegister, validateLogin, validateUpdateMe, validateSettings, validateSmtpTest } = require('./schema')
const { audit, log } = require('./logger')
const { lookupDomain, testApiConfig, isValidDateString, computeDomainState } = require('./whoisService')
const { fetch } = require('undici')
const net = require('net')
const crypto = require('crypto')
const REDACT_MODE = String(process.env.REDACT_MODE || 'false') === 'true'
let nodemailer = null
try { nodemailer = require('nodemailer') } catch {}

function getToken(req) {
  const h = req.header('authorization') || ''
  return h.indexOf('Bearer ') === 0 ? h.slice(7) : undefined
}

function createRouter() {
  const r = express.Router()

  function redactData(data) {
    try {
      const clone = JSON.parse(JSON.stringify(data || {}))
      clone.servers = (clone.servers || []).map(s => {
        const { password, sshPassword, providerPassword, ...rest } = s || {}
        return Object.assign({}, rest, {
          hasPassword: !!password,
          hasSshPassword: !!sshPassword,
          hasProviderPassword: !!providerPassword
        })
      })
      clone.providers = (clone.providers || []).map(p => {
        const { password, ...rest } = p || {}
        return Object.assign({}, rest, { hasPassword: !!password })
      })
      const s = clone.settings || {}
      const noti = s.notifications || {}
      const smtp = Object.assign({}, noti.smtp || {})
      const bark = Object.assign({}, noti.bark || {})
      if (smtp && smtp.password) { smtp.hasPassword = true; delete smtp.password }
      if (bark && bark.key) { bark.hasKey = true; delete bark.key }
      if (s && s.whoisApiKey) { s.hasWhoisApiKey = true; delete s.whoisApiKey }
      clone.settings = Object.assign({}, s, { notifications: Object.assign({}, noti, { smtp, bark }) })
      return clone
    } catch { return { providers: [], servers: [], domains: [], settings: {} } }
  }

  r.post('/auth/register', (req, res) => {
    const { loadAdmin, consumeInvite } = require('./adminStore')
    const b = req.body || {}
    if (!(typeof b.username === 'string' && b.username.trim().length > 0)) return res.status(400).json({ code: 'invalid_username' })
    if (!(typeof b.email === 'string' && /.+@.+\..+/.test(b.email))) return res.status(400).json({ code: 'invalid_email' })
    if (!(typeof b.password === 'string' && b.password.length >= 6)) return res.status(400).json({ code: 'weak_password' })
    const adminCfg = loadAdmin()
    if (adminCfg.inviteRequired) {
      if (!(typeof b.inviteCode === 'string' && b.inviteCode.trim().length > 0)) return res.status(400).json({ code: 'invite_required' })
      const inv = (adminCfg.invites || []).find(x => x.code === b.inviteCode)
      if (!inv) return res.status(400).json({ code: 'invalid_invite' })
      if (Number(inv.expiresAt || 0) > 0 && Date.now() > Number(inv.expiresAt)) return res.status(400).json({ code: 'invite_expired' })
    }
    try {
      try { log('register', { username: b.username, email: b.email }) } catch {}
      const user = register(b.username, b.email, b.password)
      if (adminCfg.inviteRequired) {
        const inv = (adminCfg.invites || []).find(x => x.code === b.inviteCode)
        const expiresAt = inv ? Number(inv.expiresAt || 0) : 0
        const { updateUser } = require('./auth')
        updateUser(user.id, { expiresAt })
        consumeInvite(b.inviteCode, user.id)
      }
      const result = login(b.username, b.password)
      audit(result?.user?.id || user.id, 'user_register', { username: b.username })
      res.json(result || { user })
    } catch (e) {
      res.status(409).json({ code: e.message || 'error' })
    }
  })

  r.post('/auth/login', (req, res) => {
    const b = req.body || {}
    if (!validateLogin(b)) return res.status(400).json({ code: 'invalid' })
    try { log('login', { username: b.username }) } catch {}
    const { findUserByUsername } = require('./userStore')
    const u = findUserByUsername(b.username)
    if (u && Number(u.expiresAt || 0) > 0 && Date.now() > Number(u.expiresAt)) {
      return res.status(401).json({ code: 'account_expired' })
    }
    const result = login(b.username, b.password)
    if (!result) return res.status(401).json({ code: 'unauthorized' })
    res.json(result)
  })

  r.post('/auth/verify-password', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const b = req.body || {}
    const pwd = String(b.currentPassword || '')
    if (!pwd) return res.status(400).json({ code: 'invalid' })
    const ok = verifyUserPassword(userId, pwd)
    if (!ok) return res.status(401).json({ code: 'invalid_current_password' })
    res.json({ ok: true })
  })

  r.post('/reveal/session', (req, res) => {
    try {
      const token = getToken(req)
      const userId = getUserIdFromToken(token)
      if (!userId) return res.status(401).json({ code: 'unauthorized' })
      const b = req.body || {}
      const pwd = String(b.currentPassword || '')
      if (!pwd) return res.status(400).json({ code: 'invalid' })
      const ok = verifyUserPassword(userId, pwd)
      if (!ok) return res.status(401).json({ code: 'invalid_current_password' })
      const rk = crypto.randomBytes(32).toString('base64')
      res.json({ key: rk })
    } catch (e) { res.status(500).json({ code: 'internal_error' }) }
  })

  function wrapSecret(plain, rk) {
    try {
      if (!plain) {
        console.log('[wrapSecret] ⚠️ plain is empty or undefined')
        return null
      }
      if (!rk) {
        console.log('[wrapSecret] ⚠️ rk (reveal key) is empty or undefined')
        return null
      }
      
      const plainStr = String(plain)
      const iv = crypto.randomBytes(12)
      const key = Buffer.from(rk, 'base64')
      
      // 验证密钥长度
      if (key.length !== 32) {
        console.error('[wrapSecret] ❌ Invalid key length:', key.length, 'expected 32 bytes')
        return null
      }
      
      console.log('[wrapSecret] 🔐 Encrypting:', {
        plainLength: plainStr.length,
        rkLength: rk.length,
        keyLength: key.length,
        ivLength: iv.length
      })
      
      const c = crypto.createCipheriv('aes-256-gcm', key, iv)
      const enc = Buffer.concat([c.update(plainStr, 'utf8'), c.final()])
      const tag = c.getAuthTag()
      
      const result = { 
        iv: iv.toString('base64'), 
        tag: tag.toString('base64'), 
        data: enc.toString('base64') 
      }
      
      console.log('[wrapSecret] ✅ Encrypted successfully:', {
        ivLength: result.iv.length,
        tagLength: result.tag.length,
        dataLength: result.data.length
      })
      
      return result
    } catch (err) { 
      console.error('[wrapSecret] ❌ Encryption failed:', err.message)
      return null
    }
  }

  function getRevealPayload(req) {
    try {
      const rk = String(req.header('x-reveal-key') || '')
      const token = getToken(req)
      const userId = getUserIdFromToken(token)
      if (!userId || !rk) return null
      return { sub: userId, rk }
    } catch { return null }
  }

  function isAdminReq(req) {
    try {
      const token = getToken(req)
      const p = getTokenPayload(token)
      if (!p) return false
      if (String(p.role || '') === 'admin') return true
      const u = getUserById(p.sub)
      return !!(u && String(u.username) === 'admin')
    } catch { return false }
  }

  r.get('/reveal/servers/:id', (req, res) => {
    const p = getRevealPayload(req)
    if (!p) return res.status(401).json({ code: 'unauthorized' })
    const userId = p.sub
    const data = loadUserData(userId)
    const s = (data.servers || []).find(x => x.id === req.params.id)
    if (!s) return res.status(404).json({ code: 'not_found' })
    const rk = String(p.rk)
    const out = {
      panelPassword: wrapSecret(s.password, rk),
      sshPassword: wrapSecret(s.sshPassword, rk),
      providerPassword: wrapSecret(s.providerPassword, rk)
    }
    res.json(out)
  })

  r.get('/reveal/providers/:id', (req, res) => {
    const p = getRevealPayload(req)
    if (!p) return res.status(401).json({ code: 'unauthorized' })
    const userId = p.sub
    const data = loadUserData(userId)
    const pv = (data.providers || []).find(x => x.id === req.params.id)
    if (!pv) return res.status(404).json({ code: 'not_found' })
    const rk = String(p.rk)
    res.json({ password: wrapSecret(pv.password, rk) })
  })

  r.get('/reveal/test', (req, res) => {
    const p = getRevealPayload(req)
    if (!p) return res.status(401).json({ code: 'unauthorized' })
    res.json({ ok: true })
  })

  r.get('/reveal/settings/whois-key', (req, res) => {
    const p = getRevealPayload(req)
    if (!p) return res.status(401).json({ code: 'unauthorized' })
    const userId = p.sub
    const data = loadUserData(userId)
    const s = data.settings || {}
    const rk = String(p.rk)
    // 如果没有 key，返回 null 而不是 404
    if (!s.whoisApiKey) return res.json({ whoisApiKey: null })
    res.json({ whoisApiKey: wrapSecret(s.whoisApiKey, rk) })
  })

  r.get('/reveal/settings/key', (req, res) => {
    const p = getRevealPayload(req)
    if (!p) return res.status(401).json({ code: 'unauthorized' })
    const userId = p.sub
    const data = loadUserData(userId)
    const s = data.settings || {}
    const rk = String(p.rk)
    // 如果没有 key，返回 null 而不是 404
    if (!s.whoisApiKey) return res.json({ whoisApiKey: null })
    res.json({ whoisApiKey: wrapSecret(s.whoisApiKey, rk) })
  })

  r.get('/reveal/settings/bark-key', (req, res) => {
    const p = getRevealPayload(req)
    if (!p) return res.status(401).json({ code: 'unauthorized' })
    const userId = p.sub
    const data = loadUserData(userId)
    const s = data.settings || {}
    const bark = (s.notifications || {}).bark || {}
    const rk = String(p.rk)
    if (!bark.key) return res.json({ barkKey: null })
    res.json({ barkKey: wrapSecret(bark.key, rk) })
  })

  r.get('/reveal/settings/smtp-password', (req, res) => {
    const p = getRevealPayload(req)
    if (!p) return res.status(401).json({ code: 'unauthorized' })
    const userId = p.sub
    const data = loadUserData(userId)
    const s = data.settings || {}
    const smtp = (s.notifications || {}).smtp || {}
    const rk = String(p.rk)
    if (!smtp.password) return res.json({ smtpPassword: null })
    res.json({ smtpPassword: wrapSecret(smtp.password, rk) })
  })

  r.get('/me', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    try { log('me', { userId }) } catch {}
    const data = loadUserData(userId)
    const user = getUserById(userId)
    const p = getTokenPayload(token)
    const role = (p && p.role) ? String(p.role) : ((user && user.username === 'admin') ? 'admin' : 'user')
    res.json({ userId, user: Object.assign({}, user || {}, { role }), data: REDACT_MODE ? redactData(data) : data })
  })

  r.get('/me/export', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    res.json({ data })
  })
  r.post('/me/import', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const b = req.body || {}
    const payload = b.data
    if (!payload || typeof payload !== 'object') return res.status(400).json({ code: 'invalid_payload' })
    try { saveUserData(userId, payload); res.json({ ok: true }) } catch { res.status(500).json({ code: 'internal_error' }) }
  })

  // Admin routes
  r.get('/admin/settings', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { loadAdmin } = require('./adminStore')
    res.json(loadAdmin())
  })
  r.post('/admin/settings', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { saveAdmin, loadAdmin } = require('./adminStore')
    const b = req.body || {}
    const current = loadAdmin()
    const next = Object.assign({}, current, { appName: typeof b.appName === 'string' ? b.appName : current.appName, inviteRequired: typeof b.inviteRequired === 'boolean' ? b.inviteRequired : current.inviteRequired })
    saveAdmin(next)
    res.json(next)
  })
  r.post('/admin/invites/generate', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { generateInvites } = require('./adminStore')
    const b = req.body || {}
    const count = Math.max(1, Math.min(500, Number(b.count || 1)))
    const expiresAt = Number(b.expiresAt || 0)
    const out = generateInvites(count, expiresAt)
    res.json({ invites: out })
  })
  r.get('/admin/invites', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { loadAdmin } = require('./adminStore')
    const a = loadAdmin()
    res.json({ invites: a.invites || [] })
  })
  r.patch('/admin/invites/:code', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { loadAdmin, saveAdmin } = require('./adminStore')
    const a = loadAdmin()
    const idx = (a.invites || []).findIndex(x => x.code === req.params.code)
    if (idx < 0) return res.status(404).json({ code: 'not_found' })
    const b = req.body || {}
    a.invites[idx] = Object.assign({}, a.invites[idx], { expiresAt: Number(b.expiresAt || 0) })
    saveAdmin(a)
    res.json(a.invites[idx])
  })
  r.delete('/admin/invites/:code', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { loadAdmin, saveAdmin } = require('./adminStore')
    const a = loadAdmin()
    a.invites = (a.invites || []).filter(x => x.code !== req.params.code)
    saveAdmin(a)
    res.json({ ok: true })
  })
  r.get('/admin/users', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { readUsers } = require('./userStore')
    const users = readUsers().map(u => ({ id: u.id, username: u.username, email: u.email, expiresAt: u.expiresAt || 0 }))
    res.json({ users })
  })
  r.patch('/admin/users/:id', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { updateUser } = require('./auth')
    const b = req.body || {}
    const r2 = updateUser(req.params.id, { expiresAt: Number(b.expiresAt || 0) })
    if (!r2) return res.status(404).json({ code: 'not_found' })
    res.json(r2)
  })
  r.delete('/admin/users/:id', (req, res) => {
    if (!isAdminReq(req)) return res.status(403).json({ code: 'forbidden' })
    const { readUsers, writeUsers } = require('./userStore')
    const usersAll = readUsers()
    const target = usersAll.find(u => u.id === req.params.id)
    if (!target) return res.status(404).json({ code: 'not_found' })
    if (String(target.username) === 'admin') return res.status(403).json({ code: 'cannot_delete_admin' })
    const users = usersAll.filter(u => u.id !== req.params.id)
    writeUsers(users)
    res.json({ ok: true })
  })

  r.patch('/me', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const b = req.body || {}
    if (!validateUpdateMe(b)) {
      if (typeof b.password !== 'undefined') {
        if (!(typeof b.password === 'string' && b.password.length >= 6)) return res.status(400).json({ code: 'weak_password' })
        if (!(typeof b.currentPassword === 'string' && b.currentPassword.length > 0)) return res.status(400).json({ code: 'current_password_required' })
      }
      if (typeof b.email !== 'undefined' && !(typeof b.email === 'string' && /.+@.+\..+/.test(b.email))) return res.status(400).json({ code: 'invalid_email' })
      return res.status(400).json({ code: 'invalid' })
    }
    try { log('me.update', { userId, email: !!b.email, password: !!b.password }) } catch {}
    const current = getUserById(userId)
    const emailWillChange = typeof b.email === 'string' && b.email !== (current?.email || '')
    const mustVerify = (typeof b.password === 'string' && b.password) || emailWillChange || (typeof b.currentPassword === 'string' && b.currentPassword)
    const wantsPasswordChange = typeof b.password === 'string' && !!b.password
    const wantsEmailChange = emailWillChange
    if (!wantsPasswordChange && !wantsEmailChange) {
      return res.status(400).json({ code: 'no_change' })
    }
    if (mustVerify) {
      const ok = verifyUserPassword(userId, String(b.currentPassword || ''))
      if (!ok) return res.status(401).json({ code: 'invalid_current_password' })
    }
    const updated = updateUser(userId, { email: b.email, password: b.password })
    audit(userId, 'user_update', { email: !!b.email, password: !!b.password })
    if (!updated) return res.status(404).json({ code: 'not_found' })
    res.json({ user: updated })
  })

  r.get('/providers', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    res.json(REDACT_MODE ? redactData(data).providers : data.providers)
  })

  r.post('/providers', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const p = req.body || {}
    if (!validateProvider(p)) return res.status(400).json({ code: 'invalid' })
    const data = loadUserData(userId)
    const old = (data.providers || []).find(x => x.id === p.id)
    const merged = Object.assign({}, old || {}, p)
    // 只有当请求中没有包含 password 字段时，才保留原值
    // 如果请求中包含了空字符串，则清除密码
    if (old && !('password' in p)) merged.password = old.password
    const next = Object.assign({}, data, { providers: data.providers.filter(x => x.id !== merged.id).concat([merged]) })
    saveUserData(userId, next)
    audit(userId, 'provider_upsert', { id: p.id })
    if (REDACT_MODE) {
      const red = redactData(next)
      return res.json(red.providers.find(x => x.id === p.id) || { id: p.id })
    }
    res.json(merged)
  })

  r.delete('/providers/:id', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const next = Object.assign({}, data, { providers: data.providers.filter(p => p.id !== req.params.id) })
    saveUserData(userId, next)
    audit(userId, 'provider_delete', { id: req.params.id })
    res.json({ ok: true })
  })

  r.get('/servers', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    res.json(REDACT_MODE ? redactData(data).servers : data.servers)
  })

  r.post('/servers/check', async (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const settings = data.settings || {}
    const startTime = Date.now()
    const results = []
    const updatedServers = []
    let checkErrors = []
    
    async function pingHost(ip, ports) {
      for (const p of ports) {
        const ok = await new Promise(resolve => {
          const s = net.createConnection({ host: ip, port: p }, () => { try { s.destroy() } catch {}; resolve(true) })
          s.setTimeout(5000, () => { try { s.destroy() } catch {}; resolve(false) })
          s.on('error', () => { resolve(false) })
        })
        if (ok) return true
      }
      return false
    }
    
    for (const s of (data.servers || [])) {
      try {
        const ports = []
        const sshPort = Number(s.sshPort || 22)
        ports.push(sshPort)
        ports.push(80)
        ports.push(443)
        const reachable = await pingHost(s.ip, ports)
        results.push({ id: s.id, name: s.name, reachable })
        const nextStatus = reachable ? 'running' : 'stopped'
        updatedServers.push(Object.assign({}, s, { status: nextStatus }))
      } catch (e) {
        checkErrors.push(`${s.name}: ${e.message}`)
        results.push({ id: s.id, name: s.name, reachable: false })
        updatedServers.push(Object.assign({}, s, { status: 'stopped' }))
      }
    }
    
    // 更新服务器状态和自动检查时间
    const now = Date.now()
    const nextSettings = Object.assign({}, settings, { serverAutoCheckLastAt: now })
    const next = Object.assign({}, data, { servers: updatedServers, settings: nextSettings })
    saveUserData(userId, next)
    
    // 记录日志
    const duration = Date.now() - startTime
    const failedItems = results.filter(r => !r.reachable)
    global.addCheckLog(userId, {
      type: 'server',
      trigger: 'manual',
      total: data.servers.length,
      success: data.servers.length - failedItems.length,
      failed: failedItems.length,
      duration,
      failedItems: failedItems.map(x => x.name),
      errors: checkErrors.length > 0 ? checkErrors : undefined,
      notificationSent: false
    })
    
    // 发送通知
    const prefs = (settings.notifications && settings.notifications.preferences) || {}
    if (prefs.notifyServerDown && failedItems.length > 0) {
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0,19)
      const body = failedItems.map(r => `服务器: ${r.name} | 检测时间: ${nowStr}`).join('\n')
      const sent = await sendNotification(settings, '服务器宕机通知', body)
      // 更新日志标记已发送通知
      const logData = loadUserData(userId)
      if (logData.checkLogs && logData.checkLogs[0]) {
        logData.checkLogs[0].notificationSent = sent
        saveUserData(userId, logData)
      }
    }
    
    res.json({ results })
  })

  r.post('/servers/:id/ping', async (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const target = (data.servers || []).find(s => s.id === req.params.id)
    if (!target) return res.status(404).json({ code: 'not_found' })
    function pingOnce(host, port) {
      return new Promise(resolve => {
        const start = Date.now()
        const s = net.createConnection({ host, port }, () => { const ms = Date.now() - start; try { s.destroy() } catch {}; resolve({ ok: true, ms }) })
        s.setTimeout(5000, () => { try { s.destroy() } catch {}; resolve({ ok: false, ms: null }) })
        s.on('error', () => { resolve({ ok: false, ms: null }) })
      })
    }
    const ports = [Number(target.sshPort || 22), 80, 443]
    let latencyMs = null
    let reachable = false
    for (const p of ports) {
      const r = await pingOnce(target.ip, p)
      if (r.ok) { reachable = true; latencyMs = r.ms; break }
    }
    const nextStatus = reachable ? 'running' : 'stopped'
    const updated = (data.servers || []).map(s => s.id === target.id ? Object.assign({}, s, { status: nextStatus, lastPingMs: latencyMs }) : s)
    saveUserData(userId, Object.assign({}, data, { servers: updated }))
    res.json({ reachable, latencyMs })
  })

  r.post('/servers', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const s = req.body || {}
    if (!validateServer(s)) return res.status(400).json({ code: 'invalid' })
    const data = loadUserData(userId)
    const old = (data.servers || []).find(x => x.id === s.id)
    const merged = Object.assign({}, old || {}, s)
    if (old) {
      // 只有当请求中没有包含该字段时，才保留原值
      // 如果请求中包含了空字符串，则清除密码
      if (!('password' in s)) merged.password = old.password
      if (!('sshPassword' in s)) merged.sshPassword = old.sshPassword
      if (!('providerPassword' in s)) merged.providerPassword = old.providerPassword
    }
    const next = Object.assign({}, data, { servers: data.servers.filter(x => x.id !== merged.id).concat([merged]) })
    saveUserData(userId, next)
    audit(userId, 'server_upsert', { id: s.id })
    if (REDACT_MODE) {
      const red = redactData(next)
      return res.json(red.servers.find(x => x.id === s.id) || { id: s.id })
    }
    res.json(merged)
  })

  r.delete('/servers/:id', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const next = Object.assign({}, data, { servers: data.servers.filter(s => s.id !== req.params.id) })
    saveUserData(userId, next)
    audit(userId, 'server_delete', { id: req.params.id })
    res.json({ ok: true })
  })

  r.get('/domains', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    res.json(data.domains)
  })

  r.post('/domains', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const d = req.body || {}
    if (!validateDomain(d)) return res.status(400).json({ code: 'invalid' })
    const data = loadUserData(userId)
    const old = (data.domains || []).find(x => x.id === d.id)
    const merged = Object.assign({}, old || {}, d)
    if (old) {
      if (!('name' in d) || !d.name) merged.name = old.name
      if (!('registrar' in d) || !d.registrar) merged.registrar = old.registrar
      if (!('dnsProvider' in d) || !d.dnsProvider) merged.dnsProvider = old.dnsProvider
      if (!('expirationDate' in d) || !d.expirationDate) merged.expirationDate = old.expirationDate
      if (!('records' in d) || !Array.isArray(d.records)) merged.records = old.records
      if (!('autoRenew' in d)) merged.autoRenew = old.autoRenew
      if (!('registrarProviderId' in d)) merged.registrarProviderId = old.registrarProviderId
      if (!('dnsProviderId' in d)) merged.dnsProviderId = old.dnsProviderId
    }
    const next = Object.assign({}, data, { domains: data.domains.filter(x => x.id !== merged.id).concat([merged]) })
    saveUserData(userId, next)
    audit(userId, 'domain_upsert', { id: d.id })
    res.json(merged)
  })

  r.post('/domains/check', async (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const settings = data.settings || {}
    const startTime = Date.now()
    const results = []
    let successCount = 0
    let failedCount = 0
    let checkErrors = []
    let expiringItems = []
    const now = Date.now()
    function parseDateFromText(text) {
      if (!text || typeof text !== 'string') return null
      const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/)
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
      const dmy = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
      const mmm = text.match(/(\d{1,2})\-([A-Za-z]{3})\-(\d{4})/)
      if (mmm) {
        const months = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
        const mm = months[mmm[2]] || '01'
        const dd = String(mmm[1]).padStart(2, '0')
        return `${mmm[3]}-${mm}-${dd}`
      }
      return null
    }
    function findValueByKeys(obj, keys) {
      try {
        if (!obj || typeof obj !== 'object') return undefined
        for (const k of Object.keys(obj)) {
          const v = obj[k]
          if (keys.includes(String(k))) return v
          const sub = findValueByKeys(v, keys)
          if (typeof sub !== 'undefined') return sub
        }
      } catch {}
      return undefined
    }

    function getByPath(obj, path) {
      try {
        if (!path || !obj) return undefined
        const segs = String(path).split('.').filter(Boolean)
        let cur = obj
        for (const s of segs) { if (cur && typeof cur === 'object') cur = cur[s]; else return undefined }
        return cur
      } catch { return undefined }
    }
    async function tcpWhois(host, query) {
      return await new Promise(resolve => {
        let content = ''
        try {
          const s = net.createConnection({ host, port: 43 }, () => { try { s.write(query + "\r\n") } catch {} })
          s.setTimeout(8000, () => { try { s.destroy() } catch {}; resolve(null) })
          s.on('data', buf => { content += buf.toString('utf-8') })
          s.on('end', () => resolve(content))
          s.on('error', () => resolve(null))
        } catch { resolve(null) }
      })
    }
    async function whoisOfciFetchLocal(name) {
      try {
        let base = String(settings.whoisApiBaseUrl || 'http://whois.of.ci/api/whois/{domain}')
        let url = ''
        const headers = { accept: 'application/json', 'X-API-Key': String(settings.whoisApiKey || '') }
        if (/\{domain\}/.test(base) || /\{\{domain\}\}/.test(base)) {
          url = base.replace(/\{\{domain\}\}/g, name).replace(/\{domain\}/g, name)
        } else {
          url = /\/whois($|\?)/.test(base) && !/\/whois\/[^/?]+/.test(base) ? base.replace(/\/?$/, '/') + encodeURIComponent(name) : base
        }
        const r = await fetch(url, { headers, method: 'GET' })
        if (!r.ok) return null
        try { return await r.json() } catch { return null }
      } catch { return null }
    }
    function computeState(st, recs, expStr) {
      const s = (st || []).map(x => String(x).toLowerCase())
      const hasHold = s.some(x => x.includes('client hold') || x.includes('server hold') || x.includes('clienthold') || x.includes('serverhold'))
      const isPendingDelete = s.some(x => x.includes('pending delete') || x.includes('pendingdelete'))
      const isRedemption = s.some(x => x.includes('redemption'))
      const hasDns = Array.isArray(recs) && recs.length > 0
      let days = null
      if (expStr) {
        try { days = Math.floor((new Date(expStr).getTime() - Date.now()) / (1000*3600*24)) } catch {}
      }
      if (!hasDns) return 'no_dns'
      if (hasHold) return 'suspended'
      if (isPendingDelete) return 'pending_delete'
      if (isRedemption) return 'redemption'
      if (typeof days === 'number') {
        if (days < 0) return 'expired'
        if (days < 30) return 'expiring_soon'
      }
      return 'normal'
    }
    

    for (const d of (data.domains || [])) {
      let exp = ''
      let statusArr = undefined
      let fetched = false
      try {
        let wp = await whoisOfciFetchLocal(d.name)
        if (wp) {
          try {
            const ap = wp && (wp.data || wp)
          if (ap && typeof ap.expiration_date === 'string') {
            const pd = String(ap.expiration_date).split(' ')[0]
            if (pd) exp = pd
            if (pd) fetched = true
          }
          const detail = ap && ap.detail
          if (detail && Array.isArray(detail.date)) {
            const s = detail.date.find(x => typeof x === 'string') || ''
            const pd = parseDateFromText(String(s))
            if (pd) { exp = pd; fetched = true }
          }
          function findValueByKeysLocal(obj, keys) {
            try {
              if (!obj || typeof obj !== 'object') return undefined
              for (const k of Object.keys(obj)) {
                const v = obj[k]
                if (keys.includes(String(k))) return v
                const sub = findValueByKeysLocal(v, keys)
                if (typeof sub !== 'undefined') return sub
              }
            } catch {}
            return undefined
          }
          const cand = findValueByKeysLocal(ap, ['expires','expiry','expiration','expirationDate','expiration_date','registryExpiryDate','Expiry Date','Registrar Registration Expiration Date'])
          if (typeof cand === 'string') {
            const pd = parseDateFromText(cand)
            if (pd) { exp = pd; fetched = true }
          }
          if (Array.isArray(cand)) {
            const s = cand.find(x => typeof x === 'string' && /Expiry|Expiration/i.test(x)) || cand[0]
            const pd = parseDateFromText(String(s))
            if (pd) { exp = pd; fetched = true }
          }
          const txt = findValueByKeysLocal(wp, ['whois','raw','text'])
          const lines = Array.isArray(txt) ? txt.join('\n') : (typeof txt === 'string' ? txt : '')
          if (lines && !exp) {
            const m = lines.match(/(?:Expiry|Expiration) Date:\s*([^\n]+)/i)
            if (m && m[1]) {
              const pd = parseDateFromText(m[1].trim())
              if (pd) { exp = pd; fetched = true }
            }
          }
            const stCand = (wp && wp.status) || (wp && wp.result && wp.result.status)
            let sts = []
            if (Array.isArray(stCand)) sts = stCand.map(x => String(x))
            else if (typeof stCand === 'string') sts = String(stCand).split(/[\,\n]+/).map(x => x.trim())
            statusArr = sts && sts.length ? sts : undefined
          } catch {}
        }
        if (wp && !exp) {
          try {
            const detail = wp && wp.results && wp.results.detail
          if (detail && Array.isArray(detail.date)) {
            const s = detail.date.find(x => typeof x === 'string') || ''
            const pd = parseDateFromText(String(s))
            if (pd) exp = pd
          }
          const cand = findValueByKeys(wp, ['expires','expiry','expiration','expirationDate','expiration_date','registryExpiryDate','Expiry Date','Registrar Registration Expiration Date'])
          if (typeof cand === 'string') {
            const pd = parseDateFromText(cand)
            if (pd) exp = pd
          }
          if (Array.isArray(cand)) {
            const s = cand.find(x => typeof x === 'string' && /Expiry|Expiration/i.test(x)) || cand[0]
            const pd = parseDateFromText(String(s))
            if (pd) exp = pd
          }
            const txt = findValueByKeys(wp, ['whois','raw','text'])
            const lines = Array.isArray(txt) ? txt.join('\n') : (typeof txt === 'string' ? txt : '')
            if (lines && !exp) {
              const m = lines.match(/(?:Expiry|Expiration) Date:\s*([^\n]+)/i)
              if (m && m[1]) {
                const pd = parseDateFromText(m[1].trim())
                if (pd) exp = pd
              }
            }
          } catch {}
        }
        // 如果主 API 没有获取到，尝试备用解析
        if (!exp) {
          const wp2 = await whoisOfciFetchLocal(d.name)
        if (wp2) {
          try {
            const ap2 = wp2 && wp2.result && typeof wp2.result === 'object' ? wp2.result : null
            if (ap2 && typeof ap2.expiration_date === 'string') {
              const pd2 = String(ap2.expiration_date).split(' ')[0]
              if (pd2) { exp = pd2; fetched = true }
            }
            const detail2 = wp2 && wp2.results && wp2.results.detail
            if (detail2 && Array.isArray(detail2.date)) {
              const s2 = detail2.date.find(x => typeof x === 'string') || ''
              const pd2 = parseDateFromText(String(s2))
              if (pd2) { exp = pd2; fetched = true }
            }
            const cand2 = findValueByKeys(wp2, ['expires','expiry','expiration','expirationDate','expiration_date','registryExpiryDate','Expiry Date','Registrar Registration Expiration Date'])
            if (typeof cand2 === 'string') {
              const pd2 = parseDateFromText(cand2)
              if (pd2) { exp = pd2; fetched = true }
            }
            if (Array.isArray(cand2)) {
              const s2 = cand2.find(x => typeof x === 'string' && /Expiry|Expiration/i.test(x)) || cand2[0]
              const pd2 = parseDateFromText(String(s2))
              if (pd2) { exp = pd2; fetched = true }
            }
              const txt2 = findValueByKeys(wp2, ['whois','raw','text'])
              const lines2 = Array.isArray(txt2) ? txt2.join('\n') : (typeof txt2 === 'string' ? txt2 : '')
              if (lines2 && !exp) {
                const m2 = lines2.match(/(?:Expiry|Expiration) Date:\s*([^\n]+)/i)
                if (m2 && m2[1]) {
                  const pd2 = parseDateFromText(m2[1].trim())
                  if (pd2) { exp = pd2; fetched = true }
                }
              }
            } catch {}
          }
        }
        if (!fetched && d.expirationDate) {
          fetched = true
          exp = d.expirationDate
        }
        const state = computeState(statusArr, d.records || [], exp)
        const ok = !!fetched
        const nextDomain = Object.assign({}, d, { expirationDate: exp || d.expirationDate || '', status: statusArr || d.status || null, state })
        results.push({ id: d.id, name: d.name, ok, expirationDate: nextDomain.expirationDate })
        
        if (ok) {
          successCount++
          const days = Math.floor((new Date(nextDomain.expirationDate).getTime() - now) / (1000*3600*24))
          if (exp && days <= 30) {
            expiringItems.push({ name: d.name, expirationDate: nextDomain.expirationDate, days })
          }
        } else {
          failedCount++
        }
        
        const next = Object.assign({}, data, { domains: data.domains.map(x => x.id === d.id ? nextDomain : x) })
        saveUserData(userId, next)
      } catch (e) {
        checkErrors.push(`${d.name}: ${e.message}`)
        results.push({ id: d.id, name: d.name, ok: false, expirationDate: d.expirationDate })
        failedCount++
      }
    }
    
    // 更新域名自动检查时间
    const nextSettings = Object.assign({}, settings, { domainAutoCheckLastAt: now })
    const finalData = loadUserData(userId)
    saveUserData(userId, Object.assign({}, finalData, { settings: nextSettings }))
    
    // 记录日志
    const duration = Date.now() - startTime
    global.addCheckLog(userId, {
      type: 'domain',
      trigger: 'manual',
      total: data.domains.length,
      success: successCount,
      failed: failedCount,
      duration,
      expiringItems: expiringItems.map(x => ({name: x.name, expirationDate: x.expirationDate, days: x.days})),
      errors: checkErrors.length > 0 ? checkErrors : undefined,
      notificationSent: false
    })
    
    // 发送通知
    try {
      const prefs = (settings.notifications && settings.notifications.preferences) || {}
      if (prefs.notifyDomainExpiring && expiringItems.length > 0) {
        const body = expiringItems.map(x => `域名: ${x.name} | 到期时间: ${x.expirationDate}`).join('\n')
        const sent = await sendNotification(settings, '域名到期通知', body)
        // 更新日志标记已发送通知
        const logData = loadUserData(userId)
        if (logData.checkLogs && logData.checkLogs[0]) {
          logData.checkLogs[0].notificationSent = sent
          saveUserData(userId, logData)
        }
      }
    } catch {}
    
    res.json({ results })
  })

  r.delete('/domains/:id', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const next = Object.assign({}, data, { domains: data.domains.filter(d => d.id !== req.params.id) })
    saveUserData(userId, next)
    audit(userId, 'domain_delete', { id: req.params.id })
    res.json({ ok: true })
  })

  // 域名同步 - 使用优化的 whoisService
  r.post('/domains/:id/sync', async (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    
    const data = loadUserData(userId)
    const domain = data.domains.find(d => d.id === req.params.id)
    if (!domain) return res.status(404).json({ code: 'not_found' })

    const settings = data.settings || {}
    
    try {
      log('Domain sync started', { domain: domain.name, userId })
      
      // 使用优化的 whoisService 进行查询
      const result = await lookupDomain(domain.name, settings)
      
      if (!result.success) {
        log('Domain sync failed', { 
          domain: domain.name, 
          error: result.error 
        })
        return res.status(502).json({ 
          code: result.error?.code || 'lookup_failed',
          message: result.error?.message || '域名查询失败',
          details: result.error
        })
      }
      
      // 提取 DNS 记录
      const records = result.dns?.records || []
      
      if (records.length === 0) {
        return res.status(502).json({ 
          code: 'dns_empty',
          message: '未获取到 DNS 记录，请检查域名是否正确配置'
        })
      }
      
      // 关联服务器 IP
      const linkedRecords = records.map(r => {
        if (r.type === 'A' || r.type === 'AAAA') {
          const matchServer = (data.servers || []).find(s => s.ip === r.value)
          if (matchServer) {
            return { ...r, linkedServerId: matchServer.id }
          }
        }
        return r
      })
      
      // 提取到期时间
      const newExpirationDate = result.whois?.expirationDate || ''
      
      // 检查是否禁用自动覆盖
      const disableOverwrite = !!domain.disableAutoOverwrite
      
      // 如果禁用覆盖，使用现有的到期时间；否则使用新获取的
      const expirationDate = disableOverwrite ? (domain.expirationDate || newExpirationDate) : newExpirationDate
      
      // 只有在非锁定模式且没有有效到期时间时才报错
      if (!disableOverwrite && !isValidDateString(newExpirationDate)) {
        log('Domain sync: invalid expiration date', { 
          domain: domain.name, 
          expirationDate: newExpirationDate,
          whoisData: result.whois 
        })
        return res.status(502).json({ 
          code: 'whois_expiration_invalid',
          message: '无法解析域名到期时间',
          details: { received: newExpirationDate, whois: result.whois }
        })
      }
      
      // 提取状态
      const status = result.whois?.status || ['active']
      
      // 计算域名健康状态 - 使用最终的到期时间
      const { state, daysRemaining } = computeDomainState(
        status, 
        linkedRecords, 
        expirationDate
      )
      
      // 构建更新后的域名对象
      // 如果 disableAutoOverwrite 为 true，保留原有的 registrar、dnsProvider、expirationDate
      const nextDomain = {
        ...domain,
        records: linkedRecords,
        // 根据锁定状态决定是否覆盖
        expirationDate: disableOverwrite ? domain.expirationDate : (newExpirationDate || domain.expirationDate),
        registrar: disableOverwrite ? domain.registrar : (result.whois?.registrar || domain.registrar),
        dnsProvider: disableOverwrite ? domain.dnsProvider : domain.dnsProvider, // DNS Provider 通常不会从 WHOIS 获取
        // 以下字段始终更新
        status,
        state,
        daysRemaining,
        nameServers: result.whois?.nameServers || domain.nameServers || [],
        lastSyncAt: Date.now(),
        lastSyncError: null
      }
      
      // 保存更新
      const next = {
        ...data,
        domains: data.domains.map(d => d.id === domain.id ? nextDomain : d)
      }
      saveUserData(userId, next)
      
      log('Domain sync success', { 
        domain: domain.name, 
        state, 
        daysRemaining,
        recordCount: linkedRecords.length 
      })
      
      res.json(nextDomain)
      
    } catch (e) {
      log('Domain sync error', { 
        domain: domain.name, 
        error: String(e.message || e) 
      })
      res.status(502).json({ 
        code: 'sync_error',
        message: `域名同步失败: ${e.message || '未知错误'}`
      })
    }
  })

  r.get('/settings', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    res.json(REDACT_MODE ? redactData(data).settings : data.settings)
  })

  // API 配置测试 - 使用优化的 whoisService
  r.post('/settings/test-whois', async (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    
    const data = loadUserData(userId)
    const settings = data.settings || {}
    const b = req.body || {}
    const testDomain = String(b.domain || 'example.com')
    
    try {
      log('Testing WHOIS API config', { 
        domain: testDomain,
        apiBase: settings.whoisApiBaseUrl,
        hasApiKey: !!settings.whoisApiKey 
      })
      
      // 使用 whoisService 进行完整测试
      const result = await testApiConfig(settings, testDomain)
      
      if (result.ok) {
        return res.json({
          ok: true,
          message: 'API 配置有效',
          tests: result.tests,
          sample: result.tests.whois?.sample
        })
      } else {
        return res.status(400).json({
          ok: false,
          message: result.errorSummary?.join('; ') || 'API 测试失败',
          tests: result.tests,
          errorSummary: result.errorSummary
        })
      }
    } catch (e) {
      log('WHOIS API test error', { error: String(e.message || e) })
      return res.status(400).json({ 
        ok: false,
        code: 'test_error', 
        message: `测试失败: ${e.message || '未知错误'}`
      })
    }
  })

  r.put('/settings', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const s = req.body || {}
    if (!validateSettings(s)) return res.status(400).json({ code: 'invalid' })
    const data = loadUserData(userId)
    const oldSettings = data.settings || {}

    // 密文字段占位符检测函数 - 只有明确的占位符才保留原值，空字符串表示清除
    const isKeepPlaceholder = (val) => val === '********' || val === '__KEEP__'
    // 检查字段是否存在于请求中
    const hasField = (obj, key) => obj && key in obj

    function mergeSettings(a, b) {
      const out = Object.assign({}, a)
      for (const k of Object.keys(b)) {
        const v = b[k]
        if (k === 'notifications' && typeof v === 'object' && v) {
          const an = a.notifications || {}
          const bn = v
          
          // 处理 bark.key
          const barkNew = bn.bark || {}
          const bark = Object.assign({}, an.bark || {}, barkNew)
          if (hasField(barkNew, 'key')) {
            if (isKeepPlaceholder(barkNew.key)) {
              bark.key = (an.bark || {}).key || ''  // 保留原值
            }
            // 否则使用新值（包括空字符串来清除）
          }
          
          // 处理 smtp.password
          const smtpNew = bn.smtp || {}
          const smtp = Object.assign({}, an.smtp || {}, smtpNew)
          if (hasField(smtpNew, 'password')) {
            if (isKeepPlaceholder(smtpNew.password)) {
              smtp.password = (an.smtp || {}).password || ''  // 保留原值
            }
            // 否则使用新值（包括空字符串来清除）
          }
          
          const preferences = Object.assign({}, an.preferences || {}, bn.preferences || {})
          out.notifications = { bark, smtp, preferences }
          continue
        }
        
        // 处理 whoisApiKey
        if (k === 'whoisApiKey') {
          if (isKeepPlaceholder(v)) {
            // 保留原值，不更新
            continue
          }
          // 否则使用新值（包括空字符串来清除）
        }
        
        out[k] = v
      }
      if (!out.notifications) {
        out.notifications = a.notifications || { bark: { enabled: false, serverUrl: 'https://api.day.app', key: '' }, smtp: { enabled: false, host: 'smtp.gmail.com', port: 587, username: '', password: '', fromEmail: '' }, preferences: { notifyServerDown: true, notifyDomainExpiring: true } }
      }
      return out
    }

    const nextSettings = mergeSettings(oldSettings, s)
    const next = Object.assign({}, data, { settings: nextSettings })
    saveUserData(userId, next)
    audit(userId, 'settings_update', {})
    
    // 返回时，如果是 REDACT_MODE，返回脱敏后的数据
    if (REDACT_MODE) {
      const redacted = redactData(next)
      return res.json(redacted.settings)
    }
    res.json(next.settings)
  })

  r.post('/audit/run', requireRole('admin'), (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const md = '# Audit Report\n\nServers: ' + data.servers.length + '\nDomains: ' + data.domains.length
    res.json({ report: md })
  })

  // 获取检查日志
  r.get('/check-logs', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const logs = data.checkLogs || []
    const page = Math.max(1, parseInt(req.query.page || '1'))
    const pageSize = Math.max(1, Math.min(50, parseInt(req.query.pageSize || '5')))
    const type = req.query.type // 'server' or 'domain' or undefined (all)
    
    const filteredLogs = type ? logs.filter(log => log.type === type) : logs
    const total = filteredLogs.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginated = filteredLogs.slice(start, end)
    
    res.json({
      logs: paginated,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  })

  // 获取自动检查状态
  r.get('/check-status', (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = loadUserData(userId)
    const settings = data.settings || {}
    const now = Date.now()
    
    const serverStatus = {
      enabled: !!settings.serverAutoCheckEnabled,
      intervalHours: settings.serverAutoCheckIntervalHours || 6,
      lastCheckAt: settings.serverAutoCheckLastAt || 0,
      nextCheckAt: settings.serverAutoCheckEnabled 
        ? (settings.serverAutoCheckLastAt || 0) + (settings.serverAutoCheckIntervalHours || 6) * 3600 * 1000
        : 0
    }
    
    const domainStatus = {
      enabled: !!settings.domainAutoCheckEnabled,
      frequency: settings.domainAutoCheckFrequency || 'daily',
      lastCheckAt: settings.domainAutoCheckLastAt || 0,
      nextCheckAt: settings.domainAutoCheckEnabled
        ? (settings.domainAutoCheckLastAt || 0) + (
            settings.domainAutoCheckFrequency === 'weekly' ? 7*24*3600*1000 :
            settings.domainAutoCheckFrequency === 'monthly' ? 30*24*3600*1000 :
            24*3600*1000
          )
        : 0
    }
    
    res.json({
      server: serverStatus,
      domain: domainStatus,
      currentTime: now
    })
  })

  return r
}

module.exports = { createRouter, attachSmtpTestRoute }

async function sendNotification(settings, title, body) {
  try {
    const bark = settings && settings.notifications && settings.notifications.bark
    if (bark && bark.enabled && bark.serverUrl && bark.key) {
      const url = `${String(bark.serverUrl).replace(/\/$/, '')}/${encodeURIComponent(String(bark.key))}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`
      try { await fetch(url) } catch {}
    }
    const smtp = settings && settings.notifications && settings.notifications.smtp
    if (smtp && smtp.enabled && nodemailer) {
      try {
        const transporter = nodemailer.createTransport({ host: smtp.host, port: Number(smtp.port || 587), secure: false, auth: { user: smtp.username, pass: smtp.password } })
        await transporter.sendMail({ from: smtp.fromEmail || smtp.username, to: smtp.fromEmail || smtp.username, subject: title, text: body })
      } catch {}
    }
  } catch {}
}
// SMTP test endpoint
// POST /notifications/smtp/test { smtp: { host, port, username, password, fromEmail }, to?: string, subject?: string, body?: string }
// Requires Authorization
// Returns { ok: true } or error status
function createSmtpTransport(smtp) {
  const port = Number(smtp.port || 587)
  const secure = typeof smtp.secure === 'boolean' ? !!smtp.secure : port === 465
  const opts = { host: smtp.host, port, secure, auth: { user: smtp.username, pass: smtp.password } }
  if (typeof smtp.requireTLS === 'boolean') Object.assign(opts, { requireTLS: !!smtp.requireTLS })
  Object.assign(opts, { tls: { servername: smtp.host } })
  Object.assign(opts, { connectionTimeout: 10000, greetingTimeout: 10000 })
  const transporter = nodemailer.createTransport(opts)
  return transporter
}

function attachSmtpTestRoute(app) {
  app.post('/api/v1/notifications/smtp/test', requireRole('admin'), async (req, res) => {
    const token = getToken(req)
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    if (!nodemailer) return res.status(501).json({ code: 'smtp_not_available' })
    const b = req.body || {}
    if (!validateSmtpTest(b)) return res.status(400).json({ code: 'invalid' })
    const smtp = b.smtp || {}
    async function resolveHost(host) {
      try {
        const dns = require('dns')
        const { promisify } = require('node:util')
        const lookup = promisify(dns.lookup)
        const r = await lookup(host)
        return r && r.address ? r.address : null
      } catch { return null }
    }
    async function probePort(host, port) {
      const net = require('net')
      return await new Promise(resolve => {
        try {
          const s = net.createConnection({ host, port }, () => { try { s.destroy() } catch {}; resolve(true) })
          s.setTimeout(7000, () => { try { s.destroy() } catch {}; resolve(false) })
          s.on('error', () => resolve(false))
        } catch { resolve(false) }
      })
    }
    const ip = await resolveHost(smtp.host)
    if (!ip) return res.status(502).json({ code: 'dns_failed', error: 'DNS resolve failed for ' + smtp.host })
    const attempts = []
    const baseAttempt = { host: smtp.host, username: smtp.username, fromEmail: smtp.fromEmail }
    const candidates = []
    const p = Number(smtp.port || 25)
    const hasSecure = typeof smtp.secure === 'boolean'
    const hasRequireTLS = typeof smtp.requireTLS === 'boolean'
    candidates.push({ port: p, secure: hasSecure ? !!smtp.secure : (p === 465), requireTLS: hasRequireTLS ? !!smtp.requireTLS : (p === 587 || p === 25) })
    if (![587].includes(p)) candidates.push({ port: 587, secure: false, requireTLS: true })
    if (![465].includes(p)) candidates.push({ port: 465, secure: true, requireTLS: false })
    let lastError = null
    for (const c of candidates) {
      const reachable = await probePort(smtp.host, c.port)
      attempts.push({ port: c.port, reachable })
      if (!reachable) { lastError = new Error('socket_unreachable'); continue }
      try {
        const transporter = createSmtpTransport(Object.assign({}, smtp, c))
        await transporter.verify()
        const to = b.to || smtp.fromEmail
        const subject = b.subject || 'Serdo SMTP Test'
        const body = b.body || 'SMTP settings validated successfully.'
        const info = await transporter.sendMail({ from: smtp.fromEmail, to, subject, text: body })
        try {
          const data = loadUserData(userId)
          const settings = data.settings || {}
          const nextSettings = Object.assign({}, settings, { 
            notifications: Object.assign({}, settings.notifications || {}, { 
              smtp: Object.assign({}, (settings.notifications && settings.notifications.smtp) || {}, { 
                lastTest: { ok: true, at: Date.now(), to, subject, messageId: info.messageId, attempts }
              })
            })
          })
          const nextData = Object.assign({}, data, { settings: nextSettings })
          saveUserData(userId, nextData)
        } catch {}
        return res.json({ ok: true, messageId: info.messageId, attempts })
      } catch (e) {
        lastError = e
        attempts.push({ port: c.port, error: String(e.message || e), meta: { code: e.code || undefined, command: e.command || undefined, response: e.response || undefined, responseCode: e.responseCode || undefined } })
        continue
      }
    }
    const payload = { 
      code: 'smtp_send_failed', 
      error: String(lastError?.message || lastError || 'unknown_error'), 
      meta: { code: lastError?.code, command: lastError?.command, response: lastError?.response, responseCode: lastError?.responseCode },
      attempts 
    }
    try {
      const data = loadUserData(userId)
      const settings = data.settings || {}
      const nextSettings = Object.assign({}, settings, { 
        notifications: Object.assign({}, settings.notifications || {}, { 
          smtp: Object.assign({}, (settings.notifications && settings.notifications.smtp) || {}, { 
            lastTest: { ok: false, at: Date.now(), to: (req.body||{}).to || (req.body?.smtp?.fromEmail), subject: (req.body||{}).subject || 'Serdo SMTP Test', error: payload.error, meta: payload.meta, attempts }
          })
        })
      })
      const nextData = Object.assign({}, data, { settings: nextSettings })
      saveUserData(userId, nextData)
    } catch {}
    res.status(502).json(payload)
  })
}
  function requireRole(role) {
    return (req, res, next) => {
      const token = getToken(req)
      const p = getTokenPayload(token)
      if (!p) return res.status(401).json({ code: 'unauthorized' })
      if (String(p.role || 'user') !== String(role)) return res.status(403).json({ code: 'forbidden' })
      next()
    }
  }

