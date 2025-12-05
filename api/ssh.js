const { Server: WSServer } = require('ws')
const { Client } = require('ssh2')
const { getUserIdFromToken } = require('./auth')
const { loadUserData } = require('./storage')

function attachSshServer(server) {
  const wss = new WSServer({ server, path: '/api/v1/ssh' })
  wss.on('connection', function (ws, req) {
    try {
      const u = new URL(req.url, 'http://localhost')
      const token = u.searchParams.get('token') || ''
      const sid = u.searchParams.get('serverId') || ''
      const userId = getUserIdFromToken(token)
      if (!userId || !sid) return ws.close(1008)
      const data = loadUserData(userId)
      const s = (data.servers || []).find(x => x.id === sid)
      if (!s) return ws.close(1008)

      const conn = new Client()
      conn.on('ready', function () {
        ws.send(JSON.stringify({ type: 'status', data: 'ready' }))
        conn.shell({ term: 'xterm-256color' }, function (err, stream) {
          if (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'shell_error' }))
            try { conn.end() } catch {}
            return ws.close(1011)
          }
          stream.on('data', function (chunk) {
            try { ws.send(JSON.stringify({ type: 'output', data: chunk.toString('utf8') })) } catch {}
          })
          stream.on('close', function () {
            try { conn.end() } catch {}
            try { ws.close(1000) } catch {}
          })
          ws.on('message', function (msg) {
            try {
              const obj = JSON.parse(msg.toString())
              if (obj && obj.type === 'input' && typeof obj.data === 'string') stream.write(obj.data)
              if (obj && obj.type === 'resize' && obj.cols && obj.rows && stream.setWindow) stream.setWindow(obj.rows, obj.cols, 0, 0)
            } catch {}
          })
          ws.on('close', function () {
            try { stream.end() } catch {}
            try { conn.end() } catch {}
          })
        })
      })
      conn.on('error', function () {
        try { ws.send(JSON.stringify({ type: 'error', message: 'connect_error' })) } catch {}
        try { ws.close(1011) } catch {}
      })
      const allowPwd = String(process.env.API_SSH_ALLOW_PASSWORD || 'false') === 'true'
      if (!allowPwd && s.sshPassword) {
        try { ws.send(JSON.stringify({ type: 'error', message: 'password_disabled' })) } catch {}
        return ws.close(1011)
      }
      conn.connect({ host: s.ip, port: Number(s.sshPort || 22), username: s.sshUsername || 'root', password: s.sshPassword || '' })
    } catch {
      try { ws.close(1011) } catch {}
    }
  })
}

module.exports = { attachSshServer }
