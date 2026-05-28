import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'
import api from '@/services/api'
import { useAuth } from '@/context/AuthContext'

const GOOGLE_ENABLED = !!(import.meta.env.VITE_GOOGLE_CLIENT_ID &&
  import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID')

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [mode,    setMode]    = useState('login')   // 'login' | 'signup'
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [pending, setPending] = useState(false)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [note,     setNote]     = useState('')

  const switchMode = (m) => { setMode(m); setError(''); setShowPw(false) }

  async function handleGoogleSuccess(credentialResponse) {
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/google', { credential: credentialResponse.credential })
      if (data.access_token) {
        login(data.access_token, data.user)
        navigate('/', { replace: true })
      } else {
        setPending(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleError() {
    setError('Google sign-in failed. Please try again or use email/password.')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await api.post('/auth/login', { email, password })
        login(data.access_token, data.user)
        navigate('/', { replace: true })
      } else {
        await api.post('/auth/signup', {
          email,
          password,
          name:        name.trim() || undefined,
          note: note.trim() || undefined,
        })
        setPending(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (pending) {
    return (
      <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-5">
          <PwCLogo />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#EB8C00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[#2D2D2D] text-xl font-semibold">Request submitted</h2>
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                Your account is pending admin approval. You'll be able to sign in once your access has been granted.
              </p>
            </div>
            <button
              onClick={() => { setPending(false); switchMode('login'); setPassword('') }}
              className="text-sm text-[#EB8C00] hover:text-[#D04A02] font-semibold transition-colors"
            >
              Already approved? Sign in →
            </button>
          </div>
          <PwCFooter />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">

        <PwCLogo />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          <div className="h-1 bg-gradient-to-r from-[#EB8C00] to-[#D04A02]" />

          <div className="px-8 py-7 space-y-5">
            <div className="text-center">
              <h1 className="text-[#2D2D2D] text-xl font-bold">
                {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
              </h1>
              <p className="text-gray-400 text-xs mt-1">
                {mode === 'signup' ? 'Request access — your account will be reviewed' : ''}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[#464646] mb-1.5">
                    Full name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Arjun Sharma"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#2D2D2D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EB8C00]/30 focus:border-[#EB8C00] transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#464646] mb-1.5">
                  Email address <span className="text-[#E0301E]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@pwc.com"
                  autoComplete="email"
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#2D2D2D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EB8C00]/30 focus:border-[#EB8C00] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#464646]">
                    Password <span className="text-[#E0301E]">*</span>
                  </label>
                  {mode === 'login' && (
                    <span className="text-xs text-gray-400">Contact admin to reset</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-[#2D2D2D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EB8C00]/30 focus:border-[#EB8C00] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[#464646] mb-1.5">
                    Why do you need access?{' '}
                    <span className="text-gray-400 font-normal">(optional, max 150 chars)</span>
                  </label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value.slice(0, 150))}
                    rows={2}
                    placeholder="e.g. Finance team — need to review vendor invoices for Q3"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#2D2D2D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EB8C00]/30 focus:border-[#EB8C00] transition-colors resize-none"
                  />
                  <p className="text-right text-gray-400 text-xs mt-0.5">{note.length}/150</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-[#E0301E] text-xs bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#EB8C00] hover:bg-[#D04A02] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-semibold transition-colors duration-200 shadow-sm mt-1"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'login' ? 'Sign in' : 'Request access'}
              </button>
            </form>
          </div>

          {/* Only shown when Google Client ID is configured */}
          {GOOGLE_ENABLED && (
            <div className="px-8 pb-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  size="large"
                  width="320"
                  text={mode === 'signup' ? 'signup_with' : 'signin_with'}
                  shape="rectangular"
                />
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 px-8 py-4 text-center bg-gray-50/60">
            {mode === 'login' ? (
              <p className="text-sm text-gray-500">
                New here?{' '}
                <button
                  onClick={() => switchMode('signup')}
                  className="text-[#EB8C00] hover:text-[#D04A02] font-semibold transition-colors"
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-[#EB8C00] hover:text-[#D04A02] font-semibold transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        <PwCFooter />
      </div>
    </div>
  )
}

function PwCLogo() {
  return (
    <div className="text-center space-y-2 py-2">
      <div className="flex items-center justify-center gap-2.5">
        <div className="flex items-center">
          <span className="text-[#2D2D2D] text-3xl font-black tracking-tight leading-none">Pw</span>
          <span className="text-[#EB8C00] text-3xl font-black tracking-tight leading-none">C</span>
        </div>
        <div className="w-px h-7 bg-gray-300" />
        <div className="text-left">
          <p className="text-[#2D2D2D] text-xs font-bold leading-tight">Invoice Approval</p>
          <p className="text-gray-400 text-[10px] leading-tight">Automation System</p>
        </div>
      </div>
    </div>
  )
}

function PwCFooter() {
  return null
}
