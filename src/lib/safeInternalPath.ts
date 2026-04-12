/**
 * Validates a path for post-auth redirects. Rejects open redirects and protocol-relative URLs.
 */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (path == null) return null
  const t = path.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  if (t.includes('://')) return null
  return t
}

/**
 * Next path after sign-in: `redirect` query (validated), then router `location.state.from`, else `/dashboard`.
 */
export function resolvePostAuthPath(redirectParam: string | null, locationState: unknown): string {
  const fromQuery = safeInternalPath(redirectParam)
  if (fromQuery) return fromQuery
  const from = (locationState as { from?: { pathname: string; search?: string } } | null)?.from
  if (from?.pathname) {
    const combined = `${from.pathname}${from.search ?? ''}`
    const safe = safeInternalPath(combined)
    if (safe) return safe
  }
  return '/dashboard'
}
