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

/**
 * Generate a single catalog-style product image from title + type (no reference photo).
 */
export async function generateProductCoverWithGemini(params: {
  apiKey: string
  title: string
  productType?: string
  model?: string
}): Promise<GeminiProductImageResult> {
  const model = params.model || process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL
  const typeLabel = params.productType || 'merch'

  const prompt = `Create one premium e-commerce product hero image for an independent music artist.

Product: "${params.title}" (category: ${typeLabel}).

Visual direction:
- Luxury, minimal, editorial — ivory / warm gray / soft gold mood. Clean studio lighting, soft shadows.
- Suggest a believable physical or digital product that fits the title (apparel, vinyl, ticket aesthetic, accessory, or abstract premium packshot). No readable text, no logos, no watermarks, no celebrity faces.
- Single centered subject, portrait 3:4 framing suitable for a shop grid card.
- Photorealistic or high-end 3D render quality; not cartoon, not cluttered background.`

  const isGemini3Image = /gemini-3/i.test(model)
  const imageConfig: Record<string, string> = { aspectRatio: '3:4' }
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
