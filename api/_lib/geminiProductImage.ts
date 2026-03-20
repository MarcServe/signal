/**
 * Text-to-image product cover for merch / tickets (Gemini native image).
 */
import { DEFAULT_GEMINI_IMAGE_MODEL } from './geminiAvatar.js'

export type GeminiProductImageResult = {
  imageBase64: string
  mimeType: string
}

function parseGeminiImageResponse(data: unknown): GeminiProductImageResult | null {
  const root = data as {
    candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>
    error?: { message?: string }
  }
  if (root.error?.message) {
    throw new Error(`Gemini API: ${root.error.message}`)
  }
  const parts = root.candidates?.[0]?.content?.parts
  if (!parts?.length) return null
  for (const part of parts) {
    const inline =
      (part.inlineData as { mimeType?: string; data?: string } | undefined) ??
      (part.inline_data as { mime_type?: string; mimeType?: string; data?: string } | undefined)
    if (inline?.data && typeof inline.data === 'string') {
      const mime =
        (inline as { mimeType?: string; mime_type?: string }).mimeType ??
        (inline as { mime_type?: string }).mime_type ??
        'image/png'
      return { imageBase64: inline.data, mimeType: mime }
    }
  }
  return null
}

const CATALOG_ENHANCE_PORTRAIT = `ROLE: Elite e-commerce and editorial retoucher for a luxury music and live platform.

INPUT: One reference image (product photo, merch flat-lay, membership tier visual, or promotional still).

TASK: Output ONE cleaned, standardized catalog hero image (portrait 3:4) for grid cards.

RULES:
- Preserve the subject and overall composition; do not swap in a different product or use a different person.
- Studio-quality lighting: soft, even, tasteful shadows; correct white balance and exposure.
- Reduce noise; apply natural surface smoothing; crisp edges without halos — no plastic HDR or waxy skin.
- If the background is messy, replace with a premium neutral field (ivory → warm gray gradient or subtle bokeh).
- No readable text, logos, or watermarks. Do not add typography.
- Luxury minimal mood: white / gold / silver sophistication.

OUTPUT: One photorealistic or high-end render, 3:4 aspect, suitable for shop and profile sections.`

const CATALOG_ENHANCE_WIDE = `ROLE: Elite editorial retoucher for a luxury music and live platform.

INPUT: One reference image (event flyer, venue photo, or wide promotional still).

TASK: Output ONE cleaned, standardized wide hero image (16:9 landscape) for event / live schedule cards.

RULES:
- Preserve the subject; do not replace with unrelated imagery. Center the main subject for safe cropping.
- Cinematic wide composition; premium lighting; no readable text, logos, or watermarks.
- If background is messy, use a tasteful gradient or soft bokeh suitable for a concert / club mood.

OUTPUT: One photorealistic or high-end render, 16:9 landscape, suitable for event banners.`

/**
 * Generate a single catalog-style image from title + type, optionally steered by the artist's written brief.
 */
export async function generateProductCoverWithGemini(params: {
  apiKey: string
  title: string
  productType?: string
  model?: string
  /** Artist's description of what to show (colors, vibe, product shape, etc.). */
  creativeBrief?: string | null
  /** Event posters need 16:9 to match UI cards; products/memberships use 3:4. */
  catalogKind?: 'product' | 'membership' | 'event'
}): Promise<GeminiProductImageResult> {
  const model = params.model || process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL
  const typeLabel = params.productType || 'merch'
  const brief = params.creativeBrief?.trim()
  const isEvent = params.catalogKind === 'event'

  const briefBlock = brief
    ? `

ARTIST DIRECTION (follow closely while keeping rules below):
${brief.slice(0, 1200)}`
    : ''

  const prompt = isEvent
    ? `Create one premium wide event / live-show hero image for an independent music artist.

Event: "${params.title}" (live event).${briefBlock}

Visual direction:
- 16:9 landscape, cinematic — venue energy, lighting, crowd silhouette, or abstract stage mood (no readable text, no logos, no watermarks).
- Fits an "upcoming show" card: strong focal subject centered for crop safety, premium club / warehouse / festival aesthetic.
- Photorealistic or high-end render; luxury minimal palette (ivory, gold accents, deep shadows ok).`
    : `Create one premium e-commerce / catalog hero image for an independent music artist.

Item: "${params.title}" (category: ${typeLabel}).${briefBlock}

Visual direction:
- Luxury, minimal, editorial — ivory / warm gray / soft gold mood. Clean studio lighting, soft shadows.
- Suggest a believable physical or digital subject that fits the title and any artist direction above (apparel, vinyl, ticket aesthetic, accessory, abstract premium packshot, or tier perk visual). No readable text, no logos, no watermarks, no celebrity faces.
- Single centered subject, portrait 3:4 framing suitable for a shop or membership grid card.
- Photorealistic or high-end 3D render quality; not cartoon, not cluttered background.`

  const isGemini3Image = /gemini-3/i.test(model)
  const imageConfig: Record<string, string> = { aspectRatio: isEvent ? '16:9' : '3:4' }
  if (isGemini3Image) {
    imageConfig.imageSize = process.env.GEMINI_IMAGE_SIZE || '1K'
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig,
    },
  }

  const genRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.apiKey,
    },
    body: JSON.stringify(body),
  })

  const rawText = await genRes.text()
  let json: unknown
  try {
    json = rawText ? JSON.parse(rawText) : {}
  } catch {
    throw new Error(`Gemini returned non-JSON (${genRes.status}): ${rawText.slice(0, 200)}`)
  }

  if (!genRes.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message || rawText.slice(0, 300)
    throw new Error(`Gemini request failed (${genRes.status}): ${msg}`)
  }

  const extracted = parseGeminiImageResponse(json)
  if (!extracted) {
    throw new Error('Gemini did not return an image. Try again or upload your own photo.')
  }

  return extracted
}

/**
 * Standardize / clean an uploaded catalog image (products, tiers, events) while preserving the subject.
 */
export async function enhanceCatalogImageWithGemini(params: {
  apiKey: string
  sourceImageUrl: string
  model?: string
  userInstruction?: string | null
  /** Match card aspect: events use 16:9 wide; products/memberships 3:4. */
  aspectRatio?: '3:4' | '16:9'
}): Promise<GeminiProductImageResult> {
  const model = params.model || process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL
  const imgRes = await fetch(params.sourceImageUrl)
  if (!imgRes.ok) {
    throw new Error(`Could not download source image (${imgRes.status})`)
  }
  const mimeTypeIn =
    imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const base64 = buf.toString('base64')

  const extra = params.userInstruction?.trim()
    ? `

ADDITIONAL USER NOTES (apply if compatible with rules above):
${params.userInstruction.trim().slice(0, 800)}`
    : ''

  const wide = params.aspectRatio === '16:9'
  const prompt = `${wide ? CATALOG_ENHANCE_WIDE : CATALOG_ENHANCE_PORTRAIT}${extra}`

  const isGemini3Image = /gemini-3/i.test(model)
  const imageConfig: Record<string, string> = { aspectRatio: wide ? '16:9' : '3:4' }
  if (isGemini3Image) {
    imageConfig.imageSize = process.env.GEMINI_IMAGE_SIZE || '1K'
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeTypeIn,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig,
    },
  }

  const genRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.apiKey,
    },
    body: JSON.stringify(body),
  })

  const rawText = await genRes.text()
  let json: unknown
  try {
    json = rawText ? JSON.parse(rawText) : {}
  } catch {
    throw new Error(`Gemini returned non-JSON (${genRes.status}): ${rawText.slice(0, 200)}`)
  }

  if (!genRes.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message || rawText.slice(0, 300)
    throw new Error(`Gemini request failed (${genRes.status}): ${msg}`)
  }

  const extracted = parseGeminiImageResponse(json)
  if (!extracted) {
    throw new Error('The image service did not return an image. Try another photo or a simpler description.')
  }

  return extracted
}
