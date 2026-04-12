import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArtistQuickCreateModal } from '../ArtistQuickCreateModal'
import { useAuth } from '../../contexts/AuthContext'

const linkClass =
  'block rounded-lg px-4 py-3 text-sm font-medium tracking-wide text-white/90 transition-colors duration-[400ms] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] hover:bg-white/10 hover:text-white'

const panelTransition =
  'transition-transform duration-[400ms] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)]'

export function SlideInMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const { user, profile } = useAuth()
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('a,button')?.focus()
  }, [open])

  const studioTo = '/dashboard'
  const studioLabel = profile?.role === 'artist' ? 'Studio' : 'Dashboard'
  const homeActive = location.pathname === '/'
  const studioActive =
    location.pathname === '/dashboard' || (profile?.role === 'artist' && location.pathname.startsWith('/avatar'))
  const becomeArtistActive = location.pathname.startsWith('/become-artist')
  const settingsActive =
    location.pathname.startsWith('/settings') ||
    location.pathname === '/messages' ||
    location.pathname === '/notifications'

  const activeClass = (active: boolean) => (active ? 'bg-white/15 text-white' : '')

  return (
    <>
      <div
        className={`fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] transition-opacity duration-[400ms] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] md:z-[100] ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed right-0 top-0 z-[101] flex h-full w-[min(20rem,88vw)] flex-col border-l border-white/10 bg-[#0a0a0a] shadow-2xl ${panelTransition} md:z-[101] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <img src="/signal-logo.png" alt="" className="h-7 w-auto object-contain opacity-90 invert" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">Signal</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Main">
          <Link to="/" className={`${linkClass} ${activeClass(homeActive)}`} onClick={onClose}>
            Home
          </Link>
          <Link to={studioTo} className={`${linkClass} ${activeClass(studioActive)}`} onClick={onClose}>
            {studioLabel}
          </Link>
          {profile?.role === 'artist' ? (
            <>
              <button
                type="button"
                className={`${linkClass} w-full text-left ${activeClass(quickCreateOpen)}`}
                aria-haspopup="dialog"
                aria-expanded={quickCreateOpen}
                onClick={() => setQuickCreateOpen(true)}
              >
                Quick add
              </button>
              <ArtistQuickCreateModal open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
            </>
          ) : user ? (
            <Link to="/become-artist" className={`${linkClass} ${activeClass(becomeArtistActive)}`} onClick={onClose}>
              Become an artist
            </Link>
          ) : null}
          <Link to="/settings" className={`${linkClass} ${activeClass(settingsActive)}`} onClick={onClose}>
            Settings
          </Link>
        </nav>

        <div className="border-t border-white/10 p-4 text-center text-[10px] uppercase tracking-widest text-white/35">
          Explore
        </div>
      </div>
    </>
  )
}
