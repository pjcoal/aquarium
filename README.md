# AQUARIUM

*Every fish has a mind.*

A persistent digital aquarium of autonomous fish agents. Each fish has needs, a personality, memories, place preferences, and relationships. Schools, territories, feuds and discoveries emerge from the simulation. None of it is scripted.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run sim        # headless: simulate 30 minutes and print what happened
```

No API keys or external assets. Everything is drawn procedurally on canvas, and sound is synthesized with WebAudio.

## Layout

| path | what |
| --- | --- |
| `simulation/engine.ts` | world loop (rAF, fixed sub-steps), food, curiosities, social/territory ticks, persistence, offline catch-up |
| `simulation/behavior.ts` | perception, utility-based decisions (IDLE…INVESTIGATE), per-action steering |
| `simulation/steering.ts` | seek / arrive / wander / pursue / flee / walls / obstacles |
| `simulation/schooling.ts` | emergent school formation, joining, leaving, merging, boids forces |
| `simulation/relationships.ts`, `memory.ts`, `events.ts` | social graph, memories & learned place affinity, event log with cooldowns |
| `simulation/environment.ts`, `species.ts`, `seed.ts` | tank geometry, landmarks, day cycle, species parameters, starting population |
| `lib/renderer.ts`, `lib/fishDrawing.ts` | canvas renderer (water, light rays, plants, bubbles, fish) |
| `lib/thoughtEngine.ts` | `ThoughtGenerator` interface, deterministic local generator, remote/LLM adapter |
| `lib/storage.ts` | localStorage persistence |
| `components/`, `app/` | React UI. It reads engine state at ~2.5 Hz and never re-renders per frame. |

## Plugging in an LLM for thoughts

Set `NEXT_PUBLIC_THOUGHT_ENDPOINT` to a URL that accepts a POSTed `ThoughtContext` JSON and returns `{ "thought": "..." }`. `RemoteThoughtGenerator` rate-limits itself and falls back to the local generator on any failure.

## Persistence

The world saves to localStorage every 10s and when you leave the page. On return, the last 10 minutes of the absence are simulated step by step, and anything longer is summarized (hunger, energy, relationships, discoveries). The About page can export or reset the tank.
