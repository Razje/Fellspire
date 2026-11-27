// The run's shape as data (DESIGN.md, "The world"): five tiers of areas, a choice of
// two from the second tier on, five levels per area with the boss as the fifth, and
// the level types the party picks between at the rune gates.
//
// New areas start as the Blightwood recoloured (`look`): every scenery texture is
// copied once per area and washed in its colour (blightwood.ts, `areaKey`), and the
// moonlight, fireflies and rune light take the area's colours.

export type LevelType = 'normal' | 'challenge' | 'elite' | 'boss';

export interface AreaLook {
  grade: number; // the colour the scenery is washed in (its light and dark kept)
  amount: number; // how strongly, 0 = as painted
  sat: number; // saturation first, 1 = as painted
  bright: number; // brightness, 1 = as painted
  moon: number; // the light a character stands in away from fire
  flies: [number, number]; // what floats over the room
  rune: number; // the rune gates' light
}

export interface Area {
  id: string;
  name: string; // "The Sunken Mire"
  short: string; // for the plaque: "SUNKEN MIRE"
  tier: number; // 0 to 4: the order in the run
  enemies: string; // the objective's heading
  look: AreaLook;
  boss: { name: string; title: string; glade: string };
  won?: { title: string; line: string }; // the final area only: the victory screen
}

// Every area's boss is the Lantern Warden until it gets its own (11.6 to 11.11).
const WARDEN = { name: 'The Lantern Warden', title: 'Keeper of the Drowned Light', glade: "Warden's Glade" };

export const AREAS: Area[] = [
  {
    id: 'blightwood', name: 'The Blightwood', short: 'BLIGHTWOOD', tier: 0, enemies: 'The Restless Dead',
    look: { grade: 0xffffff, amount: 0, sat: 1, bright: 1, moon: 0xaebbe0, flies: [0xc8ff8a, 0x9cf7c8], rune: 0x3fe8dc },
    boss: WARDEN,
  },
  {
    id: 'gloomvine', name: 'Gloomvine', short: 'GLOOMVINE', tier: 1, enemies: 'The Overgrown',
    look: { grade: 0x3aa83a, amount: 0.55, sat: 1.1, bright: 0.9, moon: 0xa8d8a0, flies: [0xe8ff6a, 0xa8ff5a], rune: 0x8aff6a },
    boss: WARDEN,
  },
  {
    id: 'mire', name: 'The Sunken Mire', short: 'SUNKEN MIRE', tier: 1, enemies: 'The Drowned',
    look: { grade: 0x5a8a6a, amount: 0.6, sat: 0.45, bright: 1.05, moon: 0xb8c8b0, flies: [0xd8f0c8, 0xb0d8c0], rune: 0x9ad8b8 },
    boss: WARDEN,
  },
  {
    id: 'scorchreach', name: 'Scorchreach', short: 'SCORCHREACH', tier: 2, enemies: 'The Ash-Born',
    look: { grade: 0xff4a1a, amount: 0.6, sat: 1.1, bright: 1.0, moon: 0xe8b8a0, flies: [0xffa040, 0xff6020], rune: 0xff7a3a },
    boss: WARDEN,
  },
  {
    id: 'frostmere', name: 'Frostmere', short: 'FROSTMERE', tier: 2, enemies: 'The Frozen Dead',
    look: { grade: 0x8ac8ff, amount: 0.6, sat: 0.5, bright: 1.3, moon: 0xc8dcff, flies: [0xffffff, 0xd0ecff], rune: 0x9ad4ff },
    boss: WARDEN,
  },
  {
    id: 'diamond', name: 'The Diamond Hollow', short: 'DIAMOND HOLLOW', tier: 3, enemies: 'The Glittering Dead',
    look: { grade: 0xe0c8ff, amount: 0.5, sat: 0.2, bright: 1.4, moon: 0xd8e4ff, flies: [0xf0f8ff, 0xb8dcff], rune: 0xb8e4ff },
    boss: WARDEN,
  },
  {
    id: 'emerald', name: 'The Emerald Deep', short: 'EMERALD DEEP', tier: 3, enemies: 'The Green-Lit Dead',
    look: { grade: 0x1adf7a, amount: 0.6, sat: 1.2, bright: 1.0, moon: 0x9ce8b8, flies: [0x60ffa0, 0xb0ffd0], rune: 0x40ff90 },
    boss: WARDEN,
  },
  {
    id: 'fellspire', name: 'The Fellspire', short: 'FELLSPIRE', tier: 4, enemies: 'The Lich\'s Host',
    look: { grade: 0x7a6aff, amount: 0.55, sat: 0.6, bright: 1.1, moon: 0xc8c0ff, flies: [0xc8b8ff, 0x9ad4ff], rune: 0xb89aff },
    boss: WARDEN,
    won: { title: 'THE FELLSPIRE FALLS', line: 'falls before' },
  },
];

export const LEVELS_PER_AREA = 5; // the last is the boss
export const LAST_TIER = 4;

export function area(id: string): Area {
  return AREAS.find((a) => a.id === id) ?? AREAS[0];
}

// An area by id, or the first of a tier by number ("2"), for ?area= in the address.
export function findArea(q: string): Area {
  const t = Number(q);
  if (q.trim() !== '' && Number.isInteger(t)) return AREAS.find((a) => a.tier === t) ?? AREAS[0];
  return area(q.toLowerCase());
}

export function areasOfTier(tier: number): Area[] {
  return AREAS.filter((a) => a.tier === tier);
}

// How far into the run a level is, counting from 1: the waves, the foes' strength
// and the chest's rarities grow with it. Blightwood's levels are 1 to 4, the next
// area's first level is 5, and so on (the boss level counts as its area's last).
export function depth(tier: number, level: number): number {
  return tier * (LEVELS_PER_AREA - 1) + Math.min(level, LEVELS_PER_AREA - 1);
}

// The types on offer at the two gates out of a fight: never the same twice, and
// normal fights stay the most common.
export function rollGateTypes(rand: () => number = Math.random): [LevelType, LevelType] {
  const pool: LevelType[] = ['normal', 'normal', 'challenge', 'elite'];
  const a = pool[Math.floor(rand() * pool.length)];
  const rest = (['normal', 'challenge', 'elite'] as LevelType[]).filter((t) => t !== a);
  return [a, rest[Math.floor(rand() * rest.length)]];
}

export const LEVEL_LABEL: Record<LevelType, string> = {
  normal: 'Fight',
  challenge: 'Challenge',
  elite: 'Elite',
  boss: 'Boss',
};
