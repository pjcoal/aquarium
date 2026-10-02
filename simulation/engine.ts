import type { Fish, FishAction, Mood, Target, Vec } from '@/types/fish'
import type { DayPhase, Food, Place, School, SimSpeed, WorldState } from '@/types/simulation'
import { SPECIES } from './species'
import { SpatialHash } from './spatial'
import { EventLog } from './events'
import { STATIC_PLACES, SURFACE_Y, TANK_W, dayPhase, locationPhrase, makeCuriosity, nearestStaticPlace, sandY } from './environment'
import { angleDiff, constrain, dist, limit, v } from './steering'
import { decide, hidePhrase, maxSpeedOf, perceive, pickShelter, placeTarget, restPhrase, speedFor, steer, type FishRuntime, type Perception, type Sim } from './behavior'
import { leaveSchool, schoolForce, updateSchools } from './schooling'
import { compatibility, decayRelationships, nudge, peekRel, rel, relationLabel } from './relationships'
import { MAX_HISTORY, MAX_THOUGHTS, adjustAffinity, favoritePlace, recallFoodSpot, remember } from './memory'
import { bodyLength, createFish, type NewFishInput } from './fish'
import { createSeedWorld } from './seed'
import { clamp } from '@/lib/random'
import { loadWorld, saveWorld } from '@/lib/storage'
import { createThoughtGenerator, type ThoughtContext, type ThoughtGenerator } from '@/lib/thoughtEngine'
import { MOOD_EFFECTS, fmtPct, marketMood, type MarketMood, type MarketSnapshot } from './market'

export interface UIState {
  selectedId: string | null
  hoveredId: string | null
  paused: boolean
  speed: SimSpeed
  showNames: boolean
  track: boolean
}

const MAX_FOOD = 60
const MAX_CURIOSITIES = 3
const MAX_DISCOVERIES = 60
const MAX_FISH = 80

export class Engine implements Sim {
  world: WorldState
  rand: () => number = Math.random
  grid = new SpatialHash(120)
  byId = new Map<string, Fish>()
  log: EventLog
  light = 1
  phase: DayPhase = 'day'
  chasers = new Map<string, Fish>()
  thoughts: ThoughtGenerator = createThoughtGenerator()

  ui: UIState = { selectedId: null, hoveredId: null, paused: false, speed: 1, showNames: false, track: false }
  /** increments whenever React-facing state should be re-read */
  uiVersion = 0
  fps = 60
  /** world time ms of the last catch-up, and how long the absence was */
  lastAbsence: { ms: number; at: number } | null = null
  /** latest token market data, and the mood the tank feels from it */
  market: MarketSnapshot | null = null
  marketMood: MarketMood = 'calm'
  private candleAt = 0
  private pendingMood: { mood: MarketMood; seen: number } | null = null

  private runtime = new Map<string, FishRuntime>()
  private placeMap = new Map<string, Place>()
  private placeList: Place[] = []
  private listeners = new Set<() => void>()
  private frameListeners = new Set<(dt: number) => void>()
  private raf = 0
  private lastFrame = 0
  private frameNo = 0
  private timers = { social: 0, schools: 0, territory: 0, minute: 0, ui: 0, save: 0, fpsAcc: 0, fpsFrames: 0 }
  private started = false

  constructor(world: WorldState) {
    this.world = world
    this.log = new EventLog(() => this.world)
    this.reindex()
    const dp = dayPhase(world.worldTime)
    this.phase = dp.phase
    this.light = dp.light
  }

  /* ------------------------------------------------------------ */
  /* lifecycle                                                     */
  /* ------------------------------------------------------------ */

  static boot(): Engine {
    const saved = loadWorld()
    if (saved) {
      const e = new Engine(saved)
      const away = Date.now() - saved.savedAt
      if (away > 5000) e.advance(away)
      return e
    }
    const e = new Engine(createSeedWorld())
    e.log.emit('system', 'the tank is open. 24 fish are already living here.', [])
    return e
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return
    this.started = true
    this.lastFrame = performance.now()
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop)
      this.frame(t)
    }
    this.raf = requestAnimationFrame(loop)
    window.addEventListener('pagehide', this.save)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.started = false
    window.removeEventListener('pagehide', this.save)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.save()
  }

  save = (): void => {
    saveWorld(this.world)
  }

  reset(world: WorldState): void {
    this.world = world
    this.log = new EventLog(() => this.world)
    this.runtime.clear()
    this.reindex()
    this.ui.selectedId = null
    this.log.emit('system', `a fresh tank. ${world.fish.length} fish are already living here.`, [])
    this.save()
    this.notify()
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onFrame(fn: (dt: number) => void): () => void {
    this.frameListeners.add(fn)
    return () => this.frameListeners.delete(fn)
  }

  notify(): void {
    this.uiVersion++
    for (const l of this.listeners) l()
  }

  private frame(t: number): void {
    const realDt = (t - this.lastFrame) / 1000
    this.lastFrame = t
    // a long gap means the tab was hidden; catch up instead of jumping
    if (realDt > 5) {
      this.advance(realDt * 1000)
      this.notify()
      return
    }
    const dt = Math.min(realDt, 0.1)
    if (!this.ui.paused) {
      const simDt = dt * this.ui.speed
      const steps = Math.ceil(simDt / (1 / 30))
      for (let i = 0; i < steps; i++) this.step(simDt / steps)
    }
    for (const fn of this.frameListeners) fn(this.ui.paused ? 0 : dt * this.ui.speed)

    this.timers.fpsAcc += realDt
    this.timers.fpsFrames++
    if (this.timers.fpsAcc > 1) {
      this.fps = Math.round(this.timers.fpsFrames / this.timers.fpsAcc)
      this.timers.fpsAcc = 0
      this.timers.fpsFrames = 0
    }
    this.timers.ui += realDt
    if (this.timers.ui > 0.4) {
      this.timers.ui = 0
      this.notify()
    }
    this.timers.save += realDt
    if (this.timers.save > 10) {
      this.timers.save = 0
      this.save()
    }
  }

  /* ------------------------------------------------------------ */
  /* indexes                                                       */
  /* ------------------------------------------------------------ */

  private reindex(): void {
    this.byId.clear()
    for (const f of this.world.fish) this.byId.set(f.id, f)
    this.placeList = [...STATIC_PLACES, ...this.world.curiosities]
    this.placeMap.clear()
    for (const p of this.placeList) this.placeMap.set(p.id, p)
  }

  rt(f: Fish): FishRuntime {
    let r = this.runtime.get(f.id)
    if (!r) {
      r = { wanderAngle: this.rand() * Math.PI * 2, strayTime: 0, territorySeenAt: this.world.worldTime, arrived: false, schoolCooldownUntil: 0 }
      this.runtime.set(f.id, r)
    }
    return r
  }

  allPlaces(): Place[] {
    return this.placeList
  }
  placeById(id: string | null | undefined): Place | undefined {
    return id ? this.placeMap.get(id) : undefined
  }
  schoolById(id: string | null | undefined): School | undefined {
    return id ? this.world.schools.find((s) => s.id === id) : undefined
  }
  foodById(id: number): Food | undefined {
    return this.world.food.find((f) => f.id === id)
  }
  fishById(id: string): Fish | undefined {
    return this.byId.get(id)
  }

  /* ------------------------------------------------------------ */
  /* simulation step                                               */
  /* ------------------------------------------------------------ */

  step(dt: number): void {
    const w = this.world
    w.worldTime += dt * 1000
    const now = w.worldTime
    this.frameNo++

    const dp = dayPhase(now)
    this.light = dp.light
    if (dp.phase !== this.phase || !w.lastPhase) {
      this.phase = dp.phase
      if (w.lastPhase && w.lastPhase !== dp.phase) {
        const text: Record<DayPhase, string> = {
          dawn: 'dawn. the light returns to the tank',
          day: 'full daylight over the tank',
          dusk: 'dusk. the light is fading',
          night: 'night. the tank goes quiet',
        }
        if (dp.phase !== 'day') this.log.emit('system', text[dp.phase], [])
      }
      w.lastPhase = dp.phase
    }

    this.grid.rebuild(w.fish)
    this.chasers.clear()
    for (const f of w.fish) if (f.action === 'CHASE' && f.focusId) this.chasers.set(f.focusId, f)

    this.updateFood(dt)
    this.updateCuriosities()

    for (const f of w.fish) this.updateFish(f, dt)

    const T = this.timers
    T.social += dt
    if (T.social >= 1) {
      this.socialTick(T.social)
      T.social = 0
    }
    T.schools += dt
    if (T.schools >= 1.5) {
      updateSchools(this, T.schools, (f, r) => this.grid.query(f.pos.x, f.pos.y, r, []))
      T.schools = 0
    }
    T.territory += dt
    if (T.territory >= 2) {
      this.territoryTick(T.territory)
      T.territory = 0
    }
    T.minute += dt
    if (T.minute >= 60) {
      for (const f of w.fish) {
        decayRelationships(f, T.minute / 60)
        for (const k in f.prefs.placeAffinity) f.prefs.placeAffinity[k] *= 0.997
      }
      this.log.pruneCooldowns(now)
      T.minute = 0
    }
  }

  private updateFish(f: Fish, dt: number): void {
    const now = this.world.worldTime
    const sp = SPECIES[f.species]
    const P = f.personality
    const rt = this.rt(f)
    const night = this.phase === 'night'

    // --- needs
    f.hunger = clamp(f.hunger + (dt * sp.appetite) / 2400)
    const speedFrac = f.speed / sp.maxSpeed
    if (f.action === 'REST') f.energy = clamp(f.energy + dt * (rt.arrived ? 0.006 : 0.0015) * (night ? 1.4 : 1))
    else f.energy = clamp(f.energy - dt * (0.00028 + 0.0008 * speedFrac) * (1.2 - P.energy * 0.4) * (night ? 1.3 : 1))
    const fx = MOOD_EFFECTS[this.marketMood]
    if (f.action === 'EXPLORE' || f.action === 'INVESTIGATE') f.curiosity = clamp(f.curiosity - dt * 0.01)
    else f.curiosity = clamp(f.curiosity + dt * 0.004 * (0.3 + P.curiosity) * fx.curiosity)
    f.stress = clamp(f.stress - dt * (f.action === 'HIDE' && rt.arrived ? 0.1 : 0.035))
    // a falling market leaves timid fish with an anxiety they can't shake
    const floor = fx.stressFloor * (1 - P.bravery)
    if (f.stress < floor) f.stress = Math.min(floor, f.stress + dt * 0.08)
    if (f.enteringUntil && now > f.enteringUntil) f.enteringUntil = 0

    // --- interrupts
    const chaser = this.chasers.get(f.id)
    if (chaser && f.action !== 'FLEE' && f.action !== 'HIDE' && dist(f.pos, chaser.pos) < 200) f.nextDecisionAt = 0

    // --- decide
    if (now >= f.nextDecisionAt && f.enteringUntil === 0) {
      const p = perceive(this, f)
      decide(this, f, p)
      f.mood = moodOf(this, f, p)
    }

    // --- steer & integrate with a heading model so fish turn in arcs
    const max = speedFor(f, rt.arrived || !f.target)
    const force = steer(this, f, dt, f.action === 'SCHOOL' ? schoolForce(this, f, max) : v())
    const acc = limit({ x: force.x * 2.4, y: force.y * 2.4 }, sp.accel)
    const dx = f.vel.x + acc.x * dt
    const dy = f.vel.y + acc.y * dt
    const top = Math.max(max * 1.05, 8)
    const desSpeed = Math.min(Math.hypot(dx, dy), top)
    if (Math.hypot(dx, dy) > 1.5) {
      let target = Math.atan2(dy, dx)
      // fish swim mostly level: clamp pitch of the desired direction
      const pitch = Math.atan2(Math.sin(target), Math.abs(Math.cos(target)))
      const maxPitch = f.action === 'FLEE' || f.action === 'EAT' ? 1.15 : 0.85
      if (Math.abs(pitch) > maxPitch) {
        const cp = Math.sign(pitch) * maxPitch
        target = Math.cos(target) >= 0 ? cp : Math.PI - cp
      }
      const turnRate = sp.turnRate * (f.action === 'FLEE' || f.action === 'CHASE' ? 1.6 : 1)
      const d = angleDiff(f.heading, target)
      f.heading += clamp(d, -turnRate * dt, turnRate * dt)
      // turning hard costs speed
      if (Math.abs(d) > 1.2) f.speed *= 1 - dt * 1.5
    }
    if (f.heading > Math.PI) f.heading -= Math.PI * 2
    if (f.heading < -Math.PI) f.heading += Math.PI * 2
    f.speed += clamp(desSpeed - f.speed, -sp.accel * dt * 1.6, sp.accel * dt)
    f.vel.x = Math.cos(f.heading) * f.speed
    f.vel.y = Math.sin(f.heading) * f.speed
    f.pos.x += f.vel.x * dt
    f.pos.y += f.vel.y * dt
    if (f.enteringUntil === 0) constrain(f.pos, f.vel, bodyLength(f) * 0.5)
    else f.pos.x = clamp(f.pos.x, 30, TANK_W - 30)

    f.stats.distance += f.speed * dt
    f.stats.activity += (Math.min(1, f.speed / sp.maxSpeed) - f.stats.activity) * Math.min(1, dt * 0.02)
    f.phase += dt * (3 + (f.speed / sp.maxSpeed) * 14)

    // --- arrival handling
    if (rt.arrived && f.target?.kind === 'place' && f.target.id) {
      const pl = this.placeById(f.target.id)
      if (pl && f.action === 'EXPLORE' && f.actionDetail.startsWith('returning')) {
        adjustAffinity(f, pl.id, 0.05)
        this.log.emit('exploration', `${f.name} returned to ${pl.name}`, [f.id], { key: `ret:${f.id}:${pl.id}`, cooldownMs: 12 * 60_000 })
        f.actionDetail = `lingering ${locationPhrase(f.pos, this.placeList)}`
      }
    }

    // --- discoveries (staggered)
    if ((this.frameNo + (f.id.charCodeAt(0) % 8)) % 8 === 0 && f.enteringUntil === 0) {
      for (const pl of this.placeList) {
        if (dist(f.pos, pl) > pl.r * 0.9) continue
        if (f.discoveries.some((d) => d.placeId === pl.id)) continue
        this.discover(f, pl)
      }
    }

    // --- thoughts
    if (now >= f.nextThoughtAt) this.think(f)
  }

  private updateFood(dt: number): void {
    const w = this.world
    const now = w.worldTime
    for (const food of w.food) {
      if (food.settledAt === null) {
        food.y += food.vy * dt
        food.x += Math.sin(now / 900 + food.id) * 7 * dt
        if (food.y >= sandY(food.x) - 5) {
          food.y = sandY(food.x) - 5
          food.settledAt = now
        }
      }
    }
    if (w.food.length) w.food = w.food.filter((f) => f.settledAt === null || now - f.settledAt < 240_000)
    if (now > w.counters.nextFeedAt) {
      this.feed()
      w.counters.nextFeedAt = now + (3 + this.rand() * 2.5) * 60_000 * MOOD_EFFECTS[this.marketMood].feedInterval
    }
  }

  /** drop food. x is optional; auto-feeder prefers the filter side */
  feed(x?: number, manual = false, reason?: string): void {
    const w = this.world
    const r = this.rand
    const cx = x ?? (r() < 0.55 ? 1440 + r() * 200 : 200 + r() * (TANK_W - 400))
    const n = Math.min(30, Math.round((6 + w.fish.length / 2.5) * MOOD_EFFECTS[this.marketMood].feedAmount))
    for (let i = 0; i < n && w.food.length < MAX_FOOD; i++) {
      w.food.push({
        id: w.counters.nextFoodId++,
        x: clamp(cx + (r() - 0.5) * 170, 30, TANK_W - 30),
        y: SURFACE_Y + 2 + r() * 10,
        vy: 15 + r() * 12,
        t: w.worldTime + i * 120,
        settledAt: null,
        claimedBy: null,
      })
    }
    w.counters.lastFeedAt = w.worldTime
    const where = locationPhrase({ x: cx, y: 150 }, this.placeList)
    this.log.emit('feeding', manual ? `you dropped food ${where}` : reason ? `${reason}. food is drifting down ${where}` : `food is drifting down ${where}`, [])
  }

  private updateCuriosities(): void {
    const w = this.world
    const now = w.worldTime
    let changed = false
    for (const c of w.curiosities) {
      if ((c.expiresAt ?? Infinity) < now) {
        this.log.emit('exploration', `${c.name} is gone`, [])
        for (const f of w.fish) delete f.prefs.placeAffinity[c.id]
        delete w.territories[c.id]
        changed = true
      }
    }
    if (changed) w.curiosities = w.curiosities.filter((c) => (c.expiresAt ?? Infinity) >= now)
    if (now > w.counters.nextCuriosityAt) {
      w.counters.nextCuriosityAt = now + (5 + this.rand() * 6) * 60_000
      if (w.curiosities.length < MAX_CURIOSITIES) {
        const c = makeCuriosity(this.rand, now, w.counters.nextEventId)
        w.curiosities.push(c)
        changed = true
        this.log.emit('exploration', `something new appeared: ${c.name}`, [])
      }
    }
    if (changed) this.reindex()
  }

  /* ------------------------------------------------------------ */
  /* periodic social systems                                      */
  /* ------------------------------------------------------------ */

  private socialTick(dtSec: number): void {
    const now = this.world.worldTime
    const tmp: Fish[] = []
    for (const f of this.world.fish) {
      if (f.enteringUntil) continue
      this.grid.query(f.pos.x, f.pos.y, 100, tmp)
      for (const o of tmp) {
        if (o === f || o.enteringUntil) continue
        const c = compatibility(f, o)
        let ds = c > 0 ? c * 0.0005 : c * 0.002
        if (f.schoolId && f.schoolId === o.schoolId) ds += 0.0003
        if (f.action === 'FOLLOW' && f.focusId === o.id) ds += 0.002
        if (f.action === 'REST' && o.action === 'REST') ds += 0.001
        const ch = nudge(f, o, ds * dtSec, 0.01 * dtSec, now)
        if (ch === 'friends') {
          remember(f, { t: now, kind: 'social', text: `grew fond of ${o.name}`, fishId: o.id, valence: 0.5 })
          const mutual = (peekRel(o, f.id)?.score ?? 0) >= 0.5
          const e = mutual
            ? this.log.emit('social', `${f.name} and ${o.name} became friends`, [f.id, o.id], { key: `friends:${[f.id, o.id].sort().join(':')}`, cooldownMs: 60 * 60_000 })
            : null
          if (e) {
            remember(f, { t: now, kind: 'social', text: `became friends with ${o.name}`, fishId: o.id, valence: 0.7 })
            this.world.counters.interactions++
            f.stats.interactions++
            this.thinkSoon(f)
          }
        } else if (ch === 'avoids') {
          this.log.emit('social', `${f.name} now avoids ${o.name}`, [f.id, o.id], { key: `avoids:${f.id}:${o.id}`, cooldownMs: 40 * 60_000 })
          remember(f, { t: now, kind: 'social', text: `decided to avoid ${o.name}`, fishId: o.id, valence: -0.5 })
        }
      }
    }
  }

  private territoryTick(dtSec: number): void {
    const w = this.world
    const now = w.worldTime
    for (const f of w.fish) {
      if (f.enteringUntil) continue
      const sp = SPECIES[f.species]
      const P = f.personality
      const near = nearestPlaceTo(this.placeList, f.pos)
      // lingering calmly somewhere builds affection for it
      if (near && near.dist < near.place.r * 1.3 && ['IDLE', 'WANDER', 'REST', 'INVESTIGATE', 'EXPLORE', 'SCHOOL'].includes(f.action)) {
        adjustAffinity(f, near.place.id, 0.006 * dtSec * (f.action === 'REST' ? 1.5 : 1))
      }
      const terr = this.placeById(f.territoryId)
      if (terr) {
        const rt = this.rt(f)
        if (dist(f.pos, terr) < terr.r * 3) rt.territorySeenAt = now
        else if (now - rt.territorySeenAt > 8 * 60_000) {
          delete w.territories[terr.id]
          f.territoryId = null
          this.log.emit('territorial', `${f.name} abandoned ${terr.name}`, [f.id])
          remember(f, { t: now, kind: 'territory', text: `left ${terr.name} behind`, placeId: terr.id, valence: -0.1 })
        }
        continue
      }
      const drive = P.aggression * 0.6 + sp.territoriality * 0.4
      if (drive < 0.55 || f.energy < 0.3) continue
      let pl: Place | null = null
      for (const c of this.placeList) {
        if (c.kind === 'surface' || c.kind === 'filter' || c.transient || dist(f.pos, c) > c.r * 1.6) continue
        if ((f.prefs.placeAffinity[c.id] ?? 0) < 0.3) continue
        if (!pl || (f.prefs.placeAffinity[c.id] ?? 0) > (f.prefs.placeAffinity[pl.id] ?? 0)) pl = c
      }
      if (!pl) continue
      const ownerId = w.territories[pl.id]
      const owner = ownerId ? this.byId.get(ownerId) : undefined
      if (!owner) {
        if (this.rand() < 0.4) this.claim(f, pl)
      } else if (owner !== f && dist(owner.pos, pl) > 500 && this.rand() < 0.08) {
        owner.territoryId = null
        nudge(owner, f, -0.3, 0.1, now)
        remember(owner, { t: now, kind: 'territory', text: `lost ${pl.name} to ${f.name}`, fishId: f.id, placeId: pl.id, valence: -0.7 })
        this.claim(f, pl, `${f.name} moved into ${pl.name} while ${owner.name} was away`)
      }
    }
  }

  private claim(f: Fish, pl: Place, text?: string): void {
    const now = this.world.worldTime
    this.world.territories[pl.id] = f.id
    f.territoryId = pl.id
    this.rt(f).territorySeenAt = now
    remember(f, { t: now, kind: 'territory', text: `claimed ${pl.name}`, placeId: pl.id, valence: 0.6 })
    this.log.emit('territorial', text ?? `${f.name} claimed ${pl.name}`, [f.id])
    if (f.schoolId) leaveSchool(this, f, 'independent')
    this.thinkSoon(f)
  }

  /* ------------------------------------------------------------ */
  /* actions (called from behavior)                               */
  /* ------------------------------------------------------------ */

  setAction(f: Fish, a: FishAction, detail: string, target: Target | null = null, focusId: string | null = null): void {
    const now = this.world.worldTime
    const prev = f.action
    const prevSince = f.actionSince
    f.action = a
    f.actionDetail = detail
    f.target = target
    f.focusId = focusId
    this.rt(f).arrived = false
    if (prev !== a) {
      f.actionSince = now
      f.history.unshift({ t: now, action: a, detail })
      if (f.history.length > MAX_HISTORY) f.history.length = MAX_HISTORY
      if (prev === 'REST' && now - prevSince > 3 * 60_000) {
        this.log.emit('resting', `${f.name} woke up ${locationPhrase(f.pos, this.placeList)}`, [f.id], { key: `wake:${f.id}`, cooldownMs: 15 * 60_000 })
      }
      if (a === 'REST') {
        this.log.emit('resting', `${f.name} is ${detail}`, [f.id], { key: `rest:${f.id}`, cooldownMs: 12 * 60_000 })
        if (target?.kind === 'place' && target.id) {
          remember(f, { t: now, kind: 'rest', text: detail.replace(/^resting/, 'rested'), placeId: target.id, valence: 0.2 })
        }
      }
    } else if (f.history[0] && f.history[0].action === a) {
      f.history[0].detail = detail
    }
  }

  eat(f: Fish, food: Food): void {
    const w = this.world
    const now = w.worldTime
    w.food = w.food.filter((x) => x !== food)
    f.hunger = Math.max(0, f.hunger - 0.3)
    f.stats.meals++
    w.counters.meals++
    const where = locationPhrase(food, this.placeList)
    remember(f, { t: now, kind: 'food', text: `found food ${where}`, valence: 0.5, pos: { x: food.x, y: Math.min(food.y, 500) } }, 5 * 60_000)
    const np = nearestStaticPlace(food)
    if (np && np.dist < 250) adjustAffinity(f, np.place.id, 0.04)
    this.log.emit('feeding', `${f.name} found food ${where}`, [f.id], { key: `food:${f.id}`, cooldownMs: 9 * 60_000 })
    // others heading for the same pellet are annoyed
    for (const o of this.grid.query(f.pos.x, f.pos.y, 70, [])) {
      if (o !== f && o.target?.kind === 'food' && o.target.id === String(food.id)) {
        nudge(o, f, -0.04, 0.02, now)
        o.nextDecisionAt = 0
      }
    }
    if (f.hunger < 0.1) f.nextDecisionAt = now + 400
  }

  startChase(f: Fish, victim: Fish, place: Place | null, reason?: string): void {
    const now = this.world.worldTime
    const detail = place ? `chasing ${victim.name} away from ${place.name}` : reason ? `driving ${victim.name} ${reason}` : `chasing ${victim.name}`
    this.setAction(f, 'CHASE', detail, place ? { kind: 'place', id: place.id, x: place.x, y: place.y } : { kind: 'fish', id: victim.id, x: victim.pos.x, y: victim.pos.y }, victim.id)
    const text = place ? `${f.name} chased ${victim.name} away from ${place.name}` : reason ? `${f.name} drove ${victim.name} ${reason}` : `${f.name} chased ${victim.name}`
    const e = this.log.emit('territorial', text, [f.id, victim.id], { key: `chase:${f.id}:${victim.id}`, cooldownMs: 120_000 })
    if (!e) return
    // a new chase episode: consequences
    const vr = rel(victim, f)
    vr.chasedBy++
    rel(f, victim).chased++
    const ch = nudge(victim, f, -0.2, 0.05, now)
    nudge(f, victim, -0.05, 0.05, now)
    victim.stress = clamp(victim.stress + 0.3)
    remember(victim, {
      t: now,
      kind: 'threat',
      text: place ? `was chased away from ${place.name} by ${f.name}` : `was chased by ${f.name}`,
      fishId: f.id,
      placeId: place?.id,
      valence: -0.7,
    })
    if (place) {
      adjustAffinity(victim, place.id, -0.2)
      remember(f, { t: now, kind: 'territory', text: `chased ${victim.name} away from ${place.name}`, fishId: victim.id, placeId: place.id, valence: 0.2 })
    }
    this.world.counters.interactions++
    f.stats.interactions++
    f.stats.chases++
    victim.stats.interactions++
    if (ch === 'avoids') {
      this.log.emit('social', `${victim.name} now avoids ${f.name}`, [victim.id, f.id], { key: `avoids:${victim.id}:${f.id}`, cooldownMs: 40 * 60_000 })
    }
    this.thinkSoon(victim)
    this.thinkSoon(f)

    // a bold territorial victim may stand its ground and take the place
    if (place) {
      const power = (x: Fish) => (x.personality.aggression + x.personality.bravery) * bodyLength(x)
      if (victim.personality.aggression > 0.5 && power(victim) > power(f) * 1.15 && this.rand() < 0.3 && !victim.territoryId) {
        f.territoryId = null
        this.claim(victim, place, `${victim.name} stood its ground and took ${place.name} from ${f.name}`)
        remember(f, { t: now, kind: 'territory', text: `lost ${place.name} to ${victim.name}`, fishId: victim.id, placeId: place.id, valence: -0.8 })
        this.setAction(f, 'FLEE', `retreating from ${victim.name}`, null, victim.id)
        f.nextDecisionAt = now + 2000
      }
    }
  }

  startFollow(f: Fish, leader: Fish): void {
    const now = this.world.worldTime
    this.setAction(f, 'FOLLOW', `following ${leader.name} ${locationPhrase(f.pos, this.placeList)}`, { kind: 'fish', id: leader.id, x: leader.pos.x, y: leader.pos.y }, leader.id)
    const e = this.log.emit('social', `${f.name} started following ${leader.name}`, [f.id, leader.id], {
      key: `follow:${f.id}:${leader.id}`,
      cooldownMs: 12 * 60_000,
    })
    if (e) {
      rel(f, leader).follows++
      this.world.counters.interactions++
      f.stats.interactions++
      remember(f, { t: now, kind: 'social', text: `swam with ${leader.name}`, fishId: leader.id, valence: 0.4 })
    }
  }

  hide(f: Fish, place: Place | null, threat: Fish | null): void {
    const now = this.world.worldTime
    const detail = place ? `hiding ${hidePhrase(place)}` : `hiding ${locationPhrase(f.pos, this.placeList)}`
    const target: Target = place
      ? { kind: 'place', id: place.id, ...placeTarget(place, this.rand) }
      : { kind: 'point', x: f.pos.x, y: Math.min(sandY(f.pos.x) - 30, f.pos.y + 120) }
    this.setAction(f, 'HIDE', detail, target, threat?.id ?? null)
    if (threat) {
      const e = this.log.emit('social', `${f.name} hid${place ? ` ${hidePhrase(place)}` : ''} as ${threat.name} approached`, [f.id, threat.id], {
        key: `hide:${f.id}`,
        cooldownMs: 4 * 60_000,
      })
      if (e) {
        remember(f, { t: now, kind: 'threat', text: `hid when ${threat.name} approached`, fishId: threat.id, placeId: place?.id, valence: -0.5 })
        if (place) adjustAffinity(f, place.id, 0.08)
        f.stats.fled++
        this.world.counters.interactions++
      }
    }
  }

  discover(f: Fish, pl: Place, via?: Fish): void {
    const w = this.world
    const now = w.worldTime
    const first = !w.firstFinds[pl.id]
    if (first) w.firstFinds[pl.id] = f.id
    f.discoveries.unshift({ placeId: pl.id, name: pl.name, t: now, viaFishId: via?.id, first })
    if (f.discoveries.length > MAX_DISCOVERIES) f.discoveries.length = MAX_DISCOVERIES
    w.counters.discoveries++
    f.curiosity = Math.max(0, f.curiosity - 0.35)
    adjustAffinity(f, pl.id, 0.12 + f.personality.curiosity * 0.1 + (pl.kind === 'cave' || pl.kind === 'pot' ? f.prefs.likesCaves * 0.3 : 0))
    remember(f, { t: now, kind: 'discovery', text: `discovered ${pl.name}`, placeId: pl.id, valence: 0.6, pos: { x: pl.x, y: pl.y }, fishId: via?.id })
    const text = via
      ? `${f.name} discovered ${pl.name} while following ${via.name}`
      : first && pl.transient
        ? `${f.name} found ${pl.name}, the first to notice it`
        : `${f.name} discovered ${pl.name}`
    // a curiosity found by many fish stops being news
    const finders = pl.transient ? this.world.fish.filter((o) => o.discoveries.some((d) => d.placeId === pl.id)).length : 0
    if (finders <= 4) this.log.emit('discovery', text, via ? [f.id, via.id] : [f.id])
    this.thinkSoon(f)
    if (via) nudge(f, via, 0.08, 0.05, now)
    for (const o of this.world.fish) {
      if (o.action === 'FOLLOW' && o.focusId === f.id && dist(o.pos, f.pos) < 260 && !o.discoveries.some((d) => d.placeId === pl.id)) {
        this.discover(o, pl, f)
      }
    }
  }

  /* ------------------------------------------------------------ */
  /* thoughts                                                      */
  /* ------------------------------------------------------------ */

  thinkSoon(f: Fish): void {
    const now = this.world.worldTime
    if (now - f.lastThoughtAt < 10_000) return
    f.nextThoughtAt = Math.min(f.nextThoughtAt, now + 1200 + this.rand() * 2500)
  }

  private think(f: Fish): void {
    const now = this.world.worldTime
    f.nextThoughtAt = now + (35_000 + this.rand() * 55_000) / (0.6 + f.personality.curiosity * 0.6)
    const ctx = this.thoughtContext(f)
    const apply = (text: string) => {
      if (!text || text === f.lastThought) return
      f.lastThought = text
      f.lastThoughtAt = this.world.worldTime
      f.thoughts.unshift({ t: this.world.worldTime, text })
      if (f.thoughts.length > MAX_THOUGHTS) f.thoughts.length = MAX_THOUGHTS
    }
    const res = this.thoughts.generate(ctx)
    if (typeof res === 'string') apply(res)
    else res.then(apply).catch(() => {})
  }

  thoughtContext(f: Fish): ThoughtContext {
    const now = this.world.worldTime
    const sp = SPECIES[f.species]
    const near = nearestPlaceTo(this.placeList, f.pos)
    const nearby = this.grid
      .query(f.pos.x, f.pos.y, 220, [])
      .filter((o) => o !== f)
      .slice(0, 5)
      .map((o) => ({ name: o.name, relation: relationLabel(f, o.id), bigger: bodyLength(o) > bodyLength(f) * 1.3, action: o.action }))

    // closest friend overall
    let friend: ThoughtContext['friend'] = null
    let best = 0.3
    for (const [id, r] of Object.entries(f.relationships)) {
      const o = this.byId.get(id)
      if (o && r.score > best) {
        best = r.score
        const lastMem = f.memories.find((m) => m.fishId === id)
        friend = {
          name: o.name,
          seenMinAgo: (now - (r.lastSeen || now)) / 60_000,
          lastPlace: lastMem?.placeId ? (this.placeById(lastMem.placeId)?.name ?? null) : near ? near.place.name : null,
        }
      }
    }
    // the fish that frightens it most
    let threat: ThoughtContext['threat'] = null
    let worst = -0.25
    for (const [id, r] of Object.entries(f.relationships)) {
      const o = this.byId.get(id)
      if (o && r.score < worst && r.chasedBy > 0) {
        worst = r.score
        threat = { name: o.name, place: this.placeById(o.territoryId)?.name ?? null }
      }
    }
    let ownerNearby: ThoughtContext['territoryOwnerNearby'] = null
    if (near && near.dist < near.place.r * 3) {
      const ownerId = this.world.territories[near.place.id]
      const o = ownerId ? this.byId.get(ownerId) : undefined
      if (o && o !== f) ownerNearby = { name: o.name, place: near.place.name }
    }
    const fav = favoritePlace(f)
    const food = recallFoodSpot(f, now)
    const disc = f.discoveries[0]
    const school = this.schoolById(f.schoolId)
    return {
      fishId: f.id,
      name: f.name,
      species: sp.name,
      personality: `${f.preset.toLowerCase()}${f.personalityText ? `; ${f.personalityText}` : ''}`,
      traits: {
        social: f.personality.social,
        aggression: f.personality.aggression,
        curiosity: f.personality.curiosity,
        bravery: f.personality.bravery,
        energy: f.personality.energy,
      },
      mood: f.mood,
      action: f.action,
      actionDetail: f.actionDetail,
      hunger: f.hunger,
      energy: f.energy,
      stress: f.stress,
      location: locationPhrase(f.pos, this.placeList),
      nearestPlace: near && near.dist < 320 ? near.place.name : null,
      timeOfDay: this.phase,
      isNew: Date.now() - f.introducedAt < 5 * 60_000,
      school: school ? { name: school.name, size: school.members.length } : null,
      territory: this.placeById(f.territoryId)?.name ?? null,
      nearby,
      friend,
      threat,
      favoritePlace: fav ? (this.placeById(fav.id)?.name ?? null) : null,
      foodSpot: food ? food.label.replace(/^found food /, '') : null,
      lastDiscovery: disc ? { name: disc.name, minAgo: (now - disc.t) / 60_000, transient: disc.placeId.startsWith('cur-') } : null,
      territoryOwnerNearby: ownerNearby,
      recentMemories: f.memories.slice(0, 4).map((m) => ({ text: m.text, minAgo: (now - m.t) / 60_000 })),
      bubblesNearby: dist(f.pos, { x: 780, y: 760 }) < 200,
      previousThoughts: f.thoughts.slice(0, 4).map((t) => t.text),
      market: this.market && this.market.source !== 'pending' ? this.marketMood : null,
      seq: f.thoughts.length + Math.floor(now / 1000),
    }
  }

  /* ------------------------------------------------------------ */
  /* token market                                                  */
  /* ------------------------------------------------------------ */

  applyMarket(s: MarketSnapshot): void {
    const first = !this.market
    this.market = s
    const T = `$${s.ticker}`
    const tag = s.source === 'sim' ? ' (simulated)' : ''
    // hysteresis: a new mood has to hold for two readings before the tank feels it
    let mood = marketMood(s)
    if (!first && mood !== this.marketMood) {
      if (this.pendingMood?.mood === mood) this.pendingMood.seen++
      else this.pendingMood = { mood, seen: 1 }
      if (this.pendingMood.seen < 2) mood = this.marketMood
    } else this.pendingMood = null
    if (mood !== this.marketMood) {
      this.marketMood = mood
      this.pendingMood = null
      if (!first || mood !== 'calm') {
        const h = fmtPct(s.change1h)
        const text: Record<MarketMood, string> = {
          euphoric: `the water turned bright green: ${T} ${h} in 1h`,
          bullish: `a green current runs through the tank: ${T} ${h} in 1h`,
          calm: `the current settles: ${T} ${h} in 1h`,
          bearish: `the water takes on a red tint: ${T} ${h} in 1h`,
          panic: `red tide: ${T} ${h} in 1h. the fish scatter`,
        }
        this.log.emit('market', text[mood] + tag, [], { key: 'market-mood', cooldownMs: 3 * 60_000 })
      }
    }
    const now = Date.now()
    if (now - this.candleAt > 4 * 60_000) {
      if (s.change5m <= -8) {
        this.candleAt = now
        this.redCandle(s, tag)
      } else if (s.change5m >= 8) {
        this.candleAt = now
        this.greenCandle(s, tag)
      }
    }
    this.notify()
  }

  private redCandle(s: MarketSnapshot, tag: string): void {
    const t = this.world.worldTime
    let fled = 0
    for (const f of this.world.fish) {
      if (f.enteringUntil) continue
      f.stress = clamp(f.stress + 0.25 + (1 - f.personality.bravery) * 0.5)
      if (f.personality.bravery < 0.6 && f.action !== 'REST') {
        // timid fish bolt for the nearest shelter
        this.hide(f, pickShelter(this, f, 'hide', null), null)
        f.actionDetail = `${f.actionDetail} from the red water`
        f.nextDecisionAt = this.world.worldTime + 6000 + this.rand() * 6000
        fled++
      } else f.nextDecisionAt = 0
      remember(f, { t, kind: 'threat', text: 'felt the water turn red', valence: -0.4 })
      this.thinkSoon(f)
    }
    this.log.emit('market', `a red candle shook the tank ($${s.ticker} ${fmtPct(s.change5m)} in 5m). ${fled} fish ran for cover${tag}`, [])
  }

  private greenCandle(s: MarketSnapshot, tag: string): void {
    const t = this.world.worldTime
    for (const f of this.world.fish) {
      f.curiosity = clamp(f.curiosity + 0.3)
      f.energy = clamp(f.energy + 0.1)
      remember(f, { t, kind: 'place', text: 'felt a warm green current', valence: 0.4 })
    }
    this.feed(undefined, false, `a green candle ($${s.ticker} ${fmtPct(s.change5m)} in 5m) set off the feeder${tag}`)
  }

  /* ------------------------------------------------------------ */
  /* user actions                                                  */
  /* ------------------------------------------------------------ */

  addFish(input: NewFishInput): Fish | null {
    if (this.world.fish.length >= MAX_FISH) return null
    const now = this.world.worldTime
    const x = 300 + this.rand() * (TANK_W - 600)
    const f = createFish(input, now, this.rand, { entering: true, x })
    f.memories.push({ t: now, kind: 'arrival', text: 'arrived in the tank', valence: 0.2 })
    f.thoughts.unshift({ t: now, text: 'this water tastes different from where i came from.' })
    f.lastThought = f.thoughts[0].text
    f.lastThoughtAt = now
    this.world.fish.push(f)
    this.byId.set(f.id, f)
    this.log.emit('social', `${f.name} the ${SPECIES[f.species].name.toLowerCase()} was introduced to the tank`, [f.id])
    this.save()
    this.notify()
    return f
  }

  releaseFish(id: string): void {
    const f = this.byId.get(id)
    if (!f) return
    if (f.schoolId) leaveSchool(this, f, 'dissolved')
    for (const [pid, owner] of Object.entries(this.world.territories)) if (owner === id) delete this.world.territories[pid]
    this.world.fish = this.world.fish.filter((x) => x !== f)
    this.byId.delete(id)
    this.runtime.delete(id)
    for (const o of this.world.fish) delete o.relationships[id]
    if (this.ui.selectedId === id) this.ui.selectedId = null
    this.log.emit('system', `${f.name} was released from the tank`, [])
    this.save()
    this.notify()
  }

  select(id: string | null): void {
    this.ui.selectedId = id
    this.notify()
  }

  setPaused(p: boolean): void {
    this.ui.paused = p
    this.notify()
  }

  setSpeed(s: SimSpeed): void {
    this.ui.speed = s
    this.notify()
  }

  fishAt(x: number, y: number, radius: number): Fish | null {
    let best: Fish | null = null
    let bd = Infinity
    for (const f of this.world.fish) {
      const d = Math.hypot(f.pos.x - x, f.pos.y - y)
      const r = Math.max(radius, bodyLength(f) * 0.7)
      if (d < r && d < bd) {
        bd = d
        best = f
      }
    }
    return best
  }

  /* ------------------------------------------------------------ */
  /* offline catch-up                                              */
  /* ------------------------------------------------------------ */

  /**
   * Advance the world by `ms` of real elapsed time. The last ten minutes are
   * simulated in full; anything before that is summarized statistically.
   */
  advance(ms: number): void {
    const w = this.world
    const startWall = Date.now() - ms
    const simMs = Math.min(ms, 10 * 60_000)
    const skipMs = ms - simMs
    const before = { i: w.counters.interactions, d: w.counters.discoveries, m: w.counters.meals }

    if (skipMs > 0) this.summarizeAbsence(skipMs, startWall)
    // full simulation for the most recent stretch
    const dt = 0.1
    const steps = Math.floor(simMs / 1000 / dt)
    const wallStart = startWall + skipMs
    for (let i = 0; i < steps; i++) {
      this.log.wallOverride = wallStart + i * dt * 1000
      this.step(dt)
    }
    this.log.wallOverride = null
    for (const f of w.fish) this.rt(f).arrived = false

    if (ms > 60_000) {
      const di = w.counters.interactions - before.i
      const dd = w.counters.discoveries - before.d
      const dm = w.counters.meals - before.m
      this.lastAbsence = { ms, at: w.worldTime }
      this.log.emit('system', `you were away for ${formatSpan(ms)}. the tank kept going: ${di} interactions, ${dd} discoveries, ${dm} meals`, [])
    }
    this.save()
  }

  private summarizeAbsence(ms: number, startWall: number): void {
    const w = this.world
    const hours = ms / 3_600_000
    const minutes = ms / 60_000
    const r = this.rand
    const pending: { wall: number; run: () => void }[] = []

    w.worldTime += ms
    w.counters.nextFeedAt = w.worldTime + 60_000
    w.counters.nextCuriosityAt = Math.min(w.counters.nextCuriosityAt, w.worldTime + 60_000)
    w.food = []
    // expire old curiosities
    w.curiosities = w.curiosities.filter((c) => (c.expiresAt ?? Infinity) > w.worldTime)
    this.reindex()

    for (const f of w.fish) {
      f.hunger = clamp(0.25 + r() * 0.4)
      f.energy = clamp(0.45 + r() * 0.45)
      f.stress = 0
      f.enteringUntil = 0
      f.nextDecisionAt = 0
      f.nextThoughtAt = w.worldTime + r() * 5000
      decayRelationships(f, Math.min(minutes, 720))
      f.stats.distance += hours * 3600 * SPECIES[f.species].maxSpeed * 0.3
      // schoolmates grow closer over long stretches together
      const s = this.schoolById(f.schoolId)
      if (s) {
        for (const id of s.members) {
          const o = this.byId.get(id)
          if (o && o !== f) nudge(f, o, Math.min(0.25, 0.04 * hours), Math.min(0.3, 0.05 * hours))
        }
      }
      // curious fish explore what they haven't seen yet
      for (const pl of STATIC_PLACES) {
        if (f.discoveries.some((d) => d.placeId === pl.id)) continue
        const p = 1 - Math.exp(-hours * f.personality.curiosity * 0.35)
        if (r() < p) {
          const wall = startWall + r() * ms
          const t = w.worldTime - (Date.now() - wall)
          pending.push({
            wall,
            run: () => {
              const first = !w.firstFinds[pl.id]
              if (first) w.firstFinds[pl.id] = f.id
              f.discoveries.unshift({ placeId: pl.id, name: pl.name, t, first })
              w.counters.discoveries++
              adjustAffinity(f, pl.id, 0.1)
              remember(f, { t, kind: 'discovery', text: `discovered ${pl.name}`, placeId: pl.id, valence: 0.6 })
              this.log.emit('discovery', `${f.name} discovered ${pl.name}`, [f.id])
            },
          })
        }
      }
      // meals from the auto-feeder
      const meals = Math.floor(hours * 8 * (0.5 + r()))
      f.stats.meals += meals
      w.counters.meals += meals
    }
    // stretches of quiet produce a few rest/feeding events
    const feeds = Math.min(6, Math.floor(hours * 2))
    for (let i = 0; i < feeds; i++) {
      pending.push({ wall: startWall + r() * ms, run: () => this.log.emit('feeding', 'the feeder dropped food while you were away', []) })
    }
    pending.sort((a, b) => a.wall - b.wall)
    for (const p of pending.slice(-40)) {
      this.log.wallOverride = p.wall
      p.run()
    }
    this.log.wallOverride = null
    for (const f of w.fish) f.discoveries.sort((a, b) => b.t - a.t)
  }
}

/* -------------------------------------------------------------- */

function nearestPlaceTo(places: Place[], p: Vec): { place: Place; dist: number } | null {
  let best: Place | null = null
  let bd = Infinity
  for (const pl of places) {
    const d = Math.hypot(pl.x - p.x, pl.y - p.y)
    if (d < bd) {
      bd = d
      best = pl
    }
  }
  return best ? { place: best, dist: bd } : null
}

function moodOf(sim: Engine, f: Fish, p: Perception): Mood {
  const P = f.personality
  if (f.action === 'FLEE' || f.stress > 0.75) return 'startled'
  if (p.threat || f.stress > 0.45) return 'anxious'
  if (f.hunger > 0.72) return 'hungry'
  if (f.energy < 0.25 || f.action === 'REST') return 'sleepy'
  if (f.territoryId && p.intruder) return 'irritable'
  if (P.social > 0.6 && !f.schoolId && p.neighbors.length === 0) return 'lonely'
  if (f.action === 'INVESTIGATE' || f.curiosity > 0.65) return 'curious'
  if (P.bravery > 0.75 && (f.action === 'EXPLORE' || f.action === 'CHASE')) return 'bold'
  if (f.energy > 0.7 && P.chaos > 0.5) return 'playful'
  if (f.schoolId || f.action === 'FOLLOW') return 'content'
  return 'calm'
}

export function formatSpan(ms: number): string {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m`
  return `${s}s`
}

/* -------------------------------------------------------------- */
/* singleton                                                      */
/* -------------------------------------------------------------- */

let instance: Engine | null = null

export function getEngine(): Engine {
  if (!instance) instance = Engine.boot()
  return instance
}

export function resetEngine(): Engine {
  const e = getEngine()
  e.reset(createSeedWorld())
  return e
}

export { restPhrase, maxSpeedOf }
