/**
 * API base URL for serverless routes. Same origin in production (/api/*); set VITE_APP_URL for absolute URL.
 * Ignores common template values (e.g. https://yoursite.com) so local dev keeps using the Vite origin.
 *
 * Bare hostnames (e.g. `signal-xxx.vercel.app` without `https://`) must become real origins; otherwise
 * `fetch(base + ...)` treats them as path-relative and the browser resolves them under the current origin
 * (`/signal-xxx.vercel.app/api/...` → duplicate host in the path).
 */
function normalizeAppBaseUrl(url: string): string {
  const t = url.trim().replace(/\/+$/, '')
  if (!t) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t
  const hostPart = t.split('/')[0] ?? t
  const isLocal =
    /^localhost\b/i.test(hostPart) ||
    hostPart.startsWith('127.0.0.1') ||
    hostPart.startsWith('[::1]')
  return `${isLocal ? 'http' : 'https'}://${t}`
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
const base =
  envAppUrl && !isPlaceholderAppUrl(envAppUrl)
    ? normalizeAppBaseUrl(envAppUrl)
    : typeof window !== 'undefined'
      ? window.location.origin
      : ''

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}/api${p.startsWith('/api') ? p.slice(4) : p}`
}

export async function getSession(): Promise<{ access_token: string } | null> {
  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { access_token: session.access_token } : null
}
