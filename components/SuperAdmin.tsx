import React, { useEffect, useState } from 'react'
import { Language } from '../types'
import { getAdminSettingsApi, updateAdminSettingsApi, generateInvitesApi, listInvitesApi, updateInviteApi, deleteInviteApi, listUsersApi, updateUserExpiryApi, deleteUserApiAdmin } from '../services/apiClient'
import { translations } from '../utils/translations'
import { Copy, Check, Trash2, Edit2, Save, Calendar } from 'lucide-react'

export const SuperAdmin: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = translations[lang]
  const [appName, setAppName] = useState('Serdo')
  const [inviteRequired, setInviteRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invites, setInvites] = useState<Array<{ code: string; createdAt: number; expiresAt: number; usedBy?: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; username: string; email: string; expiresAt: number }>>([])
  const [genCount, setGenCount] = useState(10)
  const [genExpiry, setGenExpiry] = useState<string>('')
  const [copied, setCopied] = useState<string>('')
  const copyText = (s: string) => { navigator.clipboard.writeText(s).then(()=>{ setCopied(s); setTimeout(()=>setCopied(''), 1000) }).catch(()=>{}) }
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const showBanner = (text: string, type: 'success' | 'error' = 'success') => { setBanner({ text, type }); setTimeout(() => setBanner(null), 1600) }
  const [confirmState, setConfirmState] = useState<{ type: 'invite' | 'user'; id: string } | null>(null)

  const loadAll = async () => {
    try {
      const s = await getAdminSettingsApi()
      setAppName(s.appName || 'Serdo')
      setInviteRequired(!!s.inviteRequired)
      const iv = await listInvitesApi()
      setInvites(iv.invites || [])
      const us = await listUsersApi()
      setUsers(us.users || [])
    } catch {}
  }
  useEffect(() => { loadAll() }, [])

  const saveSettings = async () => { setSaving(true); try { await updateAdminSettingsApi(appName, inviteRequired); showBanner(lang==='zh' ? '已保存' : 'Saved', 'success') } catch { showBanner(lang==='zh' ? '保存失败' : 'Save failed', 'error') } finally { setSaving(false) } }
  const genInvites = async () => {
    try {
      const expiresAt = genExpiry ? new Date(genExpiry).getTime() : 0
      const r = await generateInvitesApi(genCount, expiresAt)
      setInvites((r.invites || []).map((inv: any) => ({ ...inv, createdAt: inv.createdAt || Date.now() })).concat(invites))
      showBanner(lang==='zh' ? `已生成${(r.invites||[]).length}个邀请码` : `Generated ${(r.invites||[]).length} invites`, 'success')
    } catch {}
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t.superAdmin}</h2>
        <p className="text-slate-500 text-sm">Manage global settings, invites and users</p>
      </div>
      {banner && (
        <div className={`fixed top-4 right-4 z-50 p-3 rounded-lg border shadow text-sm ${banner.type==='success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{banner.text}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">App Display Name</label>
            <input className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2" value={appName} onChange={e=>setAppName(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Invite Required</label>
            <input type="checkbox" checked={inviteRequired} onChange={e=>setInviteRequired(e.target.checked)} />
          </div>
          <button onClick={saveSettings} className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2" disabled={saving}><Save className="w-4 h-4"/>Save</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Generate Count</label>
            <input type="number" min={1} max={500} className="bg-white border border-slate-300 rounded-lg px-3 py-2" value={genCount} onChange={e=>setGenCount(Number(e.target.value||1))} />
          </div>
          <div className="md:col-span-2 flex flex-col">
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Expires At</label>
            <input type="datetime-local" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2" value={genExpiry} onChange={e=>setGenExpiry(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <button onClick={genInvites} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">Generate Invites</button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase">Invites</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {invites.map(iv => (
              <div key={iv.code} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono truncate max-w-[50%]" title={iv.code}>{iv.code}</span>
                  <span className="text-xs text-slate-500">{iv.usedBy ? `Used by ${iv.usedBy}` : 'Unused'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="datetime-local" className="bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={iv.expiresAt ? new Date(iv.expiresAt).toISOString().slice(0,16) : ''} onChange={async e=>{ const ts = e.target.value ? new Date(e.target.value).getTime() : 0; try { await updateInviteApi(iv.code, ts); setInvites(prev=>prev.map(x=>x.code===iv.code? Object.assign({}, x, { expiresAt: ts }) : x)); showBanner(lang==='zh' ? '到期时间已更新' : 'Expiry updated', 'success') } catch { showBanner(lang==='zh' ? '更新失败' : 'Update failed', 'error') } }} />
                  <button onClick={()=>copyText(iv.code)} className="text-slate-500 hover:text-slate-900">{copied===iv.code? <Check className="w-4 h-4 text-emerald-600"/> : <Copy className="w-4 h-4"/>}</button>
                  <button onClick={()=> setConfirmState({ type: 'invite', id: iv.code })} className="text-rose-600 hover:text-rose-800"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <div className="text-xs font-bold text-slate-500 uppercase">Users</div>
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono truncate max-w-[50%]" title={u.username}>{u.username}</span>
                <span className="text-xs text-slate-500">{u.email}</span>
              </div>
              <div className="flex items-center gap-2">
                {u.username === 'admin' ? (
                  <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs text-slate-600">{lang==='zh' ? '无限制' : 'Unlimited'}</span>
                ) : (
                  <input type="datetime-local" className="bg-white border border-slate-300 rounded px-2 py-1 text-xs" value={u.expiresAt ? new Date(u.expiresAt).toISOString().slice(0,16) : ''} onChange={async e=>{ const ts = e.target.value ? new Date(e.target.value).getTime() : 0; try { await updateUserExpiryApi(u.id, ts); setUsers(prev=>prev.map(x=>x.id===u.id? Object.assign({}, x, { expiresAt: ts }) : x)); showBanner(lang==='zh' ? '用户到期时间已更新' : 'User expiry updated', 'success') } catch { showBanner(lang==='zh' ? '更新失败' : 'Update failed', 'error') } }} />
                )}
                <button onClick={()=>copyText(u.username)} className="text-slate-500 hover:text-slate-900">{copied===u.username? <Check className="w-4 h-4 text-emerald-600"/> : <Copy className="w-4 h-4"/>}</button>
                <button disabled={u.username==='admin'} onClick={()=> setConfirmState({ type: 'user', id: u.id })} className={`hover:text-rose-800 ${u.username==='admin' ? 'text-slate-300 cursor-not-allowed' : 'text-rose-600'}`}><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
        </div>
        <div className="h-20" />
      </div>
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-[22rem]">
            <div className="text-slate-900 font-semibold mb-3">{lang==='zh' ? '确认删除' : 'Confirm Delete'}</div>
            <div className="text-slate-600 text-sm mb-4">{confirmState.type==='invite' ? (lang==='zh' ? '删除该邀请码？此操作不可恢复。' : 'Delete this invite? This action cannot be undone.') : (lang==='zh' ? '删除该用户？此操作不可恢复。' : 'Delete this user? This action cannot be undone.')}</div>
            <div className="flex justify-end gap-2">
              <button onClick={()=> setConfirmState(null)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700">{lang==='zh' ? '取消' : 'Cancel'}</button>
              <button onClick={async()=>{ try { if (confirmState.type==='invite') { await deleteInviteApi(confirmState.id); setInvites(prev=>prev.filter(x=>x.code!==confirmState.id)); showBanner(lang==='zh' ? '已删除邀请码' : 'Invite deleted', 'success') } else { await deleteUserApiAdmin(confirmState.id); setUsers(prev=>prev.filter(x=>x.id!==confirmState.id)); showBanner(lang==='zh' ? '已删除用户' : 'User deleted', 'success') } } catch { showBanner(lang==='zh' ? '删除失败' : 'Delete failed', 'error') } finally { setConfirmState(null) } }} className="px-3 py-2 rounded-lg bg-rose-600 text-white">{lang==='zh' ? '删除' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
