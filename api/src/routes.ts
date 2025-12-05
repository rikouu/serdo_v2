import { Router } from 'express'
import { z } from 'zod'
import { getUserIdFromToken, login, register, getUserBasicById, updateUserBasic } from './auth'
import { loadUserData, saveUserData } from './store'
import { Provider, Server, Domain, DNSRecord, SystemSettings } from './types'

const authHeader = (h?: string) => h?.startsWith('Bearer ') ? h.slice(7) : undefined

export const createRouter = () => {
  const r = Router()

  r.post('/auth/register', async (req, res) => {
    const schema = z.object({ username: z.string().min(3), email: z.string().email(), password: z.string().min(4) })
    const parse = schema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'invalid', message: 'Invalid input', details: parse.error.issues })
    try {
      const user = await register(parse.data.username, parse.data.email, parse.data.password)
      res.json({ user })
    } catch (e: any) {
      res.status(409).json({ code: e.message || 'error', message: 'Register failed' })
    }
  })

  r.post('/auth/login', async (req, res) => {
    const schema = z.object({ username: z.string(), password: z.string() })
    const parse = schema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'invalid', message: 'Invalid input' })
    const result = await login(parse.data.username, parse.data.password)
    if (!result) return res.status(401).json({ code: 'unauthorized', message: 'Invalid credentials' })
    res.json(result)
  })

  r.get('/me', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    const user = await getUserBasicById(userId)
    res.json({ userId, user, data })
  })

  r.patch('/me', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const schema = z.object({ email: z.string().email().optional(), password: z.string().min(4).optional() })
    const parse = schema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'invalid', message: 'Invalid input' })
    const user = await updateUserBasic(userId, { email: parse.data.email, password: parse.data.password })
    res.json({ user })
  })

  r.get('/providers', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    res.json(data.providers)
  })

  r.post('/providers', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const schema = z.object({ id: z.string(), name: z.string(), loginUrl: z.string(), username: z.string(), password: z.string().optional(), categories: z.array(z.enum(['server','domain'])), paymentMethod: z.enum(['CreditCard','PayPal','Alipay','WeChat','Other']), paymentAccount: z.string() })
    const parse = schema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'invalid' })
    const data = await loadUserData(userId)
    const next = { ...data, providers: [...data.providers.filter(p => p.id !== parse.data.id), parse.data as Provider] }
    await saveUserData(userId, next)
    res.json(parse.data)
  })

  r.delete('/providers/:id', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    const next = { ...data, providers: data.providers.filter(p => p.id !== req.params.id) }
    await saveUserData(userId, next)
    res.json({ ok: true })
  })

  r.get('/servers', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    res.json(data.servers)
  })

  r.post('/servers', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const schema = z.object({ id: z.string(), name: z.string(), ip: z.string(), region: z.string(), os: z.string(), status: z.enum(['running','stopped','expired','maintenance']), expirationDate: z.string(), cpu: z.string(), ram: z.string(), disk: z.string(), panelUrl: z.string().optional(), username: z.string().optional(), password: z.string().optional(), notes: z.string().optional(), sshPort: z.string().optional(), sshUsername: z.string().optional(), sshPassword: z.string().optional(), providerId: z.string().optional() })
    const parse = schema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'invalid' })
    const data = await loadUserData(userId)
    const next = { ...data, servers: [...data.servers.filter(s => s.id !== parse.data.id), parse.data as Server] }
    await saveUserData(userId, next)
    res.json(parse.data)
  })

  r.delete('/servers/:id', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    const next = { ...data, servers: data.servers.filter(s => s.id !== req.params.id) }
    await saveUserData(userId, next)
    res.json({ ok: true })
  })

  r.get('/domains', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    res.json(data.domains)
  })

  r.post('/domains', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const schema = z.object({ id: z.string(), name: z.string(), expirationDate: z.string(), autoRenew: z.boolean(), registrarProviderId: z.string().optional(), dnsProviderId: z.string().optional(), records: z.array(z.object({ id: z.string(), type: z.enum(['A','CNAME','MX','TXT','NS']), name: z.string(), value: z.string(), ttl: z.number(), linkedServerId: z.string().optional() })) })
    const parse = schema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'invalid' })
    const data = await loadUserData(userId)
    const next = { ...data, domains: [...data.domains.filter(d => d.id !== parse.data.id), parse.data as Domain] }
    await saveUserData(userId, next)
    res.json(parse.data)
  })

  r.delete('/domains/:id', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    const next = { ...data, domains: data.domains.filter(d => d.id !== req.params.id) }
    await saveUserData(userId, next)
    res.json({ ok: true })
  })

  r.get('/settings', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    res.json(data.settings)
  })

  r.put('/settings', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const schema = z.object({ dnsApiProvider: z.enum(['cloudflare','google','quad9']), dnsFailover: z.boolean(), notifications: z.object({ bark: z.object({ enabled: z.boolean(), serverUrl: z.string(), key: z.string() }), smtp: z.object({ enabled: z.boolean(), host: z.string(), port: z.number(), username: z.string(), password: z.string(), fromEmail: z.string() }) }) })
    const parse = schema.safeParse(req.body)
    if (!parse.success) return res.status(400).json({ code: 'invalid' })
    const data = await loadUserData(userId)
    const next = { ...data, settings: parse.data as SystemSettings }
    await saveUserData(userId, next)
    res.json(next.settings)
  })

  r.post('/audit/run', async (req, res) => {
    const token = authHeader(req.header('authorization'))
    const userId = getUserIdFromToken(token)
    if (!userId) return res.status(401).json({ code: 'unauthorized' })
    const data = await loadUserData(userId)
    const md = `# Audit Report\n\nServers: ${data.servers.length}\nDomains: ${data.domains.length}`
    res.json({ report: md })
  })

  return r
}
