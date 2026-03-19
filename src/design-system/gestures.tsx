import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from 'react'

export type GestureAction =
  | 'tap'
  | 'swipeLeft'
  | 'swipeRight'
  | 'swipeUp'
  | 'swipeDown'

export interface GestureCallbacks {
  onTap?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

const SWIPE_THRESHOLD_PX = 50
const SWIPE_MAX_VERTICAL_PX = 80
const SWIPE_MAX_HORIZONTAL_PX = 80

interface TouchState {
  startX: number
  startY: number
  startTime: number
}

const GestureContext = createContext<GestureCallbacks | null>(null)

export function GestureProvider({
  children,
  ...callbacks
}: { children: ReactNode } & GestureCallbacks) {
  return (
    <GestureContext.Provider value={callbacks}>
      {children}
    </GestureContext.Provider>
  )
}

export function useGestureCallbacks(): GestureCallbacks | null {
  return useContext(GestureContext)
}

export function useSwipeGesture(callbacks: GestureCallbacks) {
  const touchRef = useRef<TouchState | null>(null)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    touchRef.current = { startX: t.clientX, startY: t.clientY, startTime: Date.now() }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const state = touchRef.current
      touchRef.current = null
      if (!state) return
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - state.startX
      const dy = t.clientY - state.startY
      const c = callbacksRef.current

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dy) > SWIPE_MAX_VERTICAL_PX) return
        if (dx > SWIPE_THRESHOLD_PX) c.onSwipeRight?.()
        else if (dx < -SWIPE_THRESHOLD_PX) c.onSwipeLeft?.()
      } else {
        if (Math.abs(dx) > SWIPE_MAX_HORIZONTAL_PX) return
        if (dy > SWIPE_THRESHOLD_PX) c.onSwipeDown?.()
        else if (dy < -SWIPE_THRESHOLD_PX) c.onSwipeUp?.()
      }
    },
    []
  )

  return { onTouchStart, onTouchEnd }
}

export function useTapGesture(onTap: () => void) {
  return {
    onClick: onTap,
  }
}
