// The ember shrine at camp (DESIGN.md 10.2): an upgrade tree bought with embers
// and kept between runs, in three branches. Might is health and hitting hard,
// Grace is skills and the dodge, Fortune is gold, loot and getting back up.
//
// Every upgrade is a line of data in SHRINE: where it sits in its branch (row and
// column), which upgrade has to have a rank before it opens (`after`, any one of
// them), what each rank costs, and what it does (`fx`, `per` rank). Adding an
// upgrade is adding a line. What is bought is kept in the browser
// (`fellspire.shrine`), one tree for the party in co-op, like the ember bank.
//
// 10.2 buys and remembers them; 10.3 makes them count in a run (`shrineBonus`
// is what they add up to, ready for that).
import { embers, spendEmbers } from './embers';
import { describe, type Effect } from './loot';

export type Branch = 'might' | 'grace' | 'fortune';

export const BRANCHES: { id: Branch; name: string; colour: number; css: string; blurb: string }[] = [
  { id: 'might', name: 'Might', colour: 0xd8452e, css: '#ff6a4a', blurb: 'Health and heavy blows' },
  { id: 'grace', name: 'Grace', colour: 0x2fb8a8, css: '#7fe3d4', blurb: 'Skills and the dodge' },
  { id: 'fortune', name: 'Fortune', colour: 0xd8a830, css: '#ffd36a', blurb: 'Gold, loot and luck' },
];

// What an upgrade adds to: one of the gear effects (loot.ts), or one of the
// shrine's own (worked into the run in 10.3).
export type ShrineFx = Effect
  | 'skillCd' // fraction off skill cooldowns
  | 'dodgeTime' // milliseconds more untouchable in a dodge
  | 'gold' // fraction more gold
  | 'chestCard' // one more card to choose from at chests
  | 'startGold' // gold in the purse when a run begins
  | 'undying'; // once per run, get up from a fall with this fraction of health

export interface ShrineNode {
  id: string;
  branch: Branch;
  name: string;
  glyph: string; // the picture on its disc (ui/shrine.ts)
  row: number; // 0 at the top of the branch
  col: -1 | 0 | 1; // left, middle, right within the branch
  after?: string[]; // opens once any one of these has a rank
  cost: number[]; // embers for each rank; its length is the number of ranks
  fx: ShrineFx;
  per: number; // added per rank
}

export const SHRINE: ShrineNode[] = [
  // Might
  { id: 'vigour', branch: 'might', name: 'Vigour', glyph: 'heart', row: 0, col: 0, cost: [10, 20, 35], fx: 'maxHp', per: 10 },
  { id: 'edge', branch: 'might', name: 'Edge', glyph: 'sword', row: 1, col: -1, after: ['vigour'], cost: [15, 30, 50], fx: 'damage', per: 0.05 },
  { id: 'bulwark', branch: 'might', name: 'Bulwark', glyph: 'shield', row: 1, col: 1, after: ['vigour'], cost: [15, 30, 50], fx: 'armor', per: 0.04 },
  { id: 'keen', branch: 'might', name: 'Keen Strikes', glyph: 'star', row: 2, col: -1, after: ['edge'], cost: [25, 45, 70], fx: 'crit', per: 0.04 },
  { id: 'thorns', branch: 'might', name: 'Thornhide', glyph: 'thorn', row: 2, col: 1, after: ['bulwark'], cost: [25, 45, 70], fx: 'thorns', per: 3 },
  { id: 'executioner', branch: 'might', name: 'Executioner', glyph: 'skull', row: 3, col: -1, after: ['keen'], cost: [40, 70], fx: 'execute', per: 0.15 },
  { id: 'bloodthirst', branch: 'might', name: 'Bloodthirst', glyph: 'drop', row: 3, col: 1, after: ['thorns'], cost: [40, 70], fx: 'lifeOnKill', per: 2 },
  // Grace
  { id: 'focus', branch: 'grace', name: 'Focus', glyph: 'hourglass', row: 0, col: 0, cost: [10, 20, 35], fx: 'skillCd', per: 0.08 },
  { id: 'fleetfoot', branch: 'grace', name: 'Fleetfoot', glyph: 'wing', row: 1, col: -1, after: ['focus'], cost: [15, 30, 50], fx: 'dodgeTime', per: 40 },
  { id: 'swiftstep', branch: 'grace', name: 'Swift Step', glyph: 'boot', row: 1, col: 1, after: ['focus'], cost: [15, 30, 50], fx: 'dodgeCd', per: 0.06 },
  { id: 'kindling', branch: 'grace', name: 'Kindling', glyph: 'flame', row: 2, col: -1, after: ['fleetfoot'], cost: [25, 45, 70], fx: 'burn', per: 2 },
  { id: 'rime', branch: 'grace', name: 'Rime', glyph: 'snow', row: 2, col: 1, after: ['swiftstep'], cost: [25, 45, 70], fx: 'frost', per: 0.5 },
  { id: 'storm', branch: 'grace', name: 'Storm Touch', glyph: 'bolt', row: 3, col: 0, after: ['kindling', 'rime'], cost: [40, 70], fx: 'storm', per: 6 },
  // Fortune
  { id: 'greed', branch: 'fortune', name: 'Greed', glyph: 'coin', row: 0, col: 0, cost: [10, 20, 35], fx: 'gold', per: 0.1 },
  { id: 'keeneye', branch: 'fortune', name: 'Keen Eye', glyph: 'eye', row: 1, col: -1, after: ['greed'], cost: [60], fx: 'chestCard', per: 1 },
  { id: 'packed', branch: 'fortune', name: 'Packed Bags', glyph: 'bag', row: 1, col: 1, after: ['greed'], cost: [15, 30, 50], fx: 'startGold', per: 25 },
  { id: 'lucky', branch: 'fortune', name: 'Lucky Charm', glyph: 'clover', row: 2, col: 0, after: ['keeneye', 'packed'], cost: [25, 45, 70], fx: 'orbs', per: 0.2 },
  { id: 'undying', branch: 'fortune', name: 'Undying', glyph: 'phoenix', row: 3, col: 0, after: ['lucky'], cost: [90], fx: 'undying', per: 0.3 },
];

export const nodeById = (id: string) => SHRINE.find((n) => n.id === id);

const pct = (v: number) => `${Math.round(v * 100)}%`;

// What an upgrade does at a rank, in a line for its card.
export function fxLine(n: ShrineNode, rank: number): string {
  const v = Math.round(n.per * rank * 1000) / 1000;
  switch (n.fx) {
    case 'skillCd': return `Skills recharge ${pct(v)} faster`;
    case 'dodgeTime': return `Untouchable ${v} ms longer in a dodge`;
    case 'gold': return `+${pct(v)} gold`;
    case 'chestCard': return 'Chests offer a fourth card';
    case 'startGold': return `Every run starts with ${v} gold`;
    case 'undying': return `Once per run, rise from a fall with ${pct(v)} health`;
    default: return describe(n.fx, v);
  }
}

// ---- what has been bought -----------------------------------------------------------------

const KEY = 'fellspire.shrine';
let ranks: Record<string, number> | null = null;

function load(): Record<string, number> {
  if (!ranks) {
    ranks = {};
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      for (const n of SHRINE) {
        const r = Math.floor(Number(raw?.[n.id]) || 0);
        if (r > 0) ranks[n.id] = Math.min(r, n.cost.length);
      }
    } catch { /* storage blocked or garbled: start empty */ }
  }
  return ranks;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(ranks)); } catch { /* storage blocked */ }
}

export const rankOf = (id: string) => load()[id] ?? 0;
export const maxRank = (n: ShrineNode) => n.cost.length;

// Opened: at the top of its branch, or one of the upgrades above it has a rank.
export const isOpen = (n: ShrineNode) => !n.after || n.after.some((a) => rankOf(a) > 0);

// The price of the next rank, or null when it is full.
export function nextCost(n: ShrineNode): number | null {
  const r = rankOf(n.id);
  return r < n.cost.length ? n.cost[r] : null;
}

export type BuyState = 'ok' | 'max' | 'locked' | 'poor';

export function buyState(n: ShrineNode): BuyState {
  const c = nextCost(n);
  if (c === null) return 'max';
  if (!isOpen(n)) return 'locked';
  return embers() >= c ? 'ok' : 'poor';
}

// Buys the next rank: takes the embers and remembers it. False if it cannot be bought.
export function buyRank(id: string): boolean {
  const n = nodeById(id);
  if (!n || buyState(n) !== 'ok') return false;
  if (!spendEmbers(n.cost[rankOf(id)])) return false;
  load()[id] = rankOf(id) + 1;
  save();
  return true;
}

// Everything bought, added up by effect (for the run, 10.3).
export function shrineBonus(): Partial<Record<ShrineFx, number>> {
  const out: Partial<Record<ShrineFx, number>> = {};
  for (const n of SHRINE) {
    const r = rankOf(n.id);
    if (r > 0) out[n.fx] = (out[n.fx] ?? 0) + n.per * r;
  }
  return out;
}

// Embers spent on the tree so far.
export function shrineSpent(): number {
  return SHRINE.reduce((sum, n) => sum + n.cost.slice(0, rankOf(n.id)).reduce((a, b) => a + b, 0), 0);
}
