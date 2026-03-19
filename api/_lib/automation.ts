/**
 * Emit events to n8n/Make webhooks. Set N8N_WEBHOOK_URL or platform_settings.webhook_url.
 */
const N8N = process.env.N8N_WEBHOOK_URL
const MAKE = process.env.MAKE_WEBHOOK_URL

export type AutomationEvent =
  | { event: 'sale'; artist_id: string; user_id: string; amount_cents: number; product_id?: string }
  | { event: 'subscription'; artist_id: string; user_id: string; membership_id?: string }
  | { event: 'stream_started'; artist_id: string; stream_id: string }
  | { event: 'stream_ended'; artist_id: string; stream_id: string }

async function post(url: string, payload: AutomationEvent): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, at: new Date().toISOString() }),
    })
  } catch (e) {
    console.warn('Automation webhook failed:', (e as Error).message)
  }
}

export async function emitEvent(payload: AutomationEvent, webhookUrl?: string | null): Promise<void> {
  const url = webhookUrl || N8N || MAKE
  if (!url) return
  await post(url, payload)
}
