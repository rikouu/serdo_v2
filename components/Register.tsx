/**
 * 注册组件
 */

import React, { useState } from 'react'
import { PixelFieldBackground } from './PixelFieldBackground'
import { translations, Language } from '../utils/translations'
import { register } from '../services/api'
import { User } from '../types'

interface RegisterProps {
  lang: Language
  onRegisterSuccess: (user: User) => void
  onSwitchToLogin: () => void
}

export const Register: React.FC<RegisterProps> = ({ 
  lang, 
  onRegisterSuccess, 
  onSwitchToLogin 
}) => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [showModal, setShowModal] = useState(false)
  
  // 验证状态
  const [usernameError, setUsernameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  
  const t = translations[lang]
  const emailRegex = /.+@.+\..+/

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const uname = username.trim()
    const mail = email.trim()
    
    // 验证
    if (!uname) {
      setError(t.invalidUsername)
      setUsernameError(t.invalidUsername)
      setLoading(false)
      return
    }
    
    if (!emailRegex.test(mail)) {
      setError(t.invalidEmail)
      setEmailError(t.invalidEmail)
      setLoading(false)
      return
    }
    
    if (password.length < 6) {
      setError(t.passwordTooShort)
      setPasswordError(t.passwordTooShort)
      setLoading(false)
      return
    }
    
    if (password !== confirmPassword) {
      setError(t.passwordMismatch)
      setConfirmError(t.passwordMismatch)
      setLoading(false)
      return
    }

    try {
      const newUser = await register(uname, mail, password, inviteCode.trim() || undefined)
      
      if (newUser) {
        setSuccess(t.registerSuccess || '注册成功')
        setTimeout(() => {
          onRegisterSuccess(newUser)
          setShowModal(false)
        }, 900)
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
      
      setError(errorMessages[code] || error.message || t.usernameTaken)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent relative overflow-hidden">
      <PixelFieldBackground />
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* 左侧介绍 */}
        <div className="text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-emerald-400/60 bg-black/40 backdrop-blur">
            Serdo
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{t.registerTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{t.registerSubtitle}</p>
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
              onClick={onSwitchToLogin} 
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
              onClick={() => setShowModal(true)} 
              className="px-5 py-3 rounded-full text-sm md:text-base font-semibold tracking-wide border border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              {t.registerLink}
            </button>
          </div>
        </div>
      </div>
      
      {/* 注册弹窗 */}
      {showModal && (
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
            {/* 头部 */}
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
              <button 
                className="text-slate-300 hover:text-white transition-colors" 
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            
            {/* 错误/成功提示 */}
            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-4 text-center border border-rose-100">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm mb-4 text-center border border-emerald-100">
                {success}
              </div>
            )}
            
            {/* 表单 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  {t.username}
                </label>
                <input
                  required
                  type="text"
                  value={username}
                  onChange={e => { 
                    setUsername(e.target.value)
                    setUsernameError(e.target.value.trim() ? '' : t.invalidUsername) 
                  }}
                  disabled={loading}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    usernameError ? 'border-rose-400' : 'border-white/20'
                  } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                    usernameError ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                  } disabled:opacity-60`}
                />
                {usernameError && <div className="mt-1 text-xs text-rose-400">{usernameError}</div>}
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  {t.email}
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => { 
                    setEmail(e.target.value)
                    setEmailError(emailRegex.test(e.target.value.trim()) ? '' : t.invalidEmail) 
                  }}
                  disabled={loading}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    emailError ? 'border-rose-400' : 'border-white/20'
                  } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                    emailError ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                  } disabled:opacity-60`}
                />
                {emailError && <div className="mt-1 text-xs text-rose-400">{emailError}</div>}
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  {t.password}
                </label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={e => { 
                    setPassword(e.target.value)
                    setPasswordError(e.target.value.length >= 6 ? '' : t.passwordTooShort)
                    setConfirmError(confirmPassword && e.target.value === confirmPassword ? '' : (confirmPassword ? t.passwordMismatch : ''))
                  }}
                  disabled={loading}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    passwordError ? 'border-rose-400' : 'border-white/20'
                  } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                    passwordError ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                  } disabled:opacity-60`}
                />
                {passwordError && <div className="mt-1 text-xs text-rose-400">{passwordError}</div>}
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  {t.confirmPassword}
                </label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={e => { 
                    setConfirmPassword(e.target.value)
                    setConfirmError(e.target.value === password ? '' : t.passwordMismatch) 
                  }}
                  disabled={loading}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    confirmError ? 'border-rose-400' : 'border-white/20'
                  } bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none ${
                    confirmError ? 'focus:border-rose-400' : 'focus:border-emerald-400'
                  } disabled:opacity-60`}
                />
                {confirmError && <div className="mt-1 text-xs text-rose-400">{confirmError}</div>}
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  {t.inviteCode || '邀请码'}
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-[rgba(4,8,15,.88)] text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 disabled:opacity-60"
                  placeholder={lang === 'zh' ? '如有邀请码请填写' : 'Optional'}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading || !!usernameError || !!emailError || !!passwordError || !!confirmError}
                className="w-full py-2.5 rounded-xl font-semibold disabled:opacity-60 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#00ffb2,#60ffe1)', color: '#00110b' }}
              >
                {loading ? '...' : t.registerBtn}
              </button>
            </form>
            
            <div className="mt-3 text-center text-xs text-slate-300">
              {t.haveAccount}{' '}
              <button 
                onClick={onSwitchToLogin} 
                className="text-indigo-300 font-semibold hover:underline"
              >
                {t.loginLink}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
