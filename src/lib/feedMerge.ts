import type { FeedItem } from '../types/feed'

/** Strip draft / dev placeholder images from discovery (real rows only; demos use /demo/*). */
export function isPlaceholderAssetUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  const u = url.toLowerCase()
  return (
    u.includes('placehold.co') ||
    u.includes('via.placeholder') ||
    u.includes('placekitten.com')
  )
}

function feedItemPriority(item: FeedItem): number {
  if (item.item_type === 'stream' && item.is_live) return 5
  if (item.item_type === 'stream') return 4
  if (item.item_type === 'artist') return 3
  if (item.item_type === 'event') return 2
  if (item.item_type === 'product') return 1
  return 0
}

/** One discovery card per artist; prefer live stream > stream > artist > … */
export function dedupeFeedByArtist(items: FeedItem[]): FeedItem[] {
  const sorted = [...items].sort((a, b) => {
    const t = new Date(b.sort_at).getTime() - new Date(a.sort_at).getTime()
    if (t !== 0) return t
    return feedItemPriority(b) - feedItemPriority(a)
  })
  const best = new Map<string, FeedItem>()
  for (const item of sorted) {
    const cur = best.get(item.artist_id)
    if (!cur || feedItemPriority(item) > feedItemPriority(cur)) {
      best.set(item.artist_id, item)
    }
  }
  return Array.from(best.values()).sort(
    (a, b) => new Date(b.sort_at).getTime() - new Date(a.sort_at).getTime(),
  )
}

/** Exact case-insensitive title match; those rows move to the start (stable order among matches). */
export function moveFeedItemsWithTitleToStart(items: FeedItem[], title: string): FeedItem[] {
  const needle = title.trim().toLowerCase()
  if (!needle) return items
  const front: FeedItem[] = []
  const back: FeedItem[] = []
  for (const it of items) {
    if (it.title.trim().toLowerCase() === needle) front.push(it)
    else back.push(it)
  }
  return [...front, ...back]
}

/** Exact case-insensitive title match; those rows move to the end (stable order among matches). */
export function moveFeedItemsWithTitleToEnd(items: FeedItem[], title: string): FeedItem[] {
  const needle = title.trim().toLowerCase()
  if (!needle) return items
  const front: FeedItem[] = []
  const back: FeedItem[] = []
  for (const it of items) {
    if (it.title.trim().toLowerCase() === needle) back.push(it)
    else front.push(it)
  }
  return [...front, ...back]
}
