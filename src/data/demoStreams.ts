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

/**
 * Sample YouTube VODs as stand-ins for “live” demo tiles (card art stays local).
 * Order matches demo-1 … demo-5. Production streams use real `playback_url` + HLS from the DB.
 */
const DEMO_YOUTUBE_BY_STREAM_ID: Record<string, string> = {
  'demo-1': '5__WNEAWIAg',
  'demo-3': 'sy0nNu7p7-g',
  'demo-5': 'dxfWIa8PQ0w',
}

function youtubePlaybackUrl(streamId: string): string | null {
  const id = DEMO_YOUTUBE_BY_STREAM_ID[streamId]
  return id ? `youtube:${id}` : null
}

function buildDemoStreams(): Record<string, DemoStreamData> {
  const byStreamId: Record<string, DemoStreamData> = {}
  const streamItems = DEMO_FEED_ITEMS.filter(
    (i) => i.item_type === 'stream' && i.id.startsWith('demo-')
  )
  for (const item of streamItems) {
    const profile = DEMO_ARTIST_PROFILES[item.artist_id]
    const isLive = item.is_live
    const yt = youtubePlaybackUrl(item.id)
    byStreamId[item.id] = {
      id: item.id,
      title: item.title,
      playback_url: isLive && yt ? yt : null,
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
  (i) => i.item_type === 'stream' && i.id.startsWith('demo-') && i.is_live
)
  .map((i) => i.id)
  .sort((a, b) => {
    const na = parseInt(a.replace('demo-', ''), 10)
    const nb = parseInt(b.replace('demo-', ''), 10)
    return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0)
  })
