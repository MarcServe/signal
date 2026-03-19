import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function SettingsAccount() {
  const { profile, loading } = useAuth()

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <p className="mb-4">
        <Link
          to="/settings"
          className="text-sm text-[var(--signal-ink-muted)] border-b border-[var(--signal-silver-light)] hover:border-[var(--signal-ink)] transition-colors"
        >
          ← Settings
        </Link>
      </p>
      <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Account
      </h1>
      <p className="text-[var(--signal-ink-muted)] mb-6 text-sm leading-relaxed">
        Profile, portrait, and studio tools.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--signal-ink-muted)]">Loading…</p>
      ) : (
        <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] divide-y divide-[var(--signal-silver-light)]">
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">Email</p>
            <p className="text-sm text-[var(--signal-ink)] mt-1">{profile?.email ?? '—'}</p>
          </div>
          <Link
            to="/avatar/create"
            className="flex items-center justify-between px-4 py-3 text-sm text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/35 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal-gold)]/40"
          >
            <span>Portrait &amp; photo</span>
            <span className="text-[var(--signal-ink-muted)]" aria-hidden>›</span>
          </Link>
          {profile?.role === 'artist' && (
            <Link
              to="/dashboard"
              className="flex items-center justify-between px-4 py-3 text-sm text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/35 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal-gold)]/40"
            >
              <span>Artist dashboard</span>
              <span className="text-[var(--signal-ink-muted)]" aria-hidden>›</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
