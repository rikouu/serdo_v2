import React, { useState } from 'react';
import { Domain, Server, Provider, Language } from '../types';
import { Edit2, Trash2, Eye, EyeOff, RefreshCw, Terminal, Globe, Server as ServerIcon, Briefcase, Lock, Check, X, ExternalLink, Link as LinkIcon, Copy, Wifi, AlertCircle, Loader2, User, ChevronDown, ChevronRight, Command } from 'lucide-react';
import { translations } from '../utils/translations';
import { TruncatedText, CompactText } from './TruncatedText';
import { SortableTable, SortableTableRow, sortByOrder } from './SortableList';
import { GripVertical } from 'lucide-react';

// 域名表格视图
interface DomainTableViewProps {
  domains: Domain[];
  servers: Server[];
  lang: Language;
  selectedIds: Record<string, boolean>;
  onSelect: (id: string, checked: boolean) => void;
  onView: (domain: Domain) => void;
  onEdit: (domain: Domain) => void;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
  onServerClick?: (serverId: string) => void;
  syncingIds: Set<string>;
  syncErrors?: Record<string, string>;
  highlightId?: string;
  onReorder?: (domains: Domain[]) => void;
}

export const DomainTableView: React.FC<DomainTableViewProps> = ({
  domains, servers, lang, selectedIds, onSelect, onView, onEdit, onDelete, onSync, onServerClick, syncingIds, syncErrors = {}, highlightId, onReorder
}) => {
  const sortedDomains = React.useMemo(() => sortByOrder(domains), [domains]);
  const t = translations[lang];
  const [expandedLinked, setExpandedLinked] = useState<Record<string, boolean>>({});
  
  const getStateColor = (state?: string) => {
    switch (state) {
      case 'normal': return 'bg-emerald-100 text-emerald-700';
      case 'expiring_soon': return 'bg-amber-100 text-amber-700';
      case 'expired': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getLinkedServers = (domain: Domain) => {
    const serverIds = new Set(domain.records.map(r => r.linkedServerId).filter(Boolean));
    return servers.filter(s => serverIds.has(s.id));
  };

  const allSelected = domains.length > 0 && domains.every(d => selectedIds[d.id]);
  const someSelected = domains.some(d => selectedIds[d.id]) && !allSelected;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-40">
      <div className="overflow-x-auto">
        <SortableTable items={sortedDomains} onReorder={onReorder || (() => {})} disabled={!onReorder}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {onReorder && <th className="w-8"></th>}
                <th className="w-10 px-3 py-3">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={(e) => domains.forEach(d => onSelect(d.id, e.target.checked))}
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.domainName}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.registrar}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">DNS</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.expires}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{lang==='zh' ? '状态' : 'Status'}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{lang==='zh' ? '关联' : 'Linked'}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">{lang==='zh' ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {sortedDomains.map(domain => {
              const linkedServers = getLinkedServers(domain);
              const isHighlighted = highlightId === domain.id;
              const highlightClass = isHighlighted ? 'bg-indigo-50 animate-pulse' : '';
              const isSyncing = syncingIds.has(domain.id);
              const syncError = syncErrors[domain.id];

              const isExpanded = !!expandedLinked[domain.id];
              const visibleServers = isExpanded ? linkedServers : linkedServers.slice(0, 2);
              
              return (
                <SortableTableRow 
                  key={domain.id}
                  id={domain.id}
                  disabled={!onReorder}
                >
                  <td 
                    id={`domain-row-${domain.id}`}
                    className={`px-3 py-3 ${
                      isHighlighted ? 'bg-indigo-50' : 
                      syncError ? 'bg-rose-50/50' : ''
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300"
                      checked={!!selectedIds[domain.id]}
                      onChange={(e) => onSelect(domain.id, e.target.checked)}
                    />
                  </td>
                  <td className={`px-4 py-3 ${highlightClass}`}>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span 
                        className="font-medium text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onView(domain); }}
                      >
                        {domain.name}
                      </span>
                      {domain.autoRenew && (
                        <span title={lang==='zh' ? '自动续费' : 'Auto-Renew'}>
                          <RefreshCw className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        </span>
                      )}
                      {domain.disableAutoOverwrite && (
                        <span title={lang==='zh' ? '锁定同步' : 'Sync Locked'}>
                          <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${highlightClass}`}>
                    <CompactText text={domain.registrar || '-'} maxLength={18} className="text-slate-600" />
                  </td>
                  <td className={`px-4 py-3 ${highlightClass}`}>
                    <CompactText text={domain.dnsProvider || '-'} maxLength={18} className="text-slate-600" />
                  </td>
                  <td className={`px-4 py-3 ${highlightClass}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-700 text-xs">{domain.expirationDate || '-'}</span>
                      {typeof domain.daysRemaining === 'number' && (
                        <span className={`text-xs px-1 py-0.5 rounded ${
                          domain.daysRemaining <= 30 ? 'bg-rose-100 text-rose-600' :
                          domain.daysRemaining <= 90 ? 'bg-amber-100 text-amber-600' :
                          'text-slate-400'
                        }`}>
                          {domain.daysRemaining}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${highlightClass}`}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStateColor(domain.state)}`}>
                      {t[('state_' + (domain.state || 'unknown')) as keyof typeof t] || domain.state || 'Unknown'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${highlightClass}`}>
                    {linkedServers.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {visibleServers.map(s => (
                          <button
                            key={s.id}
                            onClick={(e) => { e.stopPropagation(); onServerClick?.(s.id); }}
                            className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                          >
                            <LinkIcon className="w-2.5 h-2.5" />
                            {s.name}
                          </button>
                        ))}
                        {linkedServers.length > 2 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedLinked(prev => ({ ...prev, [domain.id]: !isExpanded })); }}
                            className="text-xs text-slate-500 hover:text-indigo-700 px-1 py-0.5 rounded transition-colors font-medium"
                          >
                            {isExpanded ? (lang === 'zh' ? '收起' : 'Less') : `+${linkedServers.length - 2}`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${highlightClass}`}>
                    <div className="flex items-center justify-end gap-0.5">
                      {syncError && (
                        <span className="text-rose-500 mr-1" title={syncError}>
                          <AlertCircle className="w-4 h-4" />
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onSync(domain.id); }}
                        disabled={isSyncing}
                        className={`p-1.5 rounded transition-all ${isSyncing ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                        title={lang==='zh' ? '同步WHOIS' : 'Sync WHOIS'}
                      >
                        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onView(domain); }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-all"
                        title={lang==='zh' ? '查看详情' : 'View Details'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(domain); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title={lang==='zh' ? '编辑' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(domain.id); }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                        title={lang==='zh' ? '删除' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </SortableTableRow>

              );
            })}
            </tbody>
          </table>
        </SortableTable>
      </div>
      {domains.length === 0 && (
        <div className="p-12 text-center text-slate-400">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{lang==='zh' ? '暂无域名数据' : 'No domains yet'}</p>
        </div>
      )}
    </div>
  );
};

// 服务器表格视图
interface ServerTableViewProps {
  servers: Server[];
  domains: Domain[];
  lang: Language;
  onEdit: (server: Server) => void;
  onDelete: (id: string) => void;
  onTerminal: (server: Server) => void;
  onPing?: (server: Server) => void;
  onDomainClick?: (domainId: string) => void;
  highlightId?: string;
  pingLoading?: Record<string, boolean>;
  pingLatency?: Record<string, number | null>;
  pingError?: Record<string, string>;
  onReorder?: (servers: Server[]) => void;
}

export const ServerTableView: React.FC<ServerTableViewProps> = ({
  servers, domains, lang, onEdit, onDelete, onTerminal, onPing, onDomainClick, highlightId,
  pingLoading = {}, pingLatency = {}, pingError = {}, onReorder
}) => {
  const t = translations[lang];
  const sortedServers = React.useMemo(() => sortByOrder(servers), [servers]);
  const [expandedLinkedDomains, setExpandedLinkedDomains] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [revealedPanelPass, setRevealedPanelPass] = useState<Record<string, string>>({});
  const [revealedSshPass, setRevealedSshPass] = useState<Record<string, string>>({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-emerald-100 text-emerald-700';
      case 'stopped': return 'bg-slate-100 text-slate-700';
      case 'expired': return 'bg-rose-100 text-rose-700';
      case 'maintenance': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getLinkedDomains = (serverId: string) => {
    return domains.filter(d => d.records.some(r => r.linkedServerId === serverId));
  };

  const handleCopyIP = async (ip: string, serverId: string) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedId(serverId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <SortableTable items={sortedServers} onReorder={onReorder || (() => {})} disabled={!onReorder}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {onReorder && <th className="w-8 px-2"></th>}
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">{lang==='zh' ? '服务器名称' : 'Server Name'}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">IP</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">Provider</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">{t.region}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">OS</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">{lang==='zh' ? '配置' : 'Specs'}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">{t.expires}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">{lang==='zh' ? '状态' : 'Status'}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">{lang==='zh' ? '关联' : 'Linked'}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">{lang==='zh' ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {sortedServers.map(server => {
              const linkedDomains = getLinkedDomains(server.id);
              const isHighlighted = highlightId === server.id;
              const highlightClass = isHighlighted ? 'bg-indigo-50 animate-pulse' : '';
              const isExpandedLinked = !!expandedLinkedDomains[server.id];
              const visibleDomains = isExpandedLinked ? linkedDomains : linkedDomains.slice(0, 2);
              const isPinging = pingLoading[server.id];
              const latency = pingLatency[server.id];
              const pError = pingError[server.id];
              const isCopied = copiedId === server.id;
              const isExpanded = !!expandedRows[server.id];
              
              return (
                <React.Fragment key={server.id}>
                <SortableTableRow 
                  id={server.id}
                  disabled={!onReorder}
                >
                  <td 
                    className={`px-4 py-3 border-b border-slate-100 ${highlightClass} cursor-pointer hover:bg-indigo-50 transition-colors`}
                    onClick={(e) => { e.stopPropagation(); setExpandedRows(prev => ({ ...prev, [server.id]: !isExpanded })); }}
                    title={isExpanded ? (lang==='zh' ? '点击收起详情' : 'Click to collapse') : (lang==='zh' ? '点击展开详情' : 'Click to expand')}
                  >
                    <div className="flex items-center gap-2">
                      <ServerIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-900 whitespace-nowrap">{server.name}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    </div>
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <div className="flex items-center gap-1.5 group">
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700 whitespace-nowrap">{server.ip}</code>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyIP(server.ip, server.id); }}
                        className="p-1 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                        title={lang==='zh' ? '复制IP' : 'Copy IP'}
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <CompactText text={server.provider || '-'} maxLength={14} className="text-slate-600" />
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <span className="text-slate-600 text-xs whitespace-nowrap">{server.region || '-'}</span>
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <span className="text-slate-500 text-xs whitespace-nowrap">{server.os || '-'}</span>
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {server.cpu && <div className="whitespace-nowrap">CPU: {server.cpu}</div>}
                      {server.ram && <div className="whitespace-nowrap">RAM: {server.ram}</div>}
                      {server.disk && <div className="whitespace-nowrap">Disk: {server.disk}</div>}
                      {!server.cpu && !server.ram && !server.disk && <span className="text-slate-300">-</span>}
                    </div>
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <span className="font-mono text-slate-700 text-xs whitespace-nowrap">{server.expirationDate || '-'}</span>
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(server.status)}`}>
                        {t[server.status as keyof typeof t] || server.status}
                      </span>
                      {latency !== undefined && latency !== null && (
                        <span className="text-xs text-emerald-600 font-mono whitespace-nowrap">{latency}ms</span>
                      )}
                      {pError && (
                        <span className="text-xs text-rose-500" title={pError}>
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    {linkedDomains.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {visibleDomains.map(d => (
                          <button
                            key={d.id}
                            onClick={(e) => { e.stopPropagation(); onDomainClick?.(d.id); }}
                            className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                          >
                            <Globe className="w-2.5 h-2.5" />
                            {d.name}
                          </button>
                        ))}
                        {linkedDomains.length > 2 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedLinkedDomains(prev => ({ ...prev, [server.id]: !isExpandedLinked })); }}
                            className="text-xs text-slate-500 hover:text-indigo-700 px-1 py-0.5 rounded transition-colors font-medium whitespace-nowrap"
                          >
                            {isExpandedLinked ? (lang === 'zh' ? '收起' : 'Less') : `+${linkedDomains.length - 2}`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 border-b border-slate-100 ${highlightClass}`}>
                    <div className="flex items-center justify-end gap-0.5">
                      {onPing && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onPing(server); }}
                          disabled={isPinging}
                          className={`p-1.5 rounded transition-all ${isPinging ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          title={lang==='zh' ? 'Ping测试' : 'Ping Test'}
                        >
                          {isPinging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onTerminal(server); }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                        title="SSH"
                      >
                        <Terminal className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(server); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title={lang==='zh' ? '编辑' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(server.id); }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                        title={lang==='zh' ? '删除' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </SortableTableRow>
                
                {/* 展开行 - 显示详细信息 */}
                {isExpanded && (
                  <tr className="bg-slate-50">
                    <td colSpan={onReorder ? 11 : 10} className="px-4 py-4 border-b border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {/* Panel 信息 */}
                        <div className="bg-white rounded-lg p-4 border border-slate-200 h-[200px] flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <Globe className="w-4 h-4 text-indigo-500" />
                            <span className="font-semibold text-slate-700">{lang==='zh' ? '面板信息' : 'Panel Info'}</span>
                          </div>
                          <div className="space-y-2 flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 text-xs whitespace-nowrap">{lang==='zh' ? '面板地址' : 'Panel URL'}:</span>
                              {server.panelUrl ? (
                                <a href={server.panelUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 truncate max-w-[200px]" title={server.panelUrl}>
                                  {server.panelUrl.replace(/^https?:\/\//, '')}
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 text-xs whitespace-nowrap">{lang==='zh' ? '用户名' : 'Username'}:</span>
                              {server.username ? (
                                <div className="flex items-center gap-1">
                                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded truncate max-w-[150px]" title={server.username}>{server.username}</code>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(server.username || '');
                                        setCopiedMap(prev => ({ ...prev, [`${server.id}-panel-user`]: true }));
                                        setTimeout(() => setCopiedMap(prev => ({ ...prev, [`${server.id}-panel-user`]: false })), 1500);
                                      } catch {}
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                                  >
                                    {copiedMap[`${server.id}-panel-user`] ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 text-xs whitespace-nowrap">{lang==='zh' ? '密码' : 'Password'}:</span>
                              {(server.password || server.hasPassword) ? (
                                <div className="flex items-center gap-1">
                                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono min-w-[60px] text-center">
                                    {(() => {
                                      // 没有密码 → 显示 -
                                      if (!server.password && !server.hasPassword) return '-';
                                      const revealed = revealedPanelPass[server.id];
                                      // 已解密且为空 → 显示 -
                                      if (revealed === '') return '-';
                                      // 已解密且有值 → 显示明文
                                      if (showPasswordMap[`${server.id}-panel-pass`] && revealed) return revealed;
                                      // 有密码但未解密 → 显示 ••••••
                                      return '••••••';
                                    })()}
                                  </code>
                                  <button
                                    onClick={async () => {
                                      if (!revealedPanelPass[server.id] && revealedPanelPass[server.id] !== '') {
                                        try {
                                          const { revealServerSecretsApi } = await import('../services/apiClient');
                                          const r = await revealServerSecretsApi(server.id);
                                          // 存储空字符串表示"已尝试解密但为空"
                                          setRevealedPanelPass(prev => ({ ...prev, [server.id]: r.panelPassword || '' }));
                                        } catch {}
                                      }
                                      setShowPasswordMap(prev => ({ ...prev, [`${server.id}-panel-pass`]: !prev[`${server.id}-panel-pass`] }));
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                                  >
                                    {showPasswordMap[`${server.id}-panel-pass`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        // 优先使用已解密的密码
                                        let val = revealedPanelPass[server.id];
                                        if (!val) {
                                          // 如果没有已解密的密码，先调用 API 获取
                                          const { revealServerSecretsApi } = await import('../services/apiClient');
                                          const r = await revealServerSecretsApi(server.id);
                                          if (r.panelPassword) {
                                            val = r.panelPassword;
                                            setRevealedPanelPass(prev => ({ ...prev, [server.id]: r.panelPassword! }));
                                          }
                                        }
                                        if (val) {
                                          await navigator.clipboard.writeText(val);
                                          setCopiedMap(prev => ({ ...prev, [`${server.id}-panel-pass`]: true }));
                                          setTimeout(() => setCopiedMap(prev => ({ ...prev, [`${server.id}-panel-pass`]: false })), 1500);
                                        } else {
                                          console.warn('[Copy] 面板密码为空，无法复制');
                                        }
                                      } catch (e) {
                                        console.error('[Copy] 复制面板密码失败:', e);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                                  >
                                    {copiedMap[`${server.id}-panel-pass`] ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* SSH 信息 */}
                        <div className="bg-white rounded-lg p-4 border border-slate-200 h-[200px] flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <Terminal className="w-4 h-4 text-emerald-500" />
                            <span className="font-semibold text-slate-700">SSH {lang==='zh' ? '信息' : 'Info'}</span>
                          </div>
                          <div className="space-y-2 flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 text-xs whitespace-nowrap">{lang==='zh' ? '端口' : 'Port'}:</span>
                              <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{server.sshPort || '22'}</code>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 text-xs whitespace-nowrap">{lang==='zh' ? '用户名' : 'Username'}:</span>
                              <div className="flex items-center gap-1">
                                <code className="text-xs bg-slate-100 px-2 py-0.5 rounded truncate max-w-[120px]" title={server.sshUsername || 'root'}>{server.sshUsername || 'root'}</code>
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(server.sshUsername || 'root');
                                      setCopiedMap(prev => ({ ...prev, [`${server.id}-ssh-user`]: true }));
                                      setTimeout(() => setCopiedMap(prev => ({ ...prev, [`${server.id}-ssh-user`]: false })), 1500);
                                    } catch {}
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                                >
                                  {copiedMap[`${server.id}-ssh-user`] ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 text-xs whitespace-nowrap">{lang==='zh' ? '密码' : 'Password'}:</span>
                              {(server.sshPassword || server.hasSshPassword) ? (
                                <div className="flex items-center gap-1">
                                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono min-w-[60px] text-center">
                                    {(() => {
                                      // 没有密码 → 显示 -
                                      if (!server.sshPassword && !server.hasSshPassword) return '-';
                                      const revealed = revealedSshPass[server.id];
                                      // 已解密且为空 → 显示 -
                                      if (revealed === '') return '-';
                                      // 已解密且有值 → 显示明文
                                      if (showPasswordMap[`${server.id}-ssh-pass`] && revealed) return revealed;
                                      // 有密码但未解密 → 显示 ••••••
                                      return '••••••';
                                    })()}
                                  </code>
                                  <button
                                    onClick={async () => {
                                      if (!revealedSshPass[server.id] && revealedSshPass[server.id] !== '') {
                                        try {
                                          const { revealServerSecretsApi } = await import('../services/apiClient');
                                          const r = await revealServerSecretsApi(server.id);
                                          setRevealedSshPass(prev => ({ ...prev, [server.id]: r.sshPassword || '' }));
                                        } catch {}
                                      }
                                      setShowPasswordMap(prev => ({ ...prev, [`${server.id}-ssh-pass`]: !prev[`${server.id}-ssh-pass`] }));
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                                  >
                                    {showPasswordMap[`${server.id}-ssh-pass`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        // 优先使用已解密的密码
                                        let val = revealedSshPass[server.id];
                                        if (!val) {
                                          // 如果没有已解密的密码，先调用 API 获取
                                          const { revealServerSecretsApi } = await import('../services/apiClient');
                                          const r = await revealServerSecretsApi(server.id);
                                          if (r.sshPassword) {
                                            val = r.sshPassword;
                                            setRevealedSshPass(prev => ({ ...prev, [server.id]: r.sshPassword! }));
                                          }
                                        }
                                        if (val) {
                                          await navigator.clipboard.writeText(val);
                                          setCopiedMap(prev => ({ ...prev, [`${server.id}-ssh-pass`]: true }));
                                          setTimeout(() => setCopiedMap(prev => ({ ...prev, [`${server.id}-ssh-pass`]: false })), 1500);
                                        } else {
                                          console.warn('[Copy] SSH 密码为空，无法复制');
                                        }
                                      } catch (e) {
                                        console.error('[Copy] 复制 SSH 密码失败:', e);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                                  >
                                    {copiedMap[`${server.id}-ssh-pass`] ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
                            <div className="pt-2 mt-2 border-t border-slate-200">
                              <div className="bg-slate-900 text-slate-300 px-3 py-2 rounded-lg font-mono text-xs flex justify-between items-center border border-slate-700 shadow-inner">
                                <div className="flex items-center gap-2">
                                  <Terminal className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  <span className="opacity-90">{server.sshUsername || 'root'}@{server.ip}:{server.sshPort || '22'}</span>
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(`ssh ${server.sshUsername || 'root'}@${server.ip} -p ${server.sshPort || '22'}`);
                                      setCopiedMap(prev => ({ ...prev, [`${server.id}-ssh-cmd`]: true }));
                                      setTimeout(() => setCopiedMap(prev => ({ ...prev, [`${server.id}-ssh-cmd`]: false })), 1500);
                                    } catch {}
                                  }}
                                  className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                                  title={lang==='zh' ? '复制 SSH 命令' : 'Copy SSH command'}
                                >
                                  {copiedMap[`${server.id}-ssh-cmd`] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Provider Remarks */}
                        <div className="bg-white rounded-lg p-4 border border-slate-200 h-[200px] flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <Briefcase className="w-4 h-4 text-purple-500" />
                            <span className="font-semibold text-slate-700">{lang==='zh' ? '服务商备注' : 'Provider Remarks'}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                            {server.providerNotes ? (
                              <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{server.providerNotes}</p>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <span className="text-slate-400 text-xs">{lang==='zh' ? '暂无备注' : 'No remarks'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="bg-white rounded-lg p-4 border border-slate-200 md:col-span-3 h-[120px] flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span className="font-semibold text-slate-700">{lang==='zh' ? '备注' : 'Notes'}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                            {server.notes ? (
                              <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{server.notes}</p>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <span className="text-slate-400 text-xs">{lang==='zh' ? '暂无备注' : 'No notes'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            </tbody>
          </table>
        </SortableTable>
      </div>
      {servers.length === 0 && (
        <div className="p-12 text-center text-slate-400">
          <ServerIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{lang==='zh' ? '暂无服务器数据' : 'No servers yet'}</p>
        </div>
      )}
    </div>
  );
};

// 服务商表格视图
interface ProviderTableViewProps {
  providers: Provider[];
  lang: Language;
  onEdit: (provider: Provider) => void;
  onDelete: (id: string) => void;
  onReorder?: (providers: Provider[]) => void;
  highlightId?: string | null;
}

export const ProviderTableView: React.FC<ProviderTableViewProps> = ({
  providers, lang, onEdit, onDelete, onReorder, highlightId
}) => {
  const t = translations[lang];
  const sortedProviders = React.useMemo(() => sortByOrder(providers), [providers]);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <SortableTable items={sortedProviders} onReorder={onReorder || (() => {})} disabled={!onReorder}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {onReorder && <th className="w-8"></th>}
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{t.providerName}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{lang==='zh' ? '类型' : 'Type'}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{lang==='zh' ? '登录地址' : 'Login URL'}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{lang==='zh' ? '账号' : 'Account'}</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">{lang==='zh' ? '支付方式' : 'Payment'}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">{lang==='zh' ? '操作' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {sortedProviders.map(provider => {
              const isHighlighted = highlightId === provider.id;
              const highlightClass = isHighlighted ? 'bg-indigo-50 animate-pulse' : '';
              return (
                <SortableTableRow 
                  key={provider.id}
                  id={provider.id}
                  disabled={!onReorder}
                >
                <td className={`px-4 py-3 ${highlightClass}`}>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-900">{provider.name}</span>
                  </div>
                </td>
                <td className={`px-4 py-3 ${highlightClass}`}>
                  <div className="flex gap-1">
                    {provider.categories.map(cat => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                        {cat === 'server' ? <ServerIcon className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        {cat === 'server' ? (lang==='zh' ? '服务器' : 'Server') : (lang==='zh' ? '域名' : 'Domain')}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={`px-4 py-3 ${highlightClass}`}>
                  {provider.loginUrl ? (
                    <a 
                      href={provider.loginUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1 text-xs max-w-[200px]"
                    >
                      <CompactText text={provider.loginUrl.replace(/^https?:\/\//, '')} maxLength={28} className="text-indigo-600" />
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className={`px-4 py-3 ${highlightClass}`}>
                  {provider.username ? (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <User className="w-3 h-3 text-slate-400" />
                      <CompactText text={provider.username} maxLength={20} className="text-slate-600" />
                    </div>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className={`px-4 py-3 ${highlightClass}`}>
                  <span className="text-slate-600 text-xs">{provider.paymentMethod || '-'}</span>
                </td>
                <td className={`px-4 py-3 ${highlightClass}`}>
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(provider); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                      title={lang==='zh' ? '编辑' : 'Edit'}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(provider.id); }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                      title={lang==='zh' ? '删除' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                </SortableTableRow>
              );
              })}
            </tbody>
          </table>
        </SortableTable>
      </div>
      {providers.length === 0 && (
        <div className="p-12 text-center text-slate-400">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{lang==='zh' ? '暂无服务商数据' : 'No providers yet'}</p>
        </div>
      )}
    </div>
  );
};

