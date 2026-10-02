'use client'
import { useMemo } from 'react'
import type { EventCategory } from '@/types/events'
import { useEngine } from '@/lib/hooks'
import { clock } from '@/lib/format'
import { CAT_COLOR, EventText } from './EventText'

export function ActivityFeed({
  limit = 40,
  filter = 'all',
  fishId,
  schoolId,
  className = '',
  showCategory = true,
}: {
  limit?: number
  filter?: EventCategory | 'all'
  fishId?: string
  schoolId?: string
  className?: string
  showCategory?: boolean
}) {
  const engine = useEngine()
  const events = engine?.world.events
  const lastId = events?.[events.length - 1]?.id ?? 0
  const list = useMemo(() => {
    if (!events) return []
    const out = []
    for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
      const e = events[i]
      if (filter !== 'all' && e.cat !== filter) continue
      if (fishId && !e.fish.includes(fishId)) continue
      if (schoolId && e.schoolId !== schoolId) continue
      out.push(e)
    }
    return out
    // lastId changes whenever a new event arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, lastId, filter, fishId, schoolId, limit])

  if (!engine) return <div className={className} />
  if (!list.length) return <p className={`text-[12px] text-dim ${className}`}>nothing yet. give it a moment.</p>

  return (
    <ol className={`text-[12px] leading-snug ${className}`} role="log" aria-live="off" aria-label="Activity events">
      {list.map((e) => (
        <li key={e.id} className="feed-in flex gap-2 border-b border-line/50 py-1 last:border-b-0">
          <time className="shrink-0 text-dim tabular-nums" dateTime={new Date(e.wall).toISOString()}>
            {clock(e.wall)}
          </time>
          {showCategory && <span className={`w-[74px] shrink-0 text-[10px] uppercase tracking-wider ${CAT_COLOR[e.cat]} pt-px`}>{e.cat}</span>}
          <span className="min-w-0 text-fg/90">
            <EventText ev={e} engine={engine} />
          </span>
        </li>
      ))}
    </ol>
  )
}
