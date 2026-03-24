import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArtistQuickCreateModal } from './ArtistQuickCreateModal'
import { useAuth } from '../contexts/AuthContext'

/**
 * Minimal rail: Home · Studio · Quick add (artists) or Become an artist (signed-in fans) · Settings.
 * Messages & notifications live under Settings to keep the chrome quiet.
 */
export function Sidebar() {
  const location = useLocation()
  const { user, profile } = useAuth()
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  const studioTo = '/dashboard'
  const studioLabel = profile?.role === 'artist' ? 'Studio' : 'Home'
  const studioActive =
    location.pathname === '/dashboard' ||
    (profile?.role === 'artist' && location.pathname.startsWith('/avatar'))

  const homeActive = location.pathname === '/'
  const becomeArtistActive = location.pathname.startsWith('/become-artist')
  const settingsActive =
    location.pathname.startsWith('/settings') ||
    location.pathname === '/messages' ||
    location.pathname === '/notifications'

  const navClass = (active: boolean) =>
    `flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
      active
        ? 'bg-[var(--signal-ink)] text-white'
        : 'text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/60 hover:text-[var(--signal-ink)]'
    }`

  const createMenuActive = quickCreateOpen

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-40 flex w-14 flex-col items-center border-r border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] py-5">
      <Link to="/" className="mb-8 flex shrink-0 items-center justify-center" aria-label="Signal home">
        <img src="/signal-logo.png" alt="" className="h-7 w-auto object-contain opacity-90" />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-3" aria-label="Main">
        <Link to="/" className={navClass(homeActive)} aria-label="Home" title="Home">
          <HomeIcon className="h-5 w-5" strokeWidth={1.5} />
        </Link>
        <Link to={studioTo} className={navClass(studioActive)} aria-label={studioLabel} title={studioLabel}>
          <StudioIcon className="h-5 w-5" strokeWidth={1.5} />
        </Link>
        {profile?.role === 'artist' ? (
          <>
            <button
              type="button"
              className={navClass(createMenuActive)}
              aria-label="Quick add product, event, or membership"
              title="Quick add"
              aria-haspopup="dialog"
              aria-expanded={quickCreateOpen}
              onClick={() => setQuickCreateOpen(true)}
            >
              <PlusIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <ArtistQuickCreateModal open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
          </>
        ) : user ? (
          <Link
            to="/become-artist"
            className={navClass(becomeArtistActive)}
            aria-label="Become an artist"
            title="Become an artist"
          >
            <PlusIcon className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        ) : null}
        <Link to="/settings" className={navClass(settingsActive)} aria-label="Settings" title="Settings">
          <SettingsIcon className="h-5 w-5" strokeWidth={1.5} />
        </Link>
      </nav>
    </aside>
  )
}

function HomeIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function StudioIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h6.5v6.5H4V5.5zm9.5 0H20v6.5h-6.5V5.5zM4 15h6.5v6.5H4V15zm9.5 0H20v6.5h-6.5V15z" />
    </svg>
  )
}

function PlusIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function SettingsIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
