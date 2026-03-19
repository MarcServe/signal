import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl, getSession } from '../lib/api'

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

export function Dashboard() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const profileRetried = useRef(false)
  const [artist, setArtist] = useState<{ id: string; display_name: string; stripe_account_id?: string | null; stripe_onboarding_complete?: boolean } | null>(null)
  const [artistLoaded, setArtistLoaded] = useState(false)
  const [streams, setStreams] = useState<{ id: string; title: string | null; is_live: boolean; camera_auto_rotate?: boolean }[]>([])
  const [products, setProducts] = useState<{ id: string; title: string }[]>([])
  const [events, setEvents] = useState<{ id: string; title: string; starts_at: string; venue: string | null }[]>([])
  const [memberships, setMemberships] = useState<{ id: string; title: string; price_cents: number }[]>([])
  const [feeFreeToday, setFeeFreeToday] = useState(false)
  const [integrationsModal, setIntegrationsModal] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState<string | null>(null)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [newProductTitle, setNewProductTitle] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('9.99')

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
      .select('id, display_name, stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setArtist(data ?? null)
        setArtistLoaded(true)
        if (data?.id) {
          supabase.from('streams').select('id, title, is_live, camera_auto_rotate').eq('artist_id', data.id).order('created_at', { ascending: false }).limit(10).then(({ data: s }) => setStreams((s ?? []) as typeof streams))
          supabase.from('products').select('id, title').eq('artist_id', data.id).limit(20).then(({ data: p }) => setProducts((p ?? []) as typeof products))
          supabase.from('events').select('id, title, starts_at, venue').eq('artist_id', data.id).order('starts_at', { ascending: true }).limit(20).then(({ data: e }) => setEvents((e ?? []) as typeof events))
          supabase.from('memberships').select('id, title, price_cents').eq('artist_id', data.id).then(({ data: m }) => setMemberships((m ?? []) as typeof memberships))
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

  const displayName = artist?.display_name ?? profile.full_name ?? 'Artist'
  const artistId = artist?.id

  return (
    <div className="min-h-screen bg-[var(--signal-white)]">
      <div className="max-w-3xl mx-auto px-[var(--gutter)] py-[var(--space-3xl)]">
        {/* Hero: name + minimal CTA */}
        <header className="mb-[var(--space-2xl)]">
          <h1 className="text-3xl font-semibold text-[var(--signal-ink)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {displayName}
          </h1>
          <p className="mt-2 text-[var(--signal-ink-muted)] text-sm">
            <Link to="/avatar/create" className="text-[var(--signal-gold)] hover:opacity-80 transition-opacity">Add AI avatar</Link>
            <span className="mx-2">·</span>
            <span>Your streams and products</span>
          </p>
          {!artist && (
            <p className="mt-3 text-sm">
              <Link to="/become-artist" className="text-[var(--signal-gold)] hover:opacity-80">Complete your artist profile</Link> to go live and add products.
            </p>
          )}
        </header>

        {feeFreeToday && (
          <div className="mb-[var(--space-xl)] rounded-[var(--radius-card)] bg-[var(--signal-gold)]/10 border border-[var(--signal-gold)]/30 px-4 py-3 text-sm text-[var(--signal-ink)]" style={{ fontFamily: 'var(--font-body)' }}>
            Today is fee-free — you keep 100%.
          </div>
        )}

        {/* Payouts + Integrations (visual cards) */}
        {artistId && (
          <section
            className="mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] p-4 sm:p-5"
            style={{
              backgroundImage:
                "linear-gradient(145deg, rgba(16,16,16,0.02), rgba(212,175,55,0.05)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120'%3E%3Cg fill='none' stroke='%23d4af37' stroke-opacity='0.18' stroke-width='2'%3E%3Cpath d='M0 70 C20 30 40 30 60 70 C80 110 100 110 120 70 C140 30 160 30 180 70 C200 110 220 110 240 70'/%3E%3C/g%3E%3Cg fill='%23999' fill-opacity='0.12'%3E%3Crect x='20' y='32' width='6' height='26'/%3E%3Crect x='34' y='24' width='6' height='38'/%3E%3Crect x='48' y='38' width='6' height='22'/%3E%3Crect x='62' y='18' width='6' height='48'/%3E%3C/g%3E%3C/svg%3E\")",
              backgroundSize: 'cover, 320px 160px',
              backgroundPosition: 'center, right bottom',
            }}
          >
            <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Payouts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]/95 backdrop-blur-sm">
                <div
                  className="h-20 flex items-center justify-center"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, rgba(99,91,255,0.16), rgba(99,91,255,0.04)), radial-gradient(circle at 80% 20%, rgba(99,91,255,0.35), transparent 55%)",
                  }}
                >
                  <img src="https://cdn.simpleicons.org/stripe/635BFF" alt="Stripe logo" className="w-9 h-9 object-contain" loading="lazy" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-[var(--signal-ink)]">Stripe</p>
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
          </section>
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
            <p className="text-xs text-[var(--signal-silver)]">Connect Stripe and sync catalogue to see revenue and subscriber counts here.</p>
          </div>
        </section>

        {/* Events */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Events</h2>
          {events.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm">
              No events yet. Add live experiences and ticket links.
            </div>
          ) : (
            <ul className="space-y-3">
              {events.map((ev) => (
                <li key={ev.id} className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-[var(--signal-ink)]">{ev.title}</p>
                    <p className="text-xs text-[var(--signal-ink-muted)]">
                      {new Date(ev.starts_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      {ev.venue ? ` · ${ev.venue}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Subscription tiers (memberships) */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Subscription tiers</h2>
          {memberships.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm">
              No tiers yet. Create membership tiers so fans can subscribe.
            </div>
          ) : (
            <ul className="space-y-3">
              {memberships.map((m) => (
                <li key={m.id} className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-4 flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--signal-ink)]">{m.title}</span>
                  <span className="text-sm text-[var(--signal-gold)]">${(m.price_cents / 100).toFixed(2)}/mo</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Products: visual cards + Add product */}
        <section className="mb-[var(--space-2xl)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Products</h2>
          {addProductOpen && artistId && (
            <div className="mb-4 p-4 rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]">
              <input type="text" placeholder="Product title" value={newProductTitle} onChange={(e) => setNewProductTitle(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm mb-2" />
              <input type="text" placeholder="Price (e.g. 9.99)" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-3 py-2 text-sm mb-2" />
              <div className="flex gap-2">
                <button type="button" onClick={async () => { if (!artistId) return; const cents = Math.round(parseFloat(newProductPrice) * 100) || 0; await supabase.from('products').insert({ artist_id: artistId, type: 'merch', title: newProductTitle || 'Untitled', price_cents: cents }); const { data } = await supabase.from('products').select('id, title').eq('artist_id', artistId); setProducts((data ?? []) as typeof products); setNewProductTitle(''); setNewProductPrice('9.99'); setAddProductOpen(false); }} className="px-3 py-1.5 rounded-lg bg-[var(--signal-gold)] text-white text-sm">Add</button>
                <button type="button" onClick={() => setAddProductOpen(false)} className="px-3 py-1.5 rounded-lg border border-[var(--signal-silver-light)] text-sm">Cancel</button>
              </div>
            </div>
          )}
          {!addProductOpen && artistId && (
            <button type="button" onClick={() => setAddProductOpen(true)} className="mb-4 text-sm text-[var(--signal-gold)] hover:opacity-80">+ Add product</button>
          )}
          {products.length === 0 && !addProductOpen ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-8 text-center text-[var(--signal-ink-muted)] text-sm">
              No products yet. Add one above or connect Bandcamp/Shopify to sync.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((p) => (
                <div key={p.id} className="rounded-[var(--radius-card)] overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] aspect-square flex items-center justify-center p-4">
                  <span className="text-[var(--signal-ink-muted)] text-sm text-center truncate w-full" style={{ fontFamily: 'var(--font-body)' }}>{p.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Connect your music */}
        <section
          className="mb-[var(--space-2xl)] rounded-[var(--radius-card)] border border-[var(--signal-silver-light)] p-4 sm:p-5"
          style={{
            backgroundImage:
              "linear-gradient(165deg, rgba(212,175,55,0.08), rgba(255,255,255,0.3)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='140' viewBox='0 0 260 140'%3E%3Cg fill='none' stroke='%23d4af37' stroke-opacity='0.14' stroke-width='2'%3E%3Cpath d='M0 95 Q30 72 60 95 T120 95 T180 95 T240 95'/%3E%3Cpath d='M0 110 Q30 87 60 110 T120 110 T180 110 T240 110'/%3E%3C/g%3E%3Cg fill='%23000' fill-opacity='0.08'%3E%3Ccircle cx='210' cy='40' r='18'/%3E%3Ccircle cx='210' cy='40' r='6' fill='%23fff' fill-opacity='0.22'/%3E%3C/g%3E%3C/svg%3E\")",
            backgroundSize: 'cover, 340px 180px',
            backgroundPosition: 'center, right 14px bottom 8px',
          }}
        >
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-3" style={{ fontFamily: 'var(--font-display)' }}>Connect your music</h2>
          <p className="text-sm text-[var(--signal-ink-muted)] mb-3">Link your catalogue and sales in one place.</p>
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
                          supabase.from('integrations').upsert({ artist_id: artistId, service_name: card.key, api_key: 'placeholder', updated_at: new Date().toISOString() }, { onConflict: 'artist_id,service_name' }).then(() => {})
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
                        if (!session) { setSyncLoading(null); return }
                        await fetch(apiUrl('/sync'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ artist_id: artistId, service: card.key }) })
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
              <button type="button" onClick={() => setIntegrationsModal(null)} className="mt-2 text-[var(--signal-gold)] hover:opacity-80">Dismiss</button>
            </div>
          )}
        </section>
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
