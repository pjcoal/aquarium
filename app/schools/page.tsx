'use client'
import Link from 'next/link'
import { useEngine } from '@/lib/hooks'
import { SPECIES } from '@/simulation/species'
import { schoolBehavior } from '@/simulation/schooling'
import { age } from '@/lib/format'
import { ActivityFeed } from '@/components/ActivityFeed'

export default function SchoolsPage() {
  const engine = useEngine()
  if (!engine) return null
  const w = engine.world
  const now = w.worldTime
  const schools = [...w.schools].sort((a, b) => b.members.length - a.members.length)
  const solitary = w.fish.filter((f) => !f.schoolId)

  return (
    <div className="space-y-4 pt-5">
      <div>
        <h1 className="text-[13px] tracking-[0.3em]">
          SCHOOLS <span className="text-dim">[{schools.length}]</span>
        </h1>
        <p className="mt-1 max-w-[70ch] text-[12px] text-dim">
          schools are not assigned. they form when compatible fish spend time together, and they break apart through quarrels, drift, and
          independence. names are given by the founding species.
        </p>
      </div>

      {schools.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((s) => {
            const leader = engine.byId.get(s.leaderId)
            const species = new Map<string, number>()
            for (const id of s.members) {
              const m = engine.byId.get(id)
              if (m) species.set(SPECIES[m.species].name, (species.get(SPECIES[m.species].name) ?? 0) + 1)
            }
            return (
              <section key={s.id} className="panel p-3 text-[12px]" aria-label={s.name}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[15px] font-bold tracking-[0.2em]" style={{ color: `hsl(${s.hue} 80% 70%)` }}>
                    {s.name.toUpperCase()}
                  </h2>
                  <span className="text-dim">{s.members.length} fish</span>
                </div>
                <dl className="mt-2 grid grid-cols-[90px_1fr] gap-y-1">
                  <dt className="label">territory</dt>
                  <dd>{s.territory}</dd>
                  <dt className="label">behavior</dt>
                  <dd>{schoolBehavior(engine, s)}</dd>
                  <dt className="label">depth</dt>
                  <dd>{s.band}</dd>
                  <dt className="label">leader</dt>
                  <dd>
                    {leader ? (
                      <Link href={`/fish/${leader.id}`} className="hover:text-aqua">
                        {leader.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                  <dt className="label">formed</dt>
                  <dd>{age(now - s.createdAt)} ago</dd>
                  <dt className="label">species</dt>
                  <dd className="text-dim">{[...species.entries()].map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ')}</dd>
                </dl>
                <div className="label mt-3 mb-1">members</div>
                <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {s.members.map((id) => {
                    const m = engine.byId.get(id)
                    if (!m) return null
                    return (
                      <li key={id}>
                        <Link href={`/fish/${id}`} className={`hover:text-aqua ${m.action === 'REST' ? 'text-dim' : ''}`}>
                          {m.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                <div className="label mt-3 mb-1">recent</div>
                <ActivityFeed schoolId={s.id} limit={4} showCategory={false} className="text-[11px]" />
              </section>
            )
          })}
        </div>
      ) : (
        <p className="panel p-4 text-[12px] text-dim">no schools right now. the fish are on their own, for the moment.</p>
      )}

      <section className="panel p-3" aria-label="Solitary fish">
        <h2 className="label mb-2">swimming alone · {solitary.length}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {solitary.map((f) => (
            <li key={f.id}>
              <Link href={`/fish/${f.id}`} className="hover:text-aqua">
                {f.name}
              </Link>{' '}
              <span className="text-dim">{f.territoryId ? `· holds ${engine.placeById(f.territoryId)?.name}` : `· ${f.action.toLowerCase()}`}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
