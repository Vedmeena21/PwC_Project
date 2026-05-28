import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merges Tailwind class strings, resolving conflicts (e.g. p-4 + p-2 → p-2).
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Indian locale and INR currency code for comma grouping (1,00,000).
export function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(value)
}

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

export function verdictColor(verdict) {
  return { approve: 'text-green-700', reject: 'text-red-700', needs_review: 'text-amber-700' }[verdict] || 'text-slate-600'
}

export function verdictBg(verdict) {
  return { approve: 'bg-green-600', reject: 'bg-red-600', needs_review: 'bg-amber-500' }[verdict] || 'bg-slate-500'
}

export function verdictLabel(verdict) {
  return { approve: 'Approve', reject: 'Reject', needs_review: 'Needs Review' }[verdict] || verdict
}
