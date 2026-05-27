import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Search, RefreshCw, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { useInvoices } from '@/hooks/useApi'
import { invoiceApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import UploadZone from '@/components/ui/UploadZone'
import { InvoiceRowSkeleton } from '@/components/ui/Skeleton'
import { formatDate, formatDateTime, cn } from '@/lib/utils'

const STATUS_FILTERS = ['all', 'pending', 'processing', 'flagged', 'approved', 'rejected']
const PAGE_SIZE      = 10

export default function Invoices() {
  const navigate    = useNavigate()
  const toast       = useToast()
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Admin view toggle: 'all' = everyone's, 'mine' = own uploads
  const [view, setView] = useState('all')
  const effectiveView   = isAdmin ? view : 'mine'

  const [statusFilter, setStatusFilter] = useState(() => {
    const s = searchParams.get('status')
    return s && STATUS_FILTERS.includes(s) ? s : 'all'
  })

  useEffect(() => {
    const s = searchParams.get('status')
    setStatusFilter(s && STATUS_FILTERS.includes(s) ? s : 'all')
    setPage(0)
  }, [searchParams])

  const [search,         setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showUpload,     setShowUpload]     = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const [page,           setPage]           = useState(0)

  // Debounce search input — avoids hammering the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const apiParams = {
    limit:  PAGE_SIZE,
    offset: page * PAGE_SIZE,
    view:   effectiveView,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(debouncedSearch        && { search: debouncedSearch }),
  }

  const { invoices, total = 0, loading, refetch } = useInvoices(apiParams)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const res = await invoiceApi.upload(file)
      toast({ type: 'success', message: 'Invoice uploaded! Processing...' })
      setShowUpload(false)
      refetch()
      setTimeout(() => navigate(`/invoices/${res.invoice_id}`), 800)
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setUploading(false)
    }
  }

  const handleStatusChange = (s) => {
    setPage(0)
    if (s === 'all') setSearchParams({})
    else             setSearchParams({ status: s })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? 'Loading...' : `${total} invoice${total !== 1 ? 's' : ''} ${statusFilter !== 'all' ? `· ${statusFilter}` : 'total'}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Admin view toggle */}
          {isAdmin && (
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => { setView('all'); setPage(0) }}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  view === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                All
              </button>
              <button
                onClick={() => { setView('mine'); setPage(0) }}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  view === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Mine
              </button>
            </div>
          )}
          <button onClick={refetch} className="btn-secondary" title="Refresh">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => setShowUpload(!showUpload)} className="btn-primary">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* ── Inline upload panel ── */}
      {showUpload && (
        <div className="card p-6 animate-slide-up">
          <UploadZone onUpload={handleUpload} uploading={uploading} />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by invoice number, vendor, PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all border whitespace-nowrap flex-shrink-0',
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              )}
            >
              {s === 'all' ? 'All' : s.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* ── Invoice table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <InvoiceRowSkeleton rows={6} />
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="text-slate-700 text-sm font-semibold">No invoices found</p>
              <p className="text-slate-400 text-xs mt-1">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'Upload your first invoice to get started'}
              </p>
            </div>
            {!search && statusFilter === 'all' && (
              <button onClick={() => setShowUpload(true)} className="btn-primary mt-2">
                <Upload className="w-4 h-4" /> Upload Invoice
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 first:px-6">File Name / Invoice No.</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Vendor</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">PO Ref</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Checks</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 md:px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-slate-100 rounded-md flex items-center justify-center group-hover:bg-white flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-[140px] sm:max-w-none">
                            {inv.original_filename || inv.invoice_number}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {inv.original_filename ? inv.invoice_number : inv.vendor_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 hidden sm:table-cell">{inv.vendor_name}</td>
                    <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-xs hidden lg:table-cell">{inv.po_reference || '—'}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {inv.total_checks != null ? (
                        <span className={cn('text-xs font-semibold',
                          inv.failed_checks === 0 ? 'text-green-600' : 'text-red-600')}>
                          {inv.passed_checks}/{inv.total_checks}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 hidden lg:table-cell">{formatDateTime(inv.uploaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-t border-slate-100 bg-slate-50/40">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{page * PAGE_SIZE + 1}</span>–
              <span className="font-semibold text-slate-700">{Math.min((page + 1) * PAGE_SIZE, total)}</span> of{' '}
              <span className="font-semibold text-slate-700">{total}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary text-xs py-1.5 px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-xs text-slate-500 px-2">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-secondary text-xs py-1.5 px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
