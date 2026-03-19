import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const iconBtn =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--signal-ink-muted)] transition-colors hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-gold)]/40 focus-visible:ring-offset-2'

function SearchIcon({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function GridIcon({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h6.5v6.5H4V5.5zm9.5 0H20v6.5h-6.5V5.5zM4 15h6.5v6.5H4V15zm9.5 0H20v6.5h-6.5V15z" />
    </svg>
  )
}

function LogOutIcon({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 9l3 3m0 0l-3 3m3-3H9" />
    </svg>
  )
}

function PlusIcon({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function ArrowEnterIcon({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  )
}

export function TopBar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const qInUrl = searchParams.get('q') ?? ''
  const [draft, setDraft] = useState(qInUrl)

  useEffect(() => {
    if (location.pathname === '/') {
      setDraft(qInUrl)
    }
  }, [location.pathname, qInUrl])

  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus()
  }, [searchExpanded])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const applyQueryToFeed = (value: string) => {
    const trimmed = value.trim()
    if (location.pathname === '/') {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (trimmed) next.set('q', trimmed)
          else next.delete('q')
          return next
        },
        { replace: true }
      )
    } else {
      navigate({ pathname: '/', search: trimmed ? `?q=${encodeURIComponent(trimmed)}` : '' })
    }
  }

  const onSearchChange = (value: string) => {
    setDraft(value)
    if (location.pathname !== '/') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => applyQueryToFeed(value), 220)
  }

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.currentTarget.blur()
      setSearchExpanded(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      applyQueryToFeed(draft)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-4">
      <div className="flex flex-1 items-center justify-center">
        <div className={`flex items-center transition-all duration-200 ${searchExpanded ? 'w-full max-w-xl' : 'w-10'}`}>
          <label htmlFor="topbar-search" className="sr-only">
            Search
          </label>
          <button
            type="button"
            onClick={() => setSearchExpanded(true)}
            className={`${iconBtn} ${searchExpanded ? 'hidden' : ''}`}
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
          <input
            ref={searchInputRef}
            id="topbar-search"
            type="search"
            placeholder="Search feed"
            value={draft}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            onBlur={() => {
              window.setTimeout(() => setSearchExpanded(false), 200)
            }}
            className={`rounded-full border border-[var(--signal-silver-light)] bg-[var(--signal-white)] py-2.5 pr-4 text-sm text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]/30 transition-all duration-200 ${searchExpanded ? 'w-full pl-4 opacity-100' : 'w-0 pl-0 pr-0 border-0 opacity-0 overflow-hidden'}`}
          />
        </div>
      </div>
      <nav className="flex shrink-0 items-center gap-1" aria-label="Account">
        {user ? (
          <>
            {profile?.role === 'artist' && (
              <Link to="/dashboard" className={iconBtn} aria-label="Studio" title="Studio">
                <GridIcon className="h-5 w-5" />
              </Link>
            )}
            {profile?.role !== 'artist' && profile !== null && (
              <Link
                to="/become-artist"
                className={`${iconBtn} text-[var(--signal-ink-muted)] hover:text-[var(--signal-gold)]`}
                aria-label="Become an artist"
                title="Become an artist"
              >
                <PlusIcon className="h-5 w-5" />
              </Link>
            )}
            <button type="button" onClick={handleSignOut} className={iconBtn} aria-label="Sign out" title="Sign out">
              <LogOutIcon className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={iconBtn} aria-label="Sign in" title="Sign in">
              <ArrowEnterIcon className="h-5 w-5" />
            </Link>
            <Link
              to="/signup"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--signal-gold)]/50 text-[var(--signal-gold)] transition-colors hover:bg-[var(--signal-gold)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-gold)]/40 focus-visible:ring-offset-2"
              aria-label="Sign up"
              title="Sign up"
            >
              <span className="text-lg font-light leading-none">+</span>
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
