/**
 * Bottom-aligned overlay copy — max two lines for title, one for meta (luxury feed spec).
 * When `liftForIncomingCard` is true, sits higher so the next stacked panel does not cover titles.
 */
export function OverlayText({
  title,
  meta,
  className = '',
  liftForIncomingCard = false,
}: {
  title: string
  meta?: string
  className?: string
  liftForIncomingCard?: boolean
}) {
  const positionClasses = liftForIncomingCard
    ? 'bottom-[max(0.75rem,7vh)] pb-6 pt-24'
    : 'bottom-0 pb-5 pt-16'

  return (
    <div
      className={`pointer-events-none absolute left-0 right-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 ${positionClasses} ${className}`}
    >
      <h2
        className="text-base font-medium tracking-wide text-white line-clamp-2 md:text-lg"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {title}
      </h2>
      {meta ? (
        <p className="mt-1 text-xs tracking-wide text-white/75 line-clamp-1 tabular-nums">{meta}</p>
      ) : null}
    </div>
  )
}
