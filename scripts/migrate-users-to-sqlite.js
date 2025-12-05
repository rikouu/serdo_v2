#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function main() {
  const Database = require('better-sqlite3')
  const dataDir = path.join(process.cwd(), 'api', 'data')
  try { fs.mkdirSync(dataDir, { recursive: true }) } catch {}
  const dbFile = path.join(dataDir, 'serdo.db')
  const db = new Database(dbFile)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT,
      password TEXT,
      salt TEXT
    );
  `)
  const usersFile = path.join(dataDir, 'users.json')
  if (!fs.existsSync(usersFile)) {
    console.log('users.json not found')
    process.exit(0)
  }
  let users = []
  try { users = JSON.parse(fs.readFileSync(usersFile, 'utf-8')) } catch { users = [] }
  if (!Array.isArray(users) || users.length === 0) {
    console.log('no users to migrate')
    process.exit(0)
  }
  const stmt = db.prepare('INSERT INTO users (id, username, email, password, salt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, email=excluded.email, password=excluded.password, salt=excluded.salt')
  const tx = db.transaction((list) => { for (const u of list) stmt.run(u.id, u.username, u.email || '', u.password || '', u.salt || '') })
  tx(users)
  console.log('migrated', users.length, 'users into', dbFile)
}

main()

