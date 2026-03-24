import type { FeedItem } from '../types/feed'

/** Homepage 5 cards use images from public/demo/ (saved in repo for reuse). */
const now = new Date().toISOString()
const bump = (ms: number) => new Date(Date.now() + ms).toISOString()

/**
 * Mixed demo destinations: live (YouTube samples in `demoStreams.ts`) vs artist profile.
 * DJ KRUST (`demo-1`) uses `link_path: '/dashboard'` so the tile opens the signed-in user’s Studio (demo pitch),
 * not the YouTube stand-in live player. Other demo streams still use `/live/demo-*`.
 */
export const DEMO_FEED_ITEMS: FeedItem[] = [
  {
    item_type: 'stream',
    id: 'demo-1',
    artist_id: 'demo-artist-1',
    title: 'DJ KRUST',
    image_url: '/demo/card1.png',
    is_live: false,
    cta: 'Open studio',
    link_path: '/dashboard',
    sort_at: bump(0),
  },
  {
    item_type: 'artist',
    id: 'demo-2',
    artist_id: 'demo-artist-2',
    title: 'MARCUS REID',
    image_url: '/demo/card2.png',
    is_live: false,
    cta: 'View profile',
    sort_at: bump(1000),
  },
  {
    item_type: 'stream',
    id: 'demo-3',
    artist_id: 'demo-artist-3',
    title: 'JAMES COLE',
    image_url: '/demo/card3.png',
    is_live: true,
    cta: 'Watch live',
    sort_at: bump(2000),
  },
  {
    item_type: 'artist',
    id: 'demo-4',
    artist_id: 'demo-artist-4',
    title: 'DJ VANCE',
    image_url: '/demo/card4.png',
    is_live: false,
    cta: 'View profile',
    sort_at: bump(3000),
  },
  {
    item_type: 'stream',
    id: 'demo-5',
    artist_id: 'demo-artist-5',
    title: 'STREET LUXE',
    image_url: '/demo/card5.png',
    is_live: true,
    cta: 'Watch live',
    sort_at: bump(4000),
  },
]
