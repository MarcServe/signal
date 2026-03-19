import { Link } from 'react-router-dom'

export function Settings() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Settings
      </h1>
      <p className="text-[var(--signal-ink-muted)] mb-6">Account and app preferences.</p>
      <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] divide-y divide-[var(--signal-silver-light)]">
        <div className="px-4 py-3 text-[var(--signal-ink)]">Account</div>
        <div className="px-4 py-3 text-[var(--signal-ink)]">Notifications</div>
        <div className="px-4 py-3 text-[var(--signal-ink)]">Privacy</div>
        <div className="px-4 py-3 text-[var(--signal-ink-muted)] text-sm">More options coming soon</div>
      </div>
      <p className="mt-6">
        <Link to="/" className="text-[var(--signal-gold)] hover:opacity-80">Back to feed</Link>
      </p>
    </div>
  )
}
