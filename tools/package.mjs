// Builds a copy of the game to send to someone: one self-contained HTML file
// with every picture, font and line of code inside it, zipped with a short note.
// It opens by double-clicking, with no install, server or internet.
//
//   node tools/package.mjs
//
// Output: release/Fellspire.html and release/Fellspire-<date>.zip (both ignored
// by git). Only the art the game uses goes in: the first colour variant of each
// character pack and the hero's parts (all three Valkyrie sets, which character
// creation mixes), not every variant on disk.
import { build } from 'vite';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'release');
const dist = path.join(out, 'build');

// The art the game shows; anything else under assets/ is left out of the package.
const KEEP = [/\/assets\/characters\/hero\/Valkyrie_1\//, /\/assets\/characters\/ghoul\/Zombie_Villager_1\//,
  /\/assets\/characters\/archer\/Skeleton_Warrior_1\//, /\/assets\/parts\/Valkyrie_[123]\//, /\/assets\/backgrounds\//];

const leaveOut = {
  name: 'leave-out-unused-art',
  enforce: 'pre',
  load(id) {
    const file = id.split('?')[0].replace(/\\/g, '/');
    if (!file.includes('/assets/') || file.includes('/node_modules/')) return null;
    if (KEEP.some((k) => k.test(file))) return null;
    return 'export default ""';
  },
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
  root,
  base: './',
  logLevel: 'warn',
  plugins: [leaveOut],
  build: {
    outDir: dist,
    emptyOutDir: true,
    assetsInlineLimit: () => true, // every asset becomes part of the code
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 1e9,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

// Fold the script and stylesheet into the page itself.
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
const files = html.match(/(?:src|href)="\.\/assets\/[^"]+"/g) ?? [];
for (const ref of files) {
  const rel = ref.split('"')[1];
  const body = await readFile(path.join(dist, rel), 'utf8');
  if (rel.endsWith('.js')) {
    html = html.replace(new RegExp(`<script[^>]*${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*></script>`),
      () => `<script type="module">${body.replace(/<\/script/g, '<\\/script')}</script>`);
  } else if (rel.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`), () => `<style>${body}</style>`);
  }
}
const page = path.join(out, 'Fellspire.html');
await writeFile(page, html);
await rm(dist, { recursive: true, force: true });

const note = `FELLSPIRE  (prototype)
======================

How to play
-----------
Double-click Fellspire.html. It opens in your web browser (Chrome, Edge or
Firefox) and needs no install and no internet. Give it a few seconds to load.

Controls
--------
  W A S D / arrows   move
  J                  light attack (press again for a combo)
  K                  heavy attack
  L                  dodge
  Shift              block (sword and shield only)
  I                  weapon skill
  E                  open the chest when a room is cleared
  Esc                pause menu
A game controller works too.

New Run asks Solo or Co-op. Co-op is still being built: two players can join
the lobby (J for the keyboard's left side, Numpad 1 for its right side, A on a
controller), but for now only player 1 goes into the fight.

Clear the waves in each room, open the chest and pick a reward, step through
the rune gate. Room 4 holds the Lantern Warden. Good luck.

A personal prototype. Character art: CraftPix.net. Fonts: Cinzel, Marcellus.
`;
await writeFile(path.join(out, 'How to play.txt'), note.replace(/\n/g, '\r\n'));

const date = new Date().toISOString().slice(0, 10);
const zip = path.join(out, `Fellspire-${date}.zip`);
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Compress-Archive -Force -Path '${page}','${path.join(out, 'How to play.txt')}' -DestinationPath '${zip}'`]);
const mb = (s) => (s.size / 1e6).toFixed(1);
console.log(`Fellspire.html ${mb(await stat(page))} MB, zip ${mb(await stat(zip))} MB -> ${zip}`);
