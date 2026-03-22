/**
 * Reusable checkout drawer: one-off purchase or subscription; uses card checkout when configured.
 */
import { useState } from 'react'
import { apiUrl, getSession } from '../lib/api'
import { supabase } from '../lib/supabase'
import { createMockPurchase } from '../lib/commerce'

export type CheckoutType = 'track' | 'ticket' | 'membership' | 'ppv'

export interface CheckoutDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  type: CheckoutType
  artistId: string
  itemId?: string
  membershipId?: string
  amountCents?: number
  onSuccess?: () => void
}

export function CheckoutDrawer({
  open,
  onClose,
  title,
  type,
  artistId,
  itemId,
  membershipId,
  amountCents = 999,
  onSuccess,
}: CheckoutDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStripeCheckout = async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getSession()
      if (!session) {
        setError('Sign in to continue')
        setLoading(false)
        return
      }
      const res = await fetch(apiUrl('/stripe-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          artist_id: artistId,
          item_type: type === 'ppv' ? 'ppv' : type,
          item_id: type === 'track' || type === 'ticket' ? itemId : undefined,
          membership_id: type === 'membership' ? membershipId : undefined,
          success_url: window.location.href,
          cancel_url: window.location.pathname,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Checkout failed')
        setLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError('No checkout URL returned')
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const handleMock = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('Sign in to complete checkout')
        setLoading(false)
        return
      }
      const uid = session.user.id

      if (type === 'track' || type === 'ticket') {
        if (!itemId) {
          setError('No product selected')
          setLoading(false)
          return
        }
        const res = await createMockPurchase(uid, {
          productId: itemId,
          artistId,
          title,
          amountCents,
          type,
        })
        if (!res.success) {
          setError(res.error || 'Mock checkout failed')
          setLoading(false)
          return
        }
      } else if (type === 'membership') {
        if (!membershipId) {
          setError('No membership tier selected')
          setLoading(false)
          return
        }
        const res = await createMockPurchase(uid, {
          productId: null,
          artistId,
          title,
          amountCents,
          type: 'membership',
        })
        if (!res.success) {
          setError(res.error || 'Mock checkout failed')
          setLoading(false)
          return
        }
      } else if (type === 'ppv') {
        const res = await createMockPurchase(uid, {
          productId: null,
          artistId,
          title,
          amountCents,
          type: 'ppv',
        })
        if (!res.success) {
          setError(res.error || 'Mock checkout failed')
          setLoading(false)
          return
        }
      }

      onSuccess?.()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[var(--signal-white-pure)] rounded-t-2xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <p className="text-sm text-[var(--signal-ink-muted)] mb-4">
          ${(amountCents / 100).toFixed(2)} — Pay securely with card.
        </p>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleStripeCheckout}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-[var(--signal-gold)] text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Redirecting…' : 'Pay with card'}
          </button>
          <button
            type="button"
            onClick={() => void handleMock()}
            disabled={loading}
            className="px-4 py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink-muted)] text-sm disabled:opacity-50"
          >
            {loading ? '…' : 'Mock'}
          </button>
        </div>
        <button type="button" onClick={onClose} className="w-full py-2 mt-2 text-sm text-[var(--signal-ink-muted)]">
          Cancel
        </button>
      </div>
    </div>
  )
}
