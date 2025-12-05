
import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { PixelFieldBackground } from './PixelFieldBackground';
import { translations, Language } from '../utils/translations';
import { User } from '../types';
import { loginUser } from '../services/dataService';
import { loginUserApi, registerUserApi } from '../services/apiClient';
import { registerUser } from '../services/dataService';

interface LoginProps {
  lang: Language;
  onLogin: (user: User) => void;
  onSwitchToRegister: () => void;
  setLang: (lang: Language) => void;
}

export const Login: React.FC<LoginProps> = ({ lang, onLogin, onSwitchToRegister, setLang }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState<{ open: boolean, mode: 'login' | 'register' }>({ open: false, mode: 'login' })
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regInvite, setRegInvite] = useState('')
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regSuccess, setRegSuccess] = useState('')
  const [regUsernameErr, setRegUsernameErr] = useState('')
  const [regEmailErr, setRegEmailErr] = useState('')
  const [regPasswordErr, setRegPasswordErr] = useState('')
  const [regConfirmErr, setRegConfirmErr] = useState('')
  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const useApi = import.meta.env.VITE_USE_API === 'true';
    try {
      const user = useApi ? await loginUserApi(username, password) : loginUser(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError(t.invalidCreds);
      }
    } catch (err: any) {
      let msg = String(err?.message || '')
      try { const j = JSON.parse(msg); if (j.code === 'account_expired') msg = (t.accountExpired || 'Account expired') } catch {}
      if (msg === 'account_expired') setError(t.accountExpired || 'Account expired')
      else setError(t.invalidCreds);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(''); setRegSuccess(''); setRegLoading(true)
    const emailRegex = /.+@.+\..+/
    const uname = regUsername.trim()
    const mail = regEmail.trim()
    if (!uname) { setRegUsernameErr(t.invalidUsername); setRegError(t.invalidUsername); setRegLoading(false); return }
    if (!emailRegex.test(mail)) { setRegEmailErr(t.invalidEmail); setRegError(t.invalidEmail); setRegLoading(false); return }
    if ((regPassword||'').length < 6) { setRegPasswordErr(t.passwordTooShort); setRegError(t.passwordTooShort); setRegLoading(false); return }
    if (regPassword !== regConfirm) { setRegConfirmErr(t.passwordMismatch); setRegError(t.passwordMismatch); setRegLoading(false); return }
    try {
      const useApi = import.meta.env.VITE_USE_API === 'true'
      const newUser = useApi ? await registerUserApi(regUsername, regEmail, regPassword, regInvite.trim() || undefined) : registerUser({ username: regUsername, email: regEmail, password: regPassword })
      if (!newUser) { setRegError(t.usernameTaken); }
      else {
        setRegSuccess(t.registerSuccess || 'Registered successfully. Signed in.')
        const signedIn = useApi ? await loginUserApi(regUsername, regPassword) : loginUser(regUsername, regPassword)
        if (signedIn) {
          const safe = { id: signedIn.id, username: signedIn.username || regUsername, email: signedIn.email || regEmail }
          onLogin(safe as any);
          setShowModal({ open:false, mode:'login' })
        }
      }
    } catch (err: any) {
      let msg = String(err?.message || '')
      try { 
        const j = JSON.parse(msg); 
        if (j.code === 'username_taken') msg = t.usernameTaken
        else if (j.code === 'weak_password') msg = t.passwordTooShort
        else if (j.code === 'invalid_email') msg = t.invalidEmail
        else if (j.code === 'invalid_username') msg = t.invalidUsername
        else if (j.code === 'invite_required') msg = (t.inviteRequired || 'Invite code required')
        else if (j.code === 'invalid_invite') msg = (t.invalidInvite || 'Invalid invite code')
        else if (j.code === 'invite_expired') msg = (t.inviteExpired || 'Invite expired')
        else if (j.code === 'invalid') {
          if (!emailRegex.test(mail)) msg = t.invalidEmail
          else if ((regPassword||'').length < 6) msg = t.passwordTooShort
          else if (!uname) msg = t.invalidUsername
        }
      } catch {}
      if (msg === 'invalid') {
        if (!emailRegex.test(mail)) msg = t.invalidEmail
        else if ((regPassword||'').length < 6) msg = t.passwordTooShort
        else if (!uname) msg = t.invalidUsername
      }
      if (!msg) msg = t.usernameTaken
      setRegError(msg)
    } finally { setRegLoading(false) }
  }

  return (
    <>
    <div className="min-h-screen flex items-center justify-center bg-transparent relative overflow-hidden">
      <PixelFieldBackground />
      <div className="absolute top-4 right-4 z-10">
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
             <button onClick={() => setLang('en')} className={`px-2 py-1 rounded text-xs font-semibold transition-all ${lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>EN</button>
             <button onClick={() => setLang('zh')} className={`px-2 py-1 rounded text-xs font-semibold transition-all ${lang === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>中文</button>
          </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-emerald-400/60 bg-black/40 backdrop-blur">Serdo</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{t.loginTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{t.loginSubtitle}</p>
          <p className="mt-4 text-sm text-slate-300">{t.heroDescription}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">{t.featuresServers}</span>
            <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">{t.featuresDomainExpire}</span>
            <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">{t.featuresDnsSync}</span>
            <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">{t.featuresNotifications}</span>
          </div>
          
        </div>
        <div className="w-full flex md:justify-end">
          <div className="mt-8 flex gap-4 justify-start md:justify-end">
            <button onClick={() => setShowModal({ open: true, mode: 'login' })} className="px-5 py-3 rounded-full text-sm md:text-base font-semibold tracking-wide" style={{ background:'linear-gradient(135deg,#00ffb2,#60ffe1)', color:'#00110b', boxShadow:'0 12px 24px rgba(0,255,178,.45)'}}>{t.loginLink}</button>
            <button onClick={() => setShowModal({ open: true, mode: 'register' })} className="px-5 py-3 rounded-full text-sm md:text-base font-semibold tracking-wide border border-white/40 bg-transparent text-white hover:bg-white/10">{t.registerLink}</button>
          </div>
        </div>
      </div>
    </div>
    {showModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="w-full max-w-md rounded-2xl p-8 shadow-xl border" style={{ borderColor:'rgba(255,255,255,.18)', background:'rgba(8,12,16,.35)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)'}}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-10 h-10" viewBox="0 0 120 120" fill="none">
                <defs>
                  <linearGradient id="lg_modal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366F1"/>
                    <stop offset="50%" stopColor="#22C55E"/>
                    <stop offset="100%" stopColor="#F59E0B"/>
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="46" stroke="url(#lg_modal)" strokeWidth="6" opacity="0.6"/>
                <path d="M30 70 C55 45, 85 45, 110 70" stroke="url(#lg_modal)" strokeWidth="6" fill="none"/>
              </svg>
              <div>
                <div className="text-white font-semibold">{showModal.mode === 'login' ? t.loginTitle : t.registerTitle}</div>
                <div className="text-slate-300 text-xs">{t.loginSubtitle}</div>
              </div>
            </div>
            <button className="text-slate-300" onClick={() => setShowModal({ open:false, mode:'login' })}>✕</button>
          </div>
          {showModal.mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.username}</label>
                <input required type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.password}</label>
                <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"/>
              </div>
              {error && (<div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm text-center border border-rose-100">{error}</div>)}
              <button type="submit" className="w-full py-2.5 rounded-xl font-semibold" style={{ background:'linear-gradient(135deg,#00ffb2,#60ffe1)', color:'#00110b' }}>{t.loginBtn}</button>
              <div className="mt-3 text-center text-xs text-slate-300">
                {t.noAccount} <button onClick={() => setShowModal({ open:true, mode:'register' })} className="text-indigo-300 font-semibold hover:underline">{t.registerLink}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.username}</label>
                <input required type="text" value={regUsername} onChange={e=>{ setRegUsername(e.target.value); const v=e.target.value.trim(); setRegUsernameErr(v? '' : t.invalidUsername) }} className={`w-full px-3 py-2 rounded-xl border ${regUsernameErr ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${regUsernameErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}/>
                {regUsernameErr && <div className="mt-1 text-xs text-rose-400">{regUsernameErr}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.email}</label>
                <input required type="email" value={regEmail} onChange={e=>{ setRegEmail(e.target.value); const v=e.target.value.trim(); const emailRegex=/.+@.+\..+/; setRegEmailErr(emailRegex.test(v)? '' : t.invalidEmail) }} className={`w-full px-3 py-2 rounded-xl border ${regEmailErr ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${regEmailErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}/>
                {regEmailErr && <div className="mt-1 text-xs text-rose-400">{regEmailErr}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.password}</label>
                <input required type="password" value={regPassword} onChange={e=>{ setRegPassword(e.target.value); const v=e.target.value; setRegPasswordErr(v.length>=6? '' : t.passwordTooShort); setRegConfirmErr(regConfirm && v===regConfirm? '' : (regConfirm? t.passwordMismatch : '')) }} className={`w-full px-3 py-2 rounded-xl border ${regPasswordErr ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${regPasswordErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}/>
                {regPasswordErr && <div className="mt-1 text-xs text-rose-400">{regPasswordErr}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.confirmPassword}</label>
                <input required type="password" value={regConfirm} onChange={e=>{ setRegConfirm(e.target.value); const v=e.target.value; setRegConfirmErr(v===regPassword? '' : t.passwordMismatch) }} className={`w-full px-3 py-2 rounded-xl border ${regConfirmErr ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${regConfirmErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}/>
                {regConfirmErr && <div className="mt-1 text-xs text-rose-400">{regConfirmErr}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.inviteCode || 'Invite Code'}</label>
                <input type="text" value={regInvite} onChange={e=>setRegInvite(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"/>
              </div>
              {regError && (<div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm text-center border border-rose-100">{regError === 'invalid' ? (regEmailErr || regPasswordErr || regUsernameErr || regConfirmErr || t.usernameTaken) : regError}</div>)}
              {regSuccess && (<div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm text-center border border-emerald-100">{regSuccess}</div>)}
              <button type="submit" disabled={regLoading || !!regUsernameErr || !!regEmailErr || !!regPasswordErr || !!regConfirmErr} className="w-full py-2.5 rounded-xl font-semibold disabled:opacity-60" style={{ background:'linear-gradient(135deg,#00ffb2,#60ffe1)', color:'#00110b' }}>{t.registerBtn}</button>
              <div className="mt-3 text-center text-xs text-slate-300">
                {t.haveAccount} <button onClick={() => setShowModal({ open:true, mode:'login' })} className="text-indigo-300 font-semibold hover:underline">{t.loginLink}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    )}
    </>
  );
};
