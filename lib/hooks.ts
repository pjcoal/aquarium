'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getEngine, type Engine } from '@/simulation/engine'

const noopSub = () => () => {}

/** true after hydration; the engine only exists on the client */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSub,
    () => true,
    () => false,
  )
}

/**
 * Returns the engine (or null during SSR) and re-renders the caller at the
 * engine's UI tick rate (~2.5Hz), never per animation frame.
 */
export function useEngine(): Engine | null {
  const mounted = useMounted()
  const engine = mounted ? getEngine() : null
  useSyncExternalStore(
    engine ? engine.subscribe : noopSub,
    () => (engine ? engine.uiVersion : 0),
    () => 0,
  )
  return engine
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
