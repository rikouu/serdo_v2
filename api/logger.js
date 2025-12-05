let sentry = null
function init() {
  try {
    const dsn = process.env.SENTRY_DSN || ''
    if (dsn) {
      sentry = require('@sentry/node')
      sentry.init({ dsn })
    }
  } catch {}
}

function log(...args) {
  try { console.log('[api]', ...args) } catch {}
}

function error(err, context) {
  try { console.error('[api]', err) } catch {}
  try {
    if (sentry) {
      sentry.captureException(err, { extra: context || {} })
    }
  } catch {}
}

function audit(userId, action, payload) {
  try {
    const fs = require('fs')
    const path = require('path')
    const dir = path.join(process.cwd(), 'api', 'data')
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    const f = path.join(dir, 'audit.log')
    const line = JSON.stringify({ at: new Date().toISOString(), userId, action, payload })
    fs.appendFileSync(f, line + '\n')
  } catch {}
}

init()

module.exports = { log, error, audit }
