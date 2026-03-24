import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_FEED_ITEMS } from '../data/demoFeed'
import { DEMO_ARTIST_PROFILES } from '../data/demoArtists'
import { catalogCardImageUrl } from '../lib/catalogImage'
import { formatGbp } from '../lib/currency'
import { CheckoutDrawer } from '../components/CheckoutDrawer'
import { stripCitationMarkers } from '../lib/cleanBioText'
import {
  formatCountdown,
  formatTimeRemainingLive,
  getEventPhase,
  sortEventsForLiveSchedule,
  type ScheduleEventRow,
} from '../lib/eventSchedule'

function fallbackToArtistPortrait(e: SyntheticEvent<HTMLImageElement>, portrait: string | null) {
  const el = e.currentTarget
  if (el.dataset.fallbackPortrait === '1') return
  const p = portrait?.trim()
  if (!p) return
  el.dataset.fallbackPortrait = '1'
  el.src = p
}

type ArtistState = {
  id: string
  display_name: string
  handle: string | null
  avatar_url: string | null
  bio: string | null
} | null

type Product = { id: string; title: string; image_url: string | null; type: string; price_cents?: number }
type Membership = { id: string; title: string; price_cents: number; image_url: string | null }

function LiveScheduleEventCard({
  event: e,
  nowMs,
  artistAvatarUrl,
  to,
}: {
  event: ScheduleEventRow
  nowMs: number
  artistAvatarUrl: string | null
  to: string
}) {
  const phase = getEventPhase(e.starts_at, e.ends_at, nowMs)
  const eventCardImg = catalogCardImageUrl(e.image_url, artistAvatarUrl)
  const startMs = Date.parse(e.starts_at)
  const whenLine = new Date(e.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  const badge =
    phase === 'live' ? (
      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-semibold uppercase tracking-wide shadow-sm">
        Live
      </span>
    ) : phase === 'upcoming' ? (
      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-amber-500 text-white text-xs font-semibold uppercase tracking-wide shadow-sm">
        Not started yet
      </span>
    ) : (
      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/55 text-white text-xs font-semibold uppercase tracking-wide shadow-sm">
        Ended
      </span>
    )

  let countdownLine: string | null = null
  if (phase === 'upcoming' && !Number.isNaN(startMs)) {
    countdownLine = `Starts in ${formatCountdown(startMs, nowMs)}`
  } else if (phase === 'live') {
    countdownLine = `Ends in ${formatTimeRemainingLive(e.starts_at, e.ends_at, nowMs)}`
  }

  return (
    <Link to={to} className="block rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-white hover:border-[var(--signal-gold)]/40 transition-colors">
      <div className="aspect-video w-full overflow-hidden bg-[var(--signal-silver-light)] relative">
        {badge}
        {eventCardImg ? (
          <img
            src={eventCardImg}
            alt=""
            className="h-full w-full object-cover object-center"
            onError={(ev) => fallbackToArtistPortrait(ev, artistAvatarUrl)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4">
            <span className="text-sm font-medium text-[var(--signal-ink)] text-center">{e.title}</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="font-medium text-[var(--signal-ink)]">{e.title}</p>
        <p className="text-sm text-[var(--signal-ink-muted)]">{whenLine}</p>
        {countdownLine && (
          <p className="text-sm font-medium text-[var(--signal-gold)] tabular-nums tracking-tight">{countdownLine}</p>
        )}
      </div>
    </Link>
  )
}

export function ArtistProfile() {
  const { artistId } = useParams<{ artistId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [artist, setArtist] = useState<ArtistState>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [events, setEvents] = useState<ScheduleEventRow[]>([])
  const [scheduleNow, setScheduleNow] = useState(() => Date.now())
  const [products, setProducts] = useState<Product[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [purchaseProduct, setPurchaseProduct] = useState<Product | null>(null)
  const [joinMembership, setJoinMembership] = useState<Membership | null>(null)
  const [mockToast, setMockToast] = useState<string | null>(null)

  const isDemo = artistId?.startsWith('demo-artist-')

  useEffect(() => {
    if (!artistId) return

    if (isDemo) {
      const profile = artistId ? DEMO_ARTIST_PROFILES[artistId] : null
      const demo = DEMO_FEED_ITEMS.find((item) => item.artist_id === artistId)
      if (profile) {
        setArtist({
          id: artistId,
          display_name: profile.display_name,
          handle: profile.handle,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
        })
        setEvents(profile.events as ScheduleEventRow[])
        setProducts(profile.products as { id: string; title: string; image_url: string | null; type: string; price_cents?: number }[])
        setMemberships(
          profile.memberships as { id: string; title: string; price_cents: number; image_url: string | null }[]
        )
      } else if (demo) {
        setArtist({
          id: artistId,
          display_name: demo.title,
          handle: null,
          avatar_url: demo.image_url || null,
          bio: 'Demo artist. Sign up as an artist to create your own profile.',
        })
        setEvents([])
        setProducts([])
        setMemberships([])
      } else {
        setNotFound(true)
      }
      setLoading(false)
      return
    }

    setLoading(true)
    setNotFound(false)
    supabase
      .from('artists')
      .select('id, display_name, handle, avatar_url, bio')
      .eq('id', artistId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setArtist(null)
          setNotFound(true)
        } else {
          setArtist(data as ArtistState)
        }
        setLoading(false)
      })

    supabase
      .from('events')
      .select('id, title, image_url, starts_at, ends_at')
      .eq('artist_id', artistId)
      .order('starts_at', { ascending: true })
      .limit(6)
      .then(({ data }) => setEvents((data ?? []) as ScheduleEventRow[]))

    supabase
      .from('products')
      .select('id, title, image_url, type, price_cents')
      .eq('artist_id', artistId)
      .limit(12)
      .then(({ data }) => setProducts((data ?? []) as typeof products))

    supabase
      .from('memberships')
      .select('id, title, price_cents, image_url')
      .eq('artist_id', artistId)
      .then(({ data }) => setMemberships((data ?? []) as Membership[]))
  }, [artistId, isDemo])

  // Open product or membership modal from URL (?product=id or ?membership=id)
  useEffect(() => {
    if (loading || !artist) return
    const productId = searchParams.get('product')
    const membershipId = searchParams.get('membership')
    if (productId && products.length) {
      const p = products.find((x) => x.id === productId) ?? products[0]
      setPurchaseProduct(p)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('product')
        return next
      }, { replace: true })
    }
    if (membershipId && memberships.length) {
      const m = memberships.find((x) => x.id === membershipId) ?? memberships[0]
      setJoinMembership(m)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('membership')
        return next
      }, { replace: true })
    }
  }, [loading, artist, products, memberships, setSearchParams])

  useEffect(() => {
    if (events.length === 0) return
    const id = window.setInterval(() => setScheduleNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [events.length])

  const sortedScheduleEvents = useMemo(
    () => sortEventsForLiveSchedule(events, scheduleNow),
    [events, scheduleNow]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)]">
        Loading…
      </div>
    )
  }

  if (notFound || !artist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--signal-white)] px-4 text-center max-w-md mx-auto">
        <p className="text-[var(--signal-ink)] font-medium mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Profile isn’t available
        </p>
        <p className="text-[var(--signal-ink-muted)] text-sm mb-6 leading-relaxed">
          This page may be hidden while the artist is offline, or the link might be incorrect.
        </p>
        <Link to="/" className="text-[var(--signal-gold)] hover:opacity-80 text-sm">
          Back to feed
        </Link>
      </div>
    )
  }

  const showToast = (msg: string) => {
    setMockToast(msg)
    setTimeout(() => setMockToast(null), 2500)
  }

  return (
    <div className="min-h-screen bg-[var(--signal-white)]">
      {/* Back to feed */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/40 text-white text-sm hover:bg-black/60"
        >
          <span aria-hidden>←</span> Feed
        </Link>
      </div>

      {/* Mock toast */}
      {mockToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm shadow-lg">
          {mockToast}
        </div>
      )}

      {/* Purchase product modal */}
      {purchaseProduct && (
        <CheckoutDrawer
          open={!!purchaseProduct}
          onClose={() => setPurchaseProduct(null)}
          title={purchaseProduct.title}
          type={purchaseProduct.type === 'ticket' ? 'ticket' : 'track'}
          artistId={artist.id}
          itemId={purchaseProduct.id}
          amountCents={purchaseProduct.price_cents ?? 999}
          onSuccess={() => {
            showToast(`Purchased "${purchaseProduct.title}"!`)
            setPurchaseProduct(null)
          }}
        />
      )}

      {/* Join membership modal */}
      {joinMembership && (
        <CheckoutDrawer
          open={!!joinMembership}
          onClose={() => setJoinMembership(null)}
          title={joinMembership.title}
          type="membership"
          artistId={artist.id}
          membershipId={joinMembership.id}
          amountCents={joinMembership.price_cents ?? 999}
          onSuccess={() => {
            showToast(`Joined "${joinMembership.title}"!`)
            setJoinMembership(null)
          }}
        />
      )}

      {/* Hero: full-bleed, tall so portrait image fills */}
      <div className="relative min-h-[60vh] w-full bg-[var(--signal-silver-light)]">
        {artist.avatar_url && (
          <img
            src={artist.avatar_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 p-6 pt-24 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
          <h1 className="text-3xl md:text-4xl font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {artist.display_name}
          </h1>
          {artist.handle && (
            <p className="text-white/90 text-sm mt-1">@{artist.handle}</p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* About / Bio */}
        {artist.bio && (
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[var(--signal-ink)] mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              About
            </h2>
            <p className="text-[var(--signal-ink-muted)] leading-relaxed max-w-2xl whitespace-pre-wrap">
              {stripCitationMarkers(artist.bio)}
            </p>
          </section>
        )}

        {/* Live schedule */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Live schedule
          </h2>
          {events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedScheduleEvents.map((e) => (
                <LiveScheduleEventCard
                  key={e.id}
                  event={e}
                  nowMs={scheduleNow}
                  artistAvatarUrl={artist.avatar_url}
                  to={e.id.startsWith('demo-') ? `/live/demo-1` : `/live/${e.id}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-[var(--signal-ink-muted)] text-sm">No upcoming events. Check back later.</p>
          )}
        </section>

        {/* Membership tiers */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Membership tiers
          </h2>
          {memberships.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {memberships.map((m) => {
                const tierCardImg = catalogCardImageUrl(m.image_url, artist.avatar_url)
                return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setJoinMembership(m)}
                  className="rounded-[var(--radius-card)] border border-[var(--signal-gold)]/30 bg-[var(--signal-white-pure)] min-w-[160px] max-w-[220px] text-left overflow-hidden hover:border-[var(--signal-gold)]/60 hover:bg-[var(--signal-silver-light)]/30 transition-colors"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden bg-[var(--signal-silver-light)]/50">
                    {tierCardImg ? (
                      <img
                        src={tierCardImg}
                        alt=""
                        className="h-full w-full object-cover object-center"
                        onError={(e) => fallbackToArtistPortrait(e, artist.avatar_url)}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center px-2">
                        <span className="text-xs text-[var(--signal-ink-muted)] text-center">{m.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="font-medium text-[var(--signal-ink)] text-sm truncate">{m.title}</p>
                    <p className="text-sm text-[var(--signal-gold)] mt-0.5">{formatGbp(m.price_cents)}/mo</p>
                    <span className="text-xs text-[var(--signal-ink-muted)] mt-1 block">Tap to join</span>
                  </div>
                </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[var(--signal-ink-muted)] text-sm">No membership tiers yet.</p>
          )}
        </section>

        {/* Tracks & merch */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Tracks & merch
          </h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((p) => {
                const productCardImg = catalogCardImageUrl(p.image_url, artist.avatar_url)
                return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPurchaseProduct(p)}
                  className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-white text-left hover:border-[var(--signal-gold)]/50 hover:shadow-md transition-all"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden bg-[var(--signal-silver-light)]">
                    {productCardImg ? (
                      <img
                        src={productCardImg}
                        alt=""
                        className="h-full w-full object-cover object-center"
                        onError={(e) => fallbackToArtistPortrait(e, artist.avatar_url)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-3">
                        <span className="text-xs text-[var(--signal-ink-muted)] text-center line-clamp-4">{p.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium text-[var(--signal-ink)] truncate">{p.title}</p>
                    <p className="text-xs text-[var(--signal-ink-muted)] capitalize">{p.type}</p>
                    {p.price_cents != null && (
                      <p className="text-xs text-[var(--signal-gold)] mt-0.5 font-medium">
                        {formatGbp(p.price_cents)}
                      </p>
                    )}
                  </div>
                </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[var(--signal-ink-muted)] text-sm">No tracks or merch yet. Follow to get notified when they drop.</p>
          )}
        </section>
      </div>
    </div>
  )
}
