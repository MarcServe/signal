import { createContext, useContext } from 'react'

export type ImmersiveNavContextValue = {
  openMenu: () => void
  closeMenu: () => void
}

export const ImmersiveNavContext = createContext<ImmersiveNavContextValue | null>(null)

export function useImmersiveNav() {
  const ctx = useContext(ImmersiveNavContext)
  return ctx
}
