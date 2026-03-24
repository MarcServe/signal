import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { DiscoveryCard } from './DiscoveryCard'
import type { FeedItem } from '../types/feed'

/** Time between automatic advances when the user is idle */
const AUTO_MS = 4500
/** After tap/swipe, resume auto-advance after this quiet period */
const IDLE_RESUME_MS = 5000

function centeredChildIndex(container: HTMLElement): number {
  const cr = container.getBoundingClientRect()
  const cx = cr.left + cr.width / 2
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < container.children.length; i++) {
    const r = (container.children[i] as HTMLElement).getBoundingClientRect()
    const mid = r.left + r.width / 2
    const d = Math.abs(mid - cx)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/** Pixel scroll delta to horizontally center `child` in `container`’s viewport. */
function centerChildDelta(container: HTMLElement, child: HTMLElement): number {
  const cr = container.getBoundingClientRect()
  const chr = child.getBoundingClientRect()
  return chr.left + chr.width / 2 - (cr.left + cr.width / 2)
}

function scrollChildToCenter(container: HTMLElement, index: number, behavior: ScrollBehavior) {
  const child = container.children[index] as HTMLElement
  if (!child) return
  const delta = centerChildDelta(container, child)
  if (behavior === 'instant') {
    // `scroll-smooth` on the scroller otherwise animates this jump and scrubs backward through every slide.
    const prev = container.style.scrollBehavior
    container.style.scrollBehavior = 'auto'
    container.scrollLeft += delta
    container.style.scrollBehavior = prev
    return
  }
  container.scrollBy({ left: delta, behavior })
}

export function DiscoveryMobileCarousel({ items }: { items: FeedItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pauseUntilRef = useRef(0)
  const autoAdvanceRef = useRef(false)
  const loopJumpRef = useRef(false)

  const n = items.length

  const loopItems = useMemo(() => {
    if (n <= 1) return items
    return [items[n - 1], ...items, items[0]]
  }, [items, n])

  const loopKeys = useMemo(() => {
    if (n <= 1) {
      return items.map((item) => `${item.item_type}-${item.id}`)
    }
    return [
      `${items[n - 1].item_type}-${items[n - 1].id}-loop-prev`,
      ...items.map((item) => `${item.item_type}-${item.id}`),
      `${items[0].item_type}-${items[0].id}-loop-next`,
    ]
  }, [items, n])

  const itemsKey = useMemo(() => items.map((i) => i.id).join(','), [items])

  const bumpUserPause = useCallback(() => {
    pauseUntilRef.current = Date.now() + IDLE_RESUME_MS
  }, [])

  const applyLoopBoundaries = useCallback(() => {
    const el = scrollerRef.current
    if (!el || n <= 1) return
    const idx = centeredChildIndex(el)
    if (idx === 0) {
      loopJumpRef.current = true
      scrollChildToCenter(el, n, 'instant')
    } else if (idx === n + 1) {
      loopJumpRef.current = true
      scrollChildToCenter(el, 1, 'instant')
    }
  }, [n])

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el || n <= 1) return
    loopJumpRef.current = true
    scrollChildToCenter(el, 1, 'instant')
  }, [n, itemsKey])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || n <= 1) return

    let scrollEndFallback: number | undefined

    const runScrollEnd = () => {
      if (loopJumpRef.current) {
        loopJumpRef.current = false
        return
      }
      if (autoAdvanceRef.current) {
        autoAdvanceRef.current = false
      } else {
        bumpUserPause()
      }
      applyLoopBoundaries()
    }

    const onScroll = () => {
      window.clearTimeout(scrollEndFallback)
      // One path only: avoids scrollend + timeout double-firing (would mis-count auto slides as user idle)
      scrollEndFallback = window.setTimeout(runScrollEnd, 160)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(scrollEndFallback)
    }
  }, [n, itemsKey, applyLoopBoundaries, bumpUserPause])

  useEffect(() => {
    if (n <= 1) return
    const id = window.setInterval(() => {
      const el = scrollerRef.current
      if (!el) return
      if (Date.now() < pauseUntilRef.current) return

      const idx = centeredChildIndex(el)
      let nextIdx: number
      if (idx === 0) {
        nextIdx = n
      } else if (idx === n + 1) {
        nextIdx = 1
      } else if (idx === n) {
        nextIdx = n + 1
      } else {
        nextIdx = idx + 1
      }

      autoAdvanceRef.current = true
      scrollChildToCenter(el, nextIdx, 'smooth')
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [n, itemsKey])

  if (n === 0) return null

  return (
    <div className="md:hidden -mx-[var(--gutter)]">
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-[var(--gutter)] pb-2 no-scrollbar [-webkit-overflow-scrolling:touch]"
        role="region"
        aria-label="Discover — swipe sideways"
        onPointerDown={bumpUserPause}
      >
        {loopItems.map((item, i) => (
          <div
            key={loopKeys[i]}
            className="w-[min(88vw,400px)] shrink-0 snap-center snap-always"
          >
            <DiscoveryCard item={item} />
          </div>
        ))}
      </div>
      {n > 1 && (
        <p className="text-center text-[11px] text-[var(--signal-ink-muted)] pb-4 pt-1 px-[var(--gutter)]">
          Swipe sideways for more · auto-advances when idle
        </p>
      )}
    </div>
  )
}
