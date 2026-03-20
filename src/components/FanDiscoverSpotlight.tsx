import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { DEMO_FEED_ITEMS } from '../data/demoFeed'
import { dedupeFeedByArtist, isPlaceholderAssetUrl } from '../lib/feedMerge'
import { getFeedItemDetailPath } from '../lib/feedNavigation'
import type { FeedItem, FeedItemType } from '../types/feed'

const AUTO_MS = 5500
const MAX_SLIDES = 10

function buildSpotlightSlides(raw: FeedItem[]): FeedItem[] {
  const cleaned = raw.filter((r) => !isPlaceholderAssetUrl(r.image_url))
  let picked = dedupeFeedByArtist(cleaned)
    .filter((r) => r.image_url?.trim())
    .slice(0, MAX_SLIDES)

  if (picked.length < 4) {
    const demos = dedupeFeedByArtist(DEMO_FEED_ITEMS)
    for (const d of demos) {
      if (picked.length >= 8) break
      if (!picked.some((p) => p.artist_id === d.artist_id)) {
        picked.push(d)
      }
    }
  }
  return picked
}

/** Match `DiscoveryCard` image frame so spotlight looks like the feed. */
const aspectByType: Record<FeedItemType, string> = {
  stream: 'aspect-[3/4]',
  artist: 'aspect-[3/4]',
  product: 'aspect-[3/4]',
  event: 'aspect-[4/3]',
  track: 'aspect-[3/4]',
}

function slideAspectClass(slide: FeedItem) {
  const isDemoCard = slide.id.startsWith('demo-')
  if (isDemoCard) return 'aspect-[3/4]'
  return aspectByType[slide.item_type] || 'aspect-[3/4]'
}

function typeLabel(t: FeedItem['item_type']) {
  switch (t) {
    case 'stream':
      return 'Live & streams'
    case 'event':
      return 'Event'
    case 'product':
      return 'Shop'
    case 'artist':
    default:
      return 'Artist'
  }
}

export function FanDiscoverSpotlight() {
  const [slides, setSlides] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setSlides(buildSpotlightSlides([...DEMO_FEED_ITEMS]))
          setLoading(false)
        }
        return
      }
      const { data, error } = await supabase
        .from('feed_items_view')
        .select('*')
        .order('sort_at', { ascending: false })
        .limit(100)

      if (cancelled) return

      if (error || !data?.length) {
        setSlides(buildSpotlightSlides([...DEMO_FEED_ITEMS]))
      } else {
        setSlides(buildSpotlightSlides(data as FeedItem[]))
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (slides.length <= 1 || paused) return
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, AUTO_MS)
    return () => window.clearInterval(t)
  }, [slides.length, paused])

  useEffect(() => {
    if (index >= slides.length && slides.length > 0) {
      setIndex(0)
    }
  }, [slides.length, index])

  const go = useCallback(
    (dir: -1 | 1) => {
      if (slides.length === 0) return
      setIndex((i) => (i + dir + slides.length) % slides.length)
    },
    [slides.length]
  )

  if (loading) {
    return (
      <section aria-busy="true" aria-label="Loading discover preview" className="w-full">
        <div className="relative aspect-[3/4] min-h-[220px] w-full overflow-hidden rounded-2xl border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/30">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--signal-gold)]/15 via-[var(--signal-silver-light)]/40 to-[var(--signal-silver-light)]/20" />
          <div className="absolute bottom-6 left-6 right-6 h-8 max-w-[60%] rounded-lg bg-white/20 animate-pulse" />
        </div>
        <p className="mt-3 text-center text-xs text-[var(--signal-ink-muted)]">Curating artists for you…</p>
      </section>
    )
  }

  if (slides.length === 0) {
    return (
      <section className="w-full rounded-2xl border border-[var(--signal-silver-light)] bg-gradient-to-br from-[var(--signal-gold)]/12 to-[var(--signal-silver-light)]/40 p-8 text-center">
        <p className="text-[var(--signal-ink)] font-medium" style={{ fontFamily: 'var(--font-display)' }}>
          Discover artists
        </p>
        <p className="mt-2 text-sm text-[var(--signal-ink-muted)]">The feed is warming up. Jump in to explore.</p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--signal-ink)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Open discover
        </Link>
      </section>
    )
  }

  return (
    <section
      className="w-full"
      aria-roledescription="carousel"
      aria-label="Featured artists and creators"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--signal-ink)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Discover
          </h2>
          <p className="text-xs text-[var(--signal-ink-muted)] mt-0.5">Spotlight — rotates every few seconds</p>
        </div>
        <Link
          to="/"
          className="shrink-0 text-xs font-medium text-[var(--signal-gold)] hover:opacity-80 whitespace-nowrap"
        >
          Full feed →
        </Link>
      </div>

      <div
        className={`relative w-full min-h-[200px] overflow-hidden rounded-2xl border border-[var(--signal-silver-light)] shadow-lg shadow-black/[0.06] ${slideAspectClass(slides[index])}`}
      >
        {slides.map((slide, i) => {
          const active = i === index
          const to = getFeedItemDetailPath(slide)
          return (
            <Link
              key={`${slide.artist_id}-${slide.id}-${i}`}
              to={to}
              className={`absolute inset-0 block transition-opacity duration-700 ease-out ${
                active ? 'z-[1] opacity-100' : 'z-0 opacity-0 pointer-events-none'
              }`}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
            >
              <div className="absolute inset-0 overflow-hidden bg-[var(--signal-silver-light)]">
                <img
                  src={slide.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                aria-hidden
              />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/90 backdrop-blur-sm"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {typeLabel(slide.item_type)}
                  </span>
                  {slide.is_live && (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Live
                    </span>
                  )}
                </div>
                <p
                  className="text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-md line-clamp-2"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {slide.title}
                </p>
                <p className="mt-2 text-sm text-white/80" style={{ fontFamily: 'var(--font-body)' }}>
                  {slide.cta}
                  {slide.item_type === 'stream' && slide.is_live ? ' · Watch live' : ' · Open'}
                </p>
              </div>
            </Link>
          )
        })}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                go(-1)
              }}
              className="absolute left-2 top-1/2 z-[2] -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Previous slide"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                go(1)
              }}
              className="absolute right-2 top-1/2 z-[2] -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Next slide"
            >
              ›
            </button>
          </>
        )}

        {slides.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 z-[2] flex justify-center gap-1.5" role="tablist" aria-label="Slides">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1} of ${slides.length}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <Link
        to="/"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] py-3 text-sm font-medium text-[var(--signal-ink)] transition-colors hover:border-[var(--signal-gold)]/40 hover:bg-[var(--signal-gold)]/5"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        Browse the full feed
        <span className="text-[var(--signal-gold)]" aria-hidden>
          →
        </span>
      </Link>
    </section>
  )
}
