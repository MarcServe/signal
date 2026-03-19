import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Header() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <header className="sticky top-0 z-50 bg-[var(--signal-white-pure)]/95 backdrop-blur border-b border-[var(--signal-silver-light)]">
      <div className="flex items-center justify-between h-14 px-4 max-w-[1600px] mx-auto">
        <Link to="/" className="flex items-center gap-2" aria-label="Signal home">
          <img
            src="/signal-logo.png"
            alt="Signal"
            className="h-9 w-auto object-contain"
          />
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {profile?.role === 'artist' && (
                <Link
                  to="/dashboard"
                  className="text-sm text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]"
                >
                  Dashboard
                </Link>
              )}
              {profile?.role !== 'artist' && profile !== null && (
                <Link
                  to="/become-artist"
                  className="text-sm text-[var(--signal-gold)] hover:opacity-80"
                >
                  Become an artist
                </Link>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]">
                Sign in
              </Link>
              <Link to="/signup" className="text-sm text-[var(--signal-gold)] hover:opacity-80">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
