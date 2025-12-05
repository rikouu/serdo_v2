#!/usr/bin/env node
const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(process.cwd(), 'api', 'data', 'serdo.db'))

function listUsersIndexes() {
  const idx = db.prepare("PRAGMA index_list('users')").all()
  const rows = idx.map(i => ({ name: i.name, unique: !!i.unique }))
  console.log('users index list:', rows)
}

function explainUserQuery() {
  const plan = db.prepare('EXPLAIN QUERY PLAN SELECT id, username, email FROM users WHERE username = ? AND email = ?').all('alice', 'alice@example.com')
  console.log('explain query plan:', plan)
}

listUsersIndexes()
explainUserQuery()

