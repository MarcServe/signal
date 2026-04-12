import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl, getSession } from '../lib/api'
import {
  catalogCardImageUrl,
  catalogImagePayload,
  formatCatalogImageApiFailure,
  type CatalogKind,
} from '../lib/catalogImage'

type Tab = 'product' | 'event' | 'membership'

type PostCreate = { kind: CatalogKind; id: string; label: string }

const doneMessage: Record<CatalogKind, string> = {
  product: 'Product added.',
  event: 'Event added.',
  membership: 'Membership tier added.',
}

function tableForKind(k: CatalogKind): 'products' | 'events' | 'memberships' {
  if (k === 'product') return 'products'
  if (k === 'event') return 'events'
  return 'memberships'
}

/**
 * Centered overlay for artists to add a product, event, or membership without leaving the current page.
 * After save, offers the same upload / AI generate / clean flow as Studio catalog cards.
 */
export function ArtistQuickCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth()
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [artistId, setArtistId] = useState<string | null>(null)
  const [artistLoading, setArtistLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('product')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [postCreate, setPostCreate] = useState<PostCreate | null>(null)
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [imageNotice, setImageNotice] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  // Product
  const [productTitle, setProductTitle] = useState('')
  const [productPrice, setProductPrice] = useState('9.99')
  const [productType, setProductType] = useState<'merch' | 'track' | 'ticket'>('merch')
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
    setPostCreate(null)
    setImagePrompt('')
    setImageNotice(null)
    setCoverUrl(null)
    setImageBusy(false)
    setTab('product')
    setProductType('merch')
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
    if (!postCreate || !artistId) return
    const tbl = tableForKind(postCreate.kind)
    void supabase
      .from(tbl)
      .select('image_url')
      .eq('id', postCreate.id)
      .maybeSingle()
      .then(({ data }) => {
        const url = (data as { image_url?: string } | null)?.image_url?.trim() || null
        setCoverUrl(url)
      })
  }, [postCreate, artistId])

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
    setProductType('merch')
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

  const finishImageStep = () => {
    if (!postCreate) return
    setSuccessMsg(doneMessage[postCreate.kind])
    setPostCreate(null)
    setImagePrompt('')
    setImageNotice(null)
    setCoverUrl(null)
  }

  const portrait = profile?.avatar_url?.trim() || null
  const displayImg = catalogCardImageUrl(coverUrl, portrait)
  const cleanSource = coverUrl?.trim() || portrait

  const runUpload = async (file: File) => {
    if (!artistId || !postCreate) return
    setImageNotice(null)
    setImageBusy(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const sub =
        postCreate.kind === 'product'
          ? `product-covers/${artistId}/${postCreate.id}`
          : postCreate.kind === 'membership'
            ? `membership-uploads/${artistId}/${postCreate.id}`
            : `event-uploads/${artistId}/${postCreate.id}`
      const path = `${sub}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) {
        setImageNotice(`Upload failed: ${upErr.message}`)
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const tbl = tableForKind(postCreate.kind)
      const patch =
        tbl === 'memberships'
          ? { image_url: urlData.publicUrl }
          : { image_url: urlData.publicUrl, updated_at: new Date().toISOString() }
      const { error: dbErr } = await supabase.from(tbl).update(patch).eq('id', postCreate.id).eq('artist_id', artistId)
      if (dbErr) {
        setImageNotice(dbErr.message)
        return
      }
      setCoverUrl(urlData.publicUrl)
      setImageNotice('Image saved. Use “Clean & standardize” for a polished look.')
    } finally {
      setImageBusy(false)
    }
  }

  const runGenerate = async () => {
    if (!artistId || !postCreate) return
    setImageNotice(null)
    setImageBusy(true)
    try {
      const session = await getSession()
      if (!session) {
        setImageNotice('Sign in again.')
        return
      }
      const prompt = imagePrompt.trim()
      const res = await fetch(apiUrl('/product-image-generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          catalogImagePayload(artistId, postCreate.kind, postCreate.id, {
            creative_prompt: prompt || undefined,
          })
        ),
      })
      const raw = await res.text()
      if (!res.ok) {
        setImageNotice(formatCatalogImageApiFailure(res, raw))
        return
      }
      const tbl = tableForKind(postCreate.kind)
      const { data } = await supabase.from(tbl).select('image_url').eq('id', postCreate.id).maybeSingle()
      setCoverUrl((data as { image_url?: string } | null)?.image_url?.trim() || null)
      setImageNotice('Cover image generated.')
    } catch {
      setImageNotice('Could not reach the image service. Is the API running and OPENAI_API_KEY or Gemini configured?')
    } finally {
      setImageBusy(false)
    }
  }

  const runClean = async () => {
    if (!artistId || !postCreate || !cleanSource) return
    setImageNotice(null)
    setImageBusy(true)
    try {
      const session = await getSession()
      if (!session) {
        setImageNotice('Sign in again.')
        return
      }
      const hint = imagePrompt.trim()
      const res = await fetch(apiUrl('/product-image-generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          catalogImagePayload(artistId, postCreate.kind, postCreate.id, {
            source_image_url: cleanSource,
            creative_prompt: hint || undefined,
          })
        ),
      })
      const raw = await res.text()
      if (!res.ok) {
        setImageNotice(formatCatalogImageApiFailure(res, raw))
        return
      }
      const tbl = tableForKind(postCreate.kind)
      const { data } = await supabase.from(tbl).select('image_url').eq('id', postCreate.id).maybeSingle()
      setCoverUrl((data as { image_url?: string } | null)?.image_url?.trim() || null)
      setImageNotice('Image cleaned.')
    } catch {
      setImageNotice('Could not reach the image service.')
    } finally {
      setImageBusy(false)
    }
  }

  const saveProduct = async () => {
    if (!artistId) return
    setFormError(null)
    setSaving(true)
    try {
      const cents = Math.round(parseFloat(productPrice) * 100) || 0
      const label = productTitle.trim() || 'Untitled'
      const { data, error } = await supabase
        .from('products')
        .insert({
          artist_id: artistId,
          type: productType,
          title: label,
          price_cents: cents,
        })
        .select('id')
        .single()
      if (error) {
        setFormError(error.message)
        return
      }
      if (!data?.id) {
        setFormError('Could not read new product id.')
        return
      }
      resetProduct()
      setPostCreate({ kind: 'product', id: data.id, label })
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
      const label = eventTitle.trim() || 'Untitled event'
      const { data, error } = await supabase
        .from('events')
        .insert({
          artist_id: artistId,
          title: label,
          starts_at: new Date(eventStartsAt).toISOString(),
          venue: eventVenue.trim() || null,
        })
        .select('id')
        .single()
      if (error) {
        setFormError(error.message)
        return
      }
      if (!data?.id) {
        setFormError('Could not read new event id.')
        return
      }
      resetEvent()
      setPostCreate({ kind: 'event', id: data.id, label })
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
      const label = tierTitle.trim() || 'Membership'
      const { data, error } = await supabase
        .from('memberships')
        .insert({
          artist_id: artistId,
          title: label,
          price_cents: cents,
        })
        .select('id')
        .single()
      if (error) {
        setFormError(error.message)
        return
      }
      if (!data?.id) {
        setFormError('Could not read new tier id.')
        return
      }
      resetTier()
      setPostCreate({ kind: 'membership', id: data.id, label })
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
      disabled={!!successMsg || saving || !!postCreate}
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
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
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
        className="relative z-[111] w-full max-w-md max-h-[min(92vh,720px)] overflow-hidden flex flex-col rounded-2xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] shadow-xl"
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void runUpload(file)
            }}
          />

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
          ) : postCreate ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--signal-ink)]">
                <span className="font-medium">{postCreate.label}</span> saved. Add a cover for your store and feed (optional).
              </p>
              <div className="relative aspect-[3/4] max-h-[220px] mx-auto w-full max-w-[200px] rounded-xl overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/30">
                {displayImg ? (
                  <img src={displayImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-[var(--signal-ink-muted)]">
                    No cover yet — upload or generate
                  </div>
                )}
                {imageBusy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm text-[var(--signal-ink)]">
                    Working…
                  </div>
                )}
              </div>
              <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
                Creative direction (optional) — LLM expands for Generate / Clean
              </label>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                disabled={imageBusy}
                placeholder="e.g. Gold foil poster, neon club, vinyl on marble…"
                rows={2}
                className="w-full rounded-lg border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-2 py-1.5 text-xs text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]/40 disabled:opacity-50"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={imageBusy}
                  onClick={() => fileRef.current?.click()}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/25 disabled:opacity-50"
                >
                  Upload
                </button>
                <button
                  type="button"
                  disabled={imageBusy || !artistId}
                  onClick={() => void runGenerate()}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--signal-ink)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {imageBusy ? '…' : 'Generate'}
                </button>
                {cleanSource ? (
                  <button
                    type="button"
                    disabled={imageBusy || !artistId}
                    onClick={() => void runClean()}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-gold)]/50 text-[var(--signal-gold)] hover:bg-[var(--signal-gold)]/10 disabled:opacity-50"
                  >
                    Clean &amp; standardize
                  </button>
                ) : null}
              </div>
              {imageNotice && (
                <p className="text-xs text-[var(--signal-ink-muted)]" role="status">
                  {imageNotice}
                </p>
              )}
              <p className="text-[11px] text-[var(--signal-ink-muted)] leading-snug">
                Uses <code className="text-[10px]">/api/product-image-generate</code> with{' '}
                <code className="text-[10px]">npm run dev:all</code> (or <code className="text-[10px]">dev:vercel</code> +{' '}
                <code className="text-[10px]">dev</code>). Set{' '}
                <code className="text-[10px]">OPENAI_API_KEY</code> and/or <code className="text-[10px]">GEMINI_API_KEY</code>{' '}
                in <code className="text-[10px]">.env</code>; an LLM refines your text before the image model runs.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={finishImageStep}
                  className="px-4 py-2 rounded-xl bg-[var(--signal-gold)] text-white text-sm hover:opacity-90"
                >
                  Done
                </button>
              </div>
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
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as 'merch' | 'track' | 'ticket')}
                    disabled={saving}
                    className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2.5 text-sm text-[var(--signal-ink)] bg-[var(--signal-white-pure)]"
                  >
                    <option value="merch">Merch / product</option>
                    <option value="track">Track (live shop)</option>
                    <option value="ticket">Ticket (live shop)</option>
                  </select>
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
                    placeholder="Price in £ (e.g. 9.99)"
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
                    placeholder="Monthly price in £ (e.g. 9.99)"
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
