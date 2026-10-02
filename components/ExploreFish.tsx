'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { Fish } from '@/types/fish'
import { useEngine } from '@/lib/hooks'
import { FishCard } from './FishCard'

const FILTERS = ['ALL', 'AWAKE', 'RESTING', 'HUNGRY', 'EXPLORING', 'SCHOOLING', 'ALONE'] as const
type Filter = (typeof FILTERS)[number]
const SORTS = ['newest', 'most active', 'most social', 'most discoveries'] as const
type Sort = (typeof SORTS)[number]

const match: Record<Filter, (f: Fish) => boolean> = {
  ALL: () => true,
  AWAKE: (f) => f.action !== 'REST',
  RESTING: (f) => f.action === 'REST',
  HUNGRY: (f) => f.hunger > 0.6,
  EXPLORING: (f) => f.action === 'EXPLORE' || f.action === 'INVESTIGATE',
  SCHOOLING: (f) => !!f.schoolId,
  ALONE: (f) => !f.schoolId && f.action !== 'FOLLOW',
}

const sociability = (f: Fish) => Object.values(f.relationships).filter((r) => r.score > 0.25).length * 2 + f.stats.interactions

const sorter: Record<Sort, (a: Fish, b: Fish) => number> = {
  newest: (a, b) => b.introducedAt - a.introducedAt,
  'most active': (a, b) => b.stats.activity - a.stats.activity,
  'most social': (a, b) => sociability(b) - sociability(a),
  'most discoveries': (a, b) => b.discoveries.length - a.discoveries.length,
}

export function ExploreFish({ limit, title = 'explore fish' }: { limit?: number; title?: string }) {
  const engine = useEngine()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sort, setSort] = useState<Sort>('newest')
  if (!engine) return null
  const fish = engine.world.fish
  const list = fish
    .filter(match[filter])
    .filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase().trim()))
    .sort(sorter[sort])
  const shown = limit ? list.slice(0, limit) : list

  return (
    <section aria-labelledby="explore-h">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="explore-h" className="text-[13px] tracking-[0.3em] text-fg">
          {title.toUpperCase()} <span className="text-dim">[{list.length}]</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="fish-search">
            search by fish name
          </label>
          <input
            id="fish-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search name…"
            className="w-40 border border-line2 bg-ink px-2 py-1 text-[12px] text-fg placeholder:text-faint focus:border-aqua focus:outline-none"
          />
          <label className="label" htmlFor="fish-sort">
            sort
          </label>
          <select
            id="fish-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="border border-line2 bg-ink px-2 py-1 text-[12px] text-fg focus:border-aqua focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filter fish">
        {FILTERS.map((f) => (
          <button key={f} className="btn" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f} <span className="opacity-60">{fish.filter(match[f]).length}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((f) => (
            <FishCard key={f.id} fish={f} engine={engine} />
          ))}
        </div>
      ) : (
        <p className="border border-line p-4 text-[12px] text-dim">no fish match.</p>
      )}
      {limit && list.length > limit && (
        <Link href="/fish" className="btn mt-3 inline-block">
          all {list.length} fish →
        </Link>
      )}
    </section>
  )
}
