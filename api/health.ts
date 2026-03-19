/**
 * GET /api/health — simple health check for API routes.
 */
export default function handler(
  _req: { method?: string },
  res: { status: (n: number) => { json: (o: object) => void }; setHeader: (a: string, b: string) => void }
): void {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({ ok: true, service: 'signal-api' })
}
