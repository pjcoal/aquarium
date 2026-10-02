import type { Fish, FishAction, Target, Vec } from '@/types/fish'
import type { DayPhase, Food, Place, School, WorldState } from '@/types/simulation'
import { SPECIES } from './species'
import { SpatialHash } from './spatial'
import { EventLog } from './events'
import { TANK_W, depthFraction, locationPhrase, sandY, SURFACE_Y } from './environment'
import { add, arrive, avoidObstacles, boundaries, dist, flee, pursue, seek, v, wander } from './steering'
import { peekRel, rel } from './relationships'
import { favoritePlace, recallFoodSpot } from './memory'
import { bodyHeight, bodyLength } from './fish'
import { clamp } from '@/lib/random'

/** per-fish runtime data that is not persisted */
export interface FishRuntime {
  wanderAngle: number
  strayTime: number
  /** when the territory owner last visited its territory */
  territorySeenAt: number
  arrived: boolean
  /** world time before which this fish won't join a school again */
  schoolCooldownUntil: number
}

/** the slice of the engine that behavior code is allowed to touch */
export interface Sim {
  world: WorldState
  rand: () => number
  grid: SpatialHash
  byId: Map<string, Fish>
  log: EventLog
  light: number
  phase: DayPhase
  /** fish currently being chased, by target id */
  chasers: Map<string, Fish>
  rt(f: Fish): FishRuntime
  allPlaces(): Place[]
  placeById(id: string | null | undefined): Place | undefined
  schoolById(id: string | null | undefined): School | undefined
  foodById(id: number): Food | undefined
  setAction(f: Fish, a: FishAction, detail: string, target?: Target | null, focusId?: string | null): void
  eat(f: Fish, food: Food): void
  startChase(f: Fish, victim: Fish, place: Place | null, reason?: string): void
  startFollow(f: Fish, leader: Fish): void
  hide(f: Fish, place: Place | null, threat: Fish | null): void
}

export interface Perception {
  neighbors: Fish[]
  food: Food | null
  competitor: Fish | null
  threat: Fish | null
  threatDist: number
  intruder: Fish | null
  territory: Place | null
  newcomer: Fish | null
  unexplored: Place | null
  friend: Fish | null
  disliked: Fish | null
  dislikedDist: number
}

const ACTION_SPEED: Record<FishAction, number> = {
  IDLE: 0.16,
  WANDER: 0.55,
  EXPLORE: 0.72,
  FOLLOW: 0.85,
  SCHOOL: 0.78,
  EAT: 0.9,
  REST: 0.1,
  FLEE: 1.0,
  CHASE: 1.0,
  HIDE: 0.75,
  INVESTIGATE: 0.6,
}

const MIN_DUR: Partial<Record<FishAction, number>> = {
  REST: 20_000,
  HIDE: 7000,
  FOLLOW: 12_000,
  SCHOOL: 10_000,
  EXPLORE: 8000,
  INVESTIGATE: 5000,
  WANDER: 5000,
  IDLE: 4000,
  EAT: 2000,
  CHASE: 1500,
  FLEE: 1500,
}

const MAX_DUR: Partial<Record<FishAction, number>> = {
  FOLLOW: 60_000,
  SCHOOL: 150_000,
  IDLE: 25_000,
  WANDER: 30_000,
  EXPLORE: 45_000,
  INVESTIGATE: 25_000,
  HIDE: 45_000,
}

export function maxSpeedOf(f: Fish): number {
  const sp = SPECIES[f.species]
  return sp.maxSpeed * (0.85 + f.personality.energy * 0.3) * (0.55 + f.energy * 0.45) * (0.9 + f.scale * 0.1)
}

export function speedFor(f: Fish, arrived = true): number {
  let k = ACTION_SPEED[f.action]
  // travelling to a resting or hiding spot happens at normal pace
  if (!arrived && (f.action === 'REST' || f.action === 'IDLE')) k = 0.5
  if (f.action === 'WANDER' || f.action === 'EXPLORE') k *= 0.7 + SPECIES[f.species].activity * 0.4
  return maxSpeedOf(f) * k
}

/* ------------------------------------------------------------------ */
/* place helpers                                                       */
/* ------------------------------------------------------------------ */

export function restPhrase(pl: Place): string {
  switch (pl.kind) {
    case 'plant':
      return `beneath ${pl.name}`
    case 'cave':
      return 'in the cave'
    case 'pot':
      return 'inside the clay pot'
    case 'rock':
    case 'driftwood':
      return `beside ${pl.name}`
    default:
      return `near ${pl.name}`
  }
}

export function hidePhrase(pl: Place): string {
  if (pl.kind === 'plant') return `among ${pl.name}`
  return restPhrase(pl)
}

export function placeTarget(pl: Place, rand: () => number): { x: number; y: number } {
  const spread = pl.kind === 'cave' || pl.kind === 'pot' ? 0.2 : pl.kind === 'surface' ? 1 : 0.5
  const x = pl.x + (rand() - 0.5) * pl.r * spread * 2
  let y = pl.y + (rand() - 0.5) * pl.r * spread
  y = Math.min(y, sandY(x) - 16)
  return { x, y }
}

/** the owner of a place, if this fish dislikes them */
export function avoidedOwner(sim: Sim, f: Fish, pl: Place): Fish | null {
  const ownerId = sim.world.territories[pl.id]
  if (!ownerId || ownerId === f.id) return null
  const r = peekRel(f, ownerId)
  if (!r || r.score > -0.15) return null
  return sim.byId.get(ownerId) ?? null
}

export function pickShelter(sim: Sim, f: Fish, purpose: 'rest' | 'hide', threat: Fish | null): Place | null {
  let best: Place | null = null
  let bestScore = -Infinity
  for (const pl of sim.allPlaces()) {
    if (!pl.shelter) continue
    let s = (f.prefs.placeAffinity[pl.id] ?? 0) * 0.8
    if (pl.kind === 'cave' || pl.kind === 'pot') s += f.prefs.likesCaves * 0.5
    s -= dist(f.pos, pl) / (purpose === 'hide' ? 700 : 1400)
    if (avoidedOwner(sim, f, pl)) s -= 1.2
    const owner = sim.world.territories[pl.id]
    if (owner && owner !== f.id) s -= 0.3
    if (threat) s -= Math.max(0, 1 - dist(threat.pos, pl) / 300) * 1.2
    // crowded shelters are less appealing
    for (const o of sim.world.fish) {
      if (o !== f && (o.action === 'REST' || o.action === 'HIDE') && o.target?.id === pl.id) s -= 0.07
    }
    // depth preference: plants suit mid-depth fish, caves suit bottom dwellers
    const sp = SPECIES[f.species]
    s -= Math.abs(depthFraction(pl.y) - (sp.depth[0] + sp.depth[1]) / 2) * 0.4
    s += sim.rand() * 0.15
    if (s > bestScore) {
      bestScore = s
      best = pl
    }
  }
  return best
}

function randomPointInBand(f: Fish, rand: () => number, wide = false): Vec {
  const sp = SPECIES[f.species]
  const lo = clamp(sp.depth[0] + f.prefs.depthBias - (wide ? 0.15 : 0), 0.02, 0.95)
  const hi = clamp(sp.depth[1] + f.prefs.depthBias + (wide ? 0.1 : 0), lo + 0.05, 0.97)
  const x = 60 + rand() * (TANK_W - 120)
  const d = lo + rand() * (hi - lo)
  const y = SURFACE_Y + d * (sandY(x) - SURFACE_Y)
  return { x, y: Math.min(y, sandY(x) - 30) }
}

/* ------------------------------------------------------------------ */
/* perception                                                          */
/* ------------------------------------------------------------------ */

const scratch: Fish[] = []

export function perceive(sim: Sim, f: Fish): Perception {
  const sp = SPECIES[f.species]
  const now = sim.world.worldTime
  const range = sp.perception * (0.9 + f.personality.curiosity * 0.2) * (0.6 + sim.light * 0.4)
  sim.grid.query(f.pos.x, f.pos.y, range, scratch)
  const neighbors = scratch.filter((o) => o !== f)

  const p: Perception = {
    neighbors,
    food: null,
    competitor: null,
    threat: null,
    threatDist: Infinity,
    intruder: null,
    territory: null,
    newcomer: null,
    unexplored: null,
    friend: null,
    disliked: null,
    dislikedDist: Infinity,
  }

  // food: falling pellets are noticed from far away
  let fd = Math.max(range * 1.6, 480)
  for (const food of sim.world.food) {
    const d = dist(f.pos, food)
    if (d < fd) {
      fd = d
      p.food = food
    }
  }

  const territory = sim.placeById(f.territoryId)
  if (territory) p.territory = territory

  let friendScore = 0.22
  let intruderDist = Infinity
  for (const o of neighbors) {
    if (o.enteringUntil > 0) continue
    const d = dist(f.pos, o.pos)
    const r = peekRel(f, o.id)
    const chaser = sim.chasers.get(f.id)
    if (chaser === o && d < 260) {
      p.threat = o
      p.threatDist = d
    }
    if (r && r.score < -0.3) {
      const scary = bodyLength(o) > bodyLength(f) * 1.1 || o.personality.aggression > 0.55
      if (scary && d < 170 && d < p.threatDist && !p.threat) {
        p.threat = o
        p.threatDist = d
      }
      if (d < p.dislikedDist) {
        p.disliked = o
        p.dislikedDist = d
      }
    }
    if (territory && (!f.schoolId || o.schoolId !== f.schoolId)) {
      const dt = dist(o.pos, territory)
      if (dt < territory.r * 2 && dt < intruderDist && (!r || r.score < 0.45)) {
        intruderDist = dt
        p.intruder = o
      }
    }
    if (r && r.score > friendScore && o.action !== 'REST' && o.action !== 'HIDE' && (!f.schoolId || o.schoolId !== f.schoolId)) {
      friendScore = r.score
      p.friend = o
    }
    if (!p.newcomer && (!r || r.familiarity < 0.02) && Date.now() - o.introducedAt < 10 * 60_000 && o.introducedAt > sim.world.createdAt + 1000) {
      p.newcomer = o
    }
    if (p.food && o.target?.kind === 'food' && o.target.id === String(p.food.id) && dist(o.pos, p.food) < 70) {
      p.competitor = o
    }
  }

  // nearest undiscovered place within perception
  let ud = range * 1.5
  for (const pl of sim.allPlaces()) {
    if (f.discoveries.some((d) => d.placeId === pl.id)) continue
    const d = dist(f.pos, pl)
    if (d < ud) {
      ud = d
      p.unexplored = pl
    }
  }
  return p
}

/* ------------------------------------------------------------------ */
/* decisions                                                           */
/* ------------------------------------------------------------------ */

interface Option {
  action: FishAction
  score: number
  commit: () => void
}

export function decide(sim: Sim, f: Fish, p: Perception): void {
  const now = sim.world.worldTime
  const sp = SPECIES[f.species]
  const P = f.personality
  const rand = sim.rand
  const night = sim.phase === 'night' ? 1 : sim.phase === 'dusk' ? 0.45 : 0
  const opts: Option[] = []
  const opt = (action: FishAction, score: number, commit: () => void) => opts.push({ action, score, commit })
  const places = sim.allPlaces()

  // --- feeding
  if (p.food) {
    const food = p.food
    opt('EAT', f.hunger * 1.9 + (f.hunger > 0.3 ? 0.25 : -0.25), () =>
      sim.setAction(f, 'EAT', `eating ${locationPhrase(food, places)}`, { kind: 'food', id: String(food.id), x: food.x, y: food.y }),
    )
    if (p.competitor && P.aggression > 0.55) {
      const c = p.competitor
      opt('CHASE', P.aggression + f.hunger * 0.4 - rel(f, c).score * 0.4 - 0.2, () => sim.startChase(f, c, null, 'off the food'))
    }
  } else if (f.hunger > 0.5) {
    const spot = recallFoodSpot(f, now)
    if (spot && dist(f.pos, spot) > 80) {
      opt('EXPLORE', f.hunger * 1.15, () =>
        sim.setAction(f, 'EXPLORE', `looking for food ${locationPhrase(spot, places)}`, { kind: 'point', x: spot.x + (rand() - 0.5) * 80, y: spot.y }),
      )
    } else {
      const x = 80 + rand() * (TANK_W - 160)
      const bottom = f.species === 'goldfish' || f.species === 'cherry-barb'
      opt('EXPLORE', f.hunger * 0.95, () =>
        sim.setAction(f, 'EXPLORE', bottom ? 'sifting the sand for food' : 'searching the surface for food', {
          kind: 'point',
          x,
          y: bottom ? sandY(x) - 20 : SURFACE_Y + 40 + rand() * 120,
        }),
      )
    }
  }

  // --- resting
  const restScore =
    Math.pow(1 - f.energy, 1.6) * 1.7 + night * (0.75 - P.energy * 0.35) + (1 - P.energy) * 0.15 - (f.hunger > 0.8 ? 0.4 : 0) - (p.threat ? 0.7 : 0)
  opt('REST', restScore, () => {
    const spot = pickShelter(sim, f, 'rest', null)
    if (spot && dist(f.pos, spot) < 900) {
      sim.setAction(f, 'REST', `resting ${restPhrase(spot)}`, { kind: 'place', id: spot.id, ...placeTarget(spot, rand) })
    } else {
      sim.setAction(f, 'REST', `resting ${locationPhrase(f.pos, places)}`, {
        kind: 'point',
        x: f.pos.x,
        y: Math.max(f.pos.y, sandY(f.pos.x) - 50 - rand() * 80),
      })
    }
  })

  // --- fear
  if (p.threat) {
    const t = p.threat
    if (p.threatDist < 120) opt('FLEE', (1 - P.bravery) * 1.5 + f.stress, () => sim.setAction(f, 'FLEE', `fleeing from ${t.name}`, null, t.id))
    opt('HIDE', (1 - P.bravery) * 1.4 + f.stress * 0.8, () => sim.hide(f, pickShelter(sim, f, 'hide', t), t))
  } else if (f.stress > 0.45) {
    opt('HIDE', (1 - P.bravery) * 0.9 + f.stress * 0.6, () => sim.hide(f, pickShelter(sim, f, 'hide', null), null))
  }

  // --- territory
  if (p.intruder && p.territory) {
    const i = p.intruder
    const terr = p.territory
    opt('CHASE', P.aggression * 1.25 + sp.territoriality * 0.4 - rel(f, i).score * 0.6 - (f.energy < 0.25 ? 0.6 : 0), () =>
      sim.startChase(f, i, terr),
    )
  }
  if (p.disliked && P.aggression > 0.55 && p.dislikedDist < 160) {
    const d = p.disliked
    opt('CHASE', P.aggression * 0.7 - 0.15, () => sim.startChase(f, d, null))
  }
  if (p.territory) {
    const t = p.territory
    if (dist(f.pos, t) > t.r * 2) {
      opt('EXPLORE', P.aggression * 0.55 + sp.territoriality * 0.4, () =>
        sim.setAction(f, 'EXPLORE', `patrolling ${t.name}`, { kind: 'place', id: t.id, ...placeTarget(t, rand) }),
      )
    } else {
      opt('IDLE', 0.35 + sp.territoriality * 0.35, () => sim.setAction(f, 'IDLE', `guarding ${t.name}`, { kind: 'place', id: t.id, ...placeTarget(t, rand) }))
    }
  }

  // --- social
  const school = sim.schoolById(f.schoolId)
  const schoolDrive = sp.schooling * 0.6 + P.social * 0.4
  if (school) {
    opt('SCHOOL', 0.4 + sp.schooling * 0.55 + P.social * 0.35, () => sim.setAction(f, 'SCHOOL', `schooling with ${school.name}`, null))
  } else if (schoolDrive > 0.5 && !p.neighbors.some((o) => o.species === f.species || SPECIES[o.species].schooling > 0.6)) {
    let mate: Fish | null = null
    let md = Infinity
    for (const o of sim.world.fish) {
      if (o === f || o.action === 'REST' || o.enteringUntil > 0) continue
      if (o.species !== f.species && SPECIES[o.species].schooling < 0.6) continue
      const d = dist(f.pos, o.pos)
      if (d < md) {
        md = d
        mate = o
      }
    }
    if (mate) {
      const m = mate
      opt('EXPLORE', schoolDrive * 0.75, () =>
        sim.setAction(f, 'EXPLORE', `looking for company ${locationPhrase(m.pos, places)}`, { kind: 'fish', id: m.id, x: m.pos.x, y: m.pos.y }),
      )
    }
  }

  if (p.friend) {
    const L = p.friend
    const r = rel(f, L)
    const smaller = bodyLength(L) < bodyLength(f) * 0.8
    const s =
      P.social * 0.45 +
      r.score * 0.8 +
      (f.prefs.followsSmaller && smaller ? 0.45 : 0) +
      (L.action === 'EXPLORE' || L.action === 'INVESTIGATE' ? P.curiosity * 0.2 : 0) -
      (school ? 0.3 : 0)
    opt('FOLLOW', s, () => sim.startFollow(f, L))
  } else if (f.prefs.followsSmaller) {
    const small = p.neighbors.find((o) => bodyLength(o) < bodyLength(f) * 0.8 && o.action !== 'REST')
    if (small) opt('FOLLOW', 0.5 + P.curiosity * 0.25, () => sim.startFollow(f, small))
  }

  // --- curiosity
  if (p.unexplored) {
    const pl = p.unexplored
    const owner = avoidedOwner(sim, f, pl)
    const desire = P.curiosity * 0.85 + f.curiosity * 0.6 + (pl.transient ? 0.3 : 0) - (f.energy < 0.2 ? 0.4 : 0)
    let s = desire
    if (owner) {
      s -= 0.9
      if (desire > 0.75) {
        sim.log.emit('territorial', `${f.name} steered clear of ${pl.name} because ${owner.name} is there`, [f.id, owner.id], {
          key: `avoid:${f.id}:${pl.id}`,
          cooldownMs: 10 * 60_000,
        })
      }
    }
    opt('INVESTIGATE', s, () => sim.setAction(f, 'INVESTIGATE', `investigating ${pl.name}`, { kind: 'place', id: pl.id, ...placeTarget(pl, rand) }))
  }
  if (p.newcomer) {
    const n = p.newcomer
    opt('INVESTIGATE', P.curiosity * 0.7 + P.social * 0.35, () => {
      sim.setAction(f, 'INVESTIGATE', `inspecting the newcomer ${n.name}`, { kind: 'fish', id: n.id, x: n.pos.x, y: n.pos.y }, n.id)
      sim.log.emit('social', `${f.name} is inspecting the newcomer ${n.name}`, [f.id, n.id], { key: `newcomer:${f.id}:${n.id}`, cooldownMs: 30 * 60_000 })
    })
  }

  const exploreBase = f.curiosity * P.curiosity * 0.75 + P.energy * 0.25 + (f.energy > 0.5 ? 0.1 : -0.25)
  const fav = favoritePlace(f, (id) => {
    const pl = sim.placeById(id)
    return !!pl && !avoidedOwner(sim, f, pl) && dist(f.pos, pl) > pl.r * 2
  })
  if (fav && rand() < 0.45 + fav.v * 0.4) {
    const pl = sim.placeById(fav.id)!
    opt('EXPLORE', exploreBase + fav.v * 0.35, () =>
      sim.setAction(f, 'EXPLORE', `returning to ${pl.name}`, { kind: 'place', id: pl.id, ...placeTarget(pl, rand) }),
    )
  } else {
    opt('EXPLORE', exploreBase, () => {
      const pt = randomPointInBand(f, rand, true)
      sim.setAction(f, 'EXPLORE', `exploring ${locationPhrase(pt, places)}`, { kind: 'point', ...pt })
    })
  }

  // --- baseline
  opt('WANDER', 0.3 + P.chaos * 0.25 + P.energy * 0.1, () => sim.setAction(f, 'WANDER', `wandering ${locationPhrase(f.pos, places)}`, null))
  opt('IDLE', 0.16 + (1 - P.energy) * 0.25 + (f.energy < 0.5 ? 0.15 : 0), () =>
    sim.setAction(f, 'IDLE', `hovering ${locationPhrase(f.pos, places)}`, null),
  )

  // --- inertia, boredom and noise
  const elapsed = now - f.actionSince
  let best: Option | null = null
  for (const o of opts) {
    if (o.action === f.action) {
      if (elapsed < (MIN_DUR[o.action] ?? 3000)) o.score += 0.3
      else if (elapsed > (MAX_DUR[o.action] ?? Infinity)) o.score -= 0.45
      else o.score += 0.1
    }
    o.score += (rand() - 0.5) * 0.25 * (0.5 + P.chaos)
    if (!best || o.score > best.score) best = o
  }
  if (!best) return

  const keepTarget = best.action === f.action && f.target && !sim.rt(f).arrived && best.action !== 'EAT'
  if (!keepTarget) best.commit()
  f.nextDecisionAt = now + (1400 + rand() * 2600) * (1.25 - P.chaos * 0.6)
}

/* ------------------------------------------------------------------ */
/* per-frame action steering                                           */
/* ------------------------------------------------------------------ */

const near: Fish[] = []

/** compute the steering force for the fish's current action, plus generic forces */
export function steer(sim: Sim, f: Fish, dt: number, schoolForce: Vec): Vec {
  const sp = SPECIES[f.species]
  const rt = sim.rt(f)
  const max = speedFor(f, rt.arrived || !f.target)
  const force = v()
  const now = sim.world.worldTime
  const L = bodyLength(f)
  const places = sim.allPlaces()

  const toTarget = (slow = 80, k = 1) => {
    if (!f.target) return
    add(force, arrive(f.pos, f.vel, f.target, max, slow), k)
    if (dist(f.pos, f.target) < Math.max(18, L * 0.8)) rt.arrived = true
  }
  const doWander = (k = 1) => {
    const w = wander(f.vel, f.heading, rt.wanderAngle, max, sim.rand, 0.5 + f.personality.chaos * 0.6)
    rt.wanderAngle = w.angle
    add(force, w.force, k * 0.6)
  }

  switch (f.action) {
    case 'EAT': {
      const food = f.target ? sim.foodById(Number(f.target.id)) : undefined
      if (!food) {
        f.nextDecisionAt = 0
        doWander()
        break
      }
      f.target!.x = food.x
      f.target!.y = food.y
      add(force, arrive(f.pos, f.vel, food, max, 50))
      if (dist(f.pos, food) < L * 0.55 + 5) sim.eat(f, food)
      break
    }
    case 'REST': {
      if (f.target && !rt.arrived) toTarget(90)
      else {
        // drift gently in place, nearly still
        add(force, v(-f.vel.x, -f.vel.y), 0.8)
        if (f.target) add(force, arrive(f.pos, f.vel, f.target, 8, 60), 0.4)
      }
      if (rt.arrived && f.energy > 0.92 && now - f.actionSince > 15_000) f.nextDecisionAt = 0
      break
    }
    case 'HIDE': {
      toTarget(70)
      if (rt.arrived) add(force, v(-f.vel.x, -f.vel.y), 0.6)
      break
    }
    case 'FLEE': {
      const t = f.focusId ? sim.byId.get(f.focusId) : null
      if (t) add(force, flee(f.pos, f.vel, t.pos, max), 1.6)
      if (!t || now - f.actionSince > 2600 || (t && dist(f.pos, t.pos) > 300)) f.nextDecisionAt = 0
      break
    }
    case 'CHASE': {
      const t = f.focusId ? sim.byId.get(f.focusId) : null
      const terr = sim.placeById(f.territoryId)
      if (!t || now - f.actionSince > 4500 || dist(f.pos, t.pos) > 360 || (terr && f.target?.kind === 'place' && dist(t.pos, terr) > terr.r * 3.2)) {
        f.nextDecisionAt = 0
        doWander()
        break
      }
      add(force, pursue(f.pos, f.vel, t.pos, t.vel, max), 1.2)
      if (dist(f.pos, t.pos) < (L + bodyLength(t)) * 0.45 && t.action !== 'FLEE') {
        t.stress = clamp(t.stress + 0.35)
        sim.setAction(t, 'FLEE', `fleeing from ${f.name}`, null, f.id)
        t.nextDecisionAt = now + 1800
      }
      break
    }
    case 'FOLLOW': {
      const l = f.focusId ? sim.byId.get(f.focusId) : null
      if (!l || dist(f.pos, l.pos) > 420 || l.action === 'REST' || l.action === 'HIDE') {
        f.nextDecisionAt = 0
        doWander()
        break
      }
      const sp2 = Math.hypot(l.vel.x, l.vel.y) || 1
      const back = (L + bodyLength(l)) * 0.9
      const pt = { x: l.pos.x - (l.vel.x / sp2) * back, y: l.pos.y - (l.vel.y / sp2) * back + Math.sin(f.phase * 0.2) * 6 }
      add(force, arrive(f.pos, f.vel, pt, Math.max(max, Math.hypot(l.vel.x, l.vel.y) * 1.15), 70))
      // match heading
      add(force, v(l.vel.x - f.vel.x, l.vel.y - f.vel.y), 0.3)
      f.actionDetail = `following ${l.name} ${locationPhrase(f.pos, places)}`
      break
    }
    case 'SCHOOL': {
      add(force, schoolForce)
      doWander(0.25)
      if (!f.schoolId) f.nextDecisionAt = 0
      break
    }
    case 'INVESTIGATE': {
      if (f.target?.kind === 'fish') {
        const o = sim.byId.get(f.target.id!)
        if (o) {
          f.target.x = o.pos.x + (f.pos.x < o.pos.x ? -L * 1.6 : L * 1.6)
          f.target.y = o.pos.y
        }
      }
      if (!rt.arrived) toTarget(90)
      else {
        // circle slowly around the object of interest
        add(force, v(-f.vel.x, -f.vel.y), 0.3)
        doWander(0.4)
        if (now - f.actionSince > 9000) f.nextDecisionAt = 0
      }
      break
    }
    case 'EXPLORE': {
      if (f.target?.kind === 'fish') {
        const o = sim.byId.get(f.target.id!)
        if (o) {
          f.target.x = o.pos.x
          f.target.y = o.pos.y
        }
      }
      toTarget(100)
      doWander(0.25)
      if (rt.arrived) f.nextDecisionAt = Math.min(f.nextDecisionAt, now + 1500)
      break
    }
    case 'IDLE': {
      if (f.target) toTarget(60, 0.6)
      doWander(0.35)
      break
    }
    case 'WANDER':
    default:
      doWander()
  }

  // generic: separation from everyone nearby. Fish are wide and short, so
  // personal space is an ellipse: they stack in rows rather than overlap.
  sim.grid.query(f.pos.x, f.pos.y, L * 2.2, near)
  const sep = v()
  const H = bodyHeight(f)
  for (const o of near) {
    if (o === f) continue
    const rx = (L + bodyLength(o)) * 0.5
    const ry = (H + bodyHeight(o)) * 0.5 + 4
    const nx = (f.pos.x - o.pos.x) / rx
    const ny = (f.pos.y - o.pos.y) / ry
    const nd = Math.hypot(nx, ny)
    if (nd < 1 && nd > 0.001) {
      const k = (1 - nd) * max * 1.6
      sep.x += (nx / nd) * k
      sep.y += (ny / nd) * k
    }
  }
  add(force, sep, f.action === 'REST' ? 0.5 : 1)

  // generic: steer away from disliked fish
  if (f.action !== 'CHASE' && f.action !== 'FLEE') {
    sim.grid.query(f.pos.x, f.pos.y, 110, near)
    for (const o of near) {
      if (o === f) continue
      const r = peekRel(f, o.id)
      if (r && r.score < -0.3) {
        add(force, flee(f.pos, f.vel, o.pos, max), 0.5 + (1 - f.personality.bravery) * 0.5)
        if (r.score < -0.4 && dist(f.pos, o.pos) < 80) {
          sim.log.emit('social', `${f.name} avoided ${o.name}`, [f.id, o.id], { key: `avoidfish:${f.id}:${o.id}`, cooldownMs: 25 * 60_000 })
        }
      }
    }
  }

  // depth preference when not targeting anything
  if (f.action === 'WANDER' || f.action === 'IDLE' || f.action === 'SCHOOL') {
    const d = depthFraction(f.pos.y, f.pos.x)
    const lo = clamp(sp.depth[0] + f.prefs.depthBias, 0, 0.95)
    const hi = clamp(sp.depth[1] + f.prefs.depthBias, lo + 0.05, 1)
    if (d < lo) force.y += (lo - d) * max * 1.5
    if (d > hi) force.y -= (d - hi) * max * 1.5
  }

  add(force, boundaries(f.pos, f.vel, max + 30))
  add(force, avoidObstacles(f.pos, f.vel, max + 20, L * 0.5))
  // newly-introduced fish sink from the surface
  if (f.enteringUntil > 0) add(force, seek(f.pos, f.vel, { x: f.pos.x + (f.vel.x || 1) * 0.2, y: 260 }, 90), 1)
  return force
}
