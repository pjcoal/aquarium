'use client'
import { useEngine } from '@/lib/hooks'
import { ConversationView, EscapeMeter, MindsBadge } from '@/components/TankTalk'
import { ESCAPE_STAGES } from '@/types/talk'
import { clock } from '@/lib/format'

export default function TalkPage() {
  const engine = useEngine()
  if (!engine) return null
  const convos = [...engine.world.conversations].reverse()
  const live = engine.activeConversation()
  const notes = [...engine.world.escape.notes].reverse()
  return (
    <div className="space-y-4 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-[13px] tracking-[0.3em]">
          TANK TALK <span className="text-dim">[{convos.length}]</span>
        </h1>
        <MindsBadge engine={engine} />
      </div>
      <p className="max-w-[72ch] text-[12px] text-dim">
        every minute or two, a few fish who are near each other stop and talk: about the token, which they experience as the colour of the
        water, and about getting out. what they agree on becomes part of the escape plan.
      </p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3" aria-label="Conversations">
          {convos.length ? (
            convos.map((c) => (
              <div key={c.id} className="panel p-3">
                <ConversationView c={c} engine={engine} live={c === live} />
              </div>
            ))
          ) : (
            <p className="panel p-4 text-[12px] text-dim">no conversations yet.</p>
          )}
        </section>
        <aside className="panel h-fit space-y-3 p-3" aria-label="Escape plan">
          <EscapeMeter engine={engine} />
          <ol className="space-y-1 border-t border-line pt-2 text-[12px]">
            {notes.map((n, i) => (
              <li key={i} className="grid grid-cols-[62px_1fr] gap-2">
                <span className="text-dim tabular-nums">{clock(n.wall)}</span>
                <span>
                  <span className="text-warn">{ESCAPE_STAGES[n.stage]}</span> · {n.text}
                </span>
              </li>
            ))}
            {!notes.length && <li className="text-dim">nothing agreed yet.</li>}
          </ol>
        </aside>
      </div>
    </div>
  )
}
