import type { Obstacle, Place } from '@/types/simulation'
import type { DayPhase } from '@/types/simulation'
import type { Vec } from '@/types/fish'

export const TANK_W = 1800
export const TANK_H = 900
export const SURFACE_Y = 34
/** top of the substrate as a function of x */
export function sandY(x: number): number {
  return 822 + 10 * Math.sin(x / 170) + 6 * Math.sin(x / 53 + 1.3) + (x > 1250 && x < 1600 ? -8 : 0)
}

/** usable water bounds for fish */
export const WATER = {
  left: 18,
  right: TANK_W - 18,
  top: SURFACE_Y + 14,
}

export const STATIC_PLACES: Place[] = [
  { id: 'cave', kind: 'cave', name: 'the cave', x: 1430, y: 788, r: 48, shelter: true },
  { id: 'old-rock', kind: 'rock', name: 'the old rock', x: 560, y: 728, r: 70, shelter: false },
  { id: 'fern', kind: 'plant', name: 'the tall fern', x: 235, y: 650, r: 95, shelter: true },
  { id: 'grass', kind: 'plant', name: 'the tall grass', x: 1185, y: 680, r: 80, shelter: true },
  { id: 'red-weed', kind: 'plant', name: 'the red weed', x: 1660, y: 720, r: 70, shelter: true },
  { id: 'driftwood', kind: 'driftwood', name: 'the driftwood', x: 960, y: 735, r: 85, shelter: false },
  { id: 'filter', kind: 'filter', name: 'the filter', x: 1660, y: 260, r: 80, shelter: false },
  { id: 'bubbler', kind: 'bubbler', name: 'the bubble stone', x: 780, y: 790, r: 55, shelter: false },
  { id: 'pot', kind: 'pot', name: 'the clay pot', x: 405, y: 808, r: 40, shelter: true },
  { id: 'surface', kind: 'surface', name: 'the surface light', x: 900, y: 70, r: 160, shelter: false },
]

export const OBSTACLES: Obstacle[] = [
  // old rock
  { x: 560, y: 812, r: 62 },
  { x: 520, y: 830, r: 50 },
  // cave mound (leaving the mouth open)
  { x: 1335, y: 805, r: 52 },
  { x: 1525, y: 805, r: 52 },
  { x: 1430, y: 712, r: 44 },
  { x: 1380, y: 735, r: 30 },
  { x: 1480, y: 735, r: 30 },
  // clay pot
  { x: 360, y: 828, r: 30 },
  // driftwood branch
  { x: 860, y: 815, r: 16 },
  { x: 905, y: 795, r: 16 },
  { x: 950, y: 775, r: 15 },
  { x: 995, y: 755, r: 14 },
  { x: 1040, y: 737, r: 13 },
  { x: 1080, y: 722, r: 12 },
  // filter tube on the right wall
  { x: 1745, y: 120, r: 34 },
  { x: 1745, y: 220, r: 34 },
  { x: 1745, y: 320, r: 34 },
  { x: 1745, y: 420, r: 34 },
  { x: 1745, y: 520, r: 34 },
  { x: 1745, y: 600, r: 34 },
]

export const BUBBLE_SOURCES: Vec[] = [
  { x: 780, y: 818 },
  { x: 1712, y: 640 },
]

export interface PlantDef {
  x: number
  baseY: number
  blades: number
  height: number
  hue: number
  kind: 'fern' | 'grass' | 'weed' | 'moss'
  /** fraction of blades drawn in front of fish */
  front: number
  seed: number
}

export const PLANTS: PlantDef[] = [
  { x: 190, baseY: 830, blades: 9, height: 380, hue: 140, kind: 'fern', front: 0.35, seed: 1 },
  { x: 275, baseY: 832, blades: 7, height: 300, hue: 128, kind: 'fern', front: 0.3, seed: 2 },
  { x: 110, baseY: 828, blades: 6, height: 220, hue: 150, kind: 'grass', front: 0.2, seed: 3 },
  { x: 1150, baseY: 822, blades: 12, height: 300, hue: 112, kind: 'grass', front: 0.4, seed: 4 },
  { x: 1225, baseY: 818, blades: 10, height: 240, hue: 118, kind: 'grass', front: 0.35, seed: 5 },
  { x: 1640, baseY: 820, blades: 7, height: 200, hue: 2, kind: 'weed', front: 0.3, seed: 6 },
  { x: 1695, baseY: 822, blades: 6, height: 160, hue: 350, kind: 'weed', front: 0.25, seed: 7 },
  { x: 640, baseY: 832, blades: 4, height: 90, hue: 135, kind: 'moss', front: 0.1, seed: 8 },
  { x: 1580, baseY: 822, blades: 5, height: 110, hue: 145, kind: 'moss', front: 0.15, seed: 9 },
  { x: 30, baseY: 826, blades: 5, height: 140, hue: 160, kind: 'grass', front: 0.1, seed: 10 },
]

const CURIOSITY_KINDS = [
  { variant: 'shell', name: 'a snail shell' },
  { variant: 'pebble', name: 'a shiny pebble' },
  { variant: 'leaf', name: 'a sunken leaf' },
  { variant: 'current', name: 'a warm current' },
  { variant: 'glint', name: 'a glint in the sand' },
  { variant: 'seed', name: 'a drifting seed pod' },
  { variant: 'marble', name: 'a glass marble' },
]

export function makeCuriosity(rand: () => number, now: number, n: number): Place {
  const k = CURIOSITY_KINDS[Math.floor(rand() * CURIOSITY_KINDS.length)]
  const floating = k.variant === 'current' || k.variant === 'seed'
  let x = 0
  let y = 0
  for (let tries = 0; tries < 20; tries++) {
    x = 80 + rand() * (TANK_W - 260)
    y = floating ? 140 + rand() * 450 : sandY(x) - 10
    if (!OBSTACLES.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 20)) break
  }
  const near = nearestStaticPlace({ x, y })
  const suffix = near && near.dist < 260 ? ` by ${near.place.name.replace(/^the /, 'the ')}` : ''
  return {
    id: `cur-${n}`,
    kind: 'curiosity',
    variant: k.variant,
    name: `${k.name}${suffix}`,
    x,
    y,
    r: 40,
    shelter: false,
    transient: true,
    expiresAt: now + (12 + rand() * 18) * 60_000,
  }
}

export function nearestStaticPlace(p: Vec, exclude?: string): { place: Place; dist: number } | null {
  let best: Place | null = null
  let bd = Infinity
  for (const pl of STATIC_PLACES) {
    if (pl.id === exclude) continue
    const d = Math.hypot(pl.x - p.x, pl.y - p.y)
    if (d < bd) {
      bd = d
      best = pl
    }
  }
  return best ? { place: best, dist: bd } : null
}

export type DepthBand = 'surface' | 'middle' | 'bottom'

export function depthFraction(y: number, x = TANK_W / 2): number {
  return Math.max(0, Math.min(1, (y - SURFACE_Y) / (sandY(x) - SURFACE_Y)))
}

export function depthBand(y: number): DepthBand {
  const d = depthFraction(y)
  if (d < 0.3) return 'surface'
  if (d < 0.7) return 'middle'
  return 'bottom'
}

export function sideOf(x: number): 'left' | 'center' | 'right' {
  if (x < TANK_W * 0.33) return 'left'
  if (x > TANK_W * 0.66) return 'right'
  return 'center'
}

/** coarse zone, used for school territories */
export function zoneName(p: Vec): string {
  const near = nearestStaticPlace(p)
  if (near && near.dist < near.place.r * 1.8) {
    if (near.place.kind === 'plant') return `${sideOf(p.x)} plants`
    return near.place.name.replace(/^the /, '')
  }
  const band = depthBand(p.y)
  const side = sideOf(p.x)
  if (band === 'surface') return side === 'center' ? 'upper water' : `upper ${side}`
  if (band === 'bottom') return side === 'center' ? 'sand flats' : `${side} floor`
  return side === 'center' ? 'open water' : `${side} water`
}

/** a natural-language location phrase: "near the driftwood", "in the upper water" */
export function locationPhrase(p: Vec, places: Place[] = STATIC_PLACES): string {
  let best: Place | null = null
  let bd = Infinity
  for (const pl of places) {
    const d = Math.hypot(pl.x - p.x, pl.y - p.y)
    if (d < bd) {
      bd = d
      best = pl
    }
  }
  if (best && bd < best.r * 2.2) {
    if (best.kind === 'cave' && bd < best.r) return 'inside the cave'
    if (best.kind === 'plant' && bd < best.r) return `among ${best.name.replace(/^the /, 'the ')}`
    if (best.kind === 'surface') return 'near the surface'
    return `near ${best.name}`
  }
  const band = depthBand(p.y)
  if (band === 'surface') return 'in the upper water'
  if (band === 'bottom') return 'along the bottom'
  return `in the ${sideOf(p.x) === 'center' ? 'open' : sideOf(p.x)} water`
}

/** day cycle: one full day per 24 minutes of world time */
export const DAY_LENGTH_MS = 24 * 60_000

export function dayPhase(worldTime: number): { phase: DayPhase; light: number; t: number } {
  const t = (worldTime % DAY_LENGTH_MS) / DAY_LENGTH_MS
  // t=0 dawn, 0.08-0.5 day, 0.5-0.6 dusk, 0.6-0.95 night
  let phase: DayPhase
  if (t < 0.08) phase = 'dawn'
  else if (t < 0.5) phase = 'day'
  else if (t < 0.6) phase = 'dusk'
  else if (t < 0.95) phase = 'night'
  else phase = 'dawn'
  let light: number
  if (t < 0.08) light = 0.35 + (t / 0.08) * 0.65
  else if (t < 0.5) light = 1
  else if (t < 0.6) light = 1 - ((t - 0.5) / 0.1) * 0.7
  else if (t < 0.95) light = 0.3
  else light = 0.3 + ((t - 0.95) / 0.05) * 0.05
  return { phase, light, t }
}
