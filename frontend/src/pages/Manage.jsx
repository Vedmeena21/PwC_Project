import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, invoiceApi } from '@/services/api'
import { notifyManageAction } from '@/hooks/useApi'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Trash2, UserPlus, Loader2, Clock,
  ShieldCheck, User as UserIcon, Eye, EyeOff, ChevronDown, ChevronUp,
  AlertTriangle, FileText, ExternalLink
} from 'lucide-react'

const ROLE_BADGE = {
  admin: 'bg-orange-100 text-orange-700 border-orange-200',
  user:  'bg-slate-100  text-slate-600  border-slate-200',
}
const STATUS_BADGE = {
  approved: 'bg-green-100  text-green-700  border-green-200',
  pending:  'bg-amber-100  text-amber-700  border-amber-200',
  rejected: 'bg-red-100    text-red-700    border-red-200',
}

function Badge({ variant, children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variant}`}>
      {children}
    </span>
  )
}

function Avatar({ name, email }) {
  const letter = (name || email || '?')[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white text-sm flex-shrink-0"
      style={{ backgroundColor: '#EB8C00' }}>
      {letter}
    </div>
  )
}

// ── Pending card ──────────────────────────────────────────────────────────────
function PendingCard({ user, onApprove, onReject }) {
  const [loading,    setLoading]    = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [showReject, setShowReject] = useState(false)

  async function approve() { setLoading(true); await onApprove(user.id); setLoading(false) }
  async function reject()  { setLoading(true); await onReject(user.id, rejectNote); setLoading(false) }

  const waitMins = Math.round((Date.now() - new Date(user.created_at)) / 60000)
  const waitLabel = waitMins < 60
    ? `${waitMins}m ago`
    : waitMins < 1440
    ? `${Math.round(waitMins / 60)}h ago`
    : `${Math.round(waitMins / 1440)}d ago`

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={user.name} email={user.email} />
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 text-sm font-semibold">{user.name || '(no name)'}</p>
          <p className="text-slate-500 text-xs truncate">{user.email}</p>
          <div className="flex items-center gap-1 mt-1 text-slate-400 text-xs">
            <Clock className="w-3 h-3" /> {waitLabel}
          </div>
        </div>
      </div>

      {user.signup_note && (
        <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <p className="text-slate-500 text-xs italic">"{user.signup_note}"</p>
        </div>
      )}

      {showReject && (
        <input
          type="text"
          value={rejectNote}
          onChange={e => setRejectNote(e.target.value)}
          placeholder="Reason for rejection (optional)"
          className="input text-xs"
        />
      )}

      <div className="flex gap-2">
        {!showReject ? (
          <>
            <button
              onClick={approve}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg py-1.5 text-xs font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg py-1.5 text-xs font-medium transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </>
        ) : (
          <>
            <button
              onClick={reject}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg py-1.5 text-xs font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Confirm reject
            </button>
            <button onClick={() => setShowReject(false)} className="px-3 text-slate-400 hover:text-slate-600 text-xs">
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

  async function doDelete() { setLoading(true); await onDelete(user.id); setLoading(false) }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} email={user.email} />
          <div>
            <p className="text-slate-900 text-sm font-medium">{user.name || '—'}</p>
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
          <span className="text-slate-300 text-xs">You</span>
        ) : confirming ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-red-500">Delete?</span>
            <button onClick={doDelete} disabled={loading} className="text-xs text-red-500 hover:text-red-700 font-medium">
              {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Yes'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-slate-400 hover:text-slate-600">No</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
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
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
          <UserPlus className="w-4 h-4 text-[#EB8C00]" />
          Add user directly
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <form onSubmit={submit} className="px-5 pb-5 space-y-3 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Name (optional)</label>
              <input type="text" value={form.name} onChange={set('name')} placeholder="Full name" className="input" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Role</label>
              <select value={form.role} onChange={set('role')} className="input">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={set('email')} required placeholder="user@example.com" className="input" />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required
                placeholder="Min. 6 characters" className="input pr-10"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create user
          </button>
        </form>
      )}
    </div>
  )
}

// ── Needs Review row ─────────────────────────────────────────────────────────
function NeedsReviewRow({ inv, onAction }) {
  const navigate  = useNavigate()
  const [loading, setLoading] = useState(null) // 'approve' | 'reject'

  async function act(verdict) {
    setLoading(verdict)
    await onAction(inv.id, verdict)
    setLoading(null)
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-900 text-sm font-medium truncate max-w-[180px]">
              {inv.original_filename || inv.invoice_number || '—'}
            </p>
            {inv.original_filename && (
              <p className="text-xs text-slate-400 truncate">{inv.invoice_number || ''}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600 text-sm hidden sm:table-cell">
        {inv.vendor_name || '—'}
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
        {formatDate(inv.invoice_date)}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <StatusBadge status={inv.status} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-xs text-slate-500 line-clamp-2 max-w-[200px]">
          {inv.summary || '—'}
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => act('approved')}
            disabled={loading !== null}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
          >
            {loading === 'approved' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Approve
          </button>
          <button
            onClick={() => act('rejected')}
            disabled={loading !== null}
            className="flex items-center gap-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
          >
            {loading === 'rejected' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            Reject
          </button>
          <button
            onClick={() => navigate(`/invoices/${inv.id}`)}
            className="text-slate-400 hover:text-[#EB8C00] transition-colors p-1"
            title="View invoice"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main Manage page ──────────────────────────────────────────────────────────
export default function Manage() {
  const { user: currentUser } = useAuth()
  const { toast }             = useToast()
  const [pending,      setPending]      = useState([])
  const [users,        setUsers]        = useState([])
  const [flagged,      setFlagged]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadingFlags, setLoadingFlags] = useState(false)

  const refreshFlagged = useCallback(async () => {
    setLoadingFlags(true)
    try {
      // Fetch both flagged (AI raised issues) and pending (AI approved, awaiting human sign-off)
      const [resFlagged, resPending] = await Promise.all([
        invoiceApi.list({ status: 'flagged', limit: 50, view: 'all' }),
        invoiceApi.list({ status: 'pending', limit: 50, view: 'all' }),
      ])
      const combined = [
        ...(resFlagged.invoices || []),
        ...(resPending.invoices || []),
      ].sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))
      setFlagged(combined)
    } catch {
      // silently ignore — not critical
    } finally {
      setLoadingFlags(false)
    }
  }, [])

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

  useEffect(() => { refresh(); refreshFlagged() }, [refresh, refreshFlagged])

  async function handleApprove(id) {
    try { await authApi.approve(id); toast('User approved.', 'success'); refresh(); notifyManageAction() }
    catch (err) { toast(err.message, 'error') }
  }

  async function handleReject(id, reason) {
    try { await authApi.reject(id, reason); toast('User rejected.', 'success'); refresh(); notifyManageAction() }
    catch (err) { toast(err.message, 'error') }
  }

  async function handleDelete(id) {
    try { await authApi.delete(id); toast('User deleted.', 'success'); refresh() }
    catch (err) { toast(err.message, 'error') }
  }

  async function handleInvoiceAction(id, verdict) {
    try {
      await invoiceApi.review(id, { action: verdict, notes: '' })
      toast(`Invoice ${verdict}.`, 'success')
      refreshFlagged()
      notifyManageAction()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
        <p className="text-slate-500 text-sm mt-1">Review pending requests, manage all users, or add users directly.</p>
      </div>

      {/* Pending queue */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="text-slate-900 font-semibold">Pending Approval</h2>
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-200">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="card px-5 py-8 text-center">
            <ShieldCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No pending requests</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map(u => (
              <PendingCard key={u.id} user={u} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}
      </section>

      {/* Needs Review queue */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-slate-900 font-semibold">Invoices Awaiting Review</h2>
          {flagged.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-200">
              {flagged.length}
            </span>
          )}
        </div>

        {loadingFlags ? (
          <div className="card px-5 py-8 text-center">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin mx-auto" />
          </div>
        ) : flagged.length === 0 ? (
          <div className="card px-5 py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No invoices awaiting review</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">File Name</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden sm:table-cell">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">AI Verdict</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">AI Summary</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map(inv => (
                    <NeedsReviewRow key={inv.id} inv={inv} onAction={handleInvoiceAction} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Add user form */}
      <AddUserForm onCreated={refresh} />

      {/* All users table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-slate-400" />
          <h2 className="text-slate-900 font-semibold">All Users</h2>
          <span className="text-slate-400 text-sm">({users.length})</span>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <UserRow key={u.id} user={u} currentUserId={currentUser?.id} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
