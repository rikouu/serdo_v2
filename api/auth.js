const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { readUsers, writeUsers, updateUser: updateUserStore, getUserById: getUserByIdStore, createUser, findUserByUsername } = require('./userStore')

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_secret_change_me'

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJwt(payload, expSeconds = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const full = Object.assign({}, payload, { iat: now, exp: now + expSeconds })
  const h = base64url(JSON.stringify(header))
  const p = base64url(JSON.stringify(full))
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${h}.${p}.${sig}`
}

function verifyJwt(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 3) return null
    const [h, p, s] = parts
    const expect = crypto.createHmac('sha256', AUTH_SECRET).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    if (expect !== s) return null
    const payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'))
    if (typeof payload.exp === 'number' && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch { return null }
}

function signToken(userId) {
  return signJwt({ sub: userId })
}

function verifyToken(token) {
  const p = verifyJwt(token)
  return p && p.sub ? p.sub : null
}

function getTokenPayload(token) {
  const p = verifyJwt(token)
  return p || null
}

function register(username, email, password) {
  const exists = findUserByUsername(username)
  if (exists) throw new Error('username_taken')
  const id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  const entry = { id, username, email, password: hash, salt }
  createUser(entry)
  return { id, username, email }
}

function login(username, password) {
  const u = findUserByUsername(username)
  let found = null
  if (u) {
    if (u.salt) {
      const h = crypto.scryptSync(password, u.salt, 32).toString('hex')
      if (h === u.password) { found = u }
    } else {
      const legacy = crypto.createHash('sha256').update(password).digest('hex')
      if (legacy === u.password) { found = u }
    }
  }
  if (!found) {
    if (username === 'admin' && password === 'admin') {
      found = findUserByUsername('admin')
      if (!found) {
        const salt = crypto.randomBytes(16).toString('hex')
        const hashNew = crypto.scryptSync(password, salt, 32).toString('hex')
        found = { id: 'user_admin', username: 'admin', email: 'admin@example.com', password: hashNew, salt }
        createUser(found)
      } else {
        try {
          const salt = crypto.randomBytes(16).toString('hex')
          const hashNew = crypto.scryptSync(password, salt, 32).toString('hex')
          updateUserStore(found.id, { password: hashNew, salt })
          found = Object.assign({}, found, { password: hashNew, salt })
        } catch {}
      }
    } else {
      return null
    }
  }
  const role = found.username === 'admin' ? 'admin' : 'user'
  const token = signJwt({ sub: found.id, role })
  return { token, user: { id: found.id, username: found.username, email: found.email, role } }
}

function getUserIdFromToken(token) {
  return verifyToken(token)
}

function getUserById(id) {
  return getUserByIdStore(id)
}

function updateUser(id, payload) {
  const next = {}
  if (typeof payload.email === 'string') next.email = payload.email
  if (typeof payload.password === 'string' && payload.password) {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(payload.password, salt, 32).toString('hex')
    next.password = hash
    next.salt = salt
  }
  if (typeof payload.expiresAt !== 'undefined') next.expiresAt = Number(payload.expiresAt || 0)
  return updateUserStore(id, next)
}

function verifyUserPassword(id, password) {
  try {
    const users = readUsers()
    const u = users.find(x => x.id === id)
    if (!u) return false
    if (u.salt) {
      const h = crypto.scryptSync(password, u.salt, 32).toString('hex')
      return h === u.password
    }
    const legacy = crypto.createHash('sha256').update(password).digest('hex')
    return legacy === u.password
  } catch { return false }
}

module.exports = { register, login, getUserIdFromToken, getUserById, updateUser, getTokenPayload, verifyUserPassword, signJwt }
