/** When `ends_at` is missing, treat “live” as this window after `starts_at` (typical set length). */
export const DEFAULT_EVENT_LIVE_WINDOW_MS = 3 * 60 * 60 * 1000

export type EventSchedulePhase = 'upcoming' | 'live' | 'ended'

export function getEventPhase(
  startsAt: string,
  endsAt: string | null | undefined,
  nowMs: number
): EventSchedulePhase {
  const startMs = Date.parse(startsAt)
  if (Number.isNaN(startMs)) return 'ended'
  let endMs: number
  const rawEnd = endsAt != null && String(endsAt).trim() ? Date.parse(String(endsAt)) : NaN
  if (!Number.isNaN(rawEnd)) endMs = rawEnd
  else endMs = startMs + DEFAULT_EVENT_LIVE_WINDOW_MS

  if (nowMs < startMs) return 'upcoming'
  if (nowMs >= startMs && nowMs < endMs) return 'live'
  return 'ended'
}

/** Human-readable countdown until `targetMs` (starts at or ends at). */
export function formatCountdown(targetMs: number, nowMs: number): string {
  const ms = Math.max(0, targetMs - nowMs)
  const sec = Math.floor(ms / 1000)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function eventEndMs(startsAt: string, endsAt: string | null | undefined): number {
  const startMs = Date.parse(startsAt)
  const rawEnd = endsAt != null && String(endsAt).trim() ? Date.parse(String(endsAt)) : NaN
  if (!Number.isNaN(rawEnd)) return rawEnd
  if (Number.isNaN(startMs)) return 0
  return startMs + DEFAULT_EVENT_LIVE_WINDOW_MS
}

export function formatTimeRemainingLive(startsAt: string, endsAt: string | null | undefined, nowMs: number): string {
  const endMs = eventEndMs(startsAt, endsAt)
  return formatCountdown(endMs, nowMs)
}

export type ScheduleEventRow = {
  id: string
  title: string
  image_url: string | null
  starts_at: string
  ends_at?: string | null
}

export function sortEventsForLiveSchedule(rows: ScheduleEventRow[], nowMs: number): ScheduleEventRow[] {
  const order: Record<EventSchedulePhase, number> = { live: 0, upcoming: 1, ended: 2 }
  return [...rows].sort((a, b) => {
    const pa = getEventPhase(a.starts_at, a.ends_at, nowMs)
    const pb = getEventPhase(b.starts_at, b.ends_at, nowMs)
    const od = order[pa] - order[pb]
    if (od !== 0) return od
    const ta = Date.parse(a.starts_at)
    const tb = Date.parse(b.starts_at)
    if (pa === 'ended') return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb)
  })
}
