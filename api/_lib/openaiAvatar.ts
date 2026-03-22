/**
 * Portrait enhancement via OpenAI Images edits (DALL·E 2) — fallback/alternative to Gemini.
 * Requires sharp: normalizes input to a square PNG for the edits API.
 */
import sharp from 'sharp'
import { buildAvatarEnhancePrompt } from './geminiAvatar.js'

export type OpenAIAvatarResult = {
  imageBase64: string
  mimeType: string
}

export async function enhancePortraitWithOpenAI(params: {
  apiKey: string
  sourceImageUrl: string
  userInstruction?: string | null
}): Promise<OpenAIAvatarResult> {
  const imgRes = await fetch(params.sourceImageUrl)
  if (!imgRes.ok) {
    throw new Error(`Failed to download source image (${imgRes.status})`)
  }
  const inputBuf = Buffer.from(await imgRes.arrayBuffer())
  const pngBuf = await sharp(inputBuf)
    .resize(1024, 1024, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer()

  const fullPrompt = buildAvatarEnhancePrompt(params.userInstruction ?? null)
  const prompt = fullPrompt.length > 950 ? `${fullPrompt.slice(0, 900)}…` : fullPrompt

  const form = new FormData()
  form.append('image', new Blob([new Uint8Array(pngBuf)], { type: 'image/png' }), 'portrait.png')
  form.append('prompt', prompt)
  form.append('n', '1')
  form.append('size', '1024x1024')
  form.append('response_format', 'b64_json')

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
  })

  const json = (await r.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>
    error?: { message?: string }
  }
  if (!r.ok) {
    throw new Error(json.error?.message || `OpenAI image edit failed (${r.status})`)
  }
  const first = json.data?.[0]
  if (first?.b64_json) {
    return { imageBase64: first.b64_json, mimeType: 'image/png' }
  }
  if (first?.url) {
    const u = await fetch(first.url)
    if (!u.ok) throw new Error('OpenAI returned image URL that could not be fetched')
    const mime = u.headers.get('content-type') || 'image/png'
    const buf = Buffer.from(await u.arrayBuffer())
    return { imageBase64: buf.toString('base64'), mimeType: mime }
  }
  throw new Error('OpenAI returned no image data')
}
