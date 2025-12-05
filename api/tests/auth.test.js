const { fetch } = require('undici')

async function run() {
  const base = process.env.TEST_BASE || 'http://localhost:4000/api/v1'
  const uname = 'u_' + Date.now().toString(36)
  const mail = uname + '@example.com'
  const pwd = 'p_' + Math.random().toString(36).slice(2)
  const r1 = await fetch(base + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: uname, email: mail, password: pwd }) })
  if (!r1.ok) throw new Error('register_failed')
  const j1 = await r1.json()
  if (!j1 || !j1.token || !j1.user || j1.user.username !== uname) throw new Error('register_response_invalid')
  const token = j1.token
  const h = { 'content-type': 'application/json', 'authorization': 'Bearer ' + token }
  const r2 = await fetch(base + '/me', { headers: h })
  if (!r2.ok) throw new Error('me_failed')
  const j2 = await r2.json()
  if (!j2 || !j2.user || j2.user.username !== uname || j2.user.email !== mail) throw new Error('me_response_invalid')
  const newMail = uname + '+updated@example.com'
  const r3 = await fetch(base + '/me', { method: 'PATCH', headers: h, body: JSON.stringify({ email: newMail }) })
  if (!r3.ok) throw new Error('me_patch_failed')
  const j3 = await r3.json()
  if (!j3 || !j3.user || j3.user.email !== newMail) throw new Error('me_patch_response_invalid')
  const r4 = await fetch(base + '/me', { headers: h })
  if (!r4.ok) throw new Error('me_after_patch_failed')
  const j4 = await r4.json()
  if (!j4 || !j4.user || j4.user.email !== newMail) throw new Error('me_after_patch_invalid')
  console.log('OK', { username: uname })
}

run().catch(e => { console.error('TEST_FAILED', e && e.message ? e.message : e) ; process.exit(1) })
