import { promises as fs } from 'fs'
import path from 'path'
import { UserData, SystemSettings } from './types'

const dataDir = path.join(process.cwd(), 'data')

const defaultSettings: SystemSettings = {
  dnsApiProvider: 'cloudflare',
  dnsFailover: true,
  notifications: {
    bark: { enabled: false, serverUrl: 'https://api.day.app', key: '' },
    smtp: { enabled: false, host: 'smtp.gmail.com', port: 587, username: '', password: '', fromEmail: '' }
  }
}

const ensureDir = async () => {
  try {
    await fs.mkdir(dataDir, { recursive: true })
  } catch {}
}

export const loadUserData = async (userId: string): Promise<UserData> => {
  await ensureDir()
  const file = path.join(dataDir, `${userId}.json`)
  try {
    const content = await fs.readFile(file, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { providers: [], servers: [], domains: [], settings: defaultSettings }
  }
}

export const saveUserData = async (userId: string, data: UserData) => {
  await ensureDir()
  const file = path.join(dataDir, `${userId}.json`)
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}
