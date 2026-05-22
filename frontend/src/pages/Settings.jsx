import { useState, useEffect } from 'react'
import { Mail, Bell, Plus, Trash2, Save, Lock } from 'lucide-react'
import { settingsApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import { UserLoginModal } from '@/components/ui/PasswordGate'

export default function Settings() {
  const toast = useToast()

  const [recipients,       setRecipients]       = useState([])
  const [newEmail,         setNewEmail]          = useState('')
  const [notifyOnFlag,     setNotifyOnFlag]      = useState(true)
  const [notifyOnRulebook, setNotifyOnRulebook]  = useState(true)
  const [loading,          setLoading]           = useState(true)
  const [saving,           setSaving]            = useState(false)
  const [showAuth,         setShowAuth]          = useState(false)

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

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { toast({ type: 'error', message: 'Enter a valid email address' }); return }
    if (recipients.includes(email))     { toast({ type: 'error', message: 'Already in list' }); return }
    setRecipients(r => [...r, email])
    setNewEmail('')
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

        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="name@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEmail()}
          />
          <button onClick={addEmail} className="btn-primary px-3">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {recipients.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">No recipients added yet</p>
        ) : (
          <div className="space-y-2">
            {recipients.map((email) => (
              <div key={email} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-700">{email}</span>
                </div>
                <button onClick={() => removeEmail(email)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Notification toggles ── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Notification Triggers</h2>
        </div>
        {[
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
        ))}
      </div>

      {/* Save — triggers auth modal */}
      <button onClick={handleSaveClick} disabled={saving} className="btn-primary w-full sm:w-auto justify-center">
        <Lock className="w-4 h-4" />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
