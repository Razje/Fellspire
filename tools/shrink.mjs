// Shrinks every PNG under a folder in place so no side exceeds MAX pixels.
// CraftPix frames are 900 x 900, far larger than the game draws them, and
// each one costs width x height x 4 bytes of graphics memory once loaded.
//
//   node tools/shrink.mjs assets/characters/ghoul [max]
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const root = process.argv[2];
const MAX = Number(process.argv[3] ?? 256);

async function* pngs(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* pngs(p);
    else if (e.name.endsWith('.png.tmp')) await unlink(p); // leftover of an earlier run
    else if (e.name.toLowerCase().endsWith('.png')) yield p;
  }
}

let n = 0;
for await (const file of pngs(root)) {
  // Read into memory first: on Windows sharp keeps a file open, which blocks
  // replacing it.
  const input = await readFile(file);
  let meta;
  try {
    meta = await sharp(input).metadata();
  } catch {
    console.warn(`skipped, not an image: ${file}`);
    continue;
  }
  if ((meta.width ?? 0) <= MAX && (meta.height ?? 0) <= MAX) continue;
  const out = await sharp(input).resize(MAX, MAX, { fit: 'inside' }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(file, out);
  n++;
}
console.log(`${n} images shrunk to fit ${MAX} px in ${root}`);
