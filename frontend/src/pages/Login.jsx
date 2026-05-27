import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react'
import api from '@/services/api'
import { useAuth } from '@/context/AuthContext'

// ── Login / Signup page ───────────────────────────────────────────────────────
// Single combined page:
//   • "Sign in" tab  → immediate JWT login
//   • "Sign up" tab  → creates pending account, shows waiting screen
//   After signup the user must wait for admin approval before they can log in.

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [tab,       setTab]       = useState('login') // 'login' | 'signup'
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [pending,   setPending]   = useState(false) // signup awaiting approval

  // Shared fields
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  // Signup-only fields
  const [name,     setName]     = useState('')
  const [note,     setNote]     = useState('')

  const switchTab = (t) => { setTab(t); setError('') }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/login', { email, password })
      login(data.access_token, data.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      await api.post('/auth/signup', {
        email,
        password,
        name:        name.trim() || undefined,
        signup_note: note.trim() || undefined,
      })
      setPending(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Pending approval screen ───────────────────────────────────────────────
  if (pending) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-white text-xl font-semibold">Request submitted</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your account is pending approval. The admin will review your request and
            you'll be able to sign in once approved.
          </p>
          <p className="text-slate-500 text-xs">
            Already approved?{' '}
            <button
              onClick={() => { setPending(false); setTab('login'); setPassword('') }}
              className="text-brand-400 hover:text-brand-300 underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-white text-xl font-bold">Invoice Approval System</h1>
          <p className="text-slate-500 text-sm">PwC Automation Project</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">

          {/* Tab switcher */}
          <div className="flex bg-slate-800/60 rounded-lg p-1">
            {['login', 'signup'].map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  tab === t
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={tab === 'login' ? handleLogin : handleSignup} className="space-y-3">

            {/* Name — signup only */}
            {tab === 'signup' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Full name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Your password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Signup note */}
            {tab === 'signup' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Why do you need access?{' '}
                  <span className="text-slate-600">(optional, max 150 chars)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0, 150))}
                  rows={2}
                  placeholder="e.g. Finance team intern, need to upload vendor invoices"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
                <p className="text-right text-slate-600 text-xs mt-0.5">{note.length}/150</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {tab === 'login' ? 'Sign in' : 'Request access'}
            </button>
          </form>

          {/* Bottom note */}
          {tab === 'signup' && (
            <p className="text-center text-xs text-slate-500">
              After submitting, an admin will review and approve your account.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
