import { stripCitationMarkers } from '../../lib/cleanBioText'

export function AboutSheet({
  bio,
  open,
  onClose,
}: {
  bio: string
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500 [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)]"
      role="dialog"
      aria-modal="true"
      aria-label="About"
      onClick={onClose}
    >
      <div
        className="max-h-[min(85vh,720px)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-neutral-950 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          About
        </h3>
        <p className="whitespace-pre-wrap leading-relaxed text-white/70">{stripCitationMarkers(bio)}</p>
        <button
          type="button"
          className="mt-8 w-full rounded-full bg-white/10 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
