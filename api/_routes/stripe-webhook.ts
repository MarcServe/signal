/**
 * POST /api/stripe-webhook
 * Stripe webhook. Configure in Stripe Dashboard to point to APP_URL/api/stripe-webhook.
 * Requires raw body for signature verification; do not parse body before calling.
 */
import Stripe from 'stripe'
import { supabaseAdmin } from '../_lib/supabase.js'
import { emitEvent } from '../_lib/automation.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' }) : null
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

async function readBody(req: { on?: (e: string, c: (chunk: Buffer) => void) => void }): Promise<string> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    req.on?.('data', (chunk: Buffer) => chunks.push(chunk))
    req.on?.('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on?.('error', reject)
  })
}

export default async function handler(
  req: { method?: string; headers?: { 'stripe-signature'?: string }; on?: (e: string, c: (chunk: Buffer) => void) => void },
  res: { status: (n: number) => { end: () => void; json: (o: object) => void }; setHeader: (a: string, b: string) => void }
): Promise<void> {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  if (!stripe || !webhookSecret || !supabaseAdmin) {
    res.status(503).json({ error: 'Not configured' })
    return
  }
  const sig = req.headers?.['stripe-signature']
  if (!sig) {
    res.status(400).json({ error: 'No signature' })
    return
  }
  const rawBody = await readBody(req)
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
    return
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const ref = session.client_reference_id
      if (!ref) break
      let meta: { user_id?: string; artist_id?: string; item_type?: string; item_id?: string | null; membership_id?: string | null }
      try {
        meta = JSON.parse(ref)
      } catch {
        break
      }
      const { user_id, artist_id, item_type } = meta
      if (!user_id || !artist_id) break
      const amountCents = session.amount_total ?? 0
      await supabaseAdmin.from('transactions').insert({
        user_id,
        artist_id,
        type: item_type === 'membership' ? 'subscription' : item_type === 'ticket' ? 'ticket' : 'purchase',
        product_id: meta.item_id || null,
        amount_cents: amountCents,
        stripe_payment_id: session.payment_intent as string || session.id,
      })
      const { data: ps } = await supabaseAdmin.from('platform_settings').select('webhook_url').limit(1).single()
      const webhookUrl = (ps as { webhook_url?: string } | null)?.webhook_url
      await emitEvent({ event: 'sale', artist_id, user_id, amount_cents: amountCents, product_id: meta.item_id || undefined }, webhookUrl)
      if (item_type === 'membership' && meta.membership_id) {
        await supabaseAdmin.from('subscriptions').upsert({
          user_id,
          artist_id,
          membership_id: meta.membership_id,
          status: 'active',
          stripe_subscription_id: session.subscription as string || null,
        }, { onConflict: 'user_id,artist_id' })
        await emitEvent({ event: 'subscription', artist_id, user_id, membership_id: meta.membership_id }, webhookUrl)
      }
      break
    }
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      if (account.charges_enabled) {
        await supabaseAdmin.from('artists').update({ stripe_onboarding_complete: true }).eq('stripe_account_id', account.id)
      }
      break
    }
    default:
      break
  }

  res.status(200).json({ received: true })
}
