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

function normalizeApiPathname(p: string): string {
  let s = p.trim()
  if (!s.startsWith('/')) s = `/${s}`
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s
}

/**
 * Vercel catch-all invocations often use an internal `req.url` (no `?path=`), and `req.query` may be empty.
 * Build output sets `x-original-path` on the request (see `.vercel/output/config.json`); use that first.
 */
function resolvePublicPathname(req: {
  url?: string
  headers?: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
}): string | null {
  const headers = req.headers || {}
  const pickHeader = (k: string): string | undefined => {
    const v = headers[k] ?? headers[k.toLowerCase()]
    if (typeof v === 'string') return v
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
    return undefined
  }

  const fromOriginal =
    pickHeader('x-original-path') ||
    pickHeader('x-vercel-original-path') ||
    pickHeader('x-vercel-invoke-path')
  if (fromOriginal && fromOriginal.startsWith('/api/')) {
    return normalizeApiPathname(fromOriginal.split('?')[0])
  }

  const rawUrl = typeof req.url === 'string' ? req.url : ''
  const qPart = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : ''
  const fromSearch = new URLSearchParams(qPart).get('path')
  const rawQ = req.query?.path
  const fromNodeQuery = Array.isArray(rawQ) ? rawQ[0] : rawQ
  const pathTail = fromSearch ?? (typeof fromNodeQuery === 'string' ? fromNodeQuery : null)
  if (pathTail && pathTail.length > 0) {
    const tail = pathTail.startsWith('/') ? pathTail.slice(1) : pathTail
    try {
      return normalizeApiPathname(`/api/${decodeURIComponent(tail)}`)
    } catch {
      return normalizeApiPathname(`/api/${tail}`)
    }
  }

  try {
    let pathname = new URL(rawUrl || '/', 'https://vercel.local').pathname
    pathname = normalizeApiPathname(pathname)
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
    res.status(404).json({ error: 'Not found', code: 'API_ROUTE' })
    return
  }
  await sub(req, res)
}
