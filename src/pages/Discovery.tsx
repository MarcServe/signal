import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MasonryGrid, masonryGridContainerStyle } from '../design-system/MasonryGrid'
import { DiscoveryCard } from '../components/DiscoveryCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DEMO_FEED_ITEMS } from '../data/demoFeed'
import type { FeedItem } from '../types/feed'

const PAGE_SIZE = 20

export function Discovery() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
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
    // Homepage always shows the fixed 5-card design (initial design); no DB feed on first load.
    if (from === 0) {
      setItems(DEMO_FEED_ITEMS)
      setHasMore(false)
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

  return (
    <div style={masonryGridContainerStyle} className="min-h-screen">
      <MasonryGrid
        items={items}
        renderItem={(item) => <DiscoveryCard item={item} />}
        keyExtractor={(item) => `${item.item_type}-${item.id}`}
      />
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
