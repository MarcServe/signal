import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface PlatformSettings {
  id: string
  platform_fee_percent: number
  fee_free_until: string | null
  payout_schedule?: string | null
  payout_minimum_cents?: number | null
  webhook_url?: string | null
}

export function Admin() {
  const { profile, loading } = useAuth()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [feePercent, setFeePercent] = useState<string>('10')
  const [feeFreeUntil, setFeeFreeUntil] = useState<string>('')
  const [payoutSchedule, setPayoutSchedule] = useState<string>('manual')
  const [payoutMinimum, setPayoutMinimum] = useState<string>('1000')
  const [webhookUrl, setWebhookUrl] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.role !== 'admin') return
    supabase
      .from('platform_settings')
      .select('id, platform_fee_percent, fee_free_until, payout_schedule, payout_minimum_cents, webhook_url')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const d = data as PlatformSettings
          setSettings(d)
          setFeePercent(String(d.platform_fee_percent))
          setFeeFreeUntil(d.fee_free_until ? d.fee_free_until.slice(0, 10) : '')
          setPayoutSchedule(d.payout_schedule || 'manual')
          setPayoutMinimum(String(d.payout_minimum_cents ?? 1000))
          setWebhookUrl(d.webhook_url || '')
        }
      })
  }, [profile?.role])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings || profile?.role !== 'admin') return
    setSaving(true)
    setMessage(null)
    const percent = Math.min(100, Math.max(0, parseInt(feePercent, 10) || 0))
    const feeFree = feeFreeUntil ? new Date(feeFreeUntil + 'T23:59:59.999Z').toISOString() : null
    const payoutMin = Math.max(0, parseInt(payoutMinimum, 10) || 0)
    const { error } = await supabase
      .from('platform_settings')
      .update({
        platform_fee_percent: percent,
        fee_free_until: feeFree,
        payout_schedule: payoutSchedule,
        payout_minimum_cents: payoutMin,
        webhook_url: webhookUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
    setSaving(false)
    if (error) {
      setMessage('Failed to save: ' + error.message)
      return
    }
    setMessage('Saved.')
    setSettings((s) => (s ? { ...s, platform_fee_percent: percent, fee_free_until: feeFree, payout_schedule: payoutSchedule, payout_minimum_cents: payoutMin, webhook_url: webhookUrl.trim() || null } : null))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)]">
        <span className="text-[var(--signal-ink-muted)]">Loading…</span>
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-[var(--signal-white)]">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Platform settings
        </h1>
        <p className="text-sm text-[var(--signal-ink-muted)] mb-6">
          Configure platform fee, fee-free days (e.g. Signal Fridays), and payout rules.
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label htmlFor="fee_percent" className="block text-sm font-medium text-[var(--signal-ink)] mb-1">
              Platform fee (%)
            </label>
            <input
              id="fee_percent"
              type="number"
              min={0}
              max={100}
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              className="w-full rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-4 py-2 text-[var(--signal-ink)] focus:border-[var(--signal-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]"
            />
          </div>

          <div>
            <label htmlFor="fee_free_until" className="block text-sm font-medium text-[var(--signal-ink)] mb-1">
              Fee-free until (date) — e.g. Signal Friday
            </label>
            <input
              id="fee_free_until"
              type="date"
              value={feeFreeUntil}
              onChange={(e) => setFeeFreeUntil(e.target.value)}
              className="w-full rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-4 py-2 text-[var(--signal-ink)] focus:border-[var(--signal-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]"
            />
            <p className="mt-1 text-xs text-[var(--signal-ink-muted)]">
              If set, platform fee is 0 until end of this day (UTC).
            </p>
          </div>

          {message && (
            <p className={`text-sm ${message.startsWith('Failed') ? 'text-red-600' : 'text-[var(--signal-gold)]'}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[var(--signal-gold)] px-4 py-2 text-sm font-medium text-[var(--signal-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>

        <section className="mt-10 pt-6 border-t border-[var(--signal-silver-light)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Payout triggers
          </h2>
          <div className="space-y-2 mb-4">
            <label className="block text-sm text-[var(--signal-ink-muted)]">Schedule</label>
            <select value={payoutSchedule} onChange={(e) => setPayoutSchedule(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-4 py-2 text-sm">
              <option value="manual">Manual</option>
              <option value="weekly">Weekly</option>
              <option value="threshold">When balance &gt; minimum</option>
            </select>
            <label className="block text-sm text-[var(--signal-ink-muted)]">Minimum payout (cents)</label>
            <input type="number" min={0} value={payoutMinimum} onChange={(e) => setPayoutMinimum(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-4 py-2 text-sm" />
          </div>
          <p className="text-xs text-[var(--signal-ink-muted)]">Call POST /api/payouts-run (cron) to run payouts. Set CRON_SECRET in env.</p>
        </section>

        <section className="mt-10 pt-6 border-t border-[var(--signal-silver-light)]">
          <h2 className="text-lg font-medium text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Automation (n8n / Make)
          </h2>
          <input type="url" placeholder="Webhook URL" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full rounded-xl border border-[var(--signal-silver-light)] px-4 py-2 text-sm mb-2" />
          <p className="text-xs text-[var(--signal-ink-muted)]">Events (sale, subscription, stream_started) will POST to this URL.</p>
        </section>
      </div>
    </div>
  )
}
