import { cn } from '@/lib/utils'

// ── StatusBadge ───────────────────────────────────────────────────────────────
// Renders a colour-coded pill for invoice status or AI verdict.
// Covers both invoice.status values and recommendation.verdict values
// so the same component works in the list table and the detail page.
const CONFIG = {
  // Invoice lifecycle statuses
  pending:           { label: 'Pending',      cls: 'badge-pending' },
  processing:        { label: 'Processing',   cls: 'badge-processing' },  // pulses
  approved:          { label: 'Approved',     cls: 'badge-approved' },
  rejected:          { label: 'Rejected',     cls: 'badge-rejected' },
  flagged:           { label: 'Flagged',      cls: 'badge-flagged' },
  extraction_failed: { label: 'Failed',       cls: 'badge-extraction_failed' },
  // AI verdict values
  approve:           { label: 'Approve',      cls: 'badge bg-green-100 text-green-700' },
  reject:            { label: 'Reject',       cls: 'badge bg-red-100 text-red-700' },
  needs_review:      { label: 'Needs Review', cls: 'badge bg-amber-100 text-amber-700' },
}

export default function StatusBadge({ status, className }) {
  const { label, cls } = CONFIG[status] || { label: status, cls: 'badge bg-slate-100 text-slate-600' }
  return <span className={cn(cls, className)}>{label}</span>
}
