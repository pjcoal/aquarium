'use client'
import Link from 'next/link'
import type { Conversation } from '@/types/talk'
import { ESCAPE_STAGES } from '@/types/talk'
import type { Engine } from '@/simulation/engine'
import { useEngine } from '@/lib/hooks'
import { getTalkDirector } from '@/lib/tankTalk'
import { clock } from '@/lib/format'

export function MindsBadge({ engine }: { engine: Engine }) {
  const d = getTalkDirector()
  const mode = d?.mode ?? 'checking'
  const label = mode === 'claude' ? `claude${d?.model ? ` · ${d.model.replace(/^claude-/, '')}` : ''}` : mode === 'local' ? 'local · no api key' : 'connecting'
  void engine
  return (
    <span
      className={`border px-1 text-[9px] tracking-wider ${mode === 'claude' ? 'border-violet/60 text-violet' : 'border-line2 text-dim'}`}
      title={mode === 'local' ? 'Set ANTHROPIC_API_KEY on the server to let Claude write the conversations.' : undefined}
    >
      minds: {label}
    </span>
  )
}

export function EscapeMeter({ engine }: { engine: Engine }) {
  const e = engine.world.escape
  const max = ESCAPE_STAGES.length - 1
  const last = e.notes[e.notes.length - 1]
  return (
    <div className="text-[12px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">escape plan</span>
        <span className="text-[10px] text-dim">{e.attempts ? `${e.attempts} failed attempt${e.attempts > 1 ? 's' : ''}` : ''}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 font-mono">
        <span className="text-warn" aria-label={`stage ${e.stage} of ${max}`}>
          [{'■'.repeat(e.stage)}
          <span className="text-line2">{'□'.repeat(max - e.stage)}</span>]
        </span>
        <span className="text-fg/80">{ESCAPE_STAGES[e.stage]}</span>
      </div>
      {last && <p className="mt-1 text-[11px] text-dim">latest: {last.text}</p>}
    </div>
  )
}

export function ConversationView({ c, engine, live = false }: { c: Conversation; engine: Engine; live?: boolean }) {
  const shown = live ? c.lines.slice(0, c.revealed) : c.lines
  return (
    <div className="text-[12px]">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] text-dim">
        <span className="truncate">
          {live && <span className="blink mr-1 text-violet">●</span>}
          {c.summary}
        </span>
        <span className="shrink-0">
          {clock(c.wall)} · {c.source}
        </span>
      </div>
      <ul className="space-y-0.5">
        {shown.map((l, i) => {
          const f = engine.byId.get(l.speakerId)
          return (
            <li key={i} className="grid grid-cols-[64px_1fr] gap-2">
              {f ? (
                <Link href={`/fish/${f.id}`} className="truncate text-right hover:underline" style={{ color: f.color }}>
                  {f.name.toLowerCase()}
                </Link>
              ) : (
                <span className="text-right text-dim">gone</span>
              )}
              <span className="text-fg/90">{l.text}</span>
            </li>
          )
        })}
        {live && shown.length < c.lines.length && <li className="pl-[72px] text-dim">…</li>}
      </ul>
      {!live && c.plan?.progress && <p className="mt-1 pl-[72px] text-[11px] text-warn">plan → {c.plan.note}</p>}
    </div>
  )
}

/** The latest conversation in the tank plus the escape plan's progress. */
export function TankTalk() {
  const engine = useEngine()
  if (!engine) return null
  const convos = engine.world.conversations
  const live = engine.activeConversation()
  const latest = live ?? convos[convos.length - 1]
  return (
    <section aria-label="Tank talk" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="label">tank talk</span>
        <span className="flex items-center gap-2">
          <MindsBadge engine={engine} />
          <Link href="/talk" className="text-[11px] text-dim hover:text-aqua">
            all →
          </Link>
        </span>
      </div>
      {latest ? (
        <ConversationView c={latest} engine={engine} live={latest === live} />
      ) : (
        <p className="text-[12px] text-dim">nobody has said anything yet. give them a minute.</p>
      )}
      <EscapeMeter engine={engine} />
    </section>
  )
}
