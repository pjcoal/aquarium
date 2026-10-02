import type { WorldState } from '@/types/simulation'

const KEY = 'aquarium.world.v1'
export const WORLD_VERSION = 1

export function loadWorld(): WorldState | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as WorldState
    if (w.version !== WORLD_VERSION || !Array.isArray(w.fish)) return null
    return w
  } catch {
    return null
  }
}

export function saveWorld(w: WorldState): boolean {
  try {
    w.savedAt = Date.now()
    window.localStorage.setItem(KEY, JSON.stringify(w))
    return true
  } catch {
    return false
  }
}

export function clearWorld(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

const PREFS_KEY = 'aquarium.prefs.v1'
export interface ViewPrefs {
  showNames: boolean
  sound: boolean
}

export function loadPrefs(): Partial<ViewPrefs> {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ViewPrefs>
  } catch {
    return {}
  }
}

export function savePrefs(p: Partial<ViewPrefs>): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...p }))
  } catch {
    /* ignore */
  }
}
