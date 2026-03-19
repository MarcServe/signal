import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/', label: 'Explore', icon: ExploreIcon },
]

export function Sidebar() {
  const location = useLocation()
  const { user, profile } = useAuth()

  const createTo = profile?.role === 'artist' ? '/dashboard' : '/become-artist'
  const createLabel = profile?.role === 'artist' ? 'Dashboard' : 'Become an artist'

  return (
    <aside className="fixed left-0 top-0 z-40 flex w-16 flex-col items-center border-r border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] py-4">
      <Link to="/" className="mb-6 flex items-center justify-center" aria-label="Signal home">
        <img src="/signal-logo.png" alt="" className="h-8 w-auto object-contain" />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <Link
              key={label}
              to={to}
              className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? 'bg-[var(--signal-gold)]/15 text-[var(--signal-gold)]'
                  : 'text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)]'
              }`}
              aria-label={label}
              title={label}
            >
              <Icon className="h-6 w-6" />
            </Link>
          )
        })}
        <Link
          to={createTo}
          className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
            location.pathname === createTo || (createTo === '/dashboard' && location.pathname.startsWith('/dashboard')) || (createTo === '/become-artist' && location.pathname.startsWith('/become-artist'))
              ? 'bg-[var(--signal-gold)]/15 text-[var(--signal-gold)]'
              : 'text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)]'
          }`}
          aria-label={createLabel}
          title={createLabel}
        >
          <CreateIcon className="h-6 w-6" />
        </Link>
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1 border-t border-[var(--signal-silver-light)] pt-4">
        <Link
          to="/notifications"
          className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${location.pathname === '/notifications' ? 'bg-[var(--signal-gold)]/15 text-[var(--signal-gold)]' : 'text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)]'}`}
          aria-label="Notifications"
          title="Notifications"
        >
          <NotificationsIcon className="h-6 w-6" />
        </Link>
        <Link
          to="/messages"
          className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${location.pathname === '/messages' ? 'bg-[var(--signal-gold)]/15 text-[var(--signal-gold)]' : 'text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)]'}`}
          aria-label="Messages"
          title="Messages"
        >
          <MessagesIcon className="h-6 w-6" />
        </Link>
        {user ? (
          <Link
            to="/dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)]"
            aria-label="Profile"
            title="Profile"
          >
            <ProfileIcon className="h-6 w-6" />
          </Link>
        ) : (
          <Link to="/login" className="flex h-12 w-12 items-center justify-center rounded-xl text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50" aria-label="Sign in" title="Sign in">
            <ProfileIcon className="h-6 w-6" />
          </Link>
        )}
        <Link
          to="/settings"
          className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${location.pathname === '/settings' ? 'bg-[var(--signal-gold)]/15 text-[var(--signal-gold)]' : 'text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)]'}`}
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon className="h-6 w-6" />
        </Link>
      </div>
    </aside>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function ExploreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function CreateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function NotificationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
