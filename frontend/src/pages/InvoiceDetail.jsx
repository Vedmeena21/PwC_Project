import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, XCircle, AlertCircle,
  Clock, FileText, ChevronDown, ChevronUp, User, Calendar, Hash, Trash2, RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { useInvoice } from '@/hooks/useApi'
import { invoiceApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate, formatDateTime, formatCurrency, cn } from '@/lib/utils'

// ── CheckIcon ─────────────────────────────────────────────────────────────────
// Maps check result to the appropriate icon. Warnings use amber, errors use red.
const CheckIcon = ({ passed, severity }) => {
  if (passed)                    return <CheckCircle  className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
  if (severity === 'warning')    return <AlertCircle  className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
  return                                <XCircle      className="w-4 h-4 text-red-600   flex-shrink-0 mt-0.5" />
}

// ── VerdictBanner ─────────────────────────────────────────────────────────────
// Full-width coloured banner showing the AI's recommendation.
// Green = approve, Red = reject, Amber = needs manual review.
const VerdictBanner = ({ verdict, summary, confidence, passedChecks, totalChecks }) => {
  const config = {
    approve:      { bg: 'bg-green-600', label: 'RECOMMEND APPROVAL' },
    reject:       { bg: 'bg-red-600',   label: 'RECOMMEND REJECTION' },
    needs_review: { bg: 'bg-amber-500', label: 'NEEDS MANUAL REVIEW' },
  }[verdict] || { bg: 'bg-slate-600', label: 'PENDING' }

  return (
    <div className={`${config.bg} rounded-xl p-4 md:p-5 text-white`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-widest opacity-80 mb-1">SYSTEM RECOMMENDATION</p>
          <p className="text-base md:text-lg font-bold">{config.label}</p>
          <p className="text-xs md:text-sm opacity-85 mt-1">{summary}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl md:text-2xl font-bold">{passedChecks}/{totalChecks}</p>
          <p className="text-xs opacity-75">checks passed</p>
          <p className="text-xs mt-1 capitalize opacity-75">Confidence: {confidence}</p>
        </div>
      </div>
    </div>
  )
}

// ── ProcessingBanner ──────────────────────────────────────────────────────────
// Shown while the background task is still running. The page auto-polls
// (see useInvoice hook) so this will replace itself with VerdictBanner.
const ProcessingBanner = () => (
  <div className="bg-blue-600 rounded-xl p-4 md:p-5 text-white flex items-center gap-3 md:gap-4">
    <span className="w-5 h-5 md:w-6 md:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
    <div>
      <p className="font-semibold text-sm md:text-base">Processing Invoice</p>
      <p className="text-xs md:text-sm opacity-80">Extracting data and running validation checks… auto-updating.</p>
    </div>
  </div>
)

export default function InvoiceDetail() {
  const { id }  = useParams()
  const navigate = useNavigate()
  const toast    = useToast()
  const { isAdmin, user } = useAuth()

  // useInvoice polls automatically while status is "processing"
  const { data, loading, error, refetch } = useInvoice(id)

  const [showAudit,    setShowAudit]    = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [reprocessing, setReprocessing] = useState(false)

  const handleReprocess = async () => {
    setReprocessing(true)
    try {
      const res = await invoiceApi.reprocess(id)
      toast({ type: 'success', message: res.message || 'Invoice queued for reprocessing' })
      refetch()
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setReprocessing(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      await invoiceApi.delete(id)
      toast({ type: 'success', message: 'Invoice deleted' })
      setTimeout(() => navigate('/invoices'), 500)
    } catch (e) {
      toast({ type: 'error', message: e.message })
      setDeleting(false)
    }
  }

  // Fetch a fresh signed URL when the user clicks "Open file"
  const openSourceFile = async () => {
    try {
      const { url } = await invoiceApi.fileUrl(id)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      else toast({ type: 'error', message: 'File link could not be generated' })
    } catch (e) {
      toast({ type: 'error', message: e.message })
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => navigate('/invoices')} className="btn-secondary mt-4">Back to Invoices</button>
      </div>
    )
  }

  const { invoice, line_items = [], validation_checks = [], audit_trail = [] } = data || {}
  const rec = invoice   // invoice_summary view merges recommendation fields inline

  // Determine which UI states to show
  const isProcessing = invoice?.status === 'processing'
  const isReviewable = ['flagged', 'pending'].includes(invoice?.status)
  const isFinalised  = ['approved', 'rejected'].includes(invoice?.status)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back + title + delete ── */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/invoices')} className="btn-secondary mt-0.5 flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{invoice?.invoice_number}</h1>
            <StatusBadge status={invoice?.status} />
          </div>
          <p className="text-slate-500 text-xs md:text-sm mt-1 truncate">
            {invoice?.vendor_name} · Uploaded {formatDateTime(invoice?.uploaded_at)}
          </p>
        </div>
        {isAdmin && (
          confirmDelete ? (
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <span className="text-xs text-red-500 font-medium">Delete?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )
        )}
      </div>

      {/* ── Verdict / processing / failed banner ── */}
      {isProcessing ? (
        <ProcessingBanner />
      ) : invoice?.status === 'extraction_failed' ? (
        <div className="bg-red-600 rounded-xl p-4 md:p-5 text-white flex items-start gap-3 md:gap-4">
          <AlertCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm md:text-base">Extraction Failed</p>
            <p className="text-xs md:text-sm opacity-85 mt-1">
              The pipeline could not extract data from this invoice. This is usually a
              transient error (Groq rate-limit or network blip). Reprocess to retry.
            </p>
          </div>
          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white text-red-700 hover:bg-red-50 disabled:opacity-60 flex-shrink-0"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', reprocessing && 'animate-spin')} />
            {reprocessing ? 'Reprocessing…' : 'Reprocess'}
          </button>
        </div>
      ) : rec?.verdict ? (
        <VerdictBanner
          verdict={rec.verdict}
          summary={rec.summary}
          confidence={rec.confidence}
          passedChecks={rec.passed_checks}
          totalChecks={rec.total_checks}
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* ── LEFT COLUMN: invoice metadata, PDF link, line items ── */}
        <div className="space-y-5">
          {/* Invoice metadata card */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Invoice Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 md:gap-4">
              {[
                { icon: Hash,     label: 'Invoice No.',  value: invoice?.invoice_number },
                { icon: User,     label: 'Vendor',       value: invoice?.vendor_name },
                { icon: Calendar, label: 'Invoice Date', value: formatDate(invoice?.invoice_date) },
                { icon: FileText, label: 'PO Reference', value: invoice?.po_reference || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label}>
                  <p className="label">{label}</p>
                  <div className="flex items-center gap-1.5 text-sm text-slate-800 font-medium">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Reviewer decision — only shown after final human action */}
            {isFinalised && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="label">Reviewer Decision</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={invoice.status} />
                  <span className="text-sm text-slate-600">
                    by {invoice.reviewed_by} · {formatDateTime(invoice.reviewed_at)}
                  </span>
                </div>
                {invoice.reviewer_notes && (
                  <p className="text-sm text-slate-500 mt-2 italic">"{invoice.reviewer_notes}"</p>
                )}
              </div>
            )}
          </div>

          {/* Source file — fetches a fresh short-lived signed URL on click */}
          {invoice && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Source Document</h2>
              <button onClick={openSourceFile} className="btn-secondary w-full justify-center">
                <FileText className="w-4 h-4" /> Open Original File
              </button>
            </div>
          )}

          {/* Extracted line items table */}
          {line_items.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Extracted Line Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[420px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Description', 'Qty', 'Rate', 'Total', 'Grade'].map(h => (
                        <th key={h} className={cn(
                          'font-semibold text-slate-500 py-2.5 whitespace-nowrap',
                          h === 'Description' ? 'text-left px-5' : 'text-right px-4 last:text-left'
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {line_items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-800 font-medium max-w-[160px] truncate">{item.description || '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{item.quantity} {item.quantity_unit}</td>
                        <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(item.unit_rate)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(item.total_value)}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">{item.quality_grade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: validation checks, review panel, audit trail ── */}
        <div className="space-y-5">
          {/* Validation check list */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Validation Checks</h2>
            {validation_checks.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                {isProcessing ? 'Running checks…' : 'No validation results yet'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {validation_checks.map((check, i) => (
                  <div key={i} className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border text-sm',
                    check.passed
                      ? 'bg-green-50 border-green-200'
                      : check.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-red-50 border-red-200'
                  )}>
                    <CheckIcon passed={check.passed} severity={check.severity} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-semibold text-xs',
                        check.passed ? 'text-green-800' : check.severity === 'warning' ? 'text-amber-800' : 'text-red-800'
                      )}>
                        {check.check_label}
                      </p>
                      <p className={cn('text-xs mt-0.5',
                        check.passed ? 'text-green-700' : check.severity === 'warning' ? 'text-amber-700' : 'text-red-700'
                      )}>
                        {check.message}
                      </p>
                      {/* Show expected vs actual values when present — helps reviewer understand the discrepancy */}
                      {(check.expected_value || check.actual_value) && (
                        <div className="flex gap-3 mt-1.5 text-xs opacity-70">
                          {check.expected_value && <span>Expected: <strong>{check.expected_value}</strong></span>}
                          {check.actual_value   && <span>Got: <strong>{check.actual_value}</strong></span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Awaiting review — direct admin to Manage page */}
          {isReviewable && (
            <div className="card p-5 border border-amber-200 bg-amber-50/40">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Awaiting Human Review</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    The AI has completed its analysis. An admin must approve or reject this invoice.
                  </p>
                  {isAdmin && (
                    <button
                      onClick={() => navigate('/manage')}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors text-white"
                      style={{ backgroundColor: '#EB8C00' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#D04A02'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#EB8C00'}
                    >
                      Review in Manage <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Audit trail — collapsible timeline of all pipeline events */}
          {audit_trail.length > 0 && (
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowAudit(!showAudit)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Audit Trail ({audit_trail.length} events)
                </div>
                {showAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showAudit && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                  {audit_trail.map((log, i) => (
                    <div key={i} className="flex gap-3 text-xs">
                      {/* Vertical line connecting events */}
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 bg-slate-400 rounded-full mt-0.5 flex-shrink-0" />
                        {i < audit_trail.length - 1 && <div className="w-0.5 h-full bg-slate-100 mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="font-semibold text-slate-800 capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-slate-400">{log.actor} · {formatDateTime(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
