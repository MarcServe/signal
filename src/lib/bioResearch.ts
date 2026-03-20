import { apiUrl, getSession } from './api'
import { stripCitationMarkers } from './cleanBioText'

export type BioResearchResult =
  | { ok: true; summary: string; source: 'perplexity' | 'wikipedia' }
  | { ok: true; summary: null; source: 'none'; message?: string }
  | { ok: false; error: string }

/** Calls POST /api/artist-bio with action research (web sources when configured). */
export async function fetchArtistBioFromWeb(query: string): Promise<BioResearchResult> {
  const q = query.trim()
  if (!q) return { ok: false, error: 'Enter a name to look up.' }
  const session = await getSession()
  if (!session) return { ok: false, error: 'Session expired. Sign in again.' }
  try {
    const res = await fetch(apiUrl('/artist-bio'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'research', query: q }),
    })
    const data = (await res.json()) as {
      summary?: string | null
      source?: string
      message?: string
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Request failed (${res.status})` }
    }
    if (data.summary && (data.source === 'perplexity' || data.source === 'wikipedia')) {
      return { ok: true, summary: stripCitationMarkers(data.summary), source: data.source }
    }
    return { ok: true, summary: null, source: 'none', message: data.message }
  } catch {
    return { ok: false, error: 'Could not reach the research service. Try again in a moment.' }
  }
}

export type BioPolishResult = { ok: true; text: string } | { ok: false; error: string }

/** Refines the artist's draft with AI — no web lookup. */
export async function polishArtistBioDraft(draft: string, displayName?: string): Promise<BioPolishResult> {
  const d = draft.trim()
  if (d.length < 8) return { ok: false, error: 'Write a few words first — rough notes are fine.' }
  const session = await getSession()
  if (!session) return { ok: false, error: 'Session expired. Sign in again.' }
  try {
    const res = await fetch(apiUrl('/artist-bio'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'polish',
        draft: d,
        display_name: displayName?.trim() || undefined,
      }),
    })
    const data = (await res.json()) as { text?: string; error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Request failed (${res.status})` }
    }
    if (!data.text?.trim()) {
      return { ok: false, error: 'Empty response. Try again.' }
    }
    return { ok: true, text: stripCitationMarkers(data.text.trim()) }
  } catch {
    return { ok: false, error: 'Could not reach the writing assistant. Try again in a moment.' }
  }
}
