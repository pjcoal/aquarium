import type { FishAction, Mood } from '@/types/fish'
import type { DayPhase } from '@/types/simulation'
import { hashString, mulberry32 } from './random'

/**
 * Everything a thought generator is allowed to know about a fish's situation.
 * The context is plain JSON so it can be sent as-is to a remote LLM endpoint.
 */
export interface ThoughtContext {
  fishId: string
  name: string
  species: string
  personality: string
  traits: { social: number; aggression: number; curiosity: number; bravery: number; energy: number }
  mood: Mood
  action: FishAction
  actionDetail: string
  hunger: number
  energy: number
  stress: number
  location: string
  nearestPlace: string | null
  timeOfDay: DayPhase
  isNew: boolean
  school: { name: string; size: number } | null
  territory: string | null
  nearby: { name: string; relation: string; bigger: boolean; action: FishAction }[]
  friend: { name: string; seenMinAgo: number; lastPlace: string | null } | null
  threat: { name: string; place: string | null } | null
  favoritePlace: string | null
  foodSpot: string | null
  lastDiscovery: { name: string; minAgo: number; transient: boolean } | null
  /** owners of places near this fish */
  territoryOwnerNearby: { name: string; place: string } | null
  recentMemories: { text: string; minAgo: number }[]
  bubblesNearby: boolean
  previousThoughts: string[]
  /** how the token market feels from inside the tank, if there is one */
  market: 'euphoric' | 'bullish' | 'calm' | 'bearish' | 'panic' | null
  /** a counter, for deterministic variety */
  seq: number
}

export interface ThoughtGenerator {
  readonly name: string
  generate(ctx: ThoughtContext): string | Promise<string>
}

type Candidate = { w: number; text: string }

/**
 * Deterministic local generator. Builds candidate thoughts from actual
 * simulation state, weights them by relevance, and picks one with a PRNG
 * seeded by fish id + sequence so the same situation yields the same thought.
 */
export class LocalThoughtGenerator implements ThoughtGenerator {
  readonly name = 'local'

  generate(c: ThoughtContext): string {
    const cands: Candidate[] = []
    const add = (w: number, text: string | null | false | undefined) => {
      if (text && w > 0) cands.push({ w, text })
    }
    const place = c.nearestPlace
    const fav = c.favoritePlace

    if (c.isNew) {
      add(3, 'this water tastes different from where i came from.')
      add(2, `so many fins. i should learn their names.`)
      if (c.nearby[0]) add(2, `${c.nearby[0].name.toLowerCase()} looked at me for a long time.`)
      if (place) add(1.5, `${place} looks like a good place to start.`)
    }

    // hunger
    if (c.hunger > 0.55) {
      if (c.foodSpot) add(2 + c.hunger * 2, `food usually appears ${c.foodSpot}.`)
      else add(1 + c.hunger * 2, 'food usually appears near the surface. i should look up more.')
      add(c.hunger * 1.5, 'everything smells like pellets and nothing is pellets.')
      if (c.nearby.some((n) => n.action === 'EAT')) add(2.5, `${c.nearby.find((n) => n.action === 'EAT')!.name.toLowerCase()} found something. i saw it.`)
    }
    if (c.action === 'EAT') add(2, c.foodSpot ? `again ${c.foodSpot}. i was right to remember.` : 'the pellets sink slower than they look.')

    // energy / rest
    if (c.energy < 0.3 || c.action === 'REST') {
      add(1.6, place ? `${place} is a good place to stop for a while.` : 'the water is heavy today.')
      add(1.2, `everything feels slower ${c.location}.`)
      if (c.timeOfDay === 'night') add(1.8, 'the light is gone again. it always comes back.')
    }

    // time of day
    if (c.timeOfDay === 'dawn') add(1.4, 'the light above the tall plant is warmer today.')
    if (c.timeOfDay === 'dusk') add(1.2, 'the light is leaving through the top again.')
    if (c.timeOfDay === 'night' && c.action !== 'REST') add(1.3, `${place ?? 'the tank'} sounds different in the dark.`)
    if (c.timeOfDay === 'day' && c.location.includes('upper')) add(0.8, 'the surface keeps the light for itself.')

    // threats & territory
    if (c.threat) {
      const t = c.threat.name.toLowerCase()
      add(3 + c.stress * 2, c.threat.place ? `${t} keeps swimming through my corner.` : `${t} is watching me again.`)
      if (c.threat.place) add(2.5, `i'll wait until ${t} leaves ${c.threat.place}.`)
      add(1.5 + (1 - c.traits.bravery), `i don't go near ${t} anymore.`)
    }
    if (c.territoryOwnerNearby && c.territory !== c.territoryOwnerNearby.place) {
      const o = c.territoryOwnerNearby
      add(2, `${o.place} is quieter when ${o.name.toLowerCase()} leaves.`)
      if (c.traits.aggression > 0.5) add(2, `${o.place} doesn't belong to ${o.name.toLowerCase()}. not really.`)
    }
    if (c.territory) {
      add(2.5, `${c.territory} is mine. everyone should know that by now.`)
      add(1.5, `someone has been near ${c.territory} again. i can tell.`)
      if (c.action === 'CHASE') add(4, `out. ${c.territory} is not for visitors.`)
    }
    if (c.action === 'FLEE') add(5, 'too close. too close.')
    if (c.action === 'HIDE') add(4, place ? `nobody can see me in ${place}.` : 'if i stay still they forget i exist.')

    // social
    if (c.school) {
      if (c.school.size >= 5) add(1.6, `${c.school.size} of us now. the water feels smaller.`)
      add(1.4, `${c.school.name.toLowerCase()} feels slower today.`)
      add(1, 'turning together is easier than turning alone.')
    } else if (c.traits.social > 0.6 && c.nearby.length === 0) {
      add(2, 'where did everyone go?')
    }
    if (c.friend) {
      const fn = c.friend.name.toLowerCase()
      if (c.friend.seenMinAgo > 6) add(2 + c.traits.social, `i haven't seen ${fn} since ${c.friend.lastPlace ?? 'this morning'}.`)
      else add(1.5, `${fn} always knows where to go.`)
      if (c.action === 'FOLLOW') add(3, `swimming behind ${fn} is easier.`)
    }
    for (const n of c.nearby.slice(0, 3)) {
      const nn = n.name.toLowerCase()
      if (n.relation === 'stranger') add(0.25, `who is ${nn}? i haven't seen that one before.`)
      if (n.relation === 'hostile' || n.relation === 'afraid') add(1.6, `${nn} again.`)
      if (n.bigger && c.traits.bravery < 0.4) add(1.2, `${nn} is very large up close.`)
      if (n.action === 'REST') add(0.6, `${nn} is sleeping. i'll be quiet.`)
    }

    // exploration & discovery
    if (c.lastDiscovery && c.lastDiscovery.minAgo < 8) {
      const d = c.lastDiscovery.name
      add(4, c.lastDiscovery.transient ? `${d} wasn't here before.` : `how did i never notice ${d} before?`)
      add(2.5, `i should tell someone about ${d}.`)
    }
    if (c.action === 'INVESTIGATE' || c.action === 'EXPLORE') {
      add(1.6 + c.traits.curiosity, `something is moving behind ${place ?? 'the tall grass'}.`)
      if (fav) add(1.5, `i want to see ${fav} again.`)
      add(1, 'there has to be more tank past the glass.')
    }
    if (c.bubblesNearby) add(2 + c.traits.curiosity, 'the bubbles near the old rock changed again. i should see where they come from.')
    if (fav && c.location.includes(fav.replace(/^the /, ''))) add(2, `${fav} is still the best place in here.`)

    // memories
    for (const m of c.recentMemories.slice(0, 3)) {
      if (m.minAgo < 1 || m.minAgo > 45) continue
      const when = m.minAgo < 2 ? 'a minute ago' : m.minAgo < 15 ? 'a little while ago' : 'earlier'
      add(0.9, `${when} i ${m.text}. i keep thinking about it.`)
    }

    // the market, as felt from inside the water
    if (c.market === 'euphoric') {
      add(2.5, 'the water tastes green today. everyone is swimming faster.')
      add(1.5, "the feeder can't stop. i'm not complaining.")
    } else if (c.market === 'bullish') {
      add(1.5, 'the current feels warm and green.')
      add(1, 'something good is happening above the surface.')
    } else if (c.market === 'bearish') {
      add(1.8, "the water has a red taste. i don't trust it.")
      add(1.2, 'less food lately. the big ones are getting short-tempered.')
    } else if (c.market === 'panic') {
      add(3.5, `everything is red. find ${c.traits.bravery < 0.5 ? 'the cave' : 'somewhere quiet'}.`)
      add(2.5, 'the whole tank flinched at once.')
    }

    // personality colour
    if (c.traits.curiosity > 0.75) add(0.8, 'every corner has a smaller corner inside it.')
    if (c.traits.aggression > 0.7) add(0.8, 'the others swim like they own the water.')
    if (c.traits.social < 0.25) add(0.8, 'quiet is a kind of company.')
    add(0.4, `${c.location}. that's where i am.`)
    add(0.3, 'the glass is cold on this side.')

    // remove recently used thoughts
    const fresh = cands.filter((x) => !c.previousThoughts.includes(x.text))
    const pool = fresh.length ? fresh : cands
    const rand = mulberry32(hashString(c.fishId) ^ (c.seq * 2654435761))
    const total = pool.reduce((s, x) => s + x.w, 0)
    let r = rand() * total
    for (const x of pool) {
      r -= x.w
      if (r <= 0) return x.text.toLowerCase()
    }
    return (pool[pool.length - 1]?.text ?? '...').toLowerCase()
  }
}

/**
 * Adapter for an LLM-backed generator. POSTs the context JSON to an endpoint
 * that returns `{ "thought": string }`. Falls back to the local generator on
 * any failure, and rate limits itself so the simulation never waits on it.
 *
 * Enable by setting NEXT_PUBLIC_THOUGHT_ENDPOINT, e.g. to a route that calls
 * your LLM of choice with the context as the prompt.
 */
export class RemoteThoughtGenerator implements ThoughtGenerator {
  readonly name = 'remote'
  private inflight = 0
  private lastCall = 0

  constructor(
    private endpoint: string,
    private fallback: ThoughtGenerator = new LocalThoughtGenerator(),
    private minIntervalMs = 2500,
  ) {}

  async generate(ctx: ThoughtContext): Promise<string> {
    const now = Date.now()
    if (this.inflight > 0 || now - this.lastCall < this.minIntervalMs) return this.fallback.generate(ctx)
    this.inflight++
    this.lastCall = now
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ctx),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { thought?: string }
      const t = (data.thought ?? '').trim().toLowerCase().slice(0, 160)
      return t || this.fallback.generate(ctx)
    } catch {
      return this.fallback.generate(ctx)
    } finally {
      this.inflight--
    }
  }
}

export function createThoughtGenerator(): ThoughtGenerator {
  const endpoint = process.env.NEXT_PUBLIC_THOUGHT_ENDPOINT
  return endpoint ? new RemoteThoughtGenerator(endpoint) : new LocalThoughtGenerator()
}
