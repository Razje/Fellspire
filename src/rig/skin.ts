// Skin tone for parts that show skin (a head under its helmet, bare hands).
//
// The packs paint skin into the same image as the helmet, so the skin is found
// by colour: the most common warm, light colour in the part is taken as its
// skin, and every pixel connected to it that is skin-like (same hue, not as dark
// as the outline) is recoloured. Each pixel keeps its brightness relative to that
// skin colour, so shading and the soft edge against the outline survive. The
// pink cheeks are a different hue and stay as they are.
//
// Plain functions on RGBA pixels, so they run in the browser and in a test.

export type RGB = [number, number, number];

// The tones offered when making a character, light to deep.
export const SKIN_TONES: { name: string; rgb: RGB }[] = [
  { name: 'Porcelain', rgb: [246, 214, 196] },
  { name: 'Rose', rgb: [242, 196, 176] },
  { name: 'Peach', rgb: [240, 196, 150] },
  { name: 'Honey', rgb: [214, 164, 112] },
  { name: 'Bronze', rgb: [176, 118, 76] },
  { name: 'Umber', rgb: [124, 80, 54] },
  { name: 'Ebony', rgb: [86, 56, 42] },
];

function hsl(r: number, g: number, b: number): RGB {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

// The part's own skin colour, or null when it shows none (a gauntlet).
export function findSkin(px: Uint8ClampedArray): RGB | null {
  const counts = new Map<number, number>();
  let total = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 250) continue;
    total++;
    const [h, s, l] = hsl(px[i], px[i + 1], px[i + 2]);
    if (h < 12 || h > 40 || s < 0.3 || l < 0.5 || l > 0.9) continue;
    const key = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = -1, n = 0;
  for (const [k, c] of counts) if (c > n) { best = k; n = c; }
  // skin is a large flat area; a few warm pixels on a glove are not skin
  if (best < 0 || n < total * 0.08) return null;
  return [((best >> 10) << 3) + 4, (((best >> 5) & 31) << 3) + 4, ((best & 31) << 3) + 4];
}

// Recolours the skin in place to the target tone. Returns how many pixels changed.
export function recolourSkin(px: Uint8ClampedArray, w: number, h: number, target: RGB, ref = findSkin(px)): number {
  if (!ref) return 0;
  const [refH] = hsl(...ref);
  const refL = lum(...ref);
  const skinLike = (i: number) => {
    if (px[i + 3] === 0) return false;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (lum(r, g, b) < refL * 0.3) return false; // the outline
    const [ph, ps] = hsl(r, g, b);
    return ps > 0.12 && Math.abs(ph - refH) < 16;
  };
  // seeds: pixels close to the skin colour; then grow through skin-like neighbours
  const inSkin = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (px[i + 3] > 250 && Math.abs(px[i] - ref[0]) + Math.abs(px[i + 1] - ref[1]) + Math.abs(px[i + 2] - ref[2]) < 24) {
      inSkin[p] = 1; stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q < 0 || inSkin[q] || !skinLike(q * 4)) continue;
      inSkin[q] = 1; stack.push(q);
    }
  }
  // keep the big areas only: a warm feather on a helmet is not skin
  const area = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!inSkin[p] || area[p] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    area[p] = id; stack.push(p);
    while (stack.length) {
      const a = stack.pop()!; n++;
      const x = a % w, y = (a / w) | 0;
      for (const q of [x > 0 ? a - 1 : -1, x < w - 1 ? a + 1 : -1, y > 0 ? a - w : -1, y < h - 1 ? a + w : -1]) {
        if (q < 0 || !inSkin[q] || area[q] >= 0) continue;
        area[q] = id; stack.push(q);
      }
    }
    sizes.push(n);
  }
  const keep = Math.max(...sizes, 0) * 0.25;
  let changed = 0;
  for (let p = 0; p < w * h; p++) {
    if (!inSkin[p] || sizes[area[p]] < keep) continue;
    const i = p * 4;
    // keep each channel's brightness relative to the skin colour
    for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, Math.round(target[c] * (px[i + c] / ref[c])));
    changed++;
  }
  return changed;
}
