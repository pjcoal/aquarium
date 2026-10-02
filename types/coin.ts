import type { PersonalityPreset, SpeciesId } from './fish'
import type { EscapePlan, TalkTopic } from './talk'

export type Provider = 'anthropic' | 'openai' | 'deepseek'

export interface ModelOption {
  id: string
  label: string
  provider: Provider
  blurb: string
  /** set by the server: whether that provider's API key is configured */
  available?: boolean
}

/** a coin launched from the site; its fish shares the mint as its id */
export interface CoinRecord {
  mint: string
  name: string
  symbol: string
  description: string
  image: string | null
  metadataUri: string
  creator: string
  model: string
  species: SpeciesId
  color: string
  preset: PersonalityPreset
  personalityText: string
  /** wall clock ms */
  createdAt: number
  createSig: string
  feeSig: string
}

export interface SharedLine {
  mint: string
  text: string
  model: string
}

export interface SharedConversation {
  id: string
  createdAt: number
  participants: string[]
  topic: TalkTopic
  summary: string
  lines: SharedLine[]
  plan: { progress: boolean; note: string } | null
}

export interface SharedThought {
  text: string
  at: number
  model: string
}

export interface TankConfig {
  launchEnabled: boolean
  /** why launching is disabled, if it is */
  reason: string | null
  feeSol: number
  treasury: string | null
  storage: 'redis' | 'memory'
  models: ModelOption[]
}

/** everything every viewer shares, served by GET /api/tank */
export interface TankState {
  coins: CoinRecord[]
  conversations: SharedConversation[]
  thoughts: Record<string, SharedThought>
  escape: EscapePlan
  config: TankConfig
  serverTime: number
}
