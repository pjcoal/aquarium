'use client'
import { useEffect, useRef } from 'react'
import { getEngine } from '@/simulation/engine'
import { STATIC_PLACES, SURFACE_Y, TANK_H, TANK_W, sandY } from '@/simulation/environment'

/** A schematic of the tank showing where one fish currently is. */
export function MiniMap({ fishId, height = 150 }: { fishId: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const engine = getEngine()
    const ctx = canvas.getContext('2d')!
    let acc = 0
    let t = 0
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      const s = Math.min(W / TANK_W, H / TANK_H)
      const ox = (W - TANK_W * s) / 2
      const oy = (H - TANK_H * s) / 2
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#03070b'
      ctx.fillRect(0, 0, W, H)
      ctx.setTransform(s, 0, 0, s, ox, oy)
      ctx.fillStyle = '#071a22'
      ctx.fillRect(0, SURFACE_Y, TANK_W, TANK_H - SURFACE_Y)
      ctx.fillStyle = '#2a261d'
      ctx.beginPath()
      ctx.moveTo(0, TANK_H)
      for (let x = 0; x <= TANK_W; x += 30) ctx.lineTo(x, sandY(x))
      ctx.lineTo(TANK_W, TANK_H)
      ctx.fill()
      ctx.strokeStyle = 'rgba(94,242,255,0.35)'
      ctx.lineWidth = 2 / s
      ctx.strokeRect(0, 0, TANK_W, TANK_H)
      ctx.font = `${10 / s}px ui-monospace, monospace`
      for (const p of [...STATIC_PLACES, ...engine.world.curiosities]) {
        ctx.fillStyle = engine.world.territories[p.id] ? 'rgba(255,184,103,0.7)' : 'rgba(140,200,210,0.45)'
        ctx.fillRect(p.x - 6, p.y - 6, 12, 12)
      }
      const me = engine.fishById(fishId)
      for (const f of engine.world.fish) {
        if (f === me) continue
        const sameSchool = me?.schoolId && f.schoolId === me.schoolId
        ctx.fillStyle = sameSchool ? 'rgba(94,242,255,0.6)' : 'rgba(180,200,205,0.28)'
        ctx.beginPath()
        ctx.arc(f.pos.x, f.pos.y, 9, 0, Math.PI * 2)
        ctx.fill()
      }
      if (me) {
        const pr = 18 + Math.sin(t * 3) * 6
        ctx.strokeStyle = 'rgba(94,242,255,0.9)'
        ctx.beginPath()
        ctx.arc(me.pos.x, me.pos.y, pr + 20, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#5ef2ff'
        ctx.beginPath()
        ctx.arc(me.pos.x, me.pos.y, 14, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(me.pos.x, 0)
        ctx.lineTo(me.pos.x, TANK_H)
        ctx.moveTo(0, me.pos.y)
        ctx.lineTo(TANK_W, me.pos.y)
        ctx.strokeStyle = 'rgba(94,242,255,0.18)'
        ctx.stroke()
      }
    }
    const off = engine.onFrame((dt) => {
      acc += dt || 1 / 60
      t += 1 / 60
      if (acc < 0.08) return
      acc = 0
      draw()
    })
    draw()
    return () => {
      off()
      ro.disconnect()
    }
  }, [fishId])

  return <canvas ref={ref} className="block w-full border border-line" style={{ height }} role="img" aria-label="Map of the tank showing this fish's position" />
}
