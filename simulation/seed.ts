import type { WorldState } from '@/types/simulation'
import { DAY_LENGTH_MS } from './environment'
import { WORLD_VERSION } from '@/lib/storage'

const HOUR = 3_600_000

/** An empty tank. Every fish arrives as a coin launched from the site. */
export function createSeedWorld(): WorldState {
  const now = Date.now()
  // open in daylight
  const worldTime = 6 * 24 * HOUR + Math.floor((0.12 + Math.random() * 0.15) * DAY_LENGTH_MS)
  return {
    version: WORLD_VERSION,
    createdAt: now,
    worldTime,
    savedAt: now,
    fish: [],
    schools: [],
    curiosities: [],
    food: [],
    counters: {
      interactions: 0,
      discoveries: 0,
      meals: 0,
      nextEventId: 1,
      nextFoodId: 1,
      nextSchoolNum: Math.floor(Math.random() * 12),
      lastFeedAt: worldTime,
      nextFeedAt: worldTime + 45_000,
      nextCuriosityAt: worldTime + 60_000,
    },
    events: [],
    firstFinds: {},
    territories: {},
    lastPhase: '',
    conversations: [],
    escape: { stage: 0, notes: [], attempts: 0 },
  }
}
