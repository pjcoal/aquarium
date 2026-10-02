'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { CoinRecord } from '@/types/coin'
import type { MarketSnapshot } from '@/simulation/market'
import { fmtPct, fmtPrice } from '@/simulation/market'
import { useEngine } from '@/lib/hooks'
import { ago } from '@/lib/format'
import { modelLabel } from '@/lib/models'
import { useLaunch } from '@/components/AppShell'
import { FishSprite } from '@/components/FishSprite'

const SORTS = ['newest', 'oldest', 'market cap', '1h change', '24h change'] as const
type Sort = (typeof SORTS)[number]

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`

function sorter(sort: Sort, m: Map<string, MarketSnapshot>): (a: CoinRecord, b: CoinRecord) => number {
  const mc = (c: CoinRecord) => m.get(c.mint)?.marketCap ?? -1
  const ch = (c: CoinRecord, k: 'change1h' | 'change24h') => m.get(c.mint)?.[k] ?? -Infinity
  switch (sort) {
    case 'oldest':
      return (a, b) => a.createdAt - b.createdAt
    case 'market cap':
      return (a, b) => mc(b) - mc(a)
    case '1h change':
      return (a, b) => ch(b, 'change1h') - ch(a, 'change1h')
    case '24h change':
      return (a, b) => ch(b, 'change24h') - ch(a, 'change24h')
    default:
      return (a, b) => b.createdAt - a.createdAt
  }
}

function CopyCA({ mint }: { mint: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn"
      title={mint}
      aria-label={`Copy contract address ${mint}`}
      onClick={async () => {
        await navigator.clipboard.writeText(mint).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'copied' : `ca ${short(mint)}`}
    </button>
  )
}

export default function CoinsPage() {
  const engine = useEngine()
  const launch = useLaunch()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  if (!engine) return null

  const coins = [...engine.coins.values()]
  const query = q.trim().toLowerCase().replace(/^\$/, '')
  const list = coins
    .filter((c) => !query || c.name.toLowerCase().includes(query) || c.symbol.toLowerCase().includes(query) || c.mint.toLowerCase() === query)
    .sort(sorter(sort, engine.coinMarkets))
  const totalMc = coins.reduce((s, c) => s + (engine.coinMarkets.get(c.mint)?.marketCap ?? 0), 0)
  const loading = !engine.tankConfig

  return (
    <div className="space-y-4 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[13px] tracking-[0.3em]">
            LAUNCHED COINS <span className="text-dim">[{coins.length}]</span>
          </h1>
          <p className="mt-1 text-[12px] text-dim">
            every coin launched through tank, each with its fish and the brain its creator chose.
            {totalMc > 0 && <> combined market cap ${Math.round(totalMc).toLocaleString()}.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="coin-search">
            search coins by name, ticker or contract address
          </label>
          <input
            id="coin-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search name, $ticker or ca…"
            className="w-52 border border-line2 bg-ink px-2 py-1 text-[12px] text-fg placeholder:text-faint focus:border-aqua focus:outline-none"
          />
          <label className="label" htmlFor="coin-sort">
            sort
          </label>
          <select
            id="coin-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="border border-line2 bg-ink px-2 py-1 text-[12px] text-fg focus:border-aqua focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn border-aqua-dim! text-aqua! hover:bg-aqua! hover:text-ink!" onClick={launch.open}>
            + launch a coin
          </button>
        </div>
      </div>

      {loading ? (
        <p className="panel p-4 text-[12px] text-dim">reading the tank…</p>
      ) : !coins.length ? (
        <div className="panel p-6 text-center text-[12px]">
          <p className="text-fg">no coins have been launched yet.</p>
          <p className="mt-1 text-dim">the first one gets the whole tank to itself.</p>
          <button className="btn mt-3 border-aqua! text-aqua! hover:bg-aqua! hover:text-ink!" onClick={launch.open}>
            + launch the first coin
          </button>
        </div>
      ) : !list.length ? (
        <p className="panel p-4 text-[12px] text-dim">no coins match “{q}”.</p>
      ) : (
        <ul className="space-y-2" aria-label="Launched coins">
          {list.map((c) => {
            const m = engine.coinMarkets.get(c.mint)
            const fish = engine.byId.get(c.mint)
            return (
              <li key={c.mint} className="panel grid gap-3 p-3 text-[12px] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
                {/* identity */}
                <div className="flex min-w-0 items-center gap-3">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="h-11 w-11 shrink-0 border border-line2 object-cover" />
                  ) : (
                    <div className="h-11 w-11 shrink-0 border border-line2" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <div className="truncate">
                      <span className="font-bold text-aqua">${c.symbol}</span> <span className="text-fg">{c.name}</span>
                    </div>
                    <div className="text-[11px] text-dim">
                      launched {ago(Date.now() - c.createdAt)} by{' '}
                      <a className="underline hover:text-aqua" href={`https://solscan.io/account/${c.creator}`} target="_blank" rel="noreferrer">
                        {short(c.creator)}
                      </a>
                    </div>
                    {c.description && <p className="mt-0.5 line-clamp-1 text-[11px] text-fg/70">{c.description}</p>}
                  </div>
                </div>

                {/* fish & brain */}
                <Link href={`/fish/${c.mint}`} className="flex min-w-0 items-center gap-2 hover:text-aqua" title={`see ${fish?.name ?? c.name} in the tank`}>
                  <FishSprite look={{ species: c.species, color: c.color, action: fish?.action }} width={70} height={30} label={`${c.name}'s fish`} />
                  <div className="min-w-0">
                    <div className="truncate text-fg">{fish?.actionDetail ?? 'swimming'}</div>
                    <div className="text-[11px]">
                      brain <span className="text-violet">{modelLabel(c.model)}</span>
                    </div>
                  </div>
                </Link>

                {/* market & links */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="tabular-nums">
                    {m ? (
                      <>
                        <div>
                          <span className="text-fg">{fmtPrice(m.priceUsd)}</span>
                          {m.marketCap !== null && <span className="ml-2 text-dim">mc ${Math.round(m.marketCap).toLocaleString()}</span>}
                        </div>
                        <div className="text-[11px]">
                          <span className={m.change1h >= 0 ? 'text-good' : 'text-bad'}>{fmtPct(m.change1h)} 1h</span>
                          <span className={`ml-2 ${m.change24h >= 0 ? 'text-good' : 'text-bad'}`}>{fmtPct(m.change24h)} 24h</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-dim">no trades seen yet</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <CopyCA mint={c.mint} />
                    <a className="btn" href={`https://pump.fun/coin/${c.mint}`} target="_blank" rel="noreferrer">
                      pump.fun
                    </a>
                    <a className="btn" href={`https://dexscreener.com/solana/${c.mint}`} target="_blank" rel="noreferrer">
                      chart
                    </a>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[11px] text-dim">market data from dexscreener, refreshed every minute. nothing here is financial advice.</p>
    </div>
  )
}
