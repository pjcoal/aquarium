import type { PersonalityPreset, SpeciesId } from '@/types/fish'
import type { WorldState } from '@/types/simulation'
import { createFish } from './fish'
import { SPECIES } from './species'
import { DAY_LENGTH_MS, STATIC_PLACES, SURFACE_Y, sandY } from './environment'
import { rel } from './relationships'
import { WORLD_VERSION } from '@/lib/storage'
import { mulberry32 } from '@/lib/random'

interface SeedFish {
  name: string
  species: SpeciesId
  preset: PersonalityPreset
  text?: string
  x: number
  y?: number
}

const ROSTER: SeedFish[] = [
  { name: 'Luna', species: 'neon-tetra', preset: 'CURIOUS', x: 420 },
  { name: 'Nova', species: 'neon-tetra', preset: 'SOCIAL', x: 450 },
  { name: 'Milo', species: 'neon-tetra', preset: 'SOCIAL', x: 470 },
  { name: 'Wren', species: 'neon-tetra', preset: 'SHY', x: 400 },
  { name: 'Ivo', species: 'neon-tetra', preset: 'CALM', x: 500 },
  { name: 'Glim', species: 'neon-tetra', preset: 'SOCIAL', x: 440 },
  { name: 'Jet', species: 'zebra-danio', preset: 'CHAOTIC', x: 1000 },
  { name: 'Lark', species: 'zebra-danio', preset: 'ADVENTUROUS', x: 1040 },
  { name: 'Zeno', species: 'zebra-danio', preset: 'SOCIAL', x: 980 },
  { name: 'Dot', species: 'zebra-danio', preset: 'CHAOTIC', x: 1060 },
  { name: 'Pip', species: 'guppy', preset: 'CURIOUS', x: 760 },
  { name: 'Fig', species: 'guppy', preset: 'SOCIAL', x: 800 },
  { name: 'Ember', species: 'guppy', preset: 'LAZY', x: 720 },
  { name: 'Coral', species: 'cherry-barb', preset: 'CALM', x: 260 },
  { name: 'Rue', species: 'cherry-barb', preset: 'SHY', x: 230 },
  { name: 'Sable', species: 'cherry-barb', preset: 'SOCIAL', x: 290 },
  { name: 'Kit', species: 'cherry-barb', preset: 'CALM', x: 320 },
  { name: 'Atlas', species: 'betta', preset: 'TERRITORIAL', text: 'Proud. Likes the cave. Dislikes crowds.', x: 1430, y: 760 },
  { name: 'Finn', species: 'clownfish', preset: 'CURIOUS', text: 'Extremely curious, likes caves, follows smaller fish.', x: 1120 },
  { name: 'Orin', species: 'clownfish', preset: 'TERRITORIAL', text: 'Brave. Loves the red weed.', x: 1650, y: 700 },
  { name: 'Juno', species: 'angelfish', preset: 'CALM', x: 880 },
  { name: 'Mira', species: 'angelfish', preset: 'ADVENTUROUS', x: 940 },
  { name: 'Basil', species: 'goldfish', preset: 'LAZY', text: 'Slow. Loves the sand and the bottom.', x: 620 },
  { name: 'Gus', species: 'goldfish', preset: 'CALM', x: 680 },
]

const HOUR = 3_600_000

export function createSeedWorld(): WorldState {
  const now = Date.now()
  const rand = mulberry32((now & 0xffffffff) >>> 0)
  // the tank has "existed" for six days before you first look in; open in daylight
  const worldTime = 6 * 24 * HOUR + Math.floor((0.12 + rand() * 0.15) * DAY_LENGTH_MS)
  const w: WorldState = {
    version: WORLD_VERSION,
    createdAt: now,
    worldTime,
    savedAt: now,
    fish: [],
    schools: [],
    curiosities: [],
    food: [],
    counters: {
      interactions: 0,
      discoveries: 0,
      meals: 0,
      nextEventId: 1,
      nextFoodId: 1,
      nextSchoolNum: Math.floor(rand() * 12),
      lastFeedAt: worldTime,
      nextFeedAt: worldTime + 45_000,
      nextCuriosityAt: worldTime + 60_000,
    },
    events: [],
    firstFinds: {},
    territories: {},
    lastPhase: '',
    conversations: [],
    escape: { stage: 0, notes: [], attempts: 0 },
  }

  for (const s of ROSTER) {
    const sp = SPECIES[s.species]
    const d = (sp.depth[0] + sp.depth[1]) / 2
    const x = s.x + (rand() - 0.5) * 60
    const y = s.y ?? SURFACE_Y + d * (sandY(x) - SURFACE_Y - 40) + (rand() - 0.5) * 60
    const ageMs = (2 + rand() * 140) * HOUR
    const f = createFish({ name: s.name, species: s.species, preset: s.preset, personalityText: s.text }, worldTime, rand, { ageMs, x, y })
    f.introducedAt = now - ageMs
    f.memories.push({ t: f.createdAt, kind: 'arrival', text: 'arrived in the tank', valence: 0.1 })
    // older and more curious fish already know more of the tank
    const known = Math.round(STATIC_PLACES.length * Math.min(1, (ageMs / (140 * HOUR)) * 0.6 + f.personality.curiosity * 0.4))
    const sorted = [...STATIC_PLACES].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))
    for (const pl of sorted.slice(0, known)) {
      // exclude the cave: let it be discovered while you watch
      if (pl.id === 'cave' && s.name !== 'Atlas') continue
      const t = f.createdAt + rand() * ageMs
      f.discoveries.push({ placeId: pl.id, name: pl.name, t })
      if (!w.firstFinds[pl.id]) w.firstFinds[pl.id] = f.id
      w.counters.discoveries++
    }
    f.discoveries.sort((a, b) => b.t - a.t)
    for (const dsc of f.discoveries.slice(0, 3)) {
      f.memories.unshift({ t: dsc.t, kind: 'discovery', text: `discovered ${dsc.name}`, valence: 0.5, placeId: dsc.placeId })
    }
    f.memories.sort((a, b) => b.t - a.t)
    f.nextThoughtAt = worldTime + 300 + rand() * 2500
    w.fish.push(f)
  }

  // some history between fish
  const by = (n: string) => w.fish.find((f) => f.name === n)!
  for (const a of w.fish) {
    for (const b of w.fish) {
      if (a === b || a.species !== b.species) continue
      const r = rel(a, b)
      r.score = 0.05 + rand() * 0.2
      r.familiarity = 0.2 + rand() * 0.4
      r.lastSeen = worldTime - rand() * HOUR
    }
  }
  const set = (a: string, b: string, score: number, extra: Partial<ReturnType<typeof rel>> = {}) => {
    const r = rel(by(a), by(b))
    r.score = score
    r.familiarity = Math.max(r.familiarity, 0.4)
    Object.assign(r, extra)
  }
  set('Luna', 'Milo', 0.38)
  set('Luna', 'Nova', 0.36, { follows: 6 })
  set('Nova', 'Luna', 0.42)
  set('Luna', 'Finn', -0.2, { chasedBy: 1 })
  set('Finn', 'Pip', 0.3)
  set('Mira', 'Juno', 0.4)
  set('Juno', 'Mira', 0.35)
  set('Basil', 'Gus', 0.5)
  set('Gus', 'Basil', 0.45)
  set('Rue', 'Atlas', -0.3, { chasedBy: 2 })
  set('Atlas', 'Orin', -0.25, { chased: 1, chasedBy: 1 })
  set('Orin', 'Atlas', -0.25, { chased: 1, chasedBy: 1 })
  by('Atlas').prefs.placeAffinity['cave'] = 0.6
  by('Orin').prefs.placeAffinity['red-weed'] = 0.6
  by('Finn').memories.unshift({ t: worldTime - 21 * 60_000, kind: 'threat', text: 'hid when Atlas approached', fishId: by('Atlas').id, valence: -0.5 })
  by('Luna').memories.unshift(
    { t: worldTime - 2 * 60_000, kind: 'food', text: 'found food near the filter', valence: 0.5, pos: { x: 1600, y: 300 } },
    { t: worldTime - 8 * 60_000, kind: 'social', text: 'swam with Nova', fishId: by('Nova').id, valence: 0.4 },
  )
  return w
}
