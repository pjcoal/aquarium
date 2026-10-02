import type { MarketSnapshot } from '@/simulation/market'
import { TOKEN, isTokenLive } from './token'

const POLL_MS = 30_000
const SIM_TICK_MS = 5_000

interface DexPair {
  priceUsd?: string
  priceChange?: { m5?: number; h1?: number; h24?: number }
  txns?: { m5?: { buys?: number; sells?: number } }
  marketCap?: number
  fdv?: number
  liquidity?: { usd?: number }
  url?: string
}

/**
 * Supplies market snapshots: real data from DexScreener when a token mint is
 * configured, otherwise a simulated random walk with pump/dump regimes so the
 * tank's reactions can be seen before launch.
 */
export class MarketFeed {
  private timer: ReturnType<typeof setInterval> | null = null
  private sim = { price: 0.0001, regime: 0, regimeUntil: 0, history: [] as { t: number; p: number }[], day: 0 }
  constructor(private onSnapshot: (s: MarketSnapshot) => void) {}

  start() {
    if (this.timer) return
    if (isTokenLive()) {
      void this.poll()
      this.timer = setInterval(() => void this.poll(), POLL_MS)
    } else {
      // pre-fill an hour of quiet history so changes are meaningful immediately
      // and a new visitor never opens the tank mid-crash
      const now = Date.now()
      this.sim.regimeUntil = now + (2 + Math.random() * 3) * 60_000
      for (let i = 720; i > 0; i--) this.simStep(now - i * SIM_TICK_MS, false, false, true)
      this.simStep(now, true, true)
      this.timer = setInterval(() => this.simStep(Date.now(), true), SIM_TICK_MS)
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** force a candle in sim mode (used by the test buttons on the about page) */
  simCandle(pct: number) {
    if (isTokenLive()) return
    this.sim.price *= 1 + pct / 100
    this.simStep(Date.now(), true, true)
  }

  private async poll() {
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${TOKEN.mint}`, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(String(res.status))
      const pairs = (await res.json()) as DexPair[]
      if (!Array.isArray(pairs) || !pairs.length) return this.emitPending()
      const p = pairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a))
      this.onSnapshot({
        source: 'live',
        ticker: TOKEN.ticker,
        priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
        change5m: p.priceChange?.m5 ?? 0,
        change1h: p.priceChange?.h1 ?? 0,
        change24h: p.priceChange?.h24 ?? 0,
        buys5m: p.txns?.m5?.buys ?? 0,
        sells5m: p.txns?.m5?.sells ?? 0,
        marketCap: p.marketCap ?? p.fdv ?? null,
        url: p.url ?? null,
        updatedAt: Date.now(),
      })
    } catch {
      // keep the last snapshot; try again next poll
    }
  }

  private emitPending() {
    this.onSnapshot({
      source: 'pending',
      ticker: TOKEN.ticker,
      priceUsd: null,
      change5m: 0,
      change1h: 0,
      change24h: 0,
      buys5m: 0,
      sells5m: 0,
      marketCap: null,
      url: null,
      updatedAt: Date.now(),
    })
  }

  private simStep(now: number, emit: boolean, skipWalk = false, quiet = false) {
    const s = this.sim
    if (quiet) {
      s.price *= Math.exp((Math.random() - 0.5) * 0.006)
    } else if (!skipWalk) {
      if (now > s.regimeUntil) {
        const r = Math.random()
        s.regime = r < 0.3 ? 0.0028 : r < 0.55 ? -0.003 : 0
        s.regimeUntil = now + (3 + Math.random() * 6) * 60_000
      }
      let step = s.regime + (Math.random() - 0.5) * 0.014
      // occasional big candle
      if (Math.random() < 0.012) step += (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.07)
      s.price *= Math.exp(step)
    }
    s.history.push({ t: now, p: s.price })
    while (s.history.length && now - s.history[0].t > 65 * 60_000) s.history.shift()
    if (!emit) return
    const at = (ms: number) => {
      const target = now - ms
      let best = s.history[0]
      for (const h of s.history) if (h.t <= target) best = h
      return best.p
    }
    const c5 = (s.price / at(5 * 60_000) - 1) * 100
    const c1h = (s.price / at(60 * 60_000) - 1) * 100
    s.day = s.day * 0.98 + c1h * 0.05
    const activity = 20 + Math.abs(c5) * 6
    const tilt = Math.max(-0.8, Math.min(0.8, c5 / 15))
    this.onSnapshot({
      source: 'sim',
      ticker: TOKEN.ticker,
      priceUsd: s.price,
      change5m: c5,
      change1h: c1h,
      change24h: s.day + c1h,
      buys5m: Math.round(activity * (1 + tilt)),
      sells5m: Math.round(activity * (1 - tilt)),
      marketCap: s.price * 1e9,
      url: null,
      updatedAt: now,
    })
  }
}

let feed: MarketFeed | null = null
export function getMarketFeed(onSnapshot?: (s: MarketSnapshot) => void): MarketFeed | null {
  if (!feed && onSnapshot) feed = new MarketFeed(onSnapshot)
  return feed
}
