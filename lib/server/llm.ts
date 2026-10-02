import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { Provider } from '@/types/coin'
import { MODEL_OPTIONS, modelById } from '@/lib/models'
import { KEYS, getStore } from './store'

const KEY_ENV: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  xai: 'XAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

/** OpenAI-compatible endpoints for the non-OpenAI providers */
const BASE_URL: Partial<Record<Provider, string>> = {
  xai: 'https://api.x.ai/v1',
  deepseek: 'https://api.deepseek.com',
}

/** total brain calls allowed per hour across the whole tank */
const HOURLY_LIMIT = Number(process.env.AQUARIUM_LLM_HOURLY_LIMIT || 300)

export function providerConfigured(p: Provider): boolean {
  return !!process.env[KEY_ENV[p]]
}

export function modelAvailable(id: string): boolean {
  const m = modelById(id)
  return !!m && providerConfigured(m.provider)
}

export function availableModels() {
  return MODEL_OPTIONS.map((m) => ({ ...m, available: providerConfigured(m.provider) }))
}

let anthropic: Anthropic | null = null
const openaiClients: Partial<Record<Provider, OpenAI>> = {}

function openaiFor(p: Provider): OpenAI {
  openaiClients[p] ??= new OpenAI({ apiKey: process.env[KEY_ENV[p]], baseURL: BASE_URL[p] })
  return openaiClients[p]!
}

export class BrainUnavailable extends Error {}

/** reserve one call from the hourly budget */
async function spend(): Promise<boolean> {
  return (await getStore().incr(KEYS.llmHour(), 3700)) <= HOURLY_LIMIT
}

/**
 * One short completion from whichever provider serves `modelId`.
 * Throws BrainUnavailable when the provider isn't configured, the budget is
 * spent, or the model declines; callers fall back to scripted lines.
 */
export async function complete(modelId: string, system: string, prompt: string, timeoutMs = 25_000): Promise<string> {
  const m = modelById(modelId)
  if (!m || !providerConfigured(m.provider)) throw new BrainUnavailable(`no key for ${modelId}`)
  if (!(await spend())) throw new BrainUnavailable('hourly brain budget spent')

  if (m.provider === 'anthropic') {
    // user-level keys (sk-ant-usr-…) must name the workspace on every request
    const workspace = process.env.ANTHROPIC_WORKSPACE_ID
    anthropic ??= new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {})
    // Opus 5.5 / Sonnet 5.5: low effort for short lines, server-side refusal fallback.
    // Haiku 4.5 takes neither.
    const modern = m.id !== 'claude-haiku-4-5'
    const res = await anthropic.beta.messages.create(
      {
        model: m.id,
        max_tokens: modern ? 3000 : 400,
        ...(modern ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const, output_config: { effort: 'low' as const } } : {}),
        system,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: timeoutMs },
    )
    if (res.stop_reason === 'refusal') throw new BrainUnavailable('declined')
    const text = res.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') throw new BrainUnavailable('empty')
    return text.text
  }

  const client = openaiFor(m.provider)
  // OpenAI's current models take max_completion_tokens; xAI and DeepSeek take max_tokens.
  // Reasoning models spend part of that budget thinking, so leave room.
  const budget = 2000
  const res = await client.chat.completions.create(
    {
      model: m.id,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      ...(m.provider === 'openai' ? { max_completion_tokens: budget } : { max_tokens: budget }),
      // DeepSeek models think by default; one-line fish chatter doesn't need it
      ...(m.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
    } as OpenAI.ChatCompletionCreateParamsNonStreaming,
    { timeout: timeoutMs },
  )
  const text = res.choices[0]?.message?.content
  if (!text) throw new BrainUnavailable('empty')
  return text
}

/** errors worth logging (as opposed to expected fallbacks) */
export function describeError(err: unknown): string {
  if (err instanceof BrainUnavailable) return err.message
  if (err instanceof Anthropic.APIError) return `anthropic ${err.status}: ${err.message}`
  if (err instanceof OpenAI.APIError) return `openai-compatible ${err.status}: ${err.message}`
  return err instanceof Error ? err.message : String(err)
}
