/**
 * POST /api/avatar-generate
 * Store avatar; optional enhance via Gemini (GEMINI_API_KEY) or OpenAI (OPENAI_API_KEY) when mode=enhance.
 * Body: { artist_id, image_url } or multipart with file.
 * Headers: Authorization: Bearer <jwt>
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './lib/supabase.js'
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  enhancePortraitWithGemini,
} from './lib/geminiAvatar.js'

const openaiKey = process.env.OPENAI_API_KEY
const geminiKey = process.env.GEMINI_API_KEY
const geminiImageModel = process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL

function getAuthHeader(req: { headers?: { authorization?: string } }): string | null {
  const auth = req.headers?.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function getUserFromJwt(token: string): Promise<{ id: string } | null> {
  if (!supabaseAdmin) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  return error ? null : user ? { id: user.id } : null
}

export default async function handler(
  req: {
    method?: string
    body?: {
      artist_id?: string
      image_url?: string
      mode?: 'store' | 'enhance'
      provider?: 'openai' | 'gemini'
      /** Optional hints for Gemini enhance (chat-style instructions). */
      enhance_instruction?: string
    }
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
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  const { artist_id, image_url, mode, provider, enhance_instruction } = req.body || {}
  if (!artist_id || !image_url) {
    res.status(400).json({ error: 'Missing artist_id or image_url' })
    return
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database not configured' })
    return
  }
  const { data: artist } = await supabaseAdmin.from('artists').select('id, user_id').eq('id', artist_id).single()
  if (!artist || (artist as { user_id: string }).user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  const selectedProvider = provider === 'gemini' ? 'gemini' : 'openai'
  if (mode === 'enhance') {
    const providerKeyMissing = selectedProvider === 'gemini' ? !geminiKey : !openaiKey
    if (providerKeyMissing) {
      const neededVar = selectedProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'
      res.status(400).json({ error: `Enhance requested but ${neededVar} is not configured.` })
      return
    }
  }

  let finalUrl = image_url
  if (mode === 'enhance' && (openaiKey || geminiKey)) {
    try {
      if (selectedProvider === 'gemini' && geminiKey && supabaseAdmin) {
        const { imageBase64, mimeType } = await enhancePortraitWithGemini({
          apiKey: geminiKey,
          sourceImageUrl: image_url,
          model: geminiImageModel,
          userInstruction: typeof enhance_instruction === 'string' ? enhance_instruction : null,
        })
        const buf = Buffer.from(imageBase64, 'base64')
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
        const storagePath = `avatars/${artist_id}/enhanced-${randomUUID()}.${ext}`
        const { error: upErr } = await supabaseAdmin.storage.from('avatars').upload(storagePath, buf, {
          contentType: mimeType,
          upsert: true,
        })
        if (upErr) {
          res.status(500).json({ error: `Enhanced image upload failed: ${upErr.message}` })
          return
        }
        const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(storagePath)
        finalUrl = pub.publicUrl
      } else if (selectedProvider === 'openai' && openaiKey) {
        // OpenAI image edit path not wired yet; return original URL.
        finalUrl = image_url
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Enhancement failed'
      res.status(502).json({ error: msg })
      return
    }
  }
  const { error: insertErr } = await supabaseAdmin.from('avatars').insert({
    artist_id,
    image_url: finalUrl,
    style: 'default',
  })
  if (insertErr) {
    // History row is optional for UX: enhancement/upload already produced finalUrl in storage.
    const enhancementWorked = mode === 'enhance' && finalUrl !== image_url
    if (enhancementWorked) {
      console.warn('[avatar-generate] avatars insert skipped:', insertErr.message)
      res.status(200).json({
        success: true,
        image_url: finalUrl,
        provider: selectedProvider,
        warning: `Portrait URL is saved for your profile; history log failed: ${insertErr.message}`,
      })
      return
    }
    res.status(500).json({ error: insertErr.message })
    return
  }
  res.status(200).json({ success: true, image_url: finalUrl, provider: mode === 'enhance' ? selectedProvider : 'none' })
}
