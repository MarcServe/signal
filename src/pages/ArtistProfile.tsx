import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_FEED_ITEMS } from '../data/demoFeed'
import { DEMO_ARTIST_PROFILES } from '../data/demoArtists'
import { CheckoutDrawer } from '../components/CheckoutDrawer'
import {
  sortEventsForLiveSchedule,
  type ScheduleEventRow,
} from '../lib/eventSchedule'
import { AboutSheet } from '../components/artist/AboutSheet'
import { ArtistEventRailCard } from '../components/artist/ArtistEventRailCard'
import { ArtistHorizontalRail } from '../components/artist/ArtistHorizontalRail'
import { ArtistMembershipTile, ArtistProductTile } from '../components/artist/ArtistMerchTile'
import { ScheduleTimeSheet } from '../components/artist/ScheduleTimeSheet'

type ArtistState = {
  id: string
  display_name: string
  handle: string | null
  avatar_url: string | null
  bio: string | null
} | null

type Product = { id: string; title: string; image_url: string | null; type: string; price_cents?: number }
type Membership = { id: string; title: string; price_cents: number; image_url: string | null }

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
  const [aboutOpen, setAboutOpen] = useState(false)
  const [timeDetailEvent, setTimeDetailEvent] = useState<ScheduleEventRow | null>(null)

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
        setProducts(profile.products as Product[])
        setMemberships(profile.memberships as Membership[])
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
      .limit(12)
      .then(({ data }) => setEvents((data ?? []) as ScheduleEventRow[]))

    supabase
      .from('products')
      .select('id, title, image_url, type, price_cents')
      .eq('artist_id', artistId)
      .limit(12)
      .then(({ data }) => setProducts((data ?? []) as Product[]))

    supabase
      .from('memberships')
      .select('id, title, price_cents, image_url')
      .eq('artist_id', artistId)
      .then(({ data }) => setMemberships((data ?? []) as Membership[]))
  }, [artistId, isDemo])

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
    [events, scheduleNow],
  )

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-black text-white/50">
        Loading…
      </div>
    )
  }

  if (notFound || !artist) {
    return (
      <div className="mx-auto flex h-full min-h-0 max-w-md flex-1 flex-col items-center justify-center bg-black px-4 text-center">
        <p className="mb-2 font-medium text-white/90" style={{ fontFamily: 'var(--font-display)' }}>
          Profile isn’t available
        </p>
        <p className="mb-6 text-sm leading-relaxed text-white/45">
          This page may be hidden while the artist is offline, or the link might be incorrect.
        </p>
        <Link to="/" className="text-sm text-[var(--signal-gold)] hover:opacity-80">
          Back to feed
        </Link>
      </div>
    )
  }

  const showToast = (msg: string) => {
    setMockToast(msg)
    setTimeout(() => setMockToast(null), 2500)
  }

  const bioText = artist.bio?.trim()

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto overflow-x-hidden bg-black text-white [-webkit-overflow-scrolling:touch]">
      {timeDetailEvent && (
        <ScheduleTimeSheet
          event={timeDetailEvent}
          nowMs={scheduleNow}
          open={!!timeDetailEvent}
          onClose={() => setTimeDetailEvent(null)}
        />
      )}

      {bioText && (
        <AboutSheet bio={bioText} open={aboutOpen} onClose={() => setAboutOpen(false)} />
      )}

      <div className="fixed left-4 top-[max(4.25rem,env(safe-area-inset-top)+3.25rem)] z-40 md:left-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm text-white/90 backdrop-blur-md transition-colors duration-500 [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] hover:bg-white/20"
        >
          <span aria-hidden>←</span> Feed
        </Link>
      </div>

      {bioText && (
        <button
          type="button"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 rounded-full bg-white/15 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-white backdrop-blur-md transition-colors duration-500 [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] hover:bg-white/25"
          onClick={() => setAboutOpen(true)}
        >
          About
        </button>
      )}

      {mockToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/10">
          {mockToast}
        </div>
      )}

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

      {/* Image-first hero: full viewport, text overlay only */}
      <div className="relative min-h-[100dvh] w-full bg-neutral-950">
        {artist.avatar_url ? (
          <img
            src={artist.avatar_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-32">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
            {artist.display_name}
          </h1>
          {artist.handle && (
            <p className="mt-2 text-sm text-white/65">@{artist.handle}</p>
          )}
        </div>
      </div>

      {/* Horizontal rails — image = label; no white section blocks */}
      {sortedScheduleEvents.length > 0 && (
        <ArtistHorizontalRail label="Live">
          {sortedScheduleEvents.map((e) => (
            <ArtistEventRailCard
              key={e.id}
              event={e}
              nowMs={scheduleNow}
              artistAvatarUrl={artist.avatar_url}
              to={e.id.startsWith('demo-') ? `/live/demo-1` : `/live/${e.id}`}
              onTimeClick={() => setTimeDetailEvent(e)}
            />
          ))}
        </ArtistHorizontalRail>
      )}

      {sortedScheduleEvents.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-white/40">No scheduled events yet.</p>
      )}

      {memberships.length > 0 && (
        <ArtistHorizontalRail label="Membership">
          {memberships.map((m) => (
            <ArtistMembershipTile
              key={m.id}
              m={m}
              artistAvatarUrl={artist.avatar_url}
              onSelect={() => setJoinMembership(m)}
            />
          ))}
        </ArtistHorizontalRail>
      )}

      {products.length > 0 && (
        <ArtistHorizontalRail label="Tracks & merch">
          {products.map((p) => (
            <ArtistProductTile
              key={p.id}
              p={p}
              artistAvatarUrl={artist.avatar_url}
              onSelect={() => setPurchaseProduct(p)}
            />
          ))}
        </ArtistHorizontalRail>
      )}

      <div className="h-[min(8vh,4rem)] w-full shrink-0" aria-hidden />
    </div>
  )
}
