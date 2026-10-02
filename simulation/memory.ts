import type { Fish, Memory, Vec } from '@/types/fish'
import { clamp } from '@/lib/random'

export const MAX_MEMORIES = 40
export const MAX_HISTORY = 40
export const MAX_THOUGHTS = 12

/** Add a memory, merging with a near-identical recent one instead of duplicating. */
export function remember(f: Fish, m: Memory, mergeWindowMs = 90_000): void {
  const recent = f.memories.find(
    (x) =>
      x.kind === m.kind &&
      x.fishId === m.fishId &&
      x.placeId === m.placeId &&
      x.text === m.text &&
      m.t - x.t < mergeWindowMs,
  )
  if (recent) {
    recent.t = m.t
    recent.valence = (recent.valence + m.valence) / 2
    return
  }
  f.memories.unshift(m)
  if (f.memories.length > MAX_MEMORIES) {
    // forget the least significant old memory rather than strictly the oldest
    let worst = -1
    let worstScore = Infinity
    for (let i = 10; i < f.memories.length; i++) {
      const mm = f.memories[i]
      const s = Math.abs(mm.valence) + (mm.kind === 'discovery' ? 1 : 0) - i * 0.01
      if (s < worstScore) {
        worstScore = s
        worst = i
      }
    }
    f.memories.splice(worst >= 0 ? worst : f.memories.length - 1, 1)
  }
}

export function adjustAffinity(f: Fish, placeId: string, delta: number): void {
  f.prefs.placeAffinity[placeId] = clamp((f.prefs.placeAffinity[placeId] ?? 0) + delta, -1, 1)
}

/** where has this fish found food before? weighted toward recent memories */
export function recallFoodSpot(f: Fish, now: number): (Vec & { label: string }) | null {
  let best: Memory | null = null
  let bestScore = 0
  for (const m of f.memories) {
    if (m.kind !== 'food' || !m.pos) continue
    const ageMin = (now - m.t) / 60_000
    const s = 1 / (1 + ageMin / 30)
    if (s > bestScore) {
      bestScore = s
      best = m
    }
  }
  if (!best || !best.pos) return null
  return { x: best.pos.x, y: best.pos.y, label: best.text }
}

export function recentThreat(f: Fish, now: number, windowMs = 5 * 60_000): Memory | null {
  return f.memories.find((m) => m.kind === 'threat' && now - m.t < windowMs) ?? null
}

export function favoritePlace(f: Fish, filter?: (id: string) => boolean): { id: string; v: number } | null {
  let best: { id: string; v: number } | null = null
  for (const [id, val] of Object.entries(f.prefs.placeAffinity)) {
    if (filter && !filter(id)) continue
    if (!best || val > best.v) best = { id, v: val }
  }
  return best && best.v > 0.15 ? best : null
}
