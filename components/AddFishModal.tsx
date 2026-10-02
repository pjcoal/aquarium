'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PersonalityPreset, SpeciesId } from '@/types/fish'
import { SPECIES, SPECIES_LIST } from '@/simulation/species'
import { NAME_POOL, PRESETS, PRESET_LIST } from '@/simulation/fish'
import { getEngine } from '@/simulation/engine'
import { FishSprite } from './FishSprite'

const SWATCHES = ['#3ad7ff', '#ff8a3d', '#c2185b', '#ff7a1a', '#d9dde3', '#ff9f1c', '#e8d27a', '#e0313f', '#7dff9e', '#b48cff', '#5b6cff', '#f5f0e6']

export function AddFishModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [species, setSpecies] = useState<SpeciesId>('neon-tetra')
  const [color, setColor] = useState(SPECIES['neon-tetra'].color)
  const [colorTouched, setColorTouched] = useState(false)
  const [preset, setPreset] = useState<PersonalityPreset>('CURIOUS')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // keep focus inside the dialog
      if (e.key === 'Tab' && dialogRef.current) {
        const els = dialogRef.current.querySelectorAll<HTMLElement>('button, input, textarea, [tabindex]:not([tabindex="-1"])')
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
  }, [onClose])

  const pickSpecies = (s: SpeciesId) => {
    setSpecies(s)
    if (!colorTouched) setColor(SPECIES[s].color)
  }

  const suggest = () => {
    const taken = new Set(getEngine().world.fish.map((f) => f.name.toLowerCase()))
    const free = NAME_POOL.filter((n) => !taken.has(n.toLowerCase()))
    const pool = free.length ? free : NAME_POOL
    setName(pool[Math.floor(Math.random() * pool.length)])
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    const engine = getEngine()
    if (!n) return setError('every fish needs a name.')
    if (n.length > 18) return setError('names are at most 18 characters.')
    if (engine.world.fish.some((f) => f.name.toLowerCase() === n.toLowerCase())) return setError(`a fish named ${n} already lives here.`)
    const f = engine.addFish({ name: n, species, color, preset, personalityText: text.trim() })
    if (!f) return setError('the tank is full (80 fish).')
    engine.ui.selectedId = f.id
    engine.ui.track = true
    engine.notify()
    // stop tracking once the fish has settled in
    setTimeout(() => {
      if (engine.ui.selectedId === f.id) {
        engine.ui.track = false
        engine.notify()
      }
    }, 9000)
    onClose()
    router.push('/')
  }

  const sp = SPECIES[species]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="panel sheet-up scroll-thin max-h-[92vh] w-full max-w-[720px] overflow-y-auto bg-panel! sm:max-h-[88vh]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 id={titleId} className="text-[12px] tracking-[0.25em] text-aqua">
            INTRODUCE A FISH
          </h2>
          <button className="btn" onClick={onClose} aria-label="Close">
            esc ×
          </button>
        </div>
        <form onSubmit={submit} className="grid gap-5 p-4 sm:grid-cols-[1fr_220px]">
          <div className="space-y-5">
            <div>
              <label htmlFor="fish-name" className="label">
                name
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="fish-name"
                  ref={nameRef}
                  value={name}
                  maxLength={18}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                  placeholder="e.g. Pebble"
                  autoComplete="off"
                  className="w-full border border-line2 bg-ink px-2 py-1.5 text-[13px] text-fg placeholder:text-faint focus:border-aqua focus:outline-none"
                />
                <button type="button" className="btn shrink-0" onClick={suggest}>
                  suggest
                </button>
              </div>
            </div>

            <fieldset>
              <legend className="label">species</legend>
              <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
                {SPECIES_LIST.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={species === s.id}
                    onClick={() => pickSpecies(s.id)}
                    className={`border px-2 py-1.5 text-left text-[11px] ${species === s.id ? 'border-aqua bg-aqua/10 text-aqua' : 'border-line text-dim hover:border-line2 hover:text-fg'}`}
                  >
                    <span className="block text-[10px] opacity-70" aria-hidden>
                      {s.ascii}
                    </span>
                    {s.name.toLowerCase()}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-dim">{sp.traits.join(' · ')}</p>
            </fieldset>

            <fieldset>
              <legend className="label">color</legend>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                <label className="ml-1 flex items-center gap-1 text-[11px] text-dim">
                  custom
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value)
                      setColorTouched(true)
                    }}
                    className="h-6 w-8 cursor-pointer border border-line2 bg-transparent"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="label">personality</legend>
              <div className="mt-1 flex flex-wrap gap-1">
                {PRESET_LIST.map((p) => (
                  <button key={p} type="button" aria-pressed={preset === p} onClick={() => setPreset(p)} className="btn">
                    {p}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-dim">{PRESETS[preset].blurb}</p>
            </fieldset>

            <div>
              <label htmlFor="fish-text" className="label">
                custom personality <span className="normal-case tracking-normal text-faint">(optional)</span>
              </label>
              <textarea
                id="fish-text"
                value={text}
                maxLength={240}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Extremely curious, likes caves, follows smaller fish, dislikes the surface."
                className="mt-1 w-full resize-none border border-line2 bg-ink px-2 py-1.5 text-[12px] text-fg placeholder:text-faint focus:border-aqua focus:outline-none"
              />
              <p className="text-[10px] text-dim">
                understood: curious, shy, brave, social, loner, aggressive, gentle, lazy, energetic, chaotic, calm · likes/dislikes caves, plants, rocks,
                driftwood, bubbles, filter, surface, bottom · follows smaller fish
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="border border-line bg-ink p-2">
              <div className="label mb-1">preview</div>
              <div className="flex h-[120px] items-center justify-center bg-ink">
                <FishSprite look={{ species, color }} width={190} height={110} animate label={`preview of ${sp.name}`} />
              </div>
              <div className="mt-2 text-[12px]">
                <div className="text-fg">{(name || 'unnamed').toUpperCase()}</div>
                <div className="text-dim">{sp.name.toLowerCase()}</div>
                <div className="mt-1 text-[11px] text-aqua-dim">{preset.toLowerCase()}</div>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-dim">
              the fish will be lowered in at the surface. it starts knowing nothing about the tank, and nobody knows it.
            </p>
            {error && (
              <p role="alert" className="border border-bad/50 px-2 py-1 text-[11px] text-bad">
                {error}
              </p>
            )}
            <button type="submit" className="btn mt-auto border-aqua! py-2! text-aqua! hover:bg-aqua! hover:text-ink!">
              release into tank →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
