'use client'
import { useState } from 'react'
import type { Engine } from '@/simulation/engine'
import { fmtPct, fmtPrice } from '@/simulation/market'
import { modelLabel } from '@/lib/models'

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`

/** the coin behind a fish: ticker, contract address, links, brain and market */
export function CoinPanel({ engine, mint, compact = false }: { engine: Engine; mint: string; compact?: boolean }) {
  const coin = engine.coins.get(mint)
  const m = engine.coinMarkets.get(mint)
  const mood = engine.coinMood.get(mint)
  const [copied, setCopied] = useState(false)
  if (!coin) return null
  const copy = async () => {
    await navigator.clipboard.writeText(coin.mint).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="text-[12px]">
      <div className="flex items-center gap-2">
        {coin.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coin.image} alt="" className="h-8 w-8 shrink-0 border border-line2 object-cover" />
        )}
        <div className="min-w-0">
          <div className="truncate">
            <span className="text-aqua">${coin.symbol}</span> <span className="text-dim">{coin.name}</span>
          </div>
          <div className="text-[11px] text-dim">
            brain <span className="text-violet">{modelLabel(coin.model)}</span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-[11px] tabular-nums">
        {m ? (
          <>
            <span className="text-fg">{fmtPrice(m.priceUsd)}</span>
            <span className={m.change1h >= 0 ? 'text-good' : 'text-bad'}>{fmtPct(m.change1h)} 1h</span>
            {m.marketCap !== null && <span className="text-dim">mc ${Math.round(m.marketCap).toLocaleString()}</span>}
            {mood && <span className="text-dim uppercase">{mood}</span>}
          </>
        ) : (
          <span className="text-dim">no trades seen yet</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <button className="btn" onClick={copy} title={coin.mint} aria-label="Copy contract address">
          {copied ? 'copied' : `ca ${short(coin.mint)}`}
        </button>
        <a className="btn" href={`https://pump.fun/coin/${coin.mint}`} target="_blank" rel="noreferrer">
          pump.fun
        </a>
        <a className="btn" href={`https://dexscreener.com/solana/${coin.mint}`} target="_blank" rel="noreferrer">
          chart
        </a>
        {!compact && (
          <a className="btn" href={`https://solscan.io/token/${coin.mint}`} target="_blank" rel="noreferrer">
            solscan
          </a>
        )}
      </div>
      {!compact && (
        <p className="mt-1.5 text-[11px] text-dim">
          launched {new Date(coin.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} by{' '}
          <a className="underline hover:text-aqua" href={`https://solscan.io/account/${coin.creator}`} target="_blank" rel="noreferrer">
            {short(coin.creator)}
          </a>
        </p>
      )}
    </div>
  )
}
