import { useState, useEffect, useCallback } from 'react'
import { invoiceApi } from '@/services/api'

// ── useInvoices ───────────────────────────────────────────────────────────────
// Fetches the invoice list with optional filters (status, limit, offset).
// Re-fetches whenever filters change. Exposes a refetch() for manual refresh.
export function useInvoices(filters = {}) {
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  // Stringify filters for stable useCallback dep — avoids infinite re-fetch
  const fetch = useCallback(async () => {
    // limit:0 is used as a sentinel to skip fetching (e.g. popover not visible)
    if (filters.limit === 0) { setInvoices([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await invoiceApi.list(filters)
      setInvoices(data.invoices || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)])

  useEffect(() => { fetch() }, [fetch])
  return { invoices, loading, error, refetch: fetch }
}

// ── useInvoice ────────────────────────────────────────────────────────────────
// Fetches a single invoice with all detail (line items, checks, audit trail).
// Auto-polls every 3 seconds while status is "processing" or "pending"
// (no extraction result yet) so the detail page updates without a refresh.
export function useInvoice(id) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoiceApi.get(id)
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  // Polling effect — only active while the invoice is still being processed
  useEffect(() => {
    const status = data?.invoice?.status
    if (status === 'processing' || (status === 'pending' && !data?.invoice?.verdict)) {
      const timer = setTimeout(fetch, 3000) // poll every 3 seconds
      return () => clearTimeout(timer)
    }
  }, [data, fetch])

  return { data, loading, error, refetch: fetch }
}

// ── useStats ──────────────────────────────────────────────────────────────────
// Fetches the per-status invoice counts for the Dashboard stat cards.
export function useStats() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoiceApi.stats()
      .then(setStats)
      .catch(() => {})           // stats failure is non-critical — show nothing
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading }
}
