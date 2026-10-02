import type { Engine } from '@/simulation/engine'
import type { TankState } from '@/types/coin'
import { fetchMarkets } from './dexscreener'

const STATE_MS = 8_000
const MARKET_MS = 60_000

/**
 * Keeps this browser's tank in step with the shared one: the coin roster,
 * conversations, brain thoughts and escape plan come from /api/tank (polling
 * it is also what keeps the brains ticking), and each coin's market comes
 * straight from DexScreener.
 */
export class TankSync {
  private timers: ReturnType<typeof setInterval>[] = []
  private busy = false

  constructor(private engine: Engine) {}

  start() {
    if (this.timers.length) return
    void this.pull()
    this.timers.push(setInterval(() => !document.hidden && void this.pull(), STATE_MS))
    this.timers.push(setInterval(() => !document.hidden && void this.markets(), MARKET_MS))
    setTimeout(() => void this.markets(), 2000)
  }

  stop() {
    for (const t of this.timers) clearInterval(t)
    this.timers = []
  }

  /** fetch now (e.g. right after a launch) */
  async pull(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      const res = await fetch('/api/tank', { cache: 'no-store' })
      if (!res.ok) return
      const s = (await res.json()) as TankState
      const e = this.engine
      e.tankConfig = s.config
      e.syncRoster(s.coins)
      e.applyShared(s.conversations, s.thoughts, s.escape)
      e.notify()
    } catch {
      // offline or server hiccup: keep the local tank running
    } finally {
      this.busy = false
    }
  }

  private async markets() {
    const coins = [...this.engine.coins.values()].map((c) => ({ mint: c.mint, symbol: c.symbol }))
    if (!coins.length) return
    this.engine.applyCoinMarkets(await fetchMarkets(coins))
  }
}

let sync: TankSync | null = null
export function getTankSync(engine?: Engine): TankSync | null {
  if (!sync && engine) sync = new TankSync(engine)
  return sync
}
