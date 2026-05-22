import { useState, useEffect, useCallback } from 'react'
import { rulebookApi } from '@/services/api'

// ── useRulebookVersions ───────────────────────────────────────────────────────
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

// ── useActiveRulebook ─────────────────────────────────────────────────────────
// Fetches the currently active rulebook — used by the settings and
// the active-rulebook banner on the Rulebook page.
// Returns null if no rulebook has been activated yet.
export function useActiveRulebook() {
  const [rulebook, setRulebook] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    rulebookApi.getActive()
      .then(setRulebook)
      .catch(() => setRulebook(null)) // 404 is expected when no version is active
      .finally(() => setLoading(false))
  }, [])

  return { rulebook, loading }
}
