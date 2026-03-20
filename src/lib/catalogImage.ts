export type CatalogKind = 'product' | 'membership' | 'event'

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
