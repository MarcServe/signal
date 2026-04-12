import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ImmersiveNavContext } from '../contexts/ImmersiveNavContext'
import { ImmersiveChrome } from '../components/immersive/ImmersiveChrome'
import { SlideInMenu } from '../components/immersive/SlideInMenu'

export function ImmersiveLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  const openMenu = useCallback(() => setMenuOpen(true), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const ctx = useMemo(
    () => ({
      openMenu,
      closeMenu,
    }),
    [openMenu, closeMenu],
  )

  return (
    <ImmersiveNavContext.Provider value={ctx}>
      <div className="immersive-root flex h-full min-h-0 max-h-[100dvh] flex-col overflow-hidden bg-black text-white">
        <ImmersiveChrome />
        <SlideInMenu open={menuOpen} onClose={closeMenu} />
        <main
          data-immersive-scrollport
          className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
        >
          <Outlet />
        </main>
      </div>
    </ImmersiveNavContext.Provider>
  )
}
