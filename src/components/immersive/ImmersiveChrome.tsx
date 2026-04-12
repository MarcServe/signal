import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useImmersiveNav } from '../../contexts/ImmersiveNavContext'

const iconBtn =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] hover:bg-black/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

/**
 * Minimal floating chrome: menu top-left; sign-in/out + search top-right.
 * Discovery reserves `--immersive-chrome-stack-height` top padding on md+ so cards don’t sit under controls.
 */
export function ImmersiveChrome() {
  const nav = useImmersiveNav()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchOpen, setSearchOpen] = useState(false)
  const [draft, setDraft] = useState(() => searchParams.get('q') ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const qInUrl = searchParams.get('q') ?? ''

  useEffect(() => {
    if (location.pathname === '/') setDraft(qInUrl)
  }, [location.pathname, qInUrl])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const applyQuery = (value: string) => {
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

  const onChange = (value: string) => {
    setDraft(value)
    if (location.pathname !== '/') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => applyQuery(value), 220)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchOpen(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      applyQuery(draft)
      setSearchOpen(false)
    }
  }

  if (!nav) return null

  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className={`pointer-events-auto ${iconBtn}`} aria-label="Open menu" onClick={nav.openMenu}>
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          {user ? (
            <button
              type="button"
              className={`${iconBtn} px-3 text-xs font-medium tracking-wide`}
              onClick={async () => {
                await signOut()
                navigate('/', { replace: true })
              }}
            >
              Out
            </button>
          ) : (
            <button
              type="button"
              className={`${iconBtn} px-3 text-xs font-medium tracking-wide`}
              onClick={() => navigate('/login')}
            >
              In
            </button>
          )}
          <button type="button" className={`pointer-events-auto ${iconBtn}`} aria-label="Search" onClick={() => setSearchOpen(true)}>
            <SearchIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[60] flex flex-col items-center justify-start bg-black/75 px-4 pt-24 backdrop-blur-sm transition-opacity duration-[400ms] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] ${
          searchOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!searchOpen}
      >
        <label htmlFor="immersive-search" className="sr-only">
          Search feed
        </label>
        <div className="relative w-full max-w-lg">
          <input
            ref={inputRef}
            id="immersive-search"
            type="search"
            placeholder="Search…"
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full rounded-full border border-white/20 bg-white/10 py-3 pl-5 pr-12 text-sm text-white placeholder:text-white/45 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          >
            ×
          </button>
        </div>
        <button type="button" className="mt-6 text-sm text-white/55 hover:text-white/80" onClick={() => setSearchOpen(false)}>
          Cancel
        </button>
      </div>
    </>
  )
}
