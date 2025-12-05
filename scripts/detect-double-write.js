#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const db = new Database(path.join(process.cwd(), 'api', 'data', 'serdo.db'))

function readJson() {
  const f = path.join(process.cwd(), 'api', 'data', 'users.json')
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')) } catch { return [] }
}

function readDb() {
  return db.prepare('SELECT id, username, email FROM users').all()
}

function main() {
  const json = readJson()
  const dbRows = readDb()
  const jMap = new Map(json.map(u => [u.id, u]))
  const diffs = []
  for (const r of dbRows) {
    const j = jMap.get(r.id)
    if (!j) continue
    if (j.username !== r.username || (j.email||'') !== (r.email||'')) {
      diffs.push({ id: r.id, json: { username: j.username, email: j.email }, db: { username: r.username, email: r.email } })
    }
  }
  if (diffs.length) {
    console.error('[double-write] diffs detected:', JSON.stringify(diffs, null, 2))
    process.exit(2)
  }
  console.log('no diffs')
}

main()

