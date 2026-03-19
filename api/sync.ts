/**
 * GET /api/sync — lightweight health: `{ ok: true, service: 'signal-api' }` (no auth).
 * POST /api/sync — sync catalogue from Bandcamp / Apple Music / Shopify. Reads credentials from integrations or env.
 * Body: { artist_id, service: 'bandcamp'|'apple_music'|'shopify' }
 * Headers: Authorization: Bearer <jwt>
 */
import { supabaseAdmin } from './lib/supabase.js'

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
  req: { method?: string; body?: { artist_id?: string; service?: string }; headers?: { authorization?: string } },
  res: { status: (n: number) => { json: (o: object) => void }; setHeader: (a: string, b: string) => void }
): Promise<void> {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'signal-api' })
    return
  }
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
  const { artist_id, service } = req.body || {}
  if (!artist_id || !service) {
    res.status(400).json({ error: 'Missing artist_id or service' })
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
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('id, api_key, metadata')
    .eq('artist_id', artist_id)
    .eq('service_name', service)
    .maybeSingle()
  if (!integration && !process.env[`${service.toUpperCase().replace(' ', '_')}_CLIENT_ID`]) {
    res.status(400).json({ error: `Connect ${service} first or set env credentials` })
    return
  }
  // Placeholder: in production, call Bandcamp/Apple Music/Shopify APIs and upsert tracks + products
  const tracksSynced = 0
  const productsSynced = 0
  await supabaseAdmin
    .from('integrations')
    .update({ last_sync_at: new Date().toISOString(), metadata: { last_counts: { tracks: tracksSynced, products: productsSynced } } })
    .eq('artist_id', artist_id)
    .eq('service_name', service)
  res.status(200).json({ success: true, tracks: tracksSynced, products: productsSynced })
}
