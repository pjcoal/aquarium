// Runs the simulation without a browser and prints a summary. `npx tsx scripts/headless.ts [minutes]`
import { Engine } from '../simulation/engine'
import { createSeedWorld } from '../simulation/seed'

import type { CoinRecord } from '../types/coin'
import { SPECIES_LIST } from '../simulation/species'
import { PRESET_LIST } from '../simulation/fish'

const minutes = Number(process.argv[2] ?? 20)
const e = new Engine(createSeedWorld())
// a tank of 24 made-up coins
const names = ['Luna', 'Milo', 'Nova', 'Finn', 'Atlas', 'Coral', 'Pip', 'Juno', 'Orin', 'Kesh', 'Wren', 'Ivo', 'Sable', 'Tull', 'Mira', 'Basil', 'Echo', 'Fable', 'Gus', 'Hollis', 'Ines', 'Jet', 'Koi', 'Lark']
e.syncRoster(
  names.map((n, i): CoinRecord => ({
    mint: `mint${i}`.padEnd(32, 'x'),
    name: n,
    symbol: n.toUpperCase().slice(0, 4),
    description: '',
    image: null,
    metadataUri: '',
    creator: 'creator',
    model: 'claude-haiku-4-5',
    species: SPECIES_LIST[i % SPECIES_LIST.length].id,
    color: SPECIES_LIST[i % SPECIES_LIST.length].color,
    preset: PRESET_LIST[(i * 3) % PRESET_LIST.length],
    personalityText: '',
    createdAt: Date.now() - 3_600_000,
    createSig: '',
    feeSig: '',
  })),
)
const t0 = performance.now()
const steps = minutes * 60 * 30
for (let i = 0; i < steps; i++) e.step(1 / 30)
const ms = performance.now() - t0
const w = e.world
console.log(`simulated ${minutes} min in ${ms.toFixed(0)}ms (${((ms / steps) * 1000).toFixed(1)}µs/step)`)
console.log(`fish ${w.fish.length} schools ${w.schools.length} interactions ${w.counters.interactions} discoveries ${w.counters.discoveries} meals ${w.counters.meals} events ${w.events.length}`)
const cats: Record<string, number> = {}
for (const ev of w.events) cats[ev.cat] = (cats[ev.cat] ?? 0) + 1
console.log(cats)
for (const ev of w.events.slice(-45)) console.log(`${(ev.wt / 60000 % 1440).toFixed(1).padStart(7)}m [${ev.cat}] ${ev.text}`)
console.log('--- schools')
for (const s of w.schools) console.log(s.name, s.members.map((id) => e.byId.get(id)?.name).join(','), s.territory)
console.log('--- fish')
for (const f of w.fish) console.log(f.name.padEnd(6), f.action.padEnd(11), f.mood.padEnd(9), `E${f.energy.toFixed(2)} H${f.hunger.toFixed(2)}`, f.actionDetail, '|', f.lastThought, `| x${f.pos.x.toFixed(0)} y${f.pos.y.toFixed(0)}`, f.territoryId ?? '')
const actions: Record<string, number> = {}
for (const f of w.fish) actions[f.action] = (actions[f.action] ?? 0) + 1
console.log('actions now', actions)
console.log('territories', Object.entries(w.territories).map(([p, id]) => `${p}:${e.byId.get(id)?.name}`).join(' '))
const perMin: number[] = []
for (const ev of w.events) { const m = Math.floor((ev.wt - w.events[0].wt) / 60000); perMin[m] = (perMin[m] ?? 0) + 1 }
console.log('events/min', perMin.join(' '))
