'use client'
import { useEffect, useRef } from 'react'
import type { FishLook } from '@/lib/fishDrawing'
import { drawFish, fishBodyLength } from '@/lib/fishDrawing'
import { useReducedMotion } from '@/lib/hooks'

/** A small canvas portrait of a fish. Animated sprites swim in place. */
export function FishSprite({
  look,
  width = 64,
  height = 40,
  animate = false,
  className = '',
  label,
}: {
  look: FishLook
  width?: number
  height?: number
  animate?: boolean
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const { species, color, accent, scale } = look

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')!
    const l = { species, color, accent, scale }
    // fit the fish (with fins) inside the box
    const fit = Math.min((width * 0.62) / fishBodyLength(l), (height * 0.5) / (fishBodyLength(l) * 0.55))
    let raf = 0
    let phase = 0
    let last = performance.now()
    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      phase += dt * 6
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.translate(width * 0.54, height / 2 + (animate ? Math.sin(phase * 0.3) * height * 0.03 : 0))
      ctx.scale(fit, fit)
      drawFish(ctx, l, 0, 0, 0, phase)
      ctx.restore()
      if (animate && !reduced) raf = requestAnimationFrame(draw)
    }
    draw(last)
    return () => cancelAnimationFrame(raf)
  }, [species, color, accent, scale, width, height, animate, reduced])

  return <canvas ref={ref} style={{ width, height }} className={className} role="img" aria-label={label ?? `${species} illustration`} />
}
