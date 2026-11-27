// Finds art packs dropped into assets/ without any manual file lists.
// The globs are lazy: listing the files costs nothing, and only the frames a
// character actually uses are turned into URLs. (An eager glob made the dev
// server answer one request per PNG in every pack, about 2,000 at start-up.)
//
// A character's frames come from sheets when tools/pack-sheets.mjs has packed them
// (assets/sheets/: a few large images instead of about 120 small ones per character,
// far quicker to load), and from the separate files otherwise: a character whose
// frames are not all in the sheets (new art, another variant chosen) falls back on its
// own, so a stale or missing sheet costs speed, never correctness.
import { ANIM_SOURCES, CHARACTERS, type CharKey } from './config';
import { byName, pickFrames } from './artPick';

type Loader = () => Promise<unknown>;

const charFiles = import.meta.glob('../assets/characters/**/*.png', { query: '?url', import: 'default' }) as Record<string, Loader>;
const bgFiles = import.meta.glob('../assets/backgrounds/active/*.png', { query: '?url', import: 'default' }) as Record<string, Loader>;
const sheetFiles = import.meta.glob('../assets/sheets/*.png', { query: '?url', import: 'default' }) as Record<string, Loader>;
const manifests = import.meta.glob('../assets/sheets/sheets.json', { eager: true, import: 'default' }) as Record<string, SheetManifest>;

// What tools/pack-sheets.mjs writes: each sheet a grid of equal frames, and for each
// source frame (by its path as the globs above name it) the sheet and the cell.
export interface SheetManifest {
  frameWidth: number;
  frameHeight: number;
  sheets: Record<string, { file: string; count: number }>;
  frames: Record<string, [string, number]>;
}
const manifest: SheetManifest | undefined = Object.values(manifests)[0];

// In development Vite serves project files at their own path, so no module
// request is needed; a production build needs the hashed URL from the loader.
async function urlOf(files: Record<string, Loader>, path: string): Promise<string> {
  if (import.meta.env.DEV) return encodeURI(path.replace(/^\.\./, ''));
  return (await files[path]()) as string;
}

// A frame as Phaser knows it: a texture, and the cell in it when it is a sheet.
export interface FrameRef { key: string; frame?: number }

// Filled by discoverArt() before the game starts.
export const artFrames: Partial<Record<CharKey, Record<string, FrameRef[]>>> = {};
export const bgUrls: string[] = [];
// what BootScene loads: separate frames by URL, sheets as grids
export const frameUrls: string[] = [];
export const sheetLoads: { key: string; url: string; frameWidth: number; frameHeight: number }[] = [];

export async function discoverArt() {
  const paths = Object.keys(charFiles);
  const sheetsWanted = new Set<string>();
  for (const key of Object.keys(CHARACTERS) as CharKey[]) {
    const frames = pickFrames(paths, key, CHARACTERS[key], ANIM_SOURCES);
    const all = Object.values(frames).flat();
    const packed = !!manifest && all.length > 0 && all.every((p) => manifest.frames[p] && sheetFiles[`../assets/sheets/${manifest.sheets[manifest.frames[p][0]]?.file}`]);
    if (!packed && manifest && all.length) console.info(`[fellspire] ${key}: frames not all in the sheets, loading them one by one (run node tools/pack-sheets.mjs)`);
    const out: Record<string, FrameRef[]> = {};
    for (const [anim, list] of Object.entries(frames)) {
      out[anim] = await Promise.all(list.map(async (p) => {
        if (packed) {
          const [sheet, cell] = manifest!.frames[p];
          sheetsWanted.add(sheet);
          return { key: `sheet_${sheet}`, frame: cell };
        }
        const url = await urlOf(charFiles, p);
        if (!frameUrls.includes(url)) frameUrls.push(url);
        return { key: url };
      }));
    }
    artFrames[key] = out;
  }
  for (const sheet of [...sheetsWanted].sort(byName)) {
    const path = `../assets/sheets/${manifest!.sheets[sheet].file}`;
    sheetLoads.push({ key: `sheet_${sheet}`, url: await urlOf(sheetFiles, path), frameWidth: manifest!.frameWidth, frameHeight: manifest!.frameHeight });
  }
  const bgPaths = Object.keys(bgFiles).sort(byName);
  bgUrls.push(...(await Promise.all(bgPaths.map((p) => urlOf(bgFiles, p)))));
}

// Filled in by BootScene: which animations each character really has.
export const loadedAnims: Partial<Record<CharKey, Set<string>>> = {};
export const firstFrame: Partial<Record<CharKey, FrameRef>> = {};
