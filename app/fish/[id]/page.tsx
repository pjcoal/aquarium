'use client'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEngine } from '@/lib/hooks'
import { SPECIES } from '@/simulation/species'
import { PRESETS, statusOf } from '@/simulation/fish'
import { relationLabel } from '@/simulation/relationships'
import { age, ago, clock, depthLabel, dur, pct } from '@/lib/format'
import { FishSprite } from '@/components/FishSprite'
import { MiniMap } from '@/components/MiniMap'
import { Bar } from '@/components/Bar'
import { ActivityFeed } from '@/components/ActivityFeed'
import { REL_COLOR, STATUS_COLOR } from '@/components/FishInspector'
import { CoinPanel } from '@/components/CoinPanel'
import { modelLabel } from '@/lib/models'

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel p-3 ${className}`} aria-label={title}>
      <h2 className="label mb-2">{title}</h2>
      {children}
    </section>
  )
}

export default function FishProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const engine = useEngine()
  if (!engine) return <div className="pt-6 text-[12px] text-dim">connecting to tank…</div>
  const fish = engine.byId.get(id)
  if (!fish) {
    return (
      <div className="pt-8 text-[13px]">
        <p className="text-dim">no fish with id “{id}” lives in this tank.</p>
        <Link href="/fish" className="btn mt-3 inline-block">
          ← all fish
        </Link>
      </div>
    )
  }

  const sp = SPECIES[fish.species]
  const now = engine.world.worldTime
  const status = statusOf(fish)
  const school = engine.schoolById(fish.schoolId)
  const territory = engine.placeById(fish.territoryId)
  const rels = Object.entries(fish.relationships)
    .filter(([oid]) => engine.byId.has(oid))
    .sort((a, b) => b[1].score - a[1].score)
  const P = fish.personality

  const viewInTank = () => {
    engine.ui.selectedId = fish.id
    engine.ui.track = true
    engine.notify()
    router.push('/')
  }

  return (
    <div className="space-y-3 pt-4">
      <nav aria-label="Breadcrumb" className="text-[11px] text-dim">
        <Link href="/fish" className="hover:text-aqua">
          fish
        </Link>{' '}
        / {fish.name.toLowerCase()}
      </nav>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="panel grid gap-4 p-4 sm:grid-cols-[minmax(0,300px)_1fr]" aria-label="Identity">
          <div className="flex flex-col gap-2">
            <div className="flex h-[170px] items-center justify-center border border-line bg-ink">
              <FishSprite look={{ species: fish.species, color: fish.color }} width={280} height={160} animate label={`${fish.name}, a ${sp.name}`} />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[0.2em]">{fish.name.toUpperCase()}</h1>
            <div className="text-dim">{sp.name.toLowerCase()}</div>
            <div className={`mt-1 text-[12px] tracking-widest ${STATUS_COLOR[status]}`}>● {status}</div>
            <dl className="mt-3 grid grid-cols-[100px_1fr] gap-y-1 text-[12px]">
              <dt className="label">age</dt>
              <dd>{age(now - fish.createdAt)}</dd>
              <dt className="label">introduced</dt>
              <dd>{new Date(fish.introducedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              <dt className="label">personality</dt>
              <dd>
                {fish.preset.toLowerCase()} <span className="text-dim">— {PRESETS[fish.preset].blurb}</span>
              </dd>
              {fish.personalityText && (
                <>
                  <dt className="label">in its words</dt>
                  <dd className="text-fg/80 italic">{fish.personalityText}</dd>
                </>
              )}
              <dt className="label">mood</dt>
              <dd>{fish.mood}</dd>
              <dt className="label">depth</dt>
              <dd>{depthLabel(fish.pos.y)}</dd>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn border-aqua-dim! text-aqua!" onClick={viewInTank}>
                view in tank
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-3">
          <Panel title="the coin">
            <CoinPanel engine={engine} mint={fish.id} />
          </Panel>
          <Panel title="current thought">
            <p className="text-[15px] leading-relaxed text-fg italic">“{fish.lastThought || '…'}”</p>
            {fish.thoughts[0]?.model && <p className="mt-0.5 text-[10px] tracking-wider text-violet uppercase">thought by {modelLabel(fish.thoughts[0].model)}</p>}
            <ul className="mt-2 space-y-0.5 text-[11px] text-dim">
              {fish.thoughts.slice(1, 5).map((t, i) => (
                <li key={i}>
                  <span className="tabular-nums">{ago(now - t.t)}</span> — “{t.text}”{t.model && t.model !== 'local' ? ` (${modelLabel(t.model)})` : ''}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="current activity">
            <p className="text-aqua">{fish.actionDetail}</p>
            <p className="mt-0.5 text-[11px] text-dim">
              state {fish.action.toLowerCase()} for {dur(now - fish.actionSince)}
            </p>
          </Panel>
          <Panel title="location">
            <MiniMap fishId={fish.id} height={150} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="vitals">
          {(
            [
              ['energy', fish.energy, 'good'],
              ['hunger', fish.hunger, fish.hunger > 0.7 ? 'bad' : 'warn'],
              ['curiosity', fish.curiosity, 'violet'],
              ['stress', fish.stress, 'bad'],
            ] as const
          ).map(([k, v, tone]) => (
            <div key={k} className="mb-1.5 grid grid-cols-[72px_40px_1fr] items-center gap-2 text-[12px]">
              <span className="label">{k}</span>
              <span className="tabular-nums">{pct(v)}</span>
              <Bar value={v} tone={tone} label={k} />
            </div>
          ))}
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[12px]">
            <dt className="label">meals</dt>
            <dd className="tabular-nums">{fish.stats.meals}</dd>
            <dt className="label">distance</dt>
            <dd className="tabular-nums">{(fish.stats.distance / 1000).toFixed(1)}k units</dd>
            <dt className="label">interactions</dt>
            <dd className="tabular-nums">{fish.stats.interactions}</dd>
            <dt className="label">chases</dt>
            <dd className="tabular-nums">{fish.stats.chases}</dd>
            <dt className="label">times fled</dt>
            <dd className="tabular-nums">{fish.stats.fled}</dd>
          </dl>
        </Panel>

        <Panel title="personality">
          {(Object.keys(P) as (keyof typeof P)[]).map((k) => (
            <div key={k} className="mb-1.5 grid grid-cols-[80px_1fr] items-center gap-2 text-[12px]">
              <span className="label">{k}</span>
              <Bar value={P[k]} label={k} />
            </div>
          ))}
          <div className="mt-3 text-[11px] text-dim">
            <div className="label mb-1">species traits</div>
            {sp.traits.join(' · ')}
          </div>
        </Panel>

        <Panel title="social">
          <div className="text-[12px]">
            <div className="label">school</div>
            {school ? (
              <div className="mb-2">
                <Link href="/schools" className="text-aqua hover:underline">
                  {school.name}
                </Link>
                <span className="text-dim"> · {school.members.length} fish · {school.territory}</span>
                {school.leaderId === fish.id && <span className="ml-1 text-warn">· leads</span>}
              </div>
            ) : (
              <p className="mb-2 text-dim">swims alone</p>
            )}
            {territory && (
              <>
                <div className="label">territory</div>
                <p className="mb-2 text-warn">claims {territory.name}</p>
              </>
            )}
          </div>
          <div className="label mb-1">relationships</div>
          {rels.length ? (
            <ul className="scroll-thin max-h-[220px] overflow-y-auto text-[12px]">
              {rels.map(([oid, r]) => {
                const o = engine.byId.get(oid)!
                const l = relationLabel(fish, oid)
                return (
                  <li key={oid} className="grid grid-cols-[1fr_56px_76px] items-center gap-2 py-0.5">
                    <Link href={`/fish/${oid}`} className="truncate hover:text-aqua">
                      {o.name}
                    </Link>
                    <div className="relative h-1.5 bg-line/60" aria-hidden>
                      <div
                        className={`absolute top-0 h-full ${r.score >= 0 ? 'left-1/2 bg-good/70' : 'right-1/2 bg-bad/70'}`}
                        style={{ width: `${Math.abs(r.score) * 50}%` }}
                      />
                    </div>
                    <span className={`text-right ${REL_COLOR[l] ?? 'text-dim'}`}>{l}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-[12px] text-dim">knows nobody yet.</p>
          )}
        </Panel>

        <Panel title={`discoveries · ${fish.discoveries.length}`}>
          {fish.discoveries.length ? (
            <ul className="scroll-thin max-h-[300px] space-y-0.5 overflow-y-auto text-[12px]">
              {fish.discoveries.map((d, i) => (
                <li key={i} className="grid grid-cols-[64px_1fr] gap-2">
                  <span className="text-dim tabular-nums">{ago(now - d.t)}</span>
                  <span>
                    {d.name}
                    {d.first && <span className="ml-1 text-violet">first</span>}
                    {d.viaFishId && <span className="ml-1 text-dim">via {engine.byId.get(d.viaFishId)?.name ?? 'someone'}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-dim">hasn&apos;t found anything yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="memory timeline">
          <ol className="scroll-thin ml-1 max-h-[360px] overflow-y-auto pl-1 text-[12px]">
            {fish.memories.map((m, i) => (
              <li key={i} className="relative border-l border-line2 pb-2 pl-3">
                <span
                  className={`absolute top-1.5 -left-[3.5px] h-1.5 w-1.5 rounded-full ${m.valence > 0.2 ? 'bg-good' : m.valence < -0.2 ? 'bg-bad' : 'bg-dim'}`}
                  aria-hidden
                />
                <div className="text-[10px] text-dim tabular-nums">
                  {ago(now - m.t)} · {m.kind}
                </div>
                <div>{m.text}</div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="action history">
          <ol className="scroll-thin max-h-[360px] overflow-y-auto text-[12px]">
            {fish.history.map((h, i) => (
              <li key={i} className="grid grid-cols-[64px_84px_1fr] gap-2 border-b border-line/40 py-0.5">
                <span className="text-dim tabular-nums">{ago(now - h.t)}</span>
                <span className="text-aqua-dim">{h.action.toLowerCase()}</span>
                <span className="truncate">{h.detail}</span>
              </li>
            ))}
            {!fish.history.length && <li className="text-dim">no recorded actions yet.</li>}
          </ol>
        </Panel>
        <Panel title="events involving this fish">
          <div className="scroll-thin max-h-[360px] overflow-y-auto">
            <ActivityFeed fishId={fish.id} limit={60} showCategory={false} />
          </div>
          <p className="mt-2 text-[10px] text-dim">times shown in your local clock · now {clock(Date.now())}</p>
        </Panel>
      </div>
    </div>
  )
}
