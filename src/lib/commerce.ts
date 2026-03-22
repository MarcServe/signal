/**
 * Commerce layer: in-stream and feed purchases.
 * MVP: mock checkout. Replace with Stripe/Stripe Connect for production.
 * Platform fee from platform_settings; zero when fee_free_until is in the future.
 */

import { supabase } from './supabase'

export interface CheckoutItem {
  /** Null for membership / PPV mock rows that are not tied to a product row. */
  productId: string | null
  artistId: string
  title: string
  amountCents: number
  type: 'merch' | 'ticket' | 'membership' | 'track' | 'ppv'
}

async function getPlatformFeePercent(): Promise<number> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('platform_fee_percent, fee_free_until')
    .limit(1)
    .single()
  if (error || !data) return 10
  const row = data as { platform_fee_percent: number; fee_free_until: string | null }
  const now = new Date().toISOString()
  if (row.fee_free_until && now < row.fee_free_until) return 0
  return row.platform_fee_percent ?? 10
}

function computeFee(amountCents: number, feePercent: number): { platformFeeCents: number; artistPayoutCents: number } {
  const platformFeeCents = Math.round((amountCents * feePercent) / 100)
  return { platformFeeCents, artistPayoutCents: amountCents - platformFeeCents }
}

export async function createMockPurchase(
  userId: string,
  item: CheckoutItem
): Promise<{ success: boolean; error?: string }> {
  const feePercent = await getPlatformFeePercent()
  const { platformFeeCents, artistPayoutCents } = computeFee(item.amountCents, feePercent)
  const txType =
    item.type === 'track' || item.type === 'merch' || item.type === 'ppv'
      ? 'purchase'
      : item.type === 'ticket'
        ? 'ticket'
        : item.type === 'membership'
          ? 'subscription'
          : 'purchase'
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    artist_id: item.artistId,
    type: txType,
    product_id: item.productId,
    amount_cents: item.amountCents,
    platform_fee_cents: platformFeeCents,
    artist_payout_cents: artistPayoutCents,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Create a tip transaction (no product). Applies same platform fee logic. */
export async function createMockTip(
  userId: string,
  artistId: string,
  amountCents: number
): Promise<{ success: boolean; error?: string }> {
  const feePercent = await getPlatformFeePercent()
  const { platformFeeCents, artistPayoutCents } = computeFee(amountCents, feePercent)
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    artist_id: artistId,
    type: 'tip',
    product_id: null,
    amount_cents: amountCents,
    platform_fee_cents: platformFeeCents,
    artist_payout_cents: artistPayoutCents,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Placeholder for Stripe Connect: create checkout session for artist payout. */
export function getStripeCheckoutUrl(_item: CheckoutItem): string | null {
  return null
}
