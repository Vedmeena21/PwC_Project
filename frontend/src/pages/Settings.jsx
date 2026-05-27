import { useState, useEffect } from 'react'
import { Mail, Bell, Plus, Trash2, Save, Lock, X, UserCheck } from 'lucide-react'
import { settingsApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import { UserLoginModal, AUTHORISED_USERS } from '@/components/ui/PasswordGate'

export default function Settings() {
  const toast = useToast()

  const [recipients,       setRecipients]       = useState([])
  const [showAddModal,     setShowAddModal]      = useState(false)
  const [notifyOnFlag,     setNotifyOnFlag]      = useState(true)
  const [notifyOnRulebook, setNotifyOnRulebook]  = useState(true)
  const [loading,          setLoading]           = useState(true)
  const [saving,           setSaving]            = useState(false)
  const [showAuth,         setShowAuth]          = useState(false)
  // Gate for Add Recipient: must authenticate before the manager list is revealed.
  // Otherwise visitors could enumerate authorised manager names + emails just by
  // clicking the button.
  const [showAddAuth,      setShowAddAuth]       = useState(false)
  // Gate for Notification Triggers: toggles are hidden until the user
  // authenticates — visitors should not see (let alone change) which
  // notifications are enabled without proving they're a manager.
  const [triggersUnlocked, setTriggersUnlocked]  = useState(false)
  const [showTriggersAuth, setShowTriggersAuth]  = useState(false)

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
    if (recipients.includes(email)) { toast({ type: 'error', message: 'Already in list' }); return }
    setRecipients(r => [...r, email])
    setShowAddModal(false)
  }

  const removeEmail = (email) => setRecipients(r => r.filter(e => e !== email))

  // Save is gated — clicking Save shows auth modal first
  const handleSaveClick = () => setShowAuth(true)

  const saveAll = async (user) => {
    setShowAuth(false)
    setSaving(true)
    try {
      await Promise.all([
        settingsApi.updateRecipients(recipients),
        settingsApi.updateSetting('auto_notify_on_flag',            String(notifyOnFlag)),
        settingsApi.updateSetting('auto_notify_on_rulebook_update', String(notifyOnRulebook)),
      ])
      toast({ type: 'success', message: `Settings saved by ${user.name}` })
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
      {showAuth && (
        <UserLoginModal
          title="Confirm to Save"
          subtitle="Enter your manager credentials to apply changes"
          onLogin={saveAll}
          onCancel={() => setShowAuth(false)}
        />
      )}

      {showAddAuth && (
        <UserLoginModal
          title="Verify Identity"
          subtitle="Sign in to view the manager list"
          onLogin={() => { setShowAddAuth(false); setShowAddModal(true) }}
          onCancel={() => setShowAddAuth(false)}
        />
      )}

      {showTriggersAuth && (
        <UserLoginModal
          title="Verify Identity"
          subtitle="Sign in to view and edit notification triggers"
          onLogin={() => { setShowTriggersAuth(false); setTriggersUnlocked(true) }}
          onCancel={() => setShowTriggersAuth(false)}
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in px-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Recipient</h3>
                  <p className="text-xs text-slate-500">Select a verified manager to add</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {AUTHORISED_USERS.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No authorised users configured.<br/>Set VITE_USER* env vars to add users.</p>
              ) : (
                AUTHORISED_USERS.map(u => (
                  <button
                    key={u.email}
                    onClick={() => addRecipient(u.email)}
                    disabled={recipients.includes(u.email)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors
                      ${recipients.includes(u.email)
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : 'border-slate-200 hover:border-slate-900 hover:bg-slate-50 cursor-pointer'}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600">
                      {u.name ? u.name[0].toUpperCase() : u.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.name || u.email}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    {recipients.includes(u.email) && (
                      <span className="ml-auto text-xs text-slate-400 flex-shrink-0">Added</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
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
        <p className="text-xs text-slate-500">These addresses receive all system notifications (flagged invoices, rulebook updates).</p>

        {/* Currently-subscribed list — labelled so first-time viewers
            immediately understand these are active recipients, not examples. */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Currently subscribed{recipients.length > 0 && ` (${recipients.length})`}
          </p>
          {recipients.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 px-3 bg-slate-50 rounded-lg">
              No recipients yet — nobody will receive notification emails until you add one below.
            </p>
          ) : (
            recipients.map((email) => (
              <div key={email} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{email}</span>
                </div>
                <button
                  onClick={() => removeEmail(email)}
                  className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                  aria-label={`Remove ${email}`}
                  title="Remove recipient"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <button onClick={() => setShowAddAuth(true)} className="btn-primary w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" />
          Add Recipient
        </button>
      </div>

      {/* ── Notification toggles (gated) ── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Notification Triggers</h2>
        </div>

        {!triggersUnlocked ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Sign in to view triggers</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Notification triggers are visible only to authorised managers
              </p>
            </div>
            <button onClick={() => setShowTriggersAuth(true)} className="btn-primary">
              <Lock className="w-4 h-4" />
              Unlock
            </button>
          </div>
        ) : (
          [
            { label: 'Invoice Flagged',   description: 'Send email when an invoice fails validation checks',          value: notifyOnFlag,     set: setNotifyOnFlag     },
            { label: 'Rulebook Updated',  description: 'Send diff email when a new rulebook version is activated',   value: notifyOnRulebook, set: setNotifyOnRulebook },
          ].map(({ label, description, value, set }) => (
            <div key={label} className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
              </div>
              <button
                onClick={() => set(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${value ? 'bg-slate-900' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Save — triggers auth modal */}
      <button onClick={handleSaveClick} disabled={saving} className="btn-primary w-full sm:w-auto justify-center">
        <Lock className="w-4 h-4" />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
