import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl, getSession } from '../lib/api'
import { fetchArtistBioFromWeb, polishArtistBioDraft } from '../lib/bioResearch'
import { catalogCardImageUrl } from '../lib/catalogImage'

const MUSIC_INTEGRATION_CARDS = [
  {
    key: 'bandcamp',
    label: 'Bandcamp',
    subtitle: 'Sync releases and merch',
    imageUrl: 'https://cdn.simpleicons.org/bandcamp/629aa0',
  },
  {
    key: 'apple_music',
    label: 'Apple Music',
    subtitle: 'Link catalog presence',
    imageUrl: 'https://cdn.simpleicons.org/applemusic/FA243C',
  },
  {
    key: 'shopify',
    label: 'Shopify',
    subtitle: 'Import product listings',
    imageUrl: 'https://cdn.simpleicons.org/shopify/95BF47',
  },
] as const

/** Memberships: select includes image_url when migration 00008 is applied; fallback keeps tiers working on older DBs. */
async function fetchMembershipRows(
  client: typeof supabase,
  artistId: string
): Promise<{ id: string; title: string; price_cents: number; image_url: string | null }[]> {
  const full = await client.from('memberships').select('id, title, price_cents, image_url').eq('artist_id', artistId)
  if (!full.error && full.data) {
    return full.data as { id: string; title: string; price_cents: number; image_url: string | null }[]
  }
  const basic = await client.from('memberships').select('id, title, price_cents').eq('artist_id', artistId)
  const rows = (basic.data ?? []) as { id: string; title: string; price_cents: number }[]
  return rows.map((r) => ({ ...r, image_url: null }))
}

type CatalogKind = 'product' | 'membership' | 'event'

function catalogImagePayload(
  artistId: string,
  kind: CatalogKind,
  id: string,
  extra?: { creative_prompt?: string; source_image_url?: string }
): Record<string, string> {
  const base: Record<string, string> = { artist_id: artistId }
  if (extra?.creative_prompt?.trim()) base.creative_prompt = extra.creative_prompt.trim().slice(0, 1200)
  if (extra?.source_image_url?.trim()) base.source_image_url = extra.source_image_url.trim()
  if (kind === 'product') base.product_id = id
  else if (kind === 'membership') base.membership_id = id
  else base.event_id = id
  return base
}

export function Dashboard() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const addIntent = searchParams.get('add')
  const profileRetried = useRef(false)
  const [artist, setArtist] = useState<{
    id: string
    display_name: string
    handle: string | null
    bio: string | null
    avatar_url?: string | null
    profile_visible?: boolean
    stripe_account_id?: string | null
    stripe_onboarding_complete?: boolean
  } | null>(null)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [handleDraft, setHandleDraft] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileNotice, setProfileNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [bioDraft, setBioDraft] = useState('')
  const [bioSaving, setBioSaving] = useState(false)
  const [bioResearchLoading, setBioResearchLoading] = useState(false)
  const [bioPolishLoading, setBioPolishLoading] = useState(false)
  const [bioNotice, setBioNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [artistLoaded, setArtistLoaded] = useState(false)
  const [streams, setStreams] = useState<{ id: string; title: string | null; is_live: boolean; camera_auto_rotate?: boolean }[]>([])
  const [products, setProducts] = useState<{ id: string; title: string; image_url: string | null }[]>([])
  const [catalogBusy, setCatalogBusy] = useState<{ kind: CatalogKind; id: string } | null>(null)
  const [catalogImageNotice, setCatalogImageNotice] = useState<string | null>(null)
  const catalogFileRef = useRef<HTMLInputElement>(null)
  const pendingCatalogUpload = useRef<{ kind: CatalogKind; id: string } | null>(null)
  const [catalogPrompts, setCatalogPrompts] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<
    { id: string; title: string; starts_at: string; venue: string | null; image_url: string | null }[]
  >([])
  const [memberships, setMemberships] = useState<
    { id: string; title: string; price_cents: number; image_url: string | null }[]
  >([])
  const [feeFreeToday, setFeeFreeToday] = useState(false)
  const [integrationsModal, setIntegrationsModal] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState<string | null>(null)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [newProductTitle, setNewProductTitle] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('9.99')
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventVenue, setNewEventVenue] = useState('')
  const [newEventStartsAt, setNewEventStartsAt] = useState('')
  const [addTierOpen, setAddTierOpen] = useState(false)
  const [newTierTitle, setNewTierTitle] = useState('')
  const [newTierPrice, setNewTierPrice] = useState('9.99')
  const [eventFormError, setEventFormError] = useState<string | null>(null)
  const [tierFormError, setTierFormError] = useState<string | null>(null)
  const [productFormError, setProductFormError] = useState<string | null>(null)

  const reloadEvents = async (id: string) => {
    const { data } = await supabase
      .from('events')
      .select('id, title, starts_at, venue, image_url')
      .eq('artist_id', id)
      .order('starts_at', { ascending: true })
      .limit(20)
    setEvents((data ?? []) as typeof events)
  }
  const reloadMemberships = async (id: string) => {
    const { data } = await supabase.from('memberships').select('id, title, price_cents, image_url').eq('artist_id', id)
    setMemberships((data ?? []) as typeof memberships)
  }
  const reloadProducts = async (id: string) => {
    const { data } = await supabase.from('products').select('id, title, image_url').eq('artist_id', id).limit(40)
    setProducts((data ?? []) as typeof products)
  }

  const handleStripeConnect = async () => {
    if (!artist?.id) return
    const session = await getSession()
    if (!session) return
    const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await fetch(apiUrl('/stripe-connect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ artist_id: artist.id, return_url: `${appUrl}/dashboard`, refresh_url: `${appUrl}/dashboard` }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.url) window.location.href = data.url
  }

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (profile?.role === 'artist' && profile?.avatar_setup_done !== true) {
      supabase.from('users').select('avatar_setup_done').eq('id', user.id).single().then(({ data: row }) => {
        if (row?.avatar_setup_done === true) {
          refreshProfile()
          return
        }
        navigate('/onboarding', { replace: true })
      })
      return
    }
    if (profile?.role !== 'artist') {
      return
    }
    setArtistLoaded(false)
    supabase
      .from('artists')
      .select('id, display_name, handle, bio, avatar_url, stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        setArtistLoaded(true)
        if (error || !data) {
          setArtist(null)
          return
        }
        let profile_visible: boolean | undefined = true
        const { data: visRow, error: visErr } = await supabase
          .from('artists')
          .select('profile_visible')
          .eq('id', data.id)
          .maybeSingle()
        if (!visErr && visRow && typeof (visRow as { profile_visible?: boolean }).profile_visible === 'boolean') {
          profile_visible = (visRow as { profile_visible: boolean }).profile_visible
        }
        const merged = { ...data, profile_visible }
        setArtist(merged as typeof artist)
        if (data.id) {
          supabase.from('streams').select('id, title, is_live, camera_auto_rotate').eq('artist_id', data.id).order('created_at', { ascending: false }).limit(10).then(({ data: s }) => setStreams((s ?? []) as typeof streams))
          supabase.from('products').select('id, title, image_url').eq('artist_id', data.id).limit(40).then(({ data: p }) => setProducts((p ?? []) as typeof products))
          supabase
            .from('events')
            .select('id, title, starts_at, venue, image_url')
            .eq('artist_id', data.id)
            .order('starts_at', { ascending: true })
            .limit(20)
            .then(({ data: e }) => setEvents((e ?? []) as typeof events))
          void fetchMembershipRows(supabase, data.id).then((m) => setMemberships(m))
        }
      })
    supabase
      .from('platform_settings')
      .select('fee_free_until')
      .limit(1)
      .single()
      .then(({ data: settings }) => {
        if (!settings?.fee_free_until) {
          setFeeFreeToday(false)
          return
        }
        setFeeFreeToday(new Date(settings.fee_free_until) > new Date())
      })
  }, [user, profile?.role, profile?.avatar_setup_done, navigate])

  /** Open the right Studio form when arriving from the sidebar “+” menu (?add=product|event|membership). */
  useEffect(() => {
    if (!addIntent?.trim() || !artist?.id) return
    const v = addIntent.trim().toLowerCase()
    if (v === 'product') setAddProductOpen(true)
    else if (v === 'event') setAddEventOpen(true)
    else if (v === 'membership' || v === 'tier') setAddTierOpen(true)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('add')
        return next
      },
      { replace: true }
    )
  }, [addIntent, artist?.id, setSearchParams])

  useEffect(() => {
    if (!artist) return
    setBioDraft(artist.bio ?? '')
  }, [artist?.id, artist?.bio])

  useEffect(() => {
    if (!artist) return
    setDisplayNameDraft(artist.display_name)
    setHandleDraft((artist.handle ?? '').replace(/^@+/, ''))
  }, [artist?.id, artist?.display_name, artist?.handle])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)]">
        <p className="text-[var(--signal-ink-muted)]" style={{ fontFamily: 'var(--font-body)' }}>Loading…</p>
      </div>
    )
  }

  if (!profile) {
    if (user && !profileRetried.current) {
      profileRetried.current = true
      refreshProfile()
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)]">
          <p className="text-[var(--signal-ink-muted)]" style={{ fontFamily: 'var(--font-body)' }}>Loading…</p>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)] px-4">
        <p className="text-[var(--signal-ink-muted)] text-center text-sm">Couldn’t load your profile. Try signing out and back in.</p>
      </div>
    )
  }

  if (profile.role !== 'artist') {
    return <FanDashboard fullName={profile.full_name} />
  }

  if (!artistLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)]">
        <p className="text-[var(--signal-ink-muted)]" style={{ fontFamily: 'var(--font-body)' }}>Loading…</p>
      </div>
    )
  }

  const displayNameForBio =
    displayNameDraft.trim() || artist?.display_name || profile.full_name?.trim() || 'Artist'
  const artistId = artist?.id
  /** Fallback for catalog cards when product/event/tier has no image yet (same idea as demo artists). */
  const catalogPortrait = profile?.avatar_url ?? artist?.avatar_url ?? null

  return (
    <div className="min-h-screen bg-[var(--signal-white)]">
      <div className="max-w-3xl mx-auto px-[var(--gutter)] py-[var(--space-3xl)]">
        {/* Hero: portrait (set on /avatar/create) + name */}
        <header className="mb-[var(--space-2xl)]">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <Link
              to="/avatar/create"
              className="relative shrink-0 block rounded-2xl overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/30 w-[7.25rem] sm:w-[8.5rem] aspect-[3/4] hover:ring-2 hover:ring-[var(--signal-gold)]/30 transition-shadow"
              title="Add or change portrait"
              aria-label="Portrait — add or change your photo"
            >
              {profile.avatar_url ? (
                <img
                  key={profile.avatar_url}
                  src={profile.avatar_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--signal-ink-muted)] text-xs text-center px-2 leading-snug">
                  Add portrait
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayNameDraft}
                  onChange={(e) => {
                    setDisplayNameDraft(e.target.value)
                    setProfileNotice(null)
                  }}
                  placeholder="Your artist name"
                  className="w-full text-2xl sm:text-3xl font-semibold text-[var(--signal-ink)] tracking-tight bg-transparent border-b border-[var(--signal-silver-light)] pb-1 focus:outline-none focus:border-[var(--signal-gold)] focus:ring-0 placeholder:text-[var(--signal-ink-muted)]/50"
                  style={{ fontFamily: 'var(--font-display)' }}
                  disabled={!artist}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide mb-1">
                  Handle <span className="font-normal normal-case text-[var(--signal-ink-muted)]">(optional, public @name)</span>
                </label>
                <div className="flex items-center gap-1 max-w-md">
                  <span className="text-sm text-[var(--signal-ink-muted)]" aria-hidden>
                    @
                  </span>
                  <input
                    type="text"
                    value={handleDraft}
                    onChange={(e) => {
                      setHandleDraft(e.target.value.replace(/^@+/, ''))
                      setProfileNotice(null)
                    }}
                    placeholder="yourhandle"
                    className="flex-1 text-sm text-[var(--signal-ink)] bg-[var(--signal-white-pure)] border border-[var(--signal-silver-light)] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]/40 disabled:opacity-50"
                    disabled={!artist}
                  />
                </div>
              </div>
              {profileNotice && (
                <p
                  className={`text-sm ${profileNotice.type === 'err' ? 'text-red-600' : 'text-[var(--signal-gold)]'}`}
                  role="status"
                >
                  {profileNotice.text}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!artist || profileSaving || !displayNameDraft.trim()}
                  onClick={async () => {
                    if (!artist?.id || !user?.id) return
                    setProfileSaving(true)
                    setProfileNotice(null)
                    const disp = displayNameDraft.trim()
                    const handleNorm = handleDraft.trim().replace(/^@+/, '') || null
                    const { error: aErr } = await supabase
                      .from('artists')
                      .update({ display_name: disp, handle: handleNorm })
                      .eq('id', artist.id)
                    if (aErr) {
                      setProfileSaving(false)
                      setProfileNotice({ type: 'err', text: aErr.message })
                      return
                    }
                    const { error: uErr } = await supabase.from('users').update({ full_name: disp }).eq('id', user.id)
                    setProfileSaving(false)
                    if (uErr) {
                      setProfileNotice({
                        type: 'err',
                        text: `Artist name saved; account name not updated: ${uErr.message}`,
                      })
                      setArtist((prev) => (prev ? { ...prev, display_name: disp, handle: handleNorm } : null))
                      await refreshProfile()
                      return
                    }
                    setArtist((prev) => (prev ? { ...prev, display_name: disp, handle: handleNorm } : null))
                    await refreshProfile()
                    setProfileNotice({ type: 'ok', text: 'Profile saved.' })
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {profileSaving ? 'Saving…' : 'Save name & handle'}
                </button>
                <p className="text-[var(--signal-ink-muted)] text-sm leading-relaxed">
                  <Link
                    to="/avatar/create"
                    className="text-sm text-[var(--signal-ink-muted)] border-b border-[var(--signal-silver-light)] hover:border-[var(--signal-gold)] hover:text-[var(--signal-ink)] transition-colors"
                  >
                    Portrait
                  </Link>
                  <span className="mx-2">·</span>
                  <span>Same image on discovery cards — refine on the Portrait page</span>
                </p>
              </div>
            </div>
          </div>
          {!artist && (
            <p className="mt-4 text-sm">
              <Link to="/become-artist" className="text-[var(--signal-gold)] hover:opacity-80">Complete your artist profile</Link> to go live and add products.
            </p>
          )}
        </header>

        {artist && artist.profile_visible === false && (
          <div className="mb-[var(--space-xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/25 px-4 py-3 text-sm text-[var(--signal-ink)]" style={{ fontFamily: 'var(--font-body)' }}>
            <span className="font-medium">You’re offline</span>
            <span className="text-[var(--signal-ink-muted)]"> — your public profile and catalogue are hidden from discovery. </span>
            <Link to="/settings/privacy" className="text-[var(--signal-gold)] hover:opacity-80 whitespace-nowrap">
              Go online
            </Link>
          </div>
        )}

        {artistId && (
          <section className="mb-[var(--space-2xl)]">
            <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              About
            </h2>
            <p className="text-xs text-[var(--signal-ink-muted)] mb-3">
              Public profile only. <span className="text-[var(--signal-ink)]">Refine</span> polishes your notes with built-in
              AI (no web lookup). <span className="text-[var(--signal-ink)]">Web</span> pulls a short public bio when
              available.
            </p>
            {bioNotice && (
              <p className={`mb-2 text-sm ${bioNotice.type === 'err' ? 'text-red-600' : 'text-[var(--signal-ink-muted)]'}`} role="status">
                {bioNotice.text}
              </p>
            )}
            <textarea
              value={bioDraft}
              onChange={(e) => {
                setBioDraft(e.target.value)
                setBioNotice(null)
              }}
              placeholder="Rough notes are fine — genres, city, what you play, where you perform…"
              rows={4}
              className="w-full rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-3 py-2.5 text-sm text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]/40 mb-3"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                disabled={bioPolishLoading || bioResearchLoading}
                title="Polish your notes with AI — no web lookup"
                onClick={async () => {
                  setBioNotice(null)
                  setBioPolishLoading(true)
                  const r = await polishArtistBioDraft(bioDraft, displayNameForBio)
                  setBioPolishLoading(false)
                  if (!r.ok) {
                    setBioNotice({ type: 'err', text: r.error })
                    return
                  }
                  setBioDraft(r.text)
                  setBioNotice({ type: 'ok', text: 'Refined. Edit if you like, then save.' })
                }}
                className="px-3 py-2 rounded-xl border border-[var(--signal-silver-light)] text-sm text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/30 disabled:opacity-50"
              >
                {bioPolishLoading ? 'Refining…' : 'Refine'}
              </button>
              <button
                type="button"
                disabled={bioResearchLoading || bioPolishLoading}
                onClick={async () => {
                  setBioNotice(null)
                  const q = displayNameForBio.trim()
                  if (!q) {
                    setBioNotice({ type: 'err', text: 'Set a display name above first.' })
                    return
                  }
                  setBioResearchLoading(true)
                  const r = await fetchArtistBioFromWeb(q)
                  setBioResearchLoading(false)
                  if (!r.ok) {
                    setBioNotice({ type: 'err', text: r.error })
                    return
                  }
                  if (r.summary) {
                    setBioDraft(r.summary)
                    setBioNotice({
                      type: 'ok',
                      text: `From ${r.source === 'perplexity' ? 'web sources' : 'public records'}. Edit, then save.`,
                    })
                  } else {
                    const hint = r.source === 'none' ? r.message : undefined
                    setBioNotice({ type: 'err', text: hint ?? 'Nothing found for that name.' })
                  }
                }}
                className="px-3 py-2 rounded-xl border border-[var(--signal-silver-light)] text-sm text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/30 disabled:opacity-50"
              >
                {bioResearchLoading ? 'Looking up…' : 'From web'}
              </button>
              <button
                type="button"
                disabled={bioSaving}
                onClick={async () => {
                  if (!artistId) return
                  setBioSaving(true)
                  setBioNotice(null)
                  const { error } = await supabase.from('artists').update({ bio: bioDraft.trim() || null }).eq('id', artistId)
                  setBioSaving(false)
                  if (error) {
                    setBioNotice({ type: 'err', text: error.message })
                    return
                  }
                  setArtist((prev) => (prev ? { ...prev, bio: bioDraft.trim() || null } : null))
                  setBioNotice({ type: 'ok', text: 'Saved to your public profile.' })
                }}
                className="px-3 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm hover:opacity-90 disabled:opacity-50"
              >
                {bioSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </section>
        )}

        {feeFreeToday && (
          <div className="mb-[var(--space-xl)] rounded-[var(--radius-card)] bg-[var(--signal-gold)]/10 border border-[var(--signal-gold)]/30 px-4 py-3 text-sm text-[var(--signal-ink)]" style={{ fontFamily: 'var(--font-body)' }}>
            Today is fee-free — you keep 100%.
          </div>
        )}

        {/* Go live: RTMP + stream key */}
        {artistId && (
          <section className="mb-[var(--space-2xl)]">
            <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Go live</h2>
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--signal-ink-muted)] mb-1">RTMP URL</label>
                <code className="block w-full px-3 py-2 rounded bg-[var(--signal-silver-light)]/50 text-sm text-[var(--signal-ink)] break-all">
                  {(import.meta as unknown as { env: { VITE_RTMP_URL?: string } }).env?.VITE_RTMP_URL || 'rtmp://your-server/live'}
                </code>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--signal-ink-muted)] mb-1">Stream key</label>
                <code className="block w-full px-3 py-2 rounded bg-[var(--signal-silver-light)]/50 text-sm text-[var(--signal-ink)]">
                  {artistId}
                </code>
                <p className="mt-1 text-xs text-[var(--signal-ink-muted)]">Use this in OBS or another RTMP client. Your stream will appear at /live/{artistId}</p>
              </div>
              <p className="text-xs text-[var(--signal-silver)] pt-1 border-t border-[var(--signal-silver-light)]">
                Stream from browser (coming soon).
              </p>
            </div>
          </section>
        )}

        {/* Streams: image-first cards + camera auto-rotate */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Streams</h2>
          {streams.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm">
              No streams yet. Go live from your broadcast tool and they’ll appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {streams.map((s) => (
                <div
                  key={s.id}
                  className="group rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[3/4] bg-[var(--signal-silver-light)]/50 flex items-center justify-center">
                    <span className="text-[var(--signal-silver)] text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
                      {(s.title ?? 'S').charAt(0)}
                    </span>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-sm text-[var(--signal-ink)] truncate">{s.title ?? 'Untitled'}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-[var(--signal-ink-muted)]">
                        <input
                          type="checkbox"
                          checked={!!s.camera_auto_rotate}
                          onChange={(e) => supabase.from('streams').update({ camera_auto_rotate: e.target.checked }).eq('id', s.id)}
                          className="rounded"
                        />
                        Auto camera
                      </label>
                      <span className={`text-xs font-medium uppercase tracking-wide ${s.is_live ? 'text-red-600' : 'text-[var(--signal-ink-muted)]'}`}>
                        {s.is_live ? 'Live' : 'Ended'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Fan analytics (placeholder) */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Audience & sales</h2>
          <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-center">
            <p className="text-[var(--signal-ink-muted)] text-sm mb-2">Fan analytics, track sales, and audience data.</p>
            <p className="text-xs text-[var(--signal-silver)]">Connect payouts and sync your catalogue to see revenue and subscriber counts here.</p>
          </div>
        </section>

        {/* Events */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Events</h2>
          {eventFormError && addEventOpen && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {eventFormError}
            </p>
          )}
          {addEventOpen && artistId && (
            <div className="mb-4 p-4 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] space-y-2">
              <input
                type="text"
                placeholder="Event title"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Venue (optional)"
                value={newEventVenue}
                onChange={(e) => setNewEventVenue(e.target.value)}
                className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm"
              />
              <label className="block text-xs text-[var(--signal-ink-muted)]">
                Date & time
                <input
                  type="datetime-local"
                  value={newEventStartsAt}
                  onChange={(e) => setNewEventStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!artistId) return
                    setEventFormError(null)
                    if (!newEventStartsAt.trim()) {
                      setEventFormError('Choose a date and time for the event.')
                      return
                    }
                    const { error } = await supabase.from('events').insert({
                      artist_id: artistId,
                      title: newEventTitle.trim() || 'Untitled event',
                      starts_at: new Date(newEventStartsAt).toISOString(),
                      venue: newEventVenue.trim() || null,
                    })
                    if (error) {
                      setEventFormError(error.message)
                      return
                    }
                    await reloadEvents(artistId)
                    setNewEventTitle('')
                    setNewEventVenue('')
                    setNewEventStartsAt('')
                    setAddEventOpen(false)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--signal-ink)] text-white text-sm hover:opacity-90"
                >
                  Save event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddEventOpen(false)
                    setEventFormError(null)
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!addEventOpen && artistId && (
            <button
              type="button"
              onClick={() => {
                setEventFormError(null)
                setAddEventOpen(true)
              }}
              className="mb-4 text-sm text-[var(--signal-ink-muted)] border-b border-[var(--signal-silver-light)] hover:border-[var(--signal-ink)] transition-colors"
            >
              + Add event
            </button>
          )}
          {events.length === 0 && !addEventOpen ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm">
              No events yet. Use <span className="text-[var(--signal-ink)]">+ Add event</span> above.
            </div>
          ) : events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {events.map((ev) => {
                const evCardImg = catalogCardImageUrl(ev.image_url, catalogPortrait)
                const evCleanSource = ev.image_url?.trim() || catalogPortrait
                return (
                <div
                  key={ev.id}
                  className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] flex flex-col"
                >
                  <div className="relative aspect-video bg-[var(--signal-silver-light)]/40">
                    {evCardImg ? (
                      <img src={evCardImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <span className="text-sm font-medium text-[var(--signal-ink)] text-center">{ev.title}</span>
                      </div>
                    )}
                    {catalogBusy?.kind === 'event' && catalogBusy.id === ev.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-[var(--signal-ink)]">
                        Working…
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-[var(--signal-silver-light)]/80 space-y-2">
                    <p className="text-sm font-medium text-[var(--signal-ink)]">{ev.title}</p>
                    <p className="text-xs text-[var(--signal-ink-muted)]">
                      {new Date(ev.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {ev.venue ? ` · ${ev.venue}` : ''}
                    </p>
                    <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
                      Describe the look you want (optional)
                    </label>
                    <textarea
                      value={catalogPrompts[`event:${ev.id}`] ?? ''}
                      onChange={(e) =>
                        setCatalogPrompts((prev) => ({ ...prev, [`event:${ev.id}`]: e.target.value }))
                      }
                      placeholder="e.g. Warehouse lights, gold typography feel (no text), crowd energy…"
                      rows={2}
                      disabled={catalogBusy !== null}
                      className="w-full rounded-lg border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-2 py-1.5 text-xs text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]/40 disabled:opacity-50"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={catalogBusy !== null}
                        onClick={() => {
                          pendingCatalogUpload.current = { kind: 'event', id: ev.id }
                          catalogFileRef.current?.click()
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/25 disabled:opacity-50"
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        disabled={catalogBusy !== null || !artistId}
                        onClick={async () => {
                          if (!artistId) return
                          setCatalogImageNotice(null)
                          setCatalogBusy({ kind: 'event', id: ev.id })
                          try {
                            const session = await getSession()
                            if (!session) {
                              setCatalogImageNotice('Sign in again.')
                              return
                            }
                            const prompt = catalogPrompts[`event:${ev.id}`]?.trim()
                            const res = await fetch(apiUrl('/product-image-generate'), {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${session.access_token}`,
                              },
                              body: JSON.stringify(
                                catalogImagePayload(artistId, 'event', ev.id, {
                                  creative_prompt: prompt || undefined,
                                })
                              ),
                            })
                            const raw = await res.text()
                            let body: { error?: string } = {}
                            try {
                              if (raw.trim()) body = JSON.parse(raw) as typeof body
                            } catch {
                              /* ignore */
                            }
                            if (!res.ok) {
                              setCatalogImageNotice(body.error || raw.slice(0, 200) || `HTTP ${res.status}`)
                              return
                            }
                            await reloadEvents(artistId)
                            setCatalogImageNotice('Event image generated.')
                          } catch {
                            setCatalogImageNotice('Could not reach the image service. Try again in a moment.')
                          } finally {
                            setCatalogBusy(null)
                          }
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--signal-ink)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {catalogBusy?.kind === 'event' && catalogBusy.id === ev.id ? '…' : 'Generate'}
                      </button>
                      {evCleanSource && (
                        <button
                          type="button"
                          disabled={catalogBusy !== null || !artistId}
                          onClick={async () => {
                            if (!artistId || !evCleanSource) return
                            setCatalogImageNotice(null)
                            setCatalogBusy({ kind: 'event', id: ev.id })
                            try {
                              const session = await getSession()
                              if (!session) {
                                setCatalogImageNotice('Sign in again.')
                                return
                              }
                              const hint = catalogPrompts[`event:${ev.id}`]?.trim()
                              const res = await fetch(apiUrl('/product-image-generate'), {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify(
                                  catalogImagePayload(artistId, 'event', ev.id, {
                                    source_image_url: evCleanSource,
                                    creative_prompt: hint || undefined,
                                  })
                                ),
                              })
                              const raw = await res.text()
                              let body: { error?: string } = {}
                              try {
                                if (raw.trim()) body = JSON.parse(raw) as typeof body
                              } catch {
                                /* ignore */
                              }
                              if (!res.ok) {
                                setCatalogImageNotice(body.error || raw.slice(0, 200) || `HTTP ${res.status}`)
                                return
                              }
                              await reloadEvents(artistId)
                              setCatalogImageNotice('Event image cleaned.')
                            } catch {
                              setCatalogImageNotice('Could not reach the image service. Try again in a moment.')
                            } finally {
                              setCatalogBusy(null)
                            }
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-gold)]/50 text-[var(--signal-gold)] hover:bg-[var(--signal-gold)]/10 disabled:opacity-50"
                        >
                          Clean &amp; standardize
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          ) : null}
        </section>

        {/* Subscription tiers (memberships) */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Subscription tiers</h2>
          {tierFormError && addTierOpen && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {tierFormError}
            </p>
          )}
          {addTierOpen && artistId && (
            <div className="mb-4 p-4 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] space-y-2">
              <input
                type="text"
                placeholder="Tier name (e.g. Inner Circle)"
                value={newTierTitle}
                onChange={(e) => setNewTierTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Monthly price (e.g. 9.99)"
                value={newTierPrice}
                onChange={(e) => setNewTierPrice(e.target.value)}
                className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!artistId) return
                    setTierFormError(null)
                    const cents = Math.round(parseFloat(newTierPrice) * 100)
                    if (Number.isNaN(cents) || cents < 0) {
                      setTierFormError('Enter a valid price.')
                      return
                    }
                    const { error } = await supabase.from('memberships').insert({
                      artist_id: artistId,
                      title: newTierTitle.trim() || 'Membership',
                      price_cents: cents,
                    })
                    if (error) {
                      setTierFormError(error.message)
                      return
                    }
                    await reloadMemberships(artistId)
                    setNewTierTitle('')
                    setNewTierPrice('9.99')
                    setAddTierOpen(false)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--signal-ink)] text-white text-sm hover:opacity-90"
                >
                  Save tier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddTierOpen(false)
                    setTierFormError(null)
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!addTierOpen && artistId && (
            <button
              type="button"
              onClick={() => {
                setTierFormError(null)
                setAddTierOpen(true)
              }}
              className="mb-4 text-sm text-[var(--signal-ink-muted)] border-b border-[var(--signal-silver-light)] hover:border-[var(--signal-ink)] transition-colors"
            >
              + Add subscription tier
            </button>
          )}
          {memberships.length === 0 && !addTierOpen ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm">
              No tiers yet. Use <span className="text-[var(--signal-ink)]">+ Add subscription tier</span> above.
            </div>
          ) : memberships.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {memberships.map((m) => {
                const mCardImg = catalogCardImageUrl(m.image_url, catalogPortrait)
                const mCleanSource = m.image_url?.trim() || catalogPortrait
                return (
                <div
                  key={m.id}
                  className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] flex flex-col"
                >
                  <div className="relative aspect-[3/4] bg-[var(--signal-silver-light)]/40">
                    {mCardImg ? (
                      <img src={mCardImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-sm font-medium text-[var(--signal-ink)]">{m.title}</span>
                        <span className="text-[var(--signal-gold)] text-sm mt-1">${(m.price_cents / 100).toFixed(2)}/mo</span>
                      </div>
                    )}
                    {catalogBusy?.kind === 'membership' && catalogBusy.id === m.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-[var(--signal-ink)]">
                        Working…
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-[var(--signal-silver-light)]/80 space-y-2">
                    <p className="text-sm font-medium text-[var(--signal-ink)] truncate">{m.title}</p>
                    <p className="text-xs text-[var(--signal-gold)]">${(m.price_cents / 100).toFixed(2)}/mo</p>
                    <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
                      Describe the image you want (optional)
                    </label>
                    <textarea
                      value={catalogPrompts[`membership:${m.id}`] ?? ''}
                      onChange={(e) =>
                        setCatalogPrompts((prev) => ({ ...prev, [`membership:${m.id}`]: e.target.value }))
                      }
                      placeholder="e.g. Gold accent, backstage pass vibe, velvet texture…"
                      rows={2}
                      disabled={catalogBusy !== null}
                      className="w-full rounded-lg border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-2 py-1.5 text-xs text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]/40 disabled:opacity-50"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={catalogBusy !== null}
                        onClick={() => {
                          pendingCatalogUpload.current = { kind: 'membership', id: m.id }
                          catalogFileRef.current?.click()
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/25 disabled:opacity-50"
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        disabled={catalogBusy !== null || !artistId}
                        onClick={async () => {
                          if (!artistId) return
                          setCatalogImageNotice(null)
                          setCatalogBusy({ kind: 'membership', id: m.id })
                          try {
                            const session = await getSession()
                            if (!session) {
                              setCatalogImageNotice('Sign in again.')
                              return
                            }
                            const prompt = catalogPrompts[`membership:${m.id}`]?.trim()
                            const res = await fetch(apiUrl('/product-image-generate'), {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${session.access_token}`,
                              },
                              body: JSON.stringify(
                                catalogImagePayload(artistId, 'membership', m.id, {
                                  creative_prompt: prompt || undefined,
                                })
                              ),
                            })
                            const raw = await res.text()
                            let body: { error?: string } = {}
                            try {
                              if (raw.trim()) body = JSON.parse(raw) as typeof body
                            } catch {
                              /* ignore */
                            }
                            if (!res.ok) {
                              setCatalogImageNotice(body.error || raw.slice(0, 200) || `HTTP ${res.status}`)
                              return
                            }
                            await reloadMemberships(artistId)
                            setCatalogImageNotice('Tier image generated.')
                          } catch {
                            setCatalogImageNotice('Could not reach the image service. Try again in a moment.')
                          } finally {
                            setCatalogBusy(null)
                          }
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--signal-ink)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {catalogBusy?.kind === 'membership' && catalogBusy.id === m.id ? '…' : 'Generate'}
                      </button>
                      {mCleanSource && (
                        <button
                          type="button"
                          disabled={catalogBusy !== null || !artistId}
                          onClick={async () => {
                            if (!artistId || !mCleanSource) return
                            setCatalogImageNotice(null)
                            setCatalogBusy({ kind: 'membership', id: m.id })
                            try {
                              const session = await getSession()
                              if (!session) {
                                setCatalogImageNotice('Sign in again.')
                                return
                              }
                              const hint = catalogPrompts[`membership:${m.id}`]?.trim()
                              const res = await fetch(apiUrl('/product-image-generate'), {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify(
                                  catalogImagePayload(artistId, 'membership', m.id, {
                                    source_image_url: mCleanSource,
                                    creative_prompt: hint || undefined,
                                  })
                                ),
                              })
                              const raw = await res.text()
                              let body: { error?: string } = {}
                              try {
                                if (raw.trim()) body = JSON.parse(raw) as typeof body
                              } catch {
                                /* ignore */
                              }
                              if (!res.ok) {
                                setCatalogImageNotice(body.error || raw.slice(0, 200) || `HTTP ${res.status}`)
                                return
                              }
                              await reloadMemberships(artistId)
                              setCatalogImageNotice('Tier image cleaned.')
                            } catch {
                              setCatalogImageNotice('Could not reach the image service. Try again in a moment.')
                            } finally {
                              setCatalogBusy(null)
                            }
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-gold)]/50 text-[var(--signal-gold)] hover:bg-[var(--signal-gold)]/10 disabled:opacity-50"
                        >
                          Clean &amp; standardize
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          ) : null}
        </section>

        {/* Products: visual cards + Add product */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Products</h2>
          <input
            ref={catalogFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              const pending = pendingCatalogUpload.current
              e.target.value = ''
              pendingCatalogUpload.current = null
              if (!file || !artistId || !pending) return
              setCatalogImageNotice(null)
              const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
              const sub =
                pending.kind === 'product'
                  ? `product-covers/${artistId}/${pending.id}`
                  : pending.kind === 'membership'
                    ? `membership-uploads/${artistId}/${pending.id}`
                    : `event-uploads/${artistId}/${pending.id}`
              const path = `${sub}/${crypto.randomUUID()}.${ext}`
              const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
              if (upErr) {
                setCatalogImageNotice(`Upload failed: ${upErr.message}`)
                return
              }
              const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
              const table =
                pending.kind === 'product' ? 'products' : pending.kind === 'membership' ? 'memberships' : 'events'
              const patch =
                table === 'memberships'
                  ? { image_url: urlData.publicUrl }
                  : { image_url: urlData.publicUrl, updated_at: new Date().toISOString() }
              const { error: dbErr } = await supabase.from(table).update(patch).eq('id', pending.id).eq('artist_id', artistId)
              if (dbErr) {
                setCatalogImageNotice(dbErr.message)
                return
              }
              if (pending.kind === 'product') await reloadProducts(artistId)
              else if (pending.kind === 'membership') await reloadMemberships(artistId)
              else await reloadEvents(artistId)
              setCatalogImageNotice('Image saved. Use “Clean & standardize” for a polished catalog look.')
            }}
          />
          {addProductOpen && artistId && (
            <div className="mb-4 p-4 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]">
              {productFormError && (
                <p className="mb-2 text-sm text-red-600" role="alert">
                  {productFormError}
                </p>
              )}
              <input type="text" placeholder="Product title" value={newProductTitle} onChange={(e) => setNewProductTitle(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm mb-2" />
              <input type="text" placeholder="Price (e.g. 9.99)" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm mb-2" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!artistId) return
                    setProductFormError(null)
                    const cents = Math.round(parseFloat(newProductPrice) * 100) || 0
                    const { error } = await supabase
                      .from('products')
                      .insert({ artist_id: artistId, type: 'merch', title: newProductTitle || 'Untitled', price_cents: cents })
                    if (error) {
                      setProductFormError(error.message)
                      return
                    }
                    await reloadProducts(artistId)
                    setNewProductTitle('')
                    setNewProductPrice('9.99')
                    setAddProductOpen(false)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--signal-gold)] text-white text-sm"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddProductOpen(false)
                    setProductFormError(null)
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!addProductOpen && artistId && (
            <button type="button" onClick={() => setAddProductOpen(true)} className="mb-4 text-sm text-[var(--signal-gold)] hover:opacity-80">+ Add product</button>
          )}
          {catalogImageNotice && (
            <p className="mb-3 text-sm text-[var(--signal-ink-muted)]" role="status">
              {catalogImageNotice}
            </p>
          )}
          {products.length === 0 && !addProductOpen ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm">
              No products yet. Add one above or connect Bandcamp/Shopify to sync.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => {
                const pCardImg = catalogCardImageUrl(p.image_url, catalogPortrait)
                const pCleanSource = p.image_url?.trim() || catalogPortrait
                return (
                <div
                  key={p.id}
                  className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] flex flex-col"
                >
                  <div className="relative aspect-[3/4] bg-[var(--signal-silver-light)]/40">
                    {pCardImg ? (
                      <img src={pCardImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <span className="text-[var(--signal-ink-muted)] text-sm text-center line-clamp-3" style={{ fontFamily: 'var(--font-body)' }}>
                          {p.title}
                        </span>
                      </div>
                    )}
                    {catalogBusy?.kind === 'product' && catalogBusy.id === p.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-[var(--signal-ink)]">
                        Working…
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-[var(--signal-silver-light)]/80 space-y-2">
                    <p className="text-sm font-medium text-[var(--signal-ink)] truncate" title={p.title}>
                      {p.title}
                    </p>
                    <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
                      Describe the image you want (optional)
                    </label>
                    <textarea
                      value={catalogPrompts[`product:${p.id}`] ?? ''}
                      onChange={(e) =>
                        setCatalogPrompts((prev) => ({ ...prev, [`product:${p.id}`]: e.target.value }))
                      }
                      placeholder="e.g. Black vinyl on marble, gold foil, moody club lighting…"
                      rows={2}
                      disabled={catalogBusy !== null}
                      className="w-full rounded-lg border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-2 py-1.5 text-xs text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]/40 disabled:opacity-50"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={catalogBusy !== null}
                        onClick={() => {
                          pendingCatalogUpload.current = { kind: 'product', id: p.id }
                          catalogFileRef.current?.click()
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/25 disabled:opacity-50"
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        disabled={catalogBusy !== null || !artistId}
                        onClick={async () => {
                          if (!artistId) return
                          setCatalogImageNotice(null)
                          setCatalogBusy({ kind: 'product', id: p.id })
                          try {
                            const session = await getSession()
                            if (!session) {
                              setCatalogImageNotice('Sign in again to generate.')
                              return
                            }
                            const prompt = catalogPrompts[`product:${p.id}`]?.trim()
                            const res = await fetch(apiUrl('/product-image-generate'), {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${session.access_token}`,
                              },
                              body: JSON.stringify(
                                catalogImagePayload(artistId, 'product', p.id, {
                                  creative_prompt: prompt || undefined,
                                })
                              ),
                            })
                            const raw = await res.text()
                            let body: { error?: string; image_url?: string } = {}
                            try {
                              if (raw.trim()) body = JSON.parse(raw) as typeof body
                            } catch {
                              /* ignore */
                            }
                            if (!res.ok) {
                              setCatalogImageNotice(body.error || raw.slice(0, 200) || `HTTP ${res.status}`)
                              return
                            }
                            await reloadProducts(artistId)
                            setCatalogImageNotice('Image generated from your description.')
                          } catch {
                            setCatalogImageNotice('Could not reach the image service. Try again in a moment.')
                          } finally {
                            setCatalogBusy(null)
                          }
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--signal-ink)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {catalogBusy?.kind === 'product' && catalogBusy.id === p.id ? '…' : 'Generate'}
                      </button>
                      {pCleanSource && (
                        <button
                          type="button"
                          disabled={catalogBusy !== null || !artistId}
                          onClick={async () => {
                            if (!artistId || !pCleanSource) return
                            setCatalogImageNotice(null)
                            setCatalogBusy({ kind: 'product', id: p.id })
                            try {
                              const session = await getSession()
                              if (!session) {
                                setCatalogImageNotice('Sign in again.')
                                return
                              }
                              const hint = catalogPrompts[`product:${p.id}`]?.trim()
                              const res = await fetch(apiUrl('/product-image-generate'), {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify(
                                  catalogImagePayload(artistId, 'product', p.id, {
                                    source_image_url: pCleanSource,
                                    creative_prompt: hint || undefined,
                                  })
                                ),
                              })
                              const raw = await res.text()
                              let body: { error?: string } = {}
                              try {
                                if (raw.trim()) body = JSON.parse(raw) as typeof body
                              } catch {
                                /* ignore */
                              }
                              if (!res.ok) {
                                setCatalogImageNotice(body.error || raw.slice(0, 200) || `HTTP ${res.status}`)
                                return
                              }
                              await reloadProducts(artistId)
                              setCatalogImageNotice('Photo cleaned and standardized.')
                            } catch {
                              setCatalogImageNotice('Could not reach the image service. Try again in a moment.')
                            } finally {
                              setCatalogBusy(null)
                            }
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-gold)]/50 text-[var(--signal-gold)] hover:bg-[var(--signal-gold)]/10 disabled:opacity-50"
                        >
                          Clean &amp; standardize
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Payouts — collapsed by default (above Connect your music) */}
        {artistId && (
          <details className="group/payouts mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
            <summary
              className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span>Payouts</span>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
                <span className="group-open/payouts:hidden">Expand</span>
                <span className="hidden group-open/payouts:inline">Collapse</span>
              </span>
            </summary>
            <div
              className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70"
              style={{
                backgroundImage:
                  "linear-gradient(145deg, rgba(16,16,16,0.02), rgba(212,175,55,0.05)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120'%3E%3Cg fill='none' stroke='%23d4af37' stroke-opacity='0.18' stroke-width='2'%3E%3Cpath d='M0 70 C20 30 40 30 60 70 C80 110 100 110 120 70 C140 30 160 30 180 70 C200 110 220 110 240 70'/%3E%3C/g%3E%3Cg fill='%23999' fill-opacity='0.12'%3E%3Crect x='20' y='32' width='6' height='26'/%3E%3Crect x='34' y='24' width='6' height='38'/%3E%3Crect x='48' y='38' width='6' height='22'/%3E%3Crect x='62' y='18' width='6' height='48'/%3E%3C/g%3E%3C/svg%3E\")",
                backgroundSize: 'cover, 320px 160px',
                backgroundPosition: 'center, right bottom',
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <div className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]/95 backdrop-blur-sm">
                  <div
                    className="h-20 flex items-center justify-center"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, rgba(99,91,255,0.16), rgba(99,91,255,0.04)), radial-gradient(circle at 80% 20%, rgba(99,91,255,0.35), transparent 55%)",
                    }}
                  >
                    <img src="https://cdn.simpleicons.org/stripe/635BFF" alt="" className="w-9 h-9 object-contain opacity-90" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-[var(--signal-ink)]">Card payouts</p>
                    <p className="text-xs text-[var(--signal-ink-muted)] mt-1">Artist payouts and settlement</p>
                    <button
                      type="button"
                      onClick={handleStripeConnect}
                      className="mt-2 text-sm text-[var(--signal-gold)] hover:opacity-80"
                    >
                      {artist?.stripe_onboarding_complete ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </details>
        )}

        {/* Connect your music — collapsed by default */}
        <details className="group/music mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
          <summary
            className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span>Connect your music</span>
            <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
              <span className="group-open/music:hidden">Expand</span>
              <span className="hidden group-open/music:inline">Collapse</span>
            </span>
          </summary>
          <div
            className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70"
            style={{
              backgroundImage:
                "linear-gradient(165deg, rgba(212,175,55,0.08), rgba(255,255,255,0.3)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='140' viewBox='0 0 260 140'%3E%3Cg fill='none' stroke='%23d4af37' stroke-opacity='0.14' stroke-width='2'%3E%3Cpath d='M0 95 Q30 72 60 95 T120 95 T180 95 T240 95'/%3E%3Cpath d='M0 110 Q30 87 60 110 T120 110 T180 110 T240 110'/%3E%3C/g%3E%3Cg fill='%23000' fill-opacity='0.08'%3E%3Ccircle cx='210' cy='40' r='18'/%3E%3Ccircle cx='210' cy='40' r='6' fill='%23fff' fill-opacity='0.22'/%3E%3C/g%3E%3C/svg%3E\")",
              backgroundSize: 'cover, 340px 180px',
              backgroundPosition: 'center, right 14px bottom 8px',
            }}
          >
            <p className="text-sm text-[var(--signal-ink-muted)] mb-3 pt-3">Link your catalogue and sales in one place.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MUSIC_INTEGRATION_CARDS.map((card) => (
                <div
                  key={card.key}
                  className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]/95 backdrop-blur-sm"
                >
                  <div
                    className="h-16 flex items-center justify-center"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, rgba(212,175,55,0.09), rgba(255,255,255,0.2)), repeating-linear-gradient(90deg, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 2px, transparent 2px, transparent 10px)",
                    }}
                  >
                    <img src={card.imageUrl} alt={`${card.label} logo`} className="w-10 h-10 object-contain" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-[var(--signal-ink)]">{card.label}</p>
                    <p className="text-xs text-[var(--signal-ink-muted)] mt-0.5">{card.subtitle}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIntegrationsModal(card.key)
                          if (artistId) {
                            supabase
                              .from('integrations')
                              .upsert(
                                {
                                  artist_id: artistId,
                                  service_name: card.key,
                                  api_key: 'placeholder',
                                  updated_at: new Date().toISOString(),
                                },
                                { onConflict: 'artist_id,service_name' }
                              )
                              .then(() => {})
                          }
                        }}
                        className="text-xs text-[var(--signal-ink)] hover:text-[var(--signal-gold)]"
                      >
                        Connect
                      </button>
                      <button
                        type="button"
                        disabled={syncLoading === card.key}
                        onClick={async () => {
                          if (!artistId) return
                          setSyncLoading(card.key)
                          const session = await getSession()
                          if (!session) {
                            setSyncLoading(null)
                            return
                          }
                          await fetch(apiUrl('/sync'), {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({ artist_id: artistId, service: card.key }),
                          })
                          setSyncLoading(null)
                        }}
                        className="text-xs text-[var(--signal-gold)] hover:opacity-80 disabled:opacity-50"
                      >
                        {syncLoading === card.key ? 'Syncing…' : 'Sync'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {integrationsModal && (
              <div className="mt-4 p-4 rounded-[var(--radius-md)] bg-[var(--signal-silver-light)]/30 text-sm text-[var(--signal-ink-muted)]">
                <p>Connect your store — we’ll pull your catalogue. Add API keys in settings or use Sync after connecting.</p>
                <button type="button" onClick={() => setIntegrationsModal(null)} className="mt-2 text-[var(--signal-gold)] hover:opacity-80">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}

function FanDashboard({ fullName }: { fullName: string | null }) {
  return (
    <div className="min-h-screen bg-[var(--signal-white)]">
      <div className="max-w-2xl mx-auto px-[var(--gutter)] py-[var(--space-3xl)]">
        <header className="mb-[var(--space-2xl)]">
          <h1 className="text-3xl font-semibold text-[var(--signal-ink)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {fullName ? `Hi, ${fullName}` : 'Your home'}
          </h1>
          <p className="mt-2 text-[var(--signal-ink-muted)] text-sm" style={{ fontFamily: 'var(--font-body)' }}>
            Discover live streams and support artists.
          </p>
        </header>

        <div className="space-y-4">
          <Link
            to="/"
            className="block w-full rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] transition-all hover:border-[var(--signal-gold)]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)] focus:ring-offset-2"
          >
            <div className="aspect-[2/1] bg-gradient-to-br from-[var(--signal-gold)]/10 to-[var(--signal-silver-light)]/50 flex items-center justify-center">
              <span className="text-[var(--signal-gold)] text-lg font-medium" style={{ fontFamily: 'var(--font-display)' }}>Discover</span>
            </div>
            <div className="p-4 text-left">
              <p className="text-[var(--signal-ink)] font-medium" style={{ fontFamily: 'var(--font-body)' }}>Discover feed</p>
              <p className="text-sm text-[var(--signal-ink-muted)] mt-0.5">Live DJs, tracks, events — Pinterest-style</p>
            </div>
          </Link>

          <Link
            to="/become-artist"
            className="block w-full rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-gold)]/40 bg-[var(--signal-gold)]/5 transition-all hover:bg-[var(--signal-gold)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)] focus:ring-offset-2"
          >
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[var(--signal-gold)] font-medium" style={{ fontFamily: 'var(--font-body)' }}>Become an artist</p>
                <p className="text-sm text-[var(--signal-ink-muted)] mt-0.5">Go live, sell tracks, grow your audience</p>
              </div>
              <span className="text-[var(--signal-gold)] text-xl" aria-hidden>→</span>
            </div>
          </Link>

          <Link
            to="/settings"
            className="block w-full py-3 px-4 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] text-[var(--signal-ink-muted)] text-sm hover:text-[var(--signal-ink)] hover:border-[var(--signal-silver)]/50 transition-colors text-center"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
