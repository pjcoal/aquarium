import type { Fish, SpeciesId, Vec } from '@/types/fish'
import type { School } from '@/types/simulation'
import type { Sim } from './behavior'
import { SPECIES } from './species'
import { add, arrive, dist, seek, v } from './steering'
import { compatibility, nudge, peekRel } from './relationships'
import { remember } from './memory'
import { TANK_W, SURFACE_Y, depthBand, sandY, zoneName } from './environment'
import { clamp } from '@/lib/random'

const COLOR_WORD: Record<SpeciesId, [string, number]> = {
  'neon-tetra': ['Blue', 195],
  guppy: ['Amber', 30],
  betta: ['Violet', 290],
  clownfish: ['Orange', 22],
  angelfish: ['Silver', 210],
  goldfish: ['Gold', 45],
  'zebra-danio': ['Striped', 55],
  'cherry-barb': ['Red', 355],
}
const NOUNS = ['Shoal', 'Drift', 'Ring', 'Current', 'Choir', 'Thread', 'Cloud', 'Band', 'Tide', 'Swirl', 'Loop', 'Veil']
export const MAX_SCHOOL = 10

export function schoolDrive(f: Fish): number {
  return SPECIES[f.species].schooling * 0.6 + f.personality.social * 0.4
}

function eligible(f: Fish): boolean {
  return (
    f.enteringUntil === 0 &&
    f.action !== 'CHASE' &&
    f.action !== 'FLEE' &&
    f.action !== 'REST' &&
    f.action !== 'HIDE' &&
    f.action !== 'EAT' &&
    !f.territoryId
  )
}

function makeName(sim: Sim, founders: Fish[]): { name: string; hue: number } {
  const counts = new Map<SpeciesId, number>()
  for (const f of founders) counts.set(f.species, (counts.get(f.species) ?? 0) + 1)
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const [word, hue] = COLOR_WORD[dominant]
  const taken = new Set(sim.world.schools.map((s) => s.name))
  const start = sim.world.counters.nextSchoolNum++
  for (let i = 0; i < NOUNS.length; i++) {
    const name = `${word} ${NOUNS[(start + i) % NOUNS.length]}`
    if (!taken.has(name)) return { name, hue }
  }
  return { name: `${word} ${NOUNS[start % NOUNS.length]} ${start}`, hue }
}

export function centroid(sim: Sim, s: School, awakeOnly = false): Vec {
  let x = 0
  let y = 0
  let n = 0
  for (const id of s.members) {
    const m = sim.byId.get(id)
    if (!m || (awakeOnly && m.action === 'REST')) continue
    x += m.pos.x
    y += m.pos.y
    n++
  }
  return n ? { x: x / n, y: y / n } : { x: TANK_W / 2, y: 400 }
}

function names(list: Fish[]): string {
  const n = list.map((f) => f.name)
  if (n.length <= 1) return n.join('')
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

export function joinSchool(sim: Sim, f: Fish, s: School, silent = false): void {
  if (f.schoolId === s.id) return
  if (f.schoolId) leaveSchool(sim, f, 'switched')
  f.schoolId = s.id
  s.members.push(f.id)
  const now = sim.world.worldTime
  for (const id of s.members) {
    const m = sim.byId.get(id)
    if (!m || m === f) continue
    nudge(f, m, 0.02, 0.05, now)
    nudge(m, f, 0.01, 0.05, now)
  }
  remember(f, { t: now, kind: 'school', text: `joined ${s.name}`, valence: 0.4 })
  f.stats.interactions++
  sim.world.counters.interactions++
  if (!silent) sim.log.emit('social', `${f.name} joined ${s.name}`, [f.id], { schoolId: s.id })
}

export function leaveSchool(sim: Sim, f: Fish, reason: 'drifted' | 'quarrel' | 'independent' | 'switched' | 'dissolved', other?: Fish): void {
  const s = sim.schoolById(f.schoolId)
  f.schoolId = null
  if (!s) return
  sim.rt(f).schoolCooldownUntil = sim.world.worldTime + (reason === 'switched' ? 0 : 3 * 60_000)
  s.members = s.members.filter((id) => id !== f.id)
  const now = sim.world.worldTime
  remember(f, { t: now, kind: 'school', text: `left ${s.name}`, valence: reason === 'quarrel' ? -0.4 : -0.1 })
  if (reason === 'drifted') sim.log.emit('social', `${f.name} drifted away from ${s.name}`, [f.id], { schoolId: s.id })
  else if (reason === 'quarrel' && other)
    sim.log.emit('social', `${f.name} left ${s.name} after a quarrel with ${other.name}`, [f.id, other.id], { schoolId: s.id })
  else if (reason === 'independent') sim.log.emit('social', `${f.name} left ${s.name} to go alone`, [f.id], { schoolId: s.id })
  if (s.leaderId === f.id) electLeader(sim, s)
}

function electLeader(sim: Sim, s: School): void {
  let best: Fish | null = null
  let bestScore = -Infinity
  for (const id of s.members) {
    const m = sim.byId.get(id)
    if (!m) continue
    // bold, curious and older fish lead
    const score = (m.personality.bravery + m.personality.curiosity) * 0.5 + Math.min(0.3, (sim.world.worldTime - m.createdAt) / 864e6)
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }
  if (best) s.leaderId = best.id
}

function pickGoal(sim: Sim, s: School): void {
  const leader = sim.byId.get(s.leaderId)
  const rand = sim.rand
  const now = sim.world.worldTime
  let depthLo = 0
  let depthHi = 0
  let hunger = 0
  let n = 0
  for (const id of s.members) {
    const m = sim.byId.get(id)
    if (!m) continue
    const sp = SPECIES[m.species]
    depthLo += sp.depth[0] + m.prefs.depthBias
    depthHi += sp.depth[1] + m.prefs.depthBias
    hunger += m.hunger
    n++
  }
  if (!n) return
  depthLo = clamp(depthLo / n, 0.03, 0.9)
  depthHi = clamp(depthHi / n, depthLo + 0.05, 0.95)
  hunger /= n
  const r = rand()
  let goal: Vec
  if (hunger > 0.55 && r < 0.5) {
    goal = { x: 200 + rand() * (TANK_W - 400), y: SURFACE_Y + 80 }
  } else if (leader && r < 0.35) {
    // favorite places of the leader pull the whole school
    const fav = Object.entries(leader.prefs.placeAffinity).sort((a, b) => b[1] - a[1])[0]
    const pl = fav && fav[1] > 0.2 ? sim.placeById(fav[0]) : undefined
    goal = pl ? { x: pl.x, y: Math.min(pl.y - 60, sandY(pl.x) - 80) } : { x: rand() * TANK_W, y: 300 }
  } else {
    const x = 120 + rand() * (TANK_W - 240)
    const d = depthLo + rand() * (depthHi - depthLo)
    goal = { x, y: SURFACE_Y + d * (sandY(x) - SURFACE_Y - 60) }
  }
  s.goal = goal
  s.goalUntil = now + (14_000 + rand() * 26_000)
}

/** boids forces among schoolmates + goal seeking */
export function schoolForce(sim: Sim, f: Fish, maxSpeed: number): Vec {
  const out = v()
  const s = sim.schoolById(f.schoolId)
  if (!s) return out
  let cx = 0
  let cy = 0
  let vx = 0
  let vy = 0
  let n = 0
  let fx = 0
  let fy = 0
  let fn = 0
  for (const id of s.members) {
    if (id === f.id) continue
    const m = sim.byId.get(id)
    if (!m || m.action === 'REST') continue
    const d = dist(f.pos, m.pos)
    fx += m.pos.x
    fy += m.pos.y
    fn++
    if (d > 260) continue
    cx += m.pos.x
    cy += m.pos.y
    vx += m.vel.x
    vy += m.vel.y
    n++
  }
  if (n) {
    add(out, arrive(f.pos, f.vel, { x: cx / n, y: cy / n }, maxSpeed, 90), 0.55)
    add(out, v(vx / n - f.vel.x, vy / n - f.vel.y), 0.6)
  } else if (fn) {
    add(out, seek(f.pos, f.vel, { x: fx / fn, y: fy / fn }, maxSpeed), 1)
  }
  const goalWeight = s.leaderId === f.id ? 0.7 : 0.25
  add(out, arrive(f.pos, f.vel, s.goal, maxSpeed, 140), goalWeight)
  return out
}

/** called roughly every 1.5s of world time */
export function updateSchools(sim: Sim, dtSec: number, nearbyOf: (f: Fish, r: number) => Fish[]): void {
  const w = sim.world
  const now = w.worldTime
  const rand = sim.rand

  // --- membership changes for existing members
  for (const s of w.schools) {
    for (const id of [...s.members]) {
      const f = sim.byId.get(id)
      if (!f) {
        s.members = s.members.filter((x) => x !== id)
        continue
      }
      const c = centroid(sim, s, true)
      const rt = sim.rt(f)
      if (dist(f.pos, c) > 380 && f.action !== 'REST' && f.action !== 'EAT') rt.strayTime += dtSec
      else rt.strayTime = Math.max(0, rt.strayTime - dtSec * 2)
      if (rt.strayTime > 40) {
        rt.strayTime = 0
        leaveSchool(sim, f, 'drifted')
        continue
      }
      // quarrels
      let worst: Fish | null = null
      let worstScore = 0
      let sum = 0
      let cnt = 0
      for (const oid of s.members) {
        if (oid === f.id) continue
        const r = peekRel(f, oid)
        const sc = r?.score ?? 0
        sum += sc
        cnt++
        if (sc < worstScore) {
          worstScore = sc
          worst = sim.byId.get(oid) ?? null
        }
      }
      if (cnt && (sum / cnt < -0.15 || worstScore < -0.45)) {
        leaveSchool(sim, f, 'quarrel', worst ?? undefined)
        continue
      }
      const independence = (1 - schoolDrive(f)) * 0.0007 + f.personality.chaos * 0.0003 + (f.territoryId ? 0.05 : 0)
      if (rand() < independence * dtSec) {
        leaveSchool(sim, f, 'independent')
        continue
      }
    }
  }

  // --- dissolve tiny schools
  for (const s of [...w.schools]) {
    if (s.members.length >= 2) continue
    for (const id of s.members) {
      const f = sim.byId.get(id)
      if (f) {
        f.schoolId = null
        remember(f, { t: now, kind: 'school', text: `was the last of ${s.name}`, valence: -0.3 })
      }
    }
    w.schools = w.schools.filter((x) => x !== s)
    sim.log.emit('social', `${s.name} scattered`, s.members, { schoolId: s.id })
  }

  // --- joining and forming
  for (const f of w.fish) {
    if (f.schoolId || !eligible(f) || sim.rt(f).schoolCooldownUntil > now) continue
    const drive = schoolDrive(f)
    if (drive < 0.42) continue
    const nb = nearbyOf(f, 150).filter((o) => o !== f && eligible(o))
    if (!nb.length) continue
    // join an existing school nearby
    const withSchool = nb.find((o) => {
      if (!o.schoolId) return false
      const s = sim.schoolById(o.schoolId)
      if (!s || s.members.length >= MAX_SCHOOL) return false
      const c = compatibility(f, o) + (peekRel(f, o.id)?.score ?? 0)
      return c > (o.species === f.species ? 0.05 : 0.3)
    })
    if (withSchool) {
      if (rand() < drive * 0.2 * dtSec) joinSchool(sim, f, sim.schoolById(withSchool.schoolId)!)
      continue
    }
    const mates = nb.filter(
      (o) => !o.schoolId && sim.rt(o).schoolCooldownUntil <= now && schoolDrive(o) > 0.42 && compatibility(f, o) + (peekRel(f, o.id)?.score ?? 0) > (o.species === f.species ? 0.1 : 0.35),
    )
    if (mates.length >= 2 && rand() < drive * 0.3 * dtSec) {
      const founders = [f, ...mates.slice(0, 4)]
      const { name, hue } = makeName(sim, founders)
      const s: School = {
        id: `s${w.counters.nextSchoolNum}-${Math.floor(rand() * 1e6).toString(36)}`,
        name,
        hue,
        members: [],
        leaderId: f.id,
        createdAt: now,
        goal: { x: f.pos.x, y: f.pos.y },
        goalUntil: 0,
        territory: zoneName(f.pos),
        band: depthBand(f.pos.y),
        zoneTime: {},
      }
      w.schools.push(s)
      for (const m of founders) joinSchool(sim, m, s, true)
      electLeader(sim, s)
      sim.log.emit('social', `${names(founders)} formed ${s.name}`, founders.map((x) => x.id), { schoolId: s.id })
    }
  }

  // --- merging
  for (const a of w.schools) {
    for (const b of w.schools) {
      if (a === b || a.members.length < b.members.length) continue
      if (a.members.length + b.members.length > MAX_SCHOOL) continue
      if (dist(centroid(sim, a), centroid(sim, b)) > 150) continue
      const la = sim.byId.get(a.leaderId)
      const lb = sim.byId.get(b.leaderId)
      if (!la || !lb || compatibility(la, lb) < 0) continue
      if (rand() < 0.25 * dtSec) {
        for (const id of [...b.members]) {
          const m = sim.byId.get(id)
          if (!m) continue
          m.schoolId = null
          joinSchool(sim, m, a, true)
        }
        b.members = []
        w.schools = w.schools.filter((x) => x !== b)
        sim.log.emit('social', `${b.name} merged into ${a.name}`, [], { schoolId: a.id })
        return
      }
    }
  }

  // --- goals, territory and movement events
  for (const s of w.schools) {
    if (!sim.byId.get(s.leaderId) || !s.members.includes(s.leaderId)) electLeader(sim, s)
    if (now > s.goalUntil) pickGoal(sim, s)
    const c = centroid(sim, s, true)
    const z = zoneName(c)
    s.zoneTime[z] = (s.zoneTime[z] ?? 0) + dtSec
    for (const k in s.zoneTime) {
      s.zoneTime[k] *= 0.995
      if (s.zoneTime[k] < 0.5 && k !== z) delete s.zoneTime[k]
    }
    s.territory = Object.entries(s.zoneTime).sort((x, y) => y[1] - x[1])[0]?.[0] ?? z
    const band = depthBand(c.y)
    if (band !== s.band) {
      s.band = band
      const text =
        band === 'surface' ? `${s.name} moved toward the surface` : band === 'bottom' ? `${s.name} sank toward the bottom` : `${s.name} settled into the middle water`
      sim.log.emit('exploration', text, [], { schoolId: s.id, key: `band:${s.id}`, cooldownMs: 120_000 })
    }
  }
}

export function schoolBehavior(sim: Sim, s: School): string {
  let social = 0
  let energy = 0
  let bravery = 0
  let chaos = 0
  let n = 0
  for (const id of s.members) {
    const m = sim.byId.get(id)
    if (!m) continue
    social += m.personality.social
    energy += m.personality.energy
    bravery += m.personality.bravery
    chaos += m.personality.chaos
    n++
  }
  if (!n) return '—'
  social /= n
  energy /= n
  bravery /= n
  chaos /= n
  const a = chaos > 0.55 ? 'erratic' : energy > 0.7 ? 'restless' : energy < 0.4 ? 'calm' : 'steady'
  const b = bravery < 0.35 ? 'skittish' : bravery > 0.7 ? 'bold' : social > 0.65 ? 'social' : 'reserved'
  return `${a} / ${b}`
}
