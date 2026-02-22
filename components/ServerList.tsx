
import React, { useState, useEffect } from 'react';
import { Server, ServerStatus, Domain, Language, Provider, SystemSettings, ViewState } from '../types';
import { Edit2, Trash2, Plus, Copy, Eye, EyeOff, ExternalLink, X, Check, Server as ServerIcon, Layout, Link as LinkIcon, PlayCircle, StopCircle, AlertOctagon, AlertTriangle, ChevronDown, ChevronUp, Terminal, Command, AlertCircle, RefreshCw, Wifi, Activity, Loader2, CheckCircle2, XCircle, Globe, LayoutGrid, List } from 'lucide-react';
import { translations } from '../utils/translations';
import { startProgress, updateProgress, finishProgress, showToast } from '../utils/notify';
import { TruncatedText, CompactText } from './TruncatedText';
import { ServerTableView } from './TableView';
import { SortableList, DragHandle, sortByOrder, DragHandleProps } from './SortableList';

interface ServerListProps {
  servers: Server[];
  domains: Domain[];
  providers: Provider[];
  lang: Language;
  onUpdate: (servers: Server[]) => void;
  onOpenTerminal: (server: Server) => void;
  highlightServerId?: string;
  settings?: SystemSettings;
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
  onNavigate?: (v: ViewState) => void;
  onFocusDomain?: (id: string) => void;
}

const EmptyServer: Server = {
  id: '',
  name: '',
  ip: '',
  provider: '',
  region: '',
  os: '',
  status: 'running',
  expirationDate: '',
  cpu: '',
  ram: '',
  disk: '',
  sshPort: '22',
  sshUsername: 'root'
};

export const ServerList: React.FC<ServerListProps> = ({ servers, domains, providers, lang, onUpdate, onOpenTerminal, highlightServerId, settings, autoOpenCreate, onAutoOpenHandled, onNavigate, onFocusDomain }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState<boolean>(false);
  const [showEditSshPass, setShowEditSshPass] = useState<boolean>(false);
  const [showEditPanelPass, setShowEditPanelPass] = useState<boolean>(false);
  const [showEditProviderPass, setShowEditProviderPass] = useState<boolean>(false);

  const t = translations[lang];
  
  // States for UI interactions
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [viewModeMap, setViewModeMap] = useState<Record<string, 'panel' | 'provider'>>({});
  const [expandedNotesMap, setExpandedNotesMap] = useState<Record<string, { server: boolean; provider: boolean; domains?: boolean; notes?: boolean }>>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>(settings?.listViewMode || 'card');

  useEffect(() => {
    if (settings?.listViewMode) {
      setViewMode(settings.listViewMode);
    }
  }, [settings?.listViewMode]);
  const [revealedPanelPass, setRevealedPanelPass] = useState<Record<string, string>>({});
  const [revealedSshPass, setRevealedSshPass] = useState<Record<string, string>>({});
  const [revealedProviderPass, setRevealedProviderPass] = useState<Record<string, string>>({});
  const [pingLatencyMap, setPingLatencyMap] = useState<Record<string, number | null>>({});
  const [pingLoadingMap, setPingLoadingMap] = useState<Record<string, boolean>>({});
  const [pingErrorMap, setPingErrorMap] = useState<Record<string, string>>({});

  // Single server ping handler
  const handlePing = async (server: Server) => {
    try {
      setPingLoadingMap(prev => ({ ...prev, [server.id]: true }))
      setPingErrorMap(prev => ({ ...prev, [server.id]: '' }))
      const api = await import('../services/apiClient')
      const r = await api.pingServerApi(server.id)
      setPingLatencyMap(prev => ({ ...prev, [server.id]: r.latencyMs }))
      const next = servers.map(s => s.id === server.id ? Object.assign({}, s, { status: r.reachable ? 'running' : 'stopped', lastPingMs: r.latencyMs }) : s)
      onUpdate(next)
      showToast(
        r.reachable 
          ? (lang==='zh' ? `${server.name} 可达 (${r.latencyMs}ms)` : `${server.name} reachable (${r.latencyMs}ms)`)
          : (lang==='zh' ? `${server.name} 不可达` : `${server.name} unreachable`),
        r.reachable ? 'success' : 'error'
      )
    } catch (e: any) {
      setPingErrorMap(prev => ({ ...prev, [server.id]: e?.message || 'Ping failed' }))
      showToast(lang==='zh' ? `${server.name} Ping 失败` : `${server.name} ping failed`, 'error')
    } finally { 
      setPingLoadingMap(prev => ({ ...prev, [server.id]: false })) 
    }
  };
  const [bulkChecking, setBulkChecking] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<number>(0);
  const [bulkTotal, setBulkTotal] = useState<number>(0);
  const [bulkToast, setBulkToast] = useState<string>('');
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightServerId) return;
    const el = document.getElementById(`server-${highlightServerId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightServerId]);
  // 检测滚动位置，接近底部时使悬浮按钮半透明
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const nearBottom = docHeight - (scrollY + windowHeight) < 150;
      setIsNearBottom(nearBottom);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 新创建项目后滚动和高亮
  React.useEffect(() => {
    if (!newlyCreatedId) return;
    
    const timer = setTimeout(() => {
      const el = document.getElementById(viewMode === 'table' ? `server-row-${newlyCreatedId}` : `server-${newlyCreatedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-emerald-400', 'animate-pulse');
        
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-emerald-400', 'animate-pulse');
          setNewlyCreatedId(null);
        }, 3000);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [newlyCreatedId]);


  useEffect(() => {
    if (autoOpenCreate) {
      openAddModal();
      onAutoOpenHandled && onAutoOpenHandled();
    }
  }, [autoOpenCreate]);

  const togglePassword = (id: string) => {
    const isCurrentlyVisible = showPasswordMap[id];
    
    // 如果当前是显示状态，点击后直接隐藏
    if (isCurrentlyVisible) {
      setShowPasswordMap(prev => ({ ...prev, [id]: false }));
      return;
    }
    
    // 如果当前是隐藏状态，需要解密并显示
    (async () => {
      try {
        const isProv = id.startsWith('prov-')
        const isSsh = id.startsWith('ssh-')
        const realId = isProv ? id.replace(/^prov-/, '') : (isSsh ? id.replace(/^ssh-/, '') : id)
        
        const { revealServerSecretsApi } = await import('../services/apiClient')
        const r = await revealServerSecretsApi(realId)
        
        // 始终保存结果（空字符串表示密码为空）
        if (!isProv && !isSsh) {
          setRevealedPanelPass(prev => ({ ...prev, [realId]: r.panelPassword || '' }))
        }
        if (isSsh) {
          setRevealedSshPass(prev => ({ ...prev, [realId]: r.sshPassword || '' }))
        }
        if (isProv) {
          setRevealedProviderPass(prev => ({ ...prev, [realId]: r.providerPassword || '' }))
        }
        
        // 显示密码区域
        setShowPasswordMap(prev => ({ ...prev, [id]: true }));
      } catch (e) {
        const { showToast } = await import('../utils/notify')
        showToast(lang==='zh' ? '无法显示密码' : 'Cannot reveal password', 'error');
      }
    })()
  };

  const copyToClipboard = (text: string, key: string) => {
    import('../utils/clipboard').then(m => m.copyText(text)).then(ok => {
      if (!ok) return
      setCopiedMap(prev => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedMap(prev => ({ ...prev, [key]: false }))
      }, 2000)
    }).catch(()=>{})
  };

  const handleDeleteClick = (id: string) => {
      setDeletingId(id);
  };

  const confirmDelete = () => {
    try {
      if (deletingId) {
        onUpdate(servers.filter(s => s.id !== deletingId));
        setDeletingId(null);
      }
    } catch {}
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;

    if (editingServer.id) {
      // Edit
      onUpdate(servers.map(s => s.id === editingServer.id ? editingServer : s));
      setIsModalOpen(false);
      setEditingServer(null);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 2000);
    } else {
      // Add
      const newId = `srv-${Date.now()}`;
      const newServer = { ...editingServer, id: newId, createdAt: Date.now(), sortOrder: servers.length };
      onUpdate([...servers, newServer]);
      setIsModalOpen(false);
      setEditingServer(null);
      setNewlyCreatedId(newId);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 2000);
    }
  };

  const handleProviderSelectChange = (val: string) => {
    if (!editingServer) return;
    
    if (val === 'custom') {
        setEditingServer({
            ...editingServer,
            providerId: undefined,
            provider: '', 
            providerUrl: '',
            providerUsername: '',
            providerPassword: ''
        });
    } else {
        const provider = providers.find(p => p.id === val);
        if (provider) {
            setEditingServer({
                ...editingServer,
                providerId: provider.id,
                provider: provider.name,
                providerUrl: provider.loginUrl,
                providerUsername: provider.username,
                providerPassword: provider.password
            });
        }
    }
  };

  const isCustomProvider = !editingServer?.providerId;

  const openAddModal = () => {
    setEditingServer({ ...EmptyServer });
    setIsModalOpen(true);
  };

  const openEditModal = (server: Server) => {
    setEditingServer(JSON.parse(JSON.stringify(server)));
    setIsModalOpen(true);
    (async () => {
      try {
        const { revealServerSecretsApi } = await import('../services/apiClient')
        const r = await revealServerSecretsApi(server.id)
        
        // 只在解密成功时更新密码字段
        const updates: any = {};
        if (r.panelPassword && r.panelPassword.trim() !== '') {
          updates.password = r.panelPassword;
        }
        if (r.sshPassword && r.sshPassword.trim() !== '') {
          updates.sshPassword = r.sshPassword;
        }
        if (r.providerPassword && r.providerPassword.trim() !== '') {
          updates.providerPassword = r.providerPassword;
        }
        
        if (Object.keys(updates).length > 0) {
          setEditingServer(prev => prev ? Object.assign({}, prev, updates) : prev)
        }
      } catch (e) {
        // 解密失败，保留原有的占位符或空值
        console.error('Failed to reveal server secrets:', e);
      }
    })()
  };

  const getStatusBadge = (status: ServerStatus) => {
    switch (status) {
      case 'running': 
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                <PlayCircle className="w-3.5 h-3.5 fill-emerald-700/20" />
                {t[status] || status}
            </span>
        );
      case 'stopped': 
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                <StopCircle className="w-3.5 h-3.5 fill-rose-700/20" />
                {t[status] || status}
            </span>
        );
      case 'expired': 
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                <AlertOctagon className="w-3.5 h-3.5" />
                {t[status] || status}
            </span>
        );
      case 'maintenance': 
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 fill-amber-700/20" />
                {t[status] || status}
            </span>
        );
      default: 
        return (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                {status}
            </span>
        );
    }
  };

  const getExpirationStyle = (dateStr: string) => {
      if (!dateStr) return '';
      const days = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (days < 0) return 'bg-rose-100 text-rose-700 border-rose-200 font-bold animate-pulse';
      if (days < 30) return 'bg-amber-100 text-amber-700 border-amber-200 font-bold';
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 font-medium';
  };

  const withUnit = (val?: string, unit?: string) => {
    if (!val) return '-';
    const numeric = /^\d+(\.\d+)?$/.test(val.trim());
    return numeric && unit ? `${val.trim()} ${unit}` : val;
  };

  const getLinkedDomains = (serverId: string) => {
    return domains.filter(d => d.records.some(r => r.linkedServerId === serverId));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {saveBanner && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg">
          Saved successfully
        </div>
      )}
      <div className={`flex justify-between items-center`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.serverManagement}</h2>
          <p className="text-slate-500 text-sm">{t.serverSubtitle}</p>
        </div>
        
        {/* View Toggle and Action Buttons Container */}
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title={lang === 'zh' ? '卡片视图' : 'Card View'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title={lang === 'zh' ? '列表视图' : 'Table View'}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          {/* Action Buttons (if not floating) */}
          {(settings?.actionButtonsLayout ?? 'floating') !== 'floating' && (
            <>
              <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"><Plus className="w-4 h-4" /> {t.addServer}</button>
          <button 
            onClick={async()=>{ 
              try { 
                setBulkChecking(true)
                setBulkProgress(0)
                setBulkTotal(servers.length)
                
                // 标记所有服务器正在检测
                const allIds = servers.map(s => s.id)
                setPingLoadingMap(prev => Object.fromEntries(allIds.map(id => [id, true])))
                
                const api = await import('../services/apiClient')
                let updated = [...servers]
                
                startProgress(
                  lang==='zh' ? '检测服务器状态' : 'Checking Servers', 
                  servers.map(s => ({ id: s.id, name: s.name })), 
                  `${servers.length}`
                )
                
                let successCount = 0
                let failCount = 0
                
                // 并发限制
                const limit = 5
                let idx = 0
                let active = 0
                
                await new Promise<void>((resolve) => {
                  const next = () => {
                    if (idx === servers.length && active === 0) return resolve()
                    while (active < limit && idx < servers.length) {
                      const sv = servers[idx++]
                      active++
                      
                      api.pingServerApi(sv.id)
                        .then(r => {
                          setPingLatencyMap(prev => ({ ...prev, [sv.id]: r.latencyMs }))
                          updated = updated.map(s => s.id === sv.id 
                            ? Object.assign({}, s, { status: r.reachable ? 'running' : 'stopped', lastPingMs: r.latencyMs }) 
                            : s
                          )
                          onUpdate(updated)
                          setBulkProgress(p => p + 1)
                          
                          if (r.reachable) {
                            successCount++
                            updateProgress(sv.id, 'success', `${r.latencyMs} ms`)
                          } else {
                            failCount++
                            updateProgress(sv.id, 'error', 'unreachable')
                          }
                        })
                        .catch((e: any) => {
                          failCount++
                          setPingErrorMap(prev => ({ ...prev, [sv.id]: e?.message || 'error' }))
                          updateProgress(sv.id, 'error', String(e?.message || 'error'))
                          setBulkProgress(p => p + 1)
                        })
                        .finally(() => {
                          setPingLoadingMap(prev => ({ ...prev, [sv.id]: false }))
                          active--
                          next()
                        })
                    }
                  }
                  next()
                })
                
                finishProgress()
                showToast(
                  lang==='zh' 
                    ? `检测完成: ${successCount} 可达, ${failCount} 不可达` 
                    : `Check complete: ${successCount} reachable, ${failCount} unreachable`, 
                  failCount ? 'error' : 'success'
                )
              } finally { 
                setBulkChecking(false)
                setPingLoadingMap({})
              } 
            }} 
            disabled={bulkChecking}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-70"
          >
            {bulkChecking ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wifi className="w-4 h-4"/>}
            {bulkChecking 
              ? (lang==='zh' ? `检测中 ${bulkProgress}/${bulkTotal}` : `Checking ${bulkProgress}/${bulkTotal}`)
              : (lang==='zh' ? '检测全部' : 'Check All')
            }
          </button>
            </>
          )}
        </div>
      </div>

      

      {servers.length === 0 && (
        <div className="w-full min-h-[30vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 mb-3">
              <ServerIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-slate-900">{t.emptyTitle}</div>
              <div className="text-slate-500 text-sm">{t.emptyHint}</div>
            </div>
            <div className="mt-4">
              
            <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
                <Plus className="w-4 h-4" />{t.addServer}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <ServerTableView
          servers={servers}
          domains={domains}
          lang={lang}
          onEdit={(s) => openEditModal(s)}
          onDelete={(id) => setDeletingId(id)}
          onTerminal={onOpenTerminal}
          onPing={handlePing}
          onDomainClick={(domainId) => { onFocusDomain(domainId); onNavigate('domains'); }}
          highlightId={newlyCreatedId || highlightServerId}
          pingLoading={pingLoadingMap}
          pingLatency={pingLatencyMap}
          pingError={pingErrorMap}
          onReorder={onUpdate}
        />
      ) : (
      <SortableList
          items={sortByOrder(servers)}
          onReorder={onUpdate}
          layout="grid"
          gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-40"
          renderItem={(server, dragHandleProps) => {
          const isProviderView = viewModeMap[server.id] === 'provider';
          const copyKeyBase = server.id;
          const linkedDomains = getLinkedDomains(server.id);
          const isHighlighted = highlightServerId === server.id;

          return (
            <div id={`server-${server.id}`} key={server.id} className={`relative bg-white rounded-xl border ${newlyCreatedId === server.id ? 'border-emerald-500 ring-4 ring-emerald-300 shadow-2xl scale-[1.02]' : isHighlighted ? 'border-indigo-500 ring-4 ring-indigo-300 shadow-2xl scale-[1.02]' : 'border-slate-200'} transition-all duration-500 flex flex-col group`}
            >
              {isHighlighted && (
                <>
                  <div className="absolute -inset-2 rounded-2xl opacity-30 border-2 border-indigo-400 animate-ping" />
                  <div className="absolute inset-0 rounded-xl pointer-events-none shadow-[0_0_40px_rgba(79,70,229,0.35)]" />
                </>
              )}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start gap-2">
                  <DragHandle {...dragHandleProps} className="flex-shrink-0 mt-1" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-700 transition-colors truncate" title={server.name}>{server.name}</h3>
                  </div>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <div>{getStatusBadge(server.status)}</div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onOpenTerminal(server)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title={t.openTerminal}><Terminal className="w-4 h-4" /></button>
                    <button 
                      onClick={async () => { 
                        try { 
                          setPingLoadingMap(prev => ({ ...prev, [server.id]: true }))
                          setPingErrorMap(prev => ({ ...prev, [server.id]: '' }))
                          const api = await import('../services/apiClient')
                          const r = await api.pingServerApi(server.id)
                          setPingLatencyMap(prev => ({ ...prev, [server.id]: r.latencyMs }))
                          const next = servers.map(s => s.id === server.id ? Object.assign({}, s, { status: r.reachable ? 'running' : 'stopped', lastPingMs: r.latencyMs }) : s)
                          onUpdate(next)
                          showToast(
                            r.reachable 
                              ? (lang==='zh' ? `${server.name} 可达 (${r.latencyMs}ms)` : `${server.name} reachable (${r.latencyMs}ms)`)
                              : (lang==='zh' ? `${server.name} 不可达` : `${server.name} unreachable`),
                            r.reachable ? 'success' : 'error'
                          )
                        } catch (e: any) {
                          setPingErrorMap(prev => ({ ...prev, [server.id]: e?.message || 'Ping failed' }))
                          showToast(lang==='zh' ? `${server.name} Ping 失败` : `${server.name} ping failed`, 'error')
                        } finally { 
                          setPingLoadingMap(prev => ({ ...prev, [server.id]: false })) 
                        } 
                      }} 
                      disabled={pingLoadingMap[server.id]}
                      className={`p-2 rounded-lg transition-all ${pingLoadingMap[server.id] ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} 
                      title="Ping"
                    >
                      {pingLoadingMap[server.id] ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wifi className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => openEditModal(server)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title={t.editServer}><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteClick(server.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title={t.deleteServer}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="mt-2 w-full text-sm">
                  <div className="flex justify-between items-center w-full bg-white border border-slate-200 rounded-lg h-9 px-3">
                    <span className="font-mono text-slate-700 truncate min-w-0" title={server.ip}>{server.ip}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const v: any = pingLatencyMap[server.id] ?? (server as any).lastPingMs
                        const ok = typeof v === 'number'
                        const txt = ok ? `${v} ms` : 'NG'
                        const cls = ok
                          ? (v < 50
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : (v <= 200
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'))
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 h-7 rounded-md border text-xs ${cls}`} title={ok ? `${v} ms` : 'No connectivity'}>
                            {ok && <Activity className="w-3 h-3 animate-pulse" />}
                            {txt}
                          </span>
                        )
                      })()}
                      <button 
                        onClick={() => copyToClipboard(server.ip, `${copyKeyBase}-ip`)} 
                        className="p-2 text-slate-400 hover:text-slate-900 transition-colors rounded"
                        title={t.copyIp}
                      >
                         {copiedMap[`${copyKeyBase}-ip`] ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Server Specs & Info */}
              <div className="p-5 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">Provider</p>
                    <TruncatedText 
                      text={server.provider || ''} 
                      maxLength={16} 
                      className="font-medium text-slate-700"
                      label="Provider"
                      showCopy
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">{t.region}</p>
                    <TruncatedText 
                      text={server.region || ''} 
                      maxLength={16} 
                      className="font-medium text-slate-700"
                      label={t.region}
                    />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">{t.expires}</p>
                    <p className={`font-medium px-1.5 py-0.5 rounded w-fit text-xs ${getExpirationStyle(server.expirationDate)}`}>
                        {server.expirationDate || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">Specs</p>
                    <p className="font-medium text-slate-700 text-xs">{withUnit(server.cpu, 'vCPU')} / {withUnit(server.ram, 'GB')}</p>
                  </div>
                </div>
                
                {/* SSH Quick Info */}
                <div className="bg-slate-900 text-slate-300 p-3 rounded-lg text-xs flex justify-between items-center font-mono border border-slate-700 shadow-inner">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="opacity-90">{server.sshUsername || 'root'}@{server.ip}:{server.sshPort || 22}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => copyToClipboard(server.sshUsername || 'root', `${copyKeyBase}-ssh-u`)} className="hover:text-white transition-colors" title={t.copySshUser}>
                            {copiedMap[`${copyKeyBase}-ssh-u`] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                         <button onClick={async () => { try { let val = revealedSshPass[server.id]; if (!val) { const { revealServerSecretsApi } = await import('../services/apiClient'); const r = await revealServerSecretsApi(server.id); if (r.sshPassword) { val = r.sshPassword; setRevealedSshPass(prev => ({ ...prev, [server.id]: r.sshPassword! })) } } if (val) { copyToClipboard(val, `${copyKeyBase}-ssh-p`) } else { console.warn('[Copy] SSH 密码为空') } } catch (e) { console.error('[Copy] 复制失败:', e) } }} className="hover:text-white transition-colors" title={t.copySshPass}>
                            {copiedMap[`${copyKeyBase}-ssh-p`] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Command className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Linked Domains - Fixed height */}
                <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 relative min-h-[72px]">
                   <p className="text-[10px] text-indigo-500 font-bold uppercase mb-2 flex items-center gap-1">
                     <Globe className="w-3 h-3"/> {t.linkedDomains}
                   </p>
                   {linkedDomains.length > 0 ? (
                     <div className={`flex flex-wrap gap-1.5 transition-all duration-300 ${expandedNotesMap[server.id]?.domains ? '' : 'max-h-[40px] overflow-hidden'}`}>
                        {linkedDomains.map(d => (
                          <button 
                            key={d.id} 
                            onClick={() => { if (onFocusDomain && onNavigate) { onFocusDomain(d.id); onNavigate('domains'); } }}
                            className="inline-flex items-center gap-1 text-xs bg-white text-indigo-700 px-2 py-1 rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-100 hover:border-indigo-200 transition-colors cursor-pointer"
                          >
                            <Globe className="w-3 h-3 text-indigo-400" />
                            <span className="font-medium truncate max-w-[80px]">{d.name}</span>
                          </button>
                        ))}
                     </div>
                   ) : (
                     <span className="text-xs text-slate-400 italic">{t.noLinkedDomains}</span>
                   )}
                   {linkedDomains.length > 3 && (
                     <button 
                       onClick={() => setExpandedNotesMap(prev => ({ ...prev, [server.id]: { ...prev[server.id], domains: !prev[server.id]?.domains } }))}
                       className={`absolute right-2 bottom-2 text-[10px] px-2 py-0.5 rounded-full transition-colors ${expandedNotesMap[server.id]?.domains ? 'bg-indigo-200 text-indigo-800' : 'bg-white text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
                     >
                       {expandedNotesMap[server.id]?.domains ? (lang==='zh' ? '收起' : 'Less') : `+${linkedDomains.length - 3}`}
                     </button>
                   )}
                </div>

                {/* Notes Section - Fixed height */}
                {!isProviderView && (
                  <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 relative min-h-[60px]">
                    <span className="font-semibold text-slate-600 text-[10px] uppercase tracking-wide mb-1 block">{t.serverNotes}</span>
                    {server.notes ? (
                      <>
                        <div className={`transition-all duration-300 text-slate-600 leading-relaxed ${expandedNotesMap[server.id]?.notes ? '' : 'max-h-[32px] overflow-hidden'}`}>
                          {server.notes}
                        </div>
                        {server.notes.length > 60 && (
                          <button 
                            onClick={() => setExpandedNotesMap(prev => ({ ...prev, [server.id]: { ...prev[server.id], notes: !prev[server.id]?.notes } }))}
                            className={`absolute right-2 bottom-2 text-[10px] px-2 py-0.5 rounded-full transition-colors ${expandedNotesMap[server.id]?.notes ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                          >
                            {expandedNotesMap[server.id]?.notes ? (lang==='zh' ? '收起' : 'Less') : (lang==='zh' ? '更多' : 'More')}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 italic">{lang==='zh' ? '暂无备注' : 'No notes'}</span>
                    )}
                  </div>
                )}
                {isProviderView && (
                  <div className="text-xs text-slate-500 bg-amber-50 p-2.5 rounded-lg border border-amber-100 relative min-h-[60px]">
                    <span className="font-semibold text-amber-700 text-[10px] uppercase tracking-wide mb-1 block">{t.providerNotes}</span>
                    {server.providerNotes ? (
                      <>
                        <div className={`transition-all duration-300 text-amber-700 leading-relaxed ${expandedNotesMap[server.id]?.provider ? '' : 'max-h-[32px] overflow-hidden'}`}>
                          {server.providerNotes}
                        </div>
                        {server.providerNotes.length > 60 && (
                          <button 
                            onClick={() => setExpandedNotesMap(prev => ({ ...prev, [server.id]: { ...prev[server.id], provider: !prev[server.id]?.provider } }))}
                            className={`absolute right-2 bottom-2 text-[10px] px-2 py-0.5 rounded-full transition-colors ${expandedNotesMap[server.id]?.provider ? 'bg-amber-200 text-amber-800' : 'bg-white text-amber-600 hover:bg-amber-100 border border-amber-200'}`}
                          >
                            {expandedNotesMap[server.id]?.provider ? (lang==='zh' ? '收起' : 'Less') : (lang==='zh' ? '更多' : 'More')}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-amber-500 italic">{lang==='zh' ? '暂无备注' : 'No notes'}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Footer - Toggleable */}
              <div className={`p-4 border-t ${isProviderView ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'} rounded-b-xl transition-colors duration-300`}>
                  
                  {/* View Switcher */}
                  <div className="flex justify-center mb-4">
                    <div className="bg-white border border-slate-200 p-1 rounded-lg flex text-xs font-medium shadow-sm">
                        <button 
                            onClick={() => setViewModeMap(prev => ({ ...prev, [server.id]: 'panel' }))}
                            className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all ${!isProviderView ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                        >
                            <ServerIcon className="w-3 h-3"/> {t.panelInfo}
                        </button>
                        <button 
                            onClick={() => setViewModeMap(prev => ({ ...prev, [server.id]: 'provider' }))}
                            className={`px-3 py-1 rounded-md flex items-center gap-1 transition-all ${isProviderView ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                        >
                            <Layout className="w-3 h-3"/> {t.providerConsole}
                        </button>
                    </div>
                  </div>

                  {/* Panel Details */}
                  {!isProviderView && (
                      <div className="space-y-3 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">URL</span>
                            {server.panelUrl ? (
                                <a href={server.panelUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline font-medium">
                                    {t.openPanel} <ExternalLink className="w-3 h-3"/>
                                </a>
                            ) : <span className="text-slate-400 text-xs">-</span>}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">{t.username}</span>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-slate-700 bg-white px-1.5 rounded border border-slate-200 text-xs py-0.5 truncate max-w-[55%] md:max-w-[12rem]" title={server.username || ''}>
                                    {server.username || '-'}
                                </span>
                                {server.username && (
                                    <button 
                                        onClick={() => copyToClipboard(server.username!, `${copyKeyBase}-user`)}
                                        className="text-slate-400 hover:text-slate-600"
                                        title={t.copyUser}
                                    >
                                        {copiedMap[`${copyKeyBase}-user`] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">{t.password}</span>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-slate-700 bg-white px-1.5 rounded border border-slate-200 min-w-[80px] text-center text-xs py-0.5 truncate max-w-[55%] md:max-w-[12rem]" title={showPasswordMap[server.id] ? (revealedPanelPass[server.id] || '') : ''}>
                                    {(() => {
                                      // 没有密码 → 显示 -
                                      if (!server.password && !server.hasPassword) return '-';
                                      const revealed = revealedPanelPass[server.id];
                                      // 已解密且为空 → 显示 -
                                      if (revealed === '') return '-';
                                      // 已解密且有值 → 显示明文
                                      if (showPasswordMap[server.id] && revealed) return revealed;
                                      // 有密码但未解密 → 显示 ••••••••
                                      return '••••••••';
                                    })()}
                                </span>
                                <button onClick={() => togglePassword(server.id)} className="text-slate-400 hover:text-slate-600" title={showPasswordMap[server.id] ? "Hide" : "Show"}>
                                    {showPasswordMap[server.id] ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                                </button>
                                <button 
                                    onClick={async () => {
                                      try {
                                        let val = revealedPanelPass[server.id]
                                        if (!val) {
                                          const { revealServerSecretsApi } = await import('../services/apiClient')
                                          const r = await revealServerSecretsApi(server.id)
                                          if (r.panelPassword) {
                                            val = r.panelPassword
                                            setRevealedPanelPass(prev => ({ ...prev, [server.id]: r.panelPassword! }))
                                          }
                                        }
                                        if (val) {
                                          copyToClipboard(val, `${copyKeyBase}-pass`)
                                        } else {
                                          console.warn('[Copy] 面板密码为空')
                                        }
                                      } catch (e) { console.error('[Copy] 复制失败:', e) }
                                    }}
                                    className="text-slate-400 hover:text-slate-600"
                                    title={t.copyPass}
                                >
                                    {copiedMap[`${copyKeyBase}-pass`] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                      </div>
                  )}

                  {/* Provider Details */}
                  {isProviderView && (
                      <div className="space-y-3 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">{t.consoleUrl}</span>
                            {server.providerUrl ? (
                                <a href={server.providerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-amber-700 hover:underline font-medium">
                                    {t.openConsole} <ExternalLink className="w-3 h-3"/>
                                </a>
                            ) : <span className="text-slate-400 text-xs">-</span>}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">{t.username}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-700 bg-white px-1.5 rounded border border-slate-200 text-xs py-0.5">
                                    {server.providerUsername || '-'}
                                </span>
                                {server.providerUsername && (
                                    <button 
                                        onClick={() => copyToClipboard(server.providerUsername!, `${copyKeyBase}-prov-user`)}
                                        className="text-slate-400 hover:text-slate-600"
                                        title={t.copyProvUser}
                                    >
                                        {copiedMap[`${copyKeyBase}-prov-user`] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">{t.password}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-700 bg-white px-1.5 rounded border border-slate-200 min-w-[80px] text-center text-xs py-0.5">
                                    {(() => {
                                      // 没有密码 → 显示 -
                                      if (!server.providerPassword && !server.hasProviderPassword) return '-';
                                      const revealed = revealedProviderPass[server.id];
                                      // 已解密且为空 → 显示 -
                                      if (revealed === '') return '-';
                                      // 已解密且有值 → 显示明文
                                      if (showPasswordMap[`prov-${server.id}`] && revealed) return revealed;
                                      // 有密码但未解密 → 显示 ••••••••
                                      return '••••••••';
                                    })()}
                                </span>
                                <button onClick={() => togglePassword(`prov-${server.id}`)} className="text-slate-400 hover:text-slate-600" title={showPasswordMap[`prov-${server.id}`] ? "Hide" : "Show"}>
                                    {showPasswordMap[`prov-${server.id}`] ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                                </button>
                                <button 
                                    onClick={async () => {
                                      try {
                                        let val = revealedProviderPass[server.id]
                                        if (!val) {
                                          const { revealServerSecretsApi } = await import('../services/apiClient')
                                          const r = await revealServerSecretsApi(server.id)
                                          if (r.providerPassword) {
                                            val = r.providerPassword
                                            setRevealedProviderPass(prev => ({ ...prev, [server.id]: r.providerPassword! }))
                                          }
                                        }
                                        if (val) {
                                          copyToClipboard(val, `${copyKeyBase}-prov-pass`)
                                        } else {
                                          console.warn('[Copy] 厂商密码为空')
                                        }
                                      } catch (e) { console.error('[Copy] 复制失败:', e) }
                                    }}
                                    className="text-slate-400 hover:text-slate-600"
                                    title={t.copyProvPass}
                                >
                                    {copiedMap[`${copyKeyBase}-prov-pass`] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                      </div>
                  )}
              </div>
            </div>
          );
        }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 scale-100">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{t.deleteServer}</h3>
                      <p className="text-slate-500 text-sm mb-6">{t.confirmDeleteServer}</p>
                      <div className="flex gap-3 w-full">
                          <button 
                            onClick={() => setDeletingId(null)} 
                            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                          >
                              {t.cancel}
                          </button>
                          <button 
                            onClick={confirmDelete} 
                            className="flex-1 px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30"
                          >
                              Delete
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Modal */}
      {isModalOpen && editingServer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-800">{editingServer.id ? t.editServer : t.addServer}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              
              {/* Basic Info */}
              <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">{t.basicInfo}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Server Name</label>
                      <input required type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" 
                        value={editingServer.name} onChange={e => setEditingServer({...editingServer, name: e.target.value})} placeholder="e.g. Prod-Web-01" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">IP Address</label>
                      <input required type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" 
                        value={editingServer.ip} onChange={e => setEditingServer({...editingServer, ip: e.target.value})} placeholder="192.168.x.x" />
                    </div>
                    
                    {/* Provider Selection */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Provider</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select 
                                className="appearance-none w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                                value={editingServer.providerId || 'custom'} 
                                onChange={e => handleProviderSelectChange(e.target.value)}
                            >
                        {providers.filter(p => p.categories.length === 0 || p.categories.includes('server')).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                                <option value="custom">{t.customProvider}</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        <button type="button" onClick={() => handleProviderSelectChange('custom')} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600" title={t.customProvider}>
                             <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      {/* Manual Provider Name Input if Custom */}
                      {isCustomProvider && (
                          <input 
                            type="text" 
                            className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 mt-2 focus:ring-2 focus:ring-slate-900 focus:outline-none animate-in fade-in slide-in-from-top-1" 
                            value={editingServer.provider} 
                            onChange={e => setEditingServer({...editingServer, provider: e.target.value})} 
                            placeholder="Enter Provider Name..." 
                          />
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">{t.status}</label>
                      <div className="relative">
                        <select className="appearance-none w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                            value={editingServer.status} onChange={e => setEditingServer({...editingServer, status: e.target.value as ServerStatus})}>
                              <option value="running">{t.running}</option>
                              <option value="stopped">{t.stopped}</option>
                              <option value="maintenance">{t.maintenance}</option>
                              <option value="expired">{t.expired}</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    
                    {/* Location / Region */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">{t.region}</label>
                      <input type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" 
                        value={editingServer.region || ''} onChange={e => setEditingServer({...editingServer, region: e.target.value})} placeholder="e.g. us-east-1, Hong Kong" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">{t.os}</label>
                      <input type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" 
                        value={editingServer.os} onChange={e => setEditingServer({...editingServer, os: e.target.value})} placeholder="Ubuntu 22.04" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">{t.expires}</label>
                      <input type="date" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" 
                        value={editingServer.expirationDate} onChange={e => setEditingServer({...editingServer, expirationDate: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.cpu}</label>
                       <input type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2" value={editingServer.cpu} onChange={e => setEditingServer({...editingServer, cpu: e.target.value})} placeholder="2 vCPU"/>
                    </div>
                     <div className="space-y-1">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.ram}</label>
                       <input type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2" value={editingServer.ram} onChange={e => setEditingServer({...editingServer, ram: e.target.value})} placeholder="4GB"/>
                    </div>
                  </div>
              </div>
              
              {/* SSH Config */}
              <div className="space-y-4 bg-slate-900/5 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
                      <Terminal className="w-4 h-4"/> {t.sshInfo}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div className="space-y-1 md:col-span-1">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.sshPort}</label>
                       <input type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono" value={editingServer.sshPort || ''} onChange={e => setEditingServer({...editingServer, sshPort: e.target.value})} placeholder="22"/>
                    </div>
                    <div className="space-y-1 md:col-span-1">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.sshUser}</label>
                       <input type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono" value={editingServer.sshUsername || ''} onChange={e => setEditingServer({...editingServer, sshUsername: e.target.value})} placeholder="root"/>
                    </div>
                     <div className="space-y-1 md:col-span-2">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.sshPass}</label>
                       <div className="flex gap-2">
                         <input type={showEditSshPass ? 'text' : 'password'} className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono" value={editingServer.sshPassword || ''} onChange={e => setEditingServer({...editingServer, sshPassword: e.target.value || ''})} placeholder="Secret!"/>
                         <button type="button" onClick={() => setShowEditSshPass(v => !v)} className="px-2 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-300" aria-label={showEditSshPass ? 'Hide' : 'Show'}>
                           {showEditSshPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                         </button>
                       </div>
                    </div>
                    {/* SSH Key */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase">SSH 私钥（优先于密码）</label>
                      <textarea
                        rows={4}
                        className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs resize-y"
                        value={editingServer.sshKey || ''}
                        onChange={e => setEditingServer({...editingServer, sshKey: e.target.value})}
                        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <p className="text-[11px] text-slate-400">填写后 WebSSH 将优先使用 Key 认证。Key 明文存储，请知悉。</p>
                    </div>
                  </div>
              </div>

              {/* Server Panel Credentials */}
              <div className="space-y-4">
                 <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 flex items-center gap-2"><ServerIcon className="w-4 h-4"/> {t.panelInfo}</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.panelUrl}</label>
                       <input type="url" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2" value={editingServer.panelUrl || ''} onChange={e => setEditingServer({...editingServer, panelUrl: e.target.value})} placeholder="https://..."/>
                    </div>
                     <div className="space-y-1">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.username}</label>
                       <input type="text" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2" value={editingServer.username || ''} onChange={e => setEditingServer({...editingServer, username: e.target.value})} placeholder="admin"/>
                    </div>
                     <div className="space-y-1 md:col-span-2">
                       <label className="text-xs font-semibold text-slate-500 uppercase">{t.password}</label>
                       <div className="flex gap-2">
                         <input type={showEditPanelPass ? 'text' : 'password'} className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2" value={editingServer.password || ''} onChange={e => setEditingServer({...editingServer, password: e.target.value || ''})} placeholder="Secret123!"/>
                         <button type="button" onClick={() => setShowEditPanelPass(v => !v)} className="px-2 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-300" aria-label={showEditPanelPass ? 'Hide' : 'Show'}>
                           {showEditPanelPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                         </button>
                       </div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">{t.serverNotes}</label>
                        <textarea className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" rows={2}
                          value={editingServer.notes || ''} onChange={e => setEditingServer({...editingServer, notes: e.target.value})} placeholder="Additional server details..." />
                    </div>
                  </div>
              </div>

              {/* Provider Console Credentials */}
              <div className="space-y-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                 <div className="flex justify-between items-center border-b border-amber-200/50 pb-2 mb-3">
                    <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2"><Layout className="w-4 h-4"/> {t.providerConsole}</h4>
                    {/* Only show display name if linked */}
                    {editingServer.providerId && (
                        <span className="text-xs font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-200">
                           Linked: {editingServer.provider}
                        </span>
                    )}
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <label className="text-xs font-semibold text-amber-700/70 uppercase">{t.consoleUrl}</label>
                       <input type="url" className="w-full bg-white text-slate-900 border border-amber-200 rounded-lg px-3 py-2" value={editingServer.providerUrl || ''} onChange={e => setEditingServer({...editingServer, providerUrl: e.target.value})} placeholder="https://aws.amazon.com..."/>
                    </div>
                     <div className="space-y-1">
                       <label className="text-xs font-semibold text-amber-700/70 uppercase">{t.username} / Email</label>
                       <input type="text" className="w-full bg-white text-slate-900 border border-amber-200 rounded-lg px-3 py-2" value={editingServer.providerUsername || ''} onChange={e => setEditingServer({...editingServer, providerUsername: e.target.value})} placeholder="admin@example.com"/>
                    </div>
                     <div className="space-y-1 md:col-span-2">
                       <label className="text-xs font-semibold text-amber-700/70 uppercase">{t.password}</label>
                       <div className="flex gap-2">
                         <input type={showEditProviderPass ? 'text' : 'password'} className="flex-1 bg-white text-slate-900 border border-amber-200 rounded-lg px-3 py-2" value={editingServer.providerPassword || ''} onChange={e => setEditingServer({...editingServer, providerPassword: e.target.value || ''})} placeholder="ProviderSecret!"/>
                         <button type="button" onClick={() => setShowEditProviderPass(v => !v)} className="px-2 py-2 bg-white text-amber-800 rounded-lg border border-amber-200" aria-label={showEditProviderPass ? 'Hide' : 'Show'}>
                           {showEditProviderPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                         </button>
                       </div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-semibold text-amber-700/70 uppercase">{t.providerRemarks}</label>
                        <textarea className="w-full bg-white text-slate-900 border border-amber-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none" rows={2}
                          value={editingServer.providerNotes || ''} onChange={e => setEditingServer({...editingServer, providerNotes: e.target.value})} placeholder="Account specific notes, MFA details..." />
                    </div>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">{t.saveServer}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {(settings?.actionButtonsLayout ?? 'floating') === 'floating' && (
        <div className={`fixed sm:bottom-6 sm:right-6 bottom-3 right-3 z-40 flex flex-col gap-3 items-end transition-opacity duration-300 ${isNearBottom ? 'opacity-40 hover:opacity-100' : 'opacity-100'}`}>
          <button
            onClick={async()=>{ 
              try { 
                setBulkChecking(true)
                setBulkProgress(0)
                setBulkTotal(servers.length)
                
                const allIds = servers.map(s => s.id)
                setPingLoadingMap(prev => Object.fromEntries(allIds.map(id => [id, true])))
                
                const api = await import('../services/apiClient')
                let updated = [...servers]
                
                startProgress(
                  lang==='zh' ? '检测服务器状态' : 'Checking Servers', 
                  servers.map(s => ({ id: s.id, name: s.name })), 
                  `${servers.length}`
                )
                
                let successCount = 0
                let failCount = 0
                const limit = 5
                let idx = 0
                let active = 0
                
                await new Promise<void>((resolve) => {
                  const next = () => {
                    if (idx === servers.length && active === 0) return resolve()
                    while (active < limit && idx < servers.length) {
                      const sv = servers[idx++]
                      active++
                      
                      api.pingServerApi(sv.id)
                        .then(r => {
                          setPingLatencyMap(prev => ({ ...prev, [sv.id]: r.latencyMs }))
                          updated = updated.map(s => s.id === sv.id 
                            ? Object.assign({}, s, { status: r.reachable ? 'running' : 'stopped', lastPingMs: r.latencyMs }) 
                            : s
                          )
                          onUpdate(updated)
                          setBulkProgress(p => p + 1)
                          
                          if (r.reachable) {
                            successCount++
                            updateProgress(sv.id, 'success', `${r.latencyMs} ms`)
                          } else {
                            failCount++
                            updateProgress(sv.id, 'error', 'unreachable')
                          }
                        })
                        .catch((e: any) => {
                          failCount++
                          setPingErrorMap(prev => ({ ...prev, [sv.id]: e?.message || 'error' }))
                          updateProgress(sv.id, 'error', String(e?.message || 'error'))
                          setBulkProgress(p => p + 1)
                        })
                        .finally(() => {
                          setPingLoadingMap(prev => ({ ...prev, [sv.id]: false }))
                          active--
                          next()
                        })
                    }
                  }
                  next()
                })
                
                finishProgress()
                showToast(
                  lang==='zh' 
                    ? `检测完成: ${successCount} 可达, ${failCount} 不可达` 
                    : `Check complete: ${successCount} reachable, ${failCount} unreachable`, 
                  failCount ? 'error' : 'success'
                )
              } finally { 
                setBulkChecking(false)
                setPingLoadingMap({})
              } 
            }}
            disabled={bulkChecking}
            className={`rounded-full shadow ring-1 ring-indigo-200 bg-indigo-600 text-white flex items-center justify-center transition-all ${bulkChecking ? 'sm:w-auto sm:h-12 sm:px-4 w-auto h-10 px-3' : 'sm:w-12 sm:h-12 w-10 h-10'} hover:scale-105 active:scale-95`}
            title={lang==='zh' ? '检测全部' : 'Check All'}
            aria-label={lang==='zh' ? '检测全部' : 'Check All'}
          >
            {bulkChecking ? (
              <>
                <Loader2 className="sm:w-5 sm:h-5 w-4 h-4 animate-spin"/>
                <span className="ml-2 text-sm font-medium">{bulkProgress}/{bulkTotal}</span>
              </>
            ) : (
              <Wifi className="sm:w-5 sm:h-5 w-4 h-4"/>
            )}
          </button>
          <button
            onClick={openAddModal}
            className="rounded-full shadow ring-1 ring-emerald-200 bg-emerald-600 text-white flex items-center justify-center sm:w-12 sm:h-12 w-10 h-10 hover:scale-105 active:scale-95 transition-transform"
            title={t.addServer}
            aria-label={t.addServer}
          >
            <Plus className="sm:w-5 sm:h-5 w-4 h-4" />
          </button>
        </div>
      )}
        </div>
  );
};
