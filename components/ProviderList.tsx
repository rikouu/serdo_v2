
import React, { useState, useEffect } from 'react';
import { Provider, Language, SystemSettings } from '../types';
import { Edit2, Trash2, Plus, ExternalLink, Copy, Check, X, Wallet, Eye, EyeOff, ChevronDown, AlertTriangle, LayoutGrid, List, Briefcase, Search } from 'lucide-react';
import { translations } from '../utils/translations';
import { ProviderTableView } from './TableView';
import { SortableList, DragHandle, sortByOrder, DragHandleProps } from './SortableList';
import { showToast } from '../utils/notify';

interface ProviderListProps {
  providers: Provider[];
  lang: Language;
  onUpdate: (providers: Provider[]) => void;
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
  settings?: SystemSettings | null;
}

const EmptyProvider: Provider = {
  id: '',
  name: '',
  loginUrl: '',
  username: '',
  password: '',
  categories: ['server'],
  paymentMethod: 'Other',
  paymentAccount: ''
};

export const ProviderList: React.FC<ProviderListProps> = ({ providers, lang, onUpdate, autoOpenCreate, onAutoOpenHandled, settings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>(settings?.listViewMode || 'card');

  useEffect(() => {
    if (settings?.listViewMode) {
      setViewMode(settings.listViewMode);
    }
  }, [settings?.listViewMode]);
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [revealedPass, setRevealedPass] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState<boolean>(false);
  const [showEditPass, setShowEditPass] = useState<boolean>(false);
  const [showPaymentAccountMap, setShowPaymentAccountMap] = useState<Record<string, boolean>>({});
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  const t = translations[lang];

  
  // 检测滚动位置
  React.useEffect(() => {
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
      const el = document.getElementById(viewMode === 'table' ? `provider-row-${newlyCreatedId}` : `provider-${newlyCreatedId}`);
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


  React.useEffect(() => { if (autoOpenCreate) {
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
        if (revealedPass[id] === undefined) { 
          const { revealProviderPasswordApi } = await import('../services/apiClient'); 
          const p = await revealProviderPasswordApi(id); 
          // 保存结果（空字符串表示密码为空）
          setRevealedPass(prev => ({ ...prev, [id]: p || '' }))
        }
        // 显示密码区域
        setShowPasswordMap(prev => ({ ...prev, [id]: true }));
      } catch (e) {
        const { showToast } = await import('../utils/notify');
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
        if(deletingId) {
            onUpdate(providers.filter(p => p.id !== deletingId));
            setDeletingId(null);
            showToast(lang==='zh' ? '已删除' : 'Deleted', 'success')
        }
      } catch (e: any) {
        setErrorBanner(String(e?.message || '操作失败'))
        showToast(lang==='zh' ? '操作失败' : 'Operation failed', 'error')
      }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    if (editingProvider.id) {
      onUpdate(providers.map(p => p.id === editingProvider.id ? editingProvider : p));
      setIsModalOpen(false);
      setEditingProvider(null);
      showToast(lang==='zh' ? '已保存' : 'Saved', 'success');
    } else {
      const newId = `prov-${Date.now()}`;
      const newProvider = { ...editingProvider, id: newId, createdAt: Date.now(), sortOrder: providers.length };
      onUpdate([...providers, newProvider]);
      setIsModalOpen(false);
      setEditingProvider(null);
      setNewlyCreatedId(newId);
      showToast(lang==='zh' ? '已创建' : 'Created', 'success');
    }
  };

  const openAddModal = () => {
    setEditingProvider({ ...EmptyProvider });
    setIsModalOpen(true);
  };

  const openEditModal = (provider: Provider) => {
    setEditingProvider(JSON.parse(JSON.stringify(provider)));
    setIsModalOpen(true);
    (async () => {
      try {
        const { revealProviderPasswordApi } = await import('../services/apiClient')
        const p = await revealProviderPasswordApi(provider.id)
        // 只在解密成功时更新密码字段
        if (p && p.trim() !== '') {
          setEditingProvider(prev => prev ? ({ ...prev, password: p }) : prev)
        }
      } catch (e) {
        // 解密失败，保留原有的占位符或空值
        console.error('Failed to reveal provider password:', e);
      }
    })()
  };

  const toggleCategory = (category: 'server' | 'domain') => {
    if (!editingProvider) return;
    const cats = editingProvider.categories.includes(category)
      ? editingProvider.categories.filter(c => c !== category)
      : [...editingProvider.categories, category];
    setEditingProvider({ ...editingProvider, categories: cats });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {saveBanner && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg">Saved successfully</div>
      )}
      {errorBanner && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{errorBanner}</div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.providersManagement}</h2>
          <p className="text-slate-500 text-sm">{t.providersSubtitle}</p>
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
          
          {/* Add Provider Button (if not floating) */}
          {(settings?.actionButtonsLayout ?? 'floating') !== 'floating' && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
          >
            <Plus className="w-4 h-4" /> {t.addProvider}
          </button>
        )}
        </div>
      </div>

      {providers.length === 0 && (
        <div className="w-full min-h-[30vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 mb-3">
              <Wallet className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-slate-900">{t.emptyTitle}</div>
              <div className="text-slate-500 text-sm">{t.emptyHint}</div>
            </div>
            <div className="mt-4">
              <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
                <Plus className="w-4 h-4" />{t.addProvider}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <ProviderTableView
          providers={providers}
          lang={lang}
          onEdit={(p) => { setEditingProvider(p); setIsModalOpen(true); }}
          onDelete={(id) => setDeletingId(id)}
          onReorder={onUpdate}
          highlightId={newlyCreatedId}
        />
      ) : (
      <SortableList
          items={sortByOrder(providers)}
          onReorder={onUpdate}
          layout="grid"
          gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-40"
          renderItem={(provider, dragHandleProps) => (
          <div id={`provider-${provider.id}`} key={provider.id} className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${newlyCreatedId === provider.id ? 'border-emerald-500 ring-4 ring-emerald-300 shadow-2xl scale-[1.02]' : 'border-slate-200'}`}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div className="flex items-start gap-2">
                <DragHandle {...dragHandleProps} className="flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">{provider.name}</h3>
                <div className="flex gap-1 mt-1">
                  {provider.categories.map(cat => (
                    <span key={cat} className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                      {cat === 'server' ? t.servers : t.domains}
                    </span>
                  ))}
                </div>
              </div>
                </div>
              <div className="flex gap-1">
                <button onClick={() => openEditModal(provider)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteClick(provider.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t.loginUrl}</span>
                  {provider.loginUrl ? (
                    <a href={provider.loginUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      Link <ExternalLink className="w-3 h-3"/>
                    </a>
                  ) : <span className="text-slate-300">-</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t.username}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono bg-slate-50 px-1.5 rounded truncate max-w-[55%] md:max-w-[12rem]" title={provider.username || ''}>{provider.username || '-'}</span>
                    <button onClick={() => copyToClipboard(provider.username, `${provider.id}-user`)} className="text-slate-400 hover:text-slate-600">
                      {copiedMap[`${provider.id}-user`] ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t.password}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono bg-slate-50 px-1.5 rounded min-w-[60px] text-center truncate max-w-[55%] md:max-w-[12rem]" title={showPasswordMap[provider.id] ? (revealedPass[provider.id] || '') : ''}>
                      {(() => {
                        // 没有密码 → 显示 -
                        if (!provider.password && !provider.hasPassword) return '-';
                        const revealed = revealedPass[provider.id];
                        // 已解密且为空 → 显示 -
                        if (revealed === '') return '-';
                        // 已解密且有值 → 显示明文
                        if (showPasswordMap[provider.id] && revealed) return revealed;
                        // 有密码但未解密 → 显示 ••••••
                        return '••••••';
                      })()}
                    </span>
                    <button onClick={() => togglePassword(provider.id)} className="text-slate-400 hover:text-slate-600">
                       {showPasswordMap[provider.id] ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                    </button>
                    <button onClick={async () => { try { let val = revealedPass[provider.id]; if (!val) { const { revealProviderPasswordApi } = await import('../services/apiClient'); const p = await revealProviderPasswordApi(provider.id); if (p) { val = p; setRevealedPass(prev => ({ ...prev, [provider.id]: p })) } } if (val) { copyToClipboard(val, `${provider.id}-pass`) } else { console.warn('[Copy] 厂商密码为空') } } catch (e) { console.error('[Copy] 复制失败:', e) } }} className="text-slate-400 hover:text-slate-600">
                      {copiedMap[`${provider.id}-pass`] ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium mb-1">
                  <Wallet className="w-4 h-4 text-slate-400"/> {t.paymentMethod}
                </div>
                <div className="flex justify-between items-center text-sm min-w-0">
                   <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs border border-indigo-100">
                     {t[provider.paymentMethod as keyof typeof t] || provider.paymentMethod}
                   </span>
                   <div className="flex items-center gap-2 min-w-0">
                     <span className="font-mono text-slate-700 bg-white px-1.5 rounded border border-slate-200 text-xs py-0.5 min-w-[60px] text-center truncate max-w-[55%] md:max-w-[12rem]" title={showPaymentAccountMap[provider.id] ? (provider.paymentAccount || '') : ''}>
                       {showPaymentAccountMap[provider.id] ? (provider.paymentAccount || '-') : '••••••'}
                     </span>
                     <button onClick={() => setShowPaymentAccountMap(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))} className="text-slate-400 hover:text-slate-600" title={showPaymentAccountMap[provider.id] ? 'Hide' : 'Show'}>
                       {showPaymentAccountMap[provider.id] ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                     </button>
                     <button onClick={() => copyToClipboard(provider.paymentAccount || '', `${provider.id}-payacc`)} className="text-slate-400 hover:text-slate-600" title="Copy">
                       {copiedMap[`${provider.id}-payacc`] ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                     </button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
                      <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Provider</h3>
                      <p className="text-slate-500 text-sm mb-6">{t.deleteProviderConfirm}</p>
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

      {isModalOpen && editingProvider && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800">{editingProvider.id ? t.editProvider : t.addProvider}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">{t.providerName}</label>
                <input required type="text" className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  value={editingProvider.name} onChange={e => setEditingProvider({...editingProvider, name: e.target.value})} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">{t.loginUrl}</label>
                <input type="url" className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  value={editingProvider.loginUrl} onChange={e => setEditingProvider({...editingProvider, loginUrl: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.username}</label>
                  <input type="text" className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                    value={editingProvider.username} onChange={e => setEditingProvider({...editingProvider, username: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.password}</label>
                  <div className="mt-1 relative">
                    <input type={showEditPass ? 'text' : 'password'} className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 bg-white text-slate-900"
                      value={editingProvider.password || ''} onChange={e => setEditingProvider({...editingProvider, password: e.target.value})} />
                    <button type="button" onClick={() => setShowEditPass(v => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md border border-slate-300" aria-label={showEditPass ? 'Hide' : 'Show'}>
                      {showEditPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">{t.categories}</label>
                <div className="flex gap-4">
                   <label className="flex items-center gap-2 cursor-pointer">
                     <input type="checkbox" checked={editingProvider.categories.includes('server')} onChange={() => toggleCategory('server')} className="rounded text-slate-900 focus:ring-slate-900"/>
                     <span className="text-sm text-slate-700">{t.servers}</span>
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer">
                     <input type="checkbox" checked={editingProvider.categories.includes('domain')} onChange={() => toggleCategory('domain')} className="rounded text-slate-900 focus:ring-slate-900"/>
                     <span className="text-sm text-slate-700">{t.domains}</span>
                   </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                   <label className="text-sm font-medium text-slate-700">{t.paymentMethod}</label>
                   <div className="relative">
                      <select className="appearance-none w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 pr-8"
                          value={editingProvider.paymentMethod} onChange={e => setEditingProvider({...editingProvider, paymentMethod: e.target.value as any})}>
                          <option value="CreditCard">{t.CreditCard}</option>
                          <option value="PayPal">{t.PayPal}</option>
                          <option value="Alipay">{t.Alipay}</option>
                          <option value="WeChat">{t.WeChat}</option>
                          <option value="Other">{t.Other}</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                   </div>
                </div>
                <div>
                   <label className="text-sm font-medium text-slate-700">{t.paymentAccount}</label>
                   <input type="text" className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900" placeholder="Last 4 digits..."
                    value={editingProvider.paymentAccount} onChange={e => setEditingProvider({...editingProvider, paymentAccount: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">{t.saveProvider}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 悬浮按钮 */}
      {(settings?.actionButtonsLayout ?? 'floating') === 'floating' && (
        <div className={`fixed sm:bottom-6 sm:right-6 bottom-3 right-3 z-40 flex flex-col gap-2 transition-opacity duration-300 ${isNearBottom ? 'opacity-40 hover:opacity-100' : 'opacity-100'}`}>
          <button
            onClick={openAddModal}
            className="rounded-full shadow ring-1 ring-emerald-200 bg-emerald-600 text-white flex items-center justify-center sm:w-12 sm:h-12 w-10 h-10 hover:scale-105 active:scale-95 transition-transform"
            title={t.addProvider}
            aria-label={t.addProvider}
          >
            <Plus className="sm:w-5 sm:h-5 w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
  
