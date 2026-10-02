export type EventCategory =
  | 'social'
  | 'feeding'
  | 'exploration'
  | 'territorial'
  | 'discovery'
  | 'resting'
  | 'market'
  | 'talk'
  | 'system'

export interface SimEvent {
  id: number
  /** wall clock ms */
  wall: number
  /** world time ms */
  wt: number
  cat: EventCategory
  text: string
  /** ids of fish referenced in text, used for linking */
  fish: string[]
  schoolId?: string
}
