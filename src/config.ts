// Tuning knobs that are likely to need adjusting once real art is in place.

export const WORLD = {
  viewW: 960,
  viewH: 540,
  roomW: 2400,
  // The walkable strip of ground, in screen pixels from the top.
  groundTop: 375,
  groundBottom: 515,
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
  hero: { label: 'Hero', height: 170, footY: 0.84, variant: 0, facesLeft: false },
  ghoul: { label: 'Ghoul', height: 150, footY: 0.84, variant: 0, facesLeft: false },
  archer: { label: 'Bone thrower', height: 155, footY: 0.84, variant: 0, facesLeft: false },
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
