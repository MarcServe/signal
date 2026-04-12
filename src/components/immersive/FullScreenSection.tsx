import type { ReactNode } from 'react'

/**
 * Liquid stacked scroll: sticky panels shorter than the viewport, negative top margin on
 * cards after the first so the next image rises into view before the previous leaves — layered
 * editorial feel (vs hard full-screen replacement). Rising z-index keeps newer panels on top.
 */
export function FullScreenSection({
  children,
  className = '',
  stackIndex,
  isLast = false,
}: {
  children: ReactNode
  className?: string
  /** 0-based; later slides stack above earlier ones */
  stackIndex: number
  /** Final slide fills the viewport so underlying sticky layers aren’t visible at scroll end */
  isLast?: boolean
}) {
  const layered = stackIndex > 0

  return (
    <section
      className={[
        'sticky top-0 flex w-full shrink-0 flex-col overflow-hidden bg-black',
        /* Middle cards: shorter than full viewport = liquid peek. Last card: full height so nothing shows through at end */
        isLast ? 'h-[100dvh] min-h-[100dvh]' : 'h-[82dvh]',
        /* Overlap: pull each subsequent card up into the previous (liquid flow) */
        layered ? '-mt-[6vh] shadow-[0_-12px_44px_rgba(0,0,0,0.4)]' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ zIndex: stackIndex + 1 }}
    >
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </section>
  )
}
