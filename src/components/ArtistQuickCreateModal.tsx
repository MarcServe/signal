import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Tab = 'product' | 'event' | 'membership'

/**
 * Centered overlay for artists to add a product, event, or membership without leaving the current page.
 */
export function ArtistQuickCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const titleId = useId()
  const [artistId, setArtistId] = useState<string | null>(null)
  const [artistLoading, setArtistLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('product')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Product
  const [productTitle, setProductTitle] = useState('')
  const [productPrice, setProductPrice] = useState('9.99')
  // Event
  const [eventTitle, setEventTitle] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const [eventStartsAt, setEventStartsAt] = useState('')
  // Membership
  const [tierTitle, setTierTitle] = useState('')
  const [tierPrice, setTierPrice] = useState('9.99')

  useEffect(() => {
    if (!open) return
    setSuccessMsg(null)
    setFormError(null)
    setTab('product')
    if (!user?.id) {
      setArtistId(null)
      return
    }
    setArtistLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase.from('artists').select('id').eq('user_id', user.id).maybeSingle()
        if (error || !data?.id) setArtistId(null)
        else setArtistId(data.id)
      } finally {
        setArtistLoading(false)
      }
    })()
  }, [open, user?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const resetProduct = () => {
    setProductTitle('')
    setProductPrice('9.99')
  }
  const resetEvent = () => {
    setEventTitle('')
    setEventVenue('')
    setEventStartsAt('')
  }
  const resetTier = () => {
    setTierTitle('')
    setTierPrice('9.99')
  }

  const saveProduct = async () => {
    if (!artistId) return
    setFormError(null)
    setSaving(true)
    try {
      const cents = Math.round(parseFloat(productPrice) * 100) || 0
      const { error } = await supabase.from('products').insert({
        artist_id: artistId,
        type: 'merch',
        title: productTitle.trim() || 'Untitled',
        price_cents: cents,
      })
      if (error) {
        setFormError(error.message)
        return
      }
      resetProduct()
      setSuccessMsg('Product added.')
    } finally {
      setSaving(false)
    }
  }

  const saveEvent = async () => {
    if (!artistId) return
    setFormError(null)
    if (!eventStartsAt.trim()) {
      setFormError('Choose a date and time for the event.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('events').insert({
        artist_id: artistId,
        title: eventTitle.trim() || 'Untitled event',
        starts_at: new Date(eventStartsAt).toISOString(),
        venue: eventVenue.trim() || null,
      })
      if (error) {
        setFormError(error.message)
        return
      }
      resetEvent()
      setSuccessMsg('Event added.')
    } finally {
      setSaving(false)
    }
  }

  const saveMembership = async () => {
    if (!artistId) return
    setFormError(null)
    const cents = Math.round(parseFloat(tierPrice) * 100)
    if (Number.isNaN(cents) || cents < 0) {
      setFormError('Enter a valid price.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('memberships').insert({
        artist_id: artistId,
        title: tierTitle.trim() || 'Membership',
        price_cents: cents,
      })
      if (error) {
        setFormError(error.message)
        return
      }
      resetTier()
      setSuccessMsg('Membership tier added.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      disabled={!!successMsg || saving}
      onClick={() => {
        setTab(t)
        setFormError(null)
      }}
      className={`flex-1 px-2 py-2 text-xs font-medium uppercase tracking-wide rounded-lg transition-colors ${
        tab === t
          ? 'bg-[var(--signal-ink)] text-white'
          : 'text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50'
      } disabled:opacity-50`}
    >
      {label}
    </button>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[var(--signal-ink)]/35 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[101] w-full max-w-md max-h-[min(90vh,640px)] overflow-hidden flex flex-col rounded-2xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[var(--signal-silver-light)]/80">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-[var(--signal-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              Quick add
            </h2>
            <p className="text-xs text-[var(--signal-ink-muted)] mt-0.5">Add to your studio without leaving this page.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/50 hover:text-[var(--signal-ink)]"
            aria-label="Close dialog"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4 flex gap-1.5" role="tablist" aria-label="What to add">
          {tabBtn('product', 'Product')}
          {tabBtn('event', 'Event')}
          {tabBtn('membership', 'Tier')}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {artistLoading ? (
            <p className="text-sm text-[var(--signal-ink-muted)]">Loading…</p>
          ) : !artistId ? (
            <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/20 p-4 text-sm text-[var(--signal-ink-muted)]">
              <p className="mb-3">We couldn’t find your artist profile.</p>
              <Link
                to="/dashboard"
                className="text-[var(--signal-gold)] font-medium hover:underline"
                onClick={onClose}
              >
                Open Studio
              </Link>
              {' '}to finish setup.
            </div>
          ) : successMsg ? (
            <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white)] p-6 text-center">
              <p className="text-sm text-[var(--signal-ink)] mb-4" role="status">
                {successMsg}
              </p>
              <p className="text-xs text-[var(--signal-ink-muted)] mb-4">
                Manage images and details anytime in Studio.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setSuccessMsg(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm hover:opacity-90"
                >
                  Add another
                </button>
                <Link
                  to="/dashboard"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-[var(--signal-silver-light)] text-sm text-center text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/30"
                >
                  Open Studio
                </Link>
              </div>
            </div>
          ) : (
            <>
              {formError && (
                <p className="mb-3 text-sm text-red-600" role="alert">
                  {formError}
                </p>
              )}

              {tab === 'product' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Product title"
                    value={productTitle}
                    onChange={(e) => setProductTitle(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Price (e.g. 9.99)"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveProduct()}
                      className="px-4 py-2 rounded-xl bg-[var(--signal-gold)] text-white text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save product'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'event' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Event title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Venue (optional)"
                    value={eventVenue}
                    onChange={(e) => setEventVenue(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm"
                  />
                  <label className="block text-xs text-[var(--signal-ink-muted)]">
                    Date &amp; time
                    <input
                      type="datetime-local"
                      value={eventStartsAt}
                      onChange={(e) => setEventStartsAt(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm"
                    />
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveEvent()}
                      className="px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save event'}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'membership' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Tier name (e.g. Inner Circle)"
                    value={tierTitle}
                    onChange={(e) => setTierTitle(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Monthly price (e.g. 9.99)"
                    value={tierPrice}
                    onChange={(e) => setTierPrice(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveMembership()}
                      className="px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save tier'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--signal-silver-light)]/80 bg-[var(--signal-white)]/80">
          <Link
            to="/avatar/create"
            onClick={onClose}
            className="text-xs text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)] underline underline-offset-2"
          >
            Update portrait →
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
