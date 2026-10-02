'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PersonalityPreset, SpeciesId } from '@/types/fish'
import type { Provider } from '@/types/coin'
import type { Transaction, VersionedTransaction } from '@solana/web3.js'
import { SPECIES, SPECIES_LIST } from '@/simulation/species'
import { PRESETS, PRESET_LIST } from '@/simulation/fish'
import { getEngine } from '@/simulation/engine'
import { MODEL_OPTIONS, PROVIDER_LABEL } from '@/lib/models'
import { normalizeLaunch, type LaunchInput } from '@/lib/launchInput'
import { connectWallet, detectWallets, type DetectedWallet } from '@/lib/wallet'
import { getTankSync } from '@/lib/tankSync'
import { useEngine } from '@/lib/hooks'
import { FishSprite } from './FishSprite'

const SWATCHES = ['#3ad7ff', '#ff8a3d', '#c2185b', '#ff7a1a', '#d9dde3', '#ff9f1c', '#e8d27a', '#e0313f', '#7dff9e', '#b48cff', '#5b6cff', '#f5f0e6']
const PENDING_KEY = 'aquarium.pendingLaunch'

type StepState = 'todo' | 'doing' | 'done' | 'failed'
const STEPS = ['upload image & metadata', 'build transactions', 'approve in your wallet', 'create the coin on pump.fun', 'pay the launch fee', 'drop the fish into the tank'] as const

interface Pending {
  mint: string
  createSig: string
  creator: string
  metadataUri: string
  image: string | null
  input: LaunchInput
}

const b64ToBytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const bytesToB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `request failed (${res.status})`)
  return data
}

async function sendAndConfirm(raw: Uint8Array): Promise<string> {
  const { signature } = await postJSON<{ signature: string }>('/api/launch/send', { tx: bytesToB64(raw) })
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    const s = (await fetch(`/api/launch/send?sig=${signature}`).then((r) => r.json())) as { status: string; error?: string }
    if (s.status === 'confirmed') return signature
    if (s.status === 'failed') throw new Error(`transaction failed: ${s.error ?? 'unknown error'}`)
  }
  throw new Error('transaction was not confirmed in time; check your wallet')
}

async function registerWithRetry(body: Record<string, unknown>) {
  let last: Error | null = null
  // freshly confirmed transactions can take a moment to be visible to the RPC
  for (let i = 0; i < 4; i++) {
    try {
      return await postJSON<{ coin: { mint: string } }>('/api/launch/register', body)
    } catch (err) {
      last = err as Error
      if (!/not found yet/.test(last.message)) throw last
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  throw last ?? new Error('registration failed')
}

export function LaunchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const engine = useEngine()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const config = engine?.tankConfig ?? null

  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [species, setSpecies] = useState<SpeciesId>('neon-tetra')
  const [color, setColor] = useState(SPECIES['neon-tetra'].color)
  const [colorTouched, setColorTouched] = useState(false)
  const [preset, setPreset] = useState<PersonalityPreset>('CURIOUS')
  const [personalityText, setPersonalityText] = useState('')
  const [model, setModel] = useState('')
  const [devBuy, setDevBuy] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [wallet, setWallet] = useState<{ w: DetectedWallet; address: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<StepState[]>(STEPS.map(() => 'todo'))
  const [pending, setPending] = useState<Pending | null>(null)

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  useEffect(() => {
    try {
      const p = localStorage.getItem(PENDING_KEY)
      if (p) setPending(JSON.parse(p) as Pending)
    } catch {
      /* ignore */
    }
  }, [])

  // default to the first brain the server can run
  useEffect(() => {
    if (!model && config) setModel(config.models.find((m) => m.available)?.id ?? '')
  }, [config, model])

  useEffect(() => {
    nameRef.current?.focus()
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose()
      if (e.key === 'Tab' && dialogRef.current) {
        const els = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select')
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose, running])

  const mark = (i: number, s: StepState) => setSteps((prev) => prev.map((x, j) => (j === i ? s : j < i && s === 'doing' ? 'done' : x)))

  const pickSpecies = (s: SpeciesId) => {
    setSpecies(s)
    if (!colorTouched) setColor(SPECIES[s].color)
  }

  const connect = async (w: DetectedWallet) => {
    setError(null)
    try {
      setWallet({ w, address: await connectWallet(w) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not connect the wallet')
    }
  }

  const finish = async (mint: string) => {
    localStorage.removeItem(PENDING_KEY)
    mark(5, 'done')
    await getTankSync()?.pull()
    const e = getEngine()
    e.ui.selectedId = mint
    e.ui.track = true
    e.notify()
    setTimeout(() => {
      if (e.ui.selectedId === mint) {
        e.ui.track = false
        e.notify()
      }
    }, 9000)
    onClose()
    router.push('/')
  }

  /** pay the fee and register; used by both a full launch and a resumed one */
  const payAndRegister = async (p: Pending, signedFee: Uint8Array | null) => {
    let feeRaw = signedFee
    if (!feeRaw) {
      const web3 = await import('@solana/web3.js')
      const { feeTx } = await postJSON<{ feeTx: string }>('/api/launch/transactions', { feeOnly: true, creator: p.creator })
      mark(2, 'doing')
      const [signed] = await wallet!.w.provider.signAllTransactions([web3.Transaction.from(b64ToBytes(feeTx))])
      feeRaw = signed.serialize()
    }
    mark(4, 'doing')
    const feeSig = await sendAndConfirm(feeRaw)
    mark(5, 'doing')
    const { coin } = await registerWithRetry({ ...p.input, mint: p.mint, creator: p.creator, createSig: p.createSig, feeSig, metadataUri: p.metadataUri, image: p.image })
    await finish(coin.mint)
  }

  const launch = async () => {
    setError(null)
    const input = normalizeLaunch({ name, symbol, description, species, color, preset, personalityText, model })
    if (!input.ok) return setError(input.error)
    if (!image) return setError('your coin needs an image.')
    if (!wallet) return setError('connect a wallet first.')
    setRunning(true)
    setSteps(STEPS.map(() => 'todo'))
    let step = 0
    try {
      const web3 = await import('@solana/web3.js')
      mark((step = 0), 'doing')
      const fd = new FormData()
      fd.append('file', image)
      fd.append('name', input.value.name)
      fd.append('symbol', input.value.symbol)
      fd.append('description', input.value.description)
      const metaRes = await fetch('/api/launch/metadata', { method: 'POST', body: fd })
      const meta = (await metaRes.json()) as { metadataUri?: string; image?: string | null; error?: string }
      if (!metaRes.ok || !meta.metadataUri) throw new Error(meta.error ?? 'metadata upload failed')

      mark((step = 1), 'doing')
      const mintKp = web3.Keypair.generate()
      const txs = await postJSON<{ createTx: string; feeTx: string }>('/api/launch/transactions', {
        creator: wallet.address,
        mint: mintKp.publicKey.toBase58(),
        metadataUri: meta.metadataUri,
        name: input.value.name,
        symbol: input.value.symbol,
        devBuySol: Number(devBuy) || 0,
        model: input.value.model,
      })
      const createTx = web3.VersionedTransaction.deserialize(b64ToBytes(txs.createTx))
      createTx.sign([mintKp])
      const feeTx = web3.Transaction.from(b64ToBytes(txs.feeTx))

      mark((step = 2), 'doing')
      const [signedCreate, signedFee] = await wallet.w.provider.signAllTransactions<VersionedTransaction | Transaction>([createTx, feeTx])

      mark((step = 3), 'doing')
      const createSig = await sendAndConfirm(signedCreate.serialize())
      const p: Pending = {
        mint: mintKp.publicKey.toBase58(),
        createSig,
        creator: wallet.address,
        metadataUri: meta.metadataUri,
        image: meta.image ?? null,
        input: input.value,
      }
      // the coin exists now; remember it so the fish can still be claimed if anything below fails
      localStorage.setItem(PENDING_KEY, JSON.stringify(p))
      setPending(p)
      step = 4
      await payAndRegister(p, signedFee.serialize())
    } catch (err) {
      mark(step, 'failed')
      setError(err instanceof Error ? err.message : 'launch failed')
    } finally {
      setRunning(false)
    }
  }

  const resume = async () => {
    if (!pending) return
    if (!wallet || wallet.address !== pending.creator) return setError(`connect the wallet that created $${pending.input.symbol} (${pending.creator.slice(0, 4)}…${pending.creator.slice(-4)}).`)
    setError(null)
    setRunning(true)
    setSteps(STEPS.map((_, i) => (i < 4 ? 'done' : 'todo')))
    try {
      await payAndRegister(pending, null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not finish the launch')
      setSteps((s) => s.map((x) => (x === 'doing' ? 'failed' : x)))
    } finally {
      setRunning(false)
    }
  }

  const wallets = typeof window !== 'undefined' ? detectWallets() : []
  const sp = SPECIES[species]
  const providers = [...new Set(MODEL_OPTIONS.map((m) => m.provider))] as Provider[]
  const available = (id: string) => config?.models.find((m) => m.id === id)?.available ?? false
  const canLaunch = !!config?.launchEnabled && !running

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="panel sheet-up scroll-thin max-h-[94vh] w-full max-w-[860px] overflow-y-auto bg-panel! sm:max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 id={titleId} className="text-[12px] tracking-[0.25em] text-aqua">
            LAUNCH A COIN
          </h2>
          <button className="btn" onClick={onClose} disabled={running} aria-label="Close">
            esc ×
          </button>
        </div>

        {pending && !running && (
          <div className="m-4 mb-0 border border-warn/50 p-3 text-[12px]">
            <p>
              <span className="text-warn">${pending.input.symbol}</span> was created on pump.fun but its fish hasn&apos;t been dropped in yet (the launch fee
              or registration didn&apos;t finish).
            </p>
            <div className="mt-2 flex gap-2">
              <button className="btn border-warn! text-warn!" onClick={resume}>
                finish launch
              </button>
              <button
                className="btn"
                onClick={() => {
                  localStorage.removeItem(PENDING_KEY)
                  setPending(null)
                }}
              >
                dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-5 p-4 md:grid-cols-[1fr_250px]">
          <div className="space-y-5">
            <fieldset className="grid gap-3 sm:grid-cols-[1fr_140px]" disabled={running}>
              <legend className="label mb-1">the coin</legend>
              <div>
                <label htmlFor="coin-name" className="label">
                  name
                </label>
                <input id="coin-name" ref={nameRef} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bubble Lord" className="mt-1 w-full border border-line2 bg-ink px-2 py-1.5 text-[13px] text-fg placeholder:text-faint focus:border-aqua focus:outline-none" />
              </div>
              <div>
                <label htmlFor="coin-symbol" className="label">
                  ticker
                </label>
                <input id="coin-symbol" value={symbol} maxLength={10} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="BUBL" className="mt-1 w-full border border-line2 bg-ink px-2 py-1.5 text-[13px] text-fg uppercase placeholder:text-faint focus:border-aqua focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="coin-desc" className="label">
                  description <span className="tracking-normal normal-case text-faint">(optional)</span>
                </label>
                <textarea id="coin-desc" value={description} maxLength={300} rows={2} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full resize-none border border-line2 bg-ink px-2 py-1.5 text-[12px] text-fg focus:border-aqua focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="coin-image" className="label">
                  image <span className="tracking-normal normal-case text-faint">(png, jpg, gif or webp, under 2 MB)</span>
                </label>
                <input
                  id="coin-image"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    if (f && f.size > 2 * 1024 * 1024) return setError('the image must be under 2 MB.')
                    setImage(f)
                  }}
                  className="mt-1 block w-full text-[12px] text-dim file:mr-3 file:border file:border-line2 file:bg-ink file:px-2 file:py-1 file:text-[11px] file:text-fg file:uppercase"
                />
              </div>
            </fieldset>

            <fieldset disabled={running}>
              <legend className="label">its fish</legend>
              <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
                {SPECIES_LIST.map((s) => (
                  <button key={s.id} type="button" aria-pressed={species === s.id} onClick={() => pickSpecies(s.id)} className={`border px-2 py-1.5 text-left text-[11px] ${species === s.id ? 'border-aqua bg-aqua/10 text-aqua' : 'border-line text-dim hover:border-line2 hover:text-fg'}`}>
                    <span className="block text-[10px] opacity-70" aria-hidden>
                      {s.ascii}
                    </span>
                    {s.name.toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`color ${c}`}
                    aria-pressed={color === c}
                    onClick={() => {
                      setColor(c)
                      setColorTouched(true)
                    }}
                    className={`h-6 w-6 border ${color === c ? 'border-aqua outline outline-1 outline-aqua' : 'border-line2'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {PRESET_LIST.map((p) => (
                  <button key={p} type="button" aria-pressed={preset === p} onClick={() => setPreset(p)} className="btn">
                    {p}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-dim">{PRESETS[preset].blurb}</p>
              <label htmlFor="fish-text" className="sr-only">
                custom personality
              </label>
              <textarea id="fish-text" value={personalityText} maxLength={240} rows={2} onChange={(e) => setPersonalityText(e.target.value)} placeholder="optional: extremely curious, likes caves, dislikes the surface." className="mt-2 w-full resize-none border border-line2 bg-ink px-2 py-1.5 text-[12px] text-fg placeholder:text-faint focus:border-aqua focus:outline-none" />
            </fieldset>

            <fieldset disabled={running}>
              <legend className="label">its brain</legend>
              <p className="mt-0.5 text-[11px] text-dim">the model that thinks and talks for your fish. all brains are included in the launch fee.</p>
              {config && !config.models.some((m) => m.available) && (
                <p className="mt-2 border border-warn/50 px-2 py-1 text-[11px] text-warn">
                  no ai providers are connected on this server yet, so brains can&apos;t be picked. the site owner needs to add at least one of
                  ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY or DEEPSEEK_API_KEY.
                </p>
              )}
              <div className="mt-2 space-y-2">
                {providers.map((p) => (
                  <div key={p} className="grid grid-cols-[72px_1fr] items-start gap-2">
                    <span className="pt-1.5 text-[11px] text-dim">{PROVIDER_LABEL[p]}</span>
                    <div className="flex flex-wrap gap-1">
                      {MODEL_OPTIONS.filter((m) => m.provider === p).map((m) => {
                        const ok = available(m.id)
                        return (
                          <button key={m.id} type="button" disabled={!ok} aria-pressed={model === m.id} onClick={() => setModel(m.id)} title={ok ? m.blurb : 'not available on this server yet'} className="btn">
                            {m.label}
                            {!ok && <span className="ml-1 opacity-60">(soon)</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col gap-3">
            <div className="border border-line bg-ink p-2">
              <div className="label mb-1">preview</div>
              <div className="flex h-[110px] items-center justify-center">
                <FishSprite look={{ species, color }} width={200} height={100} animate label={`preview of the ${sp.name}`} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px]">
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-8 w-8 border border-line2 object-cover" />
                )}
                <div>
                  <div className="text-fg">{(name || 'unnamed').toUpperCase()}</div>
                  <div className="text-dim">${symbol || 'TICKER'} · {sp.name.toLowerCase()}</div>
                </div>
              </div>
            </div>

            <div className="border border-line p-2 text-[11px]">
              <label htmlFor="dev-buy" className="label">
                initial buy (sol, optional)
              </label>
              <input id="dev-buy" type="number" min="0" max="5" step="0.01" value={devBuy} disabled={running} onChange={(e) => setDevBuy(e.target.value)} className="mt-1 w-full border border-line2 bg-ink px-2 py-1 text-[12px] text-fg focus:border-aqua focus:outline-none" />
              <p className="mt-2 text-dim">
                launch fee <span className="text-fg">{config ? `${config.feeSol} SOL` : '…'}</span>, plus pump.fun&apos;s creation cost, network fees and your initial buy.
              </p>
            </div>

            {!wallet ? (
              <div className="space-y-1">
                {wallets.length ? (
                  wallets.map((w) => (
                    <button key={w.name} className="btn block w-full py-2!" onClick={() => connect(w)} disabled={running}>
                      connect {w.name}
                    </button>
                  ))
                ) : (
                  <p className="text-[11px] text-dim">
                    no solana wallet found. install{' '}
                    <a className="underline hover:text-aqua" href="https://phantom.com" target="_blank" rel="noreferrer">
                      phantom
                    </a>{' '}
                    or solflare to launch.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-dim">
                {wallet.w.name} · <span className="text-fg">{wallet.address.slice(0, 4)}…{wallet.address.slice(-4)}</span>
              </p>
            )}

            {(running || steps.some((s) => s !== 'todo')) && (
              <ol className="space-y-0.5 text-[11px]" aria-live="polite">
                {STEPS.map((s, i) => (
                  <li key={s} className={steps[i] === 'done' ? 'text-good' : steps[i] === 'doing' ? 'text-aqua' : steps[i] === 'failed' ? 'text-bad' : 'text-dim'}>
                    [{steps[i] === 'done' ? 'x' : steps[i] === 'doing' ? '~' : steps[i] === 'failed' ? '!' : ' '}] {s}
                  </li>
                ))}
              </ol>
            )}
            {error && (
              <p role="alert" className="border border-bad/50 px-2 py-1 text-[11px] text-bad">
                {error}
              </p>
            )}
            {config && !config.launchEnabled && <p className="text-[11px] text-warn">{config.reason}</p>}
            <button className="btn mt-auto border-aqua! py-2! text-aqua! hover:bg-aqua! hover:text-ink!" onClick={launch} disabled={!canLaunch || !wallet}>
              {running ? 'launching…' : 'launch coin →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
