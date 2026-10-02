import type { PersonalityPreset, SpeciesId } from '@/types/fish'
import { SPECIES } from '@/simulation/species'
import { PRESETS } from '@/simulation/fish'
import { MODEL_OPTIONS } from './models'

/** what a creator fills in; validated identically in the browser and on the server */
export interface LaunchInput {
  name: string
  symbol: string
  description: string
  species: SpeciesId
  color: string
  preset: PersonalityPreset
  personalityText: string
  model: string
}

export function normalizeLaunch(raw: Record<string, unknown>): { ok: true; value: LaunchInput } | { ok: false; error: string } {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
  const name = str(raw.name, 32)
  const symbol = str(raw.symbol, 10).replace(/^\$/, '').toUpperCase()
  if (name.length < 2) return { ok: false, error: 'the coin needs a name (2–32 characters).' }
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return { ok: false, error: 'the ticker must be 2–10 letters or digits.' }
  const species = raw.species as SpeciesId
  if (!(species in SPECIES)) return { ok: false, error: 'pick a species.' }
  const preset = raw.preset as PersonalityPreset
  if (!(preset in PRESETS)) return { ok: false, error: 'pick a personality.' }
  const model = str(raw.model, 40)
  if (!MODEL_OPTIONS.some((m) => m.id === model)) return { ok: false, error: 'pick a brain for your fish.' }
  const color = /^#[0-9a-f]{6}$/i.test(String(raw.color)) ? String(raw.color) : SPECIES[species].color
  return {
    ok: true,
    value: { name, symbol, description: str(raw.description, 300), species, color, preset, personalityText: str(raw.personalityText, 240), model },
  }
}
