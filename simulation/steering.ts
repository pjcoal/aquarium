import type { Vec } from '@/types/fish'
import { OBSTACLES, WATER, sandY } from './environment'

export const v = (x = 0, y = 0): Vec => ({ x, y })
export const len = (a: Vec) => Math.hypot(a.x, a.y)
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
export const dist2 = (a: Vec, b: Vec) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

export function limit(a: Vec, max: number): Vec {
  const l = len(a)
  if (l > max && l > 0) {
    a.x = (a.x / l) * max
    a.y = (a.y / l) * max
  }
  return a
}

export function setMag(a: Vec, m: number): Vec {
  const l = len(a) || 1
  a.x = (a.x / l) * m
  a.y = (a.y / l) * m
  return a
}

export function add(a: Vec, b: Vec, k = 1): Vec {
  a.x += b.x * k
  a.y += b.y * k
  return a
}

/** Reynolds seek: desired velocity toward target minus current velocity */
export function seek(pos: Vec, vel: Vec, target: Vec, maxSpeed: number): Vec {
  const d = v(target.x - pos.x, target.y - pos.y)
  setMag(d, maxSpeed)
  return v(d.x - vel.x, d.y - vel.y)
}

/** seek that slows down within slowRadius */
export function arrive(pos: Vec, vel: Vec, target: Vec, maxSpeed: number, slowRadius = 120): Vec {
  const d = v(target.x - pos.x, target.y - pos.y)
  const l = len(d)
  if (l < 0.001) return v(-vel.x, -vel.y)
  const speed = l < slowRadius ? maxSpeed * (l / slowRadius) : maxSpeed
  setMag(d, speed)
  return v(d.x - vel.x, d.y - vel.y)
}

export function flee(pos: Vec, vel: Vec, threat: Vec, maxSpeed: number): Vec {
  const d = v(pos.x - threat.x, pos.y - threat.y)
  setMag(d, maxSpeed)
  return v(d.x - vel.x, d.y - vel.y)
}

/** predicted-position pursuit */
export function pursue(pos: Vec, vel: Vec, tPos: Vec, tVel: Vec, maxSpeed: number): Vec {
  const lookahead = Math.min(1.2, dist(pos, tPos) / (maxSpeed || 1))
  return seek(pos, vel, v(tPos.x + tVel.x * lookahead, tPos.y + tVel.y * lookahead), maxSpeed)
}

/**
 * Wander: a target on a circle projected ahead of the fish, whose angle drifts
 * smoothly. `angle` is mutated through the returned value.
 */
export function wander(
  vel: Vec,
  heading: number,
  wanderAngle: number,
  maxSpeed: number,
  rand: () => number,
  jitter = 0.6,
): { force: Vec; angle: number } {
  const angle = wanderAngle + (rand() - 0.5) * jitter
  const cx = Math.cos(heading) * 60
  const cy = Math.sin(heading) * 60
  const tx = cx + Math.cos(angle) * 30
  // flatten vertical wandering: fish mostly travel horizontally
  const ty = cy * 0.6 + Math.sin(angle) * 14
  const d = setMag(v(tx, ty), maxSpeed)
  return { force: v(d.x - vel.x, d.y - vel.y), angle }
}

/** soft walls: steer back when within margin of tank bounds */
export function boundaries(pos: Vec, vel: Vec, maxSpeed: number, margin = 70): Vec {
  const f = v()
  const floor = sandY(pos.x) - 14
  if (pos.x < WATER.left + margin) f.x += ((WATER.left + margin - pos.x) / margin) * maxSpeed
  if (pos.x > WATER.right - margin) f.x -= ((pos.x - (WATER.right - margin)) / margin) * maxSpeed
  if (pos.y < WATER.top + margin * 0.6) f.y += ((WATER.top + margin * 0.6 - pos.y) / (margin * 0.6)) * maxSpeed
  if (pos.y > floor - margin * 0.5) f.y -= ((pos.y - (floor - margin * 0.5)) / (margin * 0.5)) * maxSpeed
  return f
}

/** repulsion from obstacle circles, stronger for those ahead of the fish */
export function avoidObstacles(pos: Vec, vel: Vec, maxSpeed: number, bodyR: number): Vec {
  const f = v()
  const sp = len(vel) || 1
  const ax = pos.x + (vel.x / sp) * 40
  const ay = pos.y + (vel.y / sp) * 40
  for (const o of OBSTACLES) {
    const r = o.r + bodyR + 18
    const d = Math.hypot(pos.x - o.x, pos.y - o.y)
    const da = Math.hypot(ax - o.x, ay - o.y)
    const m = Math.min(d, da)
    if (m < r) {
      const k = (1 - m / r) * maxSpeed * 2.2
      const nx = (pos.x - o.x) / (d || 1)
      const ny = (pos.y - o.y) / (d || 1)
      f.x += nx * k
      f.y += ny * k
    }
  }
  return f
}

/** hard constraints after integration so nothing escapes the glass */
export function constrain(pos: Vec, vel: Vec, bodyR: number): void {
  const floor = sandY(pos.x) - 6 - bodyR * 0.3
  if (pos.x < WATER.left) {
    pos.x = WATER.left
    vel.x = Math.abs(vel.x) * 0.3
  }
  if (pos.x > WATER.right) {
    pos.x = WATER.right
    vel.x = -Math.abs(vel.x) * 0.3
  }
  if (pos.y < WATER.top) {
    pos.y = WATER.top
    vel.y = Math.abs(vel.y) * 0.3
  }
  if (pos.y > floor) {
    pos.y = floor
    vel.y = -Math.abs(vel.y) * 0.3
  }
  for (const o of OBSTACLES) {
    const r = o.r + bodyR * 0.4
    const dx = pos.x - o.x
    const dy = pos.y - o.y
    const d = Math.hypot(dx, dy)
    if (d < r && d > 0) {
      pos.x = o.x + (dx / d) * r
      pos.y = o.y + (dy / d) * r
    }
  }
}

export function angleDiff(a: number, b: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
