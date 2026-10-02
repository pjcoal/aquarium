'use client'
import { useEffect, useState } from 'react'
import type { FishAction, SpeciesId } from '@/types/fish'
import { artSize, fishArt } from '@/lib/asciiFish'
import { useReducedMotion } from '@/lib/hooks'

export interface FishLook {
  species: SpeciesId
  color: string
  action?: FishAction
}

/** An ASCII portrait of a fish, sized to fit its box. Animated sprites flick their tail. */
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
  const reduced = useReducedMotion()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!animate || reduced) return
    const id = setInterval(() => setFrame((f) => f + 1), 380)
    return () => clearInterval(id)
  }, [animate, reduced])

  const { cols, rows } = artSize(look.species)
  // monospace glyphs are ~0.6em wide and we use a 1.1 line height
  const size = Math.min((width * 0.82) / (cols * 0.6), (height * 0.8) / (rows * 1.1))
  const lines = fishArt(look.species, false, frame, look.action)

  return (
    <span
      role="img"
      aria-label={label ?? `${look.species} illustration`}
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width, height }}
    >
      <pre aria-hidden className="m-0 font-mono" style={{ color: look.color, fontSize: size, lineHeight: 1.1, textShadow: `0 0 ${Math.round(size / 3)}px ${look.color}55` }}>
        {lines.join('\n')}
      </pre>
    </span>
  )
}
