import { useCallback, useEffect, useRef } from 'react'
import { DiscoveryCard } from './DiscoveryCard'
import { FullScreenSection } from './immersive/FullScreenSection'
import type { FeedItem } from '../types/feed'

/**
 * Vertical liquid stack scroll: overlapping sticky cards, soft snap (not mechanical full-screen steps).
 */
export function DiscoveryMobileStack({
  items,
  onNearEnd,
}: {
  items: FeedItem[]
  onNearEnd?: () => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const nearEndSent = useRef(false)

  const checkNearEnd = useCallback(() => {
    const el = scrollerRef.current
    if (!el || !onNearEnd) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 320) {
      if (!nearEndSent.current) {
        nearEndSent.current = true
        onNearEnd()
      }
    } else {
      nearEndSent.current = false
    }
  }, [onNearEnd])

  useEffect(() => {
    nearEndSent.current = false
  }, [items.length])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => checkNearEnd()
    el.addEventListener('scroll', onScroll, { passive: true })
    checkNearEnd()
    return () => el.removeEventListener('scroll', onScroll)
  }, [checkNearEnd, items.length])

  if (items.length === 0) return null

  return (
    <div
      ref={scrollerRef}
      className="h-full min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch] bg-black no-scrollbar md:hidden"
      role="region"
      aria-label="Discover — scroll for more"
    >
      {items.map((item, index) => (
        <FullScreenSection
          key={`${item.item_type}-${item.id}`}
          stackIndex={index}
          isLast={index === items.length - 1}
        >
          <DiscoveryCard
            item={item}
            layout="mobileFill"
            variant="immersive"
            overlayLift={index < items.length - 1}
          />
        </FullScreenSection>
      ))}
    </div>
  )
}
