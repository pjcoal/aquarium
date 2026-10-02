import type { Fish, Vec } from './fish'
import type { SimEvent } from './events'
import type { Conversation, EscapePlan } from './talk'

export type PlaceKind =
  | 'cave'
  | 'rock'
  | 'plant'
  | 'driftwood'
  | 'filter'
  | 'bubbler'
  | 'pot'
  | 'surface'
  | 'curiosity'

export interface Place {
  id: string
  kind: PlaceKind
  name: string
  /** short name used in phrases ("the cave") */
  x: number
  y: number
  /** radius at which a fish is considered "at" this place */
  r: number
  /** offers shelter for hiding / resting */
  shelter: boolean
  /** transient curiosities expire */
  transient?: boolean
  expiresAt?: number
  /** curiosity subtype for drawing */
  variant?: string
}

export interface Obstacle {
  x: number
  y: number
  r: number
}

export interface Food {
  id: number
  x: number
  y: number
  vy: number
  /** world time spawned */
  t: number
  settledAt: number | null
  claimedBy: string | null
}

export interface School {
  id: string
  name: string
  hue: number
  members: string[]
  leaderId: string
  createdAt: number
  goal: Vec
  goalUntil: number
  /** zone name where the school spends its time */
  territory: string
  /** last vertical band (surface / middle / bottom) for movement events */
  band: string
  /** accumulated time per zone, for territory estimation */
  zoneTime: Record<string, number>
}

export interface Counters {
  interactions: number
  discoveries: number
  meals: number
  nextEventId: number
  nextFoodId: number
  nextSchoolNum: number
  lastFeedAt: number
  nextFeedAt: number
  nextCuriosityAt: number
}

export interface WorldState {
  version: number
  /** wall clock ms the tank was first created */
  createdAt: number
  /** simulated world time ms */
  worldTime: number
  /** wall clock of last save */
  savedAt: number
  fish: Fish[]
  schools: School[]
  /** transient curiosities only; static places live in environment.ts */
  curiosities: Place[]
  food: Food[]
  counters: Counters
  events: SimEvent[]
  /** placeId -> fishId of first discoverer */
  firstFinds: Record<string, string>
  /** placeId -> fishId of territorial owner */
  territories: Record<string, string>
  /** world time when last day/night phase announced */
  lastPhase: string
  /** conversations between fish, newest last */
  conversations: Conversation[]
  escape: EscapePlan
}

export type SimSpeed = 1 | 2 | 4

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'
