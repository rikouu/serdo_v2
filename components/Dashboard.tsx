
import React, { useState, useEffect } from 'react';
import { Server, Domain, ViewState, Language, SystemSettings } from '../types';
import { getSettingsApi } from '../services/apiClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Server as ServerIcon, Globe, ShieldCheck, XCircle, ArrowRight } from 'lucide-react';
import { translations } from '../utils/translations';
import { AutoCheckStatus } from './AutoCheckStatus';

interface DashboardProps {
  servers: Server[];
  domains: Domain[];
  lang: Language;
  onNavigate: (view: ViewState) => void;
  userId?: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#64748b'];

export const Dashboard: React.FC<DashboardProps> = ({ servers, domains, lang, onNavigate, userId }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const t = translations[lang];

  const now = new Date().getTime();
  const thirtyDaysMs = 1000 * 3600 * 24 * 30;

  // Stats
  const activeServers = servers.filter(s => s.status === 'running').length;
  
  const expiredServers = servers.filter(s => {
      const exp = new Date(s.expirationDate).getTime();
      return s.expirationDate && exp < now;
  }).length;

  const expiringServers = servers.filter(s => {
    const exp = new Date(s.expirationDate).getTime();
    return s.expirationDate && exp >= now && (exp - now) < thirtyDaysMs;
  }).length;

  const expiredDomains = domains.filter(d => {
      const exp = new Date(d.expirationDate).getTime();
      return d.expirationDate && exp < now;
  }).length;

  const expiringDomains = domains.filter(d => {
    const exp = new Date(d.expirationDate).getTime();
    return d.expirationDate && exp >= now && (exp - now) < thirtyDaysMs;
  }).length;

  const totalExpired = expiredServers + expiredDomains;
  const totalExpiring = expiringServers + expiringDomains;

  // Chart Data: Servers by Provider
  const providerData = (() => {
    const grouped = new Map<string, number>();
    for (const s of servers) {
      const raw = (s as any).provider || (s as any).providerId || 'Unknown';
      const name = (typeof raw === 'string' && raw.trim().length > 0) ? raw.trim() : 'Unknown';
      grouped.set(name, (grouped.get(name) || 0) + 1);
    }
    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  })();

  const useSize = () => {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
    useEffect(() => {
      const R: any = (window as any).ResizeObserver;
      if (!R) return;
      const ro = new R((entries: any) => {
        const cr = entries && entries[0] && entries[0].contentRect ? entries[0].contentRect : null;
        if (cr) setSize({ w: cr.width || 0, h: cr.height || 0 });
      });
      if (ref.current) ro.observe(ref.current);
      return () => { try { ro.disconnect(); } catch {} };
    }, []);
    return [ref, size] as const;
  };

  const [srvRef, srvSize] = useSize();
  const srvW = Math.max(280, srvSize.w || 0);
  const srvChartH = Math.max(220, Math.round(srvW * 0.7));
  const srvOuter = Math.max(70, Math.min(srvW, srvChartH) / 2 - 24);
  const srvInner = Math.round(srvOuter * 0.6);

  const [domRef, domSize] = useSize();
  const domW = Math.max(320, domSize.w || 0);
  const domChartH = Math.max(260, Math.round(domW * 0.7));
  const domOuter = Math.max(80, Math.min(domW, domChartH) / 2 - 24);
  const domInner = Math.round(domOuter * 0.6);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettingsApi();
        if (s) setSettings(s as any);
      } catch {}
    })();
  }, [userId]);

  const stoppedServers = servers.filter(s => s.status === 'stopped').length;
  const healthLabel = (() => {
    if ((expiredServers + expiredDomains) > 0) return t.critical || 'Critical';
    if (stoppedServers > 0 || (expiringServers + expiringDomains) > 0) return t.warning || 'Warning';
    return t.good;
  })();
  const lastServerCheck = (() => {
    const ts = settings && (settings as any).serverAutoCheckLastAt;
    if (!ts || ts === 0) return t.unknown || 'Unknown';
    try { return new Date(Number(ts)).toLocaleString(); } catch { return t.unknown || 'Unknown'; }
  })();
  const lastDomainCheck = (() => {
    const ts = settings && (settings as any).domainAutoCheckLastAt;
    if (!ts || ts === 0) return t.unknown || 'Unknown';
    try { return new Date(Number(ts)).toLocaleString(); } catch { return t.unknown || 'Unknown'; }
  })();

  const formatTimeShort = (ts: number | undefined | null): string => {
    if (!ts || ts === 0) return t.unknown || 'Unknown';
    try {
      const d = new Date(Number(ts));
      const date = d.toLocaleDateString();
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${date} ${time}`;
    } catch {
      return t.unknown || 'Unknown';
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    gradientFrom, 
    gradientTo, 
    textClass, 
    onClick 
  }: any) => (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group w-full`}
    >
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
         <Icon className="w-24 h-24" />
      </div>
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white shadow-lg shadow-${gradientFrom}/30`}>
                <Icon className="w-6 h-6" />
            </div>
            {onClick && <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />}
        </div>
        
        <div className="mt-4">
            <h4 className="text-slate-500 font-medium text-sm">{title}</h4>
            <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-bold ${textClass}`}>{value}</span>
            </div>
            <p className="text-xs mt-2 font-medium opacity-80 text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t.dashboardOverview}</h2>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <StatCard 
            title={t.totalServers}
            value={servers.length}
            subtitle={`${activeServers} ${t.active}`}
            icon={ServerIcon}
            gradientFrom="from-blue-500"
            gradientTo="to-blue-600"
            textClass="text-slate-900"
            onClick={() => onNavigate('servers')}
        />
        
        <StatCard 
            title={t.totalDomains}
            value={domains.length}
            subtitle="DNS & Registrars"
            icon={Globe}
            gradientFrom="from-purple-500"
            gradientTo="to-purple-600"
            textClass="text-slate-900"
            onClick={() => onNavigate('domains')}
        />

        <StatCard 
            title={t.attentionNeeded}
            value={totalExpired + totalExpiring}
            subtitle={
                <>
                   {totalExpired > 0 && <span className="text-rose-600 font-bold mr-2">{totalExpired} {t.itemsExpired}</span>}
                   {totalExpiring > 0 && <span className="text-amber-600 font-bold">{totalExpiring} {t.itemsExpiring}</span>}
                   {totalExpired === 0 && totalExpiring === 0 && <span className="text-emerald-600">{t.good}</span>}
                </>
            }
            icon={totalExpired > 0 ? XCircle : AlertTriangle}
            gradientFrom={totalExpired > 0 ? "from-rose-500" : "from-amber-500"}
            gradientTo={totalExpired > 0 ? "to-rose-600" : "to-amber-600"}
            textClass={totalExpired > 0 ? "text-rose-600" : (totalExpiring > 0 ? "text-amber-600" : "text-emerald-600")}
        />

        <StatCard 
            title={t.systemHealth}
            value={healthLabel}
            subtitle={`${t.lastCheckedShort || 'Checked'} · S: ${formatTimeShort(settings && (settings as any).serverAutoCheckLastAt)} · D: ${formatTimeShort(settings && (settings as any).domainAutoCheckLastAt)}`}
            icon={ShieldCheck}
            gradientFrom="from-emerald-500"
            gradientTo="to-emerald-600"
            textClass={healthLabel === t.good ? 'text-emerald-600' : (healthLabel === (t.warning || 'Warning') ? 'text-amber-600' : 'text-rose-600')}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        
        {/* Charts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
            {t.serversByProvider}
          </h3>
          <div className="w-full flex-1">
            {providerData.length > 0 ? (
              <div ref={srvRef} className="h-full w-full">
                <ResponsiveContainer width="100%" height={srvChartH}>
                  <PieChart>
                    <Pie data={providerData} cx="50%" cy="50%" innerRadius={srvInner} outerRadius={srvOuter} paddingAngle={4} dataKey="value">
                      {providerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
                  {providerData.map((entry, index) => (
                    <div key={`legend-srv-${index}`} className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-slate-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                {t.noData || 'No data'}
              </div>
            )}
          </div>
        </div>

        {/* Domains by Registrar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
            {t.domainsByRegistrar}
          </h3>
          <div className="w-full flex-1">
            {(() => {
              const grouped = new Map<string, number>();
              for (const d of domains) {
                const raw = (d as any).registrar || 'Unknown';
                const name = (typeof raw === 'string' && raw.trim().length > 0) ? raw.trim() : 'Unknown';
                grouped.set(name, (grouped.get(name) || 0) + 1);
              }
              const data = Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
              return data.length > 0 ? (
                <div ref={domRef} className="h-full w-full">
                  <ResponsiveContainer width="100%" height={domChartH}>
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={domInner} outerRadius={domOuter} paddingAngle={4} dataKey="value">
                        {data.map((entry, index) => (
                          <Cell key={`cell-dom-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
                    {data.map((entry, index) => (
                      <div key={`legend-dom-${index}`} className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-slate-600">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                  {t.noData || 'No data'}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Expiry Buckets */}
        <div className="bg白 p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
            {t.expiryBuckets || 'Expiry Buckets'}
          </h3>
          {(() => {
            const daysTo = (d: any) => {
              try { return Math.floor((new Date(d).getTime() - now) / (1000*3600*24)); } catch { return 99999 }
            }
            const bucketize = (list: any[]) => {
              const out = { '<7':0, '8-30':0, '31-90':0, '>90':0 } as Record<string, number>
              for (const x of list) {
                const dd = daysTo(x.expirationDate)
                if (Number.isNaN(dd) || !x.expirationDate) continue
                if (dd <= 7) out['<7']++
                else if (dd <= 30) out['8-30']++
                else if (dd <= 90) out['31-90']++
                else out['>90']++
              }
              return out
            }
            const sb = bucketize(servers)
            const db = bucketize(domains)
            const data = [
              { name: '<7', Servers: sb['<7'], Domains: db['<7'] },
              { name: '8-30', Servers: sb['8-30'], Domains: db['8-30'] },
              { name: '31-90', Servers: sb['31-90'], Domains: db['31-90'] },
              { name: '>90', Servers: sb['>90'], Domains: db['>90'] }
            ]
            const height = 240
            return (
              <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ left: 10, right: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Servers" fill="#3b82f6" radius={[6,6,0,0]} />
                  <Bar dataKey="Domains" fill="#f43f5e" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
        </div>

        {/* Next Expirations */}
        <div className="bg白 p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-5 bg-slate-500 rounded-full"></div>
            {t.upcomingExpirations || 'Upcoming Expirations'}
          </h3>
          {(() => {
            const byDate = (list: any[]) => list
              .filter(x => x.expirationDate)
              .map(x => ({ id: x.id, name: x.name, expirationDate: x.expirationDate }))
              .sort((a,b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())
              .slice(0,5)
            const srv = byDate(servers)
            const doms = byDate(domains)
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">{t.servers || 'Servers'}</h4>
                  <div className="space-y-2">
                    {srv.length ? srv.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[60%]" title={s.name}>{s.name}</span>
                        <span className="font-mono text-slate-600" title={s.expirationDate}>{s.expirationDate}</span>
                      </div>
                    )) : <div className="text-slate-400 text-sm">{t.noData || 'No data'}</div>}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">{t.domains || 'Domains'}</h4>
                  <div className="space-y-2">
                    {doms.length ? doms.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[60%]" title={d.name}>{d.name}</span>
                        <span className="font-mono text-slate-600" title={d.expirationDate}>{d.expirationDate}</span>
                      </div>
                    )) : <div className="text-slate-400 text-sm">{t.noData || 'No data'}</div>}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

      </div>

      {/* Auto Check Status & Logs */}
      <AutoCheckStatus lang={lang} />
    </div>
  );
};
