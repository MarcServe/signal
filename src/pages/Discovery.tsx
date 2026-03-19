import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MasonryGrid, masonryGridContainerStyle } from '../design-system/MasonryGrid'
import { DiscoveryCard } from '../components/DiscoveryCard'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DEMO_FEED_ITEMS } from '../data/demoFeed'
import { dedupeFeedByArtist, isPlaceholderAssetUrl } from '../lib/feedMerge'
import type { FeedItem } from '../types/feed'

const PAGE_SIZE = 20
const INITIAL_DB_FETCH = 80

function feedItemMatchesQuery(item: FeedItem, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const hay = `${item.title} ${item.cta} ${item.item_type} ${item.artist_id}`.toLowerCase()
  return hay.includes(needle)
}

/** When feed_items_view is empty or errors (env, RLS, migrations), still show the signed-in artist from `artists` (owner can always read own row). */
async function loadMyArtistFeedItem(userId: string): Promise<FeedItem | null> {
  const { data, error } = await supabase
    .from('artists')
    .select('id, display_name, avatar_url, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as { id: string; display_name: string; avatar_url: string | null; created_at: string }
  return {
    item_type: 'artist',
    id: row.id,
    artist_id: row.id,
    title: row.display_name,
    image_url: row.avatar_url ?? '',
    is_live: false,
    cta: 'Join',
    sort_at: row.created_at,
  }
}

export function Discovery() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const feedQuery = (searchParams.get('q') ?? '').trim()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [feedFallbackReason, setFeedFallbackReason] = useState<'none' | 'empty_or_error' | 'not_configured'>('none')
  const loadingRef = useRef(false)

  useEffect(() => {
    if (authLoading || !user || !profile) return
    if (profile.avatar_setup_done !== true) {
      navigate('/onboarding', { replace: true })
    }
  }, [authLoading, user, profile, navigate])

  const loadPage = useCallback(async (from: number) => {
    if (from === 0) {
      setLoading(true)
      setFeedFallbackReason('none')

      if (!isSupabaseConfigured) {
        setFeedFallbackReason('not_configured')
        setItems(DEMO_FEED_ITEMS)
        setHasMore(false)
        setOffset(0)
        setLoading(false)
        return
      }

      const selfItem =
        user?.id && profile?.role === 'artist' ? await loadMyArtistFeedItem(user.id) : null

      const { data, error } = await supabase
        .from('feed_items_view')
        .select('*')
        .order('sort_at', { ascending: false })
        .limit(INITIAL_DB_FETCH)

      if (error || !data?.length) {
        setFeedFallbackReason('empty_or_error')
        const merged = selfItem ? [selfItem, ...DEMO_FEED_ITEMS] : [...DEMO_FEED_ITEMS]
        setItems(merged)
        setHasMore(false)
        setOffset(0)
        setLoading(false)
        return
      }

      // Drop placeholder asset URLs before deduping so a better row (e.g. product image) can represent the artist.
      const fromDb = data as FeedItem[]
      const noDraftImages = fromDb.filter((r) => !isPlaceholderAssetUrl(r.image_url))
      const deduped = dedupeFeedByArtist(noDraftImages)
      const demoArtistIds = new Set(DEMO_FEED_ITEMS.map((d) => d.artist_id))
      const realRows = deduped.filter((r) => !demoArtistIds.has(r.artist_id))
      let merged = [...realRows.slice(0, 40), ...DEMO_FEED_ITEMS]
      if (selfItem && !merged.some((r) => r.artist_id === selfItem.artist_id)) {
        merged = [selfItem, ...merged]
      }
      setItems(merged)
      setHasMore(false)
      setOffset(0)
      setLoading(false)
      return
    }
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const { data, error } = await supabase
      .from('feed_items_view')
      .select('*')
      .order('sort_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    loadingRef.current = false
    setLoading(false)
    if (error) {
      setHasMore(false)
      return
    }
    const list = (data ?? []) as FeedItem[]
    setItems((prev) => [...prev, ...list])
    setHasMore(list.length === PAGE_SIZE)
    setOffset(from + list.length)
  }, [user?.id, profile?.role])

  useEffect(() => {
    loadPage(0)
  }, [loadPage])

  useEffect(() => {
    if (!hasMore || loading) return
    const el = document.scrollingElement
    const onScroll = () => {
      if (!el || loadingRef.current) return
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 400
      if (nearBottom) loadPage(offset)
    }
    el?.addEventListener('scroll', onScroll, { passive: true })
    return () => el?.removeEventListener('scroll', onScroll)
  }, [offset, hasMore, loadPage, loading])

  const filteredItems = useMemo(() => {
    if (!feedQuery) return items
    return items.filter((item) => feedItemMatchesQuery(item, feedQuery))
  }, [items, feedQuery])

  return (
    <div style={masonryGridContainerStyle} className="min-h-screen">
      {feedFallbackReason === 'not_configured' && (
        <div className="sticky top-0 z-20 border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          Live data isn&apos;t wired up for this build yet. Showing preview cards only — your team can connect the app
          database in deployment settings and publish again.
        </div>
      )}
      {feedFallbackReason === 'empty_or_error' && isSupabaseConfigured && (
        <div className="sticky top-0 z-20 border-b border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]/95 px-4 py-2 text-center text-xs text-[var(--signal-ink-muted)] backdrop-blur-sm">
          We couldn&apos;t load the live feed (empty result or connection issue). If you&apos;re signed in as an artist, your
          profile may still appear first. Preview cards fill the rest — try again shortly or check your deployment
          configuration.
        </div>
      )}
      {feedQuery && (
        <div className="sticky top-0 z-20 border-b border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)]/95 px-4 py-2 text-center text-xs text-[var(--signal-ink-muted)] backdrop-blur-sm">
          Filtering by &ldquo;{feedQuery}&rdquo; — {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
        </div>
      )}
      <MasonryGrid
        items={filteredItems}
        renderItem={(item) => <DiscoveryCard item={item} />}
        keyExtractor={(item) => `${item.item_type}-${item.id}`}
      />
      {items.length > 0 && feedQuery && filteredItems.length === 0 && !loading && (
        <div className="py-12 text-center text-[var(--signal-ink-muted)] px-4">
          No cards match &ldquo;{feedQuery}&rdquo;. Try another word or{' '}
          <button
            type="button"
            className="text-[var(--signal-ink)] underline decoration-[var(--signal-silver-light)] hover:decoration-[var(--signal-gold)]"
            onClick={() => navigate({ pathname: '/', search: '' }, { replace: true })}
          >
            clear search
          </button>
          .
        </div>
      )}
      {items.length === 0 && !loading && (
        <div className="py-12 text-center text-[var(--signal-ink-muted)]">
          No items yet. Be the first to go live or add content.
        </div>
      )}
      {loading && items.length > 0 && (
        <div className="py-6 text-center text-sm text-[var(--signal-ink-muted)]">
          Loading…
        </div>
      )}
    </div>
  )
}
