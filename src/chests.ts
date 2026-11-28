// Chest tiers (DESIGN.md "The world", step 11.3): every room's chest is wood, bronze,
// silver or gold, and the better the chest the better the rarities on its cards.
// A normal fight rolls wood, bronze or silver, leaning towards the better ones deeper
// into the run; a challenge met or an elite level cleared gives gold.
//
// This file is only data and small rules; it imports nothing, so loot.ts can use it.

export type ChestTier = 'wood' | 'bronze' | 'silver' | 'gold';

export interface ChestTierDef {
  label: string; // "Silver Chest"
  // the rarities are rolled as if the chest stood this many levels deeper in the run
  boost: number;
  // the lowest rarity it can hold, as RARITY's tier (1 common, 2 uncommon, 3 rare)
  min: number;
  // how it is drawn: the bands' gradient, top to bottom, and the light it gives off
  metal: [string, string, string, string];
  glow: number;
  css: string; // its colour in text
}

export const CHEST_TIERS: Record<ChestTier, ChestTierDef> = {
  wood: { label: 'Wooden Chest', boost: 0, min: 1, metal: ['#9aa0a8', '#5e646c', '#33373d', '#80868e'], glow: 0xffd8a0, css: '#c8a27a' },
  bronze: { label: 'Bronze Chest', boost: 2, min: 2, metal: ['#ffd0a0', '#c07a3a', '#6a3a12', '#e0a060'], glow: 0xffb070, css: '#e09a5a' },
  silver: { label: 'Silver Chest', boost: 4, min: 2, metal: ['#ffffff', '#c8d4e0', '#6a7a8c', '#e8f0f8'], glow: 0xd8ecff, css: '#d8e4f0' },
  gold: { label: 'Gold Chest', boost: 8, min: 3, metal: ['#fff1b8', '#e0b04a', '#8a5f1a', '#f0cf78'], glow: 0xffe6a0, css: '#f0c860' },
};

export const TIER_ORDER: ChestTier[] = ['wood', 'bronze', 'silver', 'gold'];

// The chest of a normal fight at this depth in the run (world.ts `depth`, from 1):
// mostly wood at first, silver about one in four by the third area.
export function rollChestTier(depth: number, rand: () => number = Math.random): ChestTier {
  const w: [ChestTier, number][] = [
    ['wood', Math.max(10, 70 - 6 * depth)],
    ['bronze', 25 + 2 * depth],
    ['silver', 5 + 2.5 * depth],
  ];
  let r = rand() * w.reduce((n, [, x]) => n + x, 0);
  for (const [k, x] of w) if ((r -= x) <= 0) return k;
  return 'wood';
}
