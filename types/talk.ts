export type TalkTopic = 'token' | 'escape' | 'both'

export interface TalkLine {
  speakerId: string
  text: string
  /** the model that wrote this line ('local' for scripted lines) */
  model?: string
}

export interface Conversation {
  id: string
  /** world time the conversation started */
  startedAt: number
  wall: number
  participants: string[]
  topic: TalkTopic
  summary: string
  lines: TalkLine[]
  /** how many lines have been spoken so far */
  revealed: number
  source: 'brains' | 'local'
  plan: { progress: boolean; note: string } | null
  /** came from the shared server state; the server owns the escape plan */
  remote?: boolean
}

export interface EscapePlan {
  /** 0 = nobody has said it out loud .. 6 = ready to try */
  stage: number
  notes: { wall: number; text: string; stage: number }[]
  attempts: number
}

export const ESCAPE_STAGES = ['unspoken', 'whispers', 'an idea', 'a plan', 'recruiting', 'rehearsing', 'ready'] as const
