/**
 * POST /api/artist-bio-polish
 * Body: { draft: string, display_name?: string }
 * Refines the artist's own notes into a short public bio via Gemini (no Wikipedia / web lookup).
 * Requires GEMINI_API_KEY. Optional GEMINI_TEXT_MODEL (default gemini-2.0-flash).
 */
import { supabaseAdmin } from './lib/supabase.js'

const DEFAULT_TEXT_MODEL = 'gemini-2.0-flash'

function getAuthHeader(req: { headers?: { authorization?: string } }): string | null {
  const auth = req.headers?.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function getUserFromJwt(token: string): Promise<{ id: string } | null> {
  if (!supabaseAdmin) return null
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)
  return error ? null : user ? { id: user.id } : null
}

export default async function handler(
  req: {
    method?: string
    body?: { draft?: string; display_name?: string }
    headers?: { authorization?: string }
  },
  res: { status: (n: number) => { json: (o: object) => void }; setHeader: (a: string, b: string) => void }
): Promise<void> {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const token = getAuthHeader(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const user = await getUserFromJwt(token)
  if (!user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const draft = typeof req.body?.draft === 'string' ? req.body.draft.trim() : ''
  if (draft.length < 8) {
    res.status(400).json({ error: 'Add a few words in the box first (your own notes are enough).' })
    return
  }
  if (draft.length > 4000) {
    res.status(400).json({ error: 'Draft too long (max 4000 characters).' })
    return
  }

  const key = process.env.GEMINI_API_KEY
  if (!key?.trim()) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not set on the server. Add it to .env for refine.',
    })
    return
  }

  const model = process.env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL
  const displayName =
    typeof req.body?.display_name === 'string' ? req.body.display_name.trim().slice(0, 120) : ''

  const context = displayName ? `Name / project (context only, do not repeat as a title): ${displayName}\n\n` : ''

  const prompt = `${context}The artist wrote these rough notes for their public profile:

---
${draft}
---

Rewrite as one cohesive "About" blurb of 2–4 sentences for a high-end music and live platform.

Rules:
- Tone: calm, professional, understated — never salesy, cute, or "AI-sounding". No emojis, hashtags, markdown, or bullet lists.
- Use only what the notes reasonably support. Do not invent record deals, chart positions, famous venues, press quotes, or collaborators not mentioned.
- If the notes are very sparse, write a minimal dignified intro (genre/mood/role) without fabricating biography.
- Plain text only, single paragraph.`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.35,
        },
      }),
    })
    const gJson = (await gRes.json()) as {
      error?: { message?: string }
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    if (!gRes.ok) {
      res.status(502).json({
        error: gJson.error?.message ?? `Gemini request failed (${gRes.status})`,
      })
      return
    }
    const text = gJson.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim()
    if (!text || text.length < 20) {
      res.status(502).json({ error: 'No usable text returned. Try again or edit manually.' })
      return
    }
    res.status(200).json({ text: text.slice(0, 2000), source: 'gemini' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Polish failed'
    res.status(502).json({ error: msg })
  }
}
