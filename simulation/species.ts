import type { SpeciesId } from '@/types/fish'

export interface SpeciesDef {
  id: SpeciesId
  name: string
  /** body length in world units */
  length: number
  /** body height as fraction of length */
  bodyRatio: number
  maxSpeed: number
  /** fraction of maxSpeed used when cruising */
  cruise: number
  accel: number
  /** max heading change rad/s */
  turnRate: number
  schooling: number
  aggression: number
  territoriality: number
  /** preferred depth band, 0 = surface, 1 = bottom */
  depth: [number, number]
  activity: number
  /** hunger gain multiplier */
  appetite: number
  perception: number
  color: string
  accent: string
  /** single-line glyph, facing right */
  ascii: string
  /** tank rendering art, facing right; may be several lines */
  art: string[]
  traits: string[]
  description: string
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  'neon-tetra': {
    id: 'neon-tetra',
    name: 'Neon Tetra',
    length: 78,
    bodyRatio: 0.3,
    maxSpeed: 115,
    cruise: 0.45,
    accel: 220,
    turnRate: 5.5,
    schooling: 0.95,
    aggression: 0.05,
    territoriality: 0.05,
    depth: [0.35, 0.65],
    activity: 0.85,
    appetite: 1,
    perception: 260,
    color: '#3ad7ff',
    accent: '#ff3b4e',
    ascii: '><(((°>',
    art: ['><(((°>'],
    traits: ['high schooling', 'high speed', 'middle depth', 'low aggression'],
    description: 'Small, quick, and almost never alone. Reads the shoal before it reads the water.',
  },
  guppy: {
    id: 'guppy',
    name: 'Guppy',
    length: 78,
    bodyRatio: 0.32,
    maxSpeed: 95,
    cruise: 0.5,
    accel: 200,
    turnRate: 5,
    schooling: 0.55,
    aggression: 0.1,
    territoriality: 0.1,
    depth: [0.1, 0.5],
    activity: 0.9,
    appetite: 1.15,
    perception: 240,
    color: '#ff8a3d',
    accent: '#5ec8ff',
    ascii: '}}<((°>',
    art: ['}}<((°>'],
    traits: ['medium schooling', 'restless', 'upper depth', 'big appetite'],
    description: 'Curious surface-skimmers with fan tails. Always the first to notice food.',
  },
  betta: {
    id: 'betta',
    name: 'Betta',
    length: 100,
    bodyRatio: 0.34,
    maxSpeed: 70,
    cruise: 0.35,
    accel: 140,
    turnRate: 3.2,
    schooling: 0.04,
    aggression: 0.75,
    territoriality: 0.9,
    depth: [0.1, 0.55],
    activity: 0.45,
    appetite: 0.9,
    perception: 280,
    color: '#c2185b',
    accent: '#5b6cff',
    ascii: '{{<((((°>',
    art: ['{{<((((°>'],
    traits: ['low schooling', 'medium speed', 'upper/middle depth', 'high territoriality'],
    description: 'Long-finned and proud. Claims a place and patrols it with great seriousness.',
  },
  clownfish: {
    id: 'clownfish',
    name: 'Clownfish',
    length: 78,
    bodyRatio: 0.44,
    maxSpeed: 80,
    cruise: 0.4,
    accel: 170,
    turnRate: 4.2,
    schooling: 0.25,
    aggression: 0.45,
    territoriality: 0.7,
    depth: [0.5, 0.88],
    activity: 0.6,
    appetite: 1,
    perception: 220,
    color: '#ff7a1a',
    accent: '#ffffff',
    ascii: '><|||°>',
    art: ['><|||°>'],
    traits: ['low schooling', 'stays near shelter', 'lower depth', 'territorial'],
    description: 'Keeps close to shelter and defends it. Forms pairs more often than groups.',
  },
  angelfish: {
    id: 'angelfish',
    name: 'Angelfish',
    length: 68,
    bodyRatio: 0.55,
    maxSpeed: 55,
    cruise: 0.38,
    accel: 100,
    turnRate: 2.4,
    schooling: 0.5,
    aggression: 0.35,
    territoriality: 0.45,
    depth: [0.3, 0.65],
    activity: 0.4,
    appetite: 0.9,
    perception: 300,
    color: '#d9dde3',
    accent: '#1d2430',
    ascii: '><{{{°>',
    art: ['  /|  ', '<(((°>', '  \\|  '],
    traits: ['medium schooling', 'slow movement', 'middle depth', 'medium territoriality'],
    description: 'Tall, slow and deliberate. Glides more than it swims.',
  },
  goldfish: {
    id: 'goldfish',
    name: 'Goldfish',
    length: 100,
    bodyRatio: 0.55,
    maxSpeed: 60,
    cruise: 0.4,
    accel: 110,
    turnRate: 2.8,
    schooling: 0.3,
    aggression: 0.15,
    territoriality: 0.1,
    depth: [0.5, 0.95],
    activity: 0.55,
    appetite: 1.45,
    perception: 240,
    color: '#ff9f1c',
    accent: '#ffd166',
    ascii: '><((((°)>',
    art: ['><((((°)>'],
    traits: ['low schooling', 'forager', 'lower depth', 'always hungry'],
    description: 'A patient forager. Spends its days sifting the sand for anything edible.',
  },
  'zebra-danio': {
    id: 'zebra-danio',
    name: 'Zebra Danio',
    length: 78,
    bodyRatio: 0.26,
    maxSpeed: 135,
    cruise: 0.55,
    accel: 260,
    turnRate: 6,
    schooling: 0.85,
    aggression: 0.2,
    territoriality: 0.05,
    depth: [0.05, 0.4],
    activity: 1,
    appetite: 1.1,
    perception: 250,
    color: '#e8d27a',
    accent: '#2b3f8f',
    ascii: '><≡≡≡°>',
    art: ['><≡≡≡°>'],
    traits: ['high schooling', 'very high speed', 'surface depth', 'never still'],
    description: 'Striped sprinters of the upper water. Restless, social, and a little chaotic.',
  },
  'cherry-barb': {
    id: 'cherry-barb',
    name: 'Cherry Barb',
    length: 78,
    bodyRatio: 0.38,
    maxSpeed: 90,
    cruise: 0.45,
    accel: 190,
    turnRate: 4.8,
    schooling: 0.7,
    aggression: 0.1,
    territoriality: 0.15,
    depth: [0.5, 0.85],
    activity: 0.7,
    appetite: 1,
    perception: 230,
    color: '#e0313f',
    accent: '#5a1520',
    ascii: '><(((•>',
    art: ['><(((•>'],
    traits: ['medium-high schooling', 'peaceful', 'lower-middle depth', 'likes plants'],
    description: 'Quiet, red, and fond of planted corners. Schools loosely and shyly.',
  },
}

export const SPECIES_LIST: SpeciesDef[] = Object.values(SPECIES)

/** mirror an ascii fish so it faces left */
export function asciiLeft(s: string): string {
  const swap: Record<string, string> = { '<': '>', '>': '<', '(': ')', ')': '(', '{': '}', '}': '{', '/': '\\', '\\': '/' }
  return s
    .split('')
    .reverse()
    .map((c) => swap[c] ?? c)
    .join('')
}
