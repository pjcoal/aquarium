'use client'
import Link from 'next/link'
import { useEngine } from '@/lib/hooks'
import { SPECIES } from '@/simulation/species'
import { statusOf } from '@/simulation/fish'
import { age } from '@/lib/format'
import { FishSprite } from './FishSprite'
import { STATUS_COLOR } from './FishInspector'

export function RecentlyIntroduced({ count = 6 }: { count?: number }) {
  const engine = useEngine()
  if (!engine) return null
  const now = engine.world.worldTime
  const list = [...engine.world.fish].sort((a, b) => b.introducedAt - a.introducedAt).slice(0, count)
  return (
    <section aria-labelledby="recent-h">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="recent-h" className="text-[13px] tracking-[0.3em] text-fg">
          RECENTLY INTRODUCED
        </h2>
        <Link href="/coins" className="text-[11px] text-dim hover:text-aqua">
          all launched coins →
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {list.map((f) => {
          const s = statusOf(f)
          return (
            <li key={f.id}>
              <Link href={`/fish/${f.id}`} className="block border border-line bg-panel/50 p-2 hover:border-aqua-dim">
                <div className="flex h-[52px] items-center justify-center bg-ink">
                  <FishSprite look={f} width={84} height={50} label={`${f.name}, ${SPECIES[f.species].name}`} />
                </div>
                <div className="mt-1.5 text-[12px] font-bold tracking-[0.12em]">{f.name.toUpperCase()}</div>
                <div className="text-[11px] text-dim">{SPECIES[f.species].name.toLowerCase()}</div>
                <div className="mt-0.5 flex justify-between text-[10px]">
                  <span className="text-dim">age {age(now - f.createdAt)}</span>
                  <span className={STATUS_COLOR[s]}>{s}</span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
