export type ServerStatus = 'running' | 'stopped' | 'expired' | 'maintenance'

export interface Provider {
  id: string
  name: string
  loginUrl: string
  username: string
  password?: string
  categories: ('server' | 'domain')[]
  paymentMethod: 'CreditCard' | 'PayPal' | 'Alipay' | 'WeChat' | 'Other'
  paymentAccount: string
}

export interface Server {
  id: string
  name: string
  ip: string
  providerId?: string
  region: string
  os: string
  status: ServerStatus
  expirationDate: string
  cpu: string
  ram: string
  disk: string
  panelUrl?: string
  username?: string
  password?: string
  notes?: string
  sshPort?: string
  sshUsername?: string
  sshPassword?: string
}

export interface DNSRecord {
  id: string
  type: 'A' | 'CNAME' | 'MX' | 'TXT' | 'NS'
  name: string
  value: string
  ttl: number
  linkedServerId?: string
}

export interface Domain {
  id: string
  name: string
  registrarProviderId?: string
  dnsProviderId?: string
  expirationDate: string
  autoRenew: boolean
  records: DNSRecord[]
}

export interface User {
  id: string
  username: string
  email: string
}

export interface SystemSettings {
  dnsApiProvider: 'cloudflare' | 'google' | 'quad9'
  dnsFailover: boolean
  notifications: {
    bark: { enabled: boolean; serverUrl: string; key: string }
    smtp: { enabled: boolean; host: string; port: number; username: string; password: string; fromEmail: string }
  }
}

export interface UserRegistryEntry extends User { password: string }

export interface UserData {
  providers: Provider[]
  servers: Server[]
  domains: Domain[]
  settings: SystemSettings
}
