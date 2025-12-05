
import { Server, Domain, Provider, UserProfile, SystemSettings, UserRegistryEntry, User } from '../types';

const USERS_KEY = 'infravault_users';

// Helpers to get user-specific keys
const getKey = (userId: string, key: string) => `infravault_${userId}_${key}`;

// Mock Data Generators
const getMockServers = (): Server[] => [
  {
    id: 'srv-1',
    name: 'Prod-App-01',
    ip: '192.168.1.10',
    provider: 'AWS',
    region: 'us-east-1',
    os: 'Ubuntu 22.04',
    status: 'running',
    expirationDate: '2025-12-01',
    cpu: '2 vCPU',
    ram: '4GB',
    disk: '80GB SSD',
    sshPort: '22',
    sshUsername: 'ubuntu',
    sshPassword: 'key_auth_preferred',
    username: 'ubuntu',
    password: 'password123',
    notes: 'Main application server. Nginx + Node.js.',
    providerUrl: 'https://aws.amazon.com/console/',
    providerUsername: 'admin-user',
    providerPassword: 'awsRootPassword!',
    providerNotes: 'Root account MFA enabled.'
  }
];

const getMockDomains = (): Domain[] => [
  {
    id: 'dom-1',
    name: 'demo-app.com',
    registrar: 'Namecheap',
    dnsProvider: 'Cloudflare',
    expirationDate: '2025-01-15',
    autoRenew: true,
    records: [
      { id: 'rec-1', type: 'A', name: '@', value: '192.168.1.10', ttl: 300, linkedServerId: 'srv-1' }
    ]
  }
];

const getMockProviders = (): Provider[] => [
  {
    id: 'prov-1',
    name: 'AWS',
    loginUrl: 'https://console.aws.amazon.com',
    username: 'admin',
    password: 'password',
    categories: ['server'],
    paymentMethod: 'CreditCard',
    paymentAccount: '**** 1234'
  }
];

const getDefaultSettings = (): SystemSettings => ({
  dnsApiProvider: 'cloudflare',
  dnsFailover: true,
  serverAutoCheckEnabled: false,
  serverAutoCheckIntervalHours: 6,
  domainAutoCheckEnabled: false,
  domainAutoCheckFrequency: 'daily',
  notifications: {
    bark: { enabled: false, serverUrl: 'https://api.day.app', key: '' },
    smtp: { enabled: false, host: 'smtp.gmail.com', port: 587, username: '', password: '', fromEmail: '' }
  }
});

// User Management
export const registerUser = (user: Omit<UserRegistryEntry, 'id'>): User => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: UserRegistryEntry[] = usersStr ? JSON.parse(usersStr) : [];

  if (users.some(u => u.username === user.username)) {
    throw new Error('Username already exists');
  }

  const newUser: UserRegistryEntry = {
    ...user,
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Initialize default data for new user
  localStorage.setItem(getKey(newUser.id, 'servers'), JSON.stringify(getMockServers()));
  localStorage.setItem(getKey(newUser.id, 'domains'), JSON.stringify(getMockDomains()));
  localStorage.setItem(getKey(newUser.id, 'providers'), JSON.stringify(getMockProviders()));
  localStorage.setItem(getKey(newUser.id, 'settings'), JSON.stringify(getDefaultSettings()));
  
  const { password, ...safeUser } = newUser;
  return safeUser;
};

export const loginUser = (username: string, password: string): User | null => {
  // Hardcoded admin fallback for ease of use if not registered
  if (username === 'admin' && password === 'admin') {
     // Ensure admin exists in DB so data persists
     const usersStr = localStorage.getItem(USERS_KEY);
     const users: UserRegistryEntry[] = usersStr ? JSON.parse(usersStr) : [];
     let admin = users.find(u => u.username === 'admin');
     if (!admin) {
        admin = { id: 'user_admin', username: 'admin', email: 'admin@example.com', password: 'admin' };
        users.push(admin);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        // Seed initial data
        localStorage.setItem(getKey(admin.id, 'servers'), JSON.stringify(getMockServers()));
        localStorage.setItem(getKey(admin.id, 'domains'), JSON.stringify(getMockDomains()));
        localStorage.setItem(getKey(admin.id, 'providers'), JSON.stringify(getMockProviders()));
     }
     const { password: _, ...safeUser } = admin;
     return safeUser;
  }

  const usersStr = localStorage.getItem(USERS_KEY);
  if (!usersStr) return null;
  const users: UserRegistryEntry[] = JSON.parse(usersStr);
  
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return null;

  const { password: _, ...safeUser } = user;
  return safeUser;
};

export const validatePassword = (userId: string, password: string): boolean => {
    const usersStr = localStorage.getItem(USERS_KEY);
    if (!usersStr) return false;
    const users: UserRegistryEntry[] = JSON.parse(usersStr);
    const user = users.find(u => u.id === userId);
    return user ? user.password === password : false;
};

// Data Accessors (Scoped by User ID)

export const getServers = (userId: string): Server[] => {
  const stored = localStorage.getItem(getKey(userId, 'servers'));
  return stored ? JSON.parse(stored) : [];
};

export const saveServers = (userId: string, servers: Server[]) => {
  localStorage.setItem(getKey(userId, 'servers'), JSON.stringify(servers));
};

export const getDomains = (userId: string): Domain[] => {
  const stored = localStorage.getItem(getKey(userId, 'domains'));
  return stored ? JSON.parse(stored) : [];
};

export const saveDomains = (userId: string, domains: Domain[]) => {
  localStorage.setItem(getKey(userId, 'domains'), JSON.stringify(domains));
};

export const getProviders = (userId: string): Provider[] => {
  const stored = localStorage.getItem(getKey(userId, 'providers'));
  return stored ? JSON.parse(stored) : [];
};

export const saveProviders = (userId: string, providers: Provider[]) => {
  localStorage.setItem(getKey(userId, 'providers'), JSON.stringify(providers));
};

export const getUserProfile = (userId: string): UserProfile => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: UserRegistryEntry[] = usersStr ? JSON.parse(usersStr) : [];
  const user = users.find(u => u.id === userId);
  
  if (user) {
      return { username: user.username, email: user.email };
  }
  return { username: 'Unknown', email: '' };
};

export const saveUserProfile = (userId: string, profile: UserProfile) => {
  const usersStr = localStorage.getItem(USERS_KEY);
  let users: UserRegistryEntry[] = usersStr ? JSON.parse(usersStr) : [];
  
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex >= 0) {
      users[userIndex].email = profile.email;
      if (profile.password) {
          users[userIndex].password = profile.password;
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};

export const getSystemSettings = (userId: string): SystemSettings => {
  const stored = localStorage.getItem(getKey(userId, 'settings'));
  return stored ? JSON.parse(stored) : getDefaultSettings();
};

export const saveSystemSettings = (userId: string, settings: SystemSettings) => {
  localStorage.setItem(getKey(userId, 'settings'), JSON.stringify(settings));
};
