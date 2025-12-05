import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Server as ServerIcon, Globe, Activity, Bell } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface CheckLog {
  id: string;
  timestamp: number;
  type: 'server' | 'domain';
  trigger: 'auto' | 'manual';
  total: number;
  success: number;
  failed: number;
  duration: number;
  failedItems?: string[];
  expiringItems?: Array<{name: string; expirationDate: string; days: number}>;
  errors?: string[];
  notificationSent?: boolean;
}

interface CheckStatus {
  server: {
    enabled: boolean;
    intervalHours: number;
    lastCheckAt: number;
    nextCheckAt: number;
  };
  domain: {
    enabled: boolean;
    frequency: string;
    lastCheckAt: number;
    nextCheckAt: number;
  };
  currentTime: number;
}

interface AutoCheckStatusProps {
  lang: Language;
}

export const AutoCheckStatus: React.FC<AutoCheckStatusProps> = ({ lang }) => {
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [status, setStatus] = useState<CheckStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<'all' | 'server' | 'domain'>('all');
  const pageSize = 5;
  const t = translations[lang];

  const loadData = async () => {
    setLoading(true);
    try {
      const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('serdo_auth_token')}`,
        'Content-Type': 'application/json'
      };

      const [logsRes, statusRes] = await Promise.all([
        fetch(`${BASE}/check-logs?page=${page}&pageSize=${pageSize}${filterType !== 'all' ? `&type=${filterType}` : ''}`, { headers }),
        fetch(`${BASE}/check-status`, { headers })
      ]);

      if (logsRes.ok && statusRes.ok) {
        const logsData = await logsRes.json();
        const statusData = await statusRes.json();
        setLogs(logsData.logs || []);
        setTotalPages(logsData.pagination?.totalPages || 1);
        setStatus(statusData);
      }
    } catch (error) {
      console.error('Failed to load check status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, [page, filterType]);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getTimeRemaining = (nextCheckAt: number) => {
    if (!nextCheckAt) return '-';
    const remaining = nextCheckAt - Date.now();
    if (remaining <= 0) return lang === 'zh' ? '即将运行' : 'Running soon';
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    
    if (hours > 0) {
      return lang === 'zh' ? `${hours}小时${minutes}分钟后` : `in ${hours}h ${minutes}m`;
    }
    return lang === 'zh' ? `${minutes}分钟后` : `in ${minutes}m`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Activity className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {lang === 'zh' ? '自动检查状态' : 'Auto Check Status'}
            </h3>
            <p className="text-sm text-slate-500">
              {lang === 'zh' ? '监控自动检查运行情况' : 'Monitor auto check execution'}
            </p>
          </div>
        </div>
      </div>

      {/* 状态概览 */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 服务器检查状态 */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <ServerIcon className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                {lang === 'zh' ? '服务器检查' : 'Server Check'}
              </span>
              {status.server.enabled ? (
                <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400 ml-auto" />
              )}
            </div>
            {status.server.enabled ? (
              <>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>{lang === 'zh' ? '间隔' : 'Interval'}:</span>
                    <span className="font-medium">{status.server.intervalHours} {lang === 'zh' ? '小时' : 'hours'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'zh' ? '上次检查' : 'Last check'}:</span>
                    <span className="font-medium">{formatTime(status.server.lastCheckAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'zh' ? '下次检查' : 'Next check'}:</span>
                    <span className="font-medium text-indigo-600">{getTimeRemaining(status.server.nextCheckAt)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">{lang === 'zh' ? '未启用' : 'Disabled'}</p>
            )}
          </div>

          {/* 域名检查状态 */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                {lang === 'zh' ? '域名检查' : 'Domain Check'}
              </span>
              {status.domain.enabled ? (
                <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400 ml-auto" />
              )}
            </div>
            {status.domain.enabled ? (
              <>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>{lang === 'zh' ? '频率' : 'Frequency'}:</span>
                    <span className="font-medium capitalize">{status.domain.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'zh' ? '上次检查' : 'Last check'}:</span>
                    <span className="font-medium">{formatTime(status.domain.lastCheckAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'zh' ? '下次检查' : 'Next check'}:</span>
                    <span className="font-medium text-indigo-600">{getTimeRemaining(status.domain.nextCheckAt)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">{lang === 'zh' ? '未启用' : 'Disabled'}</p>
            )}
          </div>
        </div>
      )}

      {/* 过滤器 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setFilterType('all'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {lang === 'zh' ? '全部' : 'All'}
        </button>
        <button
          onClick={() => { setFilterType('server'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'server'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ServerIcon className="w-3.5 h-3.5 inline mr-1" />
          {lang === 'zh' ? '服务器' : 'Servers'}
        </button>
        <button
          onClick={() => { setFilterType('domain'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'domain'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5 inline mr-1" />
          {lang === 'zh' ? '域名' : 'Domains'}
        </button>
      </div>

      {/* 日志列表 */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-500">{lang === 'zh' ? '加载中...' : 'Loading...'}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">{lang === 'zh' ? '暂无日志' : 'No logs yet'}</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {log.type === 'server' ? (
                    <ServerIcon className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-sm font-medium text-slate-900">
                    {log.type === 'server'
                      ? (lang === 'zh' ? '服务器检查' : 'Server Check')
                      : (lang === 'zh' ? '域名检查' : 'Domain Check')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    log.trigger === 'auto'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {log.trigger === 'auto' ? (lang === 'zh' ? '自动' : 'Auto') : (lang === 'zh' ? '手动' : 'Manual')}
                  </span>
                  {log.notificationSent && (
                    <Bell className="w-3.5 h-3.5 text-orange-500" title={lang === 'zh' ? '已发送通知' : 'Notification sent'} />
                  )}
                </div>
                <span className="text-xs text-slate-500">{formatTime(log.timestamp)}</span>
              </div>

              <div className="grid grid-cols-4 gap-4 text-xs mb-2">
                <div>
                  <span className="text-slate-500">{lang === 'zh' ? '总数' : 'Total'}:</span>
                  <span className="ml-1 font-medium text-slate-900">{log.total}</span>
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'zh' ? '成功' : 'Success'}:</span>
                  <span className="ml-1 font-medium text-green-600">{log.success}</span>
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'zh' ? '失败' : 'Failed'}:</span>
                  <span className="ml-1 font-medium text-rose-600">{log.failed}</span>
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'zh' ? '耗时' : 'Duration'}:</span>
                  <span className="ml-1 font-medium text-slate-900">{formatDuration(log.duration)}</span>
                </div>
              </div>

              {log.failedItems && log.failedItems.length > 0 && (
                <div className="mt-2 p-2 bg-rose-50 rounded border border-rose-200">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span className="text-xs font-medium text-rose-700">
                      {lang === 'zh' ? '失败项目' : 'Failed Items'}:
                    </span>
                  </div>
                  <div className="text-xs text-rose-600">
                    {log.failedItems.join(', ')}
                  </div>
                </div>
              )}

              {log.expiringItems && log.expiringItems.length > 0 && (
                <div className="mt-2 p-2 bg-orange-50 rounded border border-orange-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-xs font-medium text-orange-700">
                      {lang === 'zh' ? '即将到期' : 'Expiring Soon'}:
                    </span>
                  </div>
                  <div className="text-xs text-orange-600 space-y-0.5">
                    {log.expiringItems.map((item, idx) => (
                      <div key={idx}>
                        {item.name} - {item.expirationDate} ({item.days} {lang === 'zh' ? '天' : 'days'})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {log.errors && log.errors.length > 0 && (
                <div className="mt-2 p-2 bg-slate-100 rounded text-xs text-slate-600">
                  {log.errors.join('; ')}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {lang === 'zh' ? '上一页' : 'Previous'}
          </button>
          <span className="text-sm text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {lang === 'zh' ? '下一页' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

