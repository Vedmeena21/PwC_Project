import { useState, useEffect, useCallback } from 'react'
import { invoiceApi, rulebookApi } from '@/services/api'


// ══ INVOICE HOOKS ════════════════════════════════════════════════════════════

// Fetches the invoice list with optional filters (status, limit, offset).
// Re-fetches whenever filters change. Exposes refetch() for manual refresh.
export function useInvoices(filters = {}) {
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetch = useCallback(async () => {
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

// Fetches a single invoice with full detail (line items, checks, audit trail).
// Auto-polls every 3 seconds while status is "processing" so the detail page
// updates without a manual refresh.
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

  useEffect(() => {
    const status = data?.invoice?.status
    if (status === 'processing' || (status === 'pending' && !data?.invoice?.verdict)) {
      const timer = setTimeout(fetch, 3000)
      return () => clearTimeout(timer)
    }
  }, [data, fetch])

  return { data, loading, error, refetch: fetch }
}

// Fetches per-status invoice counts for the Dashboard stat cards.
export function useStats() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoiceApi.stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading }
}


// ══ RULEBOOK HOOKS ════════════════════════════════════════════════════════════

// Fetches all rulebook versions (newest first) for the Rulebook manager page.
// Exposes refetch() so the list updates after create / activate.
export function useRulebookVersions() {
  const [versions, setVersions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await rulebookApi.list()
      setVersions(data.versions || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { versions, loading, error, refetch: fetch }
}

// Fetches the currently active rulebook version.
// Returns null if no version has been activated yet.
export function useActiveRulebook() {
  const [rulebook, setRulebook] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    rulebookApi.getActive()
      .then(setRulebook)
      .catch(() => setRulebook(null))
      .finally(() => setLoading(false))
  }, [])

  return { rulebook, loading }
}
