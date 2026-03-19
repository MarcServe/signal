/**
 * Gemini native image (Nano Banana) — portrait enhancement for artist avatars.
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */

/** Strong default model; override with GEMINI_IMAGE_MODEL (e.g. gemini-3.1-flash-image-preview). */
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'

/**
 * Optimized for: identity preservation, premium streamer/DJ avatars, Signal’s luxury minimal aesthetic.
 * Tuned for gemini-2.5-flash-image / gemini-3.x image models (text + image → image).
 */
export const GEMINI_AVATAR_ENHANCE_PROMPT = `ROLE: You are an elite retoucher for premium live-streaming artist profiles (DJs, musicians, performers).

INPUT: One reference photograph of a real person.

TASK — ENHANCEMENT ONLY (not recreation):
Produce a single polished, broadcast-ready profile portrait. Improve technical and aesthetic quality while keeping the subject unmistakably the same person.

IDENTITY — NON-NEGOTIABLE:
- Preserve the same individual: facial structure, eyes, nose, mouth, jaw, skin tone, hairline, hairstyle and hair color, apparent age, and gender presentation.
- Do not face-swap, “AI beautify” into a different person, or merge with stock faces. No synthetic replacement faces.

VISUAL DIRECTION:
- Lighting: soft studio-style portrait lighting — gentle key, subtle fill, mild rim if it helps separation; natural catchlights; eliminate harsh phone-flash or muddy shadows.
- Color: accurate, healthy skin; correct white balance; tasteful contrast; optional very subtle cinematic grade (warm highlights, neutral shadows) — never heavy or neon.
- Detail: reduce noise; gently clarify eyes and hair; avoid plastic skin, waxy smoothing, or oversharpening halos.
- Background: if cluttered or low-quality, replace with a clean premium field — smooth gradient from warm ivory to soft pearl gray, or delicate neutral bokeh. Subject must read clearly at small avatar size.
- Framing: head and upper shoulders, centered, with comfortable headroom for circular crops (keep eyes roughly in the upper third).

BRAND MOOD (abstract only — no logos or text):
- Luxury, minimal, confident — think high-end editorial or keynote speaker portrait. White / gold / silver sophistication without adding objects or typography.

STRICTLY FORBIDDEN:
- Cartoon, anime, 3D character, heavy Instagram filters, morphing ethnicity or age, extra fingers or limbs, duplicated faces, watermarks, captions, or any on-image text.

OUTPUT:
Return exactly one photorealistic square (1:1) portrait suitable as a circular avatar on a music and live-streaming platform.`

export type GeminiEnhanceResult = {
  imageBase64: string
  mimeType: string
}

function getInlineImageFromResponse(data: unknown): GeminiEnhanceResult | null {
  const root = data as {
    candidates?: Array<{
      content?: { parts?: Array<Record<string, unknown>> }
      finishReason?: string
    }>
    error?: { message?: string; code?: number }
  }

  if (root.error?.message) {
    throw new Error(`Gemini API: ${root.error.message}`)
  }

  const parts = root.candidates?.[0]?.content?.parts
  if (!parts?.length) {
    return null
  }

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

/**
 * Fetches the source image, calls Gemini image model, returns base64 + mime of the enhanced image.
 */
export async function enhancePortraitWithGemini(params: {
  apiKey: string
  sourceImageUrl: string
  model?: string
  prompt?: string
}): Promise<GeminiEnhanceResult> {
  const { apiKey, sourceImageUrl, model = DEFAULT_GEMINI_IMAGE_MODEL, prompt = GEMINI_AVATAR_ENHANCE_PROMPT } = params

  const imgRes = await fetch(sourceImageUrl)
  if (!imgRes.ok) {
    throw new Error(`Could not download source image (${imgRes.status})`)
  }
  const mimeType =
    imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const base64 = buf.toString('base64')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const isGemini3Image = /gemini-3/i.test(model)
  const imageConfig: Record<string, string> = { aspectRatio: '1:1' }
  if (isGemini3Image) {
    imageConfig.imageSize = process.env.GEMINI_IMAGE_SIZE || '1K'
  }

  // REST JSON uses camelCase field names (inlineData, mimeType) per Google Generative Language API.
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
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
      'x-goog-api-key': apiKey,
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

  const extracted = getInlineImageFromResponse(json)
  if (!extracted) {
    throw new Error('Gemini did not return an image. Try a different photo or model (GEMINI_IMAGE_MODEL).')
  }

  return extracted
}
