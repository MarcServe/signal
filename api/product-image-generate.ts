/**
 * POST /api/product-image-generate
 * Unified catalog imagery for products, membership tiers, and events (single Hobby-friendly route).
 *
 * Body (artist_id required; exactly one target id):
 * - { artist_id, product_id } — generate from product title/type (legacy)
 * - { artist_id, product_id | membership_id | event_id, creative_prompt? } — Gemini text-to-image from title + optional artist description
 * - { artist_id, product_id | membership_id | event_id, source_image_url } — clean / standardize an uploaded image (optional creative_prompt as extra notes)
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './_lib/supabase.js'
import {
  generateProductCoverWithGemini,
  enhanceCatalogImageWithGemini,
} from './_lib/geminiProductImage.js'

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

type Target = { kind: 'product' | 'membership' | 'event'; id: string; title: string; typeLabel: string }

export default async function handler(
  req: {
    method?: string
    body?: {
      artist_id?: string
      product_id?: string
      membership_id?: string
      event_id?: string
      creative_prompt?: string
      source_image_url?: string
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
  const {
    artist_id: artistId,
    product_id: productId,
    membership_id: membershipId,
    event_id: eventId,
    creative_prompt: creativePrompt,
    source_image_url: sourceImageUrl,
  } = req.body || {}

  const idCount = [productId, membershipId, eventId].filter(Boolean).length
  if (!artistId || idCount !== 1) {
    res.status(400).json({
      error: 'Provide artist_id and exactly one of product_id, membership_id, or event_id',
    })
    return
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database not configured' })
    return
  }

  const { data: artist, error: artistErr } = await supabaseAdmin
    .from('artists')
    .select('id, user_id')
    .eq('id', artistId)
    .single()
  if (artistErr || !artist || (artist as { user_id: string }).user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  let target: Target | null = null

  if (productId) {
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, title, type, artist_id')
      .eq('id', productId)
      .single()
    if (prodErr || !product || (product as { artist_id: string }).artist_id !== artistId) {
      res.status(404).json({ error: 'Product not found' })
      return
    }
    const row = product as { title: string; type: string }
    target = { kind: 'product', id: productId, title: row.title, typeLabel: row.type || 'merch' }
  } else if (membershipId) {
    const { data: m, error: mErr } = await supabaseAdmin
      .from('memberships')
      .select('id, title, artist_id')
      .eq('id', membershipId)
      .single()
    if (mErr || !m || (m as { artist_id: string }).artist_id !== artistId) {
      res.status(404).json({ error: 'Membership not found' })
      return
    }
    const row = m as { title: string }
    target = { kind: 'membership', id: membershipId, title: row.title, typeLabel: 'membership tier' }
  } else if (eventId) {
    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events')
      .select('id, title, artist_id')
      .eq('id', eventId)
      .single()
    if (evErr || !ev || (ev as { artist_id: string }).artist_id !== artistId) {
      res.status(404).json({ error: 'Event not found' })
      return
    }
    const row = ev as { title: string }
    target = { kind: 'event', id: eventId, title: row.title, typeLabel: 'live event' }
  }

  if (!target) {
    res.status(400).json({ error: 'Invalid target' })
    return
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey?.trim()) {
    res.status(400).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
    return
  }

  try {
    let imageBase64: string
    let mimeType: string

    const src = typeof sourceImageUrl === 'string' ? sourceImageUrl.trim() : ''
    if (src) {
      const { imageBase64: b64, mimeType: mt } = await enhanceCatalogImageWithGemini({
        apiKey: geminiKey,
        sourceImageUrl: src,
        userInstruction: typeof creativePrompt === 'string' ? creativePrompt : null,
      })
      imageBase64 = b64
      mimeType = mt
    } else {
      const brief = typeof creativePrompt === 'string' ? creativePrompt : null
      const { imageBase64: b64, mimeType: mt } = await generateProductCoverWithGemini({
        apiKey: geminiKey,
        title: target.title,
        productType: target.typeLabel,
        creativeBrief: brief,
      })
      imageBase64 = b64
      mimeType = mt
    }

    const buf = Buffer.from(imageBase64, 'base64')
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'

    let storagePath: string
    let table: 'products' | 'memberships' | 'events'
    if (target.kind === 'product') {
      storagePath = `product-covers/${artistId}/${target.id}-${randomUUID()}.${ext}`
      table = 'products'
    } else if (target.kind === 'membership') {
      storagePath = `membership-covers/${artistId}/${target.id}-${randomUUID()}.${ext}`
      table = 'memberships'
    } else {
      storagePath = `event-covers/${artistId}/${target.id}-${randomUUID()}.${ext}`
      table = 'events'
    }

    const { error: upErr } = await supabaseAdmin.storage.from('avatars').upload(storagePath, buf, {
      contentType: mimeType,
      upsert: true,
    })
    if (upErr) {
      res.status(500).json({ error: `Upload failed: ${upErr.message}` })
      return
    }
    const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(storagePath)
    const publicUrl = pub.publicUrl

    const now = new Date().toISOString()
    const patch =
      table === 'memberships'
        ? { image_url: publicUrl }
        : { image_url: publicUrl, updated_at: now }
    const { error: updErr } = await supabaseAdmin
      .from(table)
      .update(patch)
      .eq('id', target.id)
      .eq('artist_id', artistId)

    if (updErr) {
      res.status(500).json({ error: updErr.message })
      return
    }

    res.status(200).json({
      success: true,
      image_url: publicUrl,
      target: target.kind,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generation failed'
    res.status(502).json({ error: msg })
  }
}
