import {
  formatCountdown,
  formatTimeRemainingLive,
  getEventPhase,
  type ScheduleEventRow,
} from '../../lib/eventSchedule'

export function ScheduleTimeSheet({
  event: e,
  nowMs,
  open,
  onClose,
}: {
  event: ScheduleEventRow
  nowMs: number
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  const phase = getEventPhase(e.starts_at, e.ends_at, nowMs)
  const startMs = Date.parse(e.starts_at ?? '')
  const whenLine = new Date(e.starts_at ?? 0).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
  const endLine = new Date(e.ends_at ?? 0).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })

  let countdownLine: string | null = null
  if (phase === 'upcoming' && !Number.isNaN(startMs)) {
    countdownLine = `Starts in ${formatCountdown(startMs, nowMs)}`
  } else if (phase === 'live') {
    countdownLine = `Ends in ${formatTimeRemainingLive(e.starts_at, e.ends_at, nowMs)}`
  }

  const phaseLabel =
    phase === 'live' ? 'Live now' : phase === 'upcoming' ? 'Upcoming' : 'Ended'

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500 [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)]"
      role="dialog"
      aria-modal="true"
      aria-label="Event times"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-neutral-950 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-500 [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {e.title}
          </h3>
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/70">
            {phaseLabel}
          </span>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-white/40">Start</dt>
            <dd className="mt-0.5 tabular-nums text-white/90">{whenLine}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-white/40">End</dt>
            <dd className="mt-0.5 tabular-nums text-white/90">{endLine}</dd>
          </div>
          {countdownLine && (
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-[var(--signal-gold)]">Countdown</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-[var(--signal-gold)]">{countdownLine}</dd>
            </div>
          )}
        </dl>
        <p className="mt-2 text-[10px] text-white/35">ST / EN — start and end times in your locale</p>
        <button
          type="button"
          className="mt-6 w-full rounded-full bg-white/10 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
