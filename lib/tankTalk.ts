import type { Engine } from '@/simulation/engine'
import type { Fish } from '@/types/fish'
import type { TalkRequest, TalkResponse, TalkTopic } from '@/types/talk'
import { SPECIES } from '@/simulation/species'
import { relationLabel } from '@/simulation/relationships'
import { locationPhrase } from '@/simulation/environment'
import { TOKEN } from './token'
import { localConversation } from './localTalk'

export type TalkMode = 'checking' | 'claude' | 'local'

const BUSY = new Set(['REST', 'FLEE', 'HIDE', 'CHASE'])

/**
 * Decides when fish talk and who joins in, asks /api/tank-talk (Claude) for the
 * conversation, and falls back to scripted local dialogue when the server has
 * no API key or the request fails.
 */
export class TalkDirector {
  mode: TalkMode = 'checking'
  model: string | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private inflight = false
  private nextAt = Date.now() + 12_000

  constructor(private engine: Engine) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), 3000)
    void fetch('/api/tank-talk')
      .then((r) => r.json() as Promise<{ configured: boolean; model: string | null }>)
      .then((s) => {
        this.mode = s.configured ? 'claude' : 'local'
        this.model = s.model
        this.engine.notify()
      })
      .catch(() => {
        this.mode = 'local'
      })
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private schedule(minMs: number, maxMs: number) {
    this.nextAt = Date.now() + minMs + Math.random() * (maxMs - minMs)
  }

  private async tick() {
    const e = this.engine
    if (this.inflight || document.hidden || e.ui.paused || e.activeConversation() || Date.now() < this.nextAt) return
    const group = this.pickGroup()
    if (!group) return this.schedule(10_000, 20_000)
    const topic = this.pickTopic()

    if (this.mode === 'checking') return
    if (this.mode === 'local') {
      this.playLocal(group, topic)
      return this.schedule(100_000, 160_000)
    }

    this.inflight = true
    try {
      const res = await fetch('/api/tank-talk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildRequest(group, topic)),
        signal: AbortSignal.timeout(50_000),
      })
      if (res.status === 503) {
        this.mode = 'local'
        e.notify()
        this.playLocal(group, topic)
        return this.schedule(100_000, 160_000)
      }
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as { retryAfterMs?: number }
        return this.schedule(Math.max(30_000, body.retryAfterMs ?? 60_000), Math.max(40_000, (body.retryAfterMs ?? 60_000) + 20_000))
      }
      if (!res.ok) {
        this.playLocal(group, topic)
        return this.schedule(90_000, 140_000)
      }
      const data = (await res.json()) as TalkResponse
      this.mode = 'claude'
      this.model = data.model ?? null
      const byName = new Map(group.map((f) => [f.name, f]))
      e.startConversation({
        participants: group,
        lines: data.lines.map((l) => ({ speakerId: byName.get(l.speaker)?.id ?? group[0].id, text: l.text })),
        topic,
        summary: data.summary,
        plan: data.plan.progress ? data.plan : null,
        source: 'claude',
      })
      e.notify()
      this.schedule(70_000, 110_000)
    } catch {
      this.playLocal(group, topic)
      this.schedule(90_000, 140_000)
    } finally {
      this.inflight = false
    }
  }

  private playLocal(group: Fish[], topic: TalkTopic) {
    const e = this.engine
    const c = localConversation(group, topic, e.marketMood, TOKEN.ticker, e.world.escape.stage)
    e.startConversation({ participants: group, lines: c.lines, topic, summary: c.summary, plan: c.plan, source: 'local' })
    e.notify()
  }

  /** a sociable fish, plus one to three others nearby it gets along with */
  pickGroup(): Fish[] | null {
    const fish = this.engine.world.fish.filter((f) => !BUSY.has(f.action) && f.enteringUntil === 0)
    if (fish.length < 2) return null
    const weights = fish.map((f) => 0.2 + f.personality.social + f.personality.curiosity * 0.5)
    let r = Math.random() * weights.reduce((a, b) => a + b, 0)
    let seed = fish[0]
    for (let i = 0; i < fish.length; i++) {
      r -= weights[i]
      if (r <= 0) {
        seed = fish[i]
        break
      }
    }
    const score = (o: Fish) => (seed.relationships[o.id]?.score ?? 0) + (o.schoolId && o.schoolId === seed.schoolId ? 0.3 : 0)
    const near = fish.filter((o) => o !== seed && Math.hypot(o.pos.x - seed.pos.x, o.pos.y - seed.pos.y) < 280).sort((a, b) => score(b) - score(a))
    const pool = near.length ? near : fish.filter((o) => o !== seed).sort((a, b) => score(b) - score(a)).slice(0, 1)
    const n = Math.min(pool.length, 1 + Math.floor(Math.random() * 3))
    return [seed, ...pool.slice(0, n)]
  }

  private pickTopic(): TalkTopic {
    const e = this.engine
    const m = e.market
    const loud = e.marketMood === 'euphoric' || e.marketMood === 'panic' || (m !== null && Math.abs(m.change1h) > 8)
    const r = Math.random()
    if (loud && r < 0.6) return 'token'
    if (e.world.escape.stage === 0) return r < 0.5 ? 'both' : 'escape'
    return r < 0.45 ? 'escape' : r < 0.75 ? 'both' : 'token'
  }

  private buildRequest(group: Fish[], topic: TalkTopic): TalkRequest {
    const e = this.engine
    const now = e.world.worldTime
    const m = e.market
    const last = e.world.conversations[e.world.conversations.length - 1]
    const recent = last
      ? last.lines.slice(-4).map((l) => `${e.byId.get(l.speakerId)?.name ?? 'someone'}: ${l.text}`)
      : []
    return {
      topic,
      location: locationPhrase(group[0].pos, e.allPlaces()),
      ticker: TOKEN.ticker,
      market: m && m.source !== 'pending' ? { mood: e.marketMood, change1h: m.change1h, change24h: m.change24h, simulated: m.source === 'sim' } : null,
      plan: { stage: e.world.escape.stage, notes: e.world.escape.notes.slice(-5).map((n) => n.text), attempts: e.world.escape.attempts },
      fish: group.map((f) => {
        const others = group.filter((o) => o !== f)
        const feelings = others.map((o) => `${relationLabel(f, o.id)} toward ${o.name}`)
        // also the fish it feels most strongly about outside the group
        const strongest = Object.entries(f.relationships)
          .filter(([id]) => !group.some((g) => g.id === id) && e.byId.has(id))
          .sort((a, b) => Math.abs(b[1].score) - Math.abs(a[1].score))[0]
        if (strongest && Math.abs(strongest[1].score) > 0.25) feelings.push(`${relationLabel(f, strongest[0])} toward ${e.byId.get(strongest[0])!.name}`)
        return {
          name: f.name,
          species: SPECIES[f.species].name.toLowerCase(),
          personality: `${f.preset.toLowerCase()}${f.personalityText ? `, ${f.personalityText}` : ''}`,
          mood: f.mood,
          doing: f.actionDetail,
          memories: f.memories.slice(0, 3).map((mm) => `${mm.text} (${Math.max(1, Math.round((now - mm.t) / 60_000))}m ago)`),
          feelings,
        }
      }),
      recent,
    }
  }
}

let director: TalkDirector | null = null
export function getTalkDirector(engine?: Engine): TalkDirector | null {
  if (!director && engine) director = new TalkDirector(engine)
  return director
}
