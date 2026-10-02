import type { Engine } from '@/simulation/engine'
import type { Fish } from '@/types/fish'
import type { Place } from '@/types/simulation'
import { BUBBLE_SOURCES, PLANTS, STATIC_PLACES, SURFACE_Y, TANK_H, TANK_W, sandY, type PlantDef } from '@/simulation/environment'
import { buyPressure, type MarketMood } from '@/simulation/market'
import { CHAR_W, FONT, LINE_H, MONO, artSize, fishArt } from './asciiFish'
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
}

interface Splash {
  x: number
  t: number
}

interface Glyph {
  x: number
  y: number
  ch: string
}

const BG = '#040b12'
const INK = '#5ef2ff'

const MOOD_TINT: Record<MarketMood, { surface: string; wash: string | null }> = {
  euphoric: { surface: '#7dffb0', wash: 'rgba(60,255,150,0.07)' },
  bullish: { surface: '#8af5c4', wash: 'rgba(60,255,150,0.035)' },
  calm: { surface: INK, wash: null },
  bearish: { surface: '#ff9a8a', wash: 'rgba(255,70,60,0.04)' },
  panic: { surface: '#ff6b5b', wash: 'rgba(255,50,40,0.06)' },
}

/**
 * Draws the tank as text: every fish, plant, rock and bubble is a monospace
 * glyph placed in world space, so it stays crisp at any zoom.
 */
export class AquariumRenderer {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private staticGlyphs: Map<string, Glyph[]> | null = null
  private scanlines: CanvasPattern | null = null
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
    for (let i = 0; i < 70; i++) {
      this.motes.push({ x: r() * TANK_W, y: SURFACE_Y + 30 + r() * (TANK_H - SURFACE_Y - 140), z: 0.3 + r() * 0.7, vx: (r() - 0.5) * 6 })
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
    // buying pressure on the token makes the bubble stone roar
    const boost = 1 + buyPressure(engine.market) * 4
    for (const s of BUBBLE_SOURCES) {
      if (Math.random() < dt * 4 * motion * boost && this.bubbles.length < 120) {
        this.bubbles.push({ x: s.x + (Math.random() - 0.5) * 8, y: s.y, r: 1 + Math.random() * 3, vy: 40 + Math.random() * 40, wob: Math.random() * 6 })
      }
    }
    for (const f of engine.world.fish) {
      if (Math.random() < dt * 0.03 && this.bubbles.length < 120) {
        this.bubbles.push({ x: f.pos.x, y: f.pos.y - 8, r: 0.8 + Math.random() * 1.2, vy: 25 + Math.random() * 20, wob: Math.random() * 6 })
      }
      if (f.enteringUntil > 0 && !this.seenEntering.has(f.id)) {
        this.seenEntering.add(f.id)
        this.splashes.push({ x: f.pos.x, t: 0 })
        for (let i = 0; i < 14; i++) {
          this.bubbles.push({ x: f.pos.x + (Math.random() - 0.5) * 40, y: SURFACE_Y + 20 + Math.random() * 80, r: 1 + Math.random() * 3, vy: 30 + Math.random() * 50, wob: Math.random() * 6 })
        }
      }
    }
    for (const b of this.bubbles) {
      b.y -= b.vy * dt
      b.x += Math.sin(this.t * 3 + b.wob) * 10 * dt
    }
    this.bubbles = this.bubbles.filter((b) => b.y > SURFACE_Y + 6)
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.t * 0.2 + m.y * 0.01) * 3) * dt * motion
      if (m.x < 0) m.x += TANK_W
      if (m.x > TANK_W) m.x -= TANK_W
    }
    for (const s of this.splashes) s.t += dt
    this.splashes = this.splashes.filter((s) => s.t < 1.6)
  }

  /* -------------------------------------------------------------- */

  draw(engine: Engine, cam: Camera, opts: { hoverId: string | null; showNames: boolean }) {
    const ctx = this.ctx
    const { dpr } = this
    const light = engine.light
    if (!this.staticGlyphs) this.staticGlyphs = buildStaticGlyphs()
    const tint = MOOD_TINT[engine.marketMood]

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#03070b'
    ctx.fillRect(0, 0, this.w, this.h)

    ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (this.w / 2 - cam.x * cam.zoom), dpr * (this.h / 2 - cam.y * cam.zoom))
    const z = cam.zoom

    // monitor grid outside the tank
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
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, TANK_W, TANK_H)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${FONT}px ${MONO}`

    this.drawMotes(light)
    this.drawPlants(false)
    this.drawGlyphs(this.staticGlyphs)
    this.drawCuriosities(engine.world.curiosities)
    this.drawTerritories(engine)
    this.drawFood(engine)

    const sel = engine.ui.selectedId
    const selFish = sel ? engine.byId.get(sel) : undefined
    if (selFish) this.drawLinks(engine, selFish, z)

    ctx.font = `${FONT}px ${MONO}`
    for (const f of engine.world.fish) {
      const sheltered = (f.action === 'HIDE' || f.action === 'REST') && engine.rt(f).arrived && f.target?.kind === 'place'
      this.drawFish(f, sheltered ? 0.45 : 1)
    }

    this.drawPlants(true)
    this.drawBubbles()
    this.drawSurface(tint.surface, light)

    if (tint.wash) {
      ctx.fillStyle = tint.wash
      ctx.fillRect(0, 0, TANK_W, TANK_H)
    }
    if (light < 1) {
      ctx.fillStyle = `rgba(2,5,14,${(1 - light) * 0.6})`
      ctx.fillRect(0, 0, TANK_W, TANK_H)
    }
    ctx.restore()

    // glass edge & rulers
    ctx.strokeStyle = 'rgba(94,242,255,0.3)'
    ctx.lineWidth = 1.5 / z
    ctx.strokeRect(0, 0, TANK_W, TANK_H)
    this.drawRulers(z)

    for (const f of engine.world.fish) {
      const isSel = f.id === sel
      const isHover = f.id === opts.hoverId
      if (isSel) this.drawSelection(f)
      if (isSel || isHover || opts.showNames) this.drawLabel(f, z, isSel || isHover)
    }

    // screen-space: scanlines and vignette for a phosphor-monitor feel
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (!this.scanlines) this.scanlines = makeScanlines(ctx)
    if (this.scanlines) {
      ctx.fillStyle = this.scanlines
      ctx.fillRect(0, 0, this.w, this.h)
    }
    const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.4)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, this.w, this.h)
  }

  private drawGlyphs(groups: Map<string, Glyph[]>) {
    const ctx = this.ctx
    for (const [key, glyphs] of groups) {
      // keys prefixed "label|" are small annotations rather than scenery
      const label = key.startsWith('label|')
      ctx.fillStyle = label ? key.slice(6) : key
      if (label) ctx.font = `${FONT * 0.5}px ${MONO}`
      for (const g of glyphs) ctx.fillText(g.ch, g.x, g.y)
      if (label) ctx.font = `${FONT}px ${MONO}`
    }
  }

  private drawFish(f: Fish, alpha: number) {
    const ctx = this.ctx
    const left = Math.cos(f.heading) < 0
    const frame = Math.sin(f.phase) > 0 ? 0 : 1
    const lines = fishArt(f.species, left, frame, f.action)
    const y0 = f.pos.y - ((lines.length - 1) * LINE_H) / 2
    ctx.globalAlpha = alpha
    ctx.fillStyle = f.color
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], f.pos.x, y0 + i * LINE_H)
    if (f.action === 'REST') {
      // a little "z" drifting up from sleeping fish
      const k = (this.t * 0.5 + f.phase * 0.1) % 1
      ctx.globalAlpha = alpha * (1 - k) * 0.8
      ctx.fillStyle = '#8aa5ac'
      ctx.fillText(k < 0.5 ? 'z' : 'Z', f.pos.x + (left ? -1 : 1) * (CHAR_W * 2 + k * 10), y0 - LINE_H * (0.4 + k))
    }
    ctx.globalAlpha = 1
  }

  private drawPlants(front: boolean) {
    const t = this.reducedMotion ? this.t * 0.25 : this.t
    for (const p of PLANTS) drawPlant(this.ctx, p, t, front)
  }

  private drawCuriosities(list: Place[]) {
    const ctx = this.ctx
    const glyph: Record<string, string> = { shell: '@', pebble: 'o', marble: 'O', leaf: '%', current: '≈≈≈', glint: '*', seed: '§' }
    for (const c of list) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 2 + c.x)
      ctx.fillStyle = `rgba(255,236,170,${0.45 + pulse * 0.55})`
      const dy = c.variant === 'seed' || c.variant === 'current' ? Math.sin(this.t + c.x) * 4 : 0
      ctx.fillText(glyph[c.variant ?? 'glint'] ?? '*', c.x, c.y + dy)
    }
  }

  private drawTerritories(engine: Engine) {
    const ctx = this.ctx
    const sel = engine.ui.selectedId
    for (const [pid, owner] of Object.entries(engine.world.territories)) {
      const pl = engine.placeById(pid)
      const o = engine.byId.get(owner)
      if (!pl || !o) continue
      const strong = owner === sel
      ctx.save()
      ctx.setLineDash([4, 10])
      ctx.lineDashOffset = -this.t * 8
      ctx.strokeStyle = strong ? 'rgba(255,184,103,0.7)' : 'rgba(255,184,103,0.18)'
      ctx.lineWidth = strong ? 1.5 : 1
      ctx.beginPath()
      ctx.arc(pl.x, pl.y, pl.r * 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.font = `${FONT * 0.6}px ${MONO}`
      ctx.fillStyle = strong ? 'rgba(255,184,103,0.9)' : 'rgba(255,184,103,0.35)'
      ctx.fillText(`[${o.name.toLowerCase()}]`, pl.x, pl.y - pl.r * 2 - 8)
      ctx.restore()
    }
  }

  private drawFood(engine: Engine) {
    const ctx = this.ctx
    for (const f of engine.world.food) {
      ctx.fillStyle = f.settledAt ? '#8a6a3a' : '#ffb867'
      ctx.fillText(f.settledAt ? '.' : '*', f.x, f.y)
    }
  }

  private drawLinks(engine: Engine, f: Fish, z: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.lineWidth = 1 / z
    const s = engine.schoolById(f.schoolId)
    if (s) {
      ctx.setLineDash([2 / z, 6 / z])
      ctx.strokeStyle = `hsla(${s.hue},80%,65%,0.35)`
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
      ctx.strokeStyle = f.action === 'CHASE' || f.action === 'FLEE' ? 'rgba(255,120,100,0.7)' : 'rgba(94,242,255,0.6)'
      ctx.beginPath()
      ctx.moveTo(f.pos.x, f.pos.y)
      ctx.lineTo(focus.pos.x, focus.pos.y)
      ctx.stroke()
    } else if (f.target) {
      ctx.setLineDash([2 / z, 5 / z])
      ctx.strokeStyle = 'rgba(94,242,255,0.35)'
      ctx.beginPath()
      ctx.moveTo(f.pos.x, f.pos.y)
      ctx.lineTo(f.target.x, f.target.y)
      ctx.stroke()
      ctx.fillStyle = 'rgba(94,242,255,0.7)'
      ctx.fillText('x', f.target.x, f.target.y)
    }
    ctx.restore()
  }

  private drawBubbles() {
    const ctx = this.ctx
    ctx.font = `${FONT * 0.6}px ${MONO}`
    ctx.fillStyle = 'rgba(190,240,255,0.5)'
    for (const b of this.bubbles) ctx.fillText(b.r < 1.6 ? '.' : b.r < 2.6 ? 'o' : 'O', b.x, b.y)
    ctx.font = `${FONT}px ${MONO}`
    for (const s of this.splashes) {
      const k = s.t / 1.6
      ctx.fillStyle = `rgba(190,240,255,${0.8 * (1 - k)})`
      const spread = 10 + k * 70
      ctx.fillText('\\', s.x - spread * 0.5, SURFACE_Y - 6 - k * 10)
      ctx.fillText('/', s.x + spread * 0.5, SURFACE_Y - 6 - k * 10)
      ctx.fillText('* . *', s.x, SURFACE_Y - 14 - k * 20)
    }
  }

  private drawMotes(light: number) {
    const ctx = this.ctx
    for (const m of this.motes) {
      ctx.fillStyle = `rgba(120,200,210,${(0.08 + m.z * 0.14) * (0.5 + light * 0.5)})`
      ctx.fillText('·', m.x, m.y)
    }
  }

  private drawSurface(color: string, light: number) {
    const ctx = this.ctx
    const t = this.reducedMotion ? 0 : this.t
    ctx.fillStyle = '#03070b'
    ctx.fillRect(0, 0, TANK_W, SURFACE_Y - 10)
    ctx.globalAlpha = 0.55 + light * 0.4
    ctx.fillStyle = color
    const cols = Math.ceil(TANK_W / CHAR_W)
    let row = ''
    for (let c = 0; c < cols; c++) {
      const v = Math.sin(c * 0.45 + t * 1.6) + Math.sin(c * 0.13 - t * 0.7) * 0.6
      row += v > 0.5 ? '~' : v > -0.4 ? '-' : '_'
    }
    ctx.textAlign = 'left'
    ctx.fillText(row, 0, SURFACE_Y)
    ctx.textAlign = 'center'
    ctx.globalAlpha = 1
  }

  private drawRulers(z: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(94,242,255,0.35)'
    ctx.fillStyle = 'rgba(94,242,255,0.45)'
    ctx.lineWidth = 1 / z
    ctx.font = `${9 / z}px ${MONO}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.beginPath()
    for (let x = 0; x <= TANK_W; x += 50) {
      ctx.moveTo(x, TANK_H)
      ctx.lineTo(x, TANK_H + (x % 200 === 0 ? 8 : 4) / z)
    }
    for (let y = 0; y <= TANK_H; y += 50) {
      ctx.moveTo(0, y)
      ctx.lineTo(-(y % 200 === 0 ? 8 : 4) / z, y)
    }
    ctx.stroke()
    if (z > 0.35) {
      for (let x = 0; x < TANK_W; x += 200) ctx.fillText(String(x), x + 2 / z, TANK_H + 16 / z)
      for (let y = 200; y <= TANK_H; y += 200) ctx.fillText(String(y), -30 / z, y + 3 / z)
    }
    ctx.restore()
  }

  private drawSelection(f: Fish) {
    const ctx = this.ctx
    const { cols, rows } = artSize(f.species)
    const half = (cols * CHAR_W) / 2 + CHAR_W * 0.9
    ctx.save()
    ctx.font = `${FONT * (rows > 1 ? 2.4 : 1.2)}px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK
    ctx.globalAlpha = 0.7 + Math.sin(this.t * 4) * 0.3
    ctx.fillText('[', f.pos.x - half, f.pos.y)
    ctx.fillText(']', f.pos.x + half, f.pos.y)
    ctx.restore()
  }

  private drawLabel(f: Fish, z: number, strong: boolean) {
    const ctx = this.ctx
    const { rows } = artSize(f.species)
    const fs = (strong ? 11 : 9.5) / z
    ctx.save()
    ctx.font = `${fs}px ${MONO}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    const text = strong ? `${f.name.toUpperCase()} · ${f.action.toLowerCase()}` : f.name.toLowerCase()
    const w = ctx.measureText(text).width
    const x = f.pos.x - w / 2
    const y = f.pos.y - (rows * LINE_H) / 2 - 4 / z
    ctx.fillStyle = 'rgba(3,10,16,0.75)'
    ctx.fillRect(x - 3 / z, y - fs, w + 6 / z, fs * 1.35)
    ctx.fillStyle = strong ? INK : 'rgba(210,230,235,0.8)'
    ctx.fillText(text, x, y)
    ctx.restore()
  }
}

/* ------------------------------------------------------------------ */
/* plants: columns of glyphs that sway                                 */
/* ------------------------------------------------------------------ */

function drawPlant(ctx: CanvasRenderingContext2D, p: PlantDef, t: number, front: boolean) {
  const r = mulberry32(p.seed * 9973)
  const nFront = Math.round(p.blades * p.front)
  for (let i = 0; i < p.blades; i++) {
    const isFront = i >= p.blades - nFront
    const bx = p.x + (r() - 0.5) * (p.kind === 'moss' ? 50 : 70)
    const h = p.height * (0.55 + r() * 0.45)
    const lean = (r() - 0.5) * 0.5
    const ph = r() * 6
    const l = 30 + r() * 18
    if (isFront !== front) continue
    const sway = Math.sin(t * 0.55 + ph + p.x * 0.01) * 0.14 + Math.sin(t * 1.3 + ph) * 0.03
    const color = p.kind === 'weed' ? `hsl(${p.hue},60%,${l + 8}%)` : `hsl(${p.hue},55%,${l}%)`
    ctx.fillStyle = color
    if (p.kind === 'moss') {
      ctx.fillText('@@', bx, p.baseY - 6)
      ctx.fillText('(@)', bx, p.baseY - 6 - LINE_H * 0.8)
      continue
    }
    const n = Math.max(2, Math.round(h / LINE_H))
    let px = bx
    for (let k = 0; k < n; k++) {
      const u = (k + 1) / n
      const bend = Math.sin(lean + sway * u) * h * u * u
      const x = bx + bend
      const y = p.baseY - 4 - k * LINE_H
      const dx = x - px
      px = x
      let ch: string
      if (dx > CHAR_W * 0.3) ch = '/'
      else if (dx < -CHAR_W * 0.3) ch = '\\'
      else if (p.kind === 'fern') ch = k % 2 ? '}' : '{'
      else if (p.kind === 'weed') ch = k % 2 ? ')' : '('
      else ch = k === n - 1 ? "'" : '|'
      ctx.fillText(ch, x, y)
      // fern leaflets
      if (p.kind === 'fern' && k > 0 && k < n - 1) {
        ctx.fillText(',', x - CHAR_W * 0.8, y + 4)
        ctx.fillText('`', x + CHAR_W * 0.8, y + 2)
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* static scenery: computed once on a character grid                   */
/* ------------------------------------------------------------------ */

function rockPath(cx: number, cy: number, rx: number, ry: number, seed: number): Path2D {
  const r = mulberry32(seed)
  const p = new Path2D()
  const n = 22
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI
    const k = 0.82 + r() * 0.22
    const x = cx + Math.cos(a) * rx * k
    const y = cy + Math.sin(a) * ry * k
    if (i === 0) p.moveTo(x, y)
    else p.lineTo(x, y)
  }
  p.lineTo(cx + rx, cy + 40)
  p.lineTo(cx - rx, cy + 40)
  p.closePath()
  return p
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

function buildStaticGlyphs(): Map<string, Glyph[]> {
  const out = new Map<string, Glyph[]>()
  const put = (color: string, x: number, y: number, ch: string) => {
    let a = out.get(color)
    if (!a) out.set(color, (a = []))
    a.push({ x, y, ch })
  }
  const hit = document.createElement('canvas').getContext('2d')!
  const rock = rockPath(545, 842, 110, 120, 5)
  const cave = rockPath(1430, 842, 175, 190, 11)
  const r = mulberry32(42)
  const cols = Math.ceil(TANK_W / CHAR_W)
  const rows = Math.ceil(TANK_H / LINE_H)
  const wood = [
    [840, 840, 1110, 712, 13],
    [960, 790, 1010, 660, 6],
    [1050, 735, 1150, 690, 5],
  ]
  const sandTop = new Array<boolean>(cols).fill(false)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * CHAR_W + CHAR_W / 2
      const y = row * LINE_H + LINE_H / 2
      if (y < SURFACE_Y + 10) continue
      const rnd = r()
      // filter tube on the right wall
      if (x > 1719 && x < 1771 && y < 640) {
        const edge = x < 1732 || x > 1758
        put(edge ? 'rgba(160,200,205,0.55)' : 'rgba(160,200,205,0.18)', x, y, y > 560 ? '≡' : edge ? '║' : ':')
        continue
      }
      // clay pot lying on its side, mouth to the right
      const potD = ((x - 372) / 50) ** 2 + ((y - 818) / 34) ** 2
      if (potD < 1) {
        const mouth = x > 405
        put(mouth ? 'hsl(18,40%,30%)' : 'hsl(18,60%,48%)', x, y, mouth ? ')' : rnd < 0.5 ? '=' : '-')
        continue
      }
      // cave: mound of rock with a dark mouth
      if (hit.isPointInPath(cave, x, y)) {
        const mouth = ((x - 1430) / 56) ** 2 + ((y - 815) / 46) ** 2 < 1
        if (mouth) continue
        const edge = !hit.isPointInPath(cave, x, y - LINE_H)
        put(edge ? 'hsl(190,10%,62%)' : 'hsl(190,8%,40%)', x, y, edge ? (x < 1430 ? '/' : '\\') : rnd < 0.7 ? '#' : rnd < 0.85 ? '%' : '&')
        continue
      }
      if (hit.isPointInPath(rock, x, y)) {
        const edge = !hit.isPointInPath(rock, x, y - LINE_H)
        put(edge ? 'hsl(200,12%,66%)' : 'hsl(200,10%,44%)', x, y, edge ? '^' : rnd < 0.6 ? '#' : rnd < 0.8 ? '%' : '@')
        continue
      }
      // driftwood
      let onWood = false
      for (const [ax, ay, bx, by, wdt] of wood) {
        if (segDist(x, y, ax, ay, bx, by) < wdt + 4) {
          const slope = (by - ay) / (bx - ax)
          put('hsl(28,40%,40%)', x, y, slope < -0.6 ? '/' : slope < -0.15 ? (rnd < 0.5 ? '/' : '_') : '=')
          onWood = true
          break
        }
      }
      if (onWood) continue
      // bubble stone
      if (Math.abs(x - 780) < 20 && Math.abs(y - 822) < 12) {
        put('hsl(200,8%,55%)', x, y, x < 772 ? '(' : x > 788 ? ')' : 'o')
        continue
      }
      // substrate
      if (y > sandY(x) - 4) {
        const top = !sandTop[col]
        sandTop[col] = true
        const l = top ? 52 : 26 + rnd * 18
        const ch = top ? (rnd < 0.5 ? '_' : '.') : rnd < 0.35 ? '.' : rnd < 0.6 ? ',' : rnd < 0.8 ? ':' : rnd < 0.9 ? "'" : ' '
        if (ch !== ' ') put(`hsl(38,${top ? 35 : 22}%,${l | 0}%)`, x, y, ch)
      }
    }
  }
  // small technical labels under landmarks
  for (const p of STATIC_PLACES) {
    if (p.kind === 'surface' || p.kind === 'plant') continue
    put('label|rgba(94,242,255,0.35)', p.x, Math.min(p.y + 70, TANK_H - 14), `·${p.id.toUpperCase()}`)
  }
  put('label|rgba(160,200,205,0.7)', 1745, SURFACE_Y + 28, 'FLT-02')
  return out
}

function makeScanlines(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 3
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(0,0,0,0.22)'
  g.fillRect(0, 2, 1, 1)
  return ctx.createPattern(c, 'repeat')
}
