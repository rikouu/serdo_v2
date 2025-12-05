const fs = require('fs')
const path = require('path')

const useSqlite = String(process.env.USE_SQLITE || 'true') === 'true'
let db = null
let Database = null

function ensureDir(dir) { try { fs.mkdirSync(dir, { recursive: true }) } catch {} }

function init() {
  if (!useSqlite) return
  try {
    Database = require('better-sqlite3')
    const dataDir = path.join(process.cwd(), 'api', 'data')
    ensureDir(dataDir)
    const file = path.join(dataDir, 'serdo.db')
    db = new Database(file)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT,
        password TEXT,
        salt TEXT,
        expiresAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_users_username_email ON users(username, email);
    `)
    try { db.exec('ALTER TABLE users ADD COLUMN expiresAt INTEGER'); } catch {}
  } catch { db = null }
}

function readUsers() {
  if (db) {
    const rows = db.prepare('SELECT id, username, email, password, salt, expiresAt FROM users').all()
    return rows
  }
  const usersFile = path.join(process.cwd(), 'api', 'data', 'users.json')
  try { return JSON.parse(fs.readFileSync(usersFile, 'utf-8')) } catch { return [] }
}

function writeUsers(users) {
  if (db) {
    const stmt = db.prepare('INSERT INTO users (id, username, email, password, salt, expiresAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, email=excluded.email, password=excluded.password, salt=excluded.salt, expiresAt=excluded.expiresAt')
    const tx = db.transaction((list) => { for (const u of list) stmt.run(u.id, u.username, u.email || '', u.password || '', u.salt || '', Number(u.expiresAt || 0)) })
    tx(users)
    return
  }
  const usersFile = path.join(process.cwd(), 'api', 'data', 'users.json')
  ensureDir(path.dirname(usersFile))
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
}

function createUser(entry) {
  if (db) {
    db.prepare('INSERT INTO users (id, username, email, password, salt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)').run(entry.id, entry.username, entry.email || '', entry.password || '', entry.salt || '', Number(entry.expiresAt || 0))
    return { id: entry.id, username: entry.username, email: entry.email }
  }
  const users = readUsers()
  const next = users.filter(u => u.id !== entry.id).concat([entry])
  writeUsers(next)
  return { id: entry.id, username: entry.username, email: entry.email }
}

function findUserByUsername(username) {
  if (db) {
    const u = db.prepare('SELECT id, username, email, password, salt, expiresAt FROM users WHERE username = ?').get(username)
    return u || null
  }
  const users = readUsers()
  return users.find(u => u.username === username) || null
}

function updateUser(id, payload) {
  if (db) {
    const current = db.prepare('SELECT id, username, email, password, salt, expiresAt FROM users WHERE id = ?').get(id)
    if (!current) return null
    const next = Object.assign({}, current, payload)
    db.prepare('INSERT INTO users (id, username, email, password, salt, expiresAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, email=excluded.email, password=excluded.password, salt=excluded.salt, expiresAt=excluded.expiresAt').run(next.id, next.username, next.email || '', next.password || '', next.salt || '', Number(next.expiresAt || 0))
    return { id: next.id, username: next.username, email: next.email }
  }
  const users = readUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return null
  const next = Object.assign({}, users[idx], payload)
  users[idx] = next
  writeUsers(users)
  return { id: next.id, username: next.username, email: next.email }
}

function getUserById(id) {
  if (db) {
    const u = db.prepare('SELECT id, username, email, expiresAt FROM users WHERE id = ?').get(id)
    return u ? { id: u.id, username: u.username, email: u.email, expiresAt: u.expiresAt || 0 } : null
  }
  const users = readUsers()
  const u = users.find(x => x.id === id)
  return u ? { id: u.id, username: u.username, email: u.email, expiresAt: u.expiresAt || 0 } : null
}

init()

module.exports = { readUsers, writeUsers, updateUser, getUserById, createUser, findUserByUsername }
