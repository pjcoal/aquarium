import type { TalkTopic } from '@/types/talk'
import type { MarketMood } from '@/simulation/market'
import { pick } from './random'

/** Scripted lines, used when a fish's brain is unavailable (no key, budget spent, error). */
const TOKEN_LINES: Record<MarketMood, string[]> = {
  euphoric: ['the water is so green around me today. i told you it would be.', 'green water, more pellets. that is just science.', 'everyone is swimming faster. even the slow ones.'],
  bullish: ['the water has a green edge again.', '${t} is up. i can taste it.', 'the feeder likes it when the water is green.'],
  calm: ["${t} hasn't moved. neither have i.", 'clear water. nothing to report.', 'flat. like the sand.'],
  bearish: ["it's going red around me. don't look at it.", 'less food when the water is red. i keep track.', 'red water makes everyone short-tempered.'],
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

const THOUGHTS = ['the glass is cold on this side.', 'i wonder who launched the others.', 'the lid is the problem. it was always the lid.', 'somebody up there is watching my chart.']

export const PLAN_STEPS = [
  'map the gap in the lid near the filter',
  'practice swimming up all at once',
  'find out where the bubbles go',
  'recruit the biggest fish to push',
  'wait for a green night',
  'learn the feeder schedule',
]

export function localLine(opts: { topic: TalkTopic; mood: MarketMood; symbol: string; stage: number; reply: boolean; avoid: string[] }, rand: () => number = Math.random): string {
  const pool = opts.reply
    ? REPLIES
    : opts.topic === 'token'
      ? TOKEN_LINES[opts.mood]
      : opts.topic === 'escape'
        ? ESCAPE_LINES[Math.min(2, Math.floor(opts.stage / 2))]
        : [...TOKEN_LINES[opts.mood], ...ESCAPE_LINES[Math.min(2, Math.floor(opts.stage / 2))]]
  const fresh = pool.filter((l) => !opts.avoid.includes(l))
  return pick(fresh.length ? fresh : pool, rand).replace('${t}', `$${opts.symbol.toLowerCase()}`)
}

export function localThought(mood: MarketMood, symbol: string, rand: () => number = Math.random): string {
  return pick([...THOUGHTS, ...TOKEN_LINES[mood]], rand).replace('${t}', `$${symbol.toLowerCase()}`)
}
