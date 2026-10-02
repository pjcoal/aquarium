'use client'
import Link from 'next/link'
import { useEngine } from '@/lib/hooks'
import { SPECIES_LIST } from '@/simulation/species'
import { Bar } from '@/components/Bar'
import { FishSprite } from '@/components/FishSprite'

export default function SpeciesPage() {
  const engine = useEngine()
  if (!engine) return null
  return (
    <div className="space-y-4 pt-5">
      <h1 className="text-[13px] tracking-[0.3em]">
        SPECIES <span className="text-dim">[{SPECIES_LIST.length}]</span>
      </h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SPECIES_LIST.map((s) => {
          const members = engine.world.fish.filter((f) => f.species === s.id)
          const params: [string, number][] = [
            ['schooling', s.schooling],
            ['speed', s.maxSpeed / 140],
            ['aggression', s.aggression],
            ['territorial', s.territoriality],
            ['activity', s.activity],
            ['appetite', s.appetite / 1.5],
          ]
          return (
            <section key={s.id} className="panel p-3 text-[12px]" aria-label={s.name}>
              <div className="flex h-[80px] items-center justify-center border border-line bg-[radial-gradient(ellipse_at_center,#0b2c38,#03070b)]">
                <FishSprite look={{ species: s.id, color: s.color, accent: s.accent, scale: 1 }} width={150} height={74} label={s.name} />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <h2 className="font-bold tracking-[0.15em]">{s.name.toUpperCase()}</h2>
                <span className="text-dim" aria-hidden>
                  {s.ascii}
                </span>
              </div>
              <p className="mt-1 text-dim">{s.description}</p>
              <div className="mt-2">
                {params.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[80px_1fr] items-center gap-2 py-0.5">
                    <span className="label">{k}</span>
                    <Bar value={v} label={k} />
                  </div>
                ))}
                <div className="grid grid-cols-[80px_1fr] gap-2 py-0.5">
                  <span className="label">depth</span>
                  <span>
                    {s.depth[0] < 0.3 ? 'upper' : s.depth[0] < 0.55 ? 'middle' : 'lower'}–{s.depth[1] < 0.45 ? 'upper' : s.depth[1] < 0.75 ? 'middle' : 'bottom'}
                  </span>
                </div>
              </div>
              <div className="label mt-2 mb-0.5">in the tank · {members.length}</div>
              <ul className="flex flex-wrap gap-x-3">
                {members.map((f) => (
                  <li key={f.id}>
                    <Link href={`/fish/${f.id}`} className="hover:text-aqua">
                      {f.name}
                    </Link>
                  </li>
                ))}
                {!members.length && <li className="text-dim">none yet</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
