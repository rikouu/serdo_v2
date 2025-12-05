
import React, { useState } from 'react';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { PixelFieldBackground } from './PixelFieldBackground';
import { translations, Language } from '../utils/translations';
import { registerUser } from '../services/dataService';
import { registerUserApi } from '../services/apiClient';
import { User } from '../types';

interface RegisterProps {
  lang: Language;
  onRegisterSuccess: (user: User) => void;
  onSwitchToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ lang, onRegisterSuccess, onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState<{ open: boolean, mode: 'register' }>({ open: false, mode: 'register' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const t = translations[lang];
  const emailRegex = /.+@.+\..+/;
  const [usernameError, setUsernameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true)

    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      setConfirmError(t.passwordMismatch)
      return;
    }
    const uname = username.trim()
    const mail = email.trim()
    if (!uname || !mail || !password || !confirmPassword) {
      setError(t.usernameTaken);
      setLoading(false)
      return;
    }
    if (password.length < 6) {
      setError(t.passwordTooShort)
      setPasswordError(t.passwordTooShort)
      setLoading(false)
      return;
    }
    const emailRegex = /.+@.+\..+/
    if (!emailRegex.test(mail)) {
      setError(t.invalidEmail)
      setEmailError(t.invalidEmail)
      setLoading(false)
      return
    }
    setUsernameError('')
    setEmailError('')
    setPasswordError('')
    setConfirmError('')

    try {
      const useApi = import.meta.env.VITE_USE_API === 'true';
      try { console.log('[ui] register.submit', { username: uname, email: mail, useApi }) } catch {}
      const newUser = useApi ? await registerUserApi(uname, mail, password, inviteCode.trim() || undefined) : registerUser({ username: uname, email: mail, password });
      if (!newUser) {
        setError(t.usernameTaken);
      } else {
        const safe = { id: newUser.id, username: newUser.username || uname, email: newUser.email || mail }
        setSuccess(t.registerSuccess || 'Registered successfully. Signed in.')
        setTimeout(() => {
          try { onRegisterSuccess(safe as any) } catch {}
          setShowModal({ open: false, mode: 'register' })
        }, 900)
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
          const emailRegex = /.+@.+\..+/
          if (!emailRegex.test(mail)) msg = t.invalidEmail
          else if (password.length < 6) msg = t.passwordTooShort
          else if (!uname) msg = t.invalidUsername
          else msg = t.usernameTaken
        }
      } catch {}
      if (msg === 'invalid' || /(^|\b)invalid(\b|$)/i.test(msg)) {
        const emailRegex = /.+@.+\..+/
        if (!emailRegex.test(mail)) msg = t.invalidEmail
        else if (password.length < 6) msg = t.passwordTooShort
        else if (!uname) msg = t.invalidUsername
        else msg = t.usernameTaken
      }
      if (!msg) msg = t.usernameTaken
      setError(msg);
      try { console.error('register failed', err) } catch {}
    } finally { setLoading(false) }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent relative overflow-hidden">
      <PixelFieldBackground />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-emerald-400/60 bg-black/40 backdrop-blur">Serdo</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{t.registerTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{t.registerSubtitle}</p>
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
            <button onClick={onSwitchToLogin} className="px-5 py-3 rounded-full text-sm md:text-base font-semibold tracking-wide" style={{ background:'linear-gradient(135deg,#00ffb2,#60ffe1)', color:'#00110b', boxShadow:'0 12px 24px rgba(0,255,178,.45)'}}>{t.loginLink}</button>
            <button onClick={() => setShowModal({ open: true, mode: 'register' })} className="px-5 py-3 rounded-full text-sm md:text-base font-semibold tracking-wide border border-white/40 bg-transparent text-white hover:bg-white/10">{t.registerLink}</button>
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
                    <linearGradient id="lg_reg_modal" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#0EA5E9"/>
                      <stop offset="50%" stopColor="#8B5CF6"/>
                      <stop offset="100%" stopColor="#22C55E"/>
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r="40" stroke="url(#lg_reg_modal)" strokeWidth="6"/>
                  <path d="M30 70 C55 45, 85 45, 110 70" stroke="url(#lg_reg_modal)" strokeWidth="6" fill="none"/>
                </svg>
                <div>
                  <div className="text-white font-semibold">{t.registerTitle}</div>
                  <div className="text-slate-300 text-xs">{t.registerSubtitle}</div>
                </div>
              </div>
              <button className="text-slate-300" onClick={() => setShowModal({ open:false, mode:'register' })}>✕</button>
            </div>
            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-4 text-center border border-rose-100">{
                (() => {
                  if (error === 'invalid' || /(^|\b)invalid(\b|$)/i.test(error)) {
                    if (!emailRegex.test(email.trim())) return t.invalidEmail
                    if (password.length < 6) return t.passwordTooShort
                    if (!username.trim()) return t.invalidUsername
                  }
                  return error
                })()
              }</div>
            )}
            {success && (
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm mb-4 text-center border border-emerald-100">{success}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.username}</label>
                <input
                  required
                  type="text"
                  value={username}
                  onChange={e=>{ setUsername(e.target.value); const v=e.target.value.trim(); setUsernameError(v? '' : t.invalidUsername) }}
                  className={`w-full px-3 py-2 rounded-xl border ${usernameError ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${usernameError ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}
                />
                {usernameError && <div className="mt-1 text-xs text-rose-400">{usernameError}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.email}</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e=>{ setEmail(e.target.value); const v=e.target.value.trim(); setEmailError(emailRegex.test(v)? '' : t.invalidEmail) }}
                  className={`w-full px-3 py-2 rounded-xl border ${emailError ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${emailError ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}
                />
                {emailError && <div className="mt-1 text-xs text-rose-400">{emailError}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.password}</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={e=>{ setPassword(e.target.value); const v=e.target.value; setPasswordError(v.length>=6? '' : t.passwordTooShort); setConfirmError(confirmPassword && v===confirmPassword? '' : (confirmPassword? t.passwordMismatch : '')) }}
                  className={`w-full px-3 py-2 rounded-xl border ${passwordError ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${passwordError ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}
                />
                {passwordError && <div className="mt-1 text-xs text-rose-400">{passwordError}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.confirmPassword}</label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={e=>{ setConfirmPassword(e.target.value); const v=e.target.value; setConfirmError(v===password? '' : t.passwordMismatch) }}
                  className={`w-full px-3 py-2 rounded-xl border ${confirmError ? 'border-rose-400' : 'border-white/20'} bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${confirmError ? 'focus:border-rose-400' : 'focus:border-emerald-400'}`}
                />
                {confirmError && <div className="mt-1 text-xs text-rose-400">{confirmError}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">{t.inviteCode || 'Invite Code'}</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e=> setInviteCode(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400`}
                  placeholder={(t.inviteRequiredHint || 'Required if admin enabled') as any}
                />
              </div>
              <button type="submit" disabled={loading || !!usernameError || !!emailError || !!passwordError || !!confirmError} className="w-full py-2.5 rounded-xl font-semibold disabled:opacity-60" style={{ background:'linear-gradient(135deg,#00ffb2,#60ffe1)', color:'#00110b' }}>{t.registerBtn}</button>
            </form>
            <div className="mt-3 text-center text-xs text-slate-300">
              {t.haveAccount} <button onClick={onSwitchToLogin} className="text-indigo-300 font-semibold hover:underline">{t.loginLink}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
