import type { FeedItem } from '../types/feed'

/** Homepage 5 cards use images from public/demo/ (saved in repo for reuse). */
const now = new Date().toISOString()

export const DEMO_FEED_ITEMS: FeedItem[] = [
  {
    item_type: 'artist',
    id: 'demo-1',
    artist_id: 'demo-artist-1',
    title: 'DJ KRUST',
    image_url: '/demo/card1.png',
    is_live: true,
    cta: 'Watch',
    sort_at: now,
  },
  {
    item_type: 'stream',
    id: 'demo-2',
    artist_id: 'demo-artist-2',
    title: 'MARCUS REID',
    image_url: '/demo/card2.png',
    is_live: false,
    cta: 'Watch',
    sort_at: now,
  },
  {
    item_type: 'event',
    id: 'demo-3',
    artist_id: 'demo-artist-3',
    title: 'JAMES COLE',
    image_url: '/demo/card3.png',
    is_live: false,
    cta: 'Get Ticket',
    sort_at: now,
  },
  {
    item_type: 'artist',
    id: 'demo-4',
    artist_id: 'demo-artist-4',
    title: 'DJ VANCE',
    image_url: '/demo/card4.png',
    is_live: true,
    cta: 'Join',
    sort_at: now,
  },
  {
    item_type: 'product',
    id: 'demo-5',
    artist_id: 'demo-artist-5',
    title: 'STREET LUXE',
    image_url: '/demo/card5.png',
    is_live: false,
    cta: 'Buy',
    sort_at: now,
  },
]
