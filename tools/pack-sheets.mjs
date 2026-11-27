// Packs the character frames the game uses into a few large sheets, so the game loads
// a handful of images instead of about 370 small ones (each needing its own request,
// decode and upload to the graphics card).
//
//   node tools/pack-sheets.mjs
//
// Run it again after unpacking new character art or changing which variant or folders a
// character uses (CHARACTERS and ANIM_SOURCES in src/config.ts). Until then the game
// notices that a character's frames are not all in the sheets and loads that character's
// files one by one, as before: slower, never wrong.
//
// Writes assets/sheets/<character>-<n>.png, grids of 16 columns of equal cells, and
// assets/sheets/sheets.json, which says where each source frame went. Like all art it
// stays out of git. The frame choice comes from src/artPick.ts, the same code the game
// runs, so the two cannot disagree.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { CHARACTERS, ANIM_SOURCES } = await import(pathToFileURL(join(root, 'src/config.ts')).href);
const { pickFrames } = await import(pathToFileURL(join(root, 'src/artPick.ts')).href);

const COLS = 16, ROWS = 8; // 4096 x 2048 at 256 px: safe on any graphics card
const out = join(root, 'assets/sheets');

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(join(d, e.name)) : e.name.toLowerCase().endsWith('.png') && !e.name.startsWith('._') ? [join(d, e.name)] : []);
// the same path form the game's glob gives: ../assets/characters/...
const paths = walk(join(root, 'assets/characters')).map((p) => '../' + relative(root, p).split('\\').join('/'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const manifest = { frameWidth: 0, frameHeight: 0, sheets: {}, frames: {} };
let total = 0;

for (const key of Object.keys(CHARACTERS)) {
  const frames = pickFrames(paths, key, CHARACTERS[key], ANIM_SOURCES);
  const list = [...new Set(Object.values(frames).flat())];
  if (!list.length) { console.log(`${key}: no frames found, skipped`); continue; }
  const file = (p) => join(root, p.replace(/^\.\.\//, ''));
  for (const p of list) {
    const m = await sharp(file(p)).metadata();
    if (!manifest.frameWidth) { manifest.frameWidth = m.width; manifest.frameHeight = m.height; }
    if (m.width !== manifest.frameWidth || m.height !== manifest.frameHeight) {
      throw new Error(`${p} is ${m.width}x${m.height}, the other frames ${manifest.frameWidth}x${manifest.frameHeight}: a sheet needs equal frames (shrink it with tools/shrink.mjs)`);
    }
  }
  const { frameWidth: w, frameHeight: h } = manifest;
  const per = COLS * ROWS;
  for (let s = 0; s * per < list.length; s++) {
    const chunk = list.slice(s * per, (s + 1) * per);
    const name = `${key}-${s}`, png = `${name}.png`;
    const rows = Math.ceil(chunk.length / COLS);
    await sharp({ create: { width: Math.min(chunk.length, COLS) * w, height: rows * h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(chunk.map((p, i) => ({ input: file(p), left: (i % COLS) * w, top: Math.floor(i / COLS) * h })))
      .png({ compressionLevel: 9 })
      .toFile(join(out, png));
    manifest.sheets[name] = { file: png, count: chunk.length };
    chunk.forEach((p, i) => { manifest.frames[p] = [name, i]; });
  }
  total += list.length;
  console.log(`${key}: ${list.length} frames in ${Math.ceil(list.length / per)} sheet(s)`);
}
writeFileSync(join(out, 'sheets.json'), JSON.stringify(manifest));
console.log(`${total} frames packed into ${Object.keys(manifest.sheets).length} sheets in assets/sheets/`);
