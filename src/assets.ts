// Finds art packs dropped into assets/ without any manual file lists.
// The globs are lazy: listing the files costs nothing, and only the frames a
// character actually uses are turned into URLs. (An eager glob made the dev
// server answer one request per PNG in every pack, about 2,000 at start-up.)
import { ANIM_SOURCES, CHARACTERS, type CharKey } from './config';

type Loader = () => Promise<unknown>;

const charFiles = import.meta.glob('../assets/characters/**/*.png', { query: '?url', import: 'default' }) as Record<string, Loader>;
const bgFiles = import.meta.glob('../assets/backgrounds/active/*.png', { query: '?url', import: 'default' }) as Record<string, Loader>;

const norm = (s: string) => s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// In development Vite serves project files at their own path, so no module
// request is needed; a production build needs the hashed URL from the loader.
async function urlOf(files: Record<string, Loader>, path: string): Promise<string> {
  if (import.meta.env.DEV) return encodeURI(path.replace(/^\.\./, ''));
  return (await files[path]()) as string;
}

// Animation name -> ordered frame paths for one character.
// A pack is a tree of folders; the folder holding a run of PNGs names the
// animation ("Idle", "Walking"), and everything above it is the variant.
function pickFrames(key: CharKey): Record<string, string[]> {
  const prefix = `../assets/characters/${key}/`;
  const variants = new Map<string, Map<string, string[]>>();
  for (const path of Object.keys(charFiles)) {
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
  const chosen = variants.get(usable[Math.min(CHARACTERS[key].variant, usable.length - 1)])!;
  const out: Record<string, string[]> = {};
  for (const [anim, sources] of Object.entries(ANIM_SOURCES)) {
    const src = sources.find((s) => chosen.has(s));
    if (src) out[anim] = chosen.get(src)!.slice().sort(byName);
  }
  return out;
}

// Filled by discoverArt() before the game starts.
export const artFrames: Partial<Record<CharKey, Record<string, string[]>>> = {};
export const bgUrls: string[] = [];

export async function discoverArt() {
  for (const key of Object.keys(CHARACTERS) as CharKey[]) {
    const frames = pickFrames(key);
    const out: Record<string, string[]> = {};
    for (const [anim, paths] of Object.entries(frames)) {
      out[anim] = await Promise.all(paths.map((p) => urlOf(charFiles, p)));
    }
    artFrames[key] = out;
  }
  const bgPaths = Object.keys(bgFiles).sort(byName);
  bgUrls.push(...(await Promise.all(bgPaths.map((p) => urlOf(bgFiles, p)))));
}

// Filled in by BootScene: which animations each character really has.
export const loadedAnims: Partial<Record<CharKey, Set<string>>> = {};
export const firstFrame: Partial<Record<CharKey, string>> = {};
