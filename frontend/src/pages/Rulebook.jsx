import { useState } from 'react'
import {
  BookOpen, Plus, CheckCircle, ArrowRight,
  ChevronDown, ChevronUp, Zap, GitCompare, X,
} from 'lucide-react'
import { useRulebookVersions, useActiveRulebook } from '@/hooks/useApi'
import { rulebookApi } from '@/services/api'
import { useToast } from '@/components/ui/Toast'
import { UserLoginModal } from '@/components/ui/PasswordGate'
import { formatDateTime, cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = ['steel_rod', 'steel_plate', 'cement', 'other']
const RULE_KEY_OPTIONS = [
  'approved_rate_per_mt',
  'approved_rate',
  'min_quantity',
  'max_quantity',
  'required_quality_grade',
  'max_tolerance_pct',
]

const emptyRule = () => ({
  item_category: 'steel_rod',
  rule_key:      '',
  rule_value:    '',
  unit:          '',
  description:   '',
})

// ── DiffView ──────────────────────────────────────────────────────────────────
// Shows older (from) → newer (to) with both labels. onClose dismisses the panel.
const DiffView = ({ diff, onClose }) => {
  if (!diff) return null

  const TYPE_CFG = {
    added:    { color: 'text-green-700', bg: 'bg-green-50 border-green-200',  label: 'NEW'     },
    removed:  { color: 'text-red-700',   bg: 'bg-red-50 border-red-200',      label: 'REMOVED' },
    modified: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200',  label: 'CHANGED' },
  }

  // from_label is added by the backend; fall back to integer if an older response is cached
  const fromTitle = diff.from_label ? `${diff.from_label} v${diff.from_version}` : `Version ${diff.from_version}`
  const toTitle   = `${diff.label} v${diff.to_version}`

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <GitCompare className="w-4 h-4 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500">{fromTitle}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900">{toTitle}</span>
        </h3>
        <div className="flex gap-2 ml-auto text-xs items-center">
          <span className="text-green-600 font-semibold">+{diff.total_added}</span>
          <span className="text-amber-600 font-semibold">~{diff.total_modified}</span>
          <span className="text-red-600   font-semibold">-{diff.total_removed}</span>
          <button
            onClick={onClose}
            aria-label="Close diff"
            className="ml-1 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {diff.changes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No changes between versions</p>
      ) : (
        <div className="space-y-2">
          {diff.changes.map((c, i) => {
            const cfg = TYPE_CFG[c.change_type]
            return (
              <div key={i} className={cn('flex items-start gap-3 p-3 rounded-lg border text-sm', cfg.bg)}>
                <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded mt-0.5 bg-white/60', cfg.color)}>
                  {cfg.label}
                </span>
                <div className="flex-1">
                  <p className={cn('font-semibold text-xs', cfg.color)}>
                    {c.item_category.replaceAll('_', ' ').replace(/\b\w/g, s => s.toUpperCase())}
                    {' — '}
                    {c.rule_key.replaceAll('_', ' ')}
                  </p>
                  {c.change_type === 'modified' && (
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="line-through text-red-600">{c.old_value} {c.old_unit}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-green-700 font-semibold">{c.new_value} {c.new_unit}</span>
                    </div>
                  )}
                  {c.change_type === 'added' && (
                    <p className="text-xs text-green-700 mt-1">{c.new_value} {c.new_unit}</p>
                  )}
                  {c.change_type === 'removed' && (
                    <p className="text-xs text-red-600 mt-1 line-through">{c.old_value} {c.old_unit}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── RulesTable ────────────────────────────────────────────────────────────────
const RulesTable = ({ rules }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs min-w-[480px]">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['Category', 'Rule Key', 'Value', 'Unit', 'Description'].map(h => (
            <th key={h} className="text-left font-semibold text-slate-500 px-4 py-2.5">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rules.map((rule, i) => (
          <tr key={i} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium text-slate-800 capitalize">{rule.item_category.replaceAll('_', ' ')}</td>
            <td className="px-4 py-2.5 text-slate-600 capitalize">{rule.rule_key.replaceAll('_', ' ')}</td>
            <td className="px-4 py-2.5 font-semibold text-slate-900">{rule.rule_value}</td>
            <td className="px-4 py-2.5 text-slate-500">{rule.unit || '—'}</td>
            <td className="px-4 py-2.5 text-slate-400">{rule.description || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────
// Rulebook is viewable by anyone. Auth only required for create / activate.
export default function Rulebook() {
  return <RulebookInner />
}

function RulebookInner() {
  const toast = useToast()
  const { versions, loading, refetch } = useRulebookVersions()
  const { rulebook: active }           = useActiveRulebook()

  const [showCreate,  setShowCreate]  = useState(false)
  const [expandedId,  setExpandedId]  = useState(null)
  const [diff,        setDiff]        = useState(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [activating,  setActivating]  = useState(null)

  // pendingAction: a function(user) to call after re-auth modal confirms
  const [pendingAction, setPendingAction] = useState(null)

  const [form,     setForm]     = useState({ label: '', notes: '', created_by: '', rules: [emptyRule()] })
  const [creating, setCreating] = useState(false)

  const addRule    = () => setForm(f => ({ ...f, rules: [...f.rules, emptyRule()] }))
  const removeRule = (i) => setForm(f => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }))
  const updateRule = (i, field, value) =>
    setForm(f => ({ ...f, rules: f.rules.map((r, idx) => idx === i ? { ...r, [field]: value } : r) }))

  // Always re-prompt credentials before any write action
  const requireAuth = (action) => setPendingAction(() => action)

  const onReAuthSuccess = (user) => {
    const action = pendingAction
    setPendingAction(null)
    if (action) action(user)
  }

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (user) => {
    if (!form.label) { toast({ type: 'error', message: 'Rulebook name is required' }); return }
    if (form.rules.some(r => !r.rule_key || !r.rule_value)) {
      toast({ type: 'error', message: 'All rules must have a key and value' }); return
    }
    setCreating(true)
    try {
      await rulebookApi.create({ ...form, created_by: user.name })
      toast({ type: 'success', message: `Rulebook version created by ${user.name}` })
      setShowCreate(false)
      setForm({ label: '', notes: '', created_by: user.name, rules: [emptyRule()] })
      refetch()
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setCreating(false)
    }
  }

  // ── Activate ──────────────────────────────────────────────────────────────
  const handleActivate = async (id, user) => {
    setActivating(id)
    try {
      await rulebookApi.activate(id, user.name)
      toast({ type: 'success', message: `Activated by ${user.name}. Team will be notified.` })
      refetch()
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setActivating(null)
    }
  }

  // ── Diff ──────────────────────────────────────────────────────────────────
  const handleDiff = async (fromId, toId) => {
    setDiffLoading(true)
    try {
      setDiff(await rulebookApi.diff(fromId, toId))
    } catch (e) {
      toast({ type: 'error', message: e.message })
    } finally {
      setDiffLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Re-auth modal for write actions */}
      {pendingAction && (
        <UserLoginModal
          title="Confirm Identity"
          subtitle="Re-enter your credentials to proceed"
          onLogin={onReAuthSuccess}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Rulebook</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and version approval criteria</p>
        </div>
        <button
          onClick={() => requireAuth((user) => { setShowCreate(true); setForm(f => ({ ...f, created_by: user.name })) })}
          className="btn-primary flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Version</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* ── Active rulebook banner ── */}
      {active && (
        <div className="card p-4 border-l-4 border-l-green-500 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Active: {active.label} v{active.version}
            </p>
            <p className="text-xs text-slate-500">
              {active.rules.length} rules · All new invoices validated against this version
            </p>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {showCreate && (
        <div className="card p-6 animate-slide-up space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">Create New Rulebook Version</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" placeholder="e.g. May 2025, Q1 Revision"
                value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="label">Created By</label>
              <input className="input" placeholder="Your name"
                value={form.created_by} onChange={e => setForm(f => ({ ...f, created_by: e.target.value }))} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Optional notes"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Rules</label>
              <button onClick={addRule} className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>
            </div>
            <div className="space-y-3">
              {form.rules.map((rule, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select className="input text-xs" value={rule.item_category}
                      onChange={e => updateRule(i, 'item_category', e.target.value)}>
                      {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select className="input text-xs" value={rule.rule_key}
                      onChange={e => updateRule(i, 'rule_key', e.target.value)}>
                      <option value="">Select key</option>
                      {RULE_KEY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input text-xs" placeholder="Value" value={rule.rule_value}
                      onChange={e => updateRule(i, 'rule_value', e.target.value)} />
                    <input className="input text-xs" placeholder="Unit (e.g. INR/MT)" value={rule.unit}
                      onChange={e => updateRule(i, 'unit', e.target.value)} />
                  </div>
                  <div className="flex gap-1">
                    <input className="input text-xs flex-1" placeholder="Description" value={rule.description}
                      onChange={e => updateRule(i, 'description', e.target.value)} />
                    {form.rules.length > 1 && (
                      <button onClick={() => removeRule(i)} className="px-2 text-red-500 hover:text-red-700 text-xs font-bold">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => requireAuth((user) => handleCreate(user))} disabled={creating} className="btn-primary">
              {creating ? 'Creating…' : 'Create Version'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {diff && <DiffView diff={diff} onClose={() => setDiff(null)} />}

      {/* ── Version list ── */}
      <div className="space-y-3">
        {loading ? (
          <div className="card p-8 text-center text-slate-400 text-sm">Loading versions…</div>
        ) : versions.length === 0 ? (
          <div className="card p-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No rulebook versions yet. Create one above.</p>
          </div>
        ) : (
          versions.map((v, idx) => (
            <div key={v.id} className={cn('card overflow-hidden', v.is_active && 'border-green-300')}>
              <div className="flex items-start gap-3 px-4 md:px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">{v.label} · v{v.version}</p>
                    {v.is_active && <span className="badge bg-green-100 text-green-700">Active</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {v.rules.length} rules · Created by <span className="font-medium text-slate-600">{v.created_by || 'system'}</span> · {formatDateTime(v.created_at)}
                    {v.notes && ` · ${v.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!v.is_active && (
                    <>
                      <button
                        onClick={() => requireAuth((user) => handleActivate(v.id, user))}
                        disabled={activating === v.id}
                        className="btn-secondary text-xs py-1.5 px-2.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{activating === v.id ? 'Activating…' : 'Activate'}</span>
                      </button>
                      {/* Diff against the currently active rulebook — direction: this (older) → active (newer). */}
                      {active && active.id !== v.id && (
                        <button onClick={() => handleDiff(v.id, active.id)}
                          disabled={diffLoading} className="btn-secondary text-xs py-1.5 px-2.5">
                          <GitCompare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Diff vs Active</span>
                        </button>
                      )}
                    </>
                  )}
                  <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    className="btn-secondary text-xs py-1.5 px-2.5">
                    {expandedId === v.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {expandedId === v.id && (
                <div className="border-t border-slate-100">
                  <RulesTable rules={v.rules} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
