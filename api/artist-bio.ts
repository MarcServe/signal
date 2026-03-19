/**
 * POST /api/artist-bio
 * Body: { action: "research", query } | { action: "polish", draft, display_name? }
 * Merged route to stay within Vercel Hobby serverless function limits.
 */
import { supabaseAdmin } from './_lib/supabase.js'

const UA = 'Signal/1.0 (artist bio; +https://github.com/MarcServe/signal)'
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

async function tryPerplexity(query: string): Promise<string | null> {
  const key = process.env.PERPLEXITY_API_KEY
  if (!key?.trim()) return null
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'You write a short neutral artist biography for a music app (2–4 sentences). Plain text only: no markdown, no links, no bullet points.',
          },
          {
            role: 'user',
            content: `Write a concise public bio for the musician or band named: "${query}". If this is not a real or notable act, say only that no verified public profile was found.`,
          },
        ],
        max_tokens: 280,
        temperature: 0.3,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text || text.length < 20) return null
    return text.slice(0, 1200)
  } catch {
    return null
  }
}

function truncateBio(text: string, max = 800): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '))
  return (last > 200 ? cut.slice(0, last + 1) : cut).trim() + '…'
}

async function tryWikipedia(query: string): Promise<string | null> {
  try {
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php')
    searchUrl.searchParams.set('action', 'query')
    searchUrl.searchParams.set('list', 'search')
    searchUrl.searchParams.set('srsearch', query)
    searchUrl.searchParams.set('srlimit', '1')
    searchUrl.searchParams.set('format', 'json')

    const sRes = await fetch(searchUrl.toString(), { headers: { 'User-Agent': UA } })
    if (!sRes.ok) return null
    const sJson = (await sRes.json()) as { query?: { search?: { title: string }[] } }
    const title = sJson.query?.search?.[0]?.title
    if (!title) return null

    const exUrl = new URL('https://en.wikipedia.org/w/api.php')
    exUrl.searchParams.set('action', 'query')
    exUrl.searchParams.set('prop', 'extracts')
    exUrl.searchParams.set('exintro', 'true')
    exUrl.searchParams.set('explaintext', 'true')
    exUrl.searchParams.set('titles', title)
    exUrl.searchParams.set('format', 'json')

    const eRes = await fetch(exUrl.toString(), { headers: { 'User-Agent': UA } })
    if (!eRes.ok) return null
    const eJson = (await eRes.json()) as {
      query?: { pages?: Record<string, { extract?: string }> }
    }
    const pages = eJson.query?.pages
    if (!pages) return null
    const first = Object.values(pages)[0]
    const extract = first?.extract?.trim()
    if (!extract || extract.length < 30) return null
    return truncateBio(extract)
  } catch {
    return null
  }
}

type Res = { status: (n: number) => { json: (o: object) => void }; setHeader: (a: string, b: string) => void }

async function handleResearch(
  req: { body?: { query?: string } },
  res: Res
): Promise<void> {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  if (!query || query.length > 200) {
    res.status(400).json({ error: 'query required (max 200 chars)' })
    return
  }

  let summary = await tryPerplexity(query)
  let source: 'perplexity' | 'wikipedia' | 'none' = summary ? 'perplexity' : 'none'

  if (!summary) {
    summary = await tryWikipedia(query)
    if (summary) source = 'wikipedia'
  }

  if (!summary) {
    res.status(200).json({
      summary: null,
      source: 'none',
      message:
        'No summary found. Add PERPLEXITY_API_KEY on the server for richer web results, or try a different spelling.',
    })
    return
  }

  res.status(200).json({ summary, source })
}

async function handlePolish(
  req: { body?: { draft?: string; display_name?: string } },
  res: Res
): Promise<void> {
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

export default async function handler(
  req: {
    method?: string
    body?: { action?: string; query?: string; draft?: string; display_name?: string }
    headers?: { authorization?: string }
  },
  res: Res
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

  const action = typeof req.body?.action === 'string' ? req.body.action.trim().toLowerCase() : ''
  if (action === 'research') {
    await handleResearch(req, res)
    return
  }
  if (action === 'polish') {
    await handlePolish(req, res)
    return
  }
  res.status(400).json({ error: 'Missing or invalid action. Use "research" or "polish".' })
}
