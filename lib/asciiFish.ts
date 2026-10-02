import type { FishAction, SpeciesId } from '@/types/fish'
import { SPECIES, asciiLeft } from '@/simulation/species'

/** world units per character in the tank */
export const FONT = 22
export const CHAR_W = FONT * 0.6
export const LINE_H = 24
export const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace'

const TAIL_FLICK: Record<string, string> = { '>': '}', '}': ')', '{': '(', '<': '{' }

/**
 * The lines to draw for a fish. `frame` alternates the tail; the eye changes
 * with state (sleeping fish close their eyes, frightened fish go wide-eyed).
 */
export function fishArt(species: SpeciesId, facingLeft: boolean, frame: number, action?: FishAction): string[] {
  const art = SPECIES[species].art
  const width = Math.max(...art.map((l) => l.length))
  const eye = action === 'REST' ? '-' : action === 'FLEE' ? 'O' : action === 'CHASE' ? 'ò' : null
  return art.map((line) => {
    let l = line.padEnd(width, ' ')
    if (eye) l = l.replace(/[°•]/, eye)
    // tail flick on the first non-space character of the tail row
    if (frame % 2 === 1) {
      const i = l.search(/\S/)
      if (i >= 0 && TAIL_FLICK[l[i]] && (art.length === 1 || line.includes('°') || line.includes('•'))) l = l.slice(0, i) + TAIL_FLICK[l[i]] + l.slice(i + 1)
    }
    return facingLeft ? asciiLeft(l) : l
  })
}

export function artSize(species: SpeciesId): { cols: number; rows: number } {
  const art = SPECIES[species].art
  return { cols: Math.max(...art.map((l) => l.length)), rows: art.length }
}
