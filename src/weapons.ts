// The weapon types (DESIGN.md, "No classes: the weapon is the playstyle").
//
// Each type is one entry in WEAPONS: what it is called, whether it blocks, its
// light combo and heavy attack, and the skills a weapon of that type can carry.
// A move either swings (hits what is in reach when it lands) or shoots (sends a
// shot out when it lands; shots.ts flies it). Skills are in SKILLS, and how each
// one plays out is in skills.ts.
//
// A new weapon type is a new entry here, an icon in ui/items.ts and a held part
// in rig/weapons.ts; Player reads everything else from this list.
import type { AttackSpec } from './scenes/RoomScene';

export type WeaponKind = 'sword' | 'greatsword' | 'bow' | 'staff';
export type SkillId = 'shieldCharge' | 'leapSlam' | 'rainOfArrows' | 'blizzard';

// What a move sends out instead of swinging.
export interface ShotSpec {
  look: 'arrow' | 'bolt' | 'orb';
  speed: number; // pixels a second
  reach: number; // pixels before it falls or fades
  pierce?: boolean; // goes on through everything in its line
  burst?: { rx: number; ry: number }; // bursts where it stops, hitting all around
}

export interface Move extends AttackSpec {
  anim: 'attack' | 'heavy' | 'throw';
  dur: number; // whole move, seconds
  hitAt: number; // when the blow lands or the shot leaves
  lunge: number; // pixels stepped forward before it lands
  shot?: ShotSpec;
}

export interface WeaponDef {
  label: string; // the type's name on cards
  noun: string; // what one is called ("Gravecut Sword")
  speed: string;
  blurb: string;
  block: boolean; // L raises a shield
  light: Move[]; // the combo, in order
  heavy: Move;
  skills: SkillId[]; // a weapon found carries one of these
  names: string[];
  legendary: string;
}

// Sizes are in room pixels at the arena scale (characters about 75 px tall).
// Damage here is before the weapon's own power and the gear's bonuses.
// depth: how far up or down the floor a swing or a shot still connects.
export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  sword: {
    label: 'Sword & Shield', noun: 'Sword', speed: 'Balanced', block: true,
    blurb: 'Three-strike combo, a heavy overhead blow, and a shield to block with.',
    light: [
      { anim: 'attack', dur: 0.28, hitAt: 0.11, dmg: 9, range: 58, depth: 22, knock: 80, lunge: 24 },
      { anim: 'attack', dur: 0.28, hitAt: 0.11, dmg: 10, range: 58, depth: 22, knock: 95, lunge: 24 },
      { anim: 'heavy', dur: 0.42, hitAt: 0.18, dmg: 17, range: 66, depth: 26, knock: 250, lunge: 56, heavy: true },
    ],
    heavy: { anim: 'heavy', dur: 0.58, hitAt: 0.33, dmg: 28, range: 74, depth: 28, knock: 320, lunge: 44, heavy: true },
    skills: ['shieldCharge'],
    names: ['Gravecut', 'Wardensteel', 'Mossbitten', 'Lanternlight', 'Oathbound'],
    legendary: 'Dawnwake, Blade of the First Light',
  },
  // slow and crushing, with reach; the heavy spins and hits both sides
  greatsword: {
    label: 'Greatsword', noun: 'Greatsword', speed: 'Slow', block: false,
    blurb: 'Slow, crushing two-handed blows with long reach; the heavy spins and hits all around.',
    light: [
      { anim: 'attack', dur: 0.4, hitAt: 0.18, dmg: 15, range: 78, depth: 28, knock: 140, lunge: 20 },
      { anim: 'attack', dur: 0.4, hitAt: 0.18, dmg: 16, range: 78, depth: 28, knock: 150, lunge: 20 },
      { anim: 'heavy', dur: 0.58, hitAt: 0.27, dmg: 27, range: 86, depth: 32, knock: 310, lunge: 40, heavy: true },
    ],
    heavy: { anim: 'heavy', dur: 0.74, hitAt: 0.42, dmg: 36, range: 92, depth: 34, knock: 350, lunge: 8, heavy: true, around: true },
    skills: ['leapSlam'],
    names: ['Ashen', 'Tombbreaker', 'Hollowed', 'Thornwood', 'Barrowking'],
    legendary: 'Fellmourn, the Spire-Cleaver',
  },
  // from a distance: quick arrows, a long draw for one that goes through a line
  bow: {
    label: 'Bow', noun: 'Bow', speed: 'Ranged', block: false,
    blurb: 'Quick arrows from afar; the heavy is a long draw that pierces a whole line.',
    light: [
      { anim: 'throw', dur: 0.32, hitAt: 0.14, dmg: 7, range: 0, depth: 16, knock: 60, lunge: 0, shot: { look: 'arrow', speed: 640, reach: 520 } },
    ],
    heavy: { anim: 'throw', dur: 0.78, hitAt: 0.56, dmg: 21, range: 0, depth: 18, knock: 200, lunge: 0, heavy: true, shot: { look: 'arrow', speed: 920, reach: 720, pierce: true } },
    skills: ['rainOfArrows'],
    names: ['Ashwood', 'Owlsight', 'Thornstring', 'Mistreach', 'Ravenfeather'],
    legendary: 'Whisper of the Drowned',
  },
  // magic bolts; the heavy is a slow orb that bursts where it stops
  staff: {
    label: 'Staff', noun: 'Staff', speed: 'Ranged', block: false,
    blurb: 'Magic bolts from afar; the heavy is a slow orb that bursts and hits all around.',
    light: [
      { anim: 'throw', dur: 0.4, hitAt: 0.18, dmg: 9, range: 0, depth: 18, knock: 70, lunge: 0, shot: { look: 'bolt', speed: 500, reach: 430 } },
    ],
    heavy: { anim: 'throw', dur: 0.86, hitAt: 0.6, dmg: 24, range: 0, depth: 22, knock: 260, lunge: 0, heavy: true, shot: { look: 'orb', speed: 380, reach: 380, burst: { rx: 66, ry: 28 } } },
    skills: ['blizzard'],
    names: ['Gloamwood', 'Emberheart', 'Rimefrost', 'Hollowroot', 'Starbound'],
    legendary: 'Lanternheart, Staff of the Last Ember',
  },
};

export const KINDS = Object.keys(WEAPONS) as WeaponKind[];

export interface SkillDef {
  name: string;
  blurb: string;
  cooldown: number; // seconds
}

// Every weapon's big signature move, on its own key (I, or LB on a controller).
// Numbers to tune are in skills.ts, next to how each one plays.
export const SKILLS: Record<SkillId, SkillDef> = {
  shieldCharge: { name: 'Shield Charge', blurb: 'Rush forward behind the shield, stunning everything in the way.', cooldown: 6 },
  leapSlam: { name: 'Leap Slam', blurb: 'Leap into the air and crash down in a ring of force.', cooldown: 8 },
  rainOfArrows: { name: 'Rain of Arrows', blurb: 'Arrows pepper a marked circle ahead from above.', cooldown: 9 },
  blizzard: { name: 'Blizzard', blurb: 'Ice falls over an area ahead, hurting and slowing all in it.', cooldown: 12 },
};

// Weapon kinds from before 8.4, as a browser may still remember them.
const OLD: Record<string, WeaponKind> = { longsword: 'sword', greatblade: 'greatsword', rapier: 'sword' };

export function asKind(k: string | null | undefined): WeaponKind | null {
  if (!k) return null;
  if (k in WEAPONS) return k as WeaponKind;
  return OLD[k] ?? null;
}
