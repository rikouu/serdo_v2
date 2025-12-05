/**
 * API 客户端兼容层
 * 
 * 此文件为向后兼容而保留，实际实现已移至 api.ts
 * 新代码请直接使用 api.ts
 */

// 重新导出所有函数，使用旧的命名约定
export {
  login as loginUserApi,
  logout as logoutUserApi,
  register as registerUserApi,
  getMe as getMeApi,
  updateMe as updateMeApi,
  verifyPassword as verifyPasswordApi,
  getServers as getServersApi,
  upsertServer as upsertServerApi,
  deleteServer as deleteServerApi,
  pingServer as pingServerApi,
  checkServers as checkServersApi,
  getDomains as getDomainsApi,
  upsertDomain as upsertDomainApi,
  deleteDomain as deleteDomainApi,
  syncDomainDns as syncDomainDnsApi,
  checkDomains as checkDomainsApi,
  getProviders as getProvidersApi,
  upsertProvider as upsertProviderApi,
  deleteProvider as deleteProviderApi,
  getSettings as getSettingsApi,
  updateSettings as updateSettingsApi,
  testWhoisApi,
  revealServerSecrets as revealServerSecretsApi,
  revealProviderPassword as revealProviderPasswordApi,
  revealWhoisApiKey as revealWhoisApiKeyApi,
  revealBarkKey as revealBarkKeyApi,
  revealSmtpPassword as revealSmtpPasswordApi,
  getAdminSettings as getAdminSettingsApi,
  updateAdminSettings as updateAdminSettingsApi,
  generateInvites as generateInvitesApi,
  listInvites as listInvitesApi,
  updateInvite as updateInviteApi,
  deleteInvite as deleteInviteApi,
  listUsers as listUsersApi,
  updateUserExpiry as updateUserExpiryApi,
  deleteUser as deleteUserApiAdmin,
  exportUserData as exportUserDataApi,
  importUserData as importUserDataApi,
  getCheckLogs as getCheckLogsApi,
  getCheckStatus as getCheckStatusApi,
} from './api'

// 保留旧的命名导出以兼容现有代码
export * from './api'


