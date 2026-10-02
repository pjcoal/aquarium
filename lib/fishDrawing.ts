import type { SpeciesId } from '@/types/fish'
import { SPECIES } from '@/simulation/species'

export interface FishLook {
  species: SpeciesId
  color: string
  accent: string
  scale: number
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function shade(hex: string, k: number, a = 1): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k))
  return `rgba(${f(r)},${f(g)},${f(b)},${a})`
}

function bodyPath(ctx: CanvasRenderingContext2D, L: number, H: number, nose = 0.5, tailX = -0.38, pinch = 0.12) {
  ctx.beginPath()
  ctx.moveTo(L * nose, 0)
  ctx.bezierCurveTo(L * (nose - 0.06), -H * 0.58, -L * 0.08, -H * 0.62, L * tailX, -H * pinch)
  ctx.lineTo(L * tailX, H * pinch)
  ctx.bezierCurveTo(-L * 0.08, H * 0.62, L * (nose - 0.06), H * 0.58, L * nose, 0)
  ctx.closePath()
}

function eye(ctx: CanvasRenderingContext2D, L: number, H: number, x = 0.33) {
  const r = Math.max(1.1, H * 0.13)
  ctx.fillStyle = 'rgba(235,240,240,0.95)'
  ctx.beginPath()
  ctx.arc(L * x, -H * 0.1, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#05080a'
  ctx.beginPath()
  ctx.arc(L * x + r * 0.2, -H * 0.1, r * 0.6, 0, Math.PI * 2)
  ctx.fill()
}

function pectoral(ctx: CanvasRenderingContext2D, L: number, H: number, phase: number, color: string) {
  ctx.save()
  ctx.translate(L * 0.14, H * 0.18)
  ctx.rotate(0.5 + Math.sin(phase * 1.7) * 0.35)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(-L * 0.06, 0, L * 0.08, H * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** a simple forked/fan tail, rotated around the caudal peduncle */
function tail(ctx: CanvasRenderingContext2D, L: number, H: number, wave: number, len: number, spread: number, color: string, fork = 0.35, baseX = -0.36) {
  ctx.save()
  ctx.translate(L * baseX, 0)
  ctx.rotate(wave)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(L * 0.02, 0)
  ctx.quadraticCurveTo(-L * len * 0.5, -H * spread * 0.5, -L * len, -H * spread)
  ctx.quadraticCurveTo(-L * len * (1 - fork * 0.6), 0, -L * len, H * spread)
  ctx.quadraticCurveTo(-L * len * 0.5, H * spread * 0.5, L * 0.02, 0)
  ctx.fill()
  ctx.restore()
}

/**
 * Draws a fish in local space facing +x at (x, y). Heading flips the body so
 * the belly always faces down.
 */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  look: FishLook,
  x: number,
  y: number,
  heading: number,
  phase: number,
  alpha = 1,
): void {
  const sp = SPECIES[look.species]
  const L = sp.length * look.scale
  const H = L * sp.bodyRatio
  const wave = Math.sin(phase) * 0.32
  const c = look.color
  const a = look.accent
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(heading)
  if (Math.cos(heading) < 0) ctx.scale(1, -1)
  ctx.globalAlpha *= alpha

  switch (look.species) {
    case 'neon-tetra': {
      tail(ctx, L, H, wave, 0.24, 0.75, 'rgba(190,210,225,0.45)')
      bodyPath(ctx, L, H)
      const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2)
      g.addColorStop(0, '#5b7488')
      g.addColorStop(0.6, '#a9bccb')
      g.addColorStop(1, '#d9e3ea')
      ctx.fillStyle = g
      ctx.fill()
      ctx.save()
      ctx.clip()
      ctx.fillStyle = a
      ctx.fillRect(-L * 0.4, H * 0.02, L * 0.45, H * 0.6)
      ctx.restore()
      ctx.lineCap = 'round'
      ctx.strokeStyle = shade(c, 0, 0.35)
      ctx.lineWidth = H * 0.42
      ctx.beginPath()
      ctx.moveTo(L * 0.34, -H * 0.1)
      ctx.lineTo(-L * 0.3, -H * 0.06)
      ctx.stroke()
      ctx.strokeStyle = c
      ctx.lineWidth = H * 0.2
      ctx.stroke()
      eye(ctx, L, H)
      break
    }
    case 'zebra-danio': {
      tail(ctx, L, H, wave, 0.26, 0.85, shade(c, -0.1, 0.7), 0.5)
      bodyPath(ctx, L, H)
      ctx.fillStyle = c
      ctx.fill()
      ctx.save()
      ctx.clip()
      ctx.fillStyle = a
      for (let i = -2; i <= 2; i++) ctx.fillRect(-L * 0.45, i * H * 0.22 - H * 0.05, L * 0.85, H * 0.1)
      ctx.restore()
      eye(ctx, L, H, 0.36)
      break
    }
    case 'guppy': {
      // huge fan tail
      ctx.save()
      ctx.translate(-L * 0.32, 0)
      ctx.rotate(wave * 0.8)
      const tg = ctx.createRadialGradient(0, 0, 1, -L * 0.3, 0, L * 0.6)
      tg.addColorStop(0, shade(c, 0.1, 0.95))
      tg.addColorStop(1, shade(c, -0.25, 0.75))
      ctx.fillStyle = tg
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, L * 0.55, Math.PI - 0.65, Math.PI + 0.65)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = shade(a, 0, 0.8)
      for (let i = 0; i < 5; i++) {
        const ang = Math.PI - 0.45 + i * 0.22
        ctx.beginPath()
        ctx.arc(Math.cos(ang) * L * 0.36, Math.sin(ang) * L * 0.36, L * 0.035, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      bodyPath(ctx, L * 0.8, H, 0.55)
      ctx.fillStyle = '#a6ada0'
      ctx.fill()
      ctx.fillStyle = shade(c, 0, 0.8)
      ctx.beginPath()
      ctx.moveTo(-L * 0.05, -H * 0.4)
      ctx.quadraticCurveTo(-L * 0.18, -H * 0.95, -L * 0.3, -H * 0.2)
      ctx.fill()
      eye(ctx, L * 0.8, H, 0.38)
      break
    }
    case 'betta': {
      // flowing caudal fin
      ctx.save()
      ctx.translate(-L * 0.32, 0)
      ctx.rotate(wave * 0.5)
      const fg = ctx.createLinearGradient(0, 0, -L * 0.8, 0)
      fg.addColorStop(0, shade(c, 0, 0.95))
      fg.addColorStop(1, shade(a, 0, 0.55))
      ctx.fillStyle = fg
      const w2 = Math.sin(phase * 0.7) * H * 0.25
      ctx.beginPath()
      ctx.moveTo(0, -H * 0.2)
      ctx.bezierCurveTo(-L * 0.3, -H * 1.3, -L * 0.7, -H * 1.1 + w2, -L * 0.75, -H * 0.3 + w2)
      ctx.bezierCurveTo(-L * 0.8, H * 0.3 - w2, -L * 0.7, H * 1.2 - w2, -L * 0.25, H * 1.3)
      ctx.lineTo(0, H * 0.2)
      ctx.fill()
      ctx.restore()
      // dorsal & anal fins
      ctx.fillStyle = shade(c, -0.15, 0.85)
      ctx.beginPath()
      ctx.moveTo(L * 0.05, -H * 0.4)
      ctx.quadraticCurveTo(-L * 0.2, -H * 1.3 + Math.sin(phase) * 2, -L * 0.42, -H * 0.5)
      ctx.lineTo(-L * 0.3, -H * 0.15)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(L * 0.15, H * 0.35)
      ctx.quadraticCurveTo(-L * 0.15, H * 1.5 + Math.sin(phase + 1) * 2, -L * 0.42, H * 0.6)
      ctx.lineTo(-L * 0.3, H * 0.15)
      ctx.fill()
      bodyPath(ctx, L * 0.85, H, 0.55)
      const bg = ctx.createLinearGradient(0, -H / 2, 0, H / 2)
      bg.addColorStop(0, shade(c, -0.3))
      bg.addColorStop(1, shade(c, 0.1))
      ctx.fillStyle = bg
      ctx.fill()
      eye(ctx, L * 0.85, H, 0.4)
      break
    }
    case 'clownfish': {
      tail(ctx, L, H, wave, 0.22, 0.7, c, 0.1)
      ctx.strokeStyle = '#111'
      ctx.lineWidth = Math.max(0.6, L * 0.02)
      bodyPath(ctx, L, H, 0.5, -0.36, 0.2)
      ctx.fillStyle = c
      ctx.fill()
      ctx.save()
      ctx.clip()
      for (const bx of [0.27, -0.02, -0.3]) {
        ctx.fillStyle = '#111'
        ctx.fillRect(L * bx - L * 0.075, -H, L * 0.15, H * 2)
        ctx.fillStyle = a
        ctx.fillRect(L * bx - L * 0.05, -H, L * 0.1, H * 2)
      }
      ctx.restore()
      ctx.stroke()
      pectoral(ctx, L, H, phase, shade(c, -0.1))
      eye(ctx, L, H, 0.36)
      break
    }
    case 'angelfish': {
      // long sweeping fins
      ctx.fillStyle = shade(c, -0.1, 0.75)
      const s1 = Math.sin(phase * 0.6) * L * 0.04
      ctx.beginPath()
      ctx.moveTo(L * 0.12, -H * 0.38)
      ctx.quadraticCurveTo(-L * 0.12, -H * 0.95, -L * 0.48 + s1, -H * 1.1)
      ctx.quadraticCurveTo(-L * 0.3, -H * 0.45, -L * 0.3, -H * 0.12)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(L * 0.12, H * 0.38)
      ctx.quadraticCurveTo(-L * 0.12, H * 0.95, -L * 0.48 - s1, H * 1.1)
      ctx.quadraticCurveTo(-L * 0.3, H * 0.45, -L * 0.3, H * 0.12)
      ctx.fill()
      tail(ctx, L, H, wave * 0.6, 0.22, 0.6, shade(c, -0.1, 0.7), 0.6, -0.3)
      ctx.beginPath()
      ctx.moveTo(L * 0.45, 0)
      ctx.quadraticCurveTo(L * 0.25, -H * 0.62, -L * 0.3, -H * 0.12)
      ctx.lineTo(-L * 0.3, H * 0.12)
      ctx.quadraticCurveTo(L * 0.25, H * 0.62, L * 0.45, 0)
      ctx.fillStyle = c
      ctx.fill()
      ctx.save()
      ctx.clip()
      ctx.fillStyle = shade(a, 0, 0.75)
      for (const bx of [0.2, -0.02, -0.22]) ctx.fillRect(L * bx, -H, L * 0.05, H * 2)
      ctx.restore()
      // ventral filaments
      ctx.strokeStyle = shade(c, -0.2, 0.6)
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(L * 0.15, H * 0.4)
      ctx.quadraticCurveTo(L * 0.05, H * 1.2, -L * 0.05 + s1, H * 1.9)
      ctx.stroke()
      eye(ctx, L, H * 0.8, 0.33)
      break
    }
    case 'goldfish': {
      // double flowing tail
      for (const k of [-1, 1]) {
        ctx.save()
        ctx.translate(-L * 0.32, 0)
        ctx.rotate(wave * 0.7 + k * 0.12)
        ctx.fillStyle = shade(c, 0.15, 0.7)
        const flow = Math.sin(phase + k) * H * 0.08
        ctx.beginPath()
        ctx.moveTo(0, k * H * 0.05)
        ctx.bezierCurveTo(-L * 0.15, k * H * 0.35, -L * 0.4, k * H * 0.75 + flow, -L * 0.6, k * H * 0.62 + flow)
        ctx.quadraticCurveTo(-L * 0.5, k * H * 0.25, -L * 0.58, k * H * 0.02)
        ctx.quadraticCurveTo(-L * 0.3, k * H * 0.04, 0, k * H * 0.05)
        ctx.fill()
        ctx.restore()
      }
      ctx.fillStyle = shade(c, 0, 0.85)
      ctx.beginPath()
      ctx.moveTo(L * 0.1, -H * 0.45)
      ctx.quadraticCurveTo(-L * 0.1, -H * 0.95, -L * 0.25, -H * 0.35)
      ctx.fill()
      bodyPath(ctx, L * 0.9, H, 0.5, -0.36, 0.18)
      const gg = ctx.createLinearGradient(0, -H / 2, 0, H / 2)
      gg.addColorStop(0, shade(c, -0.15))
      gg.addColorStop(1, shade(a, 0.2))
      ctx.fillStyle = gg
      ctx.fill()
      pectoral(ctx, L * 0.9, H, phase, shade(c, 0.2, 0.8))
      eye(ctx, L * 0.9, H, 0.34)
      break
    }
    case 'cherry-barb': {
      tail(ctx, L, H, wave, 0.24, 0.75, shade(c, 0, 0.7), 0.45)
      bodyPath(ctx, L, H)
      const cg = ctx.createLinearGradient(0, -H / 2, 0, H / 2)
      cg.addColorStop(0, shade(c, -0.35))
      cg.addColorStop(1, shade(c, 0.15))
      ctx.fillStyle = cg
      ctx.fill()
      ctx.strokeStyle = shade(a, 0, 0.8)
      ctx.lineWidth = H * 0.1
      ctx.beginPath()
      ctx.moveTo(L * 0.3, -H * 0.02)
      ctx.lineTo(-L * 0.36, 0)
      ctx.stroke()
      eye(ctx, L, H)
      break
    }
  }
  ctx.restore()
}

export function fishBodyLength(look: FishLook): number {
  return SPECIES[look.species].length * look.scale
}
