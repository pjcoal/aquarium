'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getEngine } from '@/simulation/engine'
import { useMounted } from '@/lib/hooks'
import { Navigation } from './Navigation'
import { AddFishModal } from './AddFishModal'

const AddFishCtx = createContext<{ open: () => void }>({ open: () => {} })
export const useAddFish = () => useContext(AddFishCtx)

export function AppShell({ children }: { children: React.ReactNode }) {
  const mounted = useMounted()
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!mounted) return
    const e = getEngine()
    e.start()
    // dev-only handle for inspection from the console
    if (process.env.NODE_ENV !== 'production') (window as unknown as { aquarium: unknown }).aquarium = e
  }, [mounted])

  return (
    <AddFishCtx.Provider value={{ open: () => setAdding(true) }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn">
        skip to content
      </a>
      <Navigation onAdd={() => setAdding(true)} />
      <main id="main" className="mx-auto w-full max-w-[1600px] px-3 pb-16 sm:px-5">
        {children}
      </main>
      {adding && <AddFishModal onClose={() => setAdding(false)} />}
    </AddFishCtx.Provider>
  )
}
