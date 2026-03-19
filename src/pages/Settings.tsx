import { Link } from 'react-router-dom'

const rowLinkClass =
  'flex items-center justify-between px-4 py-3.5 text-sm text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/35 active:bg-[var(--signal-silver-light)]/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal-gold)]/40'

export function Settings() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Settings
      </h1>
      <p className="text-[var(--signal-ink-muted)] mb-6 text-sm leading-relaxed">Account and preferences.</p>

      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          to="/messages"
          className="inline-flex items-center rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-4 py-2.5 text-sm font-medium text-[var(--signal-ink)] hover:border-[var(--signal-ink)]/25 hover:bg-[var(--signal-silver-light)]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-gold)]/40"
        >
          Messages
        </Link>
        <Link
          to="/notifications"
          className="inline-flex items-center rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-4 py-2.5 text-sm font-medium text-[var(--signal-ink)] hover:border-[var(--signal-ink)]/25 hover:bg-[var(--signal-silver-light)]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-gold)]/40"
        >
          Notifications
        </Link>
      </div>

      <nav
        className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] overflow-hidden"
        aria-label="Settings sections"
      >
        <ul className="divide-y divide-[var(--signal-silver-light)]">
          <li>
            <Link to="/settings/account" className={rowLinkClass}>
              <span>Account</span>
              <span className="text-[var(--signal-ink-muted)] text-lg leading-none" aria-hidden>
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link to="/notifications" className={rowLinkClass} title="Open notifications">
              <span>Alerts</span>
              <span className="text-[var(--signal-ink-muted)] text-lg leading-none" aria-hidden>
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link to="/settings/privacy" className={rowLinkClass}>
              <span>Privacy</span>
              <span className="text-[var(--signal-ink-muted)] text-lg leading-none" aria-hidden>
                ›
              </span>
            </Link>
          </li>
          <li className="px-4 py-3.5 text-sm text-[var(--signal-ink-muted)]">More soon</li>
        </ul>
      </nav>
      <p className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-4 py-2.5 text-sm font-medium text-[var(--signal-ink)] hover:border-[var(--signal-ink)]/25 hover:bg-[var(--signal-silver-light)]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-gold)]/40"
        >
          Feed
        </Link>
      </p>
    </div>
  )
}
