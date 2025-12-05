import React, { useEffect, useState } from 'react'
import { registerToast, registerOverlay, registerResults, registerProgressStart, registerProgressUpdate, registerProgressFinish } from '../utils/notify'
import { Check, AlertTriangle, RefreshCw } from 'lucide-react'

export const NotifyHost: React.FC = () => {
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [overlay, setOverlay] = useState<{ show: boolean; text?: string }>({ show: false })
  const [results, setResults] = useState<{ title: string; success?: Array<{ id: string; name?: string; note?: string }>; failed?: Array<{ id: string; name?: string; error: string }>; subtitle?: string } | null>(null)
  const [progress, setProgress] = useState<{ title: string; items: Array<{ id: string; name?: string; status?: 'pending' | 'success' | 'error'; note?: string }>; subtitle?: string } | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    registerToast((text, type) => { setToast({ text, type }); setTimeout(() => setToast(null), 2000) })
    registerOverlay((show, text) => { setOverlay({ show, text }) })
    registerResults((payload) => { setResults(payload) })
    registerProgressStart((payload) => { setProgress({ title: payload.title, items: payload.items.map(x => ({ ...x, status: 'pending' })), subtitle: payload.subtitle }) })
    registerProgressUpdate((id, status, note) => { setProgress(prev => prev ? ({ ...prev, items: prev.items.map(it => it.id === id ? ({ ...it, status, note }) : it) }) : prev) })
    registerProgressFinish(() => { setProgress(null) })
  }, [])
  useEffect(() => {
    try { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight } catch {}
  }, [progress])
  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-2 rounded-lg shadow border text-sm ${toast.type==='success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : toast.type==='error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-900 text-white border-slate-800'}`}>{toast.text}</div>
      )}
      {overlay.show && (
        <div className="fixed inset-0 z-[90] bg-black/35 flex items-center justify-center">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            <div className="text-slate-700 text-sm">{overlay.text || 'Loading…'}</div>
          </div>
        </div>
      )}
      {progress && (
        <div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[94vw] max-w-xl animate-in fade-in">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-bold text-slate-900">{progress.title}</div>
              {progress.subtitle && <div className="text-slate-500 text-sm">{progress.subtitle}</div>}
            </div>
            <div ref={listRef} className="p-5 max-h-[50vh] overflow-auto space-y-2">
              {progress.items.map(it => (
                <div key={it.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {it.status === 'pending' && <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />}
                    {it.status === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
                    {it.status === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    <span className="font-mono truncate" title={it.name || it.id}>{it.name || it.id}</span>
                  </div>
                  <div className={`text-xs ${it.status==='success' ? 'text-emerald-700' : it.status==='error' ? 'text-rose-700' : 'text-slate-500'}`}>{it.status==='success' ? (it.note || 'Done') : it.status==='error' ? (it.note || 'Failed') : 'Pending'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {results && (
        <div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[92vw] max-w-xl animate-in fade-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">{results.title}</div>
                {results.subtitle && <div className="text-slate-500 text-sm">{results.subtitle}</div>}
              </div>
              <button onClick={() => setResults(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-emerald-700 mb-2">Success</div>
                {(results.success && results.success.length > 0) ? (
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {results.success.map((d) => (
                      <div key={d.id} className="text-xs text-slate-700 font-mono truncate" title={d.name || d.id}>{d.name || d.id}{d.note ? ` · ${d.note}` : ''}</div>
                    ))}
                  </div>
                ) : <div className="text-xs text-slate-400">-</div>}
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-rose-700 mb-2">Failed</div>
                {(results.failed && results.failed.length > 0) ? (
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {results.failed.map((f) => (
                      <div key={f.id} className="text-xs text-rose-700 truncate" title={(f.name || f.id) + ' - ' + f.error}><span className="font-mono text-slate-700 mr-1">{f.name || f.id}</span><span className="text-slate-500">{f.error}</span></div>
                    ))}
                  </div>
                ) : <div className="text-xs text-slate-400">-</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
