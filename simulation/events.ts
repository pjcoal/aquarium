import type { EventCategory, SimEvent } from '@/types/events'
import type { WorldState } from '@/types/simulation'

export const MAX_EVENTS = 600

/** Event log with per-key cooldowns so repetitive behaviors don't spam the feed. */
export class EventLog {
  private cooldowns = new Map<string, number>()
  /** when set, events are timestamped with this wall clock (used for offline catch-up) */
  wallOverride: number | null = null
  listeners = new Set<(e: SimEvent) => void>()

  constructor(private world: () => WorldState) {}

  emit(cat: EventCategory, text: string, fish: string[] = [], opts?: { key?: string; cooldownMs?: number; schoolId?: string }): SimEvent | null {
    const w = this.world()
    if (opts?.key) {
      const until = this.cooldowns.get(opts.key) ?? 0
      if (w.worldTime < until) return null
      this.cooldowns.set(opts.key, w.worldTime + (opts.cooldownMs ?? 60_000))
    }
    const e: SimEvent = {
      id: w.counters.nextEventId++,
      wall: this.wallOverride ?? Date.now(),
      wt: w.worldTime,
      cat,
      text,
      fish,
      schoolId: opts?.schoolId,
    }
    w.events.push(e)
    if (w.events.length > MAX_EVENTS) w.events.splice(0, w.events.length - MAX_EVENTS)
    for (const l of this.listeners) l(e)
    return e
  }

  pruneCooldowns(now: number) {
    for (const [k, t] of this.cooldowns) if (t < now) this.cooldowns.delete(k)
  }
}
