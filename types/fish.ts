export interface Vec {
  x: number
  y: number
}

export type SpeciesId =
  | 'neon-tetra'
  | 'guppy'
  | 'betta'
  | 'clownfish'
  | 'angelfish'
  | 'goldfish'
  | 'zebra-danio'
  | 'cherry-barb'

export type FishAction =
  | 'IDLE'
  | 'WANDER'
  | 'EXPLORE'
  | 'FOLLOW'
  | 'SCHOOL'
  | 'EAT'
  | 'REST'
  | 'FLEE'
  | 'CHASE'
  | 'HIDE'
  | 'INVESTIGATE'

export type PersonalityPreset =
  | 'CURIOUS'
  | 'SHY'
  | 'SOCIAL'
  | 'TERRITORIAL'
  | 'LAZY'
  | 'ADVENTUROUS'
  | 'CHAOTIC'
  | 'CALM'

export type Mood =
  | 'curious'
  | 'content'
  | 'calm'
  | 'anxious'
  | 'hungry'
  | 'sleepy'
  | 'playful'
  | 'irritable'
  | 'lonely'
  | 'bold'
  | 'startled'

/** All traits are 0..1 */
export interface Personality {
  social: number
  aggression: number
  curiosity: number
  energy: number
  bravery: number
  chaos: number
}

export interface Relationship {
  /** -1 (hostile) .. 1 (close) */
  score: number
  /** 0..1, how well they know each other */
  familiarity: number
  lastSeen: number
  /** times this fish followed the other */
  follows: number
  /** times the other chased this fish */
  chasedBy: number
  /** times this fish chased the other */
  chased: number
}

export type MemoryKind =
  | 'food'
  | 'social'
  | 'threat'
  | 'discovery'
  | 'place'
  | 'school'
  | 'rest'
  | 'territory'
  | 'arrival'

export interface Memory {
  /** world time ms */
  t: number
  kind: MemoryKind
  text: string
  fishId?: string
  placeId?: string
  /** -1 bad .. 1 good */
  valence: number
  pos?: Vec
}

export interface Discovery {
  placeId: string
  name: string
  t: number
  viaFishId?: string
  first?: boolean
}

export interface ActionRecord {
  t: number
  action: FishAction
  detail: string
}

export interface Thought {
  t: number
  text: string
}

export interface Preferences {
  /** learned or declared feelings about places, -1..1 */
  placeAffinity: Record<string, number>
  /** shifts preferred depth: negative = toward surface, positive = toward bottom */
  depthBias: number
  followsSmaller: boolean
  likesCaves: number
}

export type TargetKind = 'point' | 'fish' | 'food' | 'place'

export interface Target {
  kind: TargetKind
  x: number
  y: number
  id?: string
}

export interface FishStats {
  interactions: number
  distance: number
  meals: number
  chases: number
  fled: number
  /** exponentially-smoothed recent activity, 0..1 */
  activity: number
}

export interface Fish {
  id: string
  name: string
  species: SpeciesId
  color: string
  accent: string
  /** body-length scale multiplier relative to species */
  scale: number

  personality: Personality
  preset: PersonalityPreset
  personalityText: string

  pos: Vec
  vel: Vec
  heading: number
  speed: number

  energy: number
  hunger: number
  /** builds up when bored, spent when exploring. 0..1 */
  curiosity: number
  stress: number
  mood: Mood

  action: FishAction
  actionSince: number
  actionDetail: string
  nextDecisionAt: number
  target: Target | null
  /** fish this fish is following/chasing/fleeing from */
  focusId: string | null

  schoolId: string | null
  territoryId: string | null

  relationships: Record<string, Relationship>
  memories: Memory[]
  discoveries: Discovery[]
  history: ActionRecord[]
  thoughts: Thought[]

  lastThought: string
  lastThoughtAt: number
  nextThoughtAt: number

  /** world time ms of birth */
  createdAt: number
  /** wall clock ms when added to this tank */
  introducedAt: number
  /** world time until which the fish is still entering the tank */
  enteringUntil: number

  prefs: Preferences
  stats: FishStats

  /** render-only animation phase */
  phase: number
}
