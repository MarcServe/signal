import { Link } from 'react-router-dom'

export function Notifications() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Notifications
      </h1>
      <p className="text-[var(--signal-ink-muted)] mb-6">You're all caught up. New activity will show here.</p>
      <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)]">
        No notifications yet
      </div>
      <p className="mt-4">
        <Link to="/" className="text-[var(--signal-gold)] hover:opacity-80">Back to feed</Link>
      </p>
    </div>
  )
}
