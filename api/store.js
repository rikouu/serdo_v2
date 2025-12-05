const fs = require('fs')
const path = require('path')

const dataDir = path.join(process.cwd(), 'api', 'data')

function ensureDir() {
  try { fs.mkdirSync(dataDir, { recursive: true }) } catch (e) {}
}

function loadUserData(userId) {
  ensureDir()
  const file = path.join(dataDir, userId + '.json')
  try {
    const s = fs.readFileSync(file, 'utf-8')
    return JSON.parse(s)
  } catch (e) {
    return { providers: [], servers: [], domains: [], settings: { dnsApiProvider: 'cloudflare', dnsFailover: true, whoisApiBaseUrl: 'https://api.whoisproxy.info/whois', whoisApiKey: '', whoisApiMethod: 'POST', serverAutoCheckEnabled: false, serverAutoCheckIntervalHours: 6, domainAutoCheckEnabled: false, domainAutoCheckFrequency: 'daily', serverAutoCheckLastAt: 0, domainAutoCheckLastAt: 0, notifications: { bark: { enabled: false, serverUrl: 'https://api.day.app', key: '' }, smtp: { enabled: false, host: 'smtp.gmail.com', port: 587, username: '', password: '', fromEmail: '' } } } }
  }
}

function saveUserData(userId, data) {
  ensureDir()
  const file = path.join(dataDir, userId + '.json')
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

module.exports = { loadUserData, saveUserData }
