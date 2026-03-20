import type { FeedItem } from '../types/feed'

/** Same destinations as `DiscoveryCard` — live streams, artist profiles, product/event deep links. */
export function getFeedItemDetailPath(item: FeedItem): string {
  if (item.item_type === 'stream' && item.is_live) {
    return `/live/${item.id}`
  }
  if (item.item_type === 'artist') {
    return `/artist/${item.artist_id}`
  }
  if (item.item_type === 'product' || item.item_type === 'track') {
    return `/artist/${item.artist_id}?product=${item.id}`
  }
  if (item.item_type === 'event') {
    return `/artist/${item.artist_id}?event=${item.id}`
  }
  if (item.item_type === 'stream') {
    return `/live/${item.id}`
  }
  return `/artist/${item.artist_id}`
}
