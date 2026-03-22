/**
 * API paths for serverless routes.
 *
 * In the browser we always use **relative** `/api/...` so calls stay on the same host as the page. That
 * avoids a common production bug: `VITE_APP_URL` on Vercel pointing at another deployment or domain while
 * you open the app on a different URL (every request would 404 on the wrong host).
 *
 * Local: Vite `server.proxy` forwards `/api` to `VITE_API_PROXY_TARGET` (default 127.0.0.1:3000).
 *
 * Non-browser (rare): `VITE_APP_URL` can supply an absolute origin when no `window` exists.
 */
function normalizeAppBaseUrl(url: string): string {
  const t = url.trim().replace(/\/+$/, '')
  if (!t) return ''
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t)
  const hostPart = t.split('/')[0] ?? t
  const isLocal =
    /^localhost\b/i.test(hostPart) ||
    hostPart.startsWith('127.0.0.1') ||
    hostPart.startsWith('[::1]')
  const withScheme = hasScheme ? t : `${isLocal ? 'http' : 'https'}://${t}`
  try {
    return new URL(withScheme).origin
  } catch {
    return ''
  }
}

function isPlaceholderAppUrl(url: string): boolean {
  const u = url.trim().toLowerCase().replace(/\/$/, '')
  if (!u) return true
  // Match common template values from .env examples only (avoid catching real domains like app-yoursite.com).
  return (
    u === 'https://yoursite.com' ||
    u === 'http://yoursite.com' ||
    u === 'https://www.yoursite.com' ||
    u === 'http://www.yoursite.com' ||
    u === 'https://example.com' ||
    u === 'http://example.com'
  )
}

const envAppUrl = typeof import.meta.env.VITE_APP_URL === 'string' ? import.meta.env.VITE_APP_URL : ''

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const rel = `/api${p.startsWith('/api') ? p.slice(4) : p}`
  if (typeof window !== 'undefined') return rel
  const base =
    envAppUrl && !isPlaceholderAppUrl(envAppUrl) ? normalizeAppBaseUrl(envAppUrl) : ''
  return base ? `${base.replace(/\/$/, '')}${rel}` : rel
}

export async function getSession(): Promise<{ access_token: string } | null> {
  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { access_token: session.access_token } : null
}
