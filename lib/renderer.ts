import type { Engine } from '@/simulation/engine'
import type { Fish } from '@/types/fish'
import type { Place } from '@/types/simulation'
import { BUBBLE_SOURCES, PLANTS, STATIC_PLACES, SURFACE_Y, TANK_H, TANK_W, sandY, type PlantDef } from '@/simulation/environment'
import { SPECIES } from '@/simulation/species'
import { drawFish } from './fishDrawing'
import { mulberry32 } from './random'

export interface Camera {
  x: number
  y: number
  zoom: number
}

interface Bubble {
  x: number
  y: number
  r: number
  vy: number
  wob: number
}

interface Mote {
  x: number
  y: number
  z: number
  vx: number
  vy: number
}

interface Splash {
  x: number
  t: number
}

const BG_SCALE = 1.5

export class AquariumRenderer {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private bg: HTMLCanvasElement | null = null
  private bubbles: Bubble[] = []
  private motes: Mote[] = []
  private splashes: Splash[] = []
  private seenEntering = new Set<string>()
  private t = 0
  reducedMotion = false

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2d canvas unavailable')
    this.ctx = ctx
    const r = mulberry32(7)
    for (let i = 0; i < 110; i++) {
      this.motes.push({ x: r() * TANK_W, y: SURFACE_Y + r() * (TANK_H - SURFACE_Y - 80), z: 0.3 + r() * 0.7, vx: (r() - 0.5) * 4, vy: (r() - 0.5) * 2 })
    }
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
  }

  get size() {
    return { w: this.w, h: this.h }
  }

  fitCamera(): Camera {
    const zoom = Math.min(this.w / TANK_W, this.h / TANK_H) * 0.98
    return { x: TANK_W / 2, y: TANK_H / 2, zoom }
  }

  screenToWorld(cam: Camera, sx: number, sy: number) {
    return { x: (sx - this.w / 2) / cam.zoom + cam.x, y: (sy - this.h / 2) / cam.zoom + cam.y }
  }

  worldToScreen(cam: Camera, x: number, y: number) {
    return { x: (x - cam.x) * cam.zoom + this.w / 2, y: (y - cam.y) * cam.zoom + this.h / 2 }
  }

  /* -------------------------------------------------------------- */

  update(dt: number, engine: Engine) {
    this.t += dt
    const motion = this.reducedMotion ? 0.3 : 1
    // bubbles from the bubble stone and filter outflow
    for (const s of BUBBLE_SOURCES) {
      if (Math.random() < dt * 6 * motion && this.bubbles.length < 90) {
        this.bubbles.push({ x: s.x + (Math.random() - 0.5) * 6, y: s.y, r: 1.2 + Math.random() * 3, vy: 40 + Math.random() * 40, wob: Math.random() * 6 })
      }
    }
    // the occasional fish bubble
    for (const f of engine.world.fish) {
      if (Math.random() < dt * 0.03 && this.bubbles.length < 90) {
        this.bubbles.push({ x: f.pos.x, y: f.pos.y - 3, r: 0.8 + Math.random() * 1.4, vy: 25 + Math.random() * 20, wob: Math.random() * 6 })
      }
      if (f.enteringUntil > 0 && !this.seenEntering.has(f.id)) {
        this.seenEntering.add(f.id)
        this.splashes.push({ x: f.pos.x, t: 0 })
        for (let i = 0; i < 18; i++) {
          this.bubbles.push({ x: f.pos.x + (Math.random() - 0.5) * 30, y: SURFACE_Y + 20 + Math.random() * 80, r: 1 + Math.random() * 3, vy: 30 + Math.random() * 50, wob: Math.random() * 6 })
        }
      }
    }
    for (const b of this.bubbles) {
      b.y -= b.vy * dt
      b.x += Math.sin(this.t * 3 + b.wob) * 10 * dt
      b.vy = Math.min(b.vy + 10 * dt, 120)
    }
    this.bubbles = this.bubbles.filter((b) => b.y > SURFACE_Y + 2)
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.t * 0.2 + m.y * 0.01) * 3) * dt * motion
      m.y += (m.vy + Math.cos(this.t * 0.15 + m.x * 0.01) * 2) * dt * motion
      if (m.x < 0) m.x += TANK_W
      if (m.x > TANK_W) m.x -= TANK_W
      if (m.y < SURFACE_Y + 5) m.y = TANK_H - 100
      if (m.y > TANK_H - 90) m.y = SURFACE_Y + 10
    }
    for (const s of this.splashes) s.t += dt
    this.splashes = this.splashes.filter((s) => s.t < 1.6)
  }

  /* -------------------------------------------------------------- */

  draw(engine: Engine, cam: Camera, opts: { hoverId: string | null; showNames: boolean }) {
    const ctx = this.ctx
    const { dpr } = this
    const light = engine.light
    if (!this.bg) this.bg = buildBackground()

    // outside the tank: monitor background with a faint grid
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#04080d'
    ctx.fillRect(0, 0, this.w, this.h)

    ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (this.w / 2 - cam.x * cam.zoom), dpr * (this.h / 2 - cam.y * cam.zoom))
    const z = cam.zoom

    ctx.strokeStyle = 'rgba(80,200,220,0.05)'
    ctx.lineWidth = 1 / z
    ctx.beginPath()
    for (let gx = -1000; gx <= TANK_W + 1000; gx += 100) {
      ctx.moveTo(gx, -1000)
      ctx.lineTo(gx, TANK_H + 1000)
    }
    for (let gy = -1000; gy <= TANK_H + 1000; gy += 100) {
      ctx.moveTo(-1000, gy)
      ctx.lineTo(TANK_W + 1000, gy)
    }
    ctx.stroke()

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, TANK_W, TANK_H)
    ctx.clip()
    ctx.drawImage(this.bg, 0, 0, TANK_W, TANK_H)

    this.drawLightRays(light)
    this.drawPlants(false)
    this.drawCuriosities(engine.world.curiosities)
    this.drawTerritories(engine)
    this.drawFood(engine)

    const sel = engine.ui.selectedId
    const selFish = sel ? engine.byId.get(sel) : undefined
    if (selFish) this.drawLinks(engine, selFish, z)

    // fish, smaller ones on top
    const fishes = [...engine.world.fish].sort((a, b) => SPECIES[b.species].length * b.scale - SPECIES[a.species].length * a.scale)
    for (const f of fishes) {
      const sheltered = (f.action === 'HIDE' || f.action === 'REST') && engine.rt(f).arrived && f.target?.kind === 'place'
      drawFish(ctx, f, f.pos.x, f.pos.y, f.heading, f.phase, sheltered ? 0.55 : 1)
    }

    this.drawPlants(true)
    this.drawBubbles()
    this.drawMotes(light)
    this.drawSurface(light)

    // night
    if (light < 1) {
      ctx.fillStyle = `rgba(2,6,22,${(1 - light) * 0.62})`
      ctx.fillRect(0, 0, TANK_W, TANK_H)
      // neon tetras faintly glow in the dark
      ctx.globalCompositeOperation = 'lighter'
      for (const f of engine.world.fish) {
        if (f.species !== 'neon-tetra') continue
        ctx.fillStyle = `rgba(60,200,255,${(1 - light) * 0.12})`
        ctx.beginPath()
        ctx.arc(f.pos.x, f.pos.y, 9 * f.scale, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.restore()

    // glass edge
    ctx.strokeStyle = 'rgba(120,220,235,0.28)'
    ctx.lineWidth = 1.5 / z
    ctx.strokeRect(0, 0, TANK_W, TANK_H)
    this.drawRulers(z)

    // labels & selection (in world space but sized for screen)
    for (const f of engine.world.fish) {
      const isSel = f.id === sel
      const isHover = f.id === opts.hoverId
      if (isSel) this.drawSelection(f, z)
      if (isSel || isHover || opts.showNames) this.drawLabel(f, z, isSel || isHover)
    }

    // vignette in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, this.w, this.h)
  }

  private drawLightRays(light: number) {
    const ctx = this.ctx
    const t = this.reducedMotion ? 0 : this.t
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 6; i++) {
      const x = 180 + i * 290 + Math.sin(t * 0.07 + i * 1.7) * 60
      const spread = 70 + (i % 3) * 30
      const lean = 160 + Math.sin(t * 0.05 + i) * 40
      const a = (0.035 + 0.02 * Math.sin(t * 0.3 + i * 2.1)) * light
      const g = ctx.createLinearGradient(0, SURFACE_Y, 0, 760)
      g.addColorStop(0, `rgba(170,240,255,${a * 1.6})`)
      g.addColorStop(1, 'rgba(170,240,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x - 25, SURFACE_Y)
      ctx.lineTo(x + 25, SURFACE_Y)
      ctx.lineTo(x + lean + spread, 780)
      ctx.lineTo(x + lean - spread, 780)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  private drawPlants(front: boolean) {
    const ctx = this.ctx
    const t = this.reducedMotion ? this.t * 0.25 : this.t
    for (const p of PLANTS) drawPlant(ctx, p, t, front)
  }

  private drawCuriosities(list: Place[]) {
    const ctx = this.ctx
    for (const c of list) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 2 + c.x)
      ctx.save()
      ctx.translate(c.x, c.y)
      switch (c.variant) {
        case 'shell': {
          ctx.strokeStyle = '#d8c3a0'
          ctx.fillStyle = '#8a6d4c'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          for (let a = 0; a < Math.PI * 4; a += 0.3) ctx.lineTo(Math.cos(a) * a * 0.6, Math.sin(a) * a * 0.5)
          ctx.stroke()
          break
        }
        case 'pebble':
        case 'marble': {
          const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7)
          g.addColorStop(0, '#ffffff')
          g.addColorStop(1, c.variant === 'marble' ? '#2fa8c9' : '#7f8c99')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.ellipse(0, 0, c.variant === 'marble' ? 6 : 8, 6, 0, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        case 'leaf': {
          ctx.fillStyle = '#6b4a22'
          ctx.rotate(0.4)
          ctx.beginPath()
          ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#3e2a12'
          ctx.beginPath()
          ctx.moveTo(-14, 0)
          ctx.lineTo(14, 0)
          ctx.stroke()
          break
        }
        case 'current': {
          ctx.strokeStyle = `rgba(255,200,140,${0.15 + pulse * 0.15})`
          ctx.lineWidth = 1.5
          for (let i = 0; i < 3; i++) {
            ctx.beginPath()
            for (let x = -30; x <= 30; x += 4) ctx.lineTo(x, i * 8 - 8 + Math.sin(x * 0.2 + this.t * 2 + i) * 3)
            ctx.stroke()
          }
          break
        }
        case 'seed': {
          ctx.fillStyle = '#9b8a52'
          ctx.beginPath()
          ctx.ellipse(0, Math.sin(this.t) * 3, 4, 7, 0.3, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        default: {
          ctx.fillStyle = `rgba(255,255,220,${0.4 + pulse * 0.6})`
          ctx.beginPath()
          ctx.moveTo(0, -6)
          ctx.lineTo(1.5, -1.5)
          ctx.lineTo(6, 0)
          ctx.lineTo(1.5, 1.5)
          ctx.lineTo(0, 6)
          ctx.lineTo(-1.5, 1.5)
          ctx.lineTo(-6, 0)
          ctx.lineTo(-1.5, -1.5)
          ctx.fill()
        }
      }
      ctx.restore()
    }
  }

  private drawTerritories(engine: Engine) {
    const ctx = this.ctx
    const sel = engine.ui.selectedId
    for (const [pid, owner] of Object.entries(engine.world.territories)) {
      const pl = engine.placeById(pid)
      if (!pl) continue
      const strong = owner === sel
      ctx.save()
      ctx.setLineDash([6, 8])
      ctx.lineDashOffset = -this.t * 8
      ctx.strokeStyle = strong ? 'rgba(255,170,90,0.6)' : 'rgba(255,170,90,0.14)'
      ctx.lineWidth = strong ? 1.5 : 1
      ctx.beginPath()
      ctx.arc(pl.x, pl.y, pl.r * 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  private drawFood(engine: Engine) {
    const ctx = this.ctx
    for (const f of engine.world.food) {
      ctx.fillStyle = f.settledAt ? '#7a5a34' : '#c98a4a'
      ctx.beginPath()
      ctx.arc(f.x, f.y, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawLinks(engine: Engine, f: Fish, z: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.lineWidth = 1 / z
    const s = engine.schoolById(f.schoolId)
    if (s) {
      ctx.strokeStyle = `hsla(${s.hue},80%,65%,0.28)`
      ctx.beginPath()
      for (const id of s.members) {
        const m = engine.byId.get(id)
        if (!m || m === f) continue
        ctx.moveTo(f.pos.x, f.pos.y)
        ctx.lineTo(m.pos.x, m.pos.y)
      }
      ctx.stroke()
    }
    const focus = f.focusId ? engine.byId.get(f.focusId) : null
    if (focus) {
      ctx.setLineDash([4 / z, 4 / z])
      ctx.strokeStyle = f.action === 'CHASE' || f.action === 'FLEE' ? 'rgba(255,120,100,0.7)' : 'rgba(120,230,255,0.6)'
      ctx.beginPath()
      ctx.moveTo(f.pos.x, f.pos.y)
      ctx.lineTo(focus.pos.x, focus.pos.y)
      ctx.stroke()
    } else if (f.target) {
      ctx.setLineDash([2 / z, 5 / z])
      ctx.strokeStyle = 'rgba(120,230,255,0.35)'
      ctx.beginPath()
      ctx.moveTo(f.pos.x, f.pos.y)
      ctx.lineTo(f.target.x, f.target.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(f.target.x, f.target.y, 4 / z, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawBubbles() {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(200,245,255,0.5)'
    ctx.fillStyle = 'rgba(200,245,255,0.08)'
    ctx.lineWidth = 0.8
    for (const b of this.bubbles) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    for (const s of this.splashes) {
      const k = s.t / 1.6
      ctx.strokeStyle = `rgba(200,245,255,${0.6 * (1 - k)})`
      ctx.beginPath()
      ctx.ellipse(s.x, SURFACE_Y, 10 + k * 70, 3 + k * 6, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  private drawMotes(light: number) {
    const ctx = this.ctx
    for (const m of this.motes) {
      ctx.fillStyle = `rgba(190,230,220,${0.1 + m.z * 0.18 * (0.4 + light * 0.6)})`
      ctx.fillRect(m.x, m.y, m.z * 1.6, m.z * 1.6)
    }
  }

  private drawSurface(light: number) {
    const ctx = this.ctx
    // air above the water
    ctx.fillStyle = '#071019'
    ctx.fillRect(0, 0, TANK_W, SURFACE_Y - 2)
    const t = this.reducedMotion ? 0 : this.t
    ctx.strokeStyle = `rgba(180,240,255,${0.25 + light * 0.35})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let x = 0; x <= TANK_W; x += 12) {
      const y = SURFACE_Y + Math.sin(x * 0.02 + t * 1.3) * 1.6 + Math.sin(x * 0.051 - t * 0.9) * 1.1
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    // caustic shimmer just under the surface
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(150,230,255,${0.05 * light})`
    ctx.lineWidth = 1
    for (let row = 0; row < 3; row++) {
      ctx.beginPath()
      for (let x = 0; x <= TANK_W; x += 16) {
        const y = SURFACE_Y + 10 + row * 12 + Math.sin(x * 0.03 + t * (0.8 + row * 0.3) + row) * 4
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  private drawRulers(z: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(120,220,235,0.35)'
    ctx.fillStyle = 'rgba(120,220,235,0.45)'
    ctx.lineWidth = 1 / z
    ctx.font = `${9 / z}px ui-monospace, monospace`
    ctx.beginPath()
    for (let x = 0; x <= TANK_W; x += 50) {
      const major = x % 200 === 0
      ctx.moveTo(x, TANK_H)
      ctx.lineTo(x, TANK_H + (major ? 8 : 4) / z)
    }
    for (let y = 0; y <= TANK_H; y += 50) {
      const major = y % 200 === 0
      ctx.moveTo(0, y)
      ctx.lineTo(-(major ? 8 : 4) / z, y)
    }
    ctx.stroke()
    if (z > 0.35) {
      for (let x = 0; x <= TANK_W; x += 200) ctx.fillText(String(x), x + 2 / z, TANK_H + 16 / z)
      for (let y = 200; y <= TANK_H; y += 200) ctx.fillText(String(y), -30 / z, y + 3 / z)
    }
    ctx.restore()
  }

  private drawSelection(f: Fish, z: number) {
    const ctx = this.ctx
    const L = SPECIES[f.species].length * f.scale
    const r = Math.max(L * 0.75, 14 / z)
    const c = 6 / z
    ctx.save()
    ctx.strokeStyle = 'rgba(110,240,255,0.95)'
    ctx.lineWidth = 1.4 / z
    ctx.beginPath()
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const x = f.pos.x + sx * r
      const y = f.pos.y + sy * r * 0.8
      ctx.moveTo(x, y - sy * c)
      ctx.lineTo(x, y)
      ctx.lineTo(x - sx * c, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  private drawLabel(f: Fish, z: number, strong: boolean) {
    const ctx = this.ctx
    const L = SPECIES[f.species].length * f.scale
    const fs = (strong ? 11 : 9.5) / z
    ctx.save()
    ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`
    const text = strong ? `${f.name.toUpperCase()} · ${f.action.toLowerCase()}` : f.name.toLowerCase()
    const w = ctx.measureText(text).width
    const x = f.pos.x - w / 2
    const y = f.pos.y - Math.max(L * 0.7, 12 / z) - 6 / z
    ctx.fillStyle = 'rgba(3,10,16,0.7)'
    ctx.fillRect(x - 3 / z, y - fs, w + 6 / z, fs * 1.35)
    ctx.fillStyle = strong ? 'rgba(140,245,255,1)' : 'rgba(210,230,235,0.8)'
    ctx.fillText(text, x, y)
    ctx.restore()
  }
}

/* ------------------------------------------------------------------ */
/* plants (drawn every frame for sway)                                 */
/* ------------------------------------------------------------------ */

function drawPlant(ctx: CanvasRenderingContext2D, p: PlantDef, t: number, front: boolean) {
  const r = mulberry32(p.seed * 9973)
  const nFront = Math.round(p.blades * p.front)
  for (let i = 0; i < p.blades; i++) {
    const isFront = i >= p.blades - nFront
    const bx = p.x + (r() - 0.5) * (p.kind === 'moss' ? 50 : 60)
    const h = p.height * (0.55 + r() * 0.45)
    const lean = (r() - 0.5) * 0.5
    const ph = r() * 6
    const hueShift = (r() - 0.5) * 14
    const light = 22 + r() * 14
    if (isFront !== front) continue
    const sway = Math.sin(t * 0.55 + ph + p.x * 0.01) * 0.12 + Math.sin(t * 1.3 + ph) * 0.03
    const base = { x: bx, y: p.baseY + 4 }
    const tip = { x: bx + Math.sin(lean + sway) * h, y: base.y - Math.cos(lean + sway) * h }
    const ctrl = { x: bx + Math.sin(lean + sway * 0.4) * h * 0.5, y: base.y - h * 0.55 }
    const color = `hsla(${p.hue + hueShift},${p.kind === 'weed' ? 55 : 45}%,${light}%,${front ? 0.92 : 0.85})`
    const dark = `hsla(${p.hue + hueShift},40%,${light - 10}%,0.9)`
    switch (p.kind) {
      case 'grass': {
        ctx.strokeStyle = color
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(base.x, base.y)
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y)
        ctx.stroke()
        ctx.strokeStyle = dark
        ctx.lineWidth = 1
        ctx.stroke()
        break
      }
      case 'fern': {
        ctx.strokeStyle = dark
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(base.x, base.y)
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y)
        ctx.stroke()
        ctx.fillStyle = color
        const n = Math.floor(h / 18)
        for (let k = 1; k < n; k++) {
          const u = k / n
          const x = (1 - u) * (1 - u) * base.x + 2 * (1 - u) * u * ctrl.x + u * u * tip.x
          const y = (1 - u) * (1 - u) * base.y + 2 * (1 - u) * u * ctrl.y + u * u * tip.y
          const size = 13 * (1 - u * 0.6)
          for (const side of [-1, 1]) {
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(side * (0.9 + Math.sin(t + k) * 0.08) + sway)
            ctx.beginPath()
            ctx.ellipse(0, -size * 0.5, size * 0.28, size * 0.6, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
        }
        break
      }
      case 'weed': {
        ctx.strokeStyle = dark
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(base.x, base.y)
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y)
        ctx.stroke()
        ctx.fillStyle = color
        const n = Math.floor(h / 10)
        for (let k = 1; k <= n; k++) {
          const u = k / n
          const x = (1 - u) * (1 - u) * base.x + 2 * (1 - u) * u * ctrl.x + u * u * tip.x
          const y = (1 - u) * (1 - u) * base.y + 2 * (1 - u) * u * ctrl.y + u * u * tip.y
          ctx.beginPath()
          ctx.arc(x + Math.sin(k * 2.3) * 5, y, 4.5 * (1 - u * 0.4), 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }
      case 'moss': {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(bx, p.baseY - h * 0.2, h * 0.28, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = dark
        ctx.beginPath()
        ctx.arc(bx + 4, p.baseY - h * 0.15, h * 0.18, 0, Math.PI * 2)
        ctx.fill()
        break
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* static background, rendered once                                    */
/* ------------------------------------------------------------------ */

function rockPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number, flatBottom = true) {
  const r = mulberry32(seed)
  ctx.beginPath()
  const n = 22
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI
    const k = 0.82 + r() * 0.22
    const x = cx + Math.cos(a) * rx * k
    const y = cy + Math.sin(a) * ry * k
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  if (flatBottom) {
    ctx.lineTo(cx + rx, cy + 30)
    ctx.lineTo(cx - rx, cy + 30)
  }
  ctx.closePath()
}

function buildBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = TANK_W * BG_SCALE
  c.height = TANK_H * BG_SCALE
  const ctx = c.getContext('2d')!
  ctx.scale(BG_SCALE, BG_SCALE)
  const r = mulberry32(42)

  // water column
  const wg = ctx.createLinearGradient(0, 0, 0, TANK_H)
  wg.addColorStop(0, '#0d3d4c')
  wg.addColorStop(0.35, '#0a2e3c')
  wg.addColorStop(0.75, '#06202b')
  wg.addColorStop(1, '#041820')
  ctx.fillStyle = wg
  ctx.fillRect(0, 0, TANK_W, TANK_H)
  // side falloff (back wall depth)
  const sg = ctx.createLinearGradient(0, 0, TANK_W, 0)
  sg.addColorStop(0, 'rgba(0,8,14,0.45)')
  sg.addColorStop(0.2, 'rgba(0,8,14,0)')
  sg.addColorStop(0.8, 'rgba(0,8,14,0)')
  sg.addColorStop(1, 'rgba(0,8,14,0.45)')
  ctx.fillStyle = sg
  ctx.fillRect(0, 0, TANK_W, TANK_H)

  // distant silhouettes for depth
  ctx.fillStyle = 'rgba(6,40,46,0.55)'
  for (let i = 0; i < 9; i++) {
    const x = r() * TANK_W
    rockPath(ctx, x, sandY(x) - 10, 60 + r() * 120, 40 + r() * 90, 100 + i)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(20,70,60,0.45)'
  ctx.lineWidth = 3
  for (let i = 0; i < 40; i++) {
    const x = r() * TANK_W
    const h = 60 + r() * 220
    ctx.beginPath()
    ctx.moveTo(x, sandY(x))
    ctx.quadraticCurveTo(x + (r() - 0.5) * 40, sandY(x) - h / 2, x + (r() - 0.5) * 60, sandY(x) - h)
    ctx.stroke()
  }

  // filter (behind substrate objects)
  const fx = 1745
  const tg = ctx.createLinearGradient(fx - 28, 0, fx + 28, 0)
  tg.addColorStop(0, 'rgba(120,150,150,0.25)')
  tg.addColorStop(0.5, 'rgba(180,210,210,0.35)')
  tg.addColorStop(1, 'rgba(90,120,120,0.25)')
  ctx.fillStyle = tg
  ctx.fillRect(fx - 26, 0, 52, 640)
  ctx.strokeStyle = 'rgba(190,230,230,0.35)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(fx - 26, 0, 52, 640)
  ctx.fillStyle = 'rgba(20,30,32,0.8)'
  for (let y = 560; y < 630; y += 8) ctx.fillRect(fx - 18, y, 36, 3)
  ctx.fillStyle = 'rgba(60,80,84,0.9)'
  ctx.fillRect(fx - 40, 0, 80, SURFACE_Y + 18)
  ctx.fillStyle = 'rgba(160,200,205,0.6)'
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillText('FLT-02', fx - 18, SURFACE_Y + 12)

  // substrate
  ctx.beginPath()
  ctx.moveTo(0, TANK_H)
  for (let x = 0; x <= TANK_W; x += 6) ctx.lineTo(x, sandY(x))
  ctx.lineTo(TANK_W, TANK_H)
  ctx.closePath()
  const sandG = ctx.createLinearGradient(0, 790, 0, TANK_H)
  sandG.addColorStop(0, '#6b5d45')
  sandG.addColorStop(0.3, '#4b4232')
  sandG.addColorStop(1, '#1d1a14')
  ctx.fillStyle = sandG
  ctx.fill()
  for (let i = 0; i < 2600; i++) {
    const x = r() * TANK_W
    const y = sandY(x) + 2 + r() * (TANK_H - sandY(x))
    const l = 30 + r() * 45
    ctx.fillStyle = `hsla(${30 + r() * 20},${15 + r() * 20}%,${l}%,${0.25 + r() * 0.35})`
    ctx.fillRect(x, y, 1 + r() * 2.2, 1 + r() * 1.6)
  }
  // pebbles along the top of the sand
  for (let i = 0; i < 140; i++) {
    const x = r() * TANK_W
    const y = sandY(x) + 3 + r() * 12
    ctx.fillStyle = `hsla(${20 + r() * 30},${8 + r() * 15}%,${25 + r() * 30}%,0.9)`
    ctx.beginPath()
    ctx.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // old rock
  const rockG = ctx.createLinearGradient(0, 720, 0, 860)
  rockG.addColorStop(0, '#62707a')
  rockG.addColorStop(1, '#2a3238')
  ctx.fillStyle = rockG
  rockPath(ctx, 545, 842, 110, 120, 5)
  ctx.fill()
  ctx.fillStyle = 'rgba(160,190,200,0.12)'
  rockPath(ctx, 530, 830, 70, 90, 6, false)
  ctx.fill()
  ctx.fillStyle = 'rgba(70,120,80,0.35)'
  for (let i = 0; i < 30; i++) {
    ctx.beginPath()
    ctx.arc(470 + r() * 150, 740 + r() * 40, 2 + r() * 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // cave mound
  const caveG = ctx.createLinearGradient(0, 640, 0, 860)
  caveG.addColorStop(0, '#56605f')
  caveG.addColorStop(1, '#22282a')
  ctx.fillStyle = caveG
  rockPath(ctx, 1430, 842, 175, 190, 11)
  ctx.fill()
  ctx.fillStyle = 'rgba(150,180,175,0.1)'
  rockPath(ctx, 1400, 830, 110, 140, 12, false)
  ctx.fill()
  const mouth = ctx.createRadialGradient(1430, 800, 4, 1430, 800, 60)
  mouth.addColorStop(0, '#000000')
  mouth.addColorStop(0.7, '#03070a')
  mouth.addColorStop(1, 'rgba(3,7,10,0)')
  ctx.fillStyle = mouth
  ctx.beginPath()
  ctx.ellipse(1430, 805, 52, 42, 0, Math.PI, 0)
  ctx.lineTo(1482, 830)
  ctx.lineTo(1378, 830)
  ctx.fill()

  // clay pot on its side, opening to the right
  ctx.save()
  ctx.translate(380, 818)
  const potG = ctx.createLinearGradient(0, -34, 0, 34)
  potG.addColorStop(0, '#9b5a3a')
  potG.addColorStop(1, '#5a2f1e')
  ctx.fillStyle = potG
  ctx.beginPath()
  ctx.ellipse(-8, 0, 46, 32, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#7a4128'
  ctx.beginPath()
  ctx.ellipse(34, 0, 12, 30, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0a0705'
  ctx.beginPath()
  ctx.ellipse(36, 0, 8, 24, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,200,160,0.15)'
  ctx.beginPath()
  ctx.ellipse(-8, -6, 38, 20, 0, Math.PI * 1.1, Math.PI * 1.7)
  ctx.stroke()
  ctx.restore()

  // driftwood
  ctx.lineCap = 'round'
  const dw = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, w: number) => {
    ctx.strokeStyle = '#3b2a1c'
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo(cx, cy, x2, y2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(160,120,80,0.25)'
    ctx.lineWidth = w * 0.25
    ctx.stroke()
  }
  dw(840, 840, 960, 790, 1110, 712, 26)
  dw(960, 790, 990, 730, 1010, 660, 11)
  dw(1050, 735, 1090, 700, 1150, 690, 8)
  ctx.strokeStyle = 'rgba(20,12,6,0.6)'
  ctx.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const u = i / 14
    const x = 850 + u * 250
    const y = 835 - u * 118
    ctx.beginPath()
    ctx.moveTo(x, y - 6)
    ctx.lineTo(x + 18, y - 12)
    ctx.stroke()
  }

  // bubble stone
  ctx.fillStyle = '#3d4446'
  ctx.beginPath()
  ctx.ellipse(780, 822, 16, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(200,220,220,0.2)'
  ctx.beginPath()
  ctx.ellipse(778, 819, 9, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // place markers: tiny technical labels near each landmark
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(140,220,230,0.22)'
  for (const p of STATIC_PLACES) {
    if (p.kind === 'surface') continue
    ctx.fillText(`·${p.id.toUpperCase()}`, p.x - 20, Math.min(p.y + p.r * 0.2, sandY(p.x) + 40) + 70)
  }
  return c
}
