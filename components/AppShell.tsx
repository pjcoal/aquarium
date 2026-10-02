'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getEngine } from '@/simulation/engine'
import { getTankSync } from '@/lib/tankSync'
import { useMounted } from '@/lib/hooks'
import { Navigation } from './Navigation'
import { LaunchModal } from './LaunchModal'

const LaunchCtx = createContext<{ open: () => void }>({ open: () => {} })
export const useLaunch = () => useContext(LaunchCtx)

export function AppShell({ children }: { children: React.ReactNode }) {
  const mounted = useMounted()
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    if (!mounted) return
    const e = getEngine()
    e.start()
    getTankSync(e)?.start()
    // dev-only handle for inspection from the console
    if (process.env.NODE_ENV !== 'production') (window as unknown as { aquarium: unknown }).aquarium = e
  }, [mounted])

  return (
    <LaunchCtx.Provider value={{ open: () => setLaunching(true) }}>
      <a href="#main" className="btn sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50">
        skip to content
      </a>
      <Navigation onLaunch={() => setLaunching(true)} />
      <main id="main" className="mx-auto w-full max-w-[1600px] px-3 pb-16 sm:px-5">
        {children}
      </main>
      {launching && <LaunchModal onClose={() => setLaunching(false)} />}
    </LaunchCtx.Provider>
  )
}
