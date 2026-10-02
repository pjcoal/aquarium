import type { Fish } from '@/types/fish'
import { SPECIES, asciiLeft } from '@/simulation/species'

export function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function age(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m % 60}m`
  return `${m}m`
}

export function dur(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s < 60 ? `${s}s` : age(ms)
}

export function clock(wall: number): string {
  const d = new Date(wall)
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

export function asciiFor(f: Pick<Fish, 'species' | 'heading'>): string {
  const a = SPECIES[f.species].ascii
  return Math.cos(f.heading) < 0 ? asciiLeft(a) : a
}

export function depthLabel(y: number): string {
  if (y < 280) return 'upper'
  if (y < 600) return 'middle'
  return 'bottom'
}

export function worldClock(worldTime: number): string {
  const s = Math.floor(worldTime / 1000)
  const d = Math.floor(s / 86400)
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `d${d} ${hh}:${mm}:${ss}`
}
