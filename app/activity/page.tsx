'use client'
import { useState } from 'react'
import type { EventCategory } from '@/types/events'
import { useEngine } from '@/lib/hooks'
import { ActivityFeed } from '@/components/ActivityFeed'

const FILTERS: (EventCategory | 'all')[] = ['all', 'social', 'feeding', 'exploration', 'territorial', 'discovery', 'resting', 'market', 'system']

export default function ActivityPage() {
  const engine = useEngine()
  const [filter, setFilter] = useState<EventCategory | 'all'>('all')
  if (!engine) return null
  const events = engine.world.events
  const count = (c: EventCategory | 'all') => (c === 'all' ? events.length : events.filter((e) => e.cat === c).length)
  return (
    <div className="space-y-3 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-[13px] tracking-[0.3em]">ACTIVITY</h1>
        <p className="text-[11px] text-dim">
          every event below was produced by the simulation · last {events.length} kept
        </p>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button key={f} className="btn" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f} <span className="opacity-60">{count(f)}</span>
          </button>
        ))}
      </div>
      <div className="panel p-3">
        <ActivityFeed filter={filter} limit={600} />
      </div>
    </div>
  )
}
