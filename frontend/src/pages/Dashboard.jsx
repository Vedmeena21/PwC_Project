import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { FileText, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, Upload, ChevronRight, ArrowUpRight, Activity, ScanText, ShieldCheck, UserCheck } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useStats, useInvoices } from '@/hooks/useApi'
import { invoiceApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import UploadZone from '@/components/ui/UploadZone'
import StatusBadge from '@/components/ui/StatusBadge'
import { InvoiceRowSkeleton, StatCardSkeleton } from '@/components/ui/Skeleton'
import { formatDate, formatDateTime, cn } from '@/lib/utils'

// ── Activity feed helpers ─────────────────────────────────────────────────────
const ACTION_CONFIG = {
  uploaded:           { icon: '↑', color: 'text-slate-400', label: 'uploaded'          },
  processing_started: { icon: '⟳', color: 'text-blue-400',  label: 'started processing' },
  validated:          { icon: '✓', color: 'text-green-500', label: 'validated by AI'   },
  reviewed:           { icon: '★', color: 'text-[#EB8C00]', label: 'reviewed'           },
  duplicate_detected: { icon: '⊘', color: 'text-red-400',   label: 'rejected — duplicate' },
  processing_failed:  { icon: '✕', color: 'text-red-400',   label: 'extraction failed' },
  deleted:            { icon: '−', color: 'text-slate-300',  label: 'deleted'           },
  _default:           { icon: '·', color: 'text-slate-300',  label: ''                  },
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

// Status → colour. Keyed by name so colours don't shift when a slice is filtered out
// (previously the colours were positional and Pending would render amber whenever
// Flagged was 0 because the filter compacted the array).
const STATUS_COLOR = {
  Approved: '#16a34a',  // green
  Rejected: '#dc2626',  // red
  Flagged:  '#f59e0b',  // amber
  Pending:  '#2563eb',  // blue — matches the Pending Review stat card
  Failed:   '#6b7280',  // slate
}

// ── Detect touch device (cached once on load) ─────────────────────────────────
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

// ── InvoicePopover (desktop only) ─────────────────────────────────────────────
function InvoicePopover({ status, visible, anchorRef }) {
  const navigate = useNavigate()
  const filters  = visible
    ? (status === 'total' ? { limit: 6 } : { status, limit: 6 })
    : { limit: 0 }
  const { invoices: items, loading: isLoading } = useInvoices(filters)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (visible && anchorRef.current) setRect(anchorRef.current.getBoundingClientRect())
  }, [visible, anchorRef])

  if (!visible || !rect) return null

  return createPortal(
    <div
      style={{ position: 'fixed', top: rect.bottom + 8, left: rect.left, width: rect.width, zIndex: 9999 }}
      className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-slide-up"
    >
      <div className="px-3 py-2 border-b border-slate-50 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {status === 'total' ? 'Recent' : status.replaceAll('_', ' ')} invoices
        </span>
        <button
          onClick={() => navigate(status === 'total' ? '/invoices' : `/invoices?status=${status}`)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
        >
          View all <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      {isLoading ? (
        <div className="px-3 py-4 text-xs text-slate-400 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-3 py-4 text-xs text-slate-400 text-center">No invoices here</div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
          {items.map(inv => (
            <div
              key={inv.id}
              onClick={() => navigate(`/invoices/${inv.id}`)}
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                <FileText className="w-3 h-3 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{inv.invoice_number}</p>
                <p className="text-xs text-slate-400 truncate">{inv.vendor_name}</p>
              </div>
              <StatusBadge status={inv.status} />
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}

// ── MobileInvoiceDrawer ───────────────────────────────────────────────────────
// Inline expandable list shown below the card on tap (mobile only)
function MobileInvoiceDrawer({ status, open }) {
  const navigate = useNavigate()
  const filters  = open
    ? (status === 'total' ? { limit: 3 } : { status, limit: 3 })
    : { limit: 0 }
  const { invoices: items, loading } = useInvoices(filters)

  if (!open) return null

  return (
    <div className="mt-3 rounded-lg border border-slate-100 overflow-hidden bg-white animate-slide-up">
      <div className="px-3 py-2 bg-slate-50 flex items-center justify-between gap-2 border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">
          {status === 'total' ? 'Recent' : status.replaceAll('_', ' ')}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(status === 'total' ? '/invoices' : `/invoices?status=${status}`) }}
          className="text-[10px] text-blue-600 font-semibold flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap"
        >
          View all <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      {loading ? (
        <div className="py-3 text-xs text-slate-400 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-3 text-xs text-slate-400 text-center">No invoices here</div>
      ) : (
        <div className="divide-y divide-slate-50">
          {items.map(inv => (
            <div
              key={inv.id}
              onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${inv.id}`) }}
              className="flex items-center gap-2 px-3 py-2 active:bg-blue-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{inv.invoice_number}</p>
                <p className="text-[10px] text-slate-400 truncate">{inv.vendor_name}</p>
              </div>
              <StatusBadge status={inv.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
const ACCENT = {
  'text-slate-900': { border: 'border-l-slate-400',  iconBg: 'bg-slate-100',  gradient: 'from-slate-50' },
  'text-green-600': { border: 'border-l-green-500',  iconBg: 'bg-green-50',   gradient: 'from-green-50' },
  'text-red-600':   { border: 'border-l-red-500',    iconBg: 'bg-red-50',     gradient: 'from-red-50'   },
  'text-amber-600': { border: 'border-l-amber-500',  iconBg: 'bg-amber-50',   gradient: 'from-amber-50' },
  'text-blue-600':  { border: 'border-l-blue-500',   iconBg: 'bg-blue-50',    gradient: 'from-blue-50'  },
}

function StatCard({ icon: Icon, label, value, color, sub, filterStatus }) {
  const navigate         = useNavigate()
  const [active, setActive] = useState(false)
  const cardRef          = useRef(null)
  const leaveTimer       = useRef(null)

  // Desktop hover
  const handleMouseEnter = () => { if (IS_TOUCH) return; clearTimeout(leaveTimer.current); setActive(true) }
  const handleMouseLeave = () => { if (IS_TOUCH) return; leaveTimer.current = setTimeout(() => setActive(false), 150) }
  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  // Mobile: tap toggles drawer; desktop: click navigates
  const handleClick = (e) => {
    if (!IS_TOUCH) {
      navigate(filterStatus === 'total' ? '/invoices' : `/invoices?status=${filterStatus}`)
    } else {
      setActive(v => !v)
    }
  }

  const accent = ACCENT[color] ?? ACCENT['text-slate-900']

  return (
    <div
      ref={cardRef}
      className={cn(
        'card relative cursor-pointer transition-all duration-200 border-l-4 overflow-hidden',
        active ? `${accent.border} shadow-md` : 'border-l-transparent'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Subtle gradient wash on active */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-200 pointer-events-none',
        accent.gradient, active && 'opacity-100'
      )} />

      <div className="relative p-4 md:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
            <p className={cn('text-2xl md:text-3xl font-bold mt-1 tabular-nums', color)}>{value ?? '—'}</p>
            {sub && <p className="text-[10px] md:text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          <div className={cn(
            'w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ml-2',
            active ? `${accent.iconBg} scale-110` : 'bg-slate-100'
          )}>
            <Icon className={cn('w-4 h-4 md:w-5 md:h-5 transition-colors duration-200', color)} />
          </div>
        </div>

        {/* Tap hint — only on touch devices */}
        {IS_TOUCH && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-[10px] font-medium transition-colors duration-150',
            active ? 'text-slate-600' : 'text-slate-300'
          )}>
            <span>{active ? 'Tap to collapse' : 'Tap to preview'}</span>
            <ChevronRight className={cn('w-3 h-3 transition-transform duration-200', active && 'rotate-90')} />
          </div>
        )}

        {/* Mobile inline drawer — only rendered on touch devices */}
        {IS_TOUCH && <MobileInvoiceDrawer status={filterStatus} open={active} />}
      </div>

      {/* Desktop popover — only rendered on non-touch devices */}
      {!IS_TOUCH && <InvoicePopover status={filterStatus} visible={active} anchorRef={cardRef} />}
    </div>
  )
}

export default function Dashboard() {
  const navigate      = useNavigate()
  const toast         = useToast()
  const { isAdmin }   = useAuth()

  // Admin view toggle: 'all' = everyone's invoices, 'mine' = own uploads
  const [view, setView] = useState('all')
  const effectiveView   = isAdmin ? view : 'mine'

  const { stats, loading: statsLoading }           = useStats(effectiveView)
  const { invoices, loading: invLoading, refetch } = useInvoices({ limit: 5, view: effectiveView })
  const [uploading,  setUploading]  = useState(false)
  const [activity,   setActivity]   = useState([])
  const [actLoading, setActLoading] = useState(true)

  useEffect(() => {
    setActLoading(true)
    invoiceApi.activity({ limit: 7, view: effectiveView })
      .then(d => setActivity(d.activity || []))
      .catch(() => {})
      .finally(() => setActLoading(false))
  }, [effectiveView])

  const approvalRate  = stats?.total > 0 ? Math.round((stats.approved / stats.total) * 100) : null
  const rejectionRate = stats?.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : null

  const pieData = stats ? [
    { name: 'Approved', value: stats.approved },
    { name: 'Rejected', value: stats.rejected },
    { name: 'Flagged',  value: stats.flagged  },
    { name: 'Pending',  value: stats.pending  },
    { name: 'Failed',   value: stats.extraction_failed },
  ].filter(d => d.value > 0) : []

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const res = await invoiceApi.upload(file)
      toast({ type: 'success', message: 'Invoice uploaded! Processing in background...' })
      refetch()
      setTimeout(() => navigate(`/invoices/${res.invoice_id}`), 800)
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Invoice processing overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Admin view toggle */}
          {isAdmin && (
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => setView('all')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  view === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                All
              </button>
              <button
                onClick={() => setView('mine')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  view === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Mine
              </button>
            </div>
          )}
          <button
            onClick={() => navigate('/invoices')}
            className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            All invoices <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        {statsLoading && !stats ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={FileText}      label="Total"          value={stats?.total}    color="text-slate-900" sub="all time"      filterStatus="total"    />
            <StatCard icon={CheckCircle}   label="Approved"       value={stats?.approved} color="text-green-600" sub={approvalRate != null ? `${approvalRate}% rate` : undefined} filterStatus="approved" />
            <StatCard icon={XCircle}       label="Rejected"       value={stats?.rejected} color="text-red-600"   sub={rejectionRate != null ? `${rejectionRate}% rate` : undefined} filterStatus="rejected" />
            <StatCard icon={AlertTriangle} label="Flagged"        value={stats?.flagged}  color="text-amber-600" sub="needs review"  filterStatus="flagged"  />
            <StatCard icon={Clock}         label="Pending Review" value={stats?.pending}  color="text-blue-600"  sub="awaiting decision" filterStatus="pending" />
          </>
        )}
      </div>

      {/* ── Middle row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Upload */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
              <Upload className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Upload Invoice</h2>
          </div>
          <UploadZone onUpload={handleUpload} uploading={uploading} />
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Status Breakdown</h2>
          </div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name]} />)}
                  </Pie>
                  <Tooltip formatter={(val, name) => [val, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 justify-center">
                {pieData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[d.name] }} />
                    {d.name} <span className="font-semibold text-slate-900">({d.value})</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-400">
              <TrendingUp className="w-8 h-8 opacity-30" />
              <p className="text-sm">No data yet</p>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">How It Works</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                icon: Upload,
                step: '01',
                title: 'Upload Invoice',
                desc: 'Upload a PDF invoice. It is stored securely and queued for processing.',
                color: 'bg-orange-50 text-[#EB8C00]',
              },
              {
                icon: ScanText,
                step: '02',
                title: 'AI Extraction',
                desc: 'Groq LLM reads the invoice and extracts vendor, date, line items and PO reference.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: ShieldCheck,
                step: '03',
                title: 'Rule Validation',
                desc: 'Extracted data is checked against the active rulebook — rates, quantities, quality grades.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: UserCheck,
                step: '04',
                title: 'Human Review',
                desc: 'Admin approves or rejects based on the AI verdict. Decision is logged in the audit trail.',
                color: 'bg-green-50 text-green-600',
              },
            ].map(({ icon: Icon, step, title, desc, color }, i, arr) => (
              <div key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                </div>
                <div className="pb-3 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-300 tracking-widest">{step}</span>
                    <p className="text-xs font-semibold text-slate-800">{title}</p>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent invoices ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Recent Invoices</h2>
          <button
            onClick={() => navigate('/invoices')}
            className="text-xs font-medium flex items-center gap-0.5 transition-colors"
            style={{ color: '#EB8C00' }}
            onMouseEnter={e => e.currentTarget.style.color = '#D04A02'}
            onMouseLeave={e => e.currentTarget.style.color = '#EB8C00'}
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {invLoading ? (
          <InvoiceRowSkeleton rows={4} />
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="text-slate-700 text-sm font-semibold">No invoices yet</p>
              <p className="text-slate-400 text-xs mt-1">Drop a PDF into the upload zone above to get started.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-2.5">File</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 hidden sm:table-cell">Vendor</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 hidden md:table-cell">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 hidden md:table-cell">Checks</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0 group-hover:bg-white">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-[140px]">
                            {inv.original_filename || inv.invoice_number}
                          </p>
                          {inv.original_filename && (
                            <p className="text-[10px] text-slate-400 truncate">{inv.invoice_number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell truncate max-w-[160px]">{inv.vendor_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{formatDate(inv.invoice_date) || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {inv.total_checks != null ? (
                        <span className={cn('text-xs font-semibold', inv.failed_checks === 0 ? 'text-green-600' : 'text-red-500')}>
                          {inv.passed_checks}/{inv.total_checks}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
