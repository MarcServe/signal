import { Link } from 'react-router-dom'
import type { SyntheticEvent } from 'react'
import { catalogCardImageUrl } from '../../lib/catalogImage'
import { getEventPhase, type ScheduleEventRow } from '../../lib/eventSchedule'
import { ClockIcon } from './ClockIcon'

function fallbackToArtistPortrait(e: SyntheticEvent<HTMLImageElement>, portrait: string | null) {
  const el = e.currentTarget
  if (el.dataset.fallbackPortrait === '1') return
  const p = portrait?.trim()
  if (!p) return
  el.dataset.fallbackPortrait = '1'
  el.src = p
}

function shortTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return '—'
  }
}

/** Full-bleed image tile + bottom overlay; clock opens time sheet (does not navigate). */
export function ArtistEventRailCard({
  event: e,
  nowMs,
  artistAvatarUrl,
  to,
  onTimeClick,
}: {
  event: ScheduleEventRow
  nowMs: number
  artistAvatarUrl: string | null
  to: string
  onTimeClick: () => void
}) {
  const phase = getEventPhase(e.starts_at, e.ends_at, nowMs)
  const eventCardImg = catalogCardImageUrl(e.image_url, artistAvatarUrl)
  const st = shortTime(e.starts_at ?? '')
  const en = shortTime(e.ends_at ?? '')

  const badge =
    phase === 'live' ? (
      <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
        Live
      </span>
    ) : phase === 'upcoming' ? (
      <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
        Soon
      </span>
    ) : (
      <span className="rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
        Ended
      </span>
    )

  return (
    <div
      className="relative h-[min(72vh,640px)] w-[min(88vw,420px)] shrink-0 snap-center overflow-hidden bg-neutral-900"
    >
      {eventCardImg ? (
        <img
          src={eventCardImg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(ev) => fallbackToArtistPortrait(ev, artistAvatarUrl)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 p-4">
          <span className="text-center text-sm font-medium text-white/80">{e.title}</span>
        </div>
      )}

      <Link to={to} className="absolute inset-0 z-[1]" aria-label={`Open live: ${e.title}`} />

      <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col justify-between p-3">
        <div className="flex items-start justify-between">
          {badge}
          <button
            type="button"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65"
            aria-label="Show start and end times"
            onClick={(ev) => {
              ev.stopPropagation()
              onTimeClick()
            }}
          >
            <ClockIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1 pb-4 pt-20">
          <p className="text-lg font-medium leading-tight text-white line-clamp-2" style={{ fontFamily: 'var(--font-body)' }}>
            {e.title}
          </p>
          <p className="mt-1.5 text-[11px] tabular-nums tracking-wide text-white/65">
            ST {st} · EN {en}
          </p>
        </div>
      </div>
    </div>
  )
}
