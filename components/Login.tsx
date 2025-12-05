/**
 * 登录组件
 */

import React, { useState } from 'react'
import { PixelFieldBackground } from './PixelFieldBackground'
import { translations, Language } from '../utils/translations'
import { User } from '../types'
import { login, register } from '../services/api'

interface LoginProps {
  lang: Language
  onLogin: (user: User) => void
  onSwitchToRegister: () => void
  setLang: (lang: Language) => void
}

export const Login: React.FC<LoginProps> = ({ 
  lang, 
  onLogin, 
  onSwitchToRegister, 
  setLang 
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // 注册表单状态
  const [showModal, setShowModal] = useState<{ open: boolean; mode: 'login' | 'register' }>({ 
    open: false, 
    mode: 'login' 
  })
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regInvite, setRegInvite] = useState('')
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regSuccess, setRegSuccess] = useState('')
  
  // 验证状态
  const [regUsernameErr, setRegUsernameErr] = useState('')
  const [regEmailErr, setRegEmailErr] = useState('')
  const [regPasswordErr, setRegPasswordErr] = useState('')
  const [regConfirmErr, setRegConfirmErr] = useState('')
  
  const t = translations[lang]

  // 登录处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const user = await login(username, password)
      if (user) {
        onLogin(user)
      } else {
        setError(t.invalidCreds)
      }
    } catch (err: unknown) {
      const error = err as Error
      const code = error.message || ''
      
      if (code.includes('account_expired')) {
        setError(t.accountExpired || '账户已过期')
      } else if (code.includes('session_expired')) {
        setError('会话已过期，请重新登录')
      } else {
        setError(t.invalidCreds)
      }
    } finally {
      setLoading(false)
    }
  }

  // 注册处理
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')
    setRegSuccess('')
    setRegLoading(true)
    
    // 验证
    const emailRegex = /.+@.+\..+/
    const uname = regUsername.trim()
    const mail = regEmail.trim()
    
    if (!uname) {
      setRegUsernameErr(t.invalidUsername)
      setRegError(t.invalidUsername)
      setRegLoading(false)
      return
    }
    
    if (!emailRegex.test(mail)) {
      setRegEmailErr(t.invalidEmail)
      setRegError(t.invalidEmail)
      setRegLoading(false)
      return
    }
    
    if ((regPassword || '').length < 6) {
      setRegPasswordErr(t.passwordTooShort)
      setRegError(t.passwordTooShort)
      setRegLoading(false)
      return
    }
    
    if (regPassword !== regConfirm) {
      setRegConfirmErr(t.passwordMismatch)
      setRegError(t.passwordMismatch)
      setRegLoading(false)
      return
    }
    
    try {
      const newUser = await register(
        regUsername, 
        regEmail, 
        regPassword, 
        regInvite.trim() || undefined
      )
      
      if (!newUser) {
        setRegError(t.usernameTaken)
      } else {
        setRegSuccess(t.registerSuccess || '注册成功，正在登录...')
        
        // 注册成功后自动登录
        try {
          const signedIn = await login(regUsername, regPassword)
          if (signedIn) {
            onLogin(signedIn)
            setShowModal({ open: false, mode: 'login' })
          }
        } catch {
          // 自动登录失败，提示用户手动登录
          setRegSuccess(t.registerSuccess || '注册成功，请登录')
          setTimeout(() => {
            setShowModal({ open: true, mode: 'login' })
            setUsername(regUsername)
          }, 1500)
        }
      }
    } catch (err: unknown) {
      const error = err as Error
      const code = error.message || ''
      
      const errorMessages: Record<string, string> = {
        username_taken: t.usernameTaken,
        weak_password: t.passwordTooShort,
        invalid_email: t.invalidEmail,
        invalid_username: t.invalidUsername,
        invite_required: t.inviteRequired || '需要邀请码',
        invalid_invite: t.invalidInvite || '邀请码无效',
        invite_expired: t.inviteExpired || '邀请码已过期',
      }
      
      setRegError(errorMessages[code] || error.message || t.usernameTaken)
    } finally {
      setRegLoading(false)
    }
  }

  // 重置注册表单验证
  const clearRegValidation = () => {
    setRegUsernameErr('')
    setRegEmailErr('')
    setRegPasswordErr('')
    setRegConfirmErr('')
    setRegError('')
    setRegSuccess('')
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-transparent relative overflow-hidden">
        <PixelFieldBackground />
        
        {/* 语言切换 */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
            <button 
              onClick={() => setLang('en')} 
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('zh')} 
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                lang === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              中文
            </button>
          </div>
        </div>

        {/* 主内容 */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* 左侧介绍 */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-emerald-400/60 bg-black/40 backdrop-blur">
              Serdo
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{t.loginTitle}</h2>
            <p className="mt-2 text-sm text-slate-300">{t.loginSubtitle}</p>
            <p className="mt-4 text-sm text-slate-300">{t.heroDescription}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-300">
              <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">
                {t.featuresServers}
              </span>
              <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">
                {t.featuresDomainExpire}
              </span>
              <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">
                {t.featuresDnsSync}
              </span>
              <span className="px-2 py-1 rounded-full border border-white/20 bg-black/30">
                {t.featuresNotifications}
              </span>
            </div>
          </div>
          
          {/* 右侧按钮 */}
          <div className="w-full flex md:justify-end">
            <div className="mt-8 flex gap-4 justify-start md:justify-end">
              <button 
                onClick={() => setShowModal({ open: true, mode: 'login' })} 
                className="px-5 py-3 rounded-full text-sm md:text-base font-semibold tracking-wide"
                style={{ 
                  background: 'linear-gradient(135deg,#00ffb2,#60ffe1)', 
                  color: '#00110b', 
                  boxShadow: '0 12px 24px rgba(0,255,178,.45)'
                }}
              >
                {t.loginLink}
              </button>
              <button 
                onClick={() => { clearRegValidation(); setShowModal({ open: true, mode: 'register' }) }} 
                className="px-5 py-3 rounded-full text-sm md:text-base font-semibold tracking-wide border border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                {t.registerLink}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 登录/注册弹窗 */}
      {showModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div 
            className="w-full max-w-md rounded-2xl p-8 shadow-xl border"
            style={{ 
              borderColor: 'rgba(255,255,255,.18)', 
              background: 'rgba(8,12,16,.35)', 
              backdropFilter: 'blur(24px)', 
              WebkitBackdropFilter: 'blur(24px)'
            }}
          >
            {/* 弹窗头部 */}
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
                  <div className="text-white font-semibold">
                    {showModal.mode === 'login' ? t.loginTitle : t.registerTitle}
                  </div>
                  <div className="text-slate-300 text-xs">{t.loginSubtitle}</div>
                </div>
              </div>
              <button 
                className="text-slate-300 hover:text-white transition-colors" 
                onClick={() => setShowModal({ open: false, mode: 'login' })}
              >
                ✕
              </button>
            </div>
            
            {/* 登录表单 */}
            {showModal.mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    {t.username}
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    {t.password}
                  </label>
                  <input 
                    required 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 disabled:opacity-60"
                  />
                </div>
                
                {error && (
                  <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm text-center border border-rose-100">
                    {error}
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl font-semibold disabled:opacity-60 transition-opacity"
                  style={{ background: 'linear-gradient(135deg,#00ffb2,#60ffe1)', color: '#00110b' }}
                >
                  {loading ? '...' : t.loginBtn}
                </button>
                
                <div className="mt-3 text-center text-xs text-slate-300">
                  {t.noAccount}{' '}
                  <button 
                    type="button"
                    onClick={() => { clearRegValidation(); setShowModal({ open: true, mode: 'register' }) }} 
                    className="text-indigo-300 font-semibold hover:underline"
                  >
                    {t.registerLink}
                  </button>
                </div>
              </form>
            ) : (
              /* 注册表单 */
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    {t.username}
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={regUsername} 
                    onChange={e => { 
                      setRegUsername(e.target.value)
                      setRegUsernameErr(e.target.value.trim() ? '' : t.invalidUsername) 
                    }} 
                    disabled={regLoading}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      regUsernameErr ? 'border-rose-400' : 'border-white/20'
                    } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                      regUsernameErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                    } disabled:opacity-60`}
                  />
                  {regUsernameErr && <div className="mt-1 text-xs text-rose-400">{regUsernameErr}</div>}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    {t.email}
                  </label>
                  <input 
                    required 
                    type="email" 
                    value={regEmail} 
                    onChange={e => { 
                      setRegEmail(e.target.value)
                      const emailRegex = /.+@.+\..+/
                      setRegEmailErr(emailRegex.test(e.target.value.trim()) ? '' : t.invalidEmail) 
                    }} 
                    disabled={regLoading}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      regEmailErr ? 'border-rose-400' : 'border-white/20'
                    } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                      regEmailErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                    } disabled:opacity-60`}
                  />
                  {regEmailErr && <div className="mt-1 text-xs text-rose-400">{regEmailErr}</div>}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    {t.password}
                  </label>
                  <input 
                    required 
                    type="password" 
                    value={regPassword} 
                    onChange={e => { 
                      setRegPassword(e.target.value)
                      setRegPasswordErr(e.target.value.length >= 6 ? '' : t.passwordTooShort)
                      setRegConfirmErr(regConfirm && e.target.value === regConfirm ? '' : (regConfirm ? t.passwordMismatch : ''))
                    }} 
                    disabled={regLoading}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      regPasswordErr ? 'border-rose-400' : 'border-white/20'
                    } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                      regPasswordErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                    } disabled:opacity-60`}
                  />
                  {regPasswordErr && <div className="mt-1 text-xs text-rose-400">{regPasswordErr}</div>}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    {t.confirmPassword}
                  </label>
                  <input 
                    required 
                    type="password" 
                    value={regConfirm} 
                    onChange={e => { 
                      setRegConfirm(e.target.value)
                      setRegConfirmErr(e.target.value === regPassword ? '' : t.passwordMismatch) 
                    }} 
                    disabled={regLoading}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      regConfirmErr ? 'border-rose-400' : 'border-white/20'
                    } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                      regConfirmErr ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                    } disabled:opacity-60`}
                  />
                  {regConfirmErr && <div className="mt-1 text-xs text-rose-400">{regConfirmErr}</div>}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    {t.inviteCode || '邀请码'}
                  </label>
                  <input 
                    type="text" 
                    value={regInvite} 
                    onChange={e => setRegInvite(e.target.value)} 
                    disabled={regLoading}
                    className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 disabled:opacity-60"
                    placeholder={lang === 'zh' ? '如有邀请码请填写' : 'Optional'}
                  />
                </div>
                
                {regError && (
                  <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm text-center border border-rose-100">
                    {regError}
                  </div>
                )}
                
                {regSuccess && (
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm text-center border border-emerald-100">
                    {regSuccess}
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={regLoading || !!regUsernameErr || !!regEmailErr || !!regPasswordErr || !!regConfirmErr}
                  className="w-full py-2.5 rounded-xl font-semibold disabled:opacity-60 transition-opacity"
                  style={{ background: 'linear-gradient(135deg,#00ffb2,#60ffe1)', color: '#00110b' }}
                >
                  {regLoading ? '...' : t.registerBtn}
                </button>
                
                <div className="mt-3 text-center text-xs text-slate-300">
                  {t.haveAccount}{' '}
                  <button 
                    type="button"
                    onClick={() => setShowModal({ open: true, mode: 'login' })} 
                    className="text-indigo-300 font-semibold hover:underline"
                  >
                    {t.loginLink}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
