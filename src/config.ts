// Tuning knobs that are likely to need adjusting once real art is in place.

// A room is an arena seen from above at an angle, as in Lost Castle 2: a deep
// floor taking most of the screen, small characters, a tree line behind. The
// room is a little larger than the screen, so the camera follows both ways.
export const WORLD = {
  viewW: 960,
  viewH: 540,
  roomW: 1500,
  roomH: 660,
  // The walkable floor, in room pixels from the top: groundTop is the tree
  // line at the back, groundBottom the front edge.
  groundTop: 292,
  groundBottom: 622,
};

// A zone is a few combat rooms, then the boss. (DESIGN.md plans 6 to 8 rooms later.)
export const ZONE = { bossRoom: 4 };

// The circle of light in the Warden's second phase, in room pixels.
export const DARK = {
  startRadius: 400,
  endRadius: 160,
  shrinkSeconds: 45,
  squash: 0.55, // the circle lies on a floor seen at an angle: an ellipse this flat
  damage: 3, // per tick, standing in the dark
  tick: 0.5,
};

export type CharKey = 'hero' | 'ghoul' | 'archer';

export interface CharConfig {
  label: string;
  // Height in pixels of one whole animation frame on screen, padding included.
  height: number;
  // Where the feet are inside a frame, 0 = top, 1 = bottom. CraftPix frames
  // have empty space below the feet; node tools/measure-feet.mjs measures it.
  footY: number;
  // Many packs hold several colour variants (Zombie_Villager_1, _2, _3).
  // 0 picks the first one alphabetically.
  variant: number;
  // CraftPix chibi characters face right. Set true for art that faces left.
  facesLeft: boolean;
}

export const CHARACTERS: Record<CharKey, CharConfig> = {
  hero: { label: 'Hero', height: 100, footY: 0.84, variant: 0, facesLeft: false },
  ghoul: { label: 'Ghoul', height: 92, footY: 0.84, variant: 0, facesLeft: false },
  archer: { label: 'Bone thrower', height: 94, footY: 0.84, variant: 0, facesLeft: false },
};

// Which folder names in a pack feed which animation, first match wins.
// Folder names are compared in lower case with _ and - turned into spaces.
export const ANIM_SOURCES: Record<string, string[]> = {
  idle: ['idle'],
  walk: ['walking', 'walk', 'running', 'run'],
  run: ['running', 'run', 'walking'],
  attack: ['slashing', 'attack', 'attacking', 'attack 1', 'attack1'],
  heavy: ['run slashing', 'slashing in the air', 'kicking', 'attack 2', 'attack2', 'slashing', 'attack'],
  throw: ['throwing', 'shooting', 'casting spells', 'slashing', 'attack'],
  dodge: ['sliding', 'jump start', 'running', 'run'],
  hurt: ['hurt', 'hit', 'take hit'],
  die: ['dying', 'dead', 'death', 'die'],
};

export const LOOPING = new Set(['idle', 'walk', 'run']);
