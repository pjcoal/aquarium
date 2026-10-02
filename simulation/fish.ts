import type { Fish, Personality, PersonalityPreset, SpeciesId } from '@/types/fish'
import { SPECIES } from './species'
import { TANK_W, SURFACE_Y } from './environment'
import { clamp, uid } from '@/lib/random'

export const PRESETS: Record<PersonalityPreset, { traits: Personality; blurb: string }> = {
  CURIOUS: {
    traits: { social: 0.5, aggression: 0.15, curiosity: 0.95, energy: 0.7, bravery: 0.65, chaos: 0.3 },
    blurb: 'investigates everything, remembers where things are',
  },
  SHY: {
    traits: { social: 0.35, aggression: 0.05, curiosity: 0.4, energy: 0.45, bravery: 0.12, chaos: 0.15 },
    blurb: 'keeps to shelter, startles easily',
  },
  SOCIAL: {
    traits: { social: 0.95, aggression: 0.1, curiosity: 0.5, energy: 0.65, bravery: 0.5, chaos: 0.25 },
    blurb: 'seeks company, joins schools quickly',
  },
  TERRITORIAL: {
    traits: { social: 0.25, aggression: 0.85, curiosity: 0.4, energy: 0.6, bravery: 0.85, chaos: 0.25 },
    blurb: 'claims places and defends them',
  },
  LAZY: {
    traits: { social: 0.45, aggression: 0.1, curiosity: 0.25, energy: 0.15, bravery: 0.4, chaos: 0.1 },
    blurb: 'rests often, moves only when it must',
  },
  ADVENTUROUS: {
    traits: { social: 0.45, aggression: 0.3, curiosity: 0.8, energy: 0.9, bravery: 0.9, chaos: 0.4 },
    blurb: 'roams far, fears little',
  },
  CHAOTIC: {
    traits: { social: 0.5, aggression: 0.45, curiosity: 0.7, energy: 0.85, bravery: 0.6, chaos: 0.95 },
    blurb: 'changes its mind constantly',
  },
  CALM: {
    traits: { social: 0.55, aggression: 0.1, curiosity: 0.45, energy: 0.4, bravery: 0.55, chaos: 0.05 },
    blurb: 'steady, patient, rarely startled',
  },
}

export const PRESET_LIST = Object.keys(PRESETS) as PersonalityPreset[]

export interface NewFishInput {
  name: string
  species: SpeciesId
  color?: string
  preset: PersonalityPreset
  personalityText?: string
}

const jitter = (rand: () => number, x: number, amt = 0.12) => clamp(x + (rand() - 0.5) * 2 * amt)

/**
 * Parse free-form personality text into trait nudges and preferences.
 * "Extremely curious, likes caves, follows smaller fish, dislikes the surface."
 */
export function applyPersonalityText(f: Fish, text: string) {
  const t = text.toLowerCase()
  const p = f.personality
  const intensity = /\b(extremely|very|super|incredibly|really)\b/.test(t) ? 0.3 : 0.18
  const nudge = (k: keyof Personality, amt: number) => (p[k] = clamp(p[k] + amt))
  if (/curious|inquisitive|nosy/.test(t)) nudge('curiosity', intensity)
  if (/\bshy|timid|nervous|skittish/.test(t)) {
    nudge('bravery', -intensity)
    nudge('social', -0.1)
  }
  if (/brave|bold|fearless/.test(t)) nudge('bravery', intensity)
  if (/social|friendly|outgoing/.test(t)) nudge('social', intensity)
  if (/loner|solitary|alone|antisocial/.test(t)) nudge('social', -intensity)
  if (/aggressive|mean|grumpy|territorial|bully/.test(t)) nudge('aggression', intensity)
  if (/gentle|peaceful|kind/.test(t)) nudge('aggression', -intensity)
  if (/lazy|sleepy|slow/.test(t)) nudge('energy', -intensity)
  if (/energetic|hyper|fast|restless|active/.test(t)) nudge('energy', intensity)
  if (/chaotic|random|unpredictable|weird|strange/.test(t)) nudge('chaos', intensity)
  if (/calm|steady|patient|chill/.test(t)) nudge('chaos', -intensity)

  const placeWords: [RegExp, string[]][] = [
    [/caves?|dark/, ['cave']],
    [/plants?|fern|grass|weed|green/, ['fern', 'grass', 'red-weed']],
    [/rocks?|stones?/, ['old-rock']],
    [/driftwood|wood|branch/, ['driftwood']],
    [/bubbles?/, ['bubbler']],
    [/filter|current|flow/, ['filter']],
    [/pot\b/, ['pot']],
    [/surface|light|top/, ['surface']],
  ]
  // split into clauses so "likes caves, dislikes the surface" works per clause
  for (const clause of t.split(/[,.;]| and | but /)) {
    const dislike = /dislike|hate|avoid|fear|afraid|scared|not like|doesn't like|does not like/.test(clause)
    const like = !dislike && /like|love|enjoy|prefer|fond|seek|visit/.test(clause)
    if (!like && !dislike) continue
    for (const [re, ids] of placeWords) {
      if (!re.test(clause)) continue
      for (const id of ids) f.prefs.placeAffinity[id] = like ? 0.7 : -0.7
      if (re.source.startsWith('surface')) f.prefs.depthBias += like ? -0.25 : 0.25
      if (re.source.startsWith('caves')) f.prefs.likesCaves = like ? 0.8 : -0.8
    }
    if (/bottom|sand|floor|deep/.test(clause)) f.prefs.depthBias += like ? 0.25 : -0.25
  }
  if (/follows? smaller|likes? small(er)? fish/.test(t)) f.prefs.followsSmaller = true
  f.prefs.depthBias = clamp(f.prefs.depthBias, -0.5, 0.5)
}

export function createFish(input: NewFishInput, worldTime: number, rand: () => number, opts?: { ageMs?: number; entering?: boolean; x?: number; y?: number }): Fish {
  const sp = SPECIES[input.species]
  const base = PRESETS[input.preset].traits
  const personality: Personality = {
    social: jitter(rand, (base.social + sp.schooling) / 2),
    aggression: jitter(rand, base.aggression * 0.6 + sp.aggression * 0.4),
    curiosity: jitter(rand, base.curiosity),
    energy: jitter(rand, base.energy * 0.7 + sp.activity * 0.3),
    bravery: jitter(rand, base.bravery),
    chaos: jitter(rand, base.chaos, 0.08),
  }
  const entering = opts?.entering ?? false
  const x = opts?.x ?? 200 + rand() * (TANK_W - 400)
  const midDepth = (sp.depth[0] + sp.depth[1]) / 2
  const y = opts?.y ?? (entering ? SURFACE_Y - 10 : 80 + midDepth * 640)
  const id = uid(rand)
  const f: Fish = {
    id,
    name: input.name.trim().slice(0, 18) || 'Unnamed',
    species: input.species,
    color: input.color || sp.color,
    accent: sp.accent,
    scale: 0.88 + rand() * 0.26,
    personality,
    preset: input.preset,
    personalityText: (input.personalityText ?? '').slice(0, 240),
    pos: { x, y },
    vel: { x: (rand() - 0.5) * 30, y: entering ? 60 : 0 },
    heading: rand() < 0.5 ? 0 : Math.PI,
    speed: 0,
    energy: 0.6 + rand() * 0.35,
    hunger: 0.15 + rand() * 0.3,
    curiosity: 0.3 + rand() * 0.4,
    stress: entering ? 0.4 : 0,
    mood: entering ? 'startled' : 'calm',
    action: 'WANDER',
    actionSince: worldTime,
    actionDetail: entering ? 'entering the tank' : 'wandering',
    nextDecisionAt: worldTime + (entering ? 3500 : rand() * 2000),
    target: null,
    focusId: null,
    schoolId: null,
    territoryId: null,
    relationships: {},
    memories: [],
    discoveries: [],
    history: [],
    thoughts: [],
    lastThought: '',
    lastThoughtAt: 0,
    nextThoughtAt: worldTime + 2000 + rand() * 8000,
    createdAt: worldTime - (opts?.ageMs ?? 0),
    introducedAt: Date.now(),
    enteringUntil: entering ? worldTime + 3500 : 0,
    prefs: { placeAffinity: {}, depthBias: 0, followsSmaller: false, likesCaves: 0 },
    stats: { interactions: 0, distance: 0, meals: 0, chases: 0, fled: 0, activity: 0.3 },
    phase: rand() * Math.PI * 2,
  }
  if (input.personalityText) applyPersonalityText(f, input.personalityText)
  return f
}

export function bodyLength(f: Fish): number {
  return SPECIES[f.species].length * f.scale
}

/** visual height: one text row per line of the fish's ASCII art */
export function bodyHeight(f: Fish): number {
  return SPECIES[f.species].art.length * 24
}

export function isAwake(f: Fish): boolean {
  return f.action !== 'REST'
}

export function statusOf(f: Fish): 'AWAKE' | 'RESTING' | 'HIDING' | 'FLEEING' | 'ARRIVING' {
  if (f.enteringUntil > 0) return 'ARRIVING'
  if (f.action === 'REST') return 'RESTING'
  if (f.action === 'HIDE') return 'HIDING'
  if (f.action === 'FLEE') return 'FLEEING'
  return 'AWAKE'
}

export const NAME_POOL = [
  'Luna', 'Milo', 'Nova', 'Finn', 'Atlas', 'Coral', 'Pip', 'Juno', 'Orin', 'Kesh', 'Wren', 'Ivo',
  'Sable', 'Tull', 'Mira', 'Basil', 'Echo', 'Fable', 'Gus', 'Hollis', 'Ines', 'Jet', 'Koi', 'Lark',
  'Moss', 'Nell', 'Oslo', 'Perch', 'Quill', 'Rue', 'Sol', 'Tamsin', 'Umber', 'Vela', 'Wick', 'Yara',
  'Zeno', 'Bram', 'Cass', 'Dot', 'Ember', 'Fig', 'Glim', 'Hux', 'Indi', 'Jory', 'Kit', 'Lumen',
]
