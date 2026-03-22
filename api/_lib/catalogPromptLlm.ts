/**
 * Text-only LLM helpers: turn artist descriptions into stronger image prompts,
 * and tailor “clean & standardize” directions per catalog item.
 * Uses OpenAI Chat Completions when OPENAI_API_KEY is available, else Gemini Flash text.
 */

function pickTextProvider(openaiKey?: string | null, geminiKey?: string | null): 'openai' | 'gemini' | null {
  if (openaiKey?.trim()) return 'openai'
  if (geminiKey?.trim()) return 'gemini'
  return null
}

async function openaiChat(system: string, user: string, apiKey: string): Promise<string> {
  const model = process.env.CATALOG_LLM_MODEL?.trim() || 'gpt-4o-mini'
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  })
  const json = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  if (!r.ok) throw new Error(json.error?.message || `OpenAI chat failed (${r.status})`)
  const c = json.choices?.[0]?.message?.content?.trim()
  if (!c) throw new Error('OpenAI returned empty text')
  return c
}

function extractGeminiText(data: unknown): string {
  const root = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  }
  if (root.error?.message) throw new Error(`Gemini: ${root.error.message}`)
  const parts = root.candidates?.[0]?.content?.parts
  const texts = parts?.map((p) => p.text).filter(Boolean) as string[] | undefined
  const joined = texts?.join('\n').trim()
  if (!joined) throw new Error('Gemini returned empty text')
  return joined
}

async function geminiText(system: string, user: string, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_TEXT_MODEL?.trim() || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const combined = `${system}\n\n---\n\n${user}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: combined }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
    }),
  })
  const raw = await r.text()
  let json: unknown
  try {
    json = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(`Gemini text API non-JSON (${r.status}): ${raw.slice(0, 160)}`)
  }
  if (!r.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message || raw.slice(0, 200)
    throw new Error(`Gemini text failed (${r.status}): ${msg}`)
  }
  return extractGeminiText(json)
}

async function runTextLlm(
  system: string,
  user: string,
  openaiKey?: string | null,
  geminiKey?: string | null
): Promise<string> {
  const which = pickTextProvider(openaiKey, geminiKey)
  if (which === 'openai' && openaiKey) return openaiChat(system, user, openaiKey)
  if (which === 'gemini' && geminiKey) return geminiText(system, user, geminiKey)
  throw new Error('No LLM API key for text refinement')
}

const GEN_SYSTEM = `You write concise, vivid directions for AI image models (DALL·E 3 and Gemini) used on a luxury independent-music commerce app.

Rules:
- Output plain English only: one or two short paragraphs, no markdown, no quotes, no bullet lists.
- The image model must not render readable text, logos, watermarks, or real celebrity faces.
- Respect the catalog aspect intent: products and membership tiers are portrait-leaning card art; events are wide cinematic banners.
- When the artist gives a description, that description is the primary creative direction; the item title is supporting context.`

const ENHANCE_SYSTEM = `You write short extra art-direction for an image-to-image “clean and standardize” step on a luxury music platform.

The retouch model already knows to: preserve the subject, improve lighting, premium neutral background if messy, no text/logos.

Your job: add specific guidance for THIS item (title + category) and any artist notes — mood, palette, materials, venue energy, tier vibe, etc.

Output plain text only, max ~500 characters, one tight paragraph, no markdown.`

export async function refineCatalogGenerationPrompt(params: {
  catalogKind: 'product' | 'membership' | 'event'
  title: string
  typeLabel: string
  artistDescription: string
  openaiKey?: string | null
  geminiKey?: string | null
}): Promise<string> {
  const raw = params.artistDescription.trim()
  if (!raw) return ''

  const aspectHint =
    params.catalogKind === 'event'
      ? 'Target use: wide 16:9 event / show hero.'
      : 'Target use: portrait catalog card (~3:4).'

  const user = `Item title: ${params.title}
Category / type: ${params.typeLabel}
Catalog kind: ${params.catalogKind}
${aspectHint}

Artist description (main creative direction):
${raw.slice(0, 2000)}

Rewrite and expand this into focused visual direction for a single hero image. Stay within the platform rules.`

  const out = await runTextLlm(GEN_SYSTEM, user, params.openaiKey, params.geminiKey)
  return out.slice(0, 2000)
}

export async function refineCatalogEnhanceNotes(params: {
  catalogKind: 'product' | 'membership' | 'event'
  title: string
  typeLabel: string
  userNotes?: string | null
  openaiKey?: string | null
  geminiKey?: string | null
}): Promise<string> {
  const notes = params.userNotes?.trim() || ''

  const user = `Item title: ${params.title}
Category: ${params.typeLabel}
Catalog kind: ${params.catalogKind}
Artist extra notes (may be empty): ${notes || '(none)'}

Write the extra retouching direction paragraph.`

  const out = await runTextLlm(ENHANCE_SYSTEM, user, params.openaiKey, params.geminiKey)
  return out.slice(0, 800)
}
