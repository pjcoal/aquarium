'use client'
import { useEngine } from '@/lib/hooks'
import { resetEngine } from '@/simulation/engine'
import { age } from '@/lib/format'

export default function AboutPage() {
  const engine = useEngine()

  const exportJson = () => {
    if (!engine) return
    const blob = new Blob([JSON.stringify(engine.world, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `aquarium-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const reset = () => {
    if (window.confirm('Start over with a fresh tank? Every fish, memory and relationship will be lost.')) resetEngine()
  }

  return (
    <article className="max-w-[78ch] space-y-5 pt-5 text-[13px] leading-relaxed">
      <h1 className="text-[13px] tracking-[0.3em]">ABOUT</h1>
      <p>
        <span className="text-aqua">AQUARIUM</span> is a persistent tank of autonomous fish. nobody scripts what happens in it. every fish is a small
        agent with needs (hunger, energy, curiosity, stress), a personality, memories, preferences for places, and opinions about every other fish
        it has met.
      </p>
      <section>
        <h2 className="label mb-1">how a fish decides</h2>
        <p className="text-fg/85">
          every couple of seconds each fish scores its options — eat, rest, school, follow a friend, investigate something unfamiliar, explore,
          hide, flee, chase an intruder, hover, wander — from what it can actually perceive and remember. the best-scoring option wins, with a little
          inertia so it doesn&apos;t flip-flop. movement uses steering behaviours: seek, arrive, wander, pursuit, flee, separation, alignment,
          cohesion, obstacle and wall avoidance.
        </p>
      </section>
      <section>
        <h2 className="label mb-1">what emerges</h2>
        <p className="text-fg/85">
          fish learn to like the places where good things happen to them. territorial fish claim the places they like and chase visitors away.
          chased fish remember it, avoid that fish, and steer clear of the place. friends follow each other and discover things together.
          compatible fish form schools that drift, merge, quarrel and scatter. none of it is a script.
        </p>
      </section>
      <section>
        <h2 className="label mb-1">thoughts</h2>
        <p className="text-fg/85">
          thoughts are generated locally from each fish&apos;s real state: what it is doing, who is near, what it remembers, who frightens it. the
          generator sits behind a small interface (<code className="text-aqua-dim">ThoughtGenerator</code> in{' '}
          <code className="text-aqua-dim">lib/thoughtEngine.ts</code>); set <code className="text-aqua-dim">NEXT_PUBLIC_THOUGHT_ENDPOINT</code> to
          route thoughts through an LLM-backed endpoint instead.
        </p>
      </section>
      <section>
        <h2 className="label mb-1">persistence</h2>
        <p className="text-fg/85">
          the tank lives in your browser&apos;s local storage and saves every few seconds. when you come back, the last ten minutes of your absence
          are simulated in full and the rest is summarized, so things will have changed.
        </p>
      </section>
      <section>
        <h2 className="label mb-1">controls</h2>
        <ul className="grid grid-cols-[120px_1fr] gap-y-0.5 text-[12px]">
          <li className="contents"><span className="text-aqua-dim">click</span><span>select a fish</span></li>
          <li className="contents"><span className="text-aqua-dim">drag / arrows</span><span>pan</span></li>
          <li className="contents"><span className="text-aqua-dim">wheel / pinch / ±</span><span>zoom</span></li>
          <li className="contents"><span className="text-aqua-dim">f or 0</span><span>fit tank</span></li>
          <li className="contents"><span className="text-aqua-dim">space</span><span>pause</span></li>
          <li className="contents"><span className="text-aqua-dim">[ ]</span><span>previous / next fish</span></li>
          <li className="contents"><span className="text-aqua-dim">n · t · esc</span><span>names · track camera · deselect</span></li>
        </ul>
      </section>
      {engine && (
        <section className="panel p-3 text-[12px]">
          <h2 className="label mb-2">this tank</h2>
          <p>
            opened {age(Date.now() - engine.world.createdAt)} ago · {engine.world.fish.length} fish · {engine.world.events.length} events kept ·{' '}
            {engine.world.counters.meals} meals served
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={exportJson}>
              export json
            </button>
            <button className="btn hover:border-bad! hover:text-bad!" onClick={reset}>
              reset tank
            </button>
          </div>
        </section>
      )}
      <p className="text-[11px] text-dim">an original aquarium simulation. all visuals are drawn procedurally on canvas.</p>
    </article>
  )
}
