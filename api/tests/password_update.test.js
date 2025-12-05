const { fetch } = require('undici')
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const BASE = process.env.TEST_BASE || 'http://localhost:4000/api/v1'

async function req(pathname, init) {
  const r = await fetch(BASE + pathname, Object.assign({ headers: { 'Content-Type': 'application/json' } }, init))
  if (!r.ok) {
    const t = await r.text()
    const err = new Error(t)
    err.status = r.status
    throw err
  }
  return r.json()
}

function readUsers() {
  const file = path.join(process.cwd(), 'api', 'data', 'users.json')
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

async function run() {
  const ts = Date.now()
  const username = 'u_' + ts
  const email = `u_${ts}@example.com`
  const p1 = 'Password#123'
  const p2 = 'Password#456'

  // register
  const reg = await req('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password: p1 }) })
  assert.ok(reg && reg.user && reg.user.id, 'register user failed')

  // login
  const login = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password: p1 }) })
  assert.ok(login && login.token, 'login failed')
  const token = login.token

  // wrong current password should fail
  try {
    await req('/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ password: p2, currentPassword: 'wrong' }) })
    assert.fail('Expected 401 for wrong current password')
  } catch (e) {
    assert.strictEqual(e.status, 401, 'status should be 401')
    try {
      const j = JSON.parse(String(e.message || ''))
      assert.strictEqual(j.code, 'invalid_current_password')
    } catch {}
  }

  // verify endpoint should report invalid
  try {
    await req('/auth/verify-password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ currentPassword: 'wrong' }) })
    assert.fail('Expected 401 for invalid verify')
  } catch (e) {
    assert.strictEqual(e.status, 401)
  }

  // correct current -> update password
  const up = await req('/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ password: p2, currentPassword: p1 }) })
  assert.ok(up && up.user, 'update response missing user')

  // login with new password succeeds
  const login2 = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password: p2 }) })
  assert.ok(login2 && login2.token, 'login with new password failed')

  // login with old password fails
  try {
    await req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password: p1 }) })
    assert.fail('Expected login with old password to fail')
  } catch (e) {
    assert.strictEqual(e.status, 401)
  }

  // DB hash updated
  const users = readUsers()
  const u = users.find(x => x.username === username)
  assert.ok(u && u.salt && u.password, 'stored user missing salt or password')
  assert.ok(typeof u.password === 'string' && u.password.length > 20, 'password should be hashed')

  console.log('OK: password update flow tested')
}

run().catch(err => { console.error('TEST FAILED', err); process.exit(1) })
