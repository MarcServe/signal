/**
 * Remove Perplexity / Wikipedia-style numeric reference tails: [1], [1][3][4], etc.
 */
export function stripCitationMarkers(text: string): string {
  if (typeof text !== 'string' || !text.trim()) return text
  let t = text.replace(/(?:\[\d+\])+/g, '')
  t = t.replace(/\[\d+(?:,\s*\d+)*\]/g, '')
  t = t.replace(/\s+([.,;:])/g, '$1')
  t = t.replace(/\s{2,}/g, ' ').trim()
  return t
}
