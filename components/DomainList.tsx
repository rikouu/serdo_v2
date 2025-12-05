
import React, { useState, useEffect } from 'react';
import { Domain, DNSRecord, Server, Language, Provider, ViewState, SystemSettings } from '../types';
import { Edit2, Trash2, Plus, ChevronDown, ChevronUp, Link as LinkIcon, X, Globe, Check, RefreshCw, Copy, ExternalLink, Eye, EyeOff, AlertTriangle, ListChecks, Loader2, AlertCircle, CheckCircle2, Lock, Unlock, Info, Layers, LayoutGrid, List } from 'lucide-react';
import { translations } from '../utils/translations';
import { showToast, startProgress, updateProgress, finishProgress } from '../utils/notify';
import { TruncatedText, CompactText } from './TruncatedText';
import { DomainTableView } from './TableView';
import { SortableList, DragHandle, sortByOrder, DragHandleProps } from './SortableList';

interface DomainListProps {
  domains: Domain[];
  servers: Server[];
  providers: Provider[];
  lang: Language;
  onUpdate: (domains: Domain[]) => void;
  onNavigate: (v: ViewState) => void;
  onFocusServer: (id: string) => void;
  settings?: SystemSettings;
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
  highlightDomainId?: string;
}

const EmptyDomain: Domain = {
  id: '',
  name: '',
  registrar: '',
  dnsProvider: '',
  expirationDate: '',
  autoRenew: true,
  records: [],
};

const EmptyRecord: DNSRecord = {
    id: '',
    type: 'A',
    name: '',
    value: '',
    ttl: 3600
}

export const DomainList: React.FC<DomainListProps> = ({ domains, servers, providers, lang, onUpdate, onNavigate, onFocusServer, settings, autoOpenCreate, onAutoOpenHandled, highlightDomainId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [revealedProviderPass, setRevealedProviderPass] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingDomain, setViewingDomain] = useState<Domain | null>(null);
  const [isViewFlipped, setIsViewFlipped] = useState(false);
  const [syncKind, setSyncKind] = useState<'all' | 'selected' | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: Domain[]; failed: { id: string; name?: string; error: string; details?: any }[] } | null>(null);
  const [saveBanner, setSaveBanner] = useState<boolean>(false);
  const [syncingDomainIds, setSyncingDomainIds] = useState<Set<string>>(new Set());
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>(settings?.listViewMode || 'card');

  useEffect(() => {
    if (settings?.listViewMode) {
      setViewMode(settings.listViewMode);
    }
  }, [settings?.listViewMode]);
  const [domainSyncErrors, setDomainSyncErrors] = useState<Record<string, string>>({});
  

  const t = translations[lang];

  const selectedCount = Object.keys(selected).filter(id => selected[id]).length;

  React.useEffect(() => {
    if (autoOpenCreate) {
      openAddModal();
      onAutoOpenHandled && onAutoOpenHandled();
    }
  }, [autoOpenCreate]);

  // 高亮域名时滚动到该元素
  
  // 检测滚动位置，当接近底部时使悬浮按钮半透明
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const nearBottom = docHeight - (scrollY + windowHeight) < 150;
      setIsNearBottom(nearBottom);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初始检测
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 新创建项目后滚动和高亮
  React.useEffect(() => {
    if (!newlyCreatedId) return;
    
    // 延迟执行以确保 DOM 已更新
    const timer = setTimeout(() => {
      const el = document.getElementById(viewMode === 'table' ? `domain-row-${newlyCreatedId}` : `domain-${newlyCreatedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-emerald-400', 'animate-pulse');
        
        // 3秒后移除高亮
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-emerald-400', 'animate-pulse');
          setNewlyCreatedId(null);
        }, 3000);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [newlyCreatedId]);


  React.useEffect(() => { if (highlightDomainId) {
      const el = document.getElementById(`domain-${highlightDomainId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightDomainId]);

  const toggleExpand = (id: string) => {
    setExpandedDomains(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
        if (revealedProviderPass[id] === undefined) {
          const { revealProviderPasswordApi } = await import('../services/apiClient');
          const p = await revealProviderPasswordApi(id);
          // 保存结果（空字符串表示密码为空）
          setRevealedProviderPass(prev => ({ ...prev, [id]: p || '' }));
        }
        // 显示密码区域
        setShowPasswordMap(prev => ({ ...prev, [id]: true }));
      } catch (e) {
        const { showToast } = await import('../utils/notify');
        showToast(lang==='zh' ? '无法显示密码' : 'Cannot reveal password', 'error');
      }
    })();
  };

  

  const handleDeleteClick = (id: string) => {
      setDeletingId(id);
  };

  const confirmDelete = () => {
      try {
        if(deletingId) {
            onUpdate(domains.filter(d => d.id !== deletingId));
            setDeletingId(null);
        }
      } catch {}
  };

  // 单个域名同步
  const handleSyncSingle = async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId)
    if (!domain) return
    
    setSyncingDomainIds(prev => new Set(prev).add(domainId))
    setDomainSyncErrors(prev => ({ ...prev, [domainId]: '' }))
    
    try {
      const api = await import('../services/apiClient')
      const result = await api.syncDomainDnsApi(domainId)
      onUpdate(domains.map(d => d.id === domainId ? result : d))
      showToast(lang==='zh' ? `${domain.name} 同步成功` : `${domain.name} synced`, 'success')
    } catch (e: any) {
      const errorMsg = e?.message || '同步失败'
      setDomainSyncErrors(prev => ({ ...prev, [domainId]: errorMsg }))
      showToast(lang==='zh' ? `${domain.name} 同步失败` : `${domain.name} sync failed`, 'error')
    } finally {
      setSyncingDomainIds(prev => {
        const next = new Set(prev)
        next.delete(domainId)
        return next
      })
    }
  }

  // 批量同步所有域名
  const handleSync = async () => {
    setSyncKind('all')
    setSyncResult(null)
    setSyncStatus('loading')
    setDomainSyncErrors({})
    
    startProgress(lang==='zh' ? '同步域名' : 'Sync Domains', domains.map(d => ({ id: d.id, name: d.name })), `${domains.length}`)
    
    const api = await import('../services/apiClient')
    const success: Domain[] = []
    const failed: { id: string; name?: string; error: string; details?: any }[] = []
    const limit = 3
    let idx = 0
    let active = 0
    
    // 标记所有正在同步的域名
    setSyncingDomainIds(new Set(domains.map(d => d.id)))
    
    await new Promise<void>((resolve) => {
      const next = () => {
        if (idx === domains.length && active === 0) return resolve()
        while (active < limit && idx < domains.length) {
          const d = domains[idx++]
          active++
          
          api.syncDomainDnsApi(d.id)
            .then((r: any) => { 
              success.push(r as Domain)
              updateProgress(d.id, 'success')
              // 从同步中移除
              setSyncingDomainIds(prev => {
                const next = new Set(prev)
                next.delete(d.id)
                return next
              })
            })
            .catch((e: any) => { 
              const err = e?.message || 'Unknown error'
              failed.push({ id: d.id, name: d.name, error: err, details: e })
              updateProgress(d.id, 'error', err)
              setDomainSyncErrors(prev => ({ ...prev, [d.id]: err }))
              // 从同步中移除
              setSyncingDomainIds(prev => {
                const next = new Set(prev)
                next.delete(d.id)
                return next
              })
            })
            .finally(() => { 
              active--
              next() 
            })
        }
      }
      next()
    })
    
    const map = new Map(success.map((d: any) => [d.id, d]))
    onUpdate(domains.map(d => map.get(d.id) || d))
    setSyncResult({ success, failed })
    setSyncStatus(failed.length === 0 ? 'success' : 'failed')
    finishProgress()
    
    // 显示结果摘要
    if (failed.length === 0) {
      showToast(lang==='zh' ? `全部 ${success.length} 个域名同步成功` : `All ${success.length} domains synced`, 'success')
    } else {
      showToast(
        lang==='zh' 
          ? `${success.length} 成功, ${failed.length} 失败` 
          : `${success.length} succeeded, ${failed.length} failed`, 
        'error'
      )
    }
    
    setTimeout(() => setSyncStatus('idle'), 2000)
  };

  // 批量同步选中的域名
  const handleSyncSelected = async () => {
    const ids = Object.keys(selected).filter(id => selected[id])
    if (ids.length === 0) return
    
    setSyncKind('selected')
    setSyncResult(null)
    setSyncStatus('loading')
    
    startProgress(
      lang==='zh' ? '同步选中域名' : 'Sync Selected Domains', 
      ids.map(id => ({ id, name: domains.find(d=>d.id===id)?.name })), 
      `${ids.length}`
    )
    
    const api = await import('../services/apiClient')
    const success: Domain[] = []
    const failed: { id: string; name?: string; error: string; details?: any }[] = []
    const limit = 3
    let idx = 0
    let active = 0
    
    // 标记选中的域名正在同步
    setSyncingDomainIds(new Set(ids))
    
    await new Promise<void>((resolve) => {
      const next = () => {
        if (idx === ids.length && active === 0) return resolve()
        while (active < limit && idx < ids.length) {
          const id = ids[idx++]
          const domain = domains.find(d => d.id === id)
          active++
          
          api.syncDomainDnsApi(id)
            .then((r: any) => { 
              success.push(r as Domain)
              updateProgress(id, 'success')
              setSyncingDomainIds(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
              })
            })
            .catch((e: any) => { 
              const err = e?.message || 'Unknown error'
              failed.push({ id, name: domain?.name, error: err, details: e })
              updateProgress(id, 'error', err)
              setDomainSyncErrors(prev => ({ ...prev, [id]: err }))
              setSyncingDomainIds(prev => {
                const next = new Set(prev)
                next.delete(id)
                return next
              })
            })
            .finally(() => { 
              active--
              next() 
            })
        }
      }
      next()
    })
    
    const map = new Map(success.map((d: any) => [d.id, d]))
    onUpdate(domains.map(d => map.get(d.id) || d))
    setSyncResult({ success, failed })
    setSyncStatus(failed.length === 0 ? 'success' : 'failed')
    finishProgress()
    
    if (failed.length === 0) {
      showToast(lang==='zh' ? `${success.length} 个域名同步成功` : `${success.length} domains synced`, 'success')
    } else {
      showToast(
        lang==='zh' 
          ? `${success.length} 成功, ${failed.length} 失败` 
          : `${success.length} succeeded, ${failed.length} failed`, 
        'error'
      )
    }
    
    setTimeout(() => setSyncStatus('idle'), 2000)
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDomain) return;

    if (editingDomain.id) {
      onUpdate(domains.map(d => d.id === editingDomain.id ? editingDomain : d));
      setIsModalOpen(false);
      setEditingDomain(null);
      showToast(lang==='zh' ? '已保存' : 'Saved', 'success');
    } else {
      const newId = `dom-${Date.now()}`;
      const newDomain = { ...editingDomain, id: newId, createdAt: Date.now(), sortOrder: domains.length };
      onUpdate([...domains, newDomain]);
      setIsModalOpen(false);
      setEditingDomain(null);
      setNewlyCreatedId(newId);
      showToast(lang==='zh' ? '已创建' : 'Created', 'success');
    }
  };

  const openAddModal = () => {
    setEditingDomain({ ...EmptyDomain, records: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (domain: Domain) => {
    setEditingDomain(JSON.parse(JSON.stringify(domain))); // Deep copy
    setIsModalOpen(true);
  };

  // Provider Helpers
  const getProviderInfo = (providerId?: string) => {
      if (!providerId) return null;
      return providers.find(p => p.id === providerId);
  }

  const handleProviderSelect = (type: 'registrar' | 'dns', providerId: string) => {
      if (!editingDomain) return;
      const provider = providers.find(p => p.id === providerId);
      if (type === 'registrar') {
          setEditingDomain({
              ...editingDomain,
              registrarProviderId: providerId || undefined,
              registrar: provider ? provider.name : editingDomain.registrar
          });
      } else {
           setEditingDomain({
              ...editingDomain,
              dnsProviderId: providerId || undefined,
              dnsProvider: provider ? provider.name : editingDomain.dnsProvider
          });
      }
  }

  // Record Management inside Modal
  const addRecord = () => {
      if(!editingDomain) return;
      setEditingDomain({
          ...editingDomain,
          records: [...editingDomain.records, { ...EmptyRecord, id: `rec-${Date.now()}` }]
      });
  }

  const removeRecord = (recordId: string) => {
      if(!editingDomain) return;
      setEditingDomain({
          ...editingDomain,
          records: editingDomain.records.filter(r => r.id !== recordId)
      })
  }

  const updateRecord = (index: number, field: keyof DNSRecord, value: any) => {
      if(!editingDomain) return;
      const newRecords = [...editingDomain.records];
      newRecords[index] = { ...newRecords[index], [field]: value };
      setEditingDomain({ ...editingDomain, records: newRecords });
  }

  const getExpirationStyle = (dateStr: string) => {
      if (!dateStr) return 'text-slate-600';
      const days = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (days < 0) return 'text-rose-600 font-bold';
      if (days < 30) return 'text-amber-600 font-bold';
      return 'text-emerald-600 font-semibold';
  };

  const getExpirationBadgeClass = (dateStr: string) => {
      if (!dateStr) return 'bg-slate-100 text-slate-700 border border-slate-200';
      const days = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (days < 0) return 'bg-rose-100 text-rose-700 border border-rose-200';
      if (days < 30) return 'bg-amber-100 text-amber-700 border border-amber-200';
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  };

  const getAutoRenewBadgeClass = (enabled: boolean) => {
      return enabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  const getStateBadgeClass = (s?: Domain['state']) => {
      switch (s) {
          case 'normal': return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
          case 'expiring_soon': return 'bg-amber-50 text-amber-700 border border-amber-100';
          case 'expired': return 'bg-rose-50 text-rose-700 border border-rose-100';
          case 'pending_delete': return 'bg-rose-50 text-rose-700 border border-rose-100';
          case 'redemption': return 'bg-violet-50 text-violet-700 border border-violet-100';
          case 'suspended': return 'bg-rose-50 text-rose-700 border border-rose-100';
          case 'no_dns': return 'bg-slate-100 text-slate-700 border border-slate-200';
          default: return 'bg-slate-100 text-slate-700 border border-slate-200';
      }
  };

  const CopyButton = ({ text, label, className }: { text: string; label?: string; className?: string }) => {
    const [copied, setCopied] = useState(false);
    const onClick = () => {
      import('../utils/clipboard').then(m => m.copyText(text)).then(ok => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1000); } }).catch(()=>{})
    };
    return (
      <button onClick={onClick} className={`${className || ''} flex items-center gap-1 text-xs px-2 py-1 rounded transition-all ${copied ? 'bg-emerald-50 text-emerald-700 scale-105' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
        {copied ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
        {label && <span>{label}</span>}
      </button>
    );
  };

  const ProviderCredentialsView = ({ provider, label }: { provider: Provider, label: string }) => (
      <div className="mt-2 p-3 bg-slate-100 rounded text-xs space-y-2 border border-slate-200">
          <div className="font-semibold text-slate-700 flex justify-between">
              {label}
              {provider.loginUrl && <a href={provider.loginUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">Open <ExternalLink className="w-3 h-3"/></a>}
          </div>
          <div className="flex items-center gap-2">
              <span className="text-slate-500 w-16">User:</span>
              <code className="bg-white px-1 rounded border border-slate-200">{provider.username}</code>
              <CopyButton text={provider.username} className="bg-transparent text-slate-400 hover:text-slate-600 px-1 py-0" />
          </div>
           <div className="flex items-center gap-2">
              <span className="text-slate-500 w-16">Pass:</span>
              <code className="bg-white px-1 rounded border border-slate-200 min-w-[50px]">
                   {(() => {
                     // 没有密码 → 显示 -
                     if (!provider.password && !provider.hasPassword) return '-';
                     const revealed = revealedProviderPass[provider.id];
                     // 已解密且为空 → 显示 -
                     if (revealed === '') return '-';
                     // 已解密且有值 → 显示明文
                     if (showPasswordMap[provider.id] && revealed) return revealed;
                     // 有密码但未解密 → 显示 ••••••
                     return '••••••';
                   })()}
              </code>
              <button onClick={() => togglePassword(provider.id)} className="text-slate-400 hover:text-slate-600">
                  {showPasswordMap[provider.id] ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
              </button>
              <button 
                onClick={async () => {
                  try {
                    let val = revealedProviderPass[provider.id];
                    if (!val) {
                      const { revealProviderPasswordApi } = await import('../services/apiClient');
                      const p = await revealProviderPasswordApi(provider.id);
                      if (p) {
                        val = p;
                        setRevealedProviderPass(prev => ({ ...prev, [provider.id]: p }));
                      }
                    }
                    if (val) {
                      const { copyText } = await import('../utils/clipboard');
                      await copyText(val);
                    } else {
                      console.warn('[Copy] 厂商密码为空');
                    }
                  } catch (e) {
                    console.error('[Copy] 复制失败:', e);
                  }
                }}
                className="bg-transparent text-slate-400 hover:text-slate-600 px-1 py-0 flex items-center gap-1"
              >
                <Copy className="w-3 h-3"/>
              </button>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {saveBanner && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg">Saved successfully</div>
      )}
      <div className={`flex flex-col md:flex-row md:justify-between md:items-center gap-3`}
      >
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.domainDns}</h2>
          <p className="text-slate-500 text-sm">{t.domainSubtitle}</p>
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
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button 
                  onClick={handleSync} 
                  disabled={syncStatus !== 'idle'}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all disabled:opacity-80 w-full md:w-auto shadow-sm hover:shadow-md
                      ${syncStatus === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                        syncStatus === 'failed' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 
                        'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                  {syncStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                   syncStatus === 'success' ? <Check className="w-4 h-4" /> :
                   syncStatus === 'failed' ? <X className="w-4 h-4" /> :
                   <RefreshCw className="w-4 h-4" />}
                  {syncStatus === 'loading' ? t.syncing :
                   syncStatus === 'success' ? t.syncSuccess :
                   syncStatus === 'failed' ? t.syncFailed :
                   t.syncDns}
              </button>
              <button 
                  onClick={handleSyncSelected}
                  disabled={syncStatus !== 'idle' || Object.keys(selected).filter(id => selected[id]).length === 0}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all disabled:opacity-60 w-full md:w-auto shadow-sm hover:shadow-md
                      ${syncStatus === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        syncStatus === 'failed' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}
              >
                  <RefreshCw className="w-4 h-4"/>
                  {t.syncSelected}
              </button>
              <button onClick={openAddModal} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 w-full md:w-auto">
                  <Plus className="w-4 h-4" /> {t.addDomain}
              </button>
          </div>
        )}
        </div>
      </div>

      {domains.length === 0 && (
        <div className="w-full min-h-[30vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 mb-3">
              <Globe className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-slate-900">{t.emptyTitle}</div>
              <div className="text-slate-500 text-sm">{t.emptyHint}</div>
            </div>
            <div className="mt-4">
              
            <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
                <Plus className="w-4 h-4" />{t.addDomain}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <DomainTableView
          domains={domains}
          servers={servers}
          lang={lang}
          selectedIds={selected}
          onSelect={(id, checked) => setSelected(prev => ({ ...prev, [id]: checked }))}
          onView={(d) => setViewingDomain(d)}
          onEdit={(d) => openEditModal(d)}
          onDelete={(id) => setDeletingId(id)}
          onSync={(id) => handleSyncSingle(id)}
          onServerClick={(serverId) => { onFocusServer(serverId); onNavigate('servers'); }}
          syncingIds={syncingDomainIds}
          syncErrors={domainSyncErrors}
          highlightId={newlyCreatedId || highlightDomainId}
          onReorder={onUpdate}
        />
      ) : (
      <SortableList
          items={sortByOrder(domains)}
          onReorder={onUpdate}
          layout="grid"
          gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-40"
          renderItem={(domain, dragHandleProps) => {
          const registrarInfo = getProviderInfo(domain.registrarProviderId);
          const dnsInfo = getProviderInfo(domain.dnsProviderId);
          const checked = !!selected[domain.id];
          const isSyncing = syncingDomainIds.has(domain.id);
          const syncError = domainSyncErrors[domain.id];
          const isHighlighted = highlightDomainId === domain.id;
          
          return (
            <div 
              id={`domain-${domain.id}`}
              key={domain.id} 
              className={`relative bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ${
                newlyCreatedId === domain.id
                  ? 'border-emerald-500 ring-4 ring-emerald-300 shadow-2xl scale-[1.02]'
                  : isHighlighted 
                    ? 'border-indigo-500 ring-4 ring-indigo-300 shadow-2xl scale-[1.02]' 
                    : isSyncing 
                    ? 'border-indigo-300 ring-2 ring-indigo-100' 
                    : syncError 
                      ? 'border-rose-300' 
                      : 'border-slate-200 hover:ring-1 hover:ring-slate-200'
              }`}
            >
              {/* 高亮动画效果 */}
              {isHighlighted && (
                <>
                  <div className="absolute -inset-2 rounded-2xl opacity-30 border-2 border-indigo-400 animate-ping" />
                  <div className="absolute inset-0 rounded-xl pointer-events-none shadow-[0_0_40px_rgba(79,70,229,0.35)]" />
                </>
              )}
              {/* 第一行：域名名称 */}
              <div className="flex items-center gap-2 min-w-0">
                <DragHandle {...dragHandleProps} className="flex-shrink-0 -ml-1" />
                <input type="checkbox" className="w-4 h-4 flex-shrink-0" checked={checked} onChange={e => setSelected(prev => ({ ...prev, [domain.id]: e.target.checked }))} />
                <div className="font-semibold text-slate-900 flex items-center gap-2 min-w-0 flex-1">
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0"/>
                  ) : (
                    <Globe className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                  )}
                  <span className="cursor-pointer hover:underline truncate" onClick={(e) => { e.stopPropagation(); setViewingDomain(domain); setIsViewFlipped(false); }}>{domain.name}</span>
                </div>
              </div>
              
              {/* 第二行：状态徽章 + 操作按钮 */}
              <div className="flex items-center justify-between -mt-1">
                <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded ${getStateBadgeClass(domain.state)}`}>{t[('state_' + (domain.state || 'unknown')) as keyof typeof t]}</span>
                <div className="flex items-center gap-0.5">
                  {/* 单个同步按钮 */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSyncSingle(domain.id); }} 
                    disabled={isSyncing}
                    className={`p-1.5 rounded-lg transition-all ${isSyncing ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} 
                    title={lang==='zh' ? '同步' : 'Sync'}
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setViewingDomain(domain); setIsViewFlipped(false); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4"/></button>
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(domain); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(domain.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              
              {/* 同步错误提示 */}
              {syncError && !isSyncing && (
                <div className="flex items-start gap-2 p-2 bg-rose-50 text-rose-700 rounded-lg text-xs border border-rose-100">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                  <div className="min-w-0">
                    <div className="font-medium">{lang==='zh' ? '同步失败' : 'Sync failed'}</div>
                    <div className="text-rose-600 truncate" title={syncError}>{syncError}</div>
                  </div>
                  <button 
                    onClick={() => setDomainSyncErrors(prev => ({ ...prev, [domain.id]: '' }))}
                    className="ml-auto text-rose-400 hover:text-rose-600"
                  >
                    <X className="w-3 h-3"/>
                  </button>
                </div>
              )}
              {/* 主要信息 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <div className="text-slate-500 text-xs mb-0.5">{t.registrar}</div>
                  <TruncatedText 
                    text={domain.registrar || ''} 
                    maxLength={18} 
                    maxWidth="100%"
                    className="text-slate-800 text-sm font-medium"
                    label={lang==='zh' ? '注册商' : 'Registrar'}
                    showCopy
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-slate-500 text-xs mb-0.5">{t.dnsProvider}</div>
                  <TruncatedText 
                    text={domain.dnsProvider || ''} 
                    maxLength={18} 
                    maxWidth="100%"
                    className="text-slate-800 text-sm font-medium"
                    label={lang==='zh' ? 'DNS 服务商' : 'DNS Provider'}
                    showCopy
                  />
                </div>
              </div>
              
              {/* 到期时间 */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-mono ${getExpirationBadgeClass(domain.expirationDate)}`}>
                  {domain.expirationDate || '-'}
                  {typeof domain.daysRemaining === 'number' && (
                    <span className="ml-1.5 opacity-70">
                      ({domain.daysRemaining > 0 ? '+' : ''}{domain.daysRemaining}{lang==='zh' ? '天' : 'd'})
                    </span>
                  )}
                </span>
              </div>
              
              {/* 状态标签行 */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* 自动续费 */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  domain.autoRenew 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <RefreshCw className="w-2.5 h-2.5" />
                  {domain.autoRenew ? (lang==='zh' ? '自动续费' : 'Auto-Renew') : (lang==='zh' ? '手动续费' : 'Manual')}
                </span>
                
                {/* 锁定状态 */}
                {domain.disableAutoOverwrite && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Lock className="w-2.5 h-2.5" />
                    {lang==='zh' ? '已锁定' : 'Locked'}
                  </span>
                )}
              </div>
              
              {/* 关联服务器 - Fixed height */}
              <div className="pt-2 border-t border-slate-100 min-h-[52px] relative">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">{lang==='zh' ? '关联服务器' : 'Linked Servers'}</div>
                {(() => {
                  const linkedServerIds = Array.from(new Set(domain.records.map(r => r.linkedServerId).filter(Boolean) as string[]));
                  const linkedServersList = linkedServerIds.map(id => servers.find(s => s.id === id)).filter(Boolean);
                  const isExpanded = expandedServers[domain.id];
                  const visibleServers = isExpanded ? linkedServersList : linkedServersList.slice(0, 2);
                  
                  return linkedServersList.length > 0 ? (
                    <>
                      <div className={`flex flex-wrap gap-1.5 ${!isExpanded && linkedServersList.length > 2 ? 'max-h-[28px] overflow-hidden' : ''}`}>
                        {visibleServers.map(s => (
                          <button 
                            key={s!.id} 
                            onClick={(e) => { e.stopPropagation(); onFocusServer(s!.id); onNavigate('servers'); }}
                            className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors cursor-pointer"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span className="font-medium truncate max-w-[60px]">{s!.name}</span>
                            <span className="text-indigo-500/70 truncate max-w-[80px]">({s!.ip})</span>
                          </button>
                        ))}
                      </div>
                      {linkedServersList.length > 2 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setExpandedServers(prev => ({ ...prev, [domain.id]: !prev[domain.id] })); }}
                          className={`absolute right-0 bottom-0 text-[10px] px-2 py-0.5 rounded-full transition-colors ${isExpanded ? 'bg-indigo-200 text-indigo-800' : 'bg-white text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
                        >
                          {isExpanded ? (lang==='zh' ? '收起' : 'Less') : `+${linkedServersList.length - 2}`}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">{lang==='zh' ? '无关联服务器' : 'No linked servers'}</span>
                  );
                })()}
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
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Domain</h3>
                    <p className="text-slate-500 text-sm mb-6">{t.deleteDomainConfirm}</p>
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

      {viewingDomain && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full sm:w-[90vw] md:w-[800px] lg:w-[960px] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="font-bold text-slate-900">{viewingDomain.name}</div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsViewFlipped(!isViewFlipped)} 
                  className="px-2 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5"
                  title={isViewFlipped ? (lang==='zh' ? '查看基本信息' : 'View Basic Info') : (lang==='zh' ? '查看 DNS 记录' : 'View DNS Records')}
                >
                  <Layers className="w-4 h-4"/>
                  <span className="text-xs hidden sm:inline">{isViewFlipped ? (lang==='zh' ? '基本信息' : 'Info') : (lang==='zh' ? 'DNS记录' : 'DNS')}</span>
                </button>
                <button onClick={() => setViewingDomain(null)} className="px-2 py-1 text-slate-600 hover:text-slate-900"><X className="w-5 h-5"/></button>
              </div>
            </div>
            <div className="p-0" style={{ perspective: '1000px' }}>
              <div className="relative" style={{ transformStyle: 'preserve-3d', transition: 'transform 400ms', transform: isViewFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', height: '60vh' }}>
                <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0, overflowY: 'auto' }} className="p-4">
                  {/* 锁定状态提示 */}
                  {viewingDomain.disableAutoOverwrite && (
                    <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 text-xs">
                      <Lock className="w-4 h-4" />
                      <span>{lang==='zh' ? '信息已锁定，同步时不会覆盖注册商、DNS服务商和到期时间' : 'Info locked, sync won\'t overwrite registrar, DNS provider and expiration'}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="min-w-0">
                      <div className="text-slate-500 text-xs mb-1">{t.registrar}</div>
                      <TruncatedText 
                        text={viewingDomain.registrar || ''} 
                        maxLength={32} 
                        className="text-slate-800 font-medium"
                        label={lang==='zh' ? '注册商' : 'Registrar'}
                        showCopy
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-slate-500 text-xs mb-1">{t.dnsProvider}</div>
                      <TruncatedText 
                        text={viewingDomain.dnsProvider || ''} 
                        maxLength={32} 
                        className="text-slate-800 font-medium"
                        label={lang==='zh' ? 'DNS 服务商' : 'DNS Provider'}
                        showCopy
                      />
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs mb-1">{t.expires}</div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm px-2 py-0.5 rounded ${getExpirationBadgeClass(viewingDomain.expirationDate)}`}>
                          {viewingDomain.expirationDate || '-'}
                        </span>
                        {typeof viewingDomain.daysRemaining === 'number' && (
                          <span className="text-xs text-slate-400">
                            ({viewingDomain.daysRemaining > 0 ? '+' : ''}{viewingDomain.daysRemaining}{lang==='zh' ? '天' : 'd'})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs mb-1">{t.autoRenew}</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${getAutoRenewBadgeClass(!!viewingDomain.autoRenew)}`}>
                        {viewingDomain.autoRenew ? t.enabled : t.disabled}
                      </span>
                    </div>
                  </div>
                  
                  {/* Name Servers */}
                  {viewingDomain.nameServers && viewingDomain.nameServers.length > 0 && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="text-xs font-medium text-slate-600 mb-2">Name Servers</div>
                      <div className="flex flex-wrap gap-1">
                        {viewingDomain.nameServers.map((ns, i) => (
                          <span key={i} className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-600">
                            {ns}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 space-y-2">
                    {getProviderInfo(viewingDomain.registrarProviderId) && (
                      <ProviderCredentialsView provider={getProviderInfo(viewingDomain.registrarProviderId)!} label={t.registrarCreds} />
                    )}
                    {getProviderInfo(viewingDomain.dnsProviderId) && (
                      <ProviderCredentialsView provider={getProviderInfo(viewingDomain.dnsProviderId)!} label={t.dnsCreds} />
                    )}
                  </div>
                </div>
                <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0, overflowY: 'auto' }} className="p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">{t.dnsRecords}</div>
                  <div className="space-y-2">
                    {viewingDomain.records.map(r => (
                      <div key={r.id} className="p-3 border border-slate-200 rounded-lg">
                        <div className="flex flex-wrap gap-2 text-xs items-center">
                          <span className="font-mono text-slate-700">{r.type}</span>
                          <span className="text-slate-700">{r.name}</span>
                          <span className="font-mono text-slate-500 break-all">{r.value}</span>
                          <span className="text-slate-500">TTL {r.ttl}</span>
                          <CopyButton text={r.value} label="复制值" />
                        </div>
                        <div className="mt-2">
                          {(() => {
                            const linkedServer = servers.find(s => s.id === r.linkedServerId);
                            if (!linkedServer) return <span className="text-slate-300 text-[11px]">{t.noLink}</span>;
                            return (
                              <button onClick={() => { onFocusServer(linkedServer.id); onNavigate('servers'); }} className="flex items-center gap-1 text-emerald-600 text-[11px] bg-emerald-50 px-2 py-1 rounded w-fit border border-emerald-100">
                                <LinkIcon className="w-3 h-3" />
                                <span className="font-semibold">{linkedServer.name}</span>
                                <span className="text-emerald-500/70">({linkedServer.ip})</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                    {viewingDomain.records.length === 0 && (
                      <div className="px-3 py-3 text-center text-slate-400 italic">{t.noRecords}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && editingDomain && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800">{editingDomain.id ? t.addDomain.replace('Add', 'Edit') : t.addDomain}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700">{t.domainName}</label>
                       <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900" 
                       value={editingDomain.name} onChange={e => setEditingDomain({...editingDomain, name: e.target.value})} placeholder="example.com"/>
                   </div>
                   <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700">{t.expires}</label>
                       <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900" 
                       value={editingDomain.expirationDate} onChange={e => setEditingDomain({...editingDomain, expirationDate: e.target.value})} />
                   </div>
                   {/* 状态设置卡片 */}
                   <div className="md:col-span-2 grid grid-cols-2 gap-3">
                     {/* 自动续费 */}
                     <button
                       type="button"
                       onClick={() => setEditingDomain({...editingDomain, autoRenew: !editingDomain.autoRenew})}
                       className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                         editingDomain.autoRenew 
                           ? 'border-emerald-400 bg-emerald-50' 
                           : 'border-slate-200 bg-white hover:border-slate-300'
                       }`}
                     >
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                         editingDomain.autoRenew 
                           ? 'bg-emerald-500 text-white' 
                           : 'bg-slate-100 text-slate-400'
                       }`}>
                         <RefreshCw className="w-5 h-5" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="font-medium text-slate-800">{lang==='zh' ? '自动续费' : 'Auto-Renew'}</div>
                         <div className="text-xs text-slate-500">{editingDomain.autoRenew ? (lang==='zh' ? '已开启自动续费' : 'Auto-renew enabled') : (lang==='zh' ? '手动续费' : 'Manual renewal')}</div>
                       </div>
                       <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                         editingDomain.autoRenew 
                           ? 'border-emerald-500 bg-emerald-500' 
                           : 'border-slate-300 bg-white'
                       }`}>
                         {editingDomain.autoRenew && <Check className="w-3 h-3 text-white" />}
                       </div>
                     </button>
                     
                     {/* 锁定同步 */}
                     <button
                       type="button"
                       onClick={() => setEditingDomain({...editingDomain, disableAutoOverwrite: !editingDomain.disableAutoOverwrite})}
                       className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                         editingDomain.disableAutoOverwrite 
                           ? 'border-amber-400 bg-amber-50' 
                           : 'border-slate-200 bg-white hover:border-slate-300'
                       }`}
                     >
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                         editingDomain.disableAutoOverwrite 
                           ? 'bg-amber-500 text-white' 
                           : 'bg-slate-100 text-slate-400'
                       }`}>
                         {editingDomain.disableAutoOverwrite ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="font-medium text-slate-800">{lang==='zh' ? '锁定信息' : 'Lock Info'}</div>
                         <div className="text-xs text-slate-500">{editingDomain.disableAutoOverwrite ? (lang==='zh' ? '同步时保留当前信息' : 'Preserve on sync') : (lang==='zh' ? '同步时自动更新' : 'Auto-update on sync')}</div>
                       </div>
                       <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                         editingDomain.disableAutoOverwrite 
                           ? 'border-amber-500 bg-amber-500' 
                           : 'border-slate-300 bg-white'
                       }`}>
                         {editingDomain.disableAutoOverwrite && <Check className="w-3 h-3 text-white" />}
                       </div>
                     </button>
                   </div>
                   
                   {/* 锁定提示 */}
                   {editingDomain.disableAutoOverwrite && (
                     <div className="md:col-span-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50/50 px-3 py-2 rounded-lg border border-amber-100">
                       <Info className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                       <span>{lang==='zh' ? '锁定后，域名同步将保留当前的注册商、DNS服务商和到期时间，仅更新DNS记录和状态。' : 'When locked, sync will preserve registrar, DNS provider and expiration date, only updating DNS records and status.'}</span>
                     </div>
                   )}
                   
                   {/* Registrar Section */}
                   <div className="md:col-span-1 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <label className="text-xs font-bold text-slate-500 uppercase">{t.registrar}</label>
                        <div className="relative">
                            <select 
                                className="appearance-none w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900 pr-8"
                                value={editingDomain.registrarProviderId || ''}
                                onChange={(e) => handleProviderSelect('registrar', e.target.value)}
                            >
                                <option value="">Manual Entry</option>
                                {providers.filter(p => p.categories.includes('domain')).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                        <input type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900" 
                           value={editingDomain.registrar} onChange={e => setEditingDomain({...editingDomain, registrar: e.target.value})} 
                           placeholder="Registrar Name"
                           disabled={!!editingDomain.registrarProviderId}
                        />
                   </div>

                   {/* DNS Provider Section */}
                   <div className="md:col-span-1 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <label className="text-xs font-bold text-slate-500 uppercase">{t.dnsProvider}</label>
                         <div className="relative">
                            <select 
                                className="appearance-none w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900 pr-8"
                                value={editingDomain.dnsProviderId || ''}
                                onChange={(e) => handleProviderSelect('dns', e.target.value)}
                            >
                                <option value="">Manual Entry</option>
                                {providers.filter(p => p.categories.includes('domain')).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                        <input type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900" 
                           value={editingDomain.dnsProvider} onChange={e => setEditingDomain({...editingDomain, dnsProvider: e.target.value})} 
                           placeholder="DNS Provider Name"
                           disabled={!!editingDomain.dnsProviderId}
                        />
                   </div>

               </div>

               <div className="border-t border-slate-100 pt-6">
                   <div className="flex justify-between items-center mb-4">
                       <h4 className="text-lg font-semibold text-slate-800">{t.dnsRecords}</h4>
                       <button type="button" onClick={addRecord} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3"/> Add Record</button>
                   </div>
                   
                   <div className="space-y-2">
                       {editingDomain.records.map((record, index) => {
                           const activeServer = servers.find(s => s.id === record.linkedServerId);
                           
                           return (
                           <div key={record.id || index} className="flex flex-col gap-2 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                               <div className="grid grid-cols-1 md:grid-cols-12 gap-2 w-full">
                                    <div className="relative md:col-span-2">
                                        <select className="appearance-none w-full md:w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900 pr-6"
                                                value={record.type} onChange={e => updateRecord(index, 'type', e.target.value)}>
                                            <option value="A">A</option>
                                            <option value="CNAME">CNAME</option>
                                            <option value="MX">MX</option>
                                            <option value="TXT">TXT</option>
                                            <option value="NS">NS</option>
                                        </select>
                                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                    </div>
                                    <input type="text" className="w-full md:col-span-3 border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900" placeholder="Name (@)"
                                            value={record.name} onChange={e => updateRecord(index, 'name', e.target.value)} />
                                    <input type="text" className="w-full md:col-span-5 border border-slate-300 rounded px-2 py-1.5 text-sm font-mono bg-white text-slate-900 min-w-0" placeholder="Value (IP or Domain)"
                                            value={record.value} onChange={e => updateRecord(index, 'value', e.target.value)} />
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-12 gap-2 w-full items-start">
                                    <div className="md:col-span-8">
                                        <div className="relative">
                                            <select className={`appearance-none w-full border rounded px-2 py-1.5 text-sm bg-white text-slate-900 pr-6 ${activeServer ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-300'}`}
                                                value={record.linkedServerId || ''} onChange={e => updateRecord(index, 'linkedServerId', e.target.value === '' ? undefined : e.target.value)}>
                                                <option value="">{t.noLink}</option>
                                                {servers.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                        </div>
                                        {activeServer && (
                                            <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                                <Check className="w-3 h-3"/> {t.activeLink}
                                            </div>
                                        )}
                                    </div>
                                    <div className="md:col-span-4 flex md:justify-end">
                                        <button type="button" onClick={() => removeRecord(record.id)} className="p-2 text-slate-400 hover:text-rose-600"><X className="w-4 h-4"/></button>
                                    </div>
                               </div>
                           </div>
                       )})}
                       {editingDomain.records.length === 0 && (
                           <p className="text-center text-slate-400 py-4 text-sm">{t.noRecords}</p>
                       )}
                   </div>
               </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg">{t.cancel}</button>
                 <button onClick={handleSave} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">{t.saveChanges}</button>
            </div>
          </div>
        </div>
      )}
      {(settings?.actionButtonsLayout ?? 'floating') === 'floating' && (
        <div className={`fixed sm:bottom-6 sm:right-6 bottom-3 right-3 z-40 flex flex-col gap-2 transition-opacity duration-300 ${isNearBottom ? 'opacity-40 hover:opacity-100' : 'opacity-100'}`}>
          <button 
            onClick={handleSync}
            disabled={syncStatus !== 'idle'}
            className={`rounded-full shadow ring-1 ring-indigo-200 bg-indigo-600 text-white flex items-center justify-center sm:w-12 sm:h-12 w-10 h-10 hover:scale-105 active:scale-95 transition-transform ${syncStatus === 'loading' ? 'animate-pulse' : ''}`}
            title={t.syncDns}
            aria-label={t.syncDns}
          >
            <RefreshCw className={`sm:w-5 sm:h-5 w-4 h-4 ${syncStatus === 'loading' ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleSyncSelected}
            disabled={syncStatus !== 'idle' || selectedCount === 0}
            className={`relative rounded-full shadow ring-1 ring-violet-200 ${selectedCount > 0 ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700'} flex items-center justify-center sm:w-12 sm:h-12 w-10 h-10 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 ${syncStatus === 'loading' ? 'animate-pulse' : ''}`}
            title={t.syncSelected}
            aria-label={t.syncSelected}
          >
            <ListChecks className="sm:w-5 sm:h-5 w-4 h-4" />
            {selectedCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-white text-violet-700 text-[10px] font-bold flex items-center justify-center shadow ring-1 ring-violet-200">{selectedCount}</span>
            )}
          </button>
          <button 
            onClick={openAddModal} 
            className="rounded-full shadow ring-1 ring-emerald-200 bg-emerald-600 text-white flex items-center justify-center sm:w-12 sm:h-12 w-10 h-10 hover:scale-105 active:scale-95 transition-transform" 
            title={t.addDomain}
            aria-label={t.addDomain}
          >
            <Plus className="sm:w-5 sm:h-5 w-4 h-4" />
          </button>
        </div>
      )}

      {/* Unified visuals handled by NotifyHost and per-action toasts */}
    </div>
  );
};
