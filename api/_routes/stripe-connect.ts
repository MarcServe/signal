/**
 * POST /api/stripe-connect
 * Create Stripe Connect account link for an artist. Requires auth and artist ownership.
 * Body: { artist_id, return_url, refresh_url }
 * Returns: { url } to redirect the user to Stripe onboarding.
 */
import Stripe from 'stripe'
import { supabaseAdmin } from '../_lib/supabase.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' }) : null

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

export default async function handler(req: { method?: string; body?: { artist_id?: string; return_url?: string; refresh_url?: string }; headers?: { authorization?: string } }, res: { status: (n: number) => { json: (o: object) => void }; setHeader: (a: string, b: string) => void }): Promise<void> {
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
  const { artist_id, return_url, refresh_url } = req.body || {}
  if (!artist_id || !return_url || !refresh_url) {
    res.status(400).json({ error: 'Missing artist_id, return_url, or refresh_url' })
    return
  }
  if (!stripe) {
    res.status(503).json({ error: 'Card payouts are not configured on the server yet.' })
    return
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database not configured' })
    return
  }
  const { data: artist, error: artistErr } = await supabaseAdmin
    .from('artists')
    .select('id, user_id, stripe_account_id')
    .eq('id', artist_id)
    .single()
  if (artistErr || !artist || (artist as { user_id: string }).user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  const row = artist as { id: string; user_id: string; stripe_account_id: string | null }
  let accountId = row.stripe_account_id
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
    })
    accountId = account.id
    await supabaseAdmin.from('artists').update({ stripe_account_id: accountId }).eq('id', artist_id)
  }
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    return_url: return_url,
    refresh_url: refresh_url,
    type: 'account_onboarding',
  })
  res.status(200).json({ url: accountLink.url })
}
