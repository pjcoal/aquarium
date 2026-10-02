# AQUARIUM

*Every fish has a mind.*

A persistent digital aquarium of autonomous fish agents. Each fish has needs, a personality, memories, place preferences, and relationships. Schools, territories, feuds and discoveries emerge from the simulation. None of it is scripted.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run sim        # headless: simulate 30 minutes and print what happened
```

No API keys or external assets. The tank is rendered entirely as ASCII on a canvas (fish like `><(((°>`, rocks of `#%@`, sand of `.,:`), and sound is synthesized with WebAudio.

## The token

The tank reacts to a Solana token's market:

| market | in the tank |
| --- | --- |
| euphoric / bullish (green) | green tint, feeder runs faster and drops more, fish get curious, green thoughts |
| bearish / panic (red) | red tint, food gets scarce, timid fish carry lingering anxiety and hide |
| red candle (≤ −8% in 5m) | the whole tank flinches, timid fish bolt for shelter |
| green candle (≥ +8% in 5m) | the feeder fires |
| heavy buying | the bubble stone roars |

Until launch, leave `NEXT_PUBLIC_TOKEN_MINT` unset and the tank runs on a clearly labelled **simulated** market (the About page has buttons to fire test candles). After launch, set these in Vercel → Project → Settings → Environment Variables and redeploy:

```
NEXT_PUBLIC_TOKEN_MINT=<mint address>
NEXT_PUBLIC_TOKEN_TICKER=<ticker>
```

Live data comes from the DexScreener API (polled every 30s from the browser). See `lib/token.ts`, `lib/marketFeed.ts` and `simulation/market.ts`.

## Layout

| path | what |
| --- | --- |
| `simulation/engine.ts` | world loop (rAF, fixed sub-steps), food, curiosities, social/territory ticks, persistence, offline catch-up |
| `simulation/behavior.ts` | perception, utility-based decisions (IDLE…INVESTIGATE), per-action steering |
| `simulation/steering.ts` | seek / arrive / wander / pursue / flee / walls / obstacles |
| `simulation/schooling.ts` | emergent school formation, joining, leaving, merging, boids forces |
| `simulation/relationships.ts`, `memory.ts`, `events.ts` | social graph, memories & learned place affinity, event log with cooldowns |
| `simulation/environment.ts`, `species.ts`, `seed.ts` | tank geometry, landmarks, day cycle, species parameters, starting population |
| `lib/renderer.ts`, `lib/asciiFish.ts` | ASCII canvas renderer (scenery on a character grid, swaying plants, bubbles, fish) |
| `simulation/market.ts`, `lib/marketFeed.ts`, `lib/token.ts` | token config, DexScreener / simulated market feed, market moods and their effects |
| `lib/thoughtEngine.ts` | `ThoughtGenerator` interface, deterministic local generator, remote/LLM adapter |
| `lib/storage.ts` | localStorage persistence |
| `app/api/tank-talk/route.ts`, `lib/tankTalk.ts`, `lib/localTalk.ts` | Claude-written fish conversations, the client director that schedules them, scripted fallback |
| `components/`, `app/` | React UI. It reads engine state at ~2.5 Hz and never re-renders per frame. |

## Fish conversations (Claude)

Every minute or two a few fish near each other stop and talk about the token and about escaping the tank. The browser picks the group and sends their personalities, moods, memories, feelings toward each other, the market and the escape plan so far to `/api/tank-talk`, which asks **Claude Opus 5.5** (low effort, structured JSON output, server-side refusal fallback) to write the conversation. Lines play out as speech bubbles; agreed steps advance the escape plan, and when it's ready the fish make an escape attempt (the lid always holds).

Set the key on the server only (Vercel → Settings → Environment Variables), then redeploy:

```
ANTHROPIC_API_KEY=sk-ant-...
# optional
AQUARIUM_TALK_MODEL=claude-opus-5-5     # e.g. claude-sonnet-5-5 or claude-haiku-4-5 to cut cost
AQUARIUM_TALK_HOURLY_LIMIT=120          # conversations per server instance per hour
```

Without a key the route returns 503 and the tank uses scripted local dialogue instead. The route allows one conversation per visitor every 30s, rejects cross-origin calls, and caps each server instance per hour. Those limits live in memory, so for a hard ceiling on spend also set a monthly limit in the Anthropic Console.

## Plugging in an LLM for thoughts

Set `NEXT_PUBLIC_THOUGHT_ENDPOINT` to a URL that accepts a POSTed `ThoughtContext` JSON and returns `{ "thought": "..." }`. `RemoteThoughtGenerator` rate-limits itself and falls back to the local generator on any failure.

## Persistence

The world saves to localStorage every 10s and when you leave the page. On return, the last 10 minutes of the absence are simulated step by step, and anything longer is summarized (hunger, energy, relationships, discoveries). The About page can export or reset the tank.
