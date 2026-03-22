/**
 * Catalog cover generation / enhancement via OpenAI (DALL·E 3 + DALL·E 2 edits).
 */
import sharp from 'sharp'

export type OpenAICatalogResult = { imageBase64: string; mimeType: string }

function buildGeneratePrompt(params: {
  title: string
  typeLabel: string
  creativeBrief?: string | null
  catalogKind: 'product' | 'membership' | 'event'
}): string {
  const brief = params.creativeBrief?.trim()
  const briefBlock = brief ? ` Artist direction: ${brief.slice(0, 800)}.` : ''
  if (params.catalogKind === 'event') {
    return `Premium wide cinematic event hero for "${params.title}". 16:9 landscape mood — venue, stage light, crowd energy. No text, logos, or watermarks. Photorealistic, luxury minimal palette.${briefBlock}`
  }
  return `Premium vertical catalog hero for "${params.title}" (${params.typeLabel}) on a luxury music platform. Portrait 3:4 composition. No text, logos, or watermarks. Photorealistic, ivory and gold sophistication.${briefBlock}`
}

const ENHANCE_PORTRAIT = `Clean, standardize this catalog image for an e-commerce card (3:4). Preserve the product/subject. Soft studio lighting, premium neutral background if messy. No text or logos.`

const ENHANCE_WIDE = `Clean, standardize this wide image for an event banner (16:9). Preserve the main subject. Cinematic lighting, no text or logos.`

export async function generateProductCoverWithOpenAI(params: {
  apiKey: string
  title: string
  productType?: string
  creativeBrief?: string | null
  catalogKind: 'product' | 'membership' | 'event'
}): Promise<OpenAICatalogResult> {
  const prompt = buildGeneratePrompt({
    title: params.title,
    typeLabel: params.productType || 'item',
    creativeBrief: params.creativeBrief,
    catalogKind: params.catalogKind,
  }).slice(0, 3900)

  const size = params.catalogKind === 'event' ? '1792x1024' : '1024x1792'

  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      response_format: 'b64_json',
      quality: 'standard',
    }),
  })
  const json = (await r.json()) as {
    data?: Array<{ b64_json?: string }>
    error?: { message?: string }
  }
  if (!r.ok) throw new Error(json.error?.message || `OpenAI generations failed (${r.status})`)
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI returned no image')
  return { imageBase64: b64, mimeType: 'image/png' }
}

export async function enhanceCatalogImageWithOpenAI(params: {
  apiKey: string
  sourceImageUrl: string
  userInstruction?: string | null
  aspectRatio: '3:4' | '16:9'
}): Promise<OpenAICatalogResult> {
  const imgRes = await fetch(params.sourceImageUrl)
  if (!imgRes.ok) throw new Error(`Failed to download source image (${imgRes.status})`)
  const inputBuf = Buffer.from(await imgRes.arrayBuffer())
  // DALL·E 2 edits API only allows 256 / 512 / 1024 squares — normalize then crop displays as 3:4 / 16:9 in UI.
  const pngBuf = await sharp(inputBuf)
    .resize(1024, 1024, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer()

  let prompt = params.aspectRatio === '16:9' ? ENHANCE_WIDE : ENHANCE_PORTRAIT
  const extra = params.userInstruction?.trim()
  if (extra) prompt = `${prompt} ${extra.slice(0, 400)}`
  prompt = prompt.slice(0, 1000)

  const form = new FormData()
  form.append('image', new Blob([new Uint8Array(pngBuf)], { type: 'image/png' }), 'catalog.png')
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
    data?: Array<{ b64_json?: string }>
    error?: { message?: string }
  }
  if (!r.ok) throw new Error(json.error?.message || `OpenAI catalog edit failed (${r.status})`)
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI returned no edited image')
  return { imageBase64: b64, mimeType: 'image/png' }
}
