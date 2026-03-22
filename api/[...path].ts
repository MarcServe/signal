/**
 * Single Vercel serverless entry for all /api/* routes (Hobby plan: max 12 functions per deployment).
 * Handlers live in api/_routes/; URLs stay unchanged (e.g. POST /api/product-image-generate).
 */
import artistBio from './_routes/artist-bio.js'
import avatarGenerate from './_routes/avatar-generate.js'
import avatarTts from './_routes/avatar-tts.js'
import payoutsRun from './_routes/payouts-run.js'
import productImageGenerate from './_routes/product-image-generate.js'
import stripeCheckout from './_routes/stripe-checkout.js'
import stripeConnect from './_routes/stripe-connect.js'
import stripeWebhook from './_routes/stripe-webhook.js'
import syncHandler from './_routes/sync.js'

type ApiHandler = (req: any, res: any) => Promise<void>

const byPath: Record<string, ApiHandler> = {
  '/api/artist-bio': artistBio as ApiHandler,
  '/api/avatar-generate': avatarGenerate as ApiHandler,
  '/api/avatar-tts': avatarTts as ApiHandler,
  '/api/payouts-run': payoutsRun as ApiHandler,
  '/api/product-image-generate': productImageGenerate as ApiHandler,
  '/api/stripe-checkout': stripeCheckout as ApiHandler,
  '/api/stripe-connect': stripeConnect as ApiHandler,
  '/api/stripe-webhook': stripeWebhook as ApiHandler,
  '/api/sync': syncHandler as ApiHandler,
}

function resolvePublicPathname(req: { url?: string; query?: Record<string, string | string[] | undefined> }): string | null {
  const rawQ = req.query?.path
  const q = Array.isArray(rawQ) ? rawQ[0] : rawQ
  if (typeof q === 'string' && q.length > 0) {
    const tail = q.startsWith('/') ? q.slice(1) : q
    return `/api/${tail}`
  }
  try {
    let pathname = new URL(req.url || '/', 'https://vercel.local').pathname
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
    if (pathname.startsWith('/api/')) return pathname
  } catch {
    /* ignore */
  }
  return null
}

export default async function handler(req: any, res: any): Promise<void> {
  const pathname = resolvePublicPathname(req)
  const sub = pathname ? byPath[pathname] : undefined
  if (!sub) {
    res.setHeader('Content-Type', 'application/json')
    res.status(404).json({ error: 'Not found' })
    return
  }
  await sub(req, res)
}
