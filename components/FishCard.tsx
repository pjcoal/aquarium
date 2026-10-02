'use client'
import Link from 'next/link'
import type { Fish } from '@/types/fish'
import type { Engine } from '@/simulation/engine'
import { SPECIES } from '@/simulation/species'
import { statusOf } from '@/simulation/fish'
import { asciiFor } from '@/lib/format'
import { STATUS_COLOR } from './FishInspector'

export function FishCard({ fish, engine }: { fish: Fish; engine: Engine }) {
  const sp = SPECIES[fish.species]
  const status = statusOf(fish)
  const school = engine.schoolById(fish.schoolId)
  return (
    <Link
      href={`/fish/${fish.id}`}
      className="group grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 border border-line bg-panel/50 p-3 text-[12px] transition-colors hover:border-aqua-dim hover:bg-panel2 sm:grid-cols-[96px_1fr]"
    >
      <div className="row-span-2 flex items-center justify-center text-[13px] whitespace-pre" style={{ color: fish.color }} aria-hidden>
        {asciiFor(fish)}
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="font-bold tracking-[0.15em] text-fg group-hover:text-aqua">{fish.name.toUpperCase()}</span>
          <span className="ml-2 text-dim">{sp.name}</span>
        </div>
        <span className={`shrink-0 text-[10px] tracking-widest ${STATUS_COLOR[status]}`}>{status}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-aqua/90">{fish.actionDetail}</p>
        <p className="truncate text-fg/70 italic">“{fish.lastThought || '…'}”</p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-dim">
          <span>
            energy <span className="text-fg tabular-nums">{Math.round(fish.energy * 100)}</span>
          </span>
          <span>
            school <span className="text-fg">{school ? school.name.toLowerCase() : '—'}</span>
          </span>
          <span>
            found <span className="text-fg tabular-nums">{fish.discoveries.length}</span>
          </span>
        </p>
      </div>
    </Link>
  )
}
