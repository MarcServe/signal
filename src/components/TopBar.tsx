import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

export function TopBar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus()
  }, [searchExpanded])

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-4">
      <div className="flex flex-1 items-center justify-center">
        <div className={`flex items-center transition-all duration-200 ${searchExpanded ? 'w-full max-w-xl' : 'w-10'}`}>
          <label htmlFor="topbar-search" className="sr-only">Search</label>
          <button
            type="button"
            onClick={() => setSearchExpanded(true)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)] ${searchExpanded ? 'hidden' : ''}`}
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
          <input
            ref={searchInputRef}
            id="topbar-search"
            type="search"
            placeholder="Search"
            onBlur={() => setSearchExpanded(false)}
            className={`rounded-full border border-[var(--signal-silver-light)] bg-[var(--signal-white)] py-2.5 pr-4 text-sm text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)] transition-all duration-200 ${searchExpanded ? 'w-full pl-4 opacity-100' : 'w-0 pl-0 pr-0 border-0 opacity-0 overflow-hidden'}`}
          />
        </div>
      </div>
      <nav className="flex shrink-0 items-center gap-2">
        {user ? (
          <>
            {profile?.role === 'artist' && (
              <Link to="/dashboard" className="text-sm text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]">
                Dashboard
              </Link>
            )}
            {profile?.role !== 'artist' && profile !== null && (
              <Link to="/become-artist" className="text-sm text-[var(--signal-gold)] hover:opacity-80">
                Become an artist
              </Link>
            )}
            <button type="button" onClick={handleSignOut} className="text-sm text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]">
              Sign in
            </Link>
            <Link to="/signup" className="rounded-full bg-[var(--signal-gold)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
