/**
 * POST /api/product-image-generate
 * Body: { product_id, artist_id } — generates a cover image with Gemini, uploads to storage, updates products.image_url
 * Requires GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, bucket "avatars" (path product-covers/…)
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './lib/supabase.js'
import { generateProductCoverWithGemini } from './lib/geminiProductImage.js'

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

export default async function handler(
  req: {
    method?: string
    body?: { product_id?: string; artist_id?: string }
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
  const productId = req.body?.product_id
  const artistId = req.body?.artist_id
  if (!productId || !artistId) {
    res.status(400).json({ error: 'Missing product_id or artist_id' })
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

  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('id, title, type, artist_id')
    .eq('id', productId)
    .single()
  if (prodErr || !product || (product as { artist_id: string }).artist_id !== artistId) {
    res.status(404).json({ error: 'Product not found' })
    return
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey?.trim()) {
    res.status(400).json({ error: 'GEMINI_API_KEY is not configured on the server.' })
    return
  }

  const row = product as { title: string; type: string }
  try {
    const { imageBase64, mimeType } = await generateProductCoverWithGemini({
      apiKey: geminiKey,
      title: row.title,
      productType: row.type,
    })
    const buf = Buffer.from(imageBase64, 'base64')
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const storagePath = `product-covers/${artistId}/${productId}-${randomUUID()}.${ext}`
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

    const { error: updErr } = await supabaseAdmin
      .from('products')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('artist_id', artistId)

    if (updErr) {
      res.status(500).json({ error: updErr.message })
      return
    }

    res.status(200).json({ success: true, image_url: publicUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generation failed'
    res.status(502).json({ error: msg })
  }
}
