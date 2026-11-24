// The weapon types (DESIGN.md, "No classes: the weapon is the playstyle").
//
// Each type is one entry in WEAPONS: what it is called, whether it blocks, its
// light combo and heavy attack, and the skills a weapon of that type can carry.
// A move either swings (hits what is in reach when it lands) or shoots (sends a
// shot out when it lands; shots.ts flies it). Skills are in SKILLS, and how each
// one plays out is in skills.ts.
//
// A new weapon type is a new entry here, an icon in ui/items.ts and a held part
// in rig/weapons.ts; Player reads everything else from this list. A weapon with a
// magazine (`mag`) reloads by itself once the moves marked `ammo` have spent it.
import type { AttackSpec } from './scenes/RoomScene';

export type WeaponKind = 'sword' | 'greatsword' | 'blades' | 'bow' | 'staff' | 'wand' | 'blunderbuss' | 'revolvers';
export type SkillId = 'shieldCharge' | 'leapSlam' | 'bladeStorm' | 'rainOfArrows' | 'blizzard' | 'sparkVolley' | 'cannonBlast' | 'fanTheHammer';

// What a move sends out instead of swinging.
export interface ShotSpec {
  look: 'arrow' | 'bolt' | 'orb' | 'spark' | 'pellet' | 'bullet'; // pellet and bullet leave a muzzle flash
  speed: number; // pixels a second
  reach: number; // pixels before it falls or fades
  pierce?: boolean; // goes on through everything in its line
  burst?: { rx: number; ry: number }; // bursts where it stops, hitting all around
  spread?: { count: number; lean: number }; // several at once, fanned out up and down the floor
  homing?: number; // turns towards the nearest foe, radians a second
  show?: boolean; // only for the look: hits nothing (a skill does its own hitting)
}

export interface Move extends AttackSpec {
  anim: 'attack' | 'heavy' | 'throw';
  dur: number; // whole move, seconds
  hitAt: number; // when the blow lands or the shot leaves
  lunge: number; // pixels stepped forward before it lands
  shot?: ShotSpec;
  sweep?: boolean; // cuts everything it passes during the lunge, not only at the end (a dash)
  recoil?: number; // pushed back this hard (pixels a second) when the shot leaves
  evade?: boolean; // untouchable until it lands (a hop away)
  ammo?: boolean; // spends a round from the weapon's magazine
}

export interface WeaponDef {
  label: string; // the type's name on cards
  noun: string; // what one is called ("Gravecut Sword")
  speed: string;
  blurb: string;
  block: boolean; // L raises a shield
  mag?: { size: number; reload: number }; // rounds before a reload, and its seconds
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
  // quick and close: a fast four-cut combo, a dash that cuts through
  blades: {
    label: 'Dual Blades', noun: 'Blades', speed: 'Fast', block: false,
    blurb: 'A blade in each hand: a fast four-cut combo, and a dash that cuts through everything in its path.',
    light: [
      { anim: 'attack', dur: 0.15, hitAt: 0.06, dmg: 5, range: 46, depth: 20, knock: 30, lunge: 12, stop: 22 },
      { anim: 'attack', dur: 0.15, hitAt: 0.06, dmg: 5, range: 46, depth: 20, knock: 30, lunge: 12, stop: 22 },
      { anim: 'attack', dur: 0.15, hitAt: 0.06, dmg: 6, range: 46, depth: 20, knock: 40, lunge: 12, stop: 22 },
      { anim: 'heavy', dur: 0.28, hitAt: 0.11, dmg: 12, range: 54, depth: 22, knock: 200, lunge: 30, heavy: true, stop: 60 },
    ],
    heavy: { anim: 'heavy', dur: 0.42, hitAt: 0.2, dmg: 16, range: 40, depth: 24, knock: 160, lunge: 120, heavy: true, sweep: true },
    skills: ['bladeStorm'],
    names: ['Nightfang', 'Twinshade', 'Ravencut', 'Gloomkiss', 'Ashwhisper'],
    legendary: 'Sorrow and Solace, the Mourning Pair',
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
  // quick one-handed casting: rapid sparks, a fan of three for the heavy
  wand: {
    label: 'Wand', noun: 'Wand', speed: 'Ranged, fast', block: false,
    blurb: 'Rapid sparks from afar; the heavy throws a fan of three that spreads across the floor.',
    light: [
      { anim: 'throw', dur: 0.24, hitAt: 0.1, dmg: 5, range: 0, depth: 16, knock: 40, lunge: 0, stop: 22, shot: { look: 'spark', speed: 620, reach: 380 } },
    ],
    heavy: { anim: 'throw', dur: 0.5, hitAt: 0.28, dmg: 11, range: 0, depth: 18, knock: 120, lunge: 0, heavy: true, shot: { look: 'spark', speed: 560, reach: 400, spread: { count: 3, lean: 0.35 } } },
    skills: ['sparkVolley'],
    names: ['Duskwillow', 'Sparkthorn', 'Witchbriar', 'Glimmerbone', 'Hexwood'],
    legendary: 'Cinderwisp, the Wand That Remembers',
  },
  // close and brutal: a cone of pellets that throws foes back, and her with it
  blunderbuss: {
    label: 'Blunderbuss', noun: 'Blunderbuss', speed: 'Slow, close range', block: false,
    blurb: 'A cone of pellets at close range that hurls foes back; slow to reload, and it kicks.',
    light: [
      { anim: 'throw', dur: 0.62, hitAt: 0.16, dmg: 5, range: 0, depth: 22, knock: 380, lunge: 0, recoil: 120, shot: { look: 'pellet', speed: 950, reach: 200, spread: { count: 5, lean: 0.16 } } },
    ],
    heavy: { anim: 'throw', dur: 0.95, hitAt: 0.42, dmg: 8, range: 0, depth: 24, knock: 520, lunge: 0, heavy: true, recoil: 260, shot: { look: 'pellet', speed: 1000, reach: 230, spread: { count: 7, lean: 0.3 } } },
    skills: ['cannonBlast'],
    names: ['Thunderbell', 'Graveboom', 'Rustmaw', 'Powderkeg', 'Hollowpoint'],
    legendary: 'Doomsayer, the Bell That Tolls Once',
  },
  // a revolver in each hand: quick shots, six to a load, a hop back firing both
  revolvers: {
    label: 'Dual Revolvers', noun: 'Revolvers', speed: 'Ranged, fast', block: false,
    blurb: 'Quick shots from a revolver in each hand, six before a reload; the heavy hops back firing both.',
    mag: { size: 6, reload: 0.75 },
    light: [
      { anim: 'throw', dur: 0.2, hitAt: 0.06, dmg: 6, range: 0, depth: 16, knock: 50, lunge: 0, stop: 22, ammo: true, shot: { look: 'bullet', speed: 1150, reach: 560 } },
    ],
    heavy: { anim: 'throw', dur: 0.5, hitAt: 0.22, dmg: 12, range: 0, depth: 18, knock: 160, lunge: -90, heavy: true, evade: true, shot: { look: 'bullet', speed: 1150, reach: 560, spread: { count: 2, lean: 0.05 } } },
    skills: ['fanTheHammer'],
    names: ['Gravewhisper', 'Twinbark', 'Duskhammer', 'Ironvow', 'Lastlight'],
    legendary: 'Ember and Ash, the Widowmakers',
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
  bladeStorm: { name: 'Blade Storm', blurb: 'A whirl of quick cuts all around you.', cooldown: 7 },
  sparkVolley: { name: 'Spark Volley', blurb: 'Sparks burst out and seek the nearest foes.', cooldown: 8 },
  cannonBlast: { name: 'Cannon Blast', blurb: 'A huge blast that hurls everything ahead away, and you back with it.', cooldown: 8 },
  fanTheHammer: { name: 'Fan the Hammer', blurb: 'Six shots in a heartbeat, then the guns are freshly loaded.', cooldown: 7 },
};

// Weapon kinds from before 8.4, as a browser may still remember them (the rapier's
// place went to the dual blades in 8.5).
const OLD: Record<string, WeaponKind> = { longsword: 'sword', greatblade: 'greatsword', rapier: 'blades' };

export function asKind(k: string | null | undefined): WeaponKind | null {
  if (!k) return null;
  if (k in WEAPONS) return k as WeaponKind;
  return OLD[k] ?? null;
}
