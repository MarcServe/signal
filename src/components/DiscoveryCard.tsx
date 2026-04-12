import { useNavigate } from 'react-router-dom'
import { getFeedItemDetailPath } from '../lib/feedNavigation'
import type { FeedItem, FeedItemType } from '../types/feed'
import { OverlayText } from './immersive/OverlayText'

export interface DiscoveryCardProps {
  item: FeedItem
  /** Mobile carousel: stretch card to slide height so the image can fill the viewport. */
  layout?: 'default' | 'mobileFill'
  /** Full-bleed luxury feed: no chrome, bottom overlay only. */
  variant?: 'default' | 'immersive'
  /** Mobile stack: lift title overlay when another card slides in below (not the last slide). */
  overlayLift?: boolean
}

/** Tall portrait “card” ratio everywhere for image-first feed (not square tiles). */
const aspectByType: Record<FeedItemType, string> = {
  stream: 'aspect-[3/4]',
  artist: 'aspect-[3/4]',
  product: 'aspect-[3/4]',
  event: 'aspect-[4/3]',
  track: 'aspect-[3/4]',
}

export function DiscoveryCard({
  item,
  layout = 'default',
  variant = 'default',
  overlayLift = false,
}: DiscoveryCardProps) {
  const navigate = useNavigate()
  const isDemoCard = item.id.startsWith('demo-')
  const aspectClass = isDemoCard ? 'aspect-[3/4]' : (aspectByType[item.item_type] || 'aspect-[3/4]')
  const fill = layout === 'mobileFill'
  const lux = variant === 'immersive'

  const handleTap = () => {
    navigate(getFeedItemDetailPath(item))
  }

  const shellClass = lux
    ? 'text-left overflow-hidden bg-transparent border-0 shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0 max-md:rounded-none'
    : `text-left rounded-[var(--radius-card)] overflow-hidden bg-[var(--signal-white-pure)] border border-[var(--signal-silver-light)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)] focus:ring-offset-2`

  const fillClass = fill
    ? lux
      ? 'flex h-full min-h-0 w-full flex-1 flex-col'
      : 'flex h-full w-full min-h-[calc(100svh-3.5rem)] flex-col max-md:rounded-none max-md:border-x-0 max-md:focus:ring-offset-0'
    : 'w-full'

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`${shellClass} ${fillClass}`}
      style={
        lux
          ? { transition: 'opacity 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)' }
          : { transition: 'transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)' }
      }
      onMouseDown={(e) => {
        if (!lux) e.currentTarget.style.transform = 'scale(0.98)'
      }}
      onMouseUp={(e) => {
        if (!lux) e.currentTarget.style.transform = ''
      }}
      onMouseLeave={(e) => {
        if (!lux) e.currentTarget.style.transform = ''
      }}
    >
      <div
        className={`relative bg-neutral-900 ${
          fill ? 'relative min-h-0 w-full flex-1' : `${aspectClass} min-h-[200px]`
        }`}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
            {item.title.charAt(0)}
          </div>
        )}
        {item.is_live && (
          <span
            className={`absolute rounded bg-red-600 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white ${
              fill ? 'right-4 top-[max(3.5rem,env(safe-area-inset-top))]' : 'right-2 top-2'
            }`}
          >
            Live
          </span>
        )}
        {item.item_type === 'track' && (
          <span
            className={`absolute rounded bg-[var(--signal-gold)]/90 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white ${
              fill ? 'left-4 top-[max(3.5rem,env(safe-area-inset-top))]' : 'left-2 top-2'
            }`}
          >
            Track
          </span>
        )}
        {lux ? (
          <OverlayText title={item.title} meta={item.cta} liftForIncomingCard={overlayLift} />
        ) : (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent ${
              fill ? 'px-[var(--gutter)] pb-4 pt-10' : 'p-3'
            }`}
          >
            <p className="text-white font-medium truncate" style={{ fontFamily: 'var(--font-body)' }}>
              {item.title}
            </p>
            <p className="text-white/90 text-sm mt-0.5">{item.cta}</p>
          </div>
        )}
      </div>
    </button>
  )
}
