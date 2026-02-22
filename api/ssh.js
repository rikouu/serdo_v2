const { Server: WSServer } = require('ws')
const { Client } = require('ssh2')
const { getUserIdFromToken } = require('./auth')
const { loadUserData } = require('./storage')

function attachSshServer(server) {
  const wss = new WSServer({ server, path: '/api/v1/ssh' })

  wss.on('connection', function (ws, req) {
    let conn = null
    let stream = null

    const send = (obj) => { try { ws.send(JSON.stringify(obj)) } catch {} }
    const closeAll = () => {
      try { if (stream) stream.end() } catch {}
      try { if (conn) conn.end() } catch {}
      try { ws.close(1000) } catch {}
    }

    try {
      const u = new URL(req.url, 'http://localhost')
      const token = u.searchParams.get('token') || ''
      const sid = u.searchParams.get('serverId') || ''
      const userId = getUserIdFromToken(token)
      if (!userId || !sid) return ws.close(1008)

      const data = loadUserData(userId)
      const s = (data.servers || []).find(x => x.id === sid)
      if (!s) return ws.close(1008)

      // 构建认证方式：优先 SSH Key，其次密码
      const authOpts = {}
      if (s.sshKey && s.sshKey.trim()) {
        authOpts.privateKey = s.sshKey.trim()
        if (s.sshKeyPassphrase) authOpts.passphrase = s.sshKeyPassphrase
      } else if (s.sshPassword) {
        authOpts.password = s.sshPassword
      } else {
        send({ type: 'error', message: 'no_auth', detail: '未配置 SSH Key 或密码' })
        return ws.close(1011)
      }

      const connOpts = {
        host: s.ip,
        port: Number(s.sshPort || 22),
        username: s.sshUsername || 'root',
        readyTimeout: 20000,
        ...authOpts
      }

      conn = new Client()

      conn.on('ready', function () {
        send({ type: 'status', data: 'ready' })
        conn.shell({ term: 'xterm-256color', env: { LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' } }, function (err, sh) {
          if (err) {
            send({ type: 'error', message: 'shell_error', detail: err.message })
            return closeAll()
          }
          stream = sh

          sh.on('data', function (chunk) {
            send({ type: 'output', data: chunk.toString('utf8') })
          })
          sh.stderr.on('data', function (chunk) {
            send({ type: 'output', data: chunk.toString('utf8') })
          })
          sh.on('close', function () { closeAll() })

          ws.on('message', function (msg) {
            try {
              const obj = JSON.parse(msg.toString())
              if (!obj) return
              if (obj.type === 'input' && typeof obj.data === 'string') {
                sh.write(obj.data)
              } else if (obj.type === 'resize' && obj.cols && obj.rows) {
                sh.setWindow(obj.rows, obj.cols, 0, 0)
              } else if (obj.type === 'ping') {
                send({ type: 'pong' })
              }
            } catch {}
          })

          ws.on('close', closeAll)
          ws.on('error', closeAll)
        })
      })

      conn.on('error', function (err) {
        const detail = err?.message || 'unknown'
        let message = 'connect_error'
        if (/auth/i.test(detail)) message = 'auth_error'
        else if (/ECONNREFUSED/.test(detail)) message = 'refused'
        else if (/ETIMEDOUT|timeout/i.test(detail)) message = 'timeout'
        send({ type: 'error', message, detail })
        closeAll()
      })

      send({ type: 'status', data: 'connecting' })
      conn.connect(connOpts)

    } catch (e) {
      send({ type: 'error', message: 'internal_error', detail: e?.message })
      try { ws.close(1011) } catch {}
    }
  })
}

module.exports = { attachSshServer }
