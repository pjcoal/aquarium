'use client'
import type { MarketMood } from '@/simulation/market'
import { fmtPct, fmtPrice } from '@/simulation/market'
import { useEngine } from '@/lib/hooks'

const MOOD_COLOR: Record<MarketMood, string> = {
  euphoric: 'text-good',
  bullish: 'text-good/80',
  calm: 'text-dim',
  bearish: 'text-bad/80',
  panic: 'text-bad',
}

/** The token as the tank feels it: price, 1h move, and the resulting mood. */
export function MarketStrip({ className = '' }: { className?: string }) {
  const engine = useEngine()
  const m = engine?.market
  if (!engine || !m) {
    return (
      <div className={className}>
        <div className="text-[13px] leading-tight text-dim">connecting…</div>
        <div className="label mt-1.5">market</div>
      </div>
    )
  }
  const mood = engine.marketMood
  const badge = m.source === 'live' ? 'live' : m.source === 'sim' ? 'sim' : 'awaiting data'
  return (
    <div className={className} title={m.source === 'sim' ? 'No token configured yet: this is a simulated market so you can see how the tank reacts.' : undefined}>
      <div className="flex items-baseline gap-2 text-[13px] leading-tight tabular-nums">
        <span className="text-fg">${m.ticker}</span>
        <span className="text-dim">{fmtPrice(m.priceUsd)}</span>
        <span className={m.change1h >= 0 ? 'text-good' : 'text-bad'}>{fmtPct(m.change1h)}</span>
      </div>
      <div className="label mt-1.5 flex gap-2">
        <span className={MOOD_COLOR[mood]}>{mood}</span>
        <span className={`border px-1 text-[9px] ${m.source === 'live' ? 'border-good/50 text-good' : 'border-line2 text-dim'}`}>{badge}</span>
      </div>
    </div>
  )
}
