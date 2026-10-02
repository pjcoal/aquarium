'use client'
import Link from 'next/link'
import { Fragment } from 'react'
import type { SimEvent } from '@/types/events'
import type { Engine } from '@/simulation/engine'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Renders event text with fish names (and the school name) linked. */
export function EventText({ ev, engine }: { ev: SimEvent; engine: Engine }) {
  const links = new Map<string, string>()
  for (const id of ev.fish) {
    const f = engine.byId.get(id)
    if (f) links.set(f.name, `/fish/${f.id}`)
  }
  const school = ev.schoolId ? engine.schoolById(ev.schoolId) : undefined
  if (school) links.set(school.name, '/schools')
  if (!links.size) return <>{ev.text}</>
  const names = [...links.keys()].sort((a, b) => b.length - a.length)
  const parts = ev.text.split(new RegExp(`\\b(${names.map(esc).join('|')})\\b`, 'g'))
  return (
    <>
      {parts.map((p, i) =>
        links.has(p) ? (
          <Link key={i} href={links.get(p)!} className="text-fg underline decoration-line2 underline-offset-2 hover:text-aqua hover:decoration-aqua">
            {p}
          </Link>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

export const CAT_COLOR: Record<string, string> = {
  social: 'text-aqua',
  feeding: 'text-warn',
  exploration: 'text-sky',
  territorial: 'text-bad',
  discovery: 'text-violet',
  resting: 'text-dim',
  market: 'text-good',
  system: 'text-fg',
}
