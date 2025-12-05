/**
 * SecretField - 统一的密码/敏感字段显示组件
 * 
 * 功能：
 * 1. 点击眼睛按钮显示/隐藏密码
 * 2. 点击复制按钮复制密码
 * 3. 支持异步获取密码（如从服务器解密）
 * 4. 美观的动画和状态提示
 */

import React, { useState, useCallback } from 'react'
import { Eye, EyeOff, Copy, Check, Loader2, AlertCircle } from 'lucide-react'

interface SecretFieldProps {
  /** 显示用的占位符文本（当密码隐藏时） */
  placeholder?: string
  /** 是否有密码（用于决定显示 - 还是 ••••）*/
  hasValue?: boolean
  /** 同步获取密码值 */
  value?: string
  /** 异步获取密码值的函数 */
  onReveal?: () => Promise<string | undefined>
  /** 标签文本 */
  label?: string
  /** 自定义样式类名 */
  className?: string
  /** 紧凑模式（用于表格等场景）*/
  compact?: boolean
  /** 是否只读（不显示操作按钮）*/
  readOnly?: boolean
  /** 语言 */
  lang?: 'zh' | 'en'
}

type RevealState = 'hidden' | 'loading' | 'revealed' | 'error'

export const SecretField: React.FC<SecretFieldProps> = ({
  placeholder = '••••••••',
  hasValue = false,
  value,
  onReveal,
  label,
  className = '',
  compact = false,
  readOnly = false,
  lang = 'zh',
}) => {
  const [state, setState] = useState<RevealState>('hidden')
  const [revealedValue, setRevealedValue] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>('')
  
  // 计算显示值
  const displayValue = (() => {
    // 没有密码
    if (!hasValue && !value) return '-'
    
    // 已解密
    if (state === 'revealed') {
      if (revealedValue) return revealedValue
      if (value) return value
      return '-' // 解密后发现为空
    }
    
    // 加载中
    if (state === 'loading') return '...'
    
    // 错误状态
    if (state === 'error') return '!'
    
    // 隐藏状态
    return placeholder
  })()
  
  // 切换显示/隐藏
  const handleToggle = useCallback(async () => {
    if (readOnly) return
    
    // 如果已显示，切换回隐藏
    if (state === 'revealed') {
      setState('hidden')
      return
    }
    
    // 如果有同步值，直接显示
    if (value) {
      setRevealedValue(value)
      setState('revealed')
      return
    }
    
    // 如果有异步获取函数
    if (onReveal) {
      setState('loading')
      setError('')
      try {
        const result = await onReveal()
        if (result !== undefined) {
          setRevealedValue(result)
          setState('revealed')
        } else {
          setRevealedValue('')
          setState('revealed') // 显示为空
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : lang === 'zh' ? '获取失败' : 'Failed')
        setState('error')
        // 3秒后自动恢复
        setTimeout(() => {
          if (setState) setState('hidden')
          setError('')
        }, 3000)
      }
    }
  }, [state, value, onReveal, readOnly, lang])
  
  // 复制到剪贴板
  const handleCopy = useCallback(async () => {
    let textToCopy = revealedValue || value
    
    // 如果还没有解密的值，先获取
    if (!textToCopy && onReveal) {
      try {
        textToCopy = await onReveal()
        if (textToCopy) {
          setRevealedValue(textToCopy)
        }
      } catch {
        return // 获取失败则不复制
      }
    }
    
    if (!textToCopy) return
    
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(textToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
      
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = textToCopy
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.setAttribute('readonly', '')
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // 复制失败静默处理
    }
  }, [revealedValue, value, onReveal])
  
  // 是否可以操作
  const canInteract = hasValue || !!value || !!onReveal
  
  // 紧凑模式样式
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <span 
          className={`font-mono text-xs px-1.5 py-0.5 rounded border min-w-[60px] text-center transition-all ${
            state === 'revealed' 
              ? 'bg-white text-slate-700 border-slate-300' 
              : state === 'error'
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}
          title={state === 'error' ? error : undefined}
        >
          {displayValue}
        </span>
        
        {!readOnly && canInteract && (
          <>
            <button
              type="button"
              onClick={handleToggle}
              disabled={state === 'loading'}
              className={`p-1 rounded transition-all ${
                state === 'loading'
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={state === 'revealed' 
                ? (lang === 'zh' ? '隐藏' : 'Hide')
                : (lang === 'zh' ? '显示' : 'Show')
              }
            >
              {state === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : state === 'revealed' ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : state === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
            
            <button
              type="button"
              onClick={handleCopy}
              className={`p-1 rounded transition-all ${
                copied
                  ? 'text-emerald-500'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={lang === 'zh' ? '复制' : 'Copy'}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </>
        )}
      </div>
    )
  }
  
  // 完整模式
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      
      <div className="flex items-center gap-2">
        <div 
          className={`flex-1 font-mono text-sm px-3 py-2 rounded-lg border transition-all ${
            state === 'revealed'
              ? 'bg-white text-slate-700 border-slate-300'
              : state === 'error'
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}
          title={state === 'error' ? error : undefined}
        >
          <span className={`block truncate ${state === 'loading' ? 'animate-pulse' : ''}`}>
            {displayValue}
          </span>
        </div>
        
        {!readOnly && canInteract && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleToggle}
              disabled={state === 'loading'}
              className={`p-2 rounded-lg border transition-all ${
                state === 'loading'
                  ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                  : state === 'revealed'
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                  : state === 'error'
                  ? 'bg-rose-50 text-rose-500 border-rose-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
              }`}
              title={state === 'revealed'
                ? (lang === 'zh' ? '隐藏密码' : 'Hide password')
                : (lang === 'zh' ? '显示密码' : 'Show password')
              }
            >
              {state === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : state === 'revealed' ? (
                <EyeOff className="w-4 h-4" />
              ) : state === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
            
            <button
              type="button"
              onClick={handleCopy}
              className={`p-2 rounded-lg border transition-all ${
                copied
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
              }`}
              title={copied 
                ? (lang === 'zh' ? '已复制' : 'Copied')
                : (lang === 'zh' ? '复制密码' : 'Copy password')
              }
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
      
      {state === 'error' && error && (
        <p className="text-xs text-rose-500">{error}</p>
      )}
    </div>
  )
}

/**
 * 密码输入框组件（用于编辑模式）
 */
interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
  required?: boolean
  lang?: 'zh' | 'en'
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder = '',
  label,
  className = '',
  required = false,
  lang = 'zh',
}) => {
  const [visible, setVisible] = useState(false)
  
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      
      <div className="flex gap-2">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className={`px-3 py-2 rounded-lg border transition-all ${
            visible
              ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
          }`}
          title={visible 
            ? (lang === 'zh' ? '隐藏密码' : 'Hide password')
            : (lang === 'zh' ? '显示密码' : 'Show password')
          }
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default SecretField


