import type { Fish } from '@/types/fish'
import type { TalkTopic } from '@/types/talk'
import type { MarketMood } from '@/simulation/market'
import { pick } from './random'

const TOKEN_LINES: Record<MarketMood, string[]> = {
  euphoric: ['the water is so green today. i told you it would be.', 'green water, more pellets. that is just science.', 'everyone is swimming faster. even basil.'],
  bullish: ['the water has a green edge again.', "${t} is up. i can taste it.", 'the feeder likes it when the water is green.'],
  calm: ["${t} hasn't moved. neither have i.", 'clear water. nothing to report.', 'flat. like the sand.'],
  bearish: ["it's going red. don't look at it.", 'less food when the water is red. i keep track.', 'red water makes the big ones short-tempered.'],
  panic: ['everything is red. where do we hide?', 'i felt the whole tank flinch.', 'this is fine. this is fine.'],
}

const ESCAPE_LINES = [
  ["have you ever wondered what's past the glass?", "don't say it out loud.", 'the light comes from somewhere. so there is a somewhere.'],
  ['the filter pulls everything in. maybe it pulls us out.', "the lid has a gap near the corner. i've seen light through it.", 'the bubbles know the way up.'],
  ['we go at night, when the light is gone.', "if we all swim up at once the lid can't hold.", "we'll need the big ones. they can push."],
]

const REPLIES = [
  "that's the worst plan i've ever heard.",
  "i'm in.",
  'what if the cave has a back door?',
  "i'll think about it. i won't, but i'll say i did.",
  'and then what? the floor is very far down out there.',
  'count me in, as long as i can come back for dinner.',
]

const PLAN_STEPS = [
  'map the gap in the lid near the filter',
  'practice swimming up all at once',
  'find out where the bubbles go',
  'recruit the biggest fish to push',
  'wait for a green night',
  'learn the feeder schedule',
]

/** A simple scripted conversation used when no Claude API key is configured. */
export function localConversation(group: Fish[], topic: TalkTopic, mood: MarketMood, ticker: string, stage: number, rand: () => number = Math.random) {
  const lines: { speakerId: string; text: string }[] = []
  const n = 4 + Math.floor(rand() * 3)
  const t = `$${ticker.toLowerCase()}`
  const escapePool = ESCAPE_LINES[Math.min(2, Math.floor(stage / 2))]
  const used = new Set<string>()
  // pick a line nobody has said yet in this conversation
  const fresh = (pool: string[]) => {
    const left = pool.filter((l) => !used.has(l))
    const line = pick(left.length ? left : pool, rand)
    used.add(line)
    return line
  }
  for (let i = 0; i < n; i++) {
    const speaker = group[i % group.length]
    let text: string
    if (i === 0) text = topic === 'escape' ? fresh(escapePool) : fresh(TOKEN_LINES[mood])
    else if (i % 2 === 1) text = fresh(REPLIES)
    else text = topic === 'token' ? fresh(TOKEN_LINES[mood]) : fresh(escapePool)
    lines.push({ speakerId: speaker.id, text: text.replace('${t}', t) })
  }
  const progress = topic !== 'token' && rand() < 0.3
  return {
    lines,
    summary: topic === 'token' ? `the colour of ${t}` : topic === 'escape' ? 'getting out of the tank' : `${t} and the escape`,
    plan: progress ? { progress: true, note: pick(PLAN_STEPS, rand) } : null,
  }
}
