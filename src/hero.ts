// The player's character: what they chose when making it, remembered in this
// browser, and how a Rig is dressed in it.
//
// The three Valkyrie colour variants share one rig, so their parts mix freely:
// the helmet comes from one, the eyes from another, the armour (chest, arms,
// legs and hands together) from a third. Skin tone recolours whatever skin the
// chosen parts show (rig/skin.ts). The weapon in her hand is put there by
// armRig (rig/weapons.ts) for the weapon carried.
import Phaser from 'phaser';
import { HERO_PARTS } from './config';
import { Rig } from './rig/Rig';
import { scmlOf } from './rig/parts';
import { SKIN_TONES, findSkin, recolourSkin } from './rig/skin';

export const HERO_SETS = ['Valkyrie_1', 'Valkyrie_2', 'Valkyrie_3'];

// What each choice is called on the creation screen, in HERO_SETS order.
export const HELMETS = ['Ironhorn Helm', 'Ravenwing Helm', 'Foxfur Hood'];
export const EYES = ['Green', 'Blue', 'Brown'];
export const ARMOURS = ['Stoneguard', 'Nightsteel', 'Wildscale'];

export interface HeroLook {
  name: string;
  helmet: number;
  eyes: number;
  armour: number;
  skin: number; // index into SKIN_TONES
}

export const NAME_MAX = 14;
// one saved hero per player: 0 is player 1 (and solo), 1 is player 2 in co-op
export type Who = 0 | 1;
const KEYS = ['fellspire.hero', 'fellspire.hero2'];

export const DEFAULT_LOOK: HeroLook = { name: 'Valkyrie', helmet: 0, eyes: 0, armour: 0, skin: 3 };

const NAMES = ['Astrid', 'Brynja', 'Eira', 'Freya', 'Hilde', 'Ingrid', 'Kara', 'Runa', 'Sigrun', 'Solveig', 'Thora', 'Ylva'];

export function randomLook(keepName?: string): HeroLook {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    name: keepName ?? NAMES[pick(NAMES.length)],
    helmet: pick(HERO_SETS.length), eyes: pick(HERO_SETS.length), armour: pick(HERO_SETS.length),
    skin: pick(SKIN_TONES.length),
  };
}

function valid(l: Partial<HeroLook>): l is HeroLook {
  const idx = (v: unknown, n: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  return typeof l.name === 'string' && l.name.trim().length > 0 && l.name.length <= NAME_MAX
    && idx(l.helmet, HERO_SETS.length) && idx(l.eyes, HERO_SETS.length) && idx(l.armour, HERO_SETS.length)
    && idx(l.skin, SKIN_TONES.length);
}

// The saved character, or null when none has been made in this browser yet.
export function savedLook(who: Who = 0): HeroLook | null {
  try {
    const raw = localStorage.getItem(KEYS[who]);
    if (raw) {
      const l = JSON.parse(raw);
      if (valid(l)) return l;
    }
  } catch {
    /* private window or blocked storage */
  }
  return null;
}

// The look to draw: the saved one, else the default. Storage can be blocked, so
// the last saved look is also kept here for this session.
const current: (HeroLook | null)[] = [null, null];
export function heroLook(who: Who = 0): HeroLook {
  return current[who] ?? savedLook(who) ?? DEFAULT_LOOK;
}

export function saveLook(l: HeroLook, who: Who = 0) {
  current[who] = { ...l, name: l.name.trim() };
  try {
    localStorage.setItem(KEYS[who], JSON.stringify(current[who]));
  } catch {
    /* not fatal: it lasts this session */
  }
}

// Has a character been made (this session or saved earlier)?
export function hasHero(who: Who = 0) {
  return current[who] !== null || savedLook(who) !== null;
}

// Loaded parts for every set? Without them the game draws the hero from frames.
export function heroPartsReady() {
  return HERO_SETS.every((v) => scmlOf(v));
}

// A part texture with its skin recoloured, made once per part and tone.
function skinned(scene: Phaser.Scene, src: string, tone: number): string {
  const key = `skin${tone}:${src}`;
  if (scene.textures.exists(key)) return key;
  const img = scene.textures.get(src).getSourceImage() as HTMLImageElement;
  const t = scene.textures.createCanvas(key, img.width, img.height)!;
  const c = t.getContext();
  c.drawImage(img, 0, 0);
  const data = c.getImageData(0, 0, img.width, img.height);
  if (findSkin(data.data)) {
    recolourSkin(data.data, img.width, img.height, SKIN_TONES[tone].rgb);
    c.putImageData(data, 0, 0);
  }
  t.refresh();
  return key;
}

const ARMOUR_PARTS = ['Body.png', 'Left Arm.png', 'Right Arm.png', 'Left Leg.png', 'Right Leg.png'];
const HANDS = ['Left Hand.png', 'Right Hand.png'];
const FACES = ['Face 01.png', 'Face 02.png', 'Face 03.png'];

// Swaps a rig's parts for the look's. The rig's own base set keeps the sword,
// shield and slash effect.
export function dressRig(rig: Rig, look: HeroLook) {
  const scene = rig.scene;
  const set = (i: number) => HERO_SETS[i];
  for (const f of ARMOUR_PARTS) rig.skin.set(f, { texture: `${set(look.armour)}/${f}` });
  for (const f of HANDS) rig.skin.set(f, { texture: skinned(scene, `${set(look.armour)}/${f}`, look.skin) });
  rig.skin.set('Head.png', { texture: skinned(scene, `${set(look.helmet)}/Head.png`, look.skin) });
  for (const f of FACES) rig.skin.set(f, { texture: `${set(look.eyes)}/${f}` });
  rig.step(0);
  return rig;
}

// A rig of the player's character (or the given look), or null without parts.
export function heroRig(scene: Phaser.Scene, x: number, y: number, size: number, look = heroLook()): Rig | null {
  const scml = scmlOf(HERO_PARTS);
  if (!scml || !heroPartsReady()) return null;
  return dressRig(new Rig(scene, x, y, scml, HERO_PARTS, size), look);
}
