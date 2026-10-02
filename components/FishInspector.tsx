'use client'
import Link from 'next/link'
import type { Fish } from '@/types/fish'
import type { Engine } from '@/simulation/engine'
import { SPECIES } from '@/simulation/species'
import { relationLabel, topRelationships } from '@/simulation/relationships'
import { statusOf } from '@/simulation/fish'
import { age, ago, depthLabel, pct } from '@/lib/format'
import { Bar } from './Bar'
import { FishSprite } from './FishSprite'
import { CoinPanel } from './CoinPanel'

export const STATUS_COLOR: Record<string, string> = {
  AWAKE: 'text-good',
  RESTING: 'text-sky',
  HIDING: 'text-violet',
  FLEEING: 'text-bad',
  ARRIVING: 'text-warn',
}

export const REL_COLOR: Record<string, string> = {
  close: 'text-good',
  friendly: 'text-good/80',
  follows: 'text-aqua',
  acquainted: 'text-fg/80',
  neutral: 'text-dim',
  stranger: 'text-dim',
  wary: 'text-warn/80',
  cautious: 'text-warn',
  afraid: 'text-bad',
  hostile: 'text-bad',
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-baseline gap-2 py-0.5">
      <dt className="label">{k}</dt>
      <dd className="min-w-0 text-[12px] text-fg">{children}</dd>
    </div>
  )
}

export function FishInspector({ fish, engine, onClose }: { fish: Fish; engine: Engine; onClose?: () => void }) {
  const sp = SPECIES[fish.species]
  const now = engine.world.worldTime
  const status = statusOf(fish)
  const school = engine.schoolById(fish.schoolId)
  const territory = engine.placeById(fish.territoryId)
  const rels = topRelationships(fish, 5)

  return (
    <section aria-label={`Inspector: ${fish.name}`} className="text-[12px]">
      <header className="flex items-start gap-3 border-b border-line pb-2">
        <div className="shrink-0 border border-line bg-ink">
          <FishSprite look={fish} width={76} height={48} label={`${fish.name}, ${sp.name}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold tracking-[0.15em] text-fg">{fish.name.toUpperCase()}</h2>
          <div className="text-dim">{sp.name.toLowerCase()}</div>
          <div className={`mt-0.5 text-[11px] tracking-widest ${STATUS_COLOR[status]}`}>● {status}</div>
        </div>
        {onClose && (
          <button className="btn shrink-0" onClick={onClose} aria-label="Close inspector">
            ×
          </button>
        )}
      </header>

      <div className="mt-2 border-b border-line pb-2">
        <CoinPanel engine={engine} mint={fish.id} compact />
      </div>

      <div className="mt-2">
        <div className="label">currently</div>
        <p className="text-aqua">{fish.actionDetail}</p>
      </div>

      {engine.speech.get(fish.id) && (
        <p className="mt-2 border border-line2 px-2 py-1 text-[12px]">
          <span className="label mr-1">says</span>
          {engine.speech.get(fish.id)!.text}
        </p>
      )}
      <blockquote className="mt-2 border-l-2 border-aqua-dim/60 pl-2 text-[12px] leading-relaxed text-fg/90 italic">
        “{fish.lastThought || '…'}”
        {fish.lastThoughtAt > 0 && <span className="ml-1 text-[10px] text-dim not-italic">{ago(now - fish.lastThoughtAt)}</span>}
      </blockquote>

      <dl className="mt-2">
        <Row k="mood">{fish.mood}</Row>
        <Row k="energy">
          <div className="flex items-center gap-2">
            <span className="w-9 tabular-nums">{pct(fish.energy)}</span>
            <Bar value={fish.energy} tone="good" label="energy" />
          </div>
        </Row>
        <Row k="hunger">
          <div className="flex items-center gap-2">
            <span className="w-9 tabular-nums">{pct(fish.hunger)}</span>
            <Bar value={fish.hunger} tone={fish.hunger > 0.7 ? 'bad' : 'warn'} label="hunger" />
          </div>
        </Row>
        <Row k="depth">{depthLabel(fish.pos.y)}</Row>
        <Row k="school">{school ? <Link href="/schools" className="hover:text-aqua">{school.name.toLowerCase()}</Link> : <span className="text-dim">none</span>}</Row>
        {territory && <Row k="territory">{territory.name}</Row>}
        <Row k="discoveries">{fish.discoveries.length}</Row>
        <Row k="age">{age(now - fish.createdAt)}</Row>
      </dl>

      <div className="mt-3">
        <div className="label mb-1">relationships</div>
        {rels.length ? (
          <ul>
            {rels.map(([id]) => {
              const o = engine.byId.get(id)
              if (!o) return null
              const l = relationLabel(fish, id)
              return (
                <li key={id} className="flex justify-between gap-2">
                  <Link href={`/fish/${id}`} className="truncate hover:text-aqua">
                    {o.name}
                  </Link>
                  <span className={REL_COLOR[l] ?? 'text-dim'}>{l}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-dim">knows nobody yet.</p>
        )}
      </div>

      <div className="mt-3">
        <div className="label mb-1">memories</div>
        <ul className="space-y-0.5">
          {fish.memories.slice(0, 4).map((m, i) => (
            <li key={i} className="grid grid-cols-[64px_1fr] gap-2">
              <span className="text-dim tabular-nums">{ago(now - m.t)}</span>
              <span className={m.valence < -0.2 ? 'text-warn' : 'text-fg/90'}>{m.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link href={`/fish/${fish.id}`} className="btn mt-3 block w-full text-center">
        open full profile →
      </Link>
    </section>
  )
}
