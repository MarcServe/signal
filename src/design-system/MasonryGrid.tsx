import { useMemo } from 'react'
import Masonry from 'react-masonry-css'
import { tokens } from './tokens'

const breakpointColumns = {
  default: 5,
  1600: 4,
  1200: 3,
  768: 2,
  480: 1,
}

export interface MasonryGridProps<T> {
  items: T[]
  breakpointCols?: Record<string, number>
  columnClassName?: string
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string
  className?: string
}

export function MasonryGrid<T>({
  items,
  breakpointCols = breakpointColumns,
  columnClassName = 'masonry-grid-column',
  renderItem,
  keyExtractor,
  className = '',
}: MasonryGridProps<T>) {
  const columnClass = useMemo(
    () =>
      `${columnClassName} flex flex-col gap-4 pl-0 [&>.masonry-item]:mb-4`.trim(),
    [columnClassName]
  )

  return (
    <Masonry
      breakpointCols={breakpointCols}
      className={`masonry-grid flex -ml-4 w-auto ${className}`}
      columnClassName={columnClass}
    >
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)} className="masonry-item break-inside-avoid">
          {renderItem(item, index)}
        </div>
      ))}
    </Masonry>
  )
}

// Utility for grid container spacing (Pinterest-style gutters)
export const masonryGridContainerStyle = {
  padding: tokens.space.gutter,
  maxWidth: '100%',
  boxSizing: 'border-box' as const,
}
