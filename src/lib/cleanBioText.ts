/**
 * Remove Perplexity / Wikipedia-style numeric reference tails: [1], [1][3][4], etc.
 * Keep in sync with api/_lib/stripCitationMarkers.ts
 */
export function stripCitationMarkers(text: string): string {
  if (typeof text !== 'string' || !text.trim()) return text
  let t = text.replace(/(?:\[\d+\])+/g, '')
  t = t.replace(/\[\d+(?:,\s*\d+)*\]/g, '')
  t = t.replace(/\s+([.,;:])/g, '$1')
  t = t.replace(/\s{2,}/g, ' ').trim()
  return t
}

/** Lowercase slug for artists.handle; empty → null (clears handle in DB). */
export function normalizePublicHandle(raw: string): string | null {
  const s = raw.trim().replace(/^@+/, '').toLowerCase()
  if (!s) return null
  const slug = s.replace(/[^a-z0-9_]/g, '').slice(0, 32)
  return slug.length ? slug : null
}
