/**
 * Serdo - 服务器与域名管理平台
 * 
 * 主应用组件
 */

import React, { useState, useEffect, useCallback } from 'react'
import { 
  LayoutDashboard, 
  Server as ServerIcon, 
  Globe, 
  LogOut, 
  Menu, 
  X, 
  Briefcase, 
  User, 
  Settings as SettingsIcon, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react'
import { ViewState, Server, Domain, Provider, Language, User as IUser, SystemSettings } from './types'
import { 
  getMe, 
  getServers, 
  getDomains, 
  getProviders, 
  getSettings,
  upsertServer,
  upsertDomain,
  upsertProvider,
  deleteServer,
  deleteDomain,
  deleteProvider,
  logout,
  getAdminSettings,
} from './services/api'
import { getAuthState, getCachedUser, handleLogout } from './services/authService'
import { Dashboard } from './components/Dashboard'
import { ServerList } from './components/ServerList'
import { DomainList } from './components/DomainList'
import { ProviderList } from './components/ProviderList'
import { UserProfile } from './components/UserProfile'
import { SystemSettings as SystemSettingsComponent } from './components/SystemSettings'
import { SuperAdmin } from './components/SuperAdmin'
import { NotifyHost } from './components/NotifyHost'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { WebSSH } from './components/WebSSH'
import { translations } from './utils/translations'
import { EmptyState } from './components/EmptyState'
import config from './config'

const App: React.FC = () => {
  // 用户状态
  const [currentUser, setCurrentUser] = useState<IUser | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  
  // 视图状态
  const getViewFromHash = (): ViewState => {
    const hash = window.location.hash.slice(1)
    const validViews: ViewState[] = ['dashboard', 'servers', 'domains', 'providers', 'profile', 'settings', 'superAdmin']
    return validViews.includes(hash as ViewState) ? (hash as ViewState) : 'dashboard'
  }
  const [currentView, setCurrentViewState] = useState<ViewState>(getViewFromHash)
  
  const setCurrentView = (view: ViewState) => {
    setCurrentViewState(view)
    window.location.hash = view
  }
  
  // UI 状态
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [language, setLanguage] = useState<Language>('zh')
  const [isBottomMenuExpanded, setIsBottomMenuExpanded] = useState(false)
  const [appDisplayName, setAppDisplayName] = useState<string>(config.appName)
  
  // 数据状态
  const [servers, setServers] = useState<Server[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [autoCreateTarget, setAutoCreateTarget] = useState<'servers' | 'domains' | 'providers' | null>(null)

  // WebSSH 状态
  const [activeSshServer, setActiveSshServer] = useState<Server | null>(null)
  const [isSshMinimized, setIsSshMinimized] = useState(false)
  const [highlightServerId, setHighlightServerId] = useState<string | null>(null)
  const [highlightDomainId, setHighlightDomainId] = useState<string | null>(null)

  const t = translations[language]

  // 加载数据
  const loadData = useCallback(async () => {
    if (!currentUser) return
    
    setIsDataLoading(true)
    setLoadError(null)
    
    try {
      const [sv, dm, pr, st] = await Promise.all([
        getServers(),
        getDomains(),
        getProviders(),
        getSettings().catch(() => null)
      ])
      setServers(sv)
      setDomains(dm)
      setProviders(pr)
      if (st) setSettings(st)
    } catch (e: unknown) {
      const error = e as Error
      setLoadError(error.message || '加载数据失败')
    } finally {
      setIsDataLoading(false)
    }
  }, [currentUser])

  // 用户登录后加载数据
  useEffect(() => {
    if (currentUser) {
      loadData()
    } else {
      setServers([])
      setDomains([])
      setProviders([])
      setSettings(null)
    }
  }, [currentUser, loadData])

  // 恢复会话
  useEffect(() => {
    const restoreSession = async () => {
      const authState = getAuthState()
      
      // 如果有缓存的用户信息，先显示
      if (authState.user) {
        setCurrentUser(authState.user)
      }
      
      // 如果有 token，验证会话
      if (authState.token) {
        try {
          const me = await getMe()
          if (me?.user) {
            setCurrentUser(me.user)
            // 只有管理员才尝试获取应用名称设置
            if (me.user.role === 'admin') {
              try {
                const adminSettings = await getAdminSettings()
                if (adminSettings?.appName) {
                  setAppDisplayName(adminSettings.appName)
                }
              } catch {
                // 获取失败忽略
              }
            }
          }
        } catch {
          // 会话无效，清理
          handleLogout()
          setCurrentUser(null)
        }
      }
      
      setIsAuthChecking(false)
    }
    
    restoreSession()
  }, [])

  // 更新标题
  useEffect(() => {
    document.title = appDisplayName || t.appName
  }, [appDisplayName, t.appName])

  // 监听 URL hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      const validViews: ViewState[] = ['dashboard', 'servers', 'domains', 'providers', 'profile', 'settings', 'superAdmin']
      if (validViews.includes(hash as ViewState)) {
        setCurrentViewState(hash as ViewState)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // 服务器更新处理
  const handleServerUpdate = async (newServers: Server[]) => {
    if (!currentUser) return
    
    const prev = servers
    setServers(newServers)
    
    try {
      const prevIds = new Set(prev.map(s => s.id))
      const newIds = new Set(newServers.map(s => s.id))
      const removed = [...prevIds].filter(id => !newIds.has(id))
      
      await Promise.all([
        ...newServers.map(s => upsertServer(s)),
        ...removed.map(id => deleteServer(id))
      ])
    } catch (e: unknown) {
      setServers(prev)
      const error = e as Error
      setLoadError(error.message || '保存失败')
    }
  }

  // 域名更新处理
  const handleDomainUpdate = async (newDomains: Domain[]) => {
    if (!currentUser) return
    
    const prev = domains
    setDomains(newDomains)
    
    try {
      const prevIds = new Set(prev.map(d => d.id))
      const newIds = new Set(newDomains.map(d => d.id))
      const removed = [...prevIds].filter(id => !newIds.has(id))
      
      await Promise.all([
        ...newDomains.map(d => upsertDomain(d)),
        ...removed.map(id => deleteDomain(id))
      ])
    } catch (e: unknown) {
      setDomains(prev)
      const error = e as Error
      setLoadError(error.message || '保存失败')
    }
  }

  // 服务商更新处理
  const handleProviderUpdate = async (newProviders: Provider[]) => {
    if (!currentUser) return
    
    const prev = providers
    setProviders(newProviders)
    
    try {
      const prevIds = new Set(prev.map(p => p.id))
      const newIds = new Set(newProviders.map(p => p.id))
      const removed = [...prevIds].filter(id => !newIds.has(id))
      
      await Promise.all([
        ...newProviders.map(p => upsertProvider(p)),
        ...removed.map(id => deleteProvider(id))
      ])
    } catch (e: unknown) {
      setProviders(prev)
      const error = e as Error
      setLoadError(error.message || '保存失败')
    }
  }

  // 登出处理
  const handleUserLogout = () => {
    logout()
    setCurrentUser(null)
    setActiveSshServer(null)
    setCurrentView('dashboard')
    setIsBottomMenuExpanded(false)
  }

  // 导航项组件
  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: React.ComponentType<{ className?: string }>; label: string }) => (
    <button
      onClick={() => { setCurrentView(view); setIsMobileMenuOpen(false) }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        currentView === view 
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  )

  // 认证检查中
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mb-4" />
          <p className="text-slate-600 text-lg font-medium">{t.loading}</p>
        </div>
      </div>
    )
  }

  // 未登录
  if (!currentUser) {
    if (isRegistering) {
      return (
        <Register 
          lang={language}
          onRegisterSuccess={(user) => {
            setCurrentUser(user)
            setIsRegistering(false)
          }}
          onSwitchToLogin={() => setIsRegistering(false)}
        />
      )
    }
    return (
      <Login 
        lang={language} 
        setLang={setLanguage} 
        onLogin={(user) => setCurrentUser(user)} 
        onSwitchToRegister={() => setIsRegistering(true)}
      />
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      
      {/* 移动端侧边栏遮罩 */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* 侧边栏 */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 
        flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setCurrentView('dashboard')}
          >
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold">
              SD
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {appDisplayName}
            </span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="lg:hidden text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem view="dashboard" icon={LayoutDashboard} label={t.dashboard} />
          <NavItem view="servers" icon={ServerIcon} label={t.servers} />
          <NavItem view="domains" icon={Globe} label={t.domains} />
          <NavItem view="providers" icon={Briefcase} label={t.providers} />
        </nav>

        <div className="p-4 border-t border-slate-100">
          {/* 用户菜单展开按钮 */}
          <button
            onClick={() => setIsBottomMenuExpanded(!isBottomMenuExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 transition-all group mb-2"
          >
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
              <span className="font-medium text-slate-700 group-hover:text-slate-900">
                {currentUser.username}
              </span>
            </div>
            {isBottomMenuExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* 展开的菜单 */}
          <div className={`space-y-2 overflow-hidden transition-all duration-300 ease-in-out ${
            isBottomMenuExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}>
            {/* 语言切换 */}
            <div className="bg-slate-50 p-2 rounded-lg flex justify-between items-center">
              <span className="text-[10px] font-semibold text-slate-500 uppercase px-2">
                Language
              </span>
              <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                <button 
                  onClick={() => setLanguage('en')} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
                <button 
                  onClick={() => setLanguage('zh')} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    language === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  中文
                </button>
              </div>
            </div>

            <NavItem view="profile" icon={User} label={t.profile} />
            <NavItem view="settings" icon={SettingsIcon} label={t.settings} />
            
            {(currentUser.role === 'admin' || currentUser.username === 'admin') && (
              <NavItem view="superAdmin" icon={SettingsIcon} label={t.superAdmin || 'Super Admin'} />
            )}

            <button 
              onClick={handleUserLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t.logout}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* 移动端头部 */}
        <header className="bg-white border-b border-slate-200 p-4 lg:hidden flex justify-between items-center">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => setCurrentView('dashboard')}
          >
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              SD
            </div>
            <span className="font-bold text-slate-900">{appDisplayName}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* 可滚动内容区 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24">
          <div className="max-w-7xl mx-auto">
            
            {/* 加载状态 */}
            {isDataLoading && (
              <div className="w-full min-h-[50vh] flex items-center justify-center">
                <div className="bg-white rounded-2xl p-6 shadow border border-slate-200 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                  </div>
                  <div className="text-slate-600 text-sm">{t.loading}</div>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {!isDataLoading && loadError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                {loadError}
              </div>
            )}

            {/* 空状态 */}
            {!isDataLoading && !loadError && currentView === 'dashboard' && 
              servers.length === 0 && domains.length === 0 && providers.length === 0 && (
              <EmptyState 
                lang={language}
                onAddServer={() => { setCurrentView('servers'); setAutoCreateTarget('servers') }}
                onAddDomain={() => { setCurrentView('domains'); setAutoCreateTarget('domains') }}
                onAddProvider={() => { setCurrentView('providers'); setAutoCreateTarget('providers') }}
              />
            )}

            {/* Dashboard */}
            {!isDataLoading && !loadError && currentView === 'dashboard' && 
              (servers.length !== 0 || domains.length !== 0 || providers.length !== 0) && (
              <Dashboard 
                servers={servers} 
                domains={domains} 
                lang={language} 
                onNavigate={setCurrentView} 
                userId={currentUser.id} 
              />
            )}

            {/* 服务器列表 */}
            {currentView === 'servers' && (
              <ServerList 
                settings={settings} 
                servers={servers} 
                domains={domains} 
                providers={providers} 
                onUpdate={handleServerUpdate} 
                lang={language} 
                onOpenTerminal={(s) => { setActiveSshServer(s); setIsSshMinimized(false) }}
                highlightServerId={highlightServerId || undefined}
                autoOpenCreate={autoCreateTarget === 'servers'}
                onAutoOpenHandled={() => setAutoCreateTarget(null)}
                onNavigate={setCurrentView}
                onFocusDomain={(id) => { setHighlightDomainId(id); setTimeout(() => setHighlightDomainId(null), 5000) }}
              />
            )}
            
            {/* 域名列表 */}
            {currentView === 'domains' && (
              <DomainList 
                settings={settings} 
                domains={domains} 
                servers={servers} 
                providers={providers} 
                onUpdate={handleDomainUpdate} 
                lang={language} 
                onNavigate={setCurrentView} 
                onFocusServer={(id) => { setHighlightServerId(id); setTimeout(() => setHighlightServerId(null), 5000) }} 
                autoOpenCreate={autoCreateTarget === 'domains'} 
                onAutoOpenHandled={() => setAutoCreateTarget(null)}
                highlightDomainId={highlightDomainId || undefined}
              />
            )}
            
            {/* 服务商列表 */}
            {currentView === 'providers' && (
              <ProviderList 
                settings={settings} 
                providers={providers} 
                onUpdate={handleProviderUpdate} 
                lang={language} 
                autoOpenCreate={autoCreateTarget === 'providers'} 
                onAutoOpenHandled={() => setAutoCreateTarget(null)} 
              />
            )}
            
            {/* 用户资料 */}
            {currentView === 'profile' && (
              <UserProfile userId={currentUser.id} lang={language} />
            )}
            
            {/* 系统设置 */}
            {currentView === 'settings' && (
              <SystemSettingsComponent 
                userId={currentUser.id} 
                lang={language} 
                onSettingsChange={(s) => setSettings(s)} 
              />
            )}
            
            {/* 超级管理员 */}
            {(currentUser.role === 'admin' || currentUser.username === 'admin') && 
              currentView === 'superAdmin' && (
              <SuperAdmin lang={language} />
            )}
          </div>
        </div>

        {/* WebSSH 终端 */}
        {activeSshServer && (
          <WebSSH 
            server={activeSshServer} 
            onClose={() => setActiveSshServer(null)} 
            isMinimized={isSshMinimized}
            onToggleMinimize={() => setIsSshMinimized(!isSshMinimized)}
            lang={language}
          />
        )}
        
        <NotifyHost />
      </main>
    </div>
  )
}

export default App
