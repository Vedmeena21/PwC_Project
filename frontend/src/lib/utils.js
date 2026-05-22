import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ── cn ────────────────────────────────────────────────────────────────────────
// Merges Tailwind class strings safely. Handles conditional classes (clsx)
// and removes Tailwind conflicts (twMerge) e.g. p-4 + p-2 → p-2.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ── Currency formatting ───────────────────────────────────────────────────────
// Uses the Indian locale and INR currency code for comma grouping (1,00,000).
export function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(value)
}

// ── Date formatting ───────────────────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Verdict display helpers ───────────────────────────────────────────────────
// Used by multiple pages; centralised to keep colours consistent.
export function verdictColor(verdict) {
  return { approve: 'text-green-700', reject: 'text-red-700', needs_review: 'text-amber-700' }[verdict] || 'text-slate-600'
}

export function verdictBg(verdict) {
  return { approve: 'bg-green-600', reject: 'bg-red-600', needs_review: 'bg-amber-500' }[verdict] || 'bg-slate-500'
}

export function verdictLabel(verdict) {
  return { approve: 'Approve', reject: 'Reject', needs_review: 'Needs Review' }[verdict] || verdict
}
