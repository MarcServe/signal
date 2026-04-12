import type { ReactNode } from 'react'

/**
 * Image-first rails: horizontal snap scroll (luxury editorial — not vertical grids).
 */
export function ArtistHorizontalRail({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`w-full py-8 md:py-12 ${className}`}>
      <p className="mb-4 px-4 text-[10px] font-medium uppercase tracking-[0.35em] text-white/40">{label}</p>
      <div className="flex gap-4 overflow-x-auto overflow-y-hidden px-4 pb-2 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory no-scrollbar md:gap-6 md:px-6">
        {children}
      </div>
    </section>
  )
}
