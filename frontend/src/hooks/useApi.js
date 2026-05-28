import { useState, useEffect, useCallback, useRef } from 'react'
import { invoiceApi, rulebookApi, authApi } from '@/services/api'


export function useInvoices(filters = {}) {
  const [invoices, setInvoices] = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetch = useCallback(async () => {
    if (filters.limit === 0) { setInvoices([]); setTotal(0); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await invoiceApi.list(filters)
      setInvoices(data.invoices || [])
      setTotal(data.total ?? (data.invoices?.length || 0))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)])

  useEffect(() => { fetch() }, [fetch])
  return { invoices, total, loading, error, refetch: fetch }
}

// Auto-polls every 3 seconds while status is "processing" so the detail page
// updates without a manual refresh.
export function useInvoice(id) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoiceApi.get(id)
      if (mountedRef.current) setData(result)
    } catch (e) {
      if (mountedRef.current) setError(e.message || 'Failed to load invoice')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  // Stop after 60 attempts (~3 minutes) so a stuck background task doesn't poll
  // forever and burn API quota.
  const pollCountRef = useRef(0)
  useEffect(() => {
    const status = data?.invoice?.status
    const stillProcessing = status === 'processing'
    if (!stillProcessing) { pollCountRef.current = 0; return }
    if (pollCountRef.current >= 60) return
    const timer = setTimeout(() => {
      pollCountRef.current += 1
      fetch()
    }, 3000)
    return () => clearTimeout(timer)
  }, [data, fetch])

  return { data, loading, error, refetch: fetch }
}

// view: 'all' (admin sees everyone) | 'mine' (own uploads only)
export function useStats(view = 'all') {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    invoiceApi.stats({ view })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [view])

  return { stats, loading }
}


// Returns the total count of actions needed in Manage:
// pending user approvals + invoices awaiting review (flagged + pending).
// Polls every 30s so the badge stays fresh without hammering the API.
export function useManageBadge(isAdmin = false) {
  const [count, setCount] = useState(0)

  const fetch = useCallback(async () => {
    if (!isAdmin) return
    try {
      const [users, flagged, pending] = await Promise.all([
        authApi.pending(),
        invoiceApi.list({ status: 'flagged', limit: 1, view: 'all' }),
        invoiceApi.list({ status: 'pending', limit: 1, view: 'all' }),
      ])
      setCount(
        (users.users?.length || 0) +
        (flagged.total || 0) +
        (pending.total || 0)
      )
    } catch {
      // silently ignore — badge is non-critical
    }
  }, [isAdmin])

  useEffect(() => {
    fetch()
    const t = setInterval(fetch, 30000)
    // Instant refresh when Manage page completes an action
    window.addEventListener('manage:action', fetch)
    return () => {
      clearInterval(t)
      window.removeEventListener('manage:action', fetch)
    }
  }, [fetch])

  return count
}

// Call this after any action in Manage to instantly refresh the sidebar badge
export function notifyManageAction() {
  window.dispatchEvent(new Event('manage:action'))
}


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
