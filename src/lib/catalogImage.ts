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
