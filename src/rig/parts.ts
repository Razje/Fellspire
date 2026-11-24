// Finds the unpacked character parts under assets/parts/<Variant>/ (made by
// tools/unpack-parts.py) and loads them: each part as a texture named
// "<Variant>/<file>", each variant's animation file as text.
import Phaser from 'phaser';
import { parseScml, type Scml } from './scml';

type Loader = () => Promise<unknown>;
const pngs = import.meta.glob('../../assets/parts/*/*.png', { query: '?url', import: 'default' }) as Record<string, Loader>;
const scmls = import.meta.glob('../../assets/parts/*/Animations.scml', { query: '?raw', import: 'default' }) as Record<string, Loader>;

const variantOf = (p: string) => p.split('/').slice(-2, -1)[0];

export function partVariants(): string[] {
  return [...new Set(Object.keys(scmls).map(variantOf))].sort();
}

const parsed = new Map<string, Scml>();

// A variant's animations, once loadParts has loaded it.
export function scmlOf(variant: string): Scml | undefined {
  return parsed.get(variant);
}

// Loads the parts and animations of the given variants, then calls done.
export async function loadParts(scene: Phaser.Scene, variants: string[]): Promise<Map<string, Scml>> {
  for (const v of variants) {
    const path = Object.keys(scmls).find((p) => variantOf(p) === v);
    if (path && !parsed.has(v)) parsed.set(v, parseScml((await scmls[path]()) as string));
  }
  let queued = 0;
  for (const [path, load] of Object.entries(pngs)) {
    const v = variantOf(path);
    if (!variants.includes(v)) continue;
    const key = `${v}/${path.split('/').pop()}`;
    if (scene.textures.exists(key)) continue;
    const url = import.meta.env.DEV ? encodeURI(path.replace(/^\.\.\/\.\./, '')) : ((await load()) as string);
    scene.load.image(key, url);
    queued++;
  }
  if (queued) {
    await new Promise<void>((res) => { scene.load.once('complete', () => res()); scene.load.start(); });
  }
  return new Map(variants.map((v) => [v, parsed.get(v)!]));
}
