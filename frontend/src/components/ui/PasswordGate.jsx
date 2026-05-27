import { useState } from 'react'
import { Lock, User, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Authorised users ──────────────────────────────────────────────────────────
// Credentials are read from environment variables — never hardcoded.
// Set these in your .env file (local) or Vercel environment variables (production).
//
// VITE_USER1_NAME, VITE_USER1_EMAIL, VITE_USER1_PASSWORD
// VITE_USER2_NAME, VITE_USER2_EMAIL, VITE_USER2_PASSWORD
// VITE_USER3_NAME, VITE_USER3_EMAIL, VITE_USER3_PASSWORD
export const AUTHORISED_USERS = [
  { name: import.meta.env.VITE_USER1_NAME, email: import.meta.env.VITE_USER1_EMAIL, password: import.meta.env.VITE_USER1_PASSWORD },
  { name: import.meta.env.VITE_USER2_NAME, email: import.meta.env.VITE_USER2_EMAIL, password: import.meta.env.VITE_USER2_PASSWORD },
  { name: import.meta.env.VITE_USER3_NAME, email: import.meta.env.VITE_USER3_EMAIL, password: import.meta.env.VITE_USER3_PASSWORD },
].filter(u => u.email && u.password) // ignore unconfigured slots

// Settings page uses a single shared password
const SETTINGS_PASSWORD = import.meta.env.VITE_RULEBOOK_PASSWORD || 'pwc-admin'
const SETTINGS_SESSION  = 'settings_auth'

// ── Settings auth helpers ─────────────────────────────────────────────────────
export function isSettingsAuthenticated() {
  return sessionStorage.getItem(SETTINGS_SESSION) === '1'
}
function authenticateSettings() {
  sessionStorage.setItem(SETTINGS_SESSION, '1')
}

// ── Rulebook user login ───────────────────────────────────────────────────────
// Returns the matched user object or null.
export function loginUser(email, password) {
  return AUTHORISED_USERS.find(
    u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
  ) || null
}

// ── PasswordGate (Settings — single password) ─────────────────────────────────
export default function PasswordGate({ title = 'Protected Area', subtitle = 'Enter the manager password to continue', onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const attempt = () => {
    if (input === SETTINGS_PASSWORD) {
      authenticateSettings()
      onUnlock()
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 w-full max-w-sm space-y-5 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6 text-slate-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            className={cn('input w-full text-center tracking-widest', error && 'border-red-400 focus:ring-red-300')}
            placeholder="Password"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            autoFocus
          />
          {error && <p className="text-xs text-red-500">Incorrect password</p>}
          <button onClick={attempt} className="btn-primary w-full justify-center">Unlock</button>
        </div>
      </div>
    </div>
  )
}

// ── RulebookLoginGate (full page — email + password) ──────────────────────────
// Shows before the rulebook is accessible at all.
export function RulebookLoginGate({ onLogin }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')

  const attempt = () => {
    const user = loginUser(email, password)
    if (user) {
      onLogin(user)
    } else {
      setError('Invalid email or password')
      setPassword('')
      setTimeout(() => setError(''), 2500)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 w-full max-w-sm space-y-5 mx-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Rulebook Access</h2>
          <p className="text-sm text-slate-500 mt-1">Sign in with your manager credentials</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className={cn('input w-full', error && 'border-red-400')}
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className={cn('input w-full', error && 'border-red-400')}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && attempt()}
            />
          </div>
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button onClick={attempt} className="btn-primary w-full justify-center mt-1">
            Sign In
          </button>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400 text-center">
            Access restricted to authorised managers only
          </p>
        </div>
      </div>
    </div>
  )
}

// ── UserLoginModal (inline modal — for create/activate actions) ───────────────
// Always prompts even if already signed in — confirms identity per action.
export function UserLoginModal({ title = 'Confirm Identity', subtitle = 'Re-enter your credentials to proceed', onLogin, onCancel }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')

  // Both fields required — disables Confirm and short-circuits Enter.
  const canSubmit = email.trim() !== '' && password !== ''

  const attempt = () => {
    if (!canSubmit) {
      setError('Both email and password are required')
      setTimeout(() => setError(''), 2500)
      return
    }
    const user = loginUser(email, password)
    if (user) {
      onLogin(user)
    } else {
      setError('Invalid email or password')
      setPassword('')
      setTimeout(() => setError(''), 2500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in px-4">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="label">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              required
              className={cn('input w-full', error && 'border-red-400')}
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                className={cn('input w-full pr-10', error && 'border-red-400')}
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && attempt()}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                tabIndex={-1}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              onClick={attempt}
              disabled={!canSubmit}
              className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
