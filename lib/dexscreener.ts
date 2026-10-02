import type { MarketSnapshot } from '@/simulation/market'

interface DexPair {
  baseToken?: { address?: string; symbol?: string }
  priceUsd?: string
  priceChange?: { m5?: number; h1?: number; h24?: number }
  txns?: { m5?: { buys?: number; sells?: number } }
  marketCap?: number
  fdv?: number
  liquidity?: { usd?: number }
  url?: string
}

/**
 * Market snapshots for many Solana tokens at once (DexScreener accepts 30
 * addresses per call). Coins with no pairs yet are simply absent.
 */
export async function fetchMarkets(coins: { mint: string; symbol: string }[]): Promise<Record<string, MarketSnapshot>> {
  const out: Record<string, MarketSnapshot> = {}
  const symbolOf = new Map(coins.map((c) => [c.mint, c.symbol]))
  for (let i = 0; i < coins.length; i += 30) {
    const chunk = coins.slice(i, i + 30).map((c) => c.mint)
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(',')}`, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) continue
      const pairs = (await res.json()) as DexPair[]
      if (!Array.isArray(pairs)) continue
      const best = new Map<string, DexPair>()
      for (const p of pairs) {
        const mint = p.baseToken?.address
        if (!mint || !symbolOf.has(mint)) continue
        const prev = best.get(mint)
        if (!prev || (p.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) best.set(mint, p)
      }
      for (const [mint, p] of best) {
        out[mint] = {
          source: 'live',
          ticker: symbolOf.get(mint) ?? p.baseToken?.symbol ?? '?',
          priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
          change5m: p.priceChange?.m5 ?? 0,
          change1h: p.priceChange?.h1 ?? 0,
          change24h: p.priceChange?.h24 ?? 0,
          buys5m: p.txns?.m5?.buys ?? 0,
          sells5m: p.txns?.m5?.sells ?? 0,
          marketCap: p.marketCap ?? p.fdv ?? null,
          url: p.url ?? null,
          updatedAt: Date.now(),
        }
      }
    } catch {
      // try again next round
    }
  }
  return out
}
