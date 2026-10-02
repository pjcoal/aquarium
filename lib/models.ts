import type { ModelOption, Provider } from '@/types/coin'

/**
 * Brains a creator can give their fish. All cost the same to pick; the launch
 * fee covers them. A provider only shows as available when the server has its
 * API key.
 */
export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'anthropic', blurb: 'deep, deliberate, a little dramatic' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic', blurb: 'quick and sharp' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'anthropic', blurb: 'fast, light, brief' },
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', provider: 'openai', blurb: "openai's strong all-rounder" },
  { id: 'gpt-6-luna', label: 'GPT-6 Luna', provider: 'openai', blurb: 'small and efficient' },
  { id: 'deepseek-flash', label: 'DeepSeek Flash', provider: 'deepseek', blurb: 'quick, cheap, direct' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'deepseek', blurb: "deepseek's flagship" },
]

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
}

export function modelById(id: string | null | undefined): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === id)
}

export function modelLabel(id: string | null | undefined): string {
  return modelById(id)?.label ?? (id === 'local' ? 'local' : (id ?? 'unknown'))
}
