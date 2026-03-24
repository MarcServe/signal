/**
 * Detect YouTube video id from demo / optional DB `playback_url` values.
 * Supports:
 * - `youtube:VIDEO_ID` (demo mock streams)
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
export function getYoutubeVideoIdFromPlayback(playbackUrl: string | null | undefined): string | null {
  const s = playbackUrl?.trim()
  if (!s) return null
  if (s.startsWith('youtube:')) {
    const id = s.slice('youtube:'.length).split(/[?&#]/)[0]?.trim()
    return id || null
  }
  try {
    const u = new URL(s)
    const h = u.hostname.toLowerCase()
    if (h === 'youtu.be') {
      return u.pathname.replace(/^\//, '').split('/')[0] || null
    }
    if (h === 'www.youtube.com' || h === 'youtube.com' || h === 'm.youtube.com') {
      const v = u.searchParams.get('v')
      if (v) return v
      const embed = u.pathname.match(/\/embed\/([^/]+)/)
      if (embed?.[1]) return embed[1]
      const shorts = u.pathname.match(/\/shorts\/([^/]+)/)
      if (shorts?.[1]) return shorts[1]
    }
  } catch {
    /* ignore */
  }
  return null
}
