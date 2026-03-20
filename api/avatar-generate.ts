/**
 * POST /api/avatar-generate
 * Store avatar; optional enhance via Gemini (GEMINI_API_KEY) or OpenAI (OPENAI_API_KEY) when mode=enhance.
 * Body: { artist_id, image_url, mode?, provider?, enhance_instruction? }
 * provider: 'openai' | 'gemini' — if omitted, prefers OPENAI when set, else Gemini.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './_lib/supabase.js'
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  enhancePortraitWithGemini,
} from './_lib/geminiAvatar.js'
import { enhancePortraitWithOpenAI } from './_lib/openaiAvatar.js'

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

function resolveEnhanceProvider(
  explicit: string | undefined
): 'openai' | 'gemini' {
  if (explicit === 'gemini') {
    if (geminiKey) return 'gemini'
    if (openaiKey) return 'openai'
    return 'gemini'
  }
  if (explicit === 'openai') {
    if (openaiKey) return 'openai'
    if (geminiKey) return 'gemini'
    return 'openai'
  }
  const pref = process.env.PREFERRED_AVATAR_ENHANCE_PROVIDER?.trim().toLowerCase()
  if (pref === 'gemini' && geminiKey) return 'gemini'
  if (pref === 'openai' && openaiKey) return 'openai'
  if (openaiKey) return 'openai'
  if (geminiKey) return 'gemini'
  return 'openai'
}

export default async function handler(
  req: {
    method?: string
    body?: {
      artist_id?: string
      image_url?: string
      mode?: 'store' | 'enhance'
      provider?: 'openai' | 'gemini'
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

  const selectedProvider = mode === 'enhance' ? resolveEnhanceProvider(provider) : 'openai'
  if (mode === 'enhance') {
    const hasKey = selectedProvider === 'gemini' ? !!geminiKey?.trim() : !!openaiKey?.trim()
    if (!hasKey) {
      res.status(400).json({
        error:
          'Portrait enhancement is not configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY on the server.',
      })
      return
    }
  }

  let finalUrl = image_url
  if (mode === 'enhance' && (openaiKey || geminiKey)) {
    try {
      const instr = typeof enhance_instruction === 'string' ? enhance_instruction : null
      if (selectedProvider === 'gemini' && geminiKey) {
        const { imageBase64, mimeType } = await enhancePortraitWithGemini({
          apiKey: geminiKey,
          sourceImageUrl: image_url,
          model: geminiImageModel,
          userInstruction: instr,
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
        const { imageBase64, mimeType } = await enhancePortraitWithOpenAI({
          apiKey: openaiKey,
          sourceImageUrl: image_url,
          userInstruction: instr,
        })
        const buf = Buffer.from(imageBase64, 'base64')
        const ext = mimeType.includes('png') ? 'png' : 'jpg'
        const storagePath = `avatars/${artist_id}/enhanced-openai-${randomUUID()}.${ext}`
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
    console.warn('[avatar-generate] avatars insert skipped:', insertErr.message)
    res.status(200).json({
      success: true,
      image_url: finalUrl,
      provider: mode === 'enhance' ? selectedProvider : 'none',
      warning: `Image URL is ok; history log failed: ${insertErr.message}`,
    })
    return
  }
  res.status(200).json({ success: true, image_url: finalUrl, provider: mode === 'enhance' ? selectedProvider : 'none' })
}
