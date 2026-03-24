import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl, getSession } from '../lib/api'
import { fetchArtistBioFromWeb, polishArtistBioDraft } from '../lib/bioResearch'
import {
  catalogCardImageUrl,
  catalogImagePayload,
  formatCatalogImageApiFailure,
  type CatalogKind,
} from '../lib/catalogImage'
import { normalizePublicHandle, stripCitationMarkers } from '../lib/cleanBioText'
import { formatGbp } from '../lib/currency'
import {
  resolveStreamPlaybackUrl,
} from '../lib/hlsPlayback'
import { HlsVideo } from '../components/HlsVideo'
import { FanDiscoverSpotlight } from '../components/FanDiscoverSpotlight'

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

type DashboardStreamRow = {
  id: string
  title: string | null
  is_live: boolean
  camera_auto_rotate?: boolean
  playback_url?: string | null
  stream_key?: string | null
}

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

type ArtistSaleRow = {
  id: string
  type: string
  amount_cents: number
  created_at: string
  products: { id: string; title: string; type: string } | null
  users: { id: string; full_name: string | null; avatar_url: string | null } | null
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
  const [streams, setStreams] = useState<DashboardStreamRow[]>([])
  const [broadcastStreamId, setBroadcastStreamId] = useState<string | null>(null)
  const [creatingBroadcastStream, setCreatingBroadcastStream] = useState(false)
  const [streamKeyDraft, setStreamKeyDraft] = useState('')
  const [togglingSignalLive, setTogglingSignalLive] = useState(false)
  const [goLiveNotice, setGoLiveNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [products, setProducts] = useState<
    { id: string; title: string; image_url: string | null; type: string; price_cents: number; file_url?: string | null }[]
  >([])
  const [catalogBusy, setCatalogBusy] = useState<{ kind: CatalogKind; id: string } | null>(null)
  const [catalogImageNotice, setCatalogImageNotice] = useState<string | null>(null)
  const catalogFileRef = useRef<HTMLInputElement>(null)
  const pendingCatalogUpload = useRef<{ kind: CatalogKind | 'product_file'; id: string } | null>(null)
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
  const [newProductType, setNewProductType] = useState<'merch' | 'track' | 'ticket'>('track')
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
  const [payoutsSectionOpen, setPayoutsSectionOpen] = useState(false)
  const [musicSectionOpen, setMusicSectionOpen] = useState(false)
  const [goLiveSectionOpen, setGoLiveSectionOpen] = useState(false)
  const [backfillBusy, setBackfillBusy] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null)
  const [backfillNotice, setBackfillNotice] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'settings'>('overview')

  const [sales, setSales] = useState<ArtistSaleRow[]>([])
  const [salesLoading, setSalesLoading] = useState(false)

  const refreshStreams = useCallback(async (aid: string) => {
    const { data: s } = await supabase
      .from('streams')
      .select('id, title, is_live, camera_auto_rotate, playback_url, stream_key')
      .eq('artist_id', aid)
      .order('created_at', { ascending: false })
      .limit(10)
    setStreams((s ?? []) as DashboardStreamRow[])
  }, [])

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
    const { data } = await supabase
      .from('products')
      .select('id, title, image_url, type, price_cents, file_url')
      .eq('artist_id', id)
      .limit(40)
    setProducts((data ?? []) as typeof products)
  }

  const reloadSales = async (id: string) => {
    setSalesLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select(`
        id, type, amount_cents, created_at,
        products ( id, title, type ),
        users ( id, full_name, avatar_url )
      `)
      .eq('artist_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    setSales((data ?? []) as unknown as ArtistSaleRow[])
    setSalesLoading(false)
  }

  /**
   * Backfill missing catalog hero images for this artist.
   * Targets rows where `image_url` is null/empty so the UI doesn't fall back to artist portrait.
   */
  const backfillMissingCatalogImages = async (aid: string) => {
    setBackfillNotice(null)
    setBackfillProgress(null)
    setBackfillBusy(true)
    try {
      const session = await getSession()
      if (!session) {
        setBackfillNotice('Sign in again to generate images.')
        return
      }

      // Cap work to keep cost/time bounded. Tune as you like.
      const MAX_TOTAL = 18
      const MAX_PER_KIND = 10

      setBackfillNotice('Scanning catalog for missing images…')

      const [prodRes, memRes, evRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, title, type, image_url')
          .eq('artist_id', aid)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('memberships')
          .select('id, title, image_url')
          .eq('artist_id', aid)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('events')
          .select('id, title, image_url')
          .eq('artist_id', aid)
          .order('starts_at', { ascending: false })
          .limit(60),
      ])

      const products = (prodRes.data ?? []) as { id: string; title: string; type: string; image_url: string | null }[]
      const memberships = (memRes.data ?? []) as { id: string; title: string; image_url: string | null }[]
      const events = (evRes.data ?? []) as { id: string; title: string; image_url: string | null }[]

      const tasks: Array<{ kind: CatalogKind; id: string; title: string; creative_prompt?: string }> = []

      for (const p of products) {
        const hasImg = typeof p.image_url === 'string' && p.image_url.trim().length > 0
        if (!hasImg) {
          const prompt = catalogPrompts[`product:${p.id}`]?.trim()
          tasks.push({
            kind: 'product',
            id: p.id,
            title: p.title,
            creative_prompt: prompt
              ? prompt
              : `Create a ${p.type} catalog hero image for "${p.title}". Luxury minimal. No text/logos/watermarks.`,
          })
        }
        if (tasks.filter((t) => t.kind === 'product').length >= MAX_PER_KIND) break
      }

      for (const m of memberships) {
        const hasImg = typeof m.image_url === 'string' && m.image_url.trim().length > 0
        if (!hasImg) {
          const prompt = catalogPrompts[`membership:${m.id}`]?.trim()
          tasks.push({
            kind: 'membership',
            id: m.id,
            title: m.title,
            creative_prompt: prompt
              ? prompt
              : `Create a membership tier card for "${m.title}". Luxury minimal. No text/logos/watermarks.`,
          })
        }
        if (tasks.filter((t) => t.kind === 'membership').length >= MAX_PER_KIND) break
      }

      for (const e of events) {
        const hasImg = typeof e.image_url === 'string' && e.image_url.trim().length > 0
        if (!hasImg) {
          const prompt = catalogPrompts[`event:${e.id}`]?.trim()
          tasks.push({
            kind: 'event',
            id: e.id,
            title: e.title,
            creative_prompt: prompt
              ? prompt
              : `Create a wide event banner for "${e.title}". Luxury concert flyer mood. No text/logos/watermarks.`,
          })
        }
        if (tasks.filter((t) => t.kind === 'event').length >= MAX_PER_KIND) break
      }

      const sliced = tasks.slice(0, MAX_TOTAL)
      if (sliced.length === 0) {
        setBackfillNotice('Nothing to backfill — all catalog items already have images.')
        return
      }

      setBackfillProgress({ done: 0, total: sliced.length })
      setBackfillNotice(`Generating ${sliced.length} missing images…`)

      let failed = 0
      let lastError = ''
      for (let i = 0; i < sliced.length; i++) {
        const t = sliced[i]
        setBackfillNotice(`Generating ${i + 1}/${sliced.length}: ${t.title}`)

        const res = await fetch(apiUrl('/product-image-generate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(
            catalogImagePayload(aid, t.kind, t.id, {
              creative_prompt: t.creative_prompt,
            })
          ),
        })

        // Keep going even if a single item fails; user still gets progress + best-effort backfill.
        if (!res.ok) {
          const raw = await res.text().catch(() => '')
          const msg = formatCatalogImageApiFailure(res, raw)
          failed += 1
          lastError = msg
          setBackfillNotice(`Some images failed. Last error: ${msg.slice(0, 120)}`)
        }

        setBackfillProgress((p) => (p ? { ...p, done: i + 1 } : { done: i + 1, total: sliced.length }))
      }

      setBackfillNotice('Backfill complete. Reloading images…')
      await Promise.all([reloadProducts(aid), reloadMemberships(aid), reloadEvents(aid)])
      setBackfillNotice(failed === 0 ? 'Backfill complete.' : `Backfill complete with ${failed} failures. ${lastError ? `Last: ${lastError}` : ''}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Backfill failed.'
      setBackfillNotice(msg)
    } finally {
      setBackfillBusy(false)
    }
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
          void refreshStreams(data.id)
          void reloadSales(data.id)
          supabase
            .from('products')
            .select('id, title, image_url, type, price_cents, file_url')
            .eq('artist_id', data.id)
            .limit(40)
            .then(({ data: p }) => setProducts((p ?? []) as typeof products))
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
  }, [user, profile?.role, profile?.avatar_setup_done, navigate, refreshStreams, refreshProfile])

  useEffect(() => {
    if (streams.length === 0) {
      setBroadcastStreamId(null)
      return
    }
    setBroadcastStreamId((prev) => (prev && streams.some((s) => s.id === prev) ? prev : streams[0].id))
  }, [streams])

  useEffect(() => {
    if (!broadcastStreamId) {
      setStreamKeyDraft('')
      return
    }
    const row = streams.find((s) => s.id === broadcastStreamId)
    setStreamKeyDraft(row?.stream_key ?? '')
  }, [broadcastStreamId, streams])

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
    return <FanDashboard />
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
  /** OBS stream key: custom `stream_key` when set, otherwise stream row UUID (matches HLS /live/<key>/). */
  const rtmpSegment = broadcastStreamId ? streamKeyDraft.trim() || broadcastStreamId : ''
  const selectedBroadcastStream = broadcastStreamId ? streams.find((s) => s.id === broadcastStreamId) : undefined

  const trackCatalog = products.filter((p) => p.type === 'track')
  const merchAndTicketsCatalog = products.filter((p) => p.type === 'merch' || p.type === 'ticket')

  type CatalogProductRow = (typeof products)[number] & { file_url?: string | null }
  function renderCatalogProductCard(p: CatalogProductRow) {
    const pCardImg = catalogCardImageUrl(p.image_url, catalogPortrait)
    const pCleanSource = p.image_url?.trim() || catalogPortrait
    return (
      <div
        key={p.id}
        className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] flex flex-col"
      >
        <div className="relative aspect-[3/4] bg-[var(--signal-silver-light)]/40">
          {pCardImg ? (
            <img src={pCardImg} alt="" className="absolute inset-0 h-full w-full object-cover object-center bg-[var(--signal-silver-light)]/30" />
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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--signal-ink)] truncate flex-1 min-w-0" title={p.title}>
              {p.title}
            </p>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--signal-silver-light)]/50 text-[var(--signal-ink-muted)] shrink-0">
              {p.type === 'track' ? 'Track' : p.type === 'ticket' ? 'Ticket' : 'Merch'}
            </span>
          </div>
          <p className="text-xs text-[var(--signal-gold)]">{formatGbp(p.price_cents ?? 0)}</p>
          <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
            Creative direction (optional) — expanded by LLM for Generate / Clean
          </label>
          <textarea
            value={catalogPrompts[`product:${p.id}`] ?? ''}
            onChange={(e) => setCatalogPrompts((prev) => ({ ...prev, [`product:${p.id}`]: e.target.value }))}
            placeholder="e.g. Black vinyl on marble, gold foil, moody club lighting…"
            rows={2}
            disabled={catalogBusy !== null}
            className="w-full rounded-lg border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-2 py-1.5 text-xs text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]/40 disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-2">
            {p.type === 'track' && (
              <button
                type="button"
                onClick={() => {
                  pendingCatalogUpload.current = { kind: 'product_file', id: p.id }
                  catalogFileRef.current?.click()
                }}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${p.file_url ? 'border-[var(--signal-gold)] text-[var(--signal-gold)]' : 'border-[var(--signal-silver-light)] text-[var(--signal-ink)]'} hover:bg-[var(--signal-silver-light)]/25 disabled:opacity-50`}
              >
                {p.file_url ? 'Update Audio' : 'Upload Audio'}
              </button>
            )}
            <button
              type="button"
              disabled={catalogBusy !== null}
              onClick={() => {
                pendingCatalogUpload.current = { kind: 'product', id: p.id }
                catalogFileRef.current?.click()
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/25 disabled:opacity-50"
            >
              Upload Cover
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
                  if (!res.ok) {
                    setCatalogImageNotice(formatCatalogImageApiFailure(res, raw))
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
                    if (!res.ok) {
                      setCatalogImageNotice(formatCatalogImageApiFailure(res, raw))
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
  }

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
                    const handleNorm = normalizePublicHandle(handleDraft)
                    const { error: aErr } = await supabase
                      .from('artists')
                      .update({ display_name: disp, handle: handleNorm })
                      .eq('id', artist.id)
                    if (aErr) {
                      setProfileSaving(false)
                      const msg =
                        aErr.code === '23505'
                          ? 'That @handle is already taken. Try a different one.'
                          : aErr.message
                      setProfileNotice({ type: 'err', text: msg })
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
                      setHandleDraft(handleNorm ?? '')
                      await refreshProfile()
                      return
                    }
                    setArtist((prev) => (prev ? { ...prev, display_name: disp, handle: handleNorm } : null))
                    setHandleDraft(handleNorm ?? '')
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
          <div className="flex gap-6 border-b border-[var(--signal-silver-light)] mb-8 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-[var(--signal-ink)] text-[var(--signal-ink)]'
                  : 'text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)] border-b-2 border-transparent'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'content'
                  ? 'border-b-2 border-[var(--signal-ink)] text-[var(--signal-ink)]'
                  : 'text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)] border-b-2 border-transparent'
              }`}
            >
              Content &amp; Store
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'settings'
                  ? 'border-b-2 border-[var(--signal-ink)] text-[var(--signal-ink)]'
                  : 'text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)] border-b-2 border-transparent'
              }`}
            >
              Settings
            </button>
          </div>
        )}

        {artistId && activeTab === 'settings' && (
          <details className="group/about mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
            <summary
              className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="truncate">About</span>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
                <span className="group-open/about:hidden">Expand</span>
                <span className="hidden group-open/about:inline">Collapse</span>
              </span>
            </summary>
            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
            <p className="text-xs text-[var(--signal-ink-muted)] pt-3 mb-3">
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
                  const cleaned = stripCitationMarkers(bioDraft.trim()) || null
                  const { error } = await supabase.from('artists').update({ bio: cleaned }).eq('id', artistId)
                  setBioSaving(false)
                  if (error) {
                    const hint =
                      error.code === '42501' || /permission|rls|policy/i.test(error.message)
                        ? `${error.message} If this persists, sign out and back in.`
                        : error.message
                    setBioNotice({ type: 'err', text: hint })
                    return
                  }
                  setBioDraft(cleaned ?? '')
                  setArtist((prev) => (prev ? { ...prev, bio: cleaned } : null))
                  setBioNotice({ type: 'ok', text: 'Saved to your public profile.' })
                }}
                className="px-3 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm hover:opacity-90 disabled:opacity-50"
              >
                {bioSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            </div>
          </details>
        )}

        {feeFreeToday && (
          <div className="mb-[var(--space-xl)] rounded-[var(--radius-card)] bg-[var(--signal-gold)]/10 border border-[var(--signal-gold)]/30 px-4 py-3 text-sm text-[var(--signal-ink)]" style={{ fontFamily: 'var(--font-body)' }}>
            Today is fee-free — you keep 100%.
          </div>
        )}

        {/* Go live: RTMP + optional custom OBS key + HLS playback URL — collapsed by default */}
        {artistId && activeTab === 'overview' && (
          <details
            className="group/golive mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]"
            open={goLiveSectionOpen}
            onToggle={(e) => setGoLiveSectionOpen(e.currentTarget.open)}
          >
            <summary
              className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className="h-11 w-14 shrink-0 rounded-lg bg-gradient-to-br from-[var(--signal-ink)]/90 to-[var(--signal-gold)]/25 flex items-center justify-center shadow-inner"
                  aria-hidden
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
                </span>
                <span className="truncate">Go live</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
                <span className="group-open/golive:hidden">Expand</span>
                <span className="hidden group-open/golive:inline">Collapse</span>
              </span>
            </summary>
            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
              <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-5 space-y-6 mt-3">
              {goLiveNotice && (
                <p
                  className={`text-sm ${goLiveNotice.type === 'err' ? 'text-red-600' : 'text-[var(--signal-gold)]'}`}
                  role="status"
                >
                  {goLiveNotice.text}
                </p>
              )}
              {streams.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-[var(--signal-ink-muted)] mb-4">
                    Ready to stream? Create a broadcast to get your OBS connection details.
                  </p>
                  <button
                    type="button"
                    disabled={creatingBroadcastStream}
                    onClick={async () => {
                      setGoLiveNotice(null)
                      setCreatingBroadcastStream(true)
                      const { data: row, error } = await supabase
                        .from('streams')
                        .insert({ artist_id: artistId, title: 'Live broadcast' })
                        .select('id')
                        .single()
                      setCreatingBroadcastStream(false)
                      if (error) {
                        setGoLiveNotice({ type: 'err', text: error.message || 'Could not create stream.' })
                        return
                      }
                      await refreshStreams(artistId)
                      if (row?.id) setBroadcastStreamId(row.id)
                      setGoLiveNotice({ type: 'ok', text: 'Broadcast stream created. Use the stream key below in OBS.' })
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {creatingBroadcastStream ? 'Creating…' : 'Create broadcast'}
                  </button>
                </div>
              ) : (
                <>
                  {/* STEP 1: OBS Settings */}
                  <div>
                    <h3 className="text-sm font-medium text-[var(--signal-ink)] mb-1 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--signal-silver-light)]/50 text-[10px]">1</span>
                      Connect your streaming software (OBS)
                    </h3>
                    <p className="text-xs text-[var(--signal-ink-muted)] mb-4 pl-7">
                      In OBS, go to <strong>Settings &gt; Stream</strong> and set Service to <strong>Custom</strong>.
                    </p>
                    
                    <div className="space-y-3 pl-7">
                      {/* RTMP URL */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--signal-silver-light)]/20 border border-[var(--signal-silver-light)]/50">
                        <div>
                          <p className="text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide mb-0.5">Server URL</p>
                          <code className="text-sm text-[var(--signal-ink)]">
                            {(import.meta as any).env?.VITE_RTMP_URL || 'rtmp://your-server/live'}
                          </code>
                          <p className="text-[10px] text-[var(--signal-silver)] mt-1">Paste into the "Server" field in OBS</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--signal-gold)] hover:opacity-80 px-3 py-1.5 rounded-md bg-[var(--signal-white-pure)] border border-[var(--signal-silver-light)] shadow-sm"
                          onClick={() => {
                            const u = (import.meta as any).env?.VITE_RTMP_URL || 'rtmp://your-server/live'
                            void navigator.clipboard.writeText(u).then(() => setGoLiveNotice({ type: 'ok', text: 'Server URL copied.' }))
                          }}
                        >
                          Copy
                        </button>
                      </div>

                      {/* Stream Key */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--signal-silver-light)]/20 border border-[var(--signal-silver-light)]/50">
                        <div>
                          <p className="text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide mb-0.5">Stream Key</p>
                          <code className="text-sm text-[var(--signal-ink)]">
                            ••••••••••••••••
                          </code>
                          <p className="text-[10px] text-[var(--signal-silver)] mt-1">Paste into the "Stream Key" field in OBS</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--signal-gold)] hover:opacity-80 px-3 py-1.5 rounded-md bg-[var(--signal-white-pure)] border border-[var(--signal-silver-light)] shadow-sm"
                          onClick={() => {
                            if (!rtmpSegment) return
                            void navigator.clipboard.writeText(rtmpSegment).then(() => setGoLiveNotice({ type: 'ok', text: 'Stream key copied. Keep this secret!' }))
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: Go Live */}
                  <div className="pt-4 border-t border-[var(--signal-silver-light)]/50">
                    <h3 className="text-sm font-medium text-[var(--signal-ink)] mb-2 flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--signal-silver-light)]/50 text-[10px]">2</span>
                      Go live on Signal
                    </h3>
                    <div className="pl-7">
                      <p className="text-xs text-[var(--signal-ink-muted)] mb-3">
                        Start streaming in OBS first. Once your video appears in the Streams section below, click here to notify fans and appear on the discovery feed.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            togglingSignalLive ||
                            !broadcastStreamId ||
                            !artistId ||
                            !!selectedBroadcastStream?.is_live
                          }
                          onClick={async () => {
                            if (!broadcastStreamId || !artistId) return
                            setGoLiveNotice(null)
                            setTogglingSignalLive(true)
                            const now = new Date().toISOString()
                            const { error } = await supabase
                              .from('streams')
                              .update({ is_live: true, started_at: now, ended_at: null })
                              .eq('id', broadcastStreamId)
                            setTogglingSignalLive(false)
                            if (error) {
                              setGoLiveNotice({ type: 'err', text: error.message || 'Could not update live status.' })
                              return
                            }
                            await refreshStreams(artistId)
                            setGoLiveNotice({
                              type: 'ok',
                              text: 'You show as live on your profile and in the feed. Share your /live link with fans.',
                            })
                          }}
                          className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-sm"
                        >
                          {togglingSignalLive ? 'Updating…' : 'Show as live on Signal'}
                        </button>
                        <button
                          type="button"
                          disabled={
                            togglingSignalLive ||
                            !broadcastStreamId ||
                            !artistId ||
                            !selectedBroadcastStream?.is_live
                          }
                          onClick={async () => {
                            if (!broadcastStreamId || !artistId) return
                            setGoLiveNotice(null)
                            setTogglingSignalLive(true)
                            const { error } = await supabase
                              .from('streams')
                              .update({ is_live: false, ended_at: new Date().toISOString() })
                              .eq('id', broadcastStreamId)
                            setTogglingSignalLive(false)
                            if (error) {
                              setGoLiveNotice({ type: 'err', text: error.message || 'Could not end live status.' })
                              return
                            }
                            await refreshStreams(artistId)
                            setGoLiveNotice({ type: 'ok', text: 'Live status ended on Signal.' })
                          }}
                          className="px-4 py-2 rounded-xl border border-[var(--signal-silver-light)] text-sm font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/20 disabled:opacity-50"
                        >
                          End stream
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <p className="text-xs text-[var(--signal-silver)] pt-1 border-t border-[var(--signal-silver-light)]">
                Stream from browser (coming soon).
              </p>
              </div>
            </div>
          </details>
        )}

        {artistId && activeTab === 'overview' && (
          <details className="group/streams mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
          <summary
            className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="truncate">Streams</span>
            <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
              <span className="group-open/streams:hidden">Expand</span>
              <span className="hidden group-open/streams:inline">Collapse</span>
            </span>
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
          {streams.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm mt-3">
              No streams yet. Go live from your broadcast tool and they’ll appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 mt-3">
              {streams.map((s) => {
                const playbackSrc = resolveStreamPlaybackUrl({
                  id: s.id,
                  playback_url: s.playback_url ?? null,
                  stream_key: s.stream_key ?? null,
                })
                return (
                <div
                  key={s.id}
                  className="group rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] transition-shadow hover:shadow-md"
                >
                  {/* 16:9 matches typical OBS output; full-width row so preview uses the whole content column (controls stay below, not beside). */}
                  <div className="relative aspect-video w-full bg-black overflow-hidden">
                    {playbackSrc ? (
                      <HlsVideo
                        src={playbackSrc}
                        className="absolute inset-0 h-full w-full object-cover"
                        autoPlay
                        muted
                        playsInline
                        aria-label={`Preview: ${s.title ?? 'stream'}`}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[var(--signal-silver-light)]/50">
                        <span className="text-[var(--signal-silver)] text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
                          {(s.title ?? 'S').charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-sm text-[var(--signal-ink)] truncate">{s.title ?? 'Untitled'}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-[var(--signal-ink-muted)]">
                        <input
                          type="checkbox"
                          checked={!!s.camera_auto_rotate}
                          onChange={async (e) => {
                            const checked = e.target.checked
                            await supabase.from('streams').update({ camera_auto_rotate: checked }).eq('id', s.id)
                            if (artistId) await refreshStreams(artistId)
                          }}
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
                )
              })}
            </div>
          )}
          </div>
        </details>
        )}

        {/* Fan analytics (placeholder) */}
        {artistId && activeTab === 'overview' && (
          <details className="group/audience mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
          <summary
            className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="truncate">Audience &amp; sales</span>
            <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
              <span className="group-open/audience:hidden">Expand</span>
              <span className="hidden group-open/audience:inline">Collapse</span>
            </span>
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
          
          {salesLoading ? (
            <p className="text-sm text-[var(--signal-ink-muted)] mt-3">Loading sales…</p>
          ) : sales.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-center mt-3">
              <p className="text-[var(--signal-ink-muted)] text-sm mb-2">No sales yet.</p>
              <p className="text-xs text-[var(--signal-silver)]">Connect payouts and sync your catalogue to see revenue here.</p>
            </div>
          ) : (
            <ul className="space-y-2 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] divide-y divide-[var(--signal-silver-light)] mt-3">
              {sales.map((sale) => {
                const user = sale.users
                const title = sale.products?.title ?? (sale.type === 'tip' ? 'Tip' : sale.type === 'subscription' ? 'Membership' : 'Purchase')
                const when = new Date(sale.created_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
                return (
                  <li key={sale.id} className="flex gap-3 p-4">
                    <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-[var(--signal-silver-light)]/50 border border-[var(--signal-silver-light)]">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--signal-ink-muted)]">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--signal-ink)] truncate">{title}</p>
                      <p className="text-xs text-[var(--signal-ink-muted)] mt-0.5">
                        {when} · {formatGbp(sale.amount_cents)}
                        {sale.type !== 'purchase' ? ` · ${sale.type}` : ''}
                      </p>
                      {user && (
                        <p className="text-xs text-[var(--signal-ink)] mt-1 inline-block">
                          Bought by: {user.full_name || 'Anonymous Fan'}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          </div>
        </details>
        )}

        {/* Events */}
        {artistId && activeTab === 'content' && (
          <details className="group/events mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
          <summary
            className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="truncate">Events</span>
            <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
              <span className="group-open/events:hidden">Expand</span>
              <span className="hidden group-open/events:inline">Collapse</span>
            </span>
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)] [&>*:first-child]:mt-3">
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
                      <img src={evCardImg} alt="" className="absolute inset-0 h-full w-full object-cover object-center bg-[var(--signal-silver-light)]/30" />
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
                      Creative direction (optional) — expanded by LLM for Generate / Clean
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
                            if (!res.ok) {
                              setCatalogImageNotice(formatCatalogImageApiFailure(res, raw))
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
                              if (!res.ok) {
                                setCatalogImageNotice(formatCatalogImageApiFailure(res, raw))
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
          </div>
        </details>
        )}

        {/* Subscription tiers (memberships) */}
        {artistId && activeTab === 'content' && (
          <details className="group/tiers mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
          <summary
            className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="truncate">Subscription tiers</span>
            <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
              <span className="group-open/tiers:hidden">Expand</span>
              <span className="hidden group-open/tiers:inline">Collapse</span>
            </span>
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)] [&>*:first-child]:mt-3">
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
                placeholder="Monthly price in £ (e.g. 9.99)"
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
                      <img src={mCardImg} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-sm font-medium text-[var(--signal-ink)]">{m.title}</span>
                        <span className="text-[var(--signal-gold)] text-sm mt-1">{formatGbp(m.price_cents)}/mo</span>
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
                    <p className="text-xs text-[var(--signal-gold)]">{formatGbp(m.price_cents)}/mo</p>
                    <label className="block text-[10px] font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
                      Creative direction (optional) — expanded by LLM for Generate / Clean
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
                            if (!res.ok) {
                              setCatalogImageNotice(formatCatalogImageApiFailure(res, raw))
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
                              if (!res.ok) {
                                setCatalogImageNotice(formatCatalogImageApiFailure(res, raw))
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
          </div>
        </details>
        )}

        {/* Catalog: tracks (live DJ shop) + merch & tickets */}
        {artistId && activeTab === 'content' && (
          <details className="group/catalog mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]">
          <summary
            className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="truncate">Catalog</span>
            <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
              <span className="group-open/catalog:hidden">Expand</span>
              <span className="hidden group-open/catalog:inline">Collapse</span>
            </span>
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mt-3">
            <div>
              <p className="text-xs text-[var(--signal-ink-muted)] max-w-xl" style={{ fontFamily: 'var(--font-body)' }}>
                <strong className="text-[var(--signal-ink)]">Tracks</strong> are what fans buy from{' '}
                <strong className="text-[var(--signal-ink)]">More → Track</strong> while you&apos;re live. Add merch and event tickets
                for your shop too.
              </p>
            </div>
            <button
              type="button"
              disabled={!artistId || backfillBusy}
              onClick={() => {
                if (!artistId) return
                void backfillMissingCatalogImages(artistId)
              }}
              className="shrink-0 px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {backfillBusy ? 'Backfilling…' : 'Backfill missing covers'}
            </button>
          </div>
          <p className="text-xs text-[var(--signal-ink-muted)] -mt-2 mb-4" style={{ fontFamily: 'var(--font-body)' }}>
            AI-generated art for tracks, merch, tiers, and events (best-effort). Limited to reduce cost.
          </p>
          {import.meta.env.DEV && (
            <p className="text-xs text-amber-900/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-4" style={{ fontFamily: 'var(--font-body)' }}>
              <strong className="font-medium">Local dev:</strong> image generation calls <code className="text-[10px] px-1 rounded bg-amber-500/15">/api/product-image-generate</code> on port{' '}
              <strong>3000</strong>. Run <code className="text-[10px] px-1 rounded bg-amber-500/15">npm run dev:all</code> or{' '}
              <code className="text-[10px] px-1 rounded bg-amber-500/15">npm run dev:vercel</code> in a second terminal, and complete{' '}
              <code className="text-[10px] px-1 rounded bg-amber-500/15">npm run vercel:link</code> the first time. Ensure{' '}
              <code className="text-[10px] px-1 rounded bg-amber-500/15">OPENAI_API_KEY</code> or <code className="text-[10px] px-1 rounded bg-amber-500/15">GEMINI_API_KEY</code> is in{' '}
              <code className="text-[10px] px-1 rounded bg-amber-500/15">.env</code>.
            </p>
          )}
          {backfillProgress && (
            <p className="text-xs text-[var(--signal-ink-muted)] mb-3" style={{ fontFamily: 'var(--font-body)' }}>
              {backfillProgress.done}/{backfillProgress.total} done
            </p>
          )}
          {backfillNotice && (
            <p className="text-sm text-[var(--signal-ink-muted)] mb-3" style={{ fontFamily: 'var(--font-body)' }}>
              {backfillNotice}
            </p>
          )}
          <input
            ref={catalogFileRef}
            type="file"
            accept={pendingCatalogUpload.current?.kind === 'product_file' ? 'audio/*' : 'image/*'}
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              const pending = pendingCatalogUpload.current
              e.target.value = ''
              pendingCatalogUpload.current = null
              if (!file || !artistId || !pending) return
              setCatalogImageNotice(null)
              
              if (pending.kind === 'product_file') {
                const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3'
                const path = `${artistId}/${pending.id}/${crypto.randomUUID()}.${ext}`
                setCatalogImageNotice('Uploading audio file...')
                const { error: upErr } = await supabase.storage.from('product_files').upload(path, file, { upsert: true })
                if (upErr) {
                  setCatalogImageNotice(`Audio upload failed: ${upErr.message}`)
                  return
                }
                const { error: dbErr } = await supabase.from('products').update({ file_url: path, updated_at: new Date().toISOString() }).eq('id', pending.id).eq('artist_id', artistId)
                if (dbErr) {
                  setCatalogImageNotice(`Database error: ${dbErr.message}`)
                  return
                }
                await reloadProducts(artistId)
                setCatalogImageNotice('Audio file saved successfully.')
                return
              }

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
              <label className="block text-xs font-medium text-[var(--signal-ink-muted)] mb-1">Type</label>
              <select
                value={newProductType}
                onChange={(e) => setNewProductType(e.target.value as 'merch' | 'track' | 'ticket')}
                className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm mb-2 text-[var(--signal-ink)] bg-[var(--signal-white-pure)]"
              >
                <option value="track">Track — sold during live (More → Track)</option>
                <option value="merch">Merch / product</option>
                <option value="ticket">Ticket / show (More → Ticket)</option>
              </select>
              <input
                type="text"
                placeholder={
                  newProductType === 'track'
                    ? 'Track title (e.g. Midnight Drive — Club Edit)'
                    : newProductType === 'ticket'
                      ? 'Ticket name (e.g. Warehouse NYE)'
                      : 'Product title'
                }
                value={newProductTitle}
                onChange={(e) => setNewProductTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm mb-2"
              />
              <input type="text" placeholder="Price in £ (e.g. 9.99)" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm mb-2" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!artistId) return
                    setProductFormError(null)
                    const cents = Math.round(parseFloat(newProductPrice) * 100) || 0
                    const { error } = await supabase
                      .from('products')
                      .insert({
                        artist_id: artistId,
                        type: newProductType,
                        title: newProductTitle || 'Untitled',
                        price_cents: cents,
                      })
                    if (error) {
                      setProductFormError(error.message)
                      return
                    }
                    await reloadProducts(artistId)
                    setNewProductTitle('')
                    setNewProductPrice('9.99')
                    setNewProductType('track')
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
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewProductType('track')
                  setProductFormError(null)
                  setAddProductOpen(true)
                }}
                className="px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium hover:opacity-90"
              >
                + Add track
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewProductType('merch')
                  setProductFormError(null)
                  setAddProductOpen(true)
                }}
                className="px-4 py-2 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm font-medium hover:bg-[var(--signal-silver-light)]/20"
              >
                + Add merch
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewProductType('ticket')
                  setProductFormError(null)
                  setAddProductOpen(true)
                }}
                className="px-4 py-2 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm font-medium hover:bg-[var(--signal-silver-light)]/20"
              >
                + Add ticket
              </button>
            </div>
          )}
          {catalogImageNotice && (
            <p className="mb-3 text-sm text-[var(--signal-ink-muted)]" role="status">
              {catalogImageNotice}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-full">
              <h3 className="text-base font-medium text-[var(--signal-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
                Tracks
              </h3>
              <p className="text-xs text-[var(--signal-ink-muted)] mt-1 mb-3">
                Your releases, edits, and singles — fans tap <strong className="text-[var(--signal-ink)]">More → Track</strong> on your
                live page to buy.
              </p>
            </div>
            {trackCatalog.length === 0 && !addProductOpen && artistId ? (
              <div className="col-span-full rounded-[var(--radius-card)] border border-dashed border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-center text-sm text-[var(--signal-ink-muted)] mb-2">
                No tracks yet. Use <strong className="text-[var(--signal-ink)]">+ Add track</strong> to list music for sale during streams.
              </div>
            ) : null}
            {trackCatalog.map((p) => renderCatalogProductCard(p))}

            <div className="col-span-full mt-8">
              <h3 className="text-base font-medium text-[var(--signal-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
                Merch &amp; tickets
              </h3>
              <p className="text-xs text-[var(--signal-ink-muted)] mt-1 mb-3">
                Tickets show under <strong className="text-[var(--signal-ink)]">More → Ticket</strong> when you&apos;re live. Merch fills
                out your shop and feed when synced.
              </p>
            </div>
            {merchAndTicketsCatalog.length === 0 && !addProductOpen && artistId ? (
              <div className="col-span-full rounded-[var(--radius-card)] border border-dashed border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-center text-sm text-[var(--signal-ink-muted)]">
                No merch or tickets yet. Use <strong className="text-[var(--signal-ink)]">+ Add merch</strong> or{' '}
                <strong className="text-[var(--signal-ink)]">+ Add ticket</strong>.
              </div>
            ) : null}
            {merchAndTicketsCatalog.map((p) => renderCatalogProductCard(p))}
          </div>
          </div>
        </details>
        )}

        {/* Payouts — collapsed by default */}
        {artistId && activeTab === 'settings' && (
          <details
            className="group/payouts mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]"
            open={payoutsSectionOpen}
            onToggle={(e) => setPayoutsSectionOpen(e.currentTarget.open)}
          >
            <summary
              className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className="h-11 w-14 shrink-0 rounded-lg bg-[var(--signal-silver-light)]/35 flex items-center justify-center border border-[var(--signal-silver-light)]/60"
                  aria-hidden
                >
                  <img src="https://cdn.simpleicons.org/stripe/635BFF" alt="" className="w-7 h-7 object-contain opacity-90" loading="lazy" />
                </span>
                <span className="truncate">Payouts</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
                <span className="group-open/payouts:hidden">Expand</span>
                <span className="hidden group-open/payouts:inline">Collapse</span>
              </span>
            </summary>
            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <div className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]">
                  <div className="h-20 flex items-center justify-center bg-[var(--signal-silver-light)]/25">
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

        {artistId && activeTab === 'settings' && (
        <details
          className="group/music mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]"
          open={musicSectionOpen}
          onToggle={(e) => setMusicSectionOpen(e.currentTarget.open)}
        >
          <summary
            className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span
                className="h-11 w-14 shrink-0 rounded-lg bg-[var(--signal-silver-light)]/35 flex items-center justify-center border border-[var(--signal-silver-light)]/60 overflow-hidden"
                aria-hidden
              >
                <img src="https://cdn.simpleicons.org/spotify/1DB954" alt="" className="w-8 h-8 object-contain" loading="lazy" />
              </span>
              <span className="truncate">Connect your music</span>
            </span>
            <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
              <span className="group-open/music:hidden">Expand</span>
              <span className="hidden group-open/music:inline">Collapse</span>
            </span>
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
            <p className="text-sm text-[var(--signal-ink-muted)] mb-3 pt-3">Link your catalogue and sales in one place.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MUSIC_INTEGRATION_CARDS.map((card) => (
                <div
                  key={card.key}
                  className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]"
                >
                  <div className="h-16 flex items-center justify-center bg-[var(--signal-silver-light)]/25">
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
        )}
      </div>
    </div>
  )
}

type FanTxRow = {
  id: string
  type: string
  amount_cents: number
  created_at: string
  products: { id: string; title: string; image_url: string | null; type: string; file_url: string | null } | null
  artists: { id: string; display_name: string; avatar_url: string | null } | null
}

type FanSubRow = {
  id: string
  status: string
  created_at: string
  artists: { id: string; display_name: string; avatar_url: string | null } | null
  memberships: { title: string; price_cents: number } | null
}

function transactionLabel(type: string, productTitle: string | null) {
  if (productTitle) return productTitle
  switch (type) {
    case 'tip':
      return 'Tip'
    case 'ticket':
      return 'Ticket / event'
    case 'subscription':
      return 'Membership'
    case 'purchase':
    default:
      return 'Purchase'
  }
}

function FanDashboard() {
  const { user, profile } = useAuth()
  const fullName = profile?.full_name ?? null
  const [txLoading, setTxLoading] = useState(true)
  const [subLoading, setSubLoading] = useState(true)
  const [transactions, setTransactions] = useState<FanTxRow[]>([])
  const [subscriptions, setSubscriptions] = useState<FanSubRow[]>([])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setTxLoading(true)
    void supabase
      .from('transactions')
      .select(
        `id, type, amount_cents, created_at,
        products ( id, title, image_url, type, file_url ),
        artists ( id, display_name, avatar_url )`
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        setTxLoading(false)
        if (error || !data) {
          setTransactions([])
          return
        }
        setTransactions(data as unknown as FanTxRow[])
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setSubLoading(true)
    void supabase
      .from('subscriptions')
      .select(
        `id, status, created_at,
        artists ( id, display_name, avatar_url ),
        memberships ( title, price_cents )`
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        setSubLoading(false)
        if (error || !data) {
          setSubscriptions([])
          return
        }
        setSubscriptions(data as unknown as FanSubRow[])
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <div className="min-h-screen bg-[var(--signal-white)]">
      <div className="max-w-2xl mx-auto px-[var(--gutter)] py-[var(--space-3xl)]">
        <header className="mb-[var(--space-2xl)] flex flex-col sm:flex-row sm:items-end gap-6">
          <Link
            to="/settings/account#profile-photo"
            className="relative shrink-0 block rounded-full overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/30 h-20 w-20 hover:ring-2 hover:ring-[var(--signal-gold)]/30 transition-shadow"
            title="Change profile photo"
            aria-label="Profile photo — change in account settings"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--signal-ink-muted)] text-center px-1 leading-snug">
                Add photo
              </div>
            )}
          </Link>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold text-[var(--signal-ink)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {fullName ? `Hi, ${fullName}` : 'Your home'}
            </h1>
            <p className="mt-2 text-[var(--signal-ink-muted)] text-sm" style={{ fontFamily: 'var(--font-body)' }}>
              Purchases, memberships, and tips in one place. Browse the feed to find artists.
            </p>
          </div>
        </header>

        <div className="space-y-8">
          <details
            open
            className="group/fanspotlight rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]"
          >
            <summary
              className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-semibold text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="truncate">Discover spotlight</span>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
                <span className="group-open/fanspotlight:hidden">Expand</span>
                <span className="hidden group-open/fanspotlight:inline">Collapse</span>
              </span>
            </summary>
            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
              <div className="pt-3">
                <FanDiscoverSpotlight />
              </div>
            </div>
          </details>

          <details
            className="group/fanlibrary rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]"
            aria-labelledby="fan-library-heading"
          >
            <summary
              id="fan-library-heading"
              className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-semibold text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="truncate">Your library</span>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
                <span className="group-open/fanlibrary:hidden">Expand</span>
                <span className="hidden group-open/fanlibrary:inline">Collapse</span>
              </span>
            </summary>
            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
            <p className="text-sm text-[var(--signal-ink-muted)] pt-3 mb-4">
              Items from checkout and tips (mock or live Stripe) show here once recorded.
            </p>
            {txLoading ? (
              <p className="text-sm text-[var(--signal-ink-muted)]">Loading purchases…</p>
            ) : transactions.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-center">
                <p className="text-sm text-[var(--signal-ink-muted)]">No purchases or tips yet.</p>
                <Link to="/" className="inline-block mt-3 text-sm text-[var(--signal-gold)] hover:opacity-80">
                  Open discover feed →
                </Link>
              </div>
            ) : (
              <ul className="space-y-2 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] divide-y divide-[var(--signal-silver-light)]">
                {transactions.map((tx) => {
                  const artist = tx.artists
                  const title = transactionLabel(tx.type, tx.products?.title ?? null)
                  const when = new Date(tx.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                  return (
                    <li key={tx.id} className="flex gap-3 p-4">
                      <div className="h-14 w-11 shrink-0 rounded-lg overflow-hidden bg-[var(--signal-silver-light)]/50 border border-[var(--signal-silver-light)]">
                        {tx.products?.image_url ? (
                          <img src={tx.products.image_url} alt="" className="h-full w-full object-cover" />
                        ) : artist?.avatar_url ? (
                          <img src={artist.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--signal-ink-muted)]">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--signal-ink)] truncate">{title}</p>
                        <p className="text-xs text-[var(--signal-ink-muted)] mt-0.5">
                          {when} · {formatGbp(tx.amount_cents)}
                          {tx.type !== 'purchase' ? ` · ${tx.type}` : ''}
                        </p>
                        {artist && (
                          <Link
                            to={`/artist/${artist.id}`}
                            className="text-xs text-[var(--signal-gold)] hover:opacity-80 mt-1 inline-block"
                          >
                            {artist.display_name}
                          </Link>
                        )}
                        {tx.products?.file_url && (
                          <div className="mt-2">
                            <button
                              onClick={async () => {
                                const { data, error } = await supabase.storage
                                  .from('product_files')
                                  .createSignedUrl(tx.products!.file_url!, 60)
                                if (error || !data) {
                                  alert('Could not generate download link. Ensure you are signed in.')
                                  return
                                }
                                window.open(data.signedUrl, '_blank')
                              }}
                              className="text-xs px-3 py-1.5 rounded-md bg-[var(--signal-ink)] text-white hover:opacity-90 font-medium"
                            >
                              Download Audio
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            </div>
          </details>

          <details
            className="group/fanmemberships rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] overflow-hidden bg-[var(--signal-white-pure)]"
            aria-labelledby="fan-memberships-heading"
          >
            <summary
              id="fan-memberships-heading"
              className="cursor-pointer select-none list-none px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3 text-lg font-semibold text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="truncate">Memberships</span>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-normal text-[var(--signal-ink-muted)]">
                <span className="group-open/fanmemberships:hidden">Expand</span>
                <span className="hidden group-open/fanmemberships:inline">Collapse</span>
              </span>
            </summary>
            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-[var(--signal-silver-light)]/70 bg-[var(--signal-white-pure)]">
            {subLoading ? (
              <p className="text-sm text-[var(--signal-ink-muted)] pt-3">Loading memberships…</p>
            ) : subscriptions.length === 0 ? (
              <p className="text-sm text-[var(--signal-ink-muted)] pt-3">You’re not subscribed to any artist tiers yet.</p>
            ) : (
              <ul className="space-y-2 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] divide-y divide-[var(--signal-silver-light)] mt-3">
                {subscriptions.map((sub) => {
                  const artist = sub.artists
                  const tier = sub.memberships?.title ?? 'Membership'
                  return (
                    <li key={sub.id} className="flex gap-3 p-4 items-center">
                      <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/40">
                        {artist?.avatar_url ? (
                          <img src={artist.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--signal-ink-muted)]">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--signal-ink)]">{tier}</p>
                        {artist && (
                          <Link to={`/artist/${artist.id}`} className="text-xs text-[var(--signal-gold)] hover:opacity-80">
                            {artist.display_name}
                          </Link>
                        )}
                        <p className="text-xs text-[var(--signal-ink-muted)] mt-1 capitalize">Status: {sub.status}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            </div>
          </details>

          <div className="space-y-4">
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
    </div>
  )
}
