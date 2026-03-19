export type FeedItemType = 'stream' | 'artist' | 'product' | 'event' | 'track'

export interface FeedItem {
  item_type: FeedItemType
  id: string
  artist_id: string
  title: string
  image_url: string
  is_live: boolean
  cta: string
  sort_at: string
}
