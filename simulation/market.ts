export type MarketMood = 'euphoric' | 'bullish' | 'calm' | 'bearish' | 'panic'

export interface MarketSnapshot {
  /** live = real DexScreener data, sim = simulated (no token set), pending = token set but no data yet */
  source: 'live' | 'sim' | 'pending'
  ticker: string
  priceUsd: number | null
  /** percent changes */
  change5m: number
  change1h: number
  change24h: number
  buys5m: number
  sells5m: number
  marketCap: number | null
  url: string | null
  updatedAt: number
}

export function marketMood(s: MarketSnapshot | null): MarketMood {
  if (!s || s.source === 'pending') return 'calm'
  const score = s.change1h + s.change5m * 1.5
  if (score >= 30) return 'euphoric'
  if (score >= 6) return 'bullish'
  if (score <= -30) return 'panic'
  if (score <= -6) return 'bearish'
  return 'calm'
}

/** 0..1, how lopsided recent trading is toward buys */
export function buyPressure(s: MarketSnapshot | null): number {
  if (!s) return 0
  const total = s.buys5m + s.sells5m
  if (total < 4) return 0
  return Math.max(0, Math.min(1, ((s.buys5m - s.sells5m) / total) * 2))
}

/**
 * How the market mood bends the simulation. stressFloor is the anxiety a
 * fully timid fish can't shake off while the mood lasts (scaled by 1 - bravery).
 */
export const MOOD_EFFECTS: Record<MarketMood, { feedInterval: number; feedAmount: number; stressFloor: number; curiosity: number }> = {
  euphoric: { feedInterval: 0.4, feedAmount: 1.6, stressFloor: 0, curiosity: 1.8 },
  bullish: { feedInterval: 0.7, feedAmount: 1.25, stressFloor: 0, curiosity: 1.4 },
  calm: { feedInterval: 1, feedAmount: 1, stressFloor: 0, curiosity: 1 },
  bearish: { feedInterval: 1.4, feedAmount: 0.8, stressFloor: 0.35, curiosity: 0.8 },
  panic: { feedInterval: 2, feedAmount: 0.6, stressFloor: 0.75, curiosity: 0.5 },
}

export function fmtPct(x: number): string {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(Math.abs(x) < 10 ? 1 : 0)}%`
}

export function fmtPrice(p: number | null): string {
  if (p === null) return '—'
  if (p >= 1) return `$${p.toFixed(2)}`
  // small prices: keep 4 significant digits
  return `$${p.toPrecision(4)}`
}
