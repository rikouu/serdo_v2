
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Server as ServerIcon, Globe, LogOut, Menu, X, Briefcase, User, Settings as SettingsIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { ViewState, Server, Domain, Provider, Language, User as IUser, SystemSettings } from "./types";
import { getServers, saveServers, getDomains, saveDomains, getProviders, saveProviders } from './services/dataService';
import { getServersApi, getDomainsApi, getProvidersApi, upsertServerApi, upsertDomainApi, upsertProviderApi, logoutUserApi } from './services/apiClient';
import { getMeApi, getSettingsApi } from './services/apiClient';
import { Dashboard } from './components/Dashboard';
import { ServerList } from './components/ServerList';
import { DomainList } from './components/DomainList';
import { ProviderList } from './components/ProviderList';
import { UserProfile } from './components/UserProfile';
import { SystemSettings as SystemSettingsComponent } from './components/SystemSettings';
import { SuperAdmin } from './components/SuperAdmin';
import { NotifyHost } from './components/NotifyHost';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { WebSSH } from './components/WebSSH';
import { translations } from './utils/translations';
import { EmptyState } from './components/EmptyState';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true); // 添加认证检查状态
  
  // 从 URL hash 读取初始视图
  const getViewFromHash = (): ViewState => {
    const hash = window.location.hash.slice(1); // 移除 #
    const validViews: ViewState[] = ['dashboard', 'servers', 'domains', 'providers', 'profile', 'settings', 'superAdmin'];
    return validViews.includes(hash as ViewState) ? (hash as ViewState) : 'dashboard';
  };
  const [currentView, setCurrentViewState] = useState<ViewState>(getViewFromHash);
  
  // 包装 setCurrentView 以同步更新 hash
  const setCurrentView = (view: ViewState) => {
    setCurrentViewState(view);
    window.location.hash = view;
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [isBottomMenuExpanded, setIsBottomMenuExpanded] = useState(false);
  const [appDisplayName, setAppDisplayName] = useState<string | null>(null);
  
  // Data State
  const [servers, setServers] = useState<Server[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [isDataLoading, setIsDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoCreateTarget, setAutoCreateTarget] = useState<'servers' | 'domains' | 'providers' | null>(null);

  // WebSSH State
  const [activeSshServer, setActiveSshServer] = useState<Server | null>(null);
  const [isSshMinimized, setIsSshMinimized] = useState(false);
  const [highlightServerId, setHighlightServerId] = useState<string | null>(null);
  const [highlightDomainId, setHighlightDomainId] = useState<string | null>(null);

  // Load data when user logs in
  useEffect(() => {
    const load = async () => {
      if (currentUser) {
        // 不再强制设置 dashboard，保持 hash 中的视图
        setLoadError(null);
        const useApi = import.meta.env.VITE_USE_API === 'true';
        if (useApi) {
          setIsDataLoading(true);
          try {
            const [sv, dm, pr, st] = await Promise.all([
              getServersApi(),
              getDomainsApi(),
              getProvidersApi(),
              getSettingsApi().catch(() => null)
            ]);
            setServers(sv);
            setDomains(dm);
            setProviders(pr);
            if (st) setSettings(st);
          } catch (e: any) {
            setLoadError(String(e?.message || 'Load failed'));
          } finally {
            setIsDataLoading(false);
          }
        } else {
          // local mode
          setServers(getServers(currentUser.id));
          setDomains(getDomains(currentUser.id));
          setProviders(getProviders(currentUser.id));
        }
      } else {
        setServers([]);
        setDomains([]);
        setProviders([]);
      }
    };
    load();
  }, [currentUser]);

  // Restore session on refresh
  useEffect(() => {
    console.log('🔍 [Session] 开始会话恢复检查');
    const useApi = import.meta.env.VITE_USE_API === 'true';
    console.log('🔍 [Session] useApi =', useApi);
    
    // 诊断 localStorage 状态
    try {
      const allKeys = Object.keys(localStorage);
      console.log('🔍 [Session] localStorage 所有键:', allKeys);
      console.log('🔍 [Session] localStorage 可用:', typeof localStorage !== 'undefined');
    } catch (e) {
      console.error('❌ [Session] localStorage 访问错误:', e);
    }
    
    if (!useApi) {
      console.log('✅ [Session] 本地模式，跳过会话检查');
      setIsAuthChecking(false);
      return;
    }
    
    // 检查是否有保存的 token
    const savedToken = localStorage.getItem('infravault_token');
    console.log('🔍 [Session] savedToken =', savedToken ? `存在 (${savedToken.length}字符)` : '不存在');
    
    if (!savedToken) {
      console.log('❌ [Session] 无 token，显示登录页');
      setIsAuthChecking(false);
      return;
    }
    
    (async () => {
      try {
        console.log('⏳ [Session] 正在调用 getMeApi()...');
        const me = await getMeApi();
        console.log('📦 [Session] getMeApi() 返回:', me);
        
        if (me && me.user) {
          console.log('✅ [Session] 会话恢复成功，用户:', me.user.username);
          setCurrentUser(me.user);
          
          // 成功恢复会话后，尝试获取管理员设置
          try {
            const admin = await import('./services/apiClient').then(m => m.getAdminSettingsApi()).catch(()=>null)
            if (admin && typeof admin.appName === 'string') setAppDisplayName(admin.appName)
          } catch {}
        } else {
          console.warn('⚠️ [Session] API 返回成功但没有用户数据');
        }
      } catch (error: any) {
        console.error('❌ [Session] 会话恢复失败:', error?.message);
        console.error('❌ [Session] 错误详情:', error);
      }
      finally {
        console.log('🏁 [Session] 会话检查完成');
        setIsAuthChecking(false);
      }
    })();
  }, []);

  // Update browser title when appDisplayName changes
  useEffect(() => {
    document.title = appDisplayName || t.appName;
  }, [appDisplayName, language]);

  // 监听浏览器前进后退按钮
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const validViews: ViewState[] = ['dashboard', 'servers', 'domains', 'providers', 'profile', 'settings', 'superAdmin'];
      if (validViews.includes(hash as ViewState)) {
        setCurrentViewState(hash as ViewState);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const handleServerUpdate = async (newServers: Server[]) => {
    if (!currentUser) return;
    const prev = servers;
    setServers(newServers);
    const useApi = import.meta.env.VITE_USE_API === 'true';
    if (useApi) {
      try {
        const prevIds = new Set(prev.map(s => s.id));
        const newIds = new Set(newServers.map(s => s.id));
        const removed = [...prevIds].filter(id => !newIds.has(id));
        await Promise.all([
          ...newServers.map(s => upsertServerApi(s)),
          ...removed.map(id => import('./services/apiClient').then(m => m.deleteServerApi(id)))
        ]);
      } catch (e) {
        setServers(prev);
        setLoadError(String((e as any)?.message || 'Save failed'));
        return;
      }
    } else {
      saveServers(currentUser.id, newServers);
    }
  };

  const handleDomainUpdate = async (newDomains: Domain[]) => {
    if (!currentUser) return;
    const prev = domains;
    setDomains(newDomains);
    const useApi = import.meta.env.VITE_USE_API === 'true';
    if (useApi) {
      try {
        const prevIds = new Set(prev.map(d => d.id));
        const newIds = new Set(newDomains.map(d => d.id));
        const removed = [...prevIds].filter(id => !newIds.has(id));
        await Promise.all([
          ...newDomains.map(d => upsertDomainApi(d)),
          ...removed.map(id => import('./services/apiClient').then(m => m.deleteDomainApi(id)))
        ]);
      } catch (e) {
        setDomains(prev);
        setLoadError(String((e as any)?.message || 'Save failed'));
        return;
      }
    } else {
      saveDomains(currentUser.id, newDomains);
    }
  };

  const handleProviderUpdate = async (newProviders: Provider[]) => {
      if (!currentUser) return;
      const prev = providers;
      setProviders(newProviders);
      const useApi = import.meta.env.VITE_USE_API === 'true';
      if (useApi) {
        try {
          const prevIds = new Set(prev.map(p => p.id));
          const newIds = new Set(newProviders.map(p => p.id));
          const removed = [...prevIds].filter(id => !newIds.has(id));
          await Promise.all([
            ...newProviders.map(p => upsertProviderApi(p)),
            ...removed.map(id => import('./services/apiClient').then(m => m.deleteProviderApi(id)))
          ]);
        } catch (e) {
          setProviders(prev);
          setLoadError(String((e as any)?.message || 'Save failed'));
          return;
        }
      } else {
        saveProviders(currentUser.id, newProviders);
      }
  };

  const t = translations[language];

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => { setCurrentView(view); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        currentView === view 
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  // 认证检查中，显示加载界面，避免闪现登录页面
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
          <p className="text-slate-600 text-lg font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (isRegistering) {
        return (
            <Register 
                lang={language}
                onRegisterSuccess={(user) => {
                    setCurrentUser(user);
                    setIsRegistering(false);
                }}
                onSwitchToLogin={() => setIsRegistering(false)}
            />
        );
    }
    return (
        <Login 
            lang={language} 
            setLang={setLanguage} 
            onLogin={(user) => setCurrentUser(user)} 
            onSwitchToRegister={() => setIsRegistering(true)}
        />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div 
             className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
             onClick={() => setCurrentView('dashboard')}
          >
             <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold">SD</div>
             <span className="text-xl font-bold text-slate-900 tracking-tight">{appDisplayName || t.appName}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400">
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
          {/* 展开/收起按钮 */}
          <button
            onClick={() => setIsBottomMenuExpanded(!isBottomMenuExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 transition-all group mb-2"
          >
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
              <span className="font-medium text-slate-700 group-hover:text-slate-900">{currentUser?.username || 'User'}</span>
            </div>
            {isBottomMenuExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* 可展开的菜单内容 */}
          <div 
            className={`space-y-2 overflow-hidden transition-all duration-300 ease-in-out ${
              isBottomMenuExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="bg-slate-50 p-2 rounded-lg flex justify-between items-center">
              <span className="text-[10px] font-semibold text-slate-500 uppercase px-2">Language</span>
              <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                <button onClick={() => setLanguage('en')} className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>EN</button>
                <button onClick={() => setLanguage('zh')} className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${language === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>中文</button>
              </div>
            </div>

            <NavItem view="profile" icon={User} label={t.profile} />
            <NavItem view="settings" icon={SettingsIcon} label={t.settings} />
            {(currentUser?.role === 'admin' || currentUser?.username === 'admin') && (
              <NavItem view={"superAdmin" as any} icon={SettingsIcon} label={t.superAdmin || 'Super Admin'} />
            )}

            <button 
              onClick={() => { 
                logoutUserApi(); 
                setCurrentUser(null); 
                setActiveSshServer(null); 
                setCurrentView('dashboard');
                setIsBottomMenuExpanded(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t.logout}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Mobile Header */}
        <header className="bg-white border-b border-slate-200 p-4 lg:hidden flex justify-between items-center">
             <div className="flex items-center gap-3" onClick={() => setCurrentView('dashboard')}>
               <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm">SD</div>
               <span className="font-bold text-slate-900">{appDisplayName || t.appName}</span>
             </div>
             <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600">
               <Menu className="w-6 h-6" />
             </button>
        </header>

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24">
           <div className="max-w-7xl mx-auto">
             {/* Loading State */}
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

             {/* Error Banner (distinct from empty state) */}
             {!isDataLoading && loadError && (
               <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                 {t.loadFailed || 'Load failed'}
               </div>
             )}

             {/* Empty State on dashboard when all data are empty */}
             {!isDataLoading && !loadError && currentView === 'dashboard' && servers.length === 0 && domains.length === 0 && providers.length === 0 && (
               <EmptyState 
                 lang={language}
                 onAddServer={() => { setCurrentView('servers'); setAutoCreateTarget('servers'); }}
                 onAddDomain={() => { setCurrentView('domains'); setAutoCreateTarget('domains'); }}
                 onAddProvider={() => { setCurrentView('providers'); setAutoCreateTarget('providers'); }}
               />
             )}

             {!isDataLoading && !loadError && currentView === 'dashboard' && (servers.length !== 0 || domains.length !== 0 || providers.length !== 0) && (
               <Dashboard servers={servers} domains={domains} lang={language} onNavigate={setCurrentView} userId={currentUser.id} />
             )}

             {/* Dashboard content when data present */}
             {currentView === 'servers' && (
                 <ServerList settings={settings} servers={servers} 
                    domains={domains} 
                    providers={providers} 
                    onUpdate={handleServerUpdate} 
                    lang={language} 
                    onOpenTerminal={(s) => { setActiveSshServer(s); setIsSshMinimized(false); }}
                    highlightServerId={highlightServerId || undefined}
                    autoOpenCreate={autoCreateTarget === 'servers'}
                    onAutoOpenHandled={() => setAutoCreateTarget(null)}
                    onNavigate={setCurrentView}
                    onFocusDomain={(id) => { setHighlightDomainId(id); setTimeout(() => setHighlightDomainId(null), 5000); }}
                 />
             )}
             {currentView === 'domains' && (
               <DomainList settings={settings} domains={domains} 
                 servers={servers} 
                 providers={providers} 
                 onUpdate={handleDomainUpdate} 
                 lang={language} 
                 onNavigate={setCurrentView} 
                 onFocusServer={(id) => { setHighlightServerId(id); setTimeout(() => setHighlightServerId(null), 5000); }} 
                 autoOpenCreate={autoCreateTarget === 'domains'} 
                 onAutoOpenHandled={() => setAutoCreateTarget(null)}
                 highlightDomainId={highlightDomainId || undefined}
               />
             )}
             {currentView === 'providers' && <ProviderList settings={settings} providers={providers} onUpdate={handleProviderUpdate} lang={language} autoOpenCreate={autoCreateTarget === 'providers'} onAutoOpenHandled={() => setAutoCreateTarget(null)} />}
             {currentView === 'profile' && <UserProfile userId={currentUser.id} lang={language} />}
             {currentView === 'settings' && <SystemSettingsComponent userId={currentUser.id} lang={language} onSettingsChange={(s) => setSettings(s)} />}
             {(currentUser?.role === 'admin' && (currentView as any) === 'superAdmin') && (
               <SuperAdmin lang={language} />
             )}
           </div>
        </div>

        {/* Global WebSSH Terminal */}
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
  );
};

export default App;
