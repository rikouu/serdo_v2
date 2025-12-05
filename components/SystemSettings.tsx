
import React, { useState, useEffect } from 'react';
import { SystemSettings as ISystemSettings, Language } from '../types';
import { getSettingsApi, updateSettingsApi } from '../services/apiClient';
import { translations } from '../utils/translations';
import { showToast, showOverlay, hideOverlay } from '../utils/notify';
import { Globe, Bell, Mail, Save, ChevronDown, Check, LayoutGrid, List, MousePointerClick, Menu, Eye, EyeOff } from 'lucide-react';

interface SystemSettingsProps {
  userId: string;
  lang: Language;
  onSettingsChange?: (settings: ISystemSettings) => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ userId, lang, onSettingsChange }) => {
  const [settings, setSettings] = useState<ISystemSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [headersText, setHeadersText] = useState<string>('{}');
  const [headersJsonError, setHeadersJsonError] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState<string>('');
  const [bodyJsonError, setBodyJsonError] = useState<string | null>(null);
  const parseHeaders = (txt: string): Record<string, string> | null => {
    try { return JSON.parse(txt) } catch {}
    try {
      const normalized = String(txt || '')
        .trim()
        .replace(/(^|[{,]\s*)([A-Za-z0-9_-]+)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/,(\s*[}\]])/g, '$1')
      return JSON.parse(normalized)
    } catch {}
    return null
  }
  const [testDomain, setTestDomain] = useState<string>('example.com');
  const [apiTestOpen, setApiTestOpen] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<string>('');
  const [curlText, setCurlText] = useState<string>('');
  
  // 密文字段编辑状态跟踪
  const [secretFieldsEdited, setSecretFieldsEdited] = useState<{
    whoisApiKey: boolean;
    barkKey: boolean;
    smtpPassword: boolean;
  }>({ whoisApiKey: false, barkKey: false, smtpPassword: false });
  
  const t = translations[lang];

  const normalizeSettings = (s: ISystemSettings): ISystemSettings => {
    const n = s as any
    const noti = n.notifications || {}
    const bark = Object.assign({ enabled: false, serverUrl: 'https://api.day.app', key: '' }, noti.bark || {})
    const smtp = Object.assign({ enabled: false, host: 'smtp.gmail.com', port: 587, username: '', password: '', fromEmail: '' }, noti.smtp || {})
    const preferences = Object.assign({ notifyServerDown: true, notifyDomainExpiring: true }, noti.preferences || {})
    const dnsApiProvider = n.dnsApiProvider || 'cloudflare'
    const dnsFailover = typeof n.dnsFailover === 'boolean' ? n.dnsFailover : true
    const whoisApiBaseUrl = n.whoisApiBaseUrl || 'https://api.whoisproxy.info/whois'
    const whoisApiKey = n.whoisApiKey || ''
    const whoisApiMethod = n.whoisApiMethod || 'GET'
    const whoisApiProvider = n.whoisApiProvider || 'whoisproxy'
    const whoisApiHeaders = n.whoisApiHeaders || {}
    const serverAutoCheckEnabled = typeof n.serverAutoCheckEnabled === 'boolean' ? n.serverAutoCheckEnabled : false
    const serverAutoCheckIntervalHours = typeof n.serverAutoCheckIntervalHours === 'number' ? n.serverAutoCheckIntervalHours : 6
    const domainAutoCheckEnabled = typeof n.domainAutoCheckEnabled === 'boolean' ? n.domainAutoCheckEnabled : false
    const domainAutoCheckFrequency = n.domainAutoCheckFrequency || 'daily'
    const actionButtonsLayout = n.actionButtonsLayout || 'floating'
    return Object.assign({}, s, { 
      dnsApiProvider,
      dnsFailover,
      whoisApiBaseUrl,
      whoisApiKey,
      whoisApiMethod,
      serverAutoCheckEnabled,
      serverAutoCheckIntervalHours,
      domainAutoCheckEnabled,
      domainAutoCheckFrequency,
      actionButtonsLayout,
      notifications: { bark, smtp, preferences },
      whoisApiHeaders,
      whoisApiProvider
    })
  }

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettingsApi();
        const ns = normalizeSettings(s);
        setSettings(ns);
        try { setHeadersText(JSON.stringify(ns.whoisApiHeaders || {}, null, 2)); } catch { setHeadersText('{}') }
        try { setBodyText(String(ns.whoisApiBody || '')); } catch { setBodyText('') }
      } catch (err) {
        console.error('[SystemSettings] Failed to load settings:', err);
      }
    })();
  }, [userId]);

  useEffect(() => {
    try { if (settings) setHeadersText(JSON.stringify(settings.whoisApiHeaders || {}, null, 2)); } catch {}
  }, [settings?.whoisApiHeaders]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const s = settings as any;
    const smtp = s.notifications?.smtp || ({} as any);
    const bark = s.notifications?.bark || ({} as any);
    const isEmail = (v: string) => /.+@.+\..+/.test(String(v || ''));
    const fe: Record<string, string> = {};
    
    // 验证时，如果服务器已有密码（hasXxx 为 true），则不验证空值
    if (smtp.enabled) {
      if (!isEmail(String(smtp.fromEmail || ''))) fe['smtp.fromEmail'] = t.invalidEmail;
      if (!String(smtp.host || '').trim()) fe['smtp.host'] = t.helperHostRequired || 'Host required';
      if (!(Number(smtp.port) > 0 && Number(smtp.port) < 65536)) fe['smtp.port'] = t.helperInvalidPort || 'Port must be 1-65535';
      if (!String(smtp.username || '').trim()) fe['smtp.username'] = t.helperUsernameRequired || 'Username required';
      // 只有在没有已保存密码且用户没有输入时才报错
      const hasSmtpPassword = smtp.hasPassword || secretFieldsEdited.smtpPassword;
      if (!hasSmtpPassword && !String(smtp.password || '').trim()) fe['smtp.password'] = t.helperPasswordRequired || 'Password required';
    }
    if (bark.enabled) {
      if (!String(bark.serverUrl || '').trim()) fe['bark.serverUrl'] = t.helperInvalidUrl || 'Invalid URL';
      // 只有在没有已保存 key 且用户没有输入时才报错
      const hasBarkKey = bark.hasKey || secretFieldsEdited.barkKey;
      if (!hasBarkKey && !String(bark.key || '').trim()) fe['bark.key'] = t.helperKeyRequired || 'Device key required';
    }
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) { setErrorBanner(smtp.enabled ? (t.smtpIncomplete || 'SMTP configuration incomplete') : (t.barkIncomplete || 'Bark configuration incomplete')); return; }
    
    // WHOIS API Key 验证：如果服务器有已保存的 key，不验证
    const hasWhoisKey = s.hasWhoisApiKey || secretFieldsEdited.whoisApiKey;
    if (s.whoisApiProvider === 'rapidapi_getData' && !hasWhoisKey && !String(s.whoisApiKey || '').trim()) { 
      setErrorBanner(lang==='zh' ? '需要填写 API Key' : 'API Key required'); 
      return 
    }
    
    setErrorBanner(null);
    
    // 构建保存数据，对于未编辑的密文字段发送占位符
    const saveData = JSON.parse(JSON.stringify(s));
    
    // 处理 whoisApiKey
    if (!secretFieldsEdited.whoisApiKey && s.hasWhoisApiKey) {
      saveData.whoisApiKey = '__KEEP__'; // 告诉后端保留原值
    }
    
    // 处理 bark.key
    if (saveData.notifications?.bark) {
      if (!secretFieldsEdited.barkKey && bark.hasKey) {
        saveData.notifications.bark.key = '__KEEP__';
      }
    }
    
    // 处理 smtp.password
    if (saveData.notifications?.smtp) {
      if (!secretFieldsEdited.smtpPassword && smtp.hasPassword) {
        saveData.notifications.smtp.password = '__KEEP__';
      }
    }
    
    // 清理临时字段
    delete saveData._whoisKeyVisible;
    delete saveData.hasWhoisApiKey;
    if (saveData.notifications?.bark) {
      delete saveData.notifications.bark.hasKey;
      delete saveData.notifications.bark._barkKeyVisible;
    }
    if (saveData.notifications?.smtp) {
      delete saveData.notifications.smtp.hasPassword;
      delete saveData.notifications.smtp._smtpPasswordVisible;
    }
    
    try {
      showOverlay(lang==='zh' ? '正在保存设置…' : 'Saving settings…')
      const updatedFromApi = await updateSettingsApi(saveData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // 通知 App 组件更新 settings，使用 API 返回的最新数据
      if (onSettingsChange && updatedFromApi) {
        onSettingsChange(updatedFromApi);
      }
      showToast(lang==='zh' ? '已保存' : 'Saved', 'success')
      hideOverlay()
      // 重置编辑状态
      setSecretFieldsEdited({ whoisApiKey: false, barkKey: false, smtpPassword: false });
    } catch (err: any) {
      setErrorBanner(String(err?.message || err || '保存失败'));
      showToast(lang==='zh' ? '保存失败' : 'Save failed', 'error')
      hideOverlay()
    }
  };

  if (!settings) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t.systemSettings}</h2>
        <p className="text-slate-500 text-sm">{t.settingsSubtitle}</p>
      </div>
      {errorBanner && (
        <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{errorBanner}</div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* UI Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <LayoutGrid className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-800">{t.uiSettings || 'UI Settings'}</h3>
          </div>
          
          <div className="space-y-6">
            {/* 列表视图模式 */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-3">{lang==='zh' ? '列表显示模式' : 'List View Mode'}</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => setSettings({ ...settings, listViewMode: 'card' })} 
                  className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    (settings.listViewMode || 'card') === 'card' 
                      ? 'border-indigo-500 bg-indigo-50 shadow-md' 
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {(settings.listViewMode || 'card') === 'card' && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <LayoutGrid className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-800">{lang==='zh' ? '卡片式' : 'Card View'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{lang==='zh' ? '网格布局，信息丰富' : 'Grid layout, rich info'}</div>
                  </div>
                  {/* 预览图 */}
                  <div className="w-full h-16 bg-slate-100 rounded-lg p-2 flex gap-1.5">
                    <div className="flex-1 bg-white rounded border border-slate-200 shadow-sm"></div>
                    <div className="flex-1 bg-white rounded border border-slate-200 shadow-sm"></div>
                    <div className="flex-1 bg-white rounded border border-slate-200 shadow-sm"></div>
                  </div>
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setSettings({ ...settings, listViewMode: 'table' })} 
                  className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    settings.listViewMode === 'table' 
                      ? 'border-indigo-500 bg-indigo-50 shadow-md' 
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {settings.listViewMode === 'table' && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <List className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-800">{lang==='zh' ? '列表式' : 'Table View'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{lang==='zh' ? '紧凑布局，快速浏览' : 'Compact layout, quick scan'}</div>
                  </div>
                  {/* 预览图 */}
                  <div className="w-full h-16 bg-slate-100 rounded-lg p-2 flex flex-col gap-1">
                    <div className="h-3 bg-white rounded border border-slate-200 shadow-sm"></div>
                    <div className="h-3 bg-white rounded border border-slate-200 shadow-sm"></div>
                    <div className="h-3 bg-white rounded border border-slate-200 shadow-sm"></div>
                    <div className="h-3 bg-white rounded border border-slate-200 shadow-sm"></div>
                  </div>
                </button>
              </div>
            </div>
            
            {/* 操作按钮布局 */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-3">{t.actionButtonsLayout || 'Action Buttons Layout'}</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => setSettings({ ...settings, actionButtonsLayout: 'floating' })} 
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    settings.actionButtonsLayout === 'floating' 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.actionButtonsLayout === 'floating' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <MousePointerClick className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-slate-800">{lang==='zh' ? '悬浮按钮' : 'Floating'}</div>
                    <div className="text-xs text-slate-500">{lang==='zh' ? '右下角固定' : 'Fixed bottom-right'}</div>
                  </div>
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setSettings({ ...settings, actionButtonsLayout: 'fixed' })} 
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    settings.actionButtonsLayout === 'fixed' 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.actionButtonsLayout === 'fixed' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Menu className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-slate-800">{lang==='zh' ? '顶部菜单' : 'Top Menu'}</div>
                    <div className="text-xs text-slate-500">{lang==='zh' ? '列表顶部显示' : 'Show at list top'}</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* DNS Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-800">{t.dnsSettings}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">{t.dnsApiProvider}</label>
              <div className="relative">
                <select 
                  value={settings.dnsApiProvider}
                  onChange={e => setSettings({...settings, dnsApiProvider: e.target.value as any})}
                  className="appearance-none w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="cloudflare">Cloudflare (1.1.1.1)</option>
                  <option value="google">Google (8.8.8.8)</option>
                  <option value="quad9">Quad9 (9.9.9.9)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center">
               <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg w-full hover:bg-slate-50 transition-colors">
                 <input 
                   type="checkbox" 
                   checked={settings.dnsFailover}
                   onChange={e => setSettings({...settings, dnsFailover: e.target.checked})}
                   className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                 />
                 <div>
                   <span className="text-sm font-medium text-slate-900 block">{t.dnsFailover}</span>
                 </div>
               </label>
            </div>
          </div>
        </div>

        {/* WHOIS API Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-800">{t.whoisApiSettings}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <div className="p-4 border border-slate-200 rounded-lg w-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-900">{t.whoisApiSettings}</div>
                  <a href="http://whois.of.ci/api/docs" target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    {lang==='zh' ? 'API 文档' : 'API Docs'} <Globe className="w-3 h-3"/>
                  </a>
                </div>
                
                {/* API Base URL */}
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{lang==='zh' ? 'API 服务地址' : 'API Base URL'}</label>
                  <input
                    type="text"
                    value={settings.whoisApiBaseUrl || ''}
                    onChange={e => setSettings({...settings, whoisApiBaseUrl: e.target.value})}
                    placeholder="http://whois.of.ci/api"
                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                  />
                  <div className="mt-1 text-xs text-slate-500">{lang==='zh' ? '支持占位符: {domain}' : 'Supports placeholder: {domain}'}</div>
                </div>
                
                {/* API Key */}
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">API Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={(settings as any)._whoisKeyVisible ? 'text' : 'password'}
                      className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm"
                      value={
                        (settings as any)._whoisKeyVisible 
                          ? (settings.whoisApiKey || '') 
                          : (secretFieldsEdited.whoisApiKey 
                              ? (settings.whoisApiKey || '') 
                              : ''
                            )
                      }
                      onChange={e => {
                        const newValue = e.target.value;
                        setSettings({ ...settings, whoisApiKey: newValue });
                        setSecretFieldsEdited(prev => ({ ...prev, whoisApiKey: true }));
                      }}
                      placeholder={
                        (settings as any).hasWhoisApiKey && !secretFieldsEdited.whoisApiKey 
                          ? '••••••••（已保存）' 
                          : (lang==='zh' ? '输入 API Key' : 'Enter API Key')
                      }
                    />
                    {/* 清除按钮 - 仅当有已保存的值时显示 */}
                    {(settings as any).hasWhoisApiKey && !secretFieldsEdited.whoisApiKey && (
                      <button 
                        type="button" 
                        className="px-3 py-2 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors text-sm" 
                        onClick={() => {
                          setSettings({ ...settings, whoisApiKey: '' });
                          setSecretFieldsEdited(prev => ({ ...prev, whoisApiKey: true }));
                          showToast(lang==='zh' ? '已标记清除，保存后生效' : 'Marked for deletion, save to apply', 'info');
                        }}
                      >
                        {lang==='zh' ? '清除' : 'Clear'}
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="px-3 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors" 
                      onClick={async () => {
                        const sVisible = (settings as any)._whoisKeyVisible;
                        if (sVisible) { 
                          setSettings({ ...(settings as any), _whoisKeyVisible: false }); 
                          return; 
                        }
                        // 如果服务器有已保存的 key，先获取明文
                        if ((settings as any).hasWhoisApiKey && !secretFieldsEdited.whoisApiKey) {
                          try {
                            showOverlay(lang==='zh' ? '正在解密...' : 'Decrypting...');
                            const api = await import('../services/apiClient');
                            const k = await api.revealWhoisApiKeyApi();
                            hideOverlay();
                            
                            if (!k || k.trim() === '') {
                              showToast(lang==='zh' ? '无法解密密钥，请重新输入并保存' : 'Cannot decrypt key, please re-enter and save', 'error');
                              setSettings({ ...(settings as any), whoisApiKey: '', _whoisKeyVisible: true, hasWhoisApiKey: false });
                              setSecretFieldsEdited(prev => ({ ...prev, whoisApiKey: true }));
                            } else {
                              setSettings({ ...(settings as any), whoisApiKey: k, _whoisKeyVisible: true });
                              setSecretFieldsEdited(prev => ({ ...prev, whoisApiKey: true }));
                              showToast(lang==='zh' ? '密钥已显示' : 'Key revealed', 'success');
                            }
                          } catch (e: any) { 
                            hideOverlay();
                            showToast(lang==='zh' ? '无法显示密钥，请重新输入并保存' : 'Cannot reveal key, please re-enter and save', 'error'); 
                            setSettings({ ...(settings as any), whoisApiKey: '', _whoisKeyVisible: true, hasWhoisApiKey: false });
                            setSecretFieldsEdited(prev => ({ ...prev, whoisApiKey: true }));
                          }
                        } else {
                          setSettings({ ...(settings as any), _whoisKeyVisible: true });
                        }
                      }}
                    >
                      {(settings as any)._whoisKeyVisible ? (lang==='zh' ? '隐藏' : 'Hide') : (lang==='zh' ? '显示' : 'Show')}
                    </button>
                  </div>
                  {/* 状态提示 */}
                  {(settings as any).hasWhoisApiKey && !secretFieldsEdited.whoisApiKey && (
                    <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                      <Check className="w-3 h-3"/> {lang==='zh' ? 'API Key 已保存（点击显示可查看或修改）' : 'API Key saved (click Show to view or edit)'}
                    </div>
                  )}
                  {secretFieldsEdited.whoisApiKey && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                      {lang==='zh' ? '已修改，保存后生效' : 'Modified, will be saved'}
                    </div>
                  )}
                </div>
                
                {/* API 测试 */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <label className="text-xs font-medium text-slate-600 block mb-2">{lang==='zh' ? '测试 API 连接' : 'Test API Connection'}</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={testDomain} 
                      onChange={e=> setTestDomain(e.target.value)} 
                      className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                      placeholder="example.com" 
                    />
                    <button 
                      type="button" 
                      onClick={async()=>{ 
                        try { 
                          showOverlay(lang==='zh' ? '正在测试 API…' : 'Testing API…')
                          const api = await import('../services/apiClient')
                          const r = await api.testWhoisApi(testDomain || 'example.com')
                          
                          if (r && r.ok) { 
                            // 构建详细结果
                            const resultLines = [
                              `✅ ${lang==='zh' ? 'API 测试通过' : 'API Test Passed'}`,
                              '',
                              `📡 WHOIS ${lang==='zh' ? '端点' : 'Endpoint'}:`,
                              `   URL: ${r.tests?.whois?.url || 'N/A'}`,
                              `   ${lang==='zh' ? '状态' : 'Status'}: ${r.tests?.whois?.success ? '✓' : '✗'}`,
                              r.tests?.whois?.sample ? `   ${lang==='zh' ? '注册商' : 'Registrar'}: ${r.tests.whois.sample.registrar}` : '',
                              r.tests?.whois?.sample ? `   ${lang==='zh' ? '到期' : 'Expires'}: ${r.tests.whois.sample.expiration_date}` : '',
                              '',
                              `🌐 DNS ${lang==='zh' ? '端点' : 'Endpoint'}:`,
                              `   URL: ${r.tests?.dns?.url || 'N/A'}`,
                              `   ${lang==='zh' ? '状态' : 'Status'}: ${r.tests?.dns?.success ? '✓' : '✗'}`,
                              r.tests?.dns?.sample ? `   ${lang==='zh' ? '记录数' : 'Records'}: ${r.tests.dns.sample.recordCount}` : '',
                              r.tests?.dns?.sample ? `   ${lang==='zh' ? '类型' : 'Types'}: ${r.tests.dns.sample.recordTypes?.join(', ')}` : '',
                            ].filter(Boolean).join('\n')
                            
                            setApiTestResult(resultLines)
                            setApiTestOpen(true)
                            showToast(lang==='zh' ? 'API 测试通过' : 'API Test Passed', 'success')
                          } else { 
                            // 构建错误结果
                            const errorLines = [
                              `❌ ${lang==='zh' ? 'API 测试失败' : 'API Test Failed'}`,
                              '',
                              r.message || '',
                              '',
                              ...(r.errorSummary || []).map(e => `• ${e}`),
                              '',
                              r.tests?.whois?.error ? `WHOIS: ${r.tests.whois.error.message}` : '',
                              r.tests?.dns?.error ? `DNS: ${r.tests.dns.error.message}` : '',
                            ].filter(Boolean).join('\n')
                            
                            setApiTestResult(errorLines)
                            setApiTestOpen(true)
                            showToast(lang==='zh' ? 'API 测试失败' : 'API Test Failed', 'error')
                          }
                        } catch (e: any) { 
                          setApiTestResult(`❌ ${lang==='zh' ? '测试出错' : 'Test Error'}: ${e?.message || 'Unknown error'}`)
                          setApiTestOpen(true)
                          showToast(lang==='zh' ? 'API 不可用' : 'API Error', 'error')
                        } finally { 
                          hideOverlay() 
                        }
                      }} 
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-medium text-sm"
                    >
                      {lang==='zh' ? '测试连接' : 'Test Connection'}
                    </button>
                  </div>
                </div>
                
                {apiTestOpen && (
                  <ResultsModal title={lang==='zh' ? 'API 测试结果' : 'API Test Result'} onClose={() => setApiTestOpen(false)}>
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap break-words font-mono bg-slate-50 p-3 rounded-lg">{apiTestResult}</pre>
                  </ResultsModal>
                )}
                
                {/* cURL 导入 */}
                <details className="group">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 flex items-center gap-1">
                    <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform"/>
                    {lang==='zh' ? '高级: 从 cURL 导入配置' : 'Advanced: Import from cURL'}
                  </summary>
                  <div className="mt-3 space-y-2">
                    <textarea 
                      rows={3} 
                      value={curlText} 
                      onChange={e=> setCurlText(e.target.value)} 
                      placeholder={`curl 'http://whois.of.ci/api/whois/example.com' -H 'X-API-Key: your-key'`} 
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                    />
                    <button 
                      type="button" 
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm" 
                      onClick={()=>{ 
                        try { 
                          const txt = String(curlText||'')
                          const urlMatch = txt.match(/curl\s+[^']*'([^']+)'|curl\s+([^\s]+)/i)
                          const url = (urlMatch && (urlMatch[1]||urlMatch[2])) || settings.whoisApiBaseUrl || ''
                          const headers: Record<string,string> = {}
                          const hMatches = txt.match(/-H\s+'([^']+)'/g) || []
                          hMatches.forEach((h: string) => {
                            const mm = h.match(/-H\s+'([^']+)'/)
                            if (mm && mm[1]) { 
                              const kv = mm[1].split(':')
                              const k = kv.shift()?.trim()||''
                              const v = kv.join(':').trim()
                              if (k.toLowerCase() === 'x-api-key') {
                                setSettings({ ...settings, whoisApiKey: v })
                              }
                            } 
                          })
                          // 提取 base URL (去掉域名部分)
                          const baseUrl = url.replace(/\/whois\/[^/]+$/, '').replace(/\/dns\/[^/]+$/, '').replace(/\/lookup\/[^/]+$/, '')
                          setSettings({ ...settings, whoisApiBaseUrl: baseUrl })
                          showToast(lang==='zh' ? '已导入配置' : 'Config imported', 'success') 
                        } catch { 
                          showToast(lang==='zh' ? '导入失败' : 'Import failed', 'error') 
                        } 
                      }}
                    > 
                      {lang==='zh' ? '导入' : 'Import'} 
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        {/* Auto Check Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-800">{t.autoCheckSettings}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 block">{t.serverAutoCheck}</label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg w-full">
                <input 
                  type="checkbox" 
                  checked={!!settings.serverAutoCheckEnabled}
                  onChange={e => setSettings({...settings, serverAutoCheckEnabled: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-900">{t.enableAutoCheck}</span>
              </label>
              <label className="text-xs text-slate-500 block">{t.serverCheckIntervalHours}</label>
              <input 
                type="number" 
                min={1}
                value={settings.serverAutoCheckIntervalHours || 6}
                onChange={e => setSettings({...settings, serverAutoCheckIntervalHours: Math.max(1, parseInt(e.target.value || '1'))})}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <ImmediateServerCheck lang={lang} />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 block">{t.domainAutoCheck}</label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg w-full">
                <input 
                  type="checkbox" 
                  checked={!!settings.domainAutoCheckEnabled}
                  onChange={e => setSettings({...settings, domainAutoCheckEnabled: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-900">{t.enableAutoCheck}</span>
              </label>
              <label className="text-xs text-slate-500 block">{t.domainCheckFrequency}</label>
              <div className="relative">
                <select 
                  value={settings.domainAutoCheckFrequency || 'daily'}
                  onChange={e => setSettings({...settings, domainAutoCheckFrequency: e.target.value as any})}
                  className="appearance-none w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="daily">{t.daily}</option>
                  <option value="weekly">{t.weekly}</option>
                  <option value="monthly">{t.monthly}</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <ImmediateDomainCheck lang={lang} />
            </div>
          </div>
        </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Bell className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-slate-800">{t.notificationSettings}</h3>
          </div>

        <div className="grid grid-cols-1 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="font-medium text-slate-900 mb-2">{t.notificationPreferences || 'Notification Preferences'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="flex items-center gap-3 cursor-pointer p-2 border border-slate-200 rounded-lg w-full hover:bg-slate-100 transition-colors">
                  <input type="checkbox" checked={!!settings.notifications.preferences?.notifyServerDown} onChange={e => setSettings({ ...settings, notifications: { ...settings.notifications, preferences: { notifyServerDown: e.target.checked, notifyDomainExpiring: !!settings.notifications.preferences?.notifyDomainExpiring } } })} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                  <span className="text-sm text-slate-900">{t.notifyServerDown || 'Notify server down'}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 border border-slate-200 rounded-lg w-full hover:bg-slate-100 transition-colors">
                  <input type="checkbox" checked={!!settings.notifications.preferences?.notifyDomainExpiring} onChange={e => setSettings({ ...settings, notifications: { ...settings.notifications, preferences: { notifyServerDown: !!settings.notifications.preferences?.notifyServerDown, notifyDomainExpiring: e.target.checked } } })} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                  <span className="text-sm text-slate-900">{t.notifyDomainExpiring || 'Notify domain expiring soon'}</span>
                </label>
              </div>
            </div>
            
            {/* Bark */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-slate-900">{t.barkSettings}</h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.notifications.bark.enabled} 
                    onChange={e => setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, enabled: e.target.checked}}})} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              
              {settings.notifications.bark.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">{t.serverUrl}</label>
                     <input type="text" className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${fieldErrors['bark.serverUrl'] ? 'border-rose-300' : 'border-slate-300'}`}
                       value={settings.notifications.bark.serverUrl} onChange={e => setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, serverUrl: e.target.value}}})} />
                     {fieldErrors['bark.serverUrl'] && (<div className="text-xs text-rose-600 mt-1">{fieldErrors['bark.serverUrl']}</div>)}
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">{t.deviceKey}</label>
                     <div className="flex items-center gap-2">
                       <input 
                         type={(settings.notifications.bark as any)._barkKeyVisible ? 'text' : 'password'} 
                         className={`flex-1 mt-1 bg-white border rounded px-3 py-2 text-sm ${fieldErrors['bark.key'] ? 'border-rose-300' : 'border-slate-300'}`} 
                         placeholder={
                           (settings.notifications.bark as any).hasKey && !secretFieldsEdited.barkKey 
                             ? '••••••••（已保存）' 
                             : 'e.g. xWyZ...'
                         }
                         value={
                           (settings.notifications.bark as any)._barkKeyVisible
                             ? (settings.notifications.bark.key || '')
                             : (secretFieldsEdited.barkKey 
                                 ? (settings.notifications.bark.key || '') 
                                 : ''
                               )
                         }
                         onChange={e => {
                           setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, key: e.target.value}}});
                           setSecretFieldsEdited(prev => ({ ...prev, barkKey: true }));
                         }} 
                       />
                       {/* 清除按钮 */}
                       {(settings.notifications.bark as any).hasKey && !secretFieldsEdited.barkKey && (
                         <button 
                           type="button" 
                           className="mt-1 px-2 py-2 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors text-xs" 
                           onClick={() => {
                             setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, key: ''}}});
                             setSecretFieldsEdited(prev => ({ ...prev, barkKey: true }));
                             showToast(lang==='zh' ? '已标记清除，保存后生效' : 'Marked for deletion', 'info');
                           }}
                         >
                           {lang==='zh' ? '清除' : 'Clear'}
                         </button>
                       )}
                       <button 
                        type="button" 
                        className="mt-1 px-3 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors" 
                        onClick={async () => {
                          const visible = (settings.notifications.bark as any)._barkKeyVisible;
                          if (visible) {
                            setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, _barkKeyVisible: false}}});
                            return;
                          }
                          if ((settings.notifications.bark as any).hasKey && !secretFieldsEdited.barkKey) {
                            try {
                              showOverlay(lang==='zh' ? '正在解密...' : 'Decrypting...');
                              const api = await import('../services/apiClient');
                              const k = await api.revealBarkKeyApi();
                              hideOverlay();
                              
                              if (!k || k.trim() === '') {
                                showToast(lang==='zh' ? '无法解密密钥，请重新输入并保存' : 'Cannot decrypt key, please re-enter and save', 'error');
                                setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, key: '', _barkKeyVisible: true, hasKey: false}}});
                                setSecretFieldsEdited(prev => ({ ...prev, barkKey: true }));
                              } else {
                                setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, key: k, _barkKeyVisible: true}}});
                                setSecretFieldsEdited(prev => ({ ...prev, barkKey: true }));
                                showToast(lang==='zh' ? '密钥已显示' : 'Key revealed', 'success');
                              }
                            } catch (e: any) {
                              hideOverlay();
                              showToast(lang==='zh' ? '无法显示密钥，请重新输入并保存' : 'Cannot reveal key, please re-enter and save', 'error');
                              setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, key: '', _barkKeyVisible: true, hasKey: false}}});
                              setSecretFieldsEdited(prev => ({ ...prev, barkKey: true }));
                            }
                          } else {
                            setSettings({...settings, notifications: {...settings.notifications, bark: {...settings.notifications.bark, _barkKeyVisible: true}}});
                          }
                        }}
                      >
                        {(settings.notifications.bark as any)._barkKeyVisible ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                     </div>
                     {fieldErrors['bark.key'] && (<div className="text-xs text-rose-600 mt-1">{fieldErrors['bark.key']}</div>)}
                     {(settings.notifications.bark as any).hasKey && !secretFieldsEdited.barkKey && (
                       <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                         <Check className="w-3 h-3"/> {lang==='zh' ? 'Device Key 已保存（点击眼睛图标可查看）' : 'Device Key saved (click eye icon to view)'}
                       </div>
                     )}
                     {secretFieldsEdited.barkKey && (
                       <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                         {lang==='zh' ? '已修改，保存后生效' : 'Modified, will be saved'}
                       </div>
                     )}
                   </div>
                  <div className="md:col-span-2 flex gap-2">
                    <BarkTestButton settings={settings} lang={lang} />
                  </div>
                </div>
              )}
            </div>

            {/* SMTP */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <Mail className="w-4 h-4 text-slate-500"/>
                   <h4 className="font-medium text-slate-900">{t.smtpSettings}</h4>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.notifications.smtp.enabled} 
                    onChange={e => setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, enabled: e.target.checked}}})} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {settings.notifications.smtp.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                   <div className="md:col-span-2">
                     <label className="text-xs font-semibold text-slate-500 uppercase">{t.fromEmail}</label>
                    <input type="email" required={settings.notifications.smtp.enabled} className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${fieldErrors['smtp.fromEmail'] ? 'border-rose-300' : 'border-slate-300'}`}
                       value={settings.notifications.smtp.fromEmail} onChange={e => setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, fromEmail: e.target.value}}})} />
                    {fieldErrors['smtp.fromEmail'] && (<div className="text-xs text-rose-600 mt-1">{fieldErrors['smtp.fromEmail']}</div>)}
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">{t.smtpHost}</label>
                    <input type="text" required={settings.notifications.smtp.enabled} className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${fieldErrors['smtp.host'] ? 'border-rose-300' : 'border-slate-300'}`}
                       value={settings.notifications.smtp.host} onChange={e => setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, host: e.target.value}}})} />
                    {fieldErrors['smtp.host'] && (<div className="text-xs text-rose-600 mt-1">{fieldErrors['smtp.host']}</div>)}
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">{t.smtpPort}</label>
                    <input type="number" required={settings.notifications.smtp.enabled} min={1} max={65535} className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${fieldErrors['smtp.port'] ? 'border-rose-300' : 'border-slate-300'}`}
                       value={settings.notifications.smtp.port} onChange={e => setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, port: parseInt(e.target.value)}}})} />
                    {fieldErrors['smtp.port'] && (<div className="text-xs text-rose-600 mt-1">{fieldErrors['smtp.port']}</div>)}
                   </div>
                   <div className="flex items-center gap-2">
                     <input type="checkbox" id="smtp-secure" className="w-4 h-4" checked={!!settings.notifications.smtp.secure}
                       onChange={e => setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, secure: e.target.checked}}})} />
                     <label htmlFor="smtp-secure" className="text-sm text-slate-700">{t.smtpSecure || 'Secure (TLS)'}</label>
                   </div>
                   <div className="flex items-center gap-2">
                     <input type="checkbox" id="smtp-requiretls" className="w-4 h-4" checked={!!settings.notifications.smtp.requireTLS}
                       onChange={e => setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, requireTLS: e.target.checked}}})} />
                     <label htmlFor="smtp-requiretls" className="text-sm text-slate-700">{t.smtpRequireTLS || 'Require STARTTLS'}</label>
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">{t.username}</label>
                    <input type="text" required={settings.notifications.smtp.enabled} className={`w-full mt-1 bg-white border rounded px-3 py-2 text-sm ${fieldErrors['smtp.username'] ? 'border-rose-300' : 'border-slate-300'}`}
                       value={settings.notifications.smtp.username} onChange={e => setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, username: e.target.value}}})} />
                    {fieldErrors['smtp.username'] && (<div className="text-xs text-rose-600 mt-1">{fieldErrors['smtp.username']}</div>)}
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">{t.password}</label>
                     <div className="flex items-center gap-2">
                       <input 
                         type={(settings.notifications.smtp as any)._smtpPasswordVisible ? 'text' : 'password'} 
                         required={settings.notifications.smtp.enabled && !(settings.notifications.smtp as any).hasPassword && !secretFieldsEdited.smtpPassword} 
                         className={`flex-1 mt-1 bg-white border rounded px-3 py-2 text-sm ${fieldErrors['smtp.password'] ? 'border-rose-300' : 'border-slate-300'}`}
                         placeholder={
                           (settings.notifications.smtp as any).hasPassword && !secretFieldsEdited.smtpPassword 
                             ? '••••••••（已保存）' 
                             : (lang==='zh' ? '输入密码' : 'Enter password')
                         }
                         value={
                           (settings.notifications.smtp as any)._smtpPasswordVisible
                             ? (settings.notifications.smtp.password || '')
                             : (secretFieldsEdited.smtpPassword 
                                 ? (settings.notifications.smtp.password || '') 
                                 : ''
                               )
                         }
                         onChange={e => {
                           setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, password: e.target.value}}});
                           setSecretFieldsEdited(prev => ({ ...prev, smtpPassword: true }));
                         }} 
                       />
                       {/* 清除按钮 */}
                       {(settings.notifications.smtp as any).hasPassword && !secretFieldsEdited.smtpPassword && (
                         <button 
                           type="button" 
                           className="mt-1 px-2 py-2 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors text-xs" 
                           onClick={() => {
                             setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, password: ''}}});
                             setSecretFieldsEdited(prev => ({ ...prev, smtpPassword: true }));
                             showToast(lang==='zh' ? '已标记清除，保存后生效' : 'Marked for deletion', 'info');
                           }}
                         >
                           {lang==='zh' ? '清除' : 'Clear'}
                         </button>
                       )}
                       <button 
                        type="button" 
                        className="mt-1 px-3 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors" 
                        onClick={async () => {
                          const visible = (settings.notifications.smtp as any)._smtpPasswordVisible;
                          if (visible) {
                            setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, _smtpPasswordVisible: false}}});
                            return;
                          }
                          if ((settings.notifications.smtp as any).hasPassword && !secretFieldsEdited.smtpPassword) {
                            try {
                              showOverlay(lang==='zh' ? '正在解密...' : 'Decrypting...');
                              const api = await import('../services/apiClient');
                              const p = await api.revealSmtpPasswordApi();
                              hideOverlay();
                              
                              if (!p || p.trim() === '') {
                                showToast(lang==='zh' ? '无法解密密码，请重新输入并保存' : 'Cannot decrypt password, please re-enter and save', 'error');
                                setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, password: '', _smtpPasswordVisible: true, hasPassword: false}}});
                                setSecretFieldsEdited(prev => ({ ...prev, smtpPassword: true }));
                              } else {
                                setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, password: p, _smtpPasswordVisible: true}}});
                                setSecretFieldsEdited(prev => ({ ...prev, smtpPassword: true }));
                                showToast(lang==='zh' ? '密码已显示' : 'Password revealed', 'success');
                              }
                            } catch (e: any) {
                              hideOverlay();
                              showToast(lang==='zh' ? '无法显示密码，请重新输入并保存' : 'Cannot reveal password, please re-enter and save', 'error');
                              setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, password: '', _smtpPasswordVisible: true, hasPassword: false}}});
                              setSecretFieldsEdited(prev => ({ ...prev, smtpPassword: true }));
                            }
                          } else {
                            setSettings({...settings, notifications: {...settings.notifications, smtp: {...settings.notifications.smtp, _smtpPasswordVisible: true}}});
                          }
                        }}
                      >
                        {(settings.notifications.smtp as any)._smtpPasswordVisible ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </button>
                     </div>
                     {fieldErrors['smtp.password'] && (<div className="text-xs text-rose-600 mt-1">{fieldErrors['smtp.password']}</div>)}
                     {(settings.notifications.smtp as any).hasPassword && !secretFieldsEdited.smtpPassword && (
                       <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                         <Check className="w-3 h-3"/> {lang==='zh' ? '密码已保存（点击眼睛图标可查看）' : 'Password saved (click eye icon to view)'}
                       </div>
                     )}
                     {secretFieldsEdited.smtpPassword && (
                       <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                         {lang==='zh' ? '已修改，保存后生效' : 'Modified, will be saved'}
                       </div>
                     )}
                   </div>
                  <div className="md:col-span-2 flex gap-2">
                    <SmtpTestButton settings={settings} lang={lang} setSettings={setSettings} />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="flex justify-end sticky bottom-6">
           <div className="bg-white/80 backdrop-blur p-2 rounded-lg shadow-lg border border-slate-200 flex items-center gap-4">
             {saved && <span className="text-emerald-600 text-sm font-medium flex items-center gap-1 animate-in fade-in ml-2"><Check className="w-4 h-4"/> Changes Saved</span>}
             <button 
               type="submit" 
               className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium shadow-md shadow-slate-900/10"
             >
               <Save className="w-4 h-4" />
               {t.saveChanges}
             </button>
           </div>
        </div>

      </form>
    </div>
  );
};

const ImmediateServerCheck: React.FC<{ lang: Language }> = ({ lang }) => {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<{ id: string, name: string, reachable: boolean }[]>([])
  const t = translations[lang]
  const run = async () => {
    setLoading(true)
    setOpen(false)
    setProgress(0)
    const timer = setInterval(() => setProgress(p => (p < 90 ? p + 10 : p)), 200)
    try {
      const res = await (await fetch((import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1') + '/servers/check', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('serdo_auth_token') || ''}` }, body: JSON.stringify({}) })).json()
      setResults(res.results || [])
      setOpen(true)
    } finally { setLoading(false) }
    clearInterval(timer)
    setProgress(100)
  }
  return (
    <div className="space-y-2">
      <button disabled={loading} onClick={run} type="button" className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
        {loading ? t.checking : t.checkServersNow}
      </button>
      {loading && (
        <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
          <div className="h-2 bg-indigo-600 transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      {open && (
        <ResultsModal title={t.checkServersNow} onClose={() => setOpen(false)}>
          {results.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{r.name}</span>
              <span className={r.reachable ? 'text-emerald-600' : 'text-rose-600'}>{r.reachable ? t.pingOk : t.pingFail}</span>
            </div>
          ))}
        </ResultsModal>
      )}
    </div>
  )
}

const ImmediateDomainCheck: React.FC<{ lang: Language }> = ({ lang }) => {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<{ id: string, name: string, ok: boolean, expirationDate?: string }[]>([])
  const t = translations[lang]
  const run = async () => {
    setLoading(true)
    setOpen(false)
    setProgress(0)
    try {
      const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1')
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('serdo_auth_token') || ''}` }
      const domains = await (await fetch(`${BASE}/domains`, { headers })).json()
      const total = Array.isArray(domains) ? domains.length : 0
      const out: { id: string, name: string, ok: boolean, expirationDate?: string }[] = []
      for (let i = 0; i < total; i++) {
        const d = domains[i]
        try {
          const next = await (await fetch(`${BASE}/domains/${encodeURIComponent(d.id)}/sync`, { method: 'POST', headers, body: JSON.stringify({}) })).json()
          out.push({ id: d.id, name: d.name, ok: !!next.expirationDate, expirationDate: next.expirationDate })
        } catch {
          out.push({ id: d.id, name: d.name, ok: false, expirationDate: d.expirationDate })
        }
        setProgress(Math.round(((i + 1) / Math.max(1, total)) * 100))
      }
      setResults(out)
      setOpen(true)
    } finally { setLoading(false) }
    setProgress(100)
  }
  return (
    <div className="space-y-2">
      <button disabled={loading} onClick={run} type="button" className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
        {loading ? t.checking : t.checkDomainsNow}
      </button>
      {loading && (
        <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
          <div className="h-2 bg-indigo-600 transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      {open && (
        <ResultsModal title={t.checkDomainsNow} onClose={() => setOpen(false)}>
          {results.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{r.name}</span>
              <div className="flex items-center gap-3">
                <span className={r.ok ? 'text-emerald-600' : 'text-rose-600'}>{r.ok ? t.expiryOk : t.expiryFail}</span>
                {r.expirationDate && <span className="text-slate-500">{r.expirationDate}</span>}
              </div>
            </div>
          ))}
        </ResultsModal>
      )}
    </div>
  )
}

const ResultsModal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-[90%] max-w-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-slate-800">{title}</h4>
          <button onClick={onClose} type="button" className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg">关闭</button>
        </div>
        <div className="max-h-96 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

const BarkTestButton: React.FC<{ settings: ISystemSettings, lang: Language }> = ({ settings, lang }) => {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<string>('')
  const t = translations[lang]
  const run = async () => {
    setLoading(true)
    setOpen(false)
    try {
      const url = `${settings.notifications.bark.serverUrl.replace(/\/$/, '')}/${encodeURIComponent(settings.notifications.bark.key)}`
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Serdo', body: 'Notification Test' }) })
      setResult(res.ok ? (t.testSuccess || 'Test sent') : `${t.testFailed || 'Test failed'} (${res.status})`)
      setOpen(true)
    } catch (e: any) {
      setResult(`${t.testFailed || 'Test failed'}: ${String(e?.message || e)}`)
      setOpen(true)
    } finally { setLoading(false) }
  }
  return (
    <div className="space-y-2">
      <button disabled={loading} onClick={run} type="button" className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{t.sendTest || 'Send Test'}</button>
      {open && (
        <ResultsModal title={t.barkSettings} onClose={() => setOpen(false)}>
          <div className="text-sm text-slate-700">{result}</div>
        </ResultsModal>
      )}
    </div>
  )
}

const SmtpTestButton: React.FC<{ settings: ISystemSettings, lang: Language, setSettings: (s: ISystemSettings) => void }> = ({ settings, lang, setSettings }) => {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<string>('')
  const [testTo, setTestTo] = useState(settings.notifications.smtp.fromEmail || '')
  const t = translations[lang]
  const run = async () => {
    setLoading(true)
    setOpen(false)
    try {
      const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1') as string
      const ts = new Date().toISOString().replace('T',' ').slice(0,19)
      const subject = 'Serdo SMTP Test'
      const bodyText = `这是一封来自 Serdo 的 SMTP 测试邮件。发送时间：${ts}`
      const res = await fetch(`${BASE}/notifications/smtp/test`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('serdo_auth_token') || ''}` }, body: JSON.stringify({ smtp: settings.notifications.smtp, to: testTo || settings.notifications.smtp.fromEmail, subject, body: bodyText }) })
      let detail = ''
      try { 
        const j = await res.json(); 
        if (j?.error) detail = String(j.error)
        else if (j?.messageId) detail = `id=${j.messageId}`
        if (j?.meta) {
          const extras = ['code','command','response','responseCode'].map(k => j.meta[k]).filter(Boolean)
          if (extras.length) detail = detail ? `${detail} | ${extras.join(' | ')}` : extras.join(' | ')
        }
      } catch {}
      const ok = res.ok
      setResult(ok ? `${t.testSuccess || 'Test sent'} · ${t.to || 'To'}: ${testTo || settings.notifications.smtp.fromEmail} · ${ts}${detail ? ` · ${detail}` : ''}` : `${t.testFailed || 'Test failed'} (${res.status})${detail ? `: ${detail}` : ''}`)
      try {
        const infoId = /id=([^\s]+)/.test(detail) ? RegExp.$1 : undefined
        const last = ok 
          ? { ok: true, at: Date.now(), to: (testTo || settings.notifications.smtp.fromEmail), subject, messageId: infoId }
          : { ok: false, at: Date.now(), to: (testTo || settings.notifications.smtp.fromEmail), subject, error: detail }
        const next = Object.assign({}, settings, { notifications: Object.assign({}, settings.notifications, { smtp: Object.assign({}, settings.notifications.smtp, { lastTest: last }) }) })
        setSettings(next)
        try {
          const api = await import('../services/apiClient')
          const s = await api.getSettingsApi()
          if (s) setSettings(s as ISystemSettings)
        } catch {}
      } catch {}
      setOpen(true)
    } catch (e: any) {
      setResult(`${t.testFailed || 'Test failed'}: ${String(e?.message || e)}`)
      setOpen(true)
    } finally { setLoading(false) }
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder={t.to || 'To'} className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-sm" />
        <button disabled={loading} onClick={run} type="button" className="px-3 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{t.sendTest || 'Send Test'}</button>
      </div>
      {settings.notifications.smtp.lastTest && (
        <div className="text-xs text-slate-600">
          <span className="font-semibold">{t.lastTest || 'Last Test'}:</span> {new Date(settings.notifications.smtp.lastTest.at || 0).toLocaleString()} · {settings.notifications.smtp.lastTest.ok ? (t.success || 'Success') : (t.failed || 'Failed')}
          {settings.notifications.smtp.lastTest.to && ` · ${t.to || 'To'}: ${settings.notifications.smtp.lastTest.to}`}
          {settings.notifications.smtp.lastTest.messageId && ` · id=${settings.notifications.smtp.lastTest.messageId}`}
        </div>
      )}
      {open && (
        <ResultsModal title={t.smtpSettings} onClose={() => setOpen(false)}>
          <div className="text-sm text-slate-700">{result}</div>
        </ResultsModal>
      )}
    </div>
  )
}
