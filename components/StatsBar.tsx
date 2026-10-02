'use client'
import { useEngine } from '@/lib/hooks'
import { worldClock } from '@/lib/format'
import { MarketStrip } from './MarketStrip'

export function StatsBar() {
  const engine = useEngine()
  if (!engine) return <div className="h-[58px] border border-line" aria-hidden />
  const w = engine.world
  const awake = w.fish.filter((f) => f.action !== 'REST').length
  const stats: [string, number | string][] = [
    ['fish', w.fish.length],
    ['awake', awake],
    ['schools', w.schools.length],
    ['interactions', w.counters.interactions],
    ['discoveries', w.counters.discoveries],
    ['territories', Object.keys(w.territories).length],
  ]
  return (
    <section aria-label="Tank statistics" className="flex flex-wrap items-stretch border border-line bg-panel/60">
      {stats.map(([k, v]) => (
        <div key={k} className="min-w-[96px] flex-1 border-r border-line px-3 py-2">
          <div className="text-[20px] leading-none text-fg tabular-nums">{v}</div>
          <div className="label mt-1">{k}</div>
        </div>
      ))}
      <MarketStrip className="min-w-[240px] flex-[1.6] border-r border-line px-3 py-2 whitespace-nowrap" />
      <div className="hidden min-w-[150px] flex-1 px-3 py-2 md:block">
        <div className="text-[13px] leading-tight text-aqua tabular-nums">{worldClock(w.worldTime)}</div>
        <div className="label mt-1.5">world time · {engine.phase}</div>
      </div>
    </section>
  )
}
