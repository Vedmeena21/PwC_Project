import { useState, useEffect, useCallback } from 'react'
import { authApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  CheckCircle2, XCircle, Trash2, UserPlus, Loader2, Clock,
  ShieldCheck, User as UserIcon, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react'

// ── Manage page (admin only) ──────────────────────────────────────────────────
// Three sections:
//   1. Pending approvals (FIFO queue)
//   2. All users list
//   3. Add user directly (auto-approved)

const ROLE_BADGE = {
  admin: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
  user:  'bg-slate-700/50  text-slate-300 border-slate-600/30',
}
const STATUS_BADGE = {
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending:  'bg-amber-500/10  text-amber-400  border-amber-500/20',
  rejected: 'bg-red-500/10   text-red-400    border-red-500/20',
}

function Badge({ variant, children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variant}`}>
      {children}
    </span>
  )
}

function Avatar({ name, email, size = 'sm' }) {
  const letter = (name || email || '?')[0].toUpperCase()
  const sz = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
  return (
    <div className={`${sz} rounded-full bg-slate-700 flex items-center justify-center font-semibold text-white flex-shrink-0`}>
      {letter}
    </div>
  )
}

// ── Pending card ──────────────────────────────────────────────────────────────
function PendingCard({ user, onApprove, onReject }) {
  const [loading,    setLoading]    = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)

  async function approve() {
    setLoading(true)
    await onApprove(user.id)
    setLoading(false)
  }
  async function reject() {
    setLoading(true)
    await onReject(user.id, rejectNote)
    setLoading(false)
  }

  const waitMins = Math.round((Date.now() - new Date(user.created_at)) / 60000)
  const waitLabel = waitMins < 60
    ? `${waitMins}m ago`
    : waitMins < 1440
    ? `${Math.round(waitMins / 60)}h ago`
    : `${Math.round(waitMins / 1440)}d ago`

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={user.name} email={user.email} />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">{user.name || '(no name)'}</p>
          <p className="text-slate-400 text-xs truncate">{user.email}</p>
          <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
            <Clock className="w-3 h-3" /> {waitLabel}
          </div>
        </div>
      </div>

      {user.signup_note && (
        <div className="bg-slate-800/50 rounded-lg px-3 py-2">
          <p className="text-slate-400 text-xs italic">"{user.signup_note}"</p>
        </div>
      )}

      {showReject && (
        <div>
          <input
            type="text"
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      )}

      <div className="flex gap-2">
        {!showReject ? (
          <>
            <button
              onClick={approve}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg py-1.5 text-xs font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg py-1.5 text-xs font-medium transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </>
        ) : (
          <>
            <button
              onClick={reject}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg py-1.5 text-xs font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Confirm reject
            </button>
            <button
              onClick={() => setShowReject(false)}
              className="px-3 text-slate-400 hover:text-slate-200 text-xs"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ user, currentUserId, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const isSelf = user.id === currentUserId

  async function doDelete() {
    setLoading(true)
    await onDelete(user.id)
    setLoading(false)
  }

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} email={user.email} size="sm" />
          <div>
            <p className="text-white text-sm font-medium">{user.name || '—'}</p>
            <p className="text-slate-400 text-xs">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={ROLE_BADGE[user.role]}>{user.role}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_BADGE[user.status]}>{user.status}</Badge>
      </td>
      <td className="px-4 py-3 text-slate-400 text-xs">
        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <span className="text-slate-600 text-xs">You</span>
        ) : confirming ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-red-400">Delete?</span>
            <button
              onClick={doDelete}
              disabled={loading}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Yes'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-slate-500 hover:text-slate-300">
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-slate-600 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Add User form ─────────────────────────────────────────────────────────────
function AddUserForm({ onCreated }) {
  const { toast } = useToast()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const [form,    setForm]    = useState({ email: '', password: '', name: '', role: 'user' })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 6) { toast('Password must be at least 6 characters.', 'error'); return }
    setLoading(true)
    try {
      await authApi.create(form)
      toast('User created and auto-approved.', 'success')
      setForm({ email: '', password: '', name: '', role: 'user' })
      setOpen(false)
      onCreated()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-white font-medium text-sm">
          <UserPlus className="w-4 h-4 text-brand-400" />
          Add user directly
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <form onSubmit={submit} className="px-5 pb-5 space-y-3 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Name (optional)</label>
              <input
                type="text" value={form.name} onChange={set('name')}
                placeholder="Full name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Role</label>
              <select
                value={form.role} onChange={set('role')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Email <span className="text-red-400">*</span></label>
            <input
              type="email" value={form.email} onChange={set('email')} required
              placeholder="user@example.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required
                placeholder="Min. 6 characters"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create user
          </button>
        </form>
      )}
    </div>
  )
}

// ── Main Manage page ──────────────────────────────────────────────────────────
export default function Manage() {
  const { user: currentUser } = useAuth()
  const { toast }             = useToast()
  const [pending, setPending] = useState([])
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([authApi.pending(), authApi.users()])
      setPending(p.users)
      setUsers(u.users)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { refresh() }, [refresh])

  async function handleApprove(id) {
    try {
      await authApi.approve(id)
      toast('User approved.', 'success')
      refresh()
    } catch (err) { toast(err.message, 'error') }
  }

  async function handleReject(id, reason) {
    try {
      await authApi.reject(id, reason)
      toast('User rejected.', 'success')
      refresh()
    } catch (err) { toast(err.message, 'error') }
  }

  async function handleDelete(id) {
    try {
      await authApi.delete(id)
      toast('User deleted.', 'success')
      refresh()
    } catch (err) { toast(err.message, 'error') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Manage Users</h1>
        <p className="text-slate-400 text-sm mt-1">Review pending requests, manage all users, or add users directly.</p>
      </div>

      {/* Pending queue */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="text-white font-semibold">Pending Approval</h2>
          {pending.length > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-500/30">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-8 text-center">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No pending requests</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map(u => (
              <PendingCard
                key={u.id}
                user={u}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </section>

      {/* Add user form */}
      <AddUserForm onCreated={refresh} />

      {/* All users table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-slate-400" />
          <h2 className="text-white font-semibold">All Users</h2>
          <span className="text-slate-500 text-sm">({users.length})</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">User</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">Role</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={currentUser?.id}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
