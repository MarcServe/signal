import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MasonryGrid, masonryGridContainerStyle } from '../design-system/MasonryGrid'
import { DiscoveryCard } from '../components/DiscoveryCard'
import { supabase } from '../lib/supabase'
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

export function Discovery() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const feedQuery = (searchParams.get('q') ?? '').trim()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
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
      const { data, error } = await supabase
        .from('feed_items_view')
        .select('*')
        .order('sort_at', { ascending: false })
        .limit(INITIAL_DB_FETCH)

      if (error || !data?.length) {
        setItems(DEMO_FEED_ITEMS)
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
      const merged = [...realRows.slice(0, 40), ...DEMO_FEED_ITEMS]
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
  }, [])

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
