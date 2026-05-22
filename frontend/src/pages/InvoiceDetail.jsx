import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, XCircle, AlertCircle,
  Clock, FileText, ChevronDown, ChevronUp, User, Calendar, Hash, Trash2,
} from 'lucide-react'
import { useInvoice } from '@/hooks/useApi'
import { invoiceApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { UserLoginModal } from '@/components/ui/PasswordGate'
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

  // useInvoice polls automatically while status is "processing"
  const { data, loading, error, refetch } = useInvoice(id)

  const [reviewerName, setReviewerName] = useState('')
  const [reviewNotes,  setReviewNotes]  = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [showAudit,    setShowAudit]    = useState(false)
  const [showDeleteAuth, setShowDeleteAuth] = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  const handleDelete = async (user) => {
    setShowDeleteAuth(false)
    setDeleting(true)
    try {
      await invoiceApi.delete(id, user.name)
      toast({ type: 'success', message: `Invoice deleted by ${user.name}` })
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

  // Submit human review decision (approve or reject)
  const handleReview = async (action) => {
    if (!reviewerName.trim()) {
      toast({ type: 'error', message: 'Please enter your name before submitting' })
      return
    }
    setSubmitting(true)
    try {
      await invoiceApi.review(id, { action, reviewer_name: reviewerName, notes: reviewNotes })
      toast({ type: 'success', message: `Invoice ${action} successfully` })
      refetch()
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {showDeleteAuth && (
        <UserLoginModal
          title="Confirm Delete"
          subtitle="Re-enter your credentials to delete this invoice"
          onLogin={handleDelete}
          onCancel={() => setShowDeleteAuth(false)}
        />
      )}

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
        <button
          onClick={() => setShowDeleteAuth(true)}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50"
          title="Delete invoice"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{deleting ? 'Deleting…' : 'Delete'}</span>
        </button>
      </div>

      {/* ── Verdict / processing banner ── */}
      {isProcessing ? (
        <ProcessingBanner />
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
          {invoice?.pdf_path && (
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

          {/* Human review panel — only visible when invoice needs a decision */}
          {isReviewable && (
            <div className="card p-5 border-2 border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Human Review</h2>
              <p className="text-xs text-slate-500 mb-4">Final approval decision rests with you.</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Your Name *</label>
                  <input className="input" placeholder="Enter your name"
                    value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Notes (optional)</label>
                  <textarea className="input resize-none" rows={3} placeholder="Add any review notes…"
                    value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
                  <button onClick={() => handleReview('approved')} disabled={submitting} className="btn-success flex-1 justify-center">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleReview('rejected')} disabled={submitting} className="btn-danger flex-1 justify-center">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
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
