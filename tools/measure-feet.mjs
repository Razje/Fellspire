// Reports where each character's feet are inside its frames, as a fraction of
// the frame height: the lowest row with a solid pixel, over the idle and walk
// frames. That number belongs in footY in src/config.ts.
//
//   node tools/measure-feet.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

async function find(dir, name) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === name) return p;
      const r = await find(p, name);
      if (r) return r;
    }
  }
  return null;
}

async function lowestSolidRow(file) {
  const { data, info } = await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = info.height - 1; y >= 0; y--) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 128) return { row: y, height: info.height };
    }
  }
  return { row: info.height - 1, height: info.height };
}

for (const role of ['hero', 'ghoul', 'archer']) {
  const out = [];
  for (const anim of ['Idle', 'Walking']) {
    const dir = await find(join('assets', 'characters', role), anim);
    if (!dir) continue;
    const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    let max = 0, h = 1;
    for (const f of files) {
      const r = await lowestSolidRow(join(dir, f));
      max = Math.max(max, r.row);
      h = r.height;
    }
    out.push(`${anim} ${(max + 1) / h}`);
  }
  console.log(role, out.join('  '));
}
