'use client'
import { useEffect, useState } from 'react'
import type { MarketSnapshot } from '@/simulation/market'
import { fmtPct, fmtPrice } from '@/simulation/market'
import { fetchMarkets } from '@/lib/dexscreener'
import { SITE_TOKEN_MINT, siteTokenLinks } from '@/lib/siteToken'

const short = `${SITE_TOKEN_MINT.slice(0, 4)}…${SITE_TOKEN_MINT.slice(-4)}`

function useCopy(): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(SITE_TOKEN_MINT).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return [copied, copy]
}

/** compact copy button for the header */
export function SiteTokenButton() {
  const [copied, copy] = useCopy()
  return (
    <button className="btn" onClick={copy} title={SITE_TOKEN_MINT} aria-label={`Copy the token contract address ${SITE_TOKEN_MINT}`}>
      {copied ? 'copied' : (
        <>
          ca<span className="hidden md:inline"> {short}</span>
        </>
      )}
    </button>
  )
}

/** the token's contract address, links and live market, for the about page */
export function SiteTokenPanel() {
  const [copied, copy] = useCopy()
  const [m, setM] = useState<MarketSnapshot | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetchMarkets([{ mint: SITE_TOKEN_MINT, symbol: 'TANK' }]).then((r) => alive && setM(r[SITE_TOKEN_MINT] ?? null))
    void load()
    const id = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return (
    <div className="panel p-3 text-[12px]">
      <div className="label mb-1">contract address</div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all text-fg">{SITE_TOKEN_MINT}</code>
        <button className="btn" onClick={copy}>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 tabular-nums">
        {m ? (
          <>
            <span className="text-fg">{fmtPrice(m.priceUsd)}</span>
            {m.marketCap !== null && <span className="text-dim">mc ${Math.round(m.marketCap).toLocaleString()}</span>}
            <span className={m.change24h >= 0 ? 'text-good' : 'text-bad'}>{fmtPct(m.change24h)} 24h</span>
          </>
        ) : (
          <span className="text-dim">{m === undefined ? 'checking the chart…' : 'not trading yet'}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <a className="btn" href={siteTokenLinks.pumpfun} target="_blank" rel="noreferrer">
          pump.fun
        </a>
        <a className="btn" href={siteTokenLinks.chart} target="_blank" rel="noreferrer">
          chart
        </a>
        <a className="btn" href={siteTokenLinks.solscan} target="_blank" rel="noreferrer">
          solscan
        </a>
      </div>
    </div>
  )
}
