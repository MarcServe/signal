import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_FEED_ITEMS } from '../data/demoFeed'
import { DEMO_ARTIST_PROFILES } from '../data/demoArtists'

type ArtistState = {
  display_name: string
  handle: string | null
  avatar_url: string | null
  bio: string | null
} | null

type Product = { id: string; title: string; image_url: string | null; type: string }
type Membership = { id: string; title: string; price_cents: number; image_url: string | null }

export function ArtistProfile() {
  const { artistId } = useParams<{ artistId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [artist, setArtist] = useState<ArtistState>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [events, setEvents] = useState<{ id: string; title: string; image_url: string | null; starts_at: string }[]>([])
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
          display_name: profile.display_name,
          handle: profile.handle,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
        })
        setEvents(profile.events as { id: string; title: string; image_url: string | null; starts_at: string }[])
        setProducts(profile.products as { id: string; title: string; image_url: string | null; type: string }[])
        setMemberships(
          profile.memberships as { id: string; title: string; price_cents: number; image_url: string | null }[]
        )
      } else if (demo) {
        setArtist({
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
      .select('display_name, handle, avatar_url, bio')
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
      .select('id, title, image_url, starts_at')
      .eq('artist_id', artistId)
      .order('starts_at', { ascending: true })
      .limit(6)
      .then(({ data }) => setEvents((data ?? []) as typeof events))

    supabase
      .from('products')
      .select('id, title, image_url, type')
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPurchaseProduct(null)}>
          <div className="bg-[var(--signal-white-pure)] rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>{purchaseProduct.title}</h3>
            <p className="text-sm text-[var(--signal-ink-muted)] mb-4 capitalize">{purchaseProduct.type}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { showToast(`Purchased "${purchaseProduct.title}" (mock)`); setPurchaseProduct(null); }}
                className="flex-1 py-3 rounded-xl bg-[var(--signal-gold)] text-white font-medium"
              >
                Buy (mock)
              </button>
              <button type="button" onClick={() => setPurchaseProduct(null)} className="flex-1 py-2 text-sm text-[var(--signal-ink-muted)]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Join membership modal */}
      {joinMembership && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setJoinMembership(null)}>
          <div className="bg-[var(--signal-white-pure)] rounded-2xl overflow-hidden max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            {joinMembership.image_url && (
              <div className="aspect-[16/9] bg-[var(--signal-silver-light)]">
                <img src={joinMembership.image_url} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="p-6">
            <h3 className="text-lg font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>{joinMembership.title}</h3>
            <p className="text-sm text-[var(--signal-ink-muted)] mb-4">${(joinMembership.price_cents / 100).toFixed(2)}/month</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { showToast(`Joined "${joinMembership.title}" (mock)`); setJoinMembership(null); }}
                className="flex-1 py-3 rounded-xl bg-[var(--signal-gold)] text-white font-medium"
              >
                Join (mock)
              </button>
              <button type="button" onClick={() => setJoinMembership(null)} className="flex-1 py-2 text-sm text-[var(--signal-ink-muted)]">Cancel</button>
            </div>
            </div>
          </div>
        </div>
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
            <p className="text-[var(--signal-ink-muted)] leading-relaxed max-w-2xl">{artist.bio}</p>
          </section>
        )}

        {/* Live schedule */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Live schedule
          </h2>
          {events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {events.map((e) => (
                <Link
                  key={e.id}
                  to={e.id.startsWith('demo-') ? `/live/demo-1` : `/live/${e.id}`}
                  className="block rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-white"
                >
                  <div className="aspect-video bg-[var(--signal-silver-light)]">
                    {e.image_url && (
                      <img src={e.image_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-[var(--signal-ink)]">{e.title}</p>
                    <p className="text-sm text-[var(--signal-ink-muted)]">
                      {new Date(e.starts_at).toLocaleString()}
                    </p>
                  </div>
                </Link>
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
              {memberships.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setJoinMembership(m)}
                  className="rounded-[var(--radius-card)] border border-[var(--signal-gold)]/30 bg-[var(--signal-white-pure)] min-w-[160px] max-w-[220px] text-left overflow-hidden hover:border-[var(--signal-gold)]/60 hover:bg-[var(--signal-silver-light)]/30 transition-colors"
                >
                  <div className="aspect-[4/3] bg-[var(--signal-silver-light)]/50">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center px-2">
                        <span className="text-xs text-[var(--signal-ink-muted)] text-center">{m.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="font-medium text-[var(--signal-ink)] text-sm truncate">{m.title}</p>
                    <p className="text-sm text-[var(--signal-gold)] mt-0.5">${(m.price_cents / 100).toFixed(2)}/mo</p>
                    <span className="text-xs text-[var(--signal-ink-muted)] mt-1 block">Tap to join</span>
                  </div>
                </button>
              ))}
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
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPurchaseProduct(p)}
                  className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-white text-left hover:border-[var(--signal-gold)]/50 hover:shadow-md transition-all"
                >
                  <div className="aspect-[3/4] bg-[var(--signal-silver-light)]">
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium text-[var(--signal-ink)] truncate">{p.title}</p>
                    <p className="text-xs text-[var(--signal-ink-muted)] capitalize">{p.type}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[var(--signal-ink-muted)] text-sm">No tracks or merch yet. Follow to get notified when they drop.</p>
          )}
        </section>
      </div>
    </div>
  )
}
