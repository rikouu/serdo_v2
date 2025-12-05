
import React, { useState, useEffect } from 'react';
import { UserProfile as IUserProfile, Language } from '../types';
import { getMeApi, updateMeApi, verifyPasswordApi, loginUserApi, exportUserDataApi, importUserDataApi } from '../services/apiClient';
import { translations } from '../utils/translations';
import { User, Mail, Lock, Check, Eye, EyeOff } from 'lucide-react';

interface UserProfileProps {
  userId: string;
  lang: Language;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, lang }) => {
  const [profile, setProfile] = useState<IUserProfile | null>(null);
  const [initialEmail, setInitialEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [emailError, setEmailError] = useState('')
  const [newPasswordError, setNewPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [exportData, setExportData] = useState<string>('')
  const [importData, setImportData] = useState<string>('')
  const [copiedKey, setCopiedKey] = useState<boolean>(false)
  const [importing, setImporting] = useState<boolean>(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const showToast = (text: string, type: 'success' | 'error' = 'success') => { setToast({ text, type }); setTimeout(()=>setToast(null), 1800) }
  const [currentError, setCurrentError] = useState('')
  
  const t = translations[lang];

  useEffect(() => {
    getMeApi().then(res => {
      const u = res.user as any
      const p = { username: u?.username || 'Unknown', email: u?.email || '', expiresAt: Number(u?.expiresAt || 0) }
      setProfile(p)
      setInitialEmail(p.email)
    }).catch(err => {
      console.error('[UserProfile] Failed to load profile:', err)
    })
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');

    // If changing password, validation required
    if (newPassword) {
        if (!currentPassword) {
            setError(t.currentPasswordRequired);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t.passwordMismatch);
            return;
        }
        if (newPassword.length < 6) {
            setError(t.passwordTooShort);
            return;
        }
        try {
            const ok = await verifyPasswordApi(currentPassword)
            if (!ok) { setError(t.invalidCurrentPassword); return }
        } catch {
            setError(t.invalidCurrentPassword);
            return;
        }
    } else if (currentPassword) {
         // User entered current password but no new password
        try {
            const ok = await verifyPasswordApi(currentPassword)
            if (!ok) { setError(t.invalidCurrentPassword); return }
        } catch {
            setError(t.invalidCurrentPassword);
            return;
        }
    }
    
    const updatedProfile = { ...profile };
    const emailWillChange = String(updatedProfile.email || '') !== String(initialEmail || '')
    const emailRegex = /.+@.+\..+/
    if (emailWillChange && !emailRegex.test(String(updatedProfile.email || ''))) {
      setError(t.invalidEmail)
      return
    }
    if (emailWillChange && !currentPassword) {
      setError(t.currentPasswordRequired)
      return
    }
    if (newPassword) {
      updatedProfile.password = newPassword;
    }
    try {
      const u = await updateMeApi(updatedProfile.email, updatedProfile.password, currentPassword)
      setProfile({ username: u?.username || updatedProfile.username, email: u?.email || updatedProfile.email })
      if (newPassword) {
        try {
          const reauth = await loginUserApi(profile.username, newPassword)
          if (!reauth) throw new Error('reauth_failed')
        } catch {
          setError(t.loadFailed || '保存失败')
          return
        }
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      let msg = t.loadFailed || '保存失败'
      try {
        const m = String(e?.message || '')
        const j = JSON.parse(m)
        if (j) {
          if (j.code === 'invalid_current_password') msg = t.invalidCurrentPassword
          else if (j.code === 'current_password_required') msg = t.currentPasswordRequired
          else if (j.code === 'weak_password') msg = t.passwordTooShort
          else if (j.code === 'invalid_email') msg = t.invalidEmail
          else if (j.code === 'unauthorized') msg = t.invalidCreds
          else if (j.code === 'invalid') {
            const emailWillChange = String(profile.email || '') !== String(initialEmail || '')
            const emailRegex = /.+@.+\..+/
            if (emailWillChange && !emailRegex.test(String(profile.email || ''))) msg = t.invalidEmail
            else if (newPassword && newPassword.length < 6) msg = t.passwordTooShort
            else if (newPassword && !currentPassword) msg = t.currentPasswordRequired
            else msg = t.loadFailed || '保存失败'
          }
        }
      } catch {
        const m = String(e?.message || '')
        if (m === 'invalid' || /(^|\b)invalid(\b|$)/i.test(m)) {
          const emailWillChange = String(profile.email || '') !== String(initialEmail || '')
          const emailRegex = /.+@.+\..+/
          if (emailWillChange && !emailRegex.test(String(profile.email || ''))) msg = t.invalidEmail
          else if (newPassword && newPassword.length < 6) msg = t.passwordTooShort
          else if (newPassword && !currentPassword) msg = t.currentPasswordRequired
        }
        if (/invalid_current_password/i.test(m)) msg = t.invalidCurrentPassword
        else if (/weak_password/i.test(m)) msg = t.passwordTooShort
        else if (/current_password_required/i.test(m)) msg = t.currentPasswordRequired
        else if (/unauthorized/i.test(m)) msg = t.invalidCreds
      }
      setError(msg)
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow border text-sm ${toast.type==='success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{toast.text}</div>
      )}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t.userProfile}</h2>
        <p className="text-slate-500 text-sm">{t.profileSubtitle}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm border border-rose-100 text-center">{
            (() => {
              const emailRegex = /.+@.+\..+/
              if (error === 'invalid' || /(^|\b)invalid(\b|$)/i.test(error)) {
                const emailWillChange = String(profile.email || '') !== String(initialEmail || '')
                if (emailWillChange && !emailRegex.test(String(profile.email || ''))) return t.invalidEmail
                if (newPassword && newPassword.length < 6) return t.passwordTooShort
                if (newPassword && !currentPassword) return t.currentPasswordRequired
              }
              return error
            })()
          }</div>}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">{t.username}</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={profile.username} 
                  disabled
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">{t.email}</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={profile.email} 
                  onChange={e => { const v=e.target.value; setProfile({...profile, email: v}); const emailRegex=/.+@.+\..+/; setEmailError(emailRegex.test(v)? '' : t.invalidEmail) }}
                  className={`w-full pl-10 pr-3 py-2 border ${emailError? 'border-rose-400' : 'border-slate-300'} rounded-lg bg-white text-slate-900 focus:ring-2 focus:outline-none ${emailError? 'focus:ring-rose-400' : 'focus:ring-indigo-500'}`}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              {emailError && <div className="mt-1 text-xs text-rose-600">{emailError}</div>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">{lang==='zh' ? '账号到期时间' : 'Account Expiry'}</label>
              <div className="text-sm text-slate-600">
                {profile && (profile as any).expiresAt ? new Date((profile as any).expiresAt).toISOString().slice(0,16).replace('T',' ') : (lang==='zh' ? '无限制' : 'Unlimited')}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4">
                 <h3 className="text-sm font-bold text-slate-900 mb-4">Change Password</h3>
                 
                 <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">{t.currentPassword}</label>
                        <div className="relative">
                            <input 
                            type={showCurrent ? "text" : "password"}
                            value={currentPassword}
                            onChange={e => { setCurrentPassword(e.target.value); const v=e.target.value; setCurrentError(v? '' : t.currentPasswordRequired) }}
                            className={`w-full pl-10 pr-10 py-2 border ${currentError? 'border-rose-400' : 'border-slate-300'} rounded-lg bg-white text-slate-900 focus:ring-2 focus:outline-none ${currentError? 'focus:ring-rose-400' : 'focus:ring-indigo-500'}`}
                            />
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showCurrent ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            </button>
                          </div>
                          {currentError && <div className="mt-1 text-xs text-rose-600">{currentError}</div>}
                        </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">{t.newPassword}</label>
                            <div className="relative">
                                <input 
                                type={showNew ? "text" : "password"}
                                value={newPassword}
                                onChange={e => { setNewPassword(e.target.value); const v=e.target.value; setNewPasswordError(v.length>=6? '' : t.passwordTooShort); setConfirmError(confirmPassword && v===confirmPassword? '' : (confirmPassword? t.passwordMismatch : '')) }}
                                className={`w-full pl-10 pr-10 py-2 border ${newPasswordError? 'border-rose-400' : 'border-slate-300'} rounded-lg bg-white text-slate-900 focus:ring-2 focus:outline-none ${newPasswordError? 'focus:ring-rose-400' : 'focus:ring-indigo-500'}`}
                                />
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showNew ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                              </div>
                              {newPasswordError && <div className="mt-1 text-xs text-rose-600">{newPasswordError}</div>}
                            </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">{t.confirmPassword}</label>
                            <div className="relative">
                                <input 
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); const v=e.target.value; setConfirmError(v===newPassword? '' : t.passwordMismatch) }}
                                className={`w-full pl-10 pr-10 py-2 border ${confirmError? 'border-rose-400' : 'border-slate-300'} rounded-lg bg-white text-slate-900 focus:ring-2 focus:outline-none ${confirmError? 'focus:ring-rose-400' : 'focus:ring-indigo-500'}`}
                                />
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showConfirm ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                              </div>
                              {confirmError && <div className="mt-1 text-xs text-rose-600">{confirmError}</div>}
                            </div>
                    </div>
                 </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
             {saved && <span className="text-emerald-600 text-sm flex items-center gap-1 animate-in fade-in"><Check className="w-4 h-4"/> {t.profileSaved}</span>}
             <button 
               type="submit"
               className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
               disabled={!!emailError || !!newPasswordError || !!confirmError || !!currentError}
             >
               {t.saveProfile}
             </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Data Export / Import</h3>
          <div className="flex items-center gap-2">
            <button onClick={async()=>{ try { const d = await exportUserDataApi(); setExportData(JSON.stringify(d, null, 2)); showToast('Exported', 'success') } catch { showToast('Export failed', 'error') } }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg">Export My Data</button>
            <button onClick={()=>{ navigator.clipboard.writeText(exportData).then(()=>{ setCopiedKey(true); setTimeout(()=>setCopiedKey(false), 1000); showToast('Copied', 'success') }) }} className="px-3 py-2 bg-slate-900 text-white rounded-lg">{copiedKey ? 'Copied' : 'Copy'}</button>
          </div>
          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs" rows={8} value={exportData} onChange={e=>setExportData(e.target.value)} />
          <div className="flex items-center gap-2">
            <button onClick={async()=>{ try { setImporting(true); const obj = JSON.parse(importData); const ok = await importUserDataApi(obj); if (ok) { setExportData(''); setImportData(''); showToast('Imported', 'success') } else { showToast('Import failed', 'error') } } catch { showToast('Invalid JSON', 'error') } finally { setImporting(false) } }} className="px-3 py-2 bg-emerald-600 text-white rounded-lg">Import My Data</button>
          </div>
          {importing && (
            <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                <div className="text-slate-700 text-sm">Importing…</div>
              </div>
            </div>
          )}
          <textarea className="w-full bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs" rows={8} placeholder="Paste your JSON data to import" value={importData} onChange={e=>setImportData(e.target.value)} />
        </div>
      </div>
    </div>
  );
};
