/**
 * POST /api/payouts-run
 * Run payout job: transfer artist balances to Stripe Connect accounts. Call from cron (e.g. Vercel Cron or external).
 * Optional: Authorization header with a cron secret to protect the endpoint.
 */
import Stripe from 'stripe'
import { supabaseAdmin } from '../_lib/supabase.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' }) : null
const CRON_SECRET = process.env.CRON_SECRET

export default async function handler(
  req: { method?: string; headers?: { authorization?: string } },
  res: { status: (n: number) => { json: (o: object) => void }; setHeader: (a: string, b: string) => void }
): Promise<void> {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (CRON_SECRET && req.headers?.authorization !== `Bearer ${CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!stripe || !supabaseAdmin) {
    res.status(503).json({ error: 'Payouts or database not configured' })
    return
  }
  const { data: settings } = await supabaseAdmin.from('platform_settings').select('payout_schedule, payout_minimum_cents').limit(1).single()
  const minCents = (settings as { payout_minimum_cents?: number })?.payout_minimum_cents ?? 1000
  const schedule = (settings as { payout_schedule?: string })?.payout_schedule
  if (schedule === 'manual') {
    res.status(200).json({ message: 'Payouts are manual' })
    return
  }
  const { data: artists } = await supabaseAdmin.from('artists').select('id, stripe_account_id, stripe_onboarding_complete').not('stripe_account_id', 'is', null)
  const results: { artist_id: string; amount_cents: number; status: string }[] = []
  for (const a of artists || []) {
    const row = a as { id: string; stripe_account_id: string; stripe_onboarding_complete: boolean }
    if (!row.stripe_onboarding_complete) continue
    const { data: txs } = await supabaseAdmin.from('transactions').select('amount_cents, artist_payout_cents').eq('artist_id', row.id)
    const { data: paid } = await supabaseAdmin.from('payout_runs').select('amount_cents').eq('artist_id', row.id).eq('status', 'completed')
    const totalEarned = (txs || []).reduce((s, t) => s + ((t as { artist_payout_cents?: number }).artist_payout_cents ?? (t as { amount_cents: number }).amount_cents), 0)
    const totalPaid = (paid || []).reduce((s, p) => s + (p as { amount_cents: number }).amount_cents, 0)
    const balance = totalEarned - totalPaid
    if (balance < minCents) continue
    try {
      const transfer = await stripe.transfers.create({
        amount: balance,
        currency: 'usd',
        destination: row.stripe_account_id,
      })
      await supabaseAdmin.from('payout_runs').insert({
        artist_id: row.id,
        amount_cents: balance,
        status: 'completed',
        stripe_transfer_id: transfer.id,
      })
      results.push({ artist_id: row.id, amount_cents: balance, status: 'completed' })
    } catch (e) {
      results.push({ artist_id: row.id, amount_cents: balance, status: 'failed' })
    }
  }
  const { data: ps } = await supabaseAdmin.from('platform_settings').select('id').limit(1).single()
  if (ps) await supabaseAdmin.from('platform_settings').update({ payout_last_run_at: new Date().toISOString() }).eq('id', (ps as { id: string }).id)
  res.status(200).json({ ran: true, results })
}
