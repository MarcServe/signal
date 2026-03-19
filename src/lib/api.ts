/**
 * API base URL for serverless routes. Same origin in production (/api/*); set VITE_APP_URL for absolute URL.
 * Ignores common template values (e.g. https://yoursite.com) so local dev keeps using the Vite origin.
 */
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
    ? envAppUrl.trim().replace(/\/$/, '')
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
