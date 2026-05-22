import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Search, RefreshCw, Upload } from 'lucide-react'
import { useInvoices } from '@/hooks/useInvoices'
import { invoiceApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import UploadZone from '@/components/ui/UploadZone'
import { formatDate, formatDateTime, cn } from '@/lib/utils'

// All possible status filter values — "all" shows every invoice
const STATUS_FILTERS = ['all', 'pending', 'processing', 'flagged', 'approved', 'rejected', 'extraction_failed']

export default function Invoices() {
  const navigate = useNavigate()
  const toast    = useToast()
  const [searchParams] = useSearchParams()

  const [statusFilter, setStatusFilter] = useState(() => {
    const s = searchParams.get('status')
    return s && STATUS_FILTERS.includes(s) ? s : 'all'
  })

  useEffect(() => {
    const s = searchParams.get('status')
    setStatusFilter(s && STATUS_FILTERS.includes(s) ? s : 'all')
  }, [searchParams])
  const [search,       setSearch]       = useState('')
  const [showUpload,   setShowUpload]   = useState(false)
  const [uploading,    setUploading]    = useState(false)

  // Pass status filter to API only when it's not "all" (API ignores missing param)
  const { invoices, loading, refetch } = useInvoices(
    statusFilter !== 'all' ? { status: statusFilter } : {}
  )

  // Client-side search across invoice number, vendor, and PO reference
  // (keeps the API simple — no search endpoint needed for this data volume)
  const filtered = invoices.filter((inv) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.vendor_name?.toLowerCase().includes(q) ||
      inv.po_reference?.toLowerCase().includes(q)
    )
  })

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={refetch} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => setShowUpload(!showUpload)} className="btn-primary">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* ── Inline upload panel — shown/hidden by toggle ── */}
      {showUpload && (
        <div className="card p-6 animate-slide-up">
          <UploadZone onUpload={handleUpload} uploading={uploading} />
        </div>
      )}

      {/* ── Filters: search + status pills ── */}
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
        {/* Horizontally scrollable pill row — no wrapping on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border whitespace-nowrap flex-shrink-0',
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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
          <div className="p-12 text-center text-slate-400 text-sm">Loading invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No invoices found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or upload an invoice</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 first:px-6">Invoice</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Vendor</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">PO Ref</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Checks</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((inv) => (
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
                          <p className="font-medium text-slate-900 truncate max-w-[120px] sm:max-w-none">{inv.invoice_number}</p>
                          <p className="text-xs text-slate-400 sm:hidden truncate">{inv.vendor_name}</p>
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
      </div>
    </div>
  )
}
