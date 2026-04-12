import type { SyntheticEvent } from 'react'
import { catalogCardImageUrl } from '../../lib/catalogImage'
import { formatGbp } from '../../lib/currency'

function fallbackToArtistPortrait(e: SyntheticEvent<HTMLImageElement>, portrait: string | null) {
  const el = e.currentTarget
  if (el.dataset.fallbackPortrait === '1') return
  const p = portrait?.trim()
  if (!p) return
  el.dataset.fallbackPortrait = '1'
  el.src = p
}

type Membership = { id: string; title: string; price_cents: number; image_url: string | null }

/** Image-first membership tile — text only in gradient overlay */
export function ArtistMembershipTile({
  m,
  artistAvatarUrl,
  onSelect,
}: {
  m: Membership
  artistAvatarUrl: string | null
  onSelect: () => void
}) {
  const tierCardImg = catalogCardImageUrl(m.image_url, artistAvatarUrl)
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative h-[min(58vh,520px)] w-[min(42vw,200px)] shrink-0 snap-center overflow-hidden bg-neutral-900 text-left transition-transform duration-500 [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] active:scale-[0.98] md:w-[min(30vw,240px)]"
    >
      {tierCardImg ? (
        <img
          src={tierCardImg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => fallbackToArtistPortrait(e, artistAvatarUrl)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 px-2">
          <span className="text-center text-xs text-white/60">{m.title}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-sm font-medium leading-tight text-white line-clamp-2">{m.title}</p>
        <p className="mt-1 text-xs font-medium text-[var(--signal-gold)]">{formatGbp(m.price_cents)}/mo</p>
      </div>
    </button>
  )
}

type Product = { id: string; title: string; image_url: string | null; type: string; price_cents?: number }

export function ArtistProductTile({
  p,
  artistAvatarUrl,
  onSelect,
}: {
  p: Product
  artistAvatarUrl: string | null
  onSelect: () => void
}) {
  const productCardImg = catalogCardImageUrl(p.image_url, artistAvatarUrl)
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative h-[min(58vh,520px)] w-[min(42vw,200px)] shrink-0 snap-center overflow-hidden bg-neutral-900 text-left transition-transform duration-500 [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] active:scale-[0.98] md:w-[min(30vw,240px)]"
    >
      {productCardImg ? (
        <img
          src={productCardImg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => fallbackToArtistPortrait(e, artistAvatarUrl)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 p-3">
          <span className="line-clamp-4 text-center text-xs text-white/60">{p.title}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-sm font-medium leading-tight text-white line-clamp-2">{p.title}</p>
        <p className="text-[10px] uppercase tracking-wide text-white/45">{p.type}</p>
        {p.price_cents != null && (
          <p className="mt-1 text-xs font-medium text-[var(--signal-gold)]">{formatGbp(p.price_cents)}</p>
        )}
      </div>
    </button>
  )
}
