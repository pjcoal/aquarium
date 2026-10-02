import type { Fish, Relationship } from '@/types/fish'
import { clamp } from '@/lib/random'

export function rel(a: Fish, b: Fish | string): Relationship {
  const id = typeof b === 'string' ? b : b.id
  let r = a.relationships[id]
  if (!r) {
    r = { score: 0, familiarity: 0, lastSeen: 0, follows: 0, chasedBy: 0, chased: 0 }
    a.relationships[id] = r
  }
  return r
}

export function peekRel(a: Fish, id: string): Relationship | undefined {
  return a.relationships[id]
}

/** how naturally two fish get along, -1..1 */
export function compatibility(a: Fish, b: Fish): number {
  const pa = a.personality
  const pb = b.personality
  let c = 0.25
  if (a.species === b.species) c += 0.35
  c -= Math.abs(pa.social - pb.social) * 0.3
  c -= Math.abs(pa.energy - pb.energy) * 0.2
  c -= (pa.aggression + pb.aggression) * 0.35
  c += (pa.social + pb.social) * 0.15
  return clamp(c, -1, 1)
}

export type RelChange = 'friends' | 'avoids' | null

/**
 * Apply a change to a's view of b. Returns a threshold crossing, if any,
 * so callers can emit "became friends" / "now avoids" events.
 */
export function nudge(a: Fish, b: Fish, dScore: number, dFam = 0, now = 0): RelChange {
  const r = rel(a, b)
  const before = r.score
  r.score = clamp(r.score + dScore, -1, 1)
  r.familiarity = clamp(r.familiarity + dFam)
  if (now) r.lastSeen = now
  if (before < 0.5 && r.score >= 0.5) return 'friends'
  if (before > -0.35 && r.score <= -0.35) return 'avoids'
  return null
}

export function relationLabel(a: Fish, id: string): string {
  const r = a.relationships[id]
  if (!r) return 'stranger'
  if (r.follows >= 4 && r.score > 0.2) return 'follows'
  if (r.score >= 0.6) return 'close'
  if (r.score >= 0.3) return 'friendly'
  if (r.score <= -0.45) return r.chasedBy > r.chased ? 'afraid' : 'hostile'
  if (r.score <= -0.15) return r.chasedBy > 0 ? 'cautious' : 'wary'
  if (r.familiarity > 0.3) return 'acquainted'
  if (r.familiarity > 0.05) return 'neutral'
  return 'stranger'
}

/** slow drift of all relationships toward neutral; called about once a minute */
export function decayRelationships(f: Fish, minutes: number): void {
  const k = Math.pow(0.992, minutes)
  for (const id in f.relationships) {
    const r = f.relationships[id]
    // familiar bonds hold better
    const hold = 0.5 + r.familiarity * 0.5
    r.score *= k + (1 - k) * hold
    r.familiarity *= Math.pow(0.998, minutes)
    if (Math.abs(r.score) < 0.01 && r.familiarity < 0.01 && r.follows === 0) delete f.relationships[id]
  }
}

export function topRelationships(f: Fish, n = 6): [string, Relationship][] {
  return Object.entries(f.relationships)
    .filter(([, r]) => r.familiarity > 0.04 || Math.abs(r.score) > 0.1)
    .sort((a, b) => Math.abs(b[1].score) + b[1].familiarity * 0.5 - (Math.abs(a[1].score) + a[1].familiarity * 0.5))
    .slice(0, n)
}
