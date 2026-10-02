'use client'
import Link from 'next/link'
import { useEngine } from '@/lib/hooks'
import { ago } from '@/lib/format'

/** The most recent thoughts across the tank. */
export function ThoughtStream({ count = 6 }: { count?: number }) {
  const engine = useEngine()
  if (!engine) return null
  const now = engine.world.worldTime
  const list = engine.world.fish
    .filter((f) => f.lastThought)
    .sort((a, b) => b.lastThoughtAt - a.lastThoughtAt)
    .slice(0, count)
  return (
    <ul className="space-y-2 text-[12px]">
      {list.map((f) => (
        <li key={f.id} className="border-l border-line2 pl-2">
          <div className="flex justify-between text-[10px] text-dim">
            <button className="tracking-widest hover:text-aqua" onClick={() => engine.select(f.id)} aria-label={`Select ${f.name} in the tank`}>
              {f.name.toUpperCase()}
            </button>
            <span>{f.lastThoughtAt ? ago(now - f.lastThoughtAt) : ''}</span>
          </div>
          <p className="text-fg/85 italic">“{f.lastThought}”</p>
        </li>
      ))}
      <li className="pt-1 text-[11px] text-dim">
        select a fish in the tank to inspect it, or <Link href="/fish" className="underline hover:text-aqua">browse all fish</Link>.
      </li>
    </ul>
  )
}
