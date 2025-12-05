
export type ServerStatus = 'running' | 'stopped' | 'expired' | 'maintenance';

export interface Provider {
  id: string;
  name: string;
  loginUrl: string;
  username: string;
  password: string;
  categories: ('server' | 'domain')[];
  paymentMethod: 'CreditCard' | 'PayPal' | 'Alipay' | 'WeChat' | 'Other';
  paymentAccount: string; // e.g., Last 4 digits or email
  sortOrder?: number; // 用于自定义排序
  createdAt?: number; // 创建时间戳
}

export interface Server {
  id: string;
  name: string;
  ip: string;
  provider: string; // Display name
  providerId?: string; // Link to Provider entity
  region: string;
  os: string;
  status: ServerStatus;
  expirationDate: string; // ISO Date string
  cpu: string;
  ram: string;
  disk: string;
  
  // Panel Info
  panelUrl?: string;
  username?: string;
  password?: string;
  notes?: string;

  // Provider Info
  providerUrl?: string;
  providerUsername?: string;
  providerPassword?: string;
  providerNotes?: string;

  // SSH Info
  sshPort?: string;
  sshUsername?: string;
  sshPassword?: string;
  sortOrder?: number; // 用于自定义排序
  createdAt?: number; // 创建时间戳

  // REDACT_MODE flags
  hasPassword?: boolean;
  hasSshPassword?: boolean;
  hasProviderPassword?: boolean;
}

export interface DNSRecord {
  id: string;
  type: 'A' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  name: string;
  value: string;
  ttl: number;
  linkedServerId?: string;
}

export interface Domain {
  id: string;
  name: string;
  registrar: string; // Display Name
  registrarProviderId?: string; // Link to Provider entity
  dnsProvider: string; // Display Name
  dnsProviderId?: string; // Link to Provider entity
  expirationDate: string;
  autoRenew: boolean;
  records: DNSRecord[];
  status?: string[];
  state?: 'normal' | 'expiring_soon' | 'expired' | 'pending_delete' | 'redemption' | 'suspended' | 'no_dns' | 'unknown';
  nameServers?: string[];
  daysRemaining?: number;
  lastSyncAt?: number;
  lastSyncError?: string | null;
  // 禁用自动覆盖：勾选后同步时不覆盖 registrar、dnsProvider、expirationDate 等字段
  disableAutoOverwrite?: boolean;
  sortOrder?: number; // 用于自定义排序
  createdAt?: number; // 创建时间戳
}

export interface User {
  id: string;
  username: string;
  email: string;
  role?: 'admin' | 'user'; // 添加role字段支持超级管理员功能
}

export interface UserRegistryEntry extends User {
  password: string; // Stored in plain text for this demo (In real app, hash this!)
}

export interface UserProfile {
  username: string;
  email: string;
  password?: string;
}

export interface SystemSettings {
  dnsApiProvider: 'cloudflare' | 'google' | 'quad9';
  dnsFailover: boolean;
  actionButtonsLayout?: 'fixed' | 'floating';
  // 列表视图模式: card=卡片式, table=列表式
  listViewMode?: 'card' | 'table';
  whoisApiProvider?: 'whoisproxy' | 'rapidapi_getData';
  whoisApiBaseUrl?: string;
  whoisApiKey?: string;
  whoisApiMethod?: 'GET' | 'POST';
  whoisApiHeaders?: Record<string, string>;
  whoisApiBody?: string;
  whoisResponseRecordsPath?: string;
  whoisResponseExpirationPaths?: string[];
  whoisResponseStatusPaths?: string[];
  serverAutoCheckEnabled?: boolean;
  serverAutoCheckIntervalHours?: number;
  domainAutoCheckEnabled?: boolean;
  domainAutoCheckFrequency?: 'daily' | 'weekly' | 'monthly';
  serverAutoCheckLastAt?: number;
  domainAutoCheckLastAt?: number;
  notifications: {
    bark: {
      enabled: boolean;
      serverUrl: string;
      key: string;
    };
    smtp: {
      enabled: boolean;
      host: string;
      port: number;
      secure?: boolean;
      requireTLS?: boolean;
      username: string;
      password: string;
      fromEmail: string;
      lastTest?: {
        ok: boolean;
        at: number;
        to?: string;
        subject?: string;
        messageId?: string;
        error?: string;
        meta?: {
          code?: string;
          command?: string;
          response?: string;
          responseCode?: number;
        };
        attempts?: Array<{ port: number; reachable?: boolean; error?: string; meta?: any }>;
      };
    };
    preferences?: {
      notifyServerDown: boolean;
      notifyDomainExpiring: boolean;
    };
  };
}

// 添加 superAdmin 到 ViewState 类型
export type ViewState = 'dashboard' | 'servers' | 'domains' | 'providers' | 'profile' | 'settings' | 'superAdmin';

export type Language = 'en' | 'zh';
