export type TalkTopic = 'token' | 'escape' | 'both'

export interface TalkLine {
  speakerId: string
  text: string
}

export interface Conversation {
  id: number
  /** world time the conversation started */
  startedAt: number
  wall: number
  participants: string[]
  topic: TalkTopic
  summary: string
  lines: TalkLine[]
  /** how many lines have been spoken so far */
  revealed: number
  source: 'claude' | 'local'
  plan: { progress: boolean; note: string } | null
}

export interface EscapePlan {
  /** 0 = nobody has said it out loud .. 6 = ready to try */
  stage: number
  notes: { wall: number; text: string; stage: number }[]
  attempts: number
}

export const ESCAPE_STAGES = ['unspoken', 'whispers', 'an idea', 'a plan', 'recruiting', 'rehearsing', 'ready'] as const

/** what the browser sends to /api/tank-talk */
export interface TalkRequest {
  topic: TalkTopic
  location: string
  ticker: string
  market: { mood: string; change1h: number; change24h: number; simulated: boolean } | null
  plan: { stage: number; notes: string[]; attempts: number }
  fish: {
    name: string
    species: string
    personality: string
    mood: string
    doing: string
    memories: string[]
    feelings: string[]
  }[]
  recent: string[]
}

/** what /api/tank-talk returns */
export interface TalkResponse {
  lines: { speaker: string; text: string }[]
  summary: string
  plan: { progress: boolean; note: string }
  model?: string
}
