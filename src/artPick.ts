// Which frames each character uses, from the list of PNG paths under assets/characters/.
// Shared by the game (assets.ts) and tools/pack-sheets.mjs, which packs exactly these
// frames into sheets, so the two can never disagree about which frames are wanted.
// Node loads this file directly (it strips the types), so it imports nothing but types.
import type { CharConfig } from './config';

export const norm = (s: string) => s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
export const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// Animation name -> ordered frame paths for one character. paths are like
// '../assets/characters/<key>/<variant folders>/<Animation>/<frame>.png': the folder
// holding a run of PNGs names the animation ("Idle", "Walking"), everything above it
// is the variant.
export function pickFrames(paths: string[], key: string, cfg: Pick<CharConfig, 'variant'>, sources: Record<string, string[]>): Record<string, string[]> {
  const prefix = `../assets/characters/${key}/`;
  const variants = new Map<string, Map<string, string[]>>();
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const parts = path.slice(prefix.length).split('/');
    if (parts.length < 2) continue;
    const folder = norm(parts[parts.length - 2]);
    const variant = parts.slice(0, -2).join('/');
    if (!variants.has(variant)) variants.set(variant, new Map());
    const anims = variants.get(variant)!;
    if (!anims.has(folder)) anims.set(folder, []);
    anims.get(folder)!.push(path);
  }
  const usable = [...variants.keys()].filter((v) => variants.get(v)!.has('idle')).sort(byName);
  if (usable.length === 0) return {};
  const chosen = variants.get(usable[Math.min(cfg.variant, usable.length - 1)])!;
  const out: Record<string, string[]> = {};
  for (const [anim, names] of Object.entries(sources)) {
    const src = names.find((s) => chosen.has(s));
    if (src) out[anim] = chosen.get(src)!.slice().sort(byName);
  }
  return out;
}
