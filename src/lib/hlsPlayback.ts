/**
 * HLS playback URLs for Node-Media-Server style paths:
 *   {base}/live/{stream_key}/index.m3u8
 *
 * - Dashboard: suggest base from VITE_HLS_BASE_URL, or http://127.0.0.1:8000 in dev.
 * - LiveView: use saved streams.playback_url, or the same constructed URL when a base is available.
 * - Production: loopback/private playback_url values (saved from local dev) are ignored so fans never hit 127.0.0.1.
 */

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

/**
 * Loopback / RFC1918 hosts are fine in local dev but break when fans load the production app
 * (browser cannot reach the artist’s laptop). URLs saved from dev often land in shared Supabase DBs.
 */
export function isLanOrLoopbackPlaybackUrl(urlStr: string): boolean {
  const t = urlStr.trim()
  if (!t) return false
  try {
    const u = new URL(t)
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true
    if (h.endsWith('.localhost')) return true
    if (/^10\./.test(h)) return true
    if (/^192\.168\./.test(h)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true
    return false
  } catch {
    return false
  }
}

/**
 * RTMP ingest URL shown in Dashboard → Go live (OBS “Server”).
 * Dev: matches local `npm run rtmp` (port 1935, app name `live`).
 * Production: set `VITE_RTMP_URL` on the host that runs ingest.
 */
export function getRtmpIngestUrl(): string {
  const raw = (import.meta as ImportMeta & { env?: { VITE_RTMP_URL?: string } }).env?.VITE_RTMP_URL
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (trimmed) return trimmed
  if (import.meta.env.DEV) return 'rtmp://127.0.0.1:1935/live'
  return 'rtmp://your-server/live'
}

/**
 * HLS server root for building playlist URLs.
 * Production: set VITE_HLS_BASE_URL (no localhost default).
 * Dev: defaults to http://127.0.0.1:8000 (Node-Media-Server HTTP).
 */
export function getHlsBaseUrl(): string {
  const raw = (import.meta as ImportMeta & { env?: { VITE_HLS_BASE_URL?: string } }).env?.VITE_HLS_BASE_URL
  const trimmed = typeof raw === 'string' ? trimTrailingSlash(raw.trim()) : ''
  if (trimmed) return trimmed
  if (import.meta.env.DEV) return 'http://127.0.0.1:8000'
  return ''
}

/** RTMP/HLS path segment: custom `stream_key` if set, else stream row UUID. */
export function rtmpStreamSegment(stream: { id: string; stream_key?: string | null }): string {
  const k = stream.stream_key?.trim()
  return k || stream.id
}

/**
 * HLS playlist URL for Node-Media-Server: {base}/live/{rtmpSegment}/index.m3u8
 * `rtmpSegment` is the OBS stream key (custom or UUID).
 */
export function buildHlsPlaylistUrl(rtmpSegment: string, base?: string): string | null {
  const b = base !== undefined ? base : getHlsBaseUrl()
  const seg = rtmpSegment.trim()
  if (!b || !seg) return null
  return `${b}/live/${seg}/index.m3u8`
}

/** Validate OBS / RTMP stream name (conservative; NMS is permissive). */
export function normalizeRtmpStreamKeyInput(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const t = raw.trim()
  if (!t) return { ok: true, value: null }
  if (t.length > 128) return { ok: false, error: 'Stream key must be at most 128 characters.' }
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) {
    return { ok: false, error: 'Use only letters, numbers, underscores, and hyphens.' }
  }
  return { ok: true, value: t }
}

/** Prefer DB value; otherwise construct from env using custom key or stream id. */
export function resolveStreamPlaybackUrl(stream: {
  id: string
  playback_url: string | null
  stream_key?: string | null
}): string | null {
  const stored = stream.playback_url?.trim()
  if (stored) {
    const allowStored = import.meta.env.DEV || !isLanOrLoopbackPlaybackUrl(stored)
    if (allowStored) return stored
  }
  const base = getHlsBaseUrl()
  if (!base) return null
  const seg = rtmpStreamSegment(stream)
  return `${base}/live/${seg}/index.m3u8`
}
