// Loot: what the room chest offers, and what your gear adds up to.
//
// A chest offers three cards of one category: three weapons, three armor kits or
// three trinkets, each of a random rarity. Weapons and armor replace what you
// carry; trinkets are kept, all of them.
//
// Every item is data: a category, a rarity, and a set of effects with strengths.
// gearStats() adds the effects of everything carried into one table the combat
// code reads. A new item or effect is a line in a list below, not new code paths.

export type Rarity = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type Category = 'weapon' | 'armor' | 'trinket';
export type { WeaponKind } from './weapons';
import { SKILLS, WEAPONS, type SkillId, type WeaponKind } from './weapons';

export const RARITY: Record<Rarity, { label: string; color: string; tint: number; tier: number }> = {
  poor: { label: 'Poor', color: '#9d9d9d', tint: 0x9d9d9d, tier: 0 },
  common: { label: 'Common', color: '#ffffff', tint: 0xe8e8e8, tier: 1 },
  uncommon: { label: 'Uncommon', color: '#1eff00', tint: 0x1eff00, tier: 2 },
  rare: { label: 'Rare', color: '#2f8cff', tint: 0x2f8cff, tier: 3 },
  epic: { label: 'Epic', color: '#b35cff', tint: 0xb35cff, tier: 4 },
  legendary: { label: 'Legendary', color: '#ff8000', tint: 0xff8000, tier: 5 },
};

// Chance of each rarity in a chest; later rooms lean towards the better ones.
function rollRarity(room: number, rnd: () => number): Rarity {
  const w: [Rarity, number][] = [
    ['common', Math.max(10, 44 - room * 4)], ['uncommon', 32], ['rare', 16 + room * 2], ['epic', 6 + room * 1.5], ['legendary', 1.5 + room * 0.5],
  ];
  let r = rnd() * w.reduce((n, [, x]) => n + x, 0);
  for (const [k, x] of w) if ((r -= x) <= 0) return k;
  return 'common';
}

// ---- effects ----------------------------------------------------------------------

export type Effect =
  | 'damage' // fraction more damage
  | 'crit' // chance of a double-damage hit
  | 'execute' // fraction more damage on foes below 30% health
  | 'lifeOnHit' // health per hit
  | 'lifeOnKill' // health per kill
  | 'burn' // heavy attacks leave burning ground, damage per tick
  | 'frost' // hits slow for this many seconds
  | 'storm' // every fifth hit chains lightning for this much damage
  | 'thorns' // damage back to whoever hits you in melee
  | 'dodgeCd' // fraction off the dodge cooldown
  | 'maxHp' // more health
  | 'armor' // fraction of damage taken away
  | 'secondWind' // once per room, heal this much when below 30%
  | 'orbs'; // fraction more healing from health orbs

export type Effects = Partial<Record<Effect, number>>;

// Effects that only the ember shrine gives (shrine.ts), worked into a run by
// their own small rules rather than by gear.
export type ShrineOnly =
  | 'skillCd' // fraction off skill cooldowns
  | 'dodgeTime' // milliseconds more untouchable in a dodge
  | 'gold' // fraction more gold
  | 'chestCard' // more cards to choose from at chests
  | 'startGold' // gold in the purse when a run begins
  | 'undying'; // once per run, get up from a fall with this fraction of health

export type Bonus = Partial<Record<Effect | ShrineOnly, number>>;

// How an effect reads on a card. "Equip:" lines in green, as in the MMOs.
export function describe(e: Effect, v: number): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  switch (e) {
    case 'damage': return `+${pct(v)} damage`;
    case 'crit': return `${pct(v)} chance to strike for double damage`;
    case 'execute': return `+${pct(v)} damage to foes below 30% health`;
    case 'lifeOnHit': return `Heals ${v} health with every hit`;
    case 'lifeOnKill': return `Heals ${v} health for every foe slain`;
    case 'burn': return `Heavy attacks leave burning ground (${v} per tick)`;
    case 'frost': return `Hits slow foes for ${v.toFixed(1)} seconds`;
    case 'storm': return `Every fifth hit calls lightning on another foe (${v})`;
    case 'thorns': return `Foes that strike you take ${v} damage`;
    case 'dodgeCd': return `Dodge ready ${pct(v)} sooner`;
    case 'maxHp': return `+${v} maximum health`;
    case 'armor': return `Takes ${pct(v)} less damage`;
    case 'secondWind': return `Once per room, heals ${v} when below 30% health`;
    case 'orbs': return `Health orbs heal ${pct(v)} more`;
  }
}

// ---- items ----------------------------------------------------------------------------

export interface Item {
  cat: Category;
  name: string;
  rarity: Rarity;
  icon: string; // icon name for the UI kit
  kind?: WeaponKind; // weapons
  power?: number; // weapons: damage multiplier
  skill?: SkillId; // weapons: the skill on the I key
  hp?: number; // armor: more health
  armor?: number; // armor: damage reduction
  effects: Effects;
}

// The weapon types themselves (moves, skills, names) are in weapons.ts.
export const WEAPON_KINDS = WEAPONS;

// Effects a weapon or armor kit can carry, and how strong each is at each tier (1-5).
const WEAPON_FX: [Effect, (t: number) => number][] = [
  ['lifeOnHit', (t) => Math.ceil(t / 2)],
  ['burn', (t) => 2 + t],
  ['frost', (t) => 0.8 + t * 0.3],
  ['storm', (t) => 8 + t * 4],
  ['execute', (t) => 0.3 + t * 0.1],
  ['crit', (t) => 0.06 + t * 0.03],
];
const ARMOR_FX: [Effect, (t: number) => number][] = [
  ['thorns', (t) => 3 + t * 2],
  ['secondWind', (t) => 12 + t * 5],
  ['dodgeCd', (t) => 0.1 + t * 0.05],
  ['orbs', (t) => 0.3 + t * 0.15],
];

interface TrinketDef { name: string; icon: string; fx: Effect; v: (t: number) => number }
const TRINKETS: TrinketDef[] = [
  { name: "Ghoul's Tooth", icon: 'tooth', fx: 'damage', v: (t) => 0.06 + t * 0.03 },
  { name: 'Owl Feather', icon: 'feather', fx: 'dodgeCd', v: (t) => 0.12 + t * 0.05 },
  { name: 'Bone Dice', icon: 'dice', fx: 'crit', v: (t) => 0.06 + t * 0.03 },
  { name: 'Moonlit Locket', icon: 'locket', fx: 'orbs', v: (t) => 0.4 + t * 0.2 },
  { name: 'Ember Ring', icon: 'ring', fx: 'burn', v: (t) => 2 + t },
  { name: 'Grave Salt', icon: 'vial', fx: 'execute', v: (t) => 0.3 + t * 0.12 },
  { name: 'Leech Charm', icon: 'vial', fx: 'lifeOnKill', v: (t) => 2 + t },
  { name: 'Iron Heart', icon: 'heart', fx: 'maxHp', v: (t) => 8 + t * 6 },
  { name: 'Storm Shard', icon: 'shard', fx: 'storm', v: (t) => 8 + t * 4 },
  { name: 'Frost Pearl', icon: 'pearl', fx: 'frost', v: (t) => 0.8 + t * 0.3 },
];

const ARMOR_NAMES = ['Leather Jerkin', 'Ringmail Hauberk', 'Graveguard Plate', 'Barrow-Lord Mail', 'Moonwoven Cuirass'];
const ARMOR_PREFIX = ['Patched', 'Sturdy', 'Warded', 'Gilded', 'Everlit'];

const pick = <T>(a: T[], rnd: () => number) => a[Math.floor(rnd() * a.length)];

// A plain weapon of a kind, as the camp's rack offers them before a run.
export function starterWeapon(kind: WeaponKind): Item {
  return { cat: 'weapon', name: `Worn ${WEAPONS[kind].noun}`, rarity: 'poor', icon: kind, kind, power: 1, skill: WEAPONS[kind].skills[0], effects: {} };
}

export const STARTING_WEAPON: Item = starterWeapon('sword');

export function makeWeapon(rarity: Rarity, rnd: () => number = Math.random, kind?: WeaponKind): Item {
  const t = RARITY[rarity].tier;
  const k = kind ?? pick(Object.keys(WEAPON_KINDS) as WeaponKind[], rnd);
  const effects: Effects = {};
  const fxCount = t >= 5 ? 2 : t >= 2 ? 1 : 0;
  const pool = [...WEAPON_FX];
  for (let i = 0; i < fxCount; i++) {
    const [e, f] = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    effects[e] = round(f(t));
  }
  const def = WEAPONS[k];
  const name = rarity === 'legendary' ? def.legendary : `${pick(def.names, rnd)} ${def.noun}`;
  return { cat: 'weapon', name, rarity, icon: k, kind: k, power: round(1 + 0.1 * t + rnd() * 0.06), skill: pick(def.skills, rnd), effects };
}

export function makeArmor(rarity: Rarity, rnd: () => number = Math.random): Item {
  const t = RARITY[rarity].tier;
  const effects: Effects = {};
  if (t >= 3) {
    const [e, f] = pick(ARMOR_FX, rnd);
    effects[e] = round(f(t));
  }
  const base = ARMOR_NAMES[Math.min(ARMOR_NAMES.length - 1, t - 1 + Math.floor(rnd() * 2))];
  return { cat: 'armor', name: `${ARMOR_PREFIX[t - 1]} ${base}`, rarity, icon: 'armor', hp: 8 + t * 8, armor: round(0.03 + t * 0.03), effects };
}

export function makeTrinket(rarity: Rarity, rnd: () => number = Math.random, exclude: string[] = []): Item {
  const t = RARITY[rarity].tier;
  const def = pick(TRINKETS.filter((d) => !exclude.includes(d.name)), rnd) ?? TRINKETS[0];
  return { cat: 'trinket', name: def.name, rarity, icon: def.icon, effects: { [def.fx]: round(def.v(t)) } };
}

// Three cards of one category. No two trinkets in one chest are the same.
// Keen Eye at the shrine adds a card (count).
export function rollChest(room: number, rnd: () => number = Math.random, cat?: Category, count = 3): Item[] {
  const c = cat ?? pick<Category>(['weapon', 'armor', 'trinket'], rnd);
  const out: Item[] = [];
  for (let i = 0; i < count; i++) {
    const r = rollRarity(room, rnd);
    if (c === 'weapon') out.push(makeWeapon(r, rnd));
    else if (c === 'armor') out.push(makeArmor(r, rnd));
    else out.push(makeTrinket(r, rnd, out.map((o) => o.name)));
  }
  return out;
}

const round = (x: number) => Math.round(x * 100) / 100;

// ---- what you carry --------------------------------------------------------------------

export interface Gear { weapon: Item; armor: Item | null; trinkets: Item[] }

export function newGear(): Gear {
  return { weapon: STARTING_WEAPON, armor: null, trinkets: [] };
}

export interface GearStats {
  power: number; // weapon damage multiplier
  kind: WeaponKind;
  skill: SkillId;
  fx: Required<Bonus>;
}

// What the gear adds up to, plus what the ember shrine gives (`bonus`, from
// shrineBonus(); the callers pass it, so this file does not reach into storage).
export function gearStats(g: Gear, bonus: Bonus = {}): GearStats {
  const fx: Required<Bonus> = {
    damage: 0, crit: 0, execute: 0, lifeOnHit: 0, lifeOnKill: 0, burn: 0, frost: 0, storm: 0, thorns: 0, dodgeCd: 0, maxHp: 0, armor: 0, secondWind: 0, orbs: 0,
    skillCd: 0, dodgeTime: 0, gold: 0, chestCard: 0, startGold: 0, undying: 0,
  };
  for (const it of [g.weapon, g.armor, ...g.trinkets]) {
    if (!it) continue;
    for (const [k, v] of Object.entries(it.effects)) fx[k as Effect] += v as number;
  }
  for (const [k, v] of Object.entries(bonus)) fx[k as keyof Bonus] += v ?? 0;
  if (g.armor) { fx.maxHp += g.armor.hp ?? 0; fx.armor += g.armor.armor ?? 0; }
  fx.armor = Math.min(0.6, fx.armor);
  fx.dodgeCd = Math.min(0.6, fx.dodgeCd);
  fx.crit = Math.min(0.6, fx.crit);
  const kind = g.weapon.kind ?? 'sword';
  return { power: g.weapon.power ?? 1, kind, skill: g.weapon.skill ?? WEAPONS[kind].skills[0], fx };
}

// The lines of a card or tooltip: [label, value, colour]. Compares against what is
// carried now where that makes sense.
export interface Line { label: string; value?: string; color?: string; equip?: boolean }

export function itemLines(it: Item, g: Gear | null): Line[] {
  const better = '#3cff3c', worse = '#ff4a3a', same = '#f0e6d2';
  const cmp = (now: number | undefined, next: number, fmt: (x: number) => string): Line['value'] =>
    now === undefined || now === next ? fmt(next) : `${fmt(now)}  »  ${fmt(next)}`;
  const col = (now: number | undefined, next: number) => (now === undefined || now === next ? same : next > now ? better : worse);
  const lines: Line[] = [];
  if (it.cat === 'weapon') {
    const now = g?.weapon;
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    lines.push({ label: 'Damage', value: cmp(now?.power, it.power!, pct), color: col(now?.power, it.power!) });
    lines.push({ label: 'Speed', value: WEAPON_KINDS[it.kind!].speed });
    lines.push({ label: WEAPONS[it.kind!].blurb, color: '#cfc5ae' });
    const sk = SKILLS[it.skill ?? WEAPONS[it.kind!].skills[0]];
    lines.push({ label: 'Skill (I)', value: sk.name, color: '#ffd100' });
    lines.push({ label: `${sk.blurb} Every ${sk.cooldown} s.`, color: '#cfc5ae' });
  } else if (it.cat === 'armor') {
    const now = g?.armor ?? undefined;
    lines.push({ label: 'Health', value: cmp(now?.hp ?? (g ? 0 : undefined), it.hp!, (x) => `+${x}`), color: col(now?.hp ?? (g ? 0 : undefined), it.hp!) });
    lines.push({ label: 'Armor', value: cmp(now?.armor ?? (g ? 0 : undefined), it.armor!, (x) => `${Math.round(x * 100)}%`), color: col(now?.armor ?? (g ? 0 : undefined), it.armor!) });
  }
  for (const [e, v] of Object.entries(it.effects)) lines.push({ label: describe(e as Effect, v as number), equip: true });
  return lines;
}
