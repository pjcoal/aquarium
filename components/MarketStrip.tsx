'use client'
import type { MarketMood } from '@/simulation/market'
import { fmtPct } from '@/simulation/market'
import { useEngine } from '@/lib/hooks'

const MOOD_COLOR: Record<MarketMood, string> = {
  euphoric: 'text-good',
  bullish: 'text-good/80',
  calm: 'text-dim',
  bearish: 'text-bad/80',
  panic: 'text-bad',
}

/** The tank index (average of every coin's chart) and the biggest mover. */
export function MarketStrip({ className = '' }: { className?: string }) {
  const engine = useEngine()
  const m = engine?.market
  if (!engine || !m) {
    return (
      <div className={className}>
        <div className="text-[13px] leading-tight text-dim">{engine?.coins.size ? 'reading charts…' : 'no coins yet'}</div>
        <div className="label mt-1.5">tank index</div>
      </div>
    )
  }
  let top: { symbol: string; c: number } | null = null
  for (const [mint, s] of engine.coinMarkets) {
    if (!top || Math.abs(s.change1h) > Math.abs(top.c)) top = { symbol: engine.coins.get(mint)?.symbol ?? s.ticker, c: s.change1h }
  }
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2 text-[13px] leading-tight tabular-nums">
        <span className="text-fg">index</span>
        <span className={m.change1h >= 0 ? 'text-good' : 'text-bad'}>{fmtPct(m.change1h)}</span>
        {top && (
          <span className="text-dim">
            ${top.symbol} <span className={top.c >= 0 ? 'text-good/80' : 'text-bad/80'}>{fmtPct(top.c)}</span>
          </span>
        )}
      </div>
      <div className="label mt-1.5">
        tank mood <span className={MOOD_COLOR[engine.marketMood]}>{engine.marketMood}</span>
      </div>
    </div>
  )
}
