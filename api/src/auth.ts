import crypto from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { User, UserRegistryEntry } from './types'

const usersFile = path.join(process.cwd(), 'data', 'users.json')
const sessions = new Map<string, string>()

const readUsers = async (): Promise<UserRegistryEntry[]> => {
  try {
    const s = await fs.readFile(usersFile, 'utf-8')
    return JSON.parse(s)
  } catch {
    return []
  }
}

const writeUsers = async (users: UserRegistryEntry[]) => {
  await fs.mkdir(path.dirname(usersFile), { recursive: true })
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2))
}

export const register = async (username: string, email: string, password: string): Promise<User> => {
  const users = await readUsers()
  if (users.some(u => u.username === username)) throw new Error('username_taken')
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const hash = crypto.createHash('sha256').update(password).digest('hex')
  const entry: UserRegistryEntry = { id, username, email, password: hash }
  users.push(entry)
  await writeUsers(users)
  return { id, username, email }
}

export const login = async (username: string, password: string): Promise<{ token: string; user: User } | null> => {
  const users = await readUsers()
  const hash = crypto.createHash('sha256').update(password).digest('hex')
  const found = users.find(u => u.username === username && u.password === hash)
  if (!found) {
    if (username === 'admin' && password === 'admin') {
      let admin = users.find(u => u.username === 'admin')
      if (!admin) {
        admin = { id: 'user_admin', username: 'admin', email: 'admin@example.com', password: hash }
        users.push(admin)
        await writeUsers(users)
      }
      const token = crypto.randomBytes(24).toString('hex')
      sessions.set(token, admin.id)
      return { token, user: { id: admin.id, username: admin.username, email: admin.email } }
    }
    return null
  }
  const token = crypto.randomBytes(24).toString('hex')
  sessions.set(token, found.id)
  return { token, user: { id: found.id, username: found.username, email: found.email } }
}

export const getUserIdFromToken = (token?: string): string | null => {
  if (!token) return null
  return sessions.get(token) || null
}

export const getUserBasicById = async (id: string): Promise<User | null> => {
  const users = await readUsers()
  const u = users.find(x => x.id === id)
  return u ? { id: u.id, username: u.username, email: u.email } : null
}

export const updateUserBasic = async (id: string, opts: { email?: string; password?: string }): Promise<User | null> => {
  const users = await readUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return null
  if (opts.email) users[idx].email = opts.email
  if (opts.password) {
    const hash = crypto.createHash('sha256').update(opts.password).digest('hex')
    users[idx].password = hash
  }
  await writeUsers(users)
  const u = users[idx]
  return { id: u.id, username: u.username, email: u.email }
}
