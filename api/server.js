const express = require('express')
const cors = require('cors')
require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { log, error } = require('./logger')

const { createRouter, attachSmtpTestRoute } = require('./routes')
const { attachSshServer } = require('./ssh')
const { loadUserData, saveUserData } = require('./storage')
const fs = require('fs')
const path = require('path')
const { fetch } = require('undici')
const net = require('net')

const app = express()
const corsEnv = String(process.env.CORS_ORIGIN || 'http://localhost:3000')
const corsList = corsEnv.split(',').map(s => String(s).trim()).filter(Boolean)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true)
    if (corsList.includes('*')) return callback(null, true)
    const normalized = String(origin).replace(/\/$/, '')
    const ok = corsList.some(o => normalized === String(o).replace(/\/$/, ''))
    if (ok) return callback(null, true)
    return callback(null, false) // 修改：不使用 Error，返回 false
  },
  credentials: true,
  optionsSuccessStatus: 204
}
app.use(cors(corsOptions))
console.log('[CORS] Allowed origins:', corsList)
app.use(express.json())

const limits = { windowMs: 60 * 1000, max: Number(process.env.RATE_LIMIT_MAX || 300) }
const buckets = new Map()
const metrics = { requests_total: 0, rate_limited_total: 0 }
app.use((req, res, next) => {
  const now = Date.now()
  const key = req.ip || req.headers['x-forwarded-for'] || 'local'
  const b = buckets.get(key) || { count: 0, start: now }
  if (now - b.start > limits.windowMs) { b.count = 0; b.start = now }
  b.count++
  buckets.set(key, b)
  if (b.count > limits.max) { metrics.rate_limited_total++; return res.status(429).json({ code: 'rate_limited' }) }
  metrics.requests_total++
  next()
})

app.get('/api/v1/health', (req, res) => res.json({ ok: true }))
app.use('/api/v1', createRouter())
attachSmtpTestRoute(app)

app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4')
  res.end(`serdo_requests_total ${metrics.requests_total}\nserdo_rate_limited_total ${metrics.rate_limited_total}\n`)
})

const port = Number(process.env.PORT || 4000)
const srv = app.listen(port, function () {
  log('listening on http://localhost:' + port)
})
attachSshServer(srv)

app.use((err, req, res, next) => {
  error(err, { path: req.path })
  res.status(500).json({ code: 'internal_error' })
})

function listUserIds() {
  try {
    const dir = path.join(process.cwd(), 'api', 'data')
    const files = fs.readdirSync(dir)
    return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
  } catch { return [] }
}

// 检查日志记录函数
function addCheckLog(userId, logEntry) {
  try {
    const data = loadUserData(userId)
    const logs = data.checkLogs || []
    const newLog = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      ...logEntry
    }
    // 保留最近100条日志
    const updatedLogs = [newLog, ...logs].slice(0, 100)
    saveUserData(userId, { ...data, checkLogs: updatedLogs })
    return newLog
  } catch (e) {
    error('Failed to add check log', { userId, error: e.message })
    return null
  }
}

// 导出供其他模块使用
global.addCheckLog = addCheckLog

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

async function whoisOfciFetch(base, key, name) {
  try {
    let url = String(base || 'http://whois.of.ci/api/whois/{domain}')
    if (/\{domain\}/.test(url) || /\{\{domain\}\}/.test(url)) {
      url = url.replace(/\{\{domain\}\}/g, name).replace(/\{domain\}/g, name)
    } else if (/\/whois($|\?)/.test(url) && !/\/whois\/[^/?]+/.test(url)) {
      url = url.replace(/\/?$/, '/') + encodeURIComponent(name)
    }
    const headers = { accept: 'application/json', 'X-API-Key': String(key || '') }
    const r = await fetch(url, { headers, method: 'GET' })
    if (!r.ok) return null
    try { return await r.json() } catch { return null }
  } catch { return null }
}

async function runAutoChecks() {
  for (const userId of listUserIds()) {
    const data = loadUserData(userId)
    const s = data.settings || {}
    const now = Date.now()
    if (s.serverAutoCheckEnabled) {
      const last = Number(s.serverAutoCheckLastAt || 0)
      const intervalMs = Math.max(1, Number(s.serverAutoCheckIntervalHours || 6)) * 3600 * 1000
      if (now - last >= intervalMs) {
        const startTime = Date.now()
        const updatedServers = []
        const downItems = []
        let checkErrors = []
        
        for (const sv of (data.servers || [])) {
          try {
            const ports = [Number(sv.sshPort || 22), 80, 443]
            const reachable = await pingHost(sv.ip, ports)
            updatedServers.push(Object.assign({}, sv, { status: reachable ? 'running' : 'stopped' }))
            if (!reachable) downItems.push(sv)
          } catch (e) {
            checkErrors.push(`${sv.name}: ${e.message}`)
            updatedServers.push(Object.assign({}, sv, { status: 'stopped' }))
          }
        }
        
        const nextSettings = Object.assign({}, s, { serverAutoCheckLastAt: now })
        const next = Object.assign({}, data, { servers: updatedServers, settings: nextSettings })
        saveUserData(userId, next)
        
        // 记录日志
        const duration = Date.now() - startTime
        addCheckLog(userId, {
          type: 'server',
          trigger: 'auto',
          total: data.servers.length,
          success: data.servers.length - downItems.length,
          failed: downItems.length,
          duration,
          failedItems: downItems.map(x => x.name),
          errors: checkErrors.length > 0 ? checkErrors : undefined,
          notificationSent: false
        })
        
        try {
          const prefs = (s.notifications && s.notifications.preferences) || {}
          if (prefs && prefs.notifyServerDown && downItems.length) {
            const nowStr = new Date().toISOString().replace('T',' ').slice(0,19)
            const body = downItems.map(x => `服务器: ${x.name} | 检测时间: ${nowStr}`).join('\n')
            const sent = await sendNotification(s, '服务器宕机通知', body)
            // 更新日志标记已发送通知
            const logData = loadUserData(userId)
            if (logData.checkLogs && logData.checkLogs[0]) {
              logData.checkLogs[0].notificationSent = sent
              saveUserData(userId, logData)
            }
          }
        } catch {}
      }
    }
    if (s.domainAutoCheckEnabled) {
      const last = Number(s.domainAutoCheckLastAt || 0)
      const freq = String(s.domainAutoCheckFrequency || 'daily')
      const intervalMs = freq === 'weekly' ? (7*24*3600*1000) : (freq === 'monthly' ? (30*24*3600*1000) : (24*3600*1000))
      if (now - last >= intervalMs) {
        const startTime = Date.now()
        const base = s.whoisApiBaseUrl || 'http://whois.of.ci/api/whois/{domain}'
        const key = s.whoisApiKey || ''
        const updatedDomains = []
        const expiringItems = []
        let successCount = 0
        let failedCount = 0
        let checkErrors = []
        
        for (const d of (data.domains || [])) {
          try {
            let exp = d.expirationDate || ''
            const wp = await whoisOfciFetch(base, key, d.name)
            const wpData = wp && (wp.data || wp)
            if (wpData && typeof wpData.expiration_date === 'string') {
              const pd = String(wpData.expiration_date).split(' ')[0]
              if (pd) {
                exp = pd
                successCount++
              }
            } else {
              failedCount++
            }
            updatedDomains.push(Object.assign({}, d, { expirationDate: exp }))
            try {
              const days = Math.floor((new Date(exp).getTime() - now) / (1000*3600*24))
              if (exp && days <= 30) expiringItems.push({ name: d.name, expirationDate: exp, daysRemaining: days })
            } catch {}
          } catch (e) {
            checkErrors.push(`${d.name}: ${e.message}`)
            updatedDomains.push(d)
            failedCount++
          }
        }
        
        const nextSettings = Object.assign({}, s, { domainAutoCheckLastAt: now })
        const next = Object.assign({}, data, { domains: updatedDomains, settings: nextSettings })
        saveUserData(userId, next)
        
        // 记录日志
        const duration = Date.now() - startTime
        addCheckLog(userId, {
          type: 'domain',
          trigger: 'auto',
          total: data.domains.length,
          success: successCount,
          failed: failedCount,
          duration,
          expiringItems: expiringItems.map(x => ({name: x.name, expirationDate: x.expirationDate, days: x.daysRemaining})),
          errors: checkErrors.length > 0 ? checkErrors : undefined,
          notificationSent: false
        })
        
        try {
          const prefs = (s.notifications && s.notifications.preferences) || {}
          if (prefs && prefs.notifyDomainExpiring && expiringItems.length) {
            const body = expiringItems.map(x => `域名: ${x.name} | 到期时间: ${x.expirationDate}`).join('\n')
            const sent = await sendNotification(s, '域名到期通知', body)
            // 更新日志标记已发送通知
            const logData = loadUserData(userId)
            if (logData.checkLogs && logData.checkLogs[0]) {
              logData.checkLogs[0].notificationSent = sent
              saveUserData(userId, logData)
            }
          }
        } catch {}
      }
    }
  }
}

setInterval(() => { runAutoChecks().catch(() => {}) }, 5 * 60 * 1000)

async function sendNotification(settings, title, body) {
  let sent = false
  try {
    const { fetch } = require('undici')
    let nodemailer = null
    try { nodemailer = require('nodemailer') } catch {}
    const bark = settings && settings.notifications && settings.notifications.bark
    if (bark && bark.enabled && bark.serverUrl && bark.key) {
      const url = `${String(bark.serverUrl).replace(/\/$/, '')}/${encodeURIComponent(String(bark.key))}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`
      try { 
        const res = await fetch(url)
        if (res.ok) {
          sent = true
          info('Bark notification sent', { title })
        } else {
          error('Bark notification failed', { status: res.status })
        }
      } catch (e) {
        error('Bark notification error', { error: e.message })
      }
    }
    const smtp = settings && settings.notifications && settings.notifications.smtp
    if (smtp && smtp.enabled && nodemailer) {
      try {
        const transporter = nodemailer.createTransport({ host: smtp.host, port: Number(smtp.port || 587), secure: false, auth: { user: smtp.username, pass: smtp.password } })
        await transporter.sendMail({ from: smtp.fromEmail || smtp.username, to: smtp.fromEmail || smtp.username, subject: title, text: body })
        sent = true
        info('Email notification sent', { title })
      } catch (e) {
        error('Email notification error', { error: e.message })
      }
    }
  } catch (e) {
    error('Notification error', { error: e.message })
  }
  return sent
}
