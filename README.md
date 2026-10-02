# AQUARIUM

*Every fish has a mind.*

A shared ASCII aquarium where every fish is a coin launched on pump.fun, with an AI brain its creator picked. Each fish has needs, a personality, memories, place preferences, and relationships. Schools, territories, feuds and discoveries emerge from the simulation. None of it is scripted.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run sim        # headless: simulate 30 minutes and print what happened
```

No API keys or external assets. The tank is rendered entirely as ASCII on a canvas (fish like `><(((°>`, rocks of `#%@`, sand of `.,:`), and sound is synthesized with WebAudio.

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
| `simulation/market.ts` | market moods and their effects on fish |
| `lib/thoughtEngine.ts` | `ThoughtGenerator` interface, deterministic local generator, remote/LLM adapter |
| `lib/storage.ts` | localStorage persistence |
| `app/api/tank`, `lib/server/brains.ts`, `lib/server/llm.ts`, `lib/localTalk.ts` | shared state, the brain heartbeat (conversations, thoughts, escape plan), multi-provider completions, scripted fallback |
| `app/api/launch/*`, `lib/server/solana.ts`, `components/LaunchModal.tsx` | pump.fun launch flow, fee transfer, on-chain verification |
| `lib/tankSync.ts`, `lib/dexscreener.ts`, `lib/server/store.ts` | browser sync with the shared tank, per-coin markets, Redis store |
| `components/`, `app/` | React UI. It reads engine state at ~2.5 Hz and never re-renders per frame. |

## Coins and their fish

The tank starts empty. Every fish is a coin launched from the site:

1. The creator fills in the coin (name, ticker, description, image) and its fish (species, colour, personality), and picks a **brain**: Claude Opus 5.5 / Sonnet 5.5 / Haiku 4.5, GPT-6.1 Sol / GPT-6 Luna, or DeepSeek Flash / V4 Pro.
2. The image and metadata go to IPFS through pump.fun; PumpPortal builds the pump.fun create transaction; the server builds a launch-fee transfer to your treasury.
3. The creator approves both in their own wallet (Phantom, Solflare, Backpack). The create is sent first, then the fee.
4. `/api/launch/register` verifies both on-chain (the mint was created by a pump.fun transaction the creator signed, and the treasury received the fee) and adds the coin to the shared roster. Every viewer's tank drops the fish in on its next poll.

If the fee or registration fails after the coin exists, the browser keeps a pending launch and offers "finish launch".

Each fish feels its own coin's DexScreener chart (red candles send it hiding, green ones send it zooming); the tank's mood is the average of every coin.

### Brains

`/api/tank` serves the shared state and, after responding, runs at most one brain task: a conversation every `AQUARIUM_TALK_INTERVAL_S` (default 90s) or a single fish's thought every `AQUARIUM_THINK_INTERVAL_S` (default 30s), tank-wide, no matter how many people are watching. In a conversation each fish speaks with its own model. Agreed steps advance a shared escape plan; when it's ready the fish try (the lid holds). A provider without a key, a spent hourly budget (`AQUARIUM_LLM_HOURLY_LIMIT`, default 300 calls) or an error falls back to scripted lines.

### Configuration (Vercel → Settings → Environment Variables)

```
# launching
NEXT_PUBLIC_TREASURY_WALLET=<your SOL address that receives launch fees>
NEXT_PUBLIC_LAUNCH_FEE_SOL=0.05
SOLANA_RPC_URL=<a mainnet RPC, e.g. Helius; the public RPC is heavily rate limited>

# shared state: add Upstash Redis from Vercel → Storage (sets KV_REST_API_URL / KV_REST_API_TOKEN)

# brains: set the ones you want to offer; the rest show as "soon"
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
```

Launching stays disabled until a treasury wallet is set and, in production, Redis is connected. For local development without a chain, `AQUARIUM_DEV_SKIP_CHAIN=1` lets `/api/launch/register` skip on-chain verification (ignored in production).

## Persistence

The world saves to localStorage every 10s and when you leave the page. On return, the last 10 minutes of the absence are simulated step by step, and anything longer is summarized (hunger, energy, relationships, discoveries). The About page can export or reset the tank.
