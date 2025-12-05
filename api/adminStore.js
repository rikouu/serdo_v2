const fs = require('fs')
const path = require('path')

function ensureDir(dir) { try { fs.mkdirSync(dir, { recursive: true }) } catch {} }

const dataFile = path.join(process.cwd(), 'api', 'data', 'admin.json')

function loadAdmin() {
  try {
    const s = fs.readFileSync(dataFile, 'utf-8')
    const j = JSON.parse(s)
    if (!j.invites) j.invites = []
    if (typeof j.appName !== 'string') j.appName = 'Serdo'
    if (typeof j.inviteRequired !== 'boolean') j.inviteRequired = false
    return j
  } catch {
    return { appName: 'Serdo', inviteRequired: false, invites: [] }
  }
}

function saveAdmin(a) {
  ensureDir(path.dirname(dataFile))
  const j = Object.assign({ appName: 'Serdo', inviteRequired: false, invites: [] }, a || {})
  fs.writeFileSync(dataFile, JSON.stringify(j, null, 2))
}

function generateInvites(count, expiresAt) {
  const admin = loadAdmin()
  const out = []
  for (let i = 0; i < count; i++) {
    const code = 'INV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
    const item = { code, createdAt: Date.now(), expiresAt: Number(expiresAt || 0) || 0 }
    admin.invites.push(item)
    out.push(item)
  }
  saveAdmin(admin)
  return out
}

function consumeInvite(code, userId) {
  const admin = loadAdmin()
  const idx = admin.invites.findIndex(x => x.code === code)
  if (idx < 0) return null
  const inv = admin.invites[idx]
  admin.invites[idx] = Object.assign({}, inv, { usedBy: userId, usedAt: Date.now() })
  saveAdmin(admin)
  return admin.invites[idx]
}

module.exports = { loadAdmin, saveAdmin, generateInvites, consumeInvite }
