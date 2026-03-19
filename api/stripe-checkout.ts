/**
 * POST /api/stripe-checkout
 * Create Stripe Checkout Session for one-off purchase or subscription.
 * Body: { artist_id, item_type: 'track'|'ticket'|'membership'|'ppv', item_id?, membership_id?, success_url, cancel_url }
 * Headers: Authorization: Bearer <supabase_jwt>
 * Returns: { url } to redirect to Stripe Checkout.
 */
import Stripe from 'stripe'
import { supabaseAdmin } from './_lib/supabase.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' }) : null
const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:5173'

function getAuthHeader(req: { headers?: { authorization?: string } }): string | null {
  const auth = req.headers?.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function getUserFromJwt(token: string): Promise<{ id: string; email?: string } | null> {
  if (!supabaseAdmin) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  return error ? null : user ? { id: user.id, email: user.email } : null
}

export default async function handler(
  req: { method?: string; body?: { artist_id?: string; item_type?: string; item_id?: string; membership_id?: string; success_url?: string; cancel_url?: string }; headers?: { authorization?: string } },
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
  const { artist_id, item_type, item_id, membership_id, success_url, cancel_url } = req.body || {}
  const allowed = ['track', 'ticket', 'membership', 'ppv']
  if (!artist_id || !item_type || !allowed.includes(item_type)) {
    res.status(400).json({ error: 'Missing or invalid artist_id / item_type (track|ticket|membership|ppv)' })
    return
  }
  if (!stripe || !supabaseAdmin) {
    res.status(503).json({ error: 'Stripe or database not configured' })
    return
  }

  const success = success_url || `${appUrl}/dashboard`
  const cancel = cancel_url || `${appUrl}/`

  const { data: artist } = await supabaseAdmin.from('artists').select('id, stripe_account_id, stripe_onboarding_complete').eq('id', artist_id).single()
  if (!artist || !(artist as { stripe_onboarding_complete: boolean }).stripe_onboarding_complete) {
    res.status(400).json({ error: 'Artist has not completed Stripe Connect onboarding' })
    return
  }
  const stripeAccountId = (artist as { stripe_account_id: string }).stripe_account_id
  if (!stripeAccountId) {
    res.status(400).json({ error: 'Artist Stripe account not linked' })
    return
  }

  let amountCents = item_type === 'ppv' ? 499 : 999
  let productName = item_type === 'ppv' ? 'Pay per view' : item_type
  if (item_type === 'membership' && membership_id) {
    const { data: m } = await supabaseAdmin.from('memberships').select('title, price_cents').eq('id', membership_id).single()
    if (m) {
      amountCents = (m as { price_cents: number }).price_cents
      productName = (m as { title: string }).title
    }
  } else if (item_id) {
    const { data: p } = await supabaseAdmin.from('products').select('title, price_cents').eq('id', item_id).single()
    if (p) {
      amountCents = Math.round((((p as { price_cents: number })?.price_cents) || 999))
      productName = (p as { title: string }).title || productName
    }
  }

  const platformFeePercent = 10
  const applicationFeeAmount = Math.round(amountCents * (platformFeePercent / 100))

  const session = await stripe.checkout.sessions.create({
    mode: item_type === 'membership' ? 'subscription' : 'payment',
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', unit_amount: amountCents, product_data: { name: productName } }, quantity: 1 }],
    success_url: success,
    cancel_url: cancel,
    client_reference_id: JSON.stringify({ user_id: user.id, artist_id, item_type, item_id: item_id || null, membership_id: membership_id || null }),
    customer_email: user.email || undefined,
    payment_intent_data: stripeAccountId
      ? { application_fee_amount: applicationFeeAmount, transfer_data: { destination: stripeAccountId } }
      : undefined,
    metadata: { artist_id, item_type, user_id: user.id },
  })

  res.status(200).json({ url: session.url })
}
