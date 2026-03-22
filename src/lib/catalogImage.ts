import { apiUrl } from './api'

export type CatalogKind = 'product' | 'membership' | 'event'

/**
 * Turn a failed `fetch` to `/api/product-image-generate` into a clear UI string.
 * Vercel returns HTML 404 when a serverless route is missing; our handler returns JSON with `{ error }`.
 */
export function formatCatalogImageApiFailure(res: Response, rawBody: string): string {
  const trimmed = rawBody.trim()
  const looksLikeHtml = trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html')
  if (res.status === 404 && (looksLikeHtml || trimmed === '')) {
    const check = apiUrl('/sync')
    return `Image API returned 404 (route not found). Open ${check} in a new tab — you should see JSON with "ok": true. If that 404s too, set Vercel → Settings → General → Root Directory to the repo folder that contains the top-level api/ directory, then redeploy.`
  }
  try {
    if (trimmed) {
      const j = JSON.parse(trimmed) as { error?: string; code?: string }
      if (res.status === 404 && j.code === 'API_ROUTE') {
        return 'Image API routing failed on the server (deployment or build). Redeploy the latest main, or confirm Vercel Root Directory includes the top-level api/ folder.'
      }
      if (typeof j.error === 'string' && j.error.trim()) return j.error.trim()
    }
  } catch {
    /* ignore */
  }
  return trimmed ? trimmed.slice(0, 280) : `HTTP ${res.status}`
}

/** Body for POST `/api/product-image-generate` (matches Dashboard + Quick add). */
export function catalogImagePayload(
  artistId: string,
  kind: CatalogKind,
  id: string,
  extra?: { creative_prompt?: string; source_image_url?: string }
): Record<string, string> {
  const base: Record<string, string> = { artist_id: artistId }
  if (extra?.creative_prompt?.trim()) base.creative_prompt = extra.creative_prompt.trim().slice(0, 1200)
  if (extra?.source_image_url?.trim()) base.source_image_url = extra.source_image_url.trim()
  if (kind === 'product') base.product_id = id
  else if (kind === 'membership') base.membership_id = id
  else base.event_id = id
  return base
}

/**
 * Catalog cards (product / event / membership): show the item’s image when set;
 * otherwise fall back to the artist portrait (same idea as demo artists using card art).
 */
export function catalogCardImageUrl(
  imageUrl: string | null | undefined,
  artistPortraitUrl: string | null | undefined
): string | null {
  const item = typeof imageUrl === 'string' ? imageUrl.trim() : ''
  if (item) return item
  const portrait = typeof artistPortraitUrl === 'string' ? artistPortraitUrl.trim() : ''
  return portrait || null
}
