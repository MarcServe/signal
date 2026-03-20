import { useNavigate } from 'react-router-dom'
import { getFeedItemDetailPath } from '../lib/feedNavigation'
import type { FeedItem, FeedItemType } from '../types/feed'

export interface DiscoveryCardProps {
  item: FeedItem
}

/** Tall portrait “card” ratio everywhere for image-first feed (not square tiles). */
const aspectByType: Record<FeedItemType, string> = {
  stream: 'aspect-[3/4]',
  artist: 'aspect-[3/4]',
  product: 'aspect-[3/4]',
  event: 'aspect-[4/3]',
  track: 'aspect-[3/4]',
}

export function DiscoveryCard({ item }: DiscoveryCardProps) {
  const navigate = useNavigate()
  const isDemoCard = item.id.startsWith('demo-')
  const aspectClass = isDemoCard ? 'aspect-[3/4]' : (aspectByType[item.item_type] || 'aspect-[3/4]')

  const handleTap = () => {
    navigate(getFeedItemDetailPath(item))
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full text-left rounded-[var(--radius-card)] overflow-hidden bg-[var(--signal-white-pure)] border border-[var(--signal-silver-light)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)] focus:ring-offset-2"
      style={{ transition: 'transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)' }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = '')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      <div className={`relative ${aspectClass} min-h-[200px] bg-[var(--signal-silver-light)]`}>
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--signal-silver)] text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
            {item.title.charAt(0)}
          </div>
        )}
        {item.is_live && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-medium uppercase tracking-wide">
            Live
          </span>
        )}
        {item.item_type === 'track' && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[var(--signal-gold)]/90 text-white text-xs font-medium uppercase tracking-wide">
            Track
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white font-medium truncate" style={{ fontFamily: 'var(--font-body)' }}>
            {item.title}
          </p>
          <p className="text-white/90 text-sm mt-0.5">{item.cta}</p>
        </div>
      </div>
    </button>
  )
}
