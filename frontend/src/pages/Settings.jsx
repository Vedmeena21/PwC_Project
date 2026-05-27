import { useState, useEffect } from 'react'
import { Mail, Bell, Plus, Trash2, Save, X, Loader2 } from 'lucide-react'
import { settingsApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

// ── Add-Recipient modal ───────────────────────────────────────────────────────
// Lets the admin type any email address to add as a notification recipient.
function AddRecipientModal({ existing, onAdd, onClose }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes('@')) { setError('Enter a valid email address.'); return }
    if (existing.includes(trimmed)) { setError('Already in the list.'); return }
    onAdd(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Add Recipient</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              required
              placeholder="manager@example.com"
              className="input w-full"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
          <p className="text-xs text-slate-400">
            This address will receive flagged-invoice alerts and rulebook-update emails.
          </p>
          <button type="submit" className="btn-primary w-full justify-center">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Settings() {
  const toast    = useToast()
  const { isAdmin, user } = useAuth()

  const [recipients,       setRecipients]       = useState([])
  const [notifyOnFlag,     setNotifyOnFlag]      = useState(true)
  const [notifyOnRulebook, setNotifyOnRulebook]  = useState(true)
  const [loading,          setLoading]           = useState(true)
  const [saving,           setSaving]            = useState(false)
  const [showAddModal,     setShowAddModal]       = useState(false)

  useEffect(() => {
    Promise.all([settingsApi.getRecipients(), settingsApi.getAll()])
      .then(([rec, all]) => {
        setRecipients(rec.recipients || [])
        setNotifyOnFlag(all.auto_notify_on_flag === 'true')
        setNotifyOnRulebook(all.auto_notify_on_rulebook_update === 'true')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const addRecipient = (email) => {
    setRecipients(r => [...r, email])
    setShowAddModal(false)
  }

  const removeRecipient = (email) => {
    setRecipients(r => r.filter(e => e !== email))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      await Promise.all([
        settingsApi.updateRecipients(recipients),
        settingsApi.updateSetting('auto_notify_on_flag',            String(notifyOnFlag)),
        settingsApi.updateSetting('auto_notify_on_rulebook_update', String(notifyOnRulebook)),
      ])
      toast({ type: 'success', message: `Settings saved` })
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading...</div>
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl w-full">
      {showAddModal && (
        <AddRecipientModal
          existing={recipients}
          onAdd={addRecipient}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure notifications and system preferences</p>
      </div>

      {/* ── Email recipients ── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Notification Recipients</h2>
        </div>
        <p className="text-xs text-slate-500">
          These addresses receive all system notifications (flagged invoices, rulebook updates).
        </p>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Currently subscribed{recipients.length > 0 && ` (${recipients.length})`}
          </p>
          {recipients.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 px-3 bg-slate-50 rounded-lg">
              No recipients yet — nobody will receive notification emails until you add one below.
            </p>
          ) : (
            recipients.map((email) => {
              const initial = email[0].toUpperCase()
              return (
                <div key={email} className="flex items-start justify-between px-3 py-3 bg-slate-50 rounded-lg">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{email}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Receives flagged-invoice alerts &amp; rulebook-update emails
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeRecipient(email)}
                      className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2 mt-0.5"
                      aria-label={`Remove ${email}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {isAdmin && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" />
            Add Recipient
          </button>
        )}
      </div>

      {/* ── Notification toggles ── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Notification Triggers</h2>
        </div>

        {[
          { label: 'Invoice Flagged',  description: 'Send email when an invoice fails validation checks',        value: notifyOnFlag,     set: setNotifyOnFlag     },
          { label: 'Rulebook Updated', description: 'Send diff email when a new rulebook version is activated',  value: notifyOnRulebook, set: setNotifyOnRulebook },
        ].map(({ label, description, value, set }) => (
          <div key={label} className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
            <div>
              <p className="text-sm font-medium text-slate-900">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
            <button
              onClick={() => isAdmin && set(v => !v)}
              disabled={!isAdmin}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                value ? 'bg-slate-900' : 'bg-slate-300'
              } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
        ))}

        {!isAdmin && (
          <p className="text-xs text-slate-400 italic">Only admins can change notification settings.</p>
        )}
      </div>

      {/* Save */}
      {isAdmin && (
        <button onClick={saveAll} disabled={saving} className="btn-primary w-full sm:w-auto justify-center">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      )}
    </div>
  )
}
