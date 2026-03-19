import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      const text =
        error.message === 'Failed to fetch'
          ? 'Cannot reach Supabase. Check your .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) and restart the dev server.'
          : error.message
      setMessage({ type: 'error', text })
      return
    }
    setMessage({ type: 'success', text: 'Signed in.' })
    navigate('/', { replace: true })
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) setMessage({ type: 'error', text: error.message })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)] px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-8" aria-label="Signal home">
          <img src="/signal-logo.png" alt="Signal" className="h-[12rem] w-auto object-contain sm:h-[14rem]" />
        </Link>
        <div className="mb-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[var(--signal-silver-light)] bg-white text-[var(--signal-ink)] font-medium hover:bg-[var(--signal-silver-light)]/30"
          >
            <GoogleIcon className="w-5 h-5" />
            Sign in with Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[var(--signal-silver-light)] bg-black text-white font-medium hover:opacity-90"
          >
            <AppleIcon className="w-5 h-5" />
            Sign in with Apple
          </button>
        </div>
        <p className="text-center text-xs text-[var(--signal-ink-muted)] mb-4">or</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[var(--signal-silver-light)] bg-white text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[var(--signal-silver-light)] bg-white text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]"
            required
          />
          {message && (
            <p className={message.type === 'error' ? 'text-red-600' : 'text-[var(--signal-gold)]'}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--signal-gold)] text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--signal-ink-muted)]">
          Don’t have an account? <Link to="/signup" className="text-[var(--signal-gold)]">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}
