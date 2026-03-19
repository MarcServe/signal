import { DEMO_FEED_ITEMS } from './demoFeed'
import { DEMO_ARTIST_PROFILES } from './demoArtists'

/** Mock stream + artist + avatar for demo stream IDs (e.g. demo-1, demo-2). Used by LiveView when DB has no stream. */

export interface DemoStreamData {
  id: string
  title: string | null
  playback_url: string | null
  artist_id: string
  is_live: boolean
  display_name: string
  avatar_url: string | null
  avatar_image_url: string | null
}

/** Sample HLS/MP4 for demo (Big Buck Bunny public domain). */
const DEMO_PLAYBACK_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

function buildDemoStreams(): Record<string, DemoStreamData> {
  const byStreamId: Record<string, DemoStreamData> = {}
  // Include both stream and artist cards so we have multiple demo streams to cycle (e.g. demo-1, demo-2)
  const streamItems = DEMO_FEED_ITEMS.filter(
    (i) => (i.item_type === 'stream' || i.item_type === 'artist') && i.id.startsWith('demo-')
  )
  for (const item of streamItems) {
    const profile = DEMO_ARTIST_PROFILES[item.artist_id]
    const isLive = item.item_type === 'stream' ? item.is_live : !!item.is_live
    byStreamId[item.id] = {
      id: item.id,
      title: item.title,
      playback_url: isLive ? DEMO_PLAYBACK_URL : DEMO_PLAYBACK_URL,
      artist_id: item.artist_id,
      is_live: isLive,
      display_name: profile?.display_name ?? item.title,
      avatar_url: profile?.avatar_url ?? item.image_url ?? null,
      avatar_image_url: profile?.avatar_url ?? item.image_url ?? null,
    }
  }
  return byStreamId
}

export const DEMO_STREAMS: Record<string, DemoStreamData> = buildDemoStreams()

export function getDemoStream(streamId: string): DemoStreamData | null {
  return DEMO_STREAMS[streamId] ?? null
}

/** Ordered demo stream IDs for prev/next cycling in LiveView. */
export const DEMO_STREAM_IDS: string[] = DEMO_FEED_ITEMS.filter(
  (i) => (i.item_type === 'stream' || i.item_type === 'artist') && i.id.startsWith('demo-')
).map((i) => i.id)
