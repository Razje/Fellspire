// Painted backdrop for the title screen, drawn once on canvases at start-up.
// Palette after Lost Castle 2's night forests: deep blue-teal darkness, warm
// pools of fire light, cyan and violet magic, black foliage framing the edges.
import Phaser from 'phaser';
import { WORLD } from './config';

export type Ctx = CanvasRenderingContext2D;

export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
}

// ---- soft shapes used for light and particles -------------------------------

export function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function lights(scene: Phaser.Scene) {
  canvas(scene, 'tt_light', 256, 256, (c) => radial(c, 128, 128, 128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]));
  canvas(scene, 'tt_dot', 32, 32, (c) => radial(c, 16, 16, 16, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]));
  canvas(scene, 'tt_flame', 64, 128, (c) => {
    const g = c.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.filter = 'blur(3px)';
    c.beginPath();
    c.moveTo(32, 4);
    c.bezierCurveTo(46, 40, 60, 70, 56, 96);
    c.bezierCurveTo(52, 120, 12, 120, 8, 96);
    c.bezierCurveTo(4, 70, 18, 40, 32, 4);
    c.fill();
  });
  canvas(scene, 'tt_fog', 640, 160, (c) => {
    const r = rng(7);
    c.filter = 'blur(18px)';
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(150,200,210,${0.05 + r() * 0.08})`;
      c.beginPath();
      c.ellipse(60 + r() * 520, 80 + (r() - 0.5) * 50, 60 + r() * 90, 18 + r() * 22, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  canvas(scene, 'tt_vignette', SW, 540, (c) => {
    const g = c.createRadialGradient(SW / 2, 300, 180, SW / 2, 300, 620 + SOX);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.6, 'rgba(2,4,10,0.35)');
    g.addColorStop(1, 'rgba(2,4,10,0.92)');
    c.fillStyle = g;
    c.fillRect(0, 0, SW, 540);
  });
}

// ---- scenery layers ----------------------------------------------------------

// The sky and vignette are as wide as the view (960 at 16:9, more on a wider
// screen). The scenery layers are 160 wider than that so they can drift with the
// mouse. Each is drawn as it was designed at 960 / 1120 wide, shifted right by
// SOX / OX so that design sits in the middle, with the extra width filled at the sides.
const SW = WORLD.viewW;
const SOX = (SW - 960) / 2;
const W = Math.max(1120, SW + 160);
const OX = (W - 1120) / 2;

function sky(scene: Phaser.Scene) {
  canvas(scene, 'tt_sky', SW, 540, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 540);
    g.addColorStop(0, '#060a18');
    g.addColorStop(0.45, '#0f2033');
    g.addColorStop(0.75, '#16343c');
    g.addColorStop(1, '#0d1c22');
    c.fillStyle = g;
    c.fillRect(0, 0, SW, 540);
    c.translate(SOX, 0);
    const r = rng(3);
    for (let i = 0; i < Math.round(90 * SW / 960); i++) {
      c.fillStyle = `rgba(220,235,255,${0.2 + r() * 0.6})`;
      c.fillRect(-SOX + r() * SW, r() * 260, r() < 0.9 ? 1 : 2, r() < 0.9 ? 1 : 2);
    }
    // moon, high on the right
    radial(c, 872, 74, 150, [[0, 'rgba(190,230,235,0.35)'], [0.3, 'rgba(120,180,200,0.12)'], [1, 'rgba(0,0,0,0)']]);
    c.fillStyle = '#e9f3e6';
    c.beginPath(); c.arc(872, 74, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(160,190,185,0.35)';
    for (const [x, y, rr] of [[862, 66, 8], [882, 86, 5], [886, 64, 4], [866, 88, 3]]) {
      c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill();
    }
  });
}

export function trunk(c: Ctx, x: number, base: number, top: number, w: number, lean: number, r: () => number) {
  c.beginPath();
  c.moveTo(x - w * 1.6, base);
  c.quadraticCurveTo(x - w * 0.6, base - 18, x - w / 2, base - 40);
  c.lineTo(x - w / 2 + lean, top);
  c.lineTo(x + w / 2 + lean, top);
  c.lineTo(x + w / 2, base - 40);
  c.quadraticCurveTo(x + w * 0.6, base - 18, x + w * 1.7, base);
  c.closePath();
  c.fill();
  // a few crooked branches
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = top + 30 + r() * (base - top) * 0.45;
    const dir = r() < 0.5 ? -1 : 1;
    c.lineWidth = Math.max(3, w * 0.28);
    c.beginPath();
    c.moveTo(x + lean * ((y - base) / (top - base)), y);
    c.quadraticCurveTo(x + dir * w * 1.6, y - 20, x + dir * w * (2.4 + r() * 1.6), y - 50 - r() * 40);
    c.stroke();
  }
}

// Trees are left out between avoid[0] and avoid[1] (layer pixels) to keep the moon clear.
function forest(scene: Phaser.Scene, key: string, seed: number, n: number, color: string, base: number, wMin: number, wMax: number, blur: number, rim: string | null, avoid: [number, number] = [0, 0]) {
  canvas(scene, key, W, 540, (c) => {
    const r = rng(seed);
    c.filter = blur ? `blur(${blur}px)` : 'none';
    c.fillStyle = color;
    c.strokeStyle = color;
    // the 1120 design in the middle; as many trees again per 1120 at the sides
    c.translate(OX, 0);
    const extra = Math.ceil((OX / 1120) * n);
    for (let i = -extra; i < n + extra; i++) {
      const x = (i + 0.2 + r() * 0.6) * (1120 / n);
      if (x < -OX - 60 || x > 1120 + OX + 60) continue;
      const w = wMin + r() * (wMax - wMin);
      if (x + w * 2 > avoid[0] && x - w * 2 < avoid[1]) continue;
      trunk(c, x, base + r() * 14, -20, w, (r() - 0.5) * 30, r);
      if (rim) {
        // moonlight catching the right edge of the trunk
        c.save();
        c.strokeStyle = rim;
        c.lineWidth = 2;
        c.globalAlpha = 0.55;
        c.beginPath();
        c.moveTo(x + w / 2 - 1, base - 50);
        c.lineTo(x + w / 2 - 1, 0);
        c.stroke();
        c.restore();
      }
    }
    // a band of ground under the trees
    c.fillRect(-OX, base, W, 540 - base);
  });
}

function vines(scene: Phaser.Scene) {
  canvas(scene, 'tt_vines', W, 200, (c) => {
    const r = rng(11);
    c.strokeStyle = '#071019';
    c.lineCap = 'round';
    for (let i = 0; i < Math.round(9 * W / 1120); i++) {
      const x1 = r() * W, x2 = x1 + 80 + r() * 160, sag = 60 + r() * 90;
      c.lineWidth = 3 + r() * 3;
      c.beginPath();
      c.moveTo(x1, -5);
      c.quadraticCurveTo((x1 + x2) / 2, sag, x2, -5);
      c.stroke();
      for (let k = 0; k < 3; k++) {
        const hx = x1 + r() * (x2 - x1), len = 30 + r() * 90;
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(hx, 0); c.lineTo(hx + (r() - 0.5) * 10, len); c.stroke();
        c.fillStyle = '#071019';
        c.beginPath(); c.ellipse(hx, len, 4, 7, 0, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

function ground(scene: Phaser.Scene) {
  canvas(scene, 'tt_ground', W, 540, (c) => {
    const r = rng(21);
    const top = 408;
    c.translate(OX, 0);
    let g = c.createLinearGradient(0, top, 0, 540);
    g.addColorStop(0, '#132522');
    g.addColorStop(1, '#0a1413');
    c.fillStyle = g;
    c.fillRect(-OX, top, W, 540 - top);
    // the winding dirt path, running on straight past the design's ends
    g = c.createLinearGradient(0, top, 0, 540);
    g.addColorStop(0, '#3a3129');
    g.addColorStop(1, '#241d18');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-OX, 452);
    c.lineTo(0, 452);
    c.bezierCurveTo(300, 420, 520, 470, 760, 440);
    c.bezierCurveTo(900, 424, 1020, 430, 1120, 446);
    c.lineTo(1120 + OX, 446);
    c.lineTo(1120 + OX, 520);
    c.lineTo(1120, 520);
    c.bezierCurveTo(900, 512, 700, 530, 480, 512);
    c.bezierCurveTo(300, 500, 120, 520, 0, 510);
    c.lineTo(-OX, 510);
    c.closePath();
    c.fill();
    // pebbles and grass tufts
    for (let i = 0; i < Math.round(70 * W / 1120); i++) {
      c.fillStyle = r() < 0.5 ? '#4a4036' : '#2c2620';
      c.beginPath(); c.ellipse(-OX + r() * W, 445 + r() * 70, 2 + r() * 4, 1.5 + r() * 2, 0, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < Math.round(160 * W / 1120); i++) {
      const x = -OX + r() * W, y = top + 4 + r() * 130;
      c.strokeStyle = r() < 0.5 ? '#24402f' : '#2f523a';
      c.lineWidth = 2;
      c.beginPath();
      for (let k = -1; k <= 1; k++) { c.moveTo(x + k * 3, y); c.lineTo(x + k * 6 + (r() - 0.5) * 4, y - 6 - r() * 9); }
      c.stroke();
    }
  });
}

function foreground(scene: Phaser.Scene) {
  canvas(scene, 'tt_front', W + 80, 540, (c) => {
    const r = rng(42);
    const ink = '#03060a';
    c.fillStyle = ink;
    c.strokeStyle = ink;
    // huge framing trunks at both edges
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(96, 0); c.quadraticCurveTo(70, 260, 112, 540); c.lineTo(0, 540); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(W + 80, 0); c.lineTo(W - 20, 0); c.quadraticCurveTo(W + 10, 280, W - 40, 540); c.lineTo(W + 80, 540); c.closePath(); c.fill();
    // fern fronds
    const fern = (x: number, y: number, len: number, ang: number) => {
      c.lineWidth = 3;
      c.beginPath();
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      c.moveTo(x, y); c.quadraticCurveTo((x + ex) / 2, Math.min(y, ey) - len * 0.25, ex, ey); c.stroke();
      for (let t = 0.15; t < 1; t += 0.09) {
        const px = x + (ex - x) * t, py = y + (ey - y) * t - Math.sin(t * Math.PI) * len * 0.22;
        const leaf = (1 - t) * len * 0.28 + 6;
        for (const s of [-1, 1]) {
          c.beginPath();
          c.ellipse(px, py, leaf, leaf * 0.28, ang + s * 1.1, 0, Math.PI * 2);
          c.fill();
        }
      }
    };
    for (let i = 0; i < 7; i++) fern(60 + r() * 220, 545, 120 + r() * 90, -Math.PI / 2 + (r() - 0.2) * 1.3);
    for (let i = 0; i < 7; i++) fern(W - 60 + r() * 150, 545, 120 + r() * 90, -Math.PI / 2 - (r() - 0.2) * 1.3);
    // grass along the bottom edge
    for (let x = 0; x < W + 80; x += 5) {
      const h = 10 + r() * 26 + (x < 330 || x > W - 250 ? 30 : 0);
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, 542); c.lineTo(x + (r() - 0.5) * 14, 540 - h); c.stroke();
    }
    // vines hanging from the top corners
    c.lineWidth = 4;
    for (const [x0, dir] of [[60, 1], [W + 20, -1]] as const) {
      for (let k = 0; k < 4; k++) {
        const len = 60 + r() * 140, x = x0 + dir * (k * 22 + r() * 18);
        c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + dir * 18, len / 2, x + dir * 4, len); c.stroke();
        c.beginPath(); c.ellipse(x + dir * 4, len, 6, 10, 0, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

function props(scene: Phaser.Scene) {
  // ruined stone ring with runes, the focal point behind the camp
  canvas(scene, 'tt_portal', 220, 250, (c) => {
    c.lineWidth = 26;
    c.strokeStyle = '#334452';
    c.beginPath(); c.arc(110, 120, 80, Math.PI * 0.82, Math.PI * 2.18); c.stroke();
    c.lineWidth = 3;
    c.strokeStyle = '#1b2530';
    for (let a = 0.82; a < 2.2; a += 0.17) {
      const x1 = 110 + Math.cos(a * Math.PI) * 67, y1 = 120 + Math.sin(a * Math.PI) * 67;
      const x2 = 110 + Math.cos(a * Math.PI) * 93, y2 = 120 + Math.sin(a * Math.PI) * 93;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.strokeStyle = '#4a6170';
    c.lineWidth = 2;
    c.beginPath(); c.arc(110, 120, 93, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
    // a fallen block at the base
    c.fillStyle = '#2a3743';
    c.fillRect(150, 214, 46, 24);
    c.fillRect(22, 206, 34, 34);
    // runes
    c.strokeStyle = '#7ffcf0';
    c.lineWidth = 2.5;
    c.shadowColor = '#3fe8dc';
    c.shadowBlur = 10;
    for (let a = 0.9; a < 2.15; a += 0.17) {
      const x = 110 + Math.cos(a * Math.PI) * 80, y = 120 + Math.sin(a * Math.PI) * 80;
      c.beginPath(); c.moveTo(x - 4, y - 5); c.lineTo(x + 3, y); c.lineTo(x - 3, y + 6); c.stroke();
    }
  });
  canvas(scene, 'tt_grave', 60, 80, (c) => {
    c.fillStyle = '#26323d';
    c.beginPath(); c.moveTo(8, 80); c.lineTo(8, 26); c.quadraticCurveTo(30, 0, 52, 26); c.lineTo(52, 80); c.fill();
    c.fillStyle = '#1a232c';
    c.fillRect(26, 22, 8, 34); c.fillRect(18, 30, 24, 7);
    c.strokeStyle = '#3d5060'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(50, 28); c.quadraticCurveTo(44, 12, 30, 8); c.stroke();
  });
  canvas(scene, 'tt_lantern', 60, 200, (c) => {
    c.fillStyle = '#0c1218';
    c.fillRect(26, 30, 8, 170);
    c.fillRect(26, 30, 26, 6);
    c.fillRect(44, 36, 3, 12);
    c.fillStyle = '#ffcf7a';
    c.shadowColor = '#ffb347'; c.shadowBlur = 14;
    c.fillRect(38, 48, 16, 20);
    c.shadowBlur = 0;
    c.strokeStyle = '#0c1218'; c.lineWidth = 3;
    c.strokeRect(38, 48, 16, 20);
  });
  canvas(scene, 'tt_logs', 120, 50, (c) => {
    c.lineCap = 'round';
    for (const [x1, y1, x2, y2, col] of [[16, 40, 100, 20, '#4a2e1c'], [20, 18, 104, 40, '#3c2416'], [30, 44, 94, 44, '#55361f']] as const) {
      c.strokeStyle = '#140b06'; c.lineWidth = 17;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = col; c.lineWidth = 12;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.fillStyle = '#ff9a3c';
    c.shadowColor = '#ff7a1a'; c.shadowBlur = 12;
    c.beginPath(); c.ellipse(60, 32, 26, 7, 0, 0, Math.PI * 2); c.fill();
  });
  // stones ringing the fire
  canvas(scene, 'tt_stones', 160, 40, (c) => {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (i / 8);
      const x = 80 - Math.cos(a) * 66, y = 22 + Math.sin(a) * 10;
      c.fillStyle = '#121a20'; c.beginPath(); c.ellipse(x, y + 2, 13, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a4650'; c.beginPath(); c.ellipse(x, y, 12, 8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,170,90,0.35)'; c.beginPath(); c.ellipse(x, y - 3, 8, 3, 0, 0, Math.PI * 2); c.fill();
    }
  });
}

// ---- UI pieces ------------------------------------------------------------------

function button(scene: Phaser.Scene, key: string, hi: boolean) {
  const w = 260, h = 50;
  canvas(scene, key, w + 20, h + 20, (c) => {
    const x = 10, y = 10;
    c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hi ? '#8a2a1a' : '#4a1410');
    g.addColorStop(0.5, hi ? '#6a1d12' : '#350d0a');
    g.addColorStop(1, hi ? '#3d0f09' : '#1c0605');
    c.fillStyle = g;
    const cut = 12;
    const path = () => {
      c.beginPath();
      c.moveTo(x + cut, y); c.lineTo(x + w - cut, y); c.lineTo(x + w, y + h / 2); c.lineTo(x + w - cut, y + h);
      c.lineTo(x + cut, y + h); c.lineTo(x, y + h / 2); c.closePath();
    };
    path(); c.fill();
    c.shadowColor = 'transparent';
    // gold bevelled rim
    const gold = c.createLinearGradient(0, y, 0, y + h);
    gold.addColorStop(0, hi ? '#fff0b0' : '#e2c06a');
    gold.addColorStop(0.5, hi ? '#d9a940' : '#a77d2e');
    gold.addColorStop(1, hi ? '#8a5e1c' : '#5e3f15');
    c.strokeStyle = gold; c.lineWidth = 3; path(); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + cut + 5, y + 5); c.lineTo(x + w - cut - 5, y + 5); c.lineTo(x + w - 7, y + h / 2); c.lineTo(x + w - cut - 5, y + h - 5);
    c.lineTo(x + cut + 5, y + h - 5); c.lineTo(x + 7, y + h / 2); c.closePath(); c.stroke();
    // sheen
    c.fillStyle = hi ? 'rgba(255,220,160,0.16)' : 'rgba(255,200,150,0.07)';
    c.fillRect(x + cut, y + 4, w - cut * 2, h * 0.35);
    // gems on the points
    for (const gx of [x + 2, x + w - 2]) {
      c.fillStyle = '#2a0d08'; c.beginPath(); c.moveTo(gx, y + h / 2 - 7); c.lineTo(gx + 6, y + h / 2); c.lineTo(gx, y + h / 2 + 7); c.lineTo(gx - 6, y + h / 2); c.closePath(); c.fill();
      c.fillStyle = hi ? '#ffcf5a' : '#c98b2a'; c.beginPath(); c.moveTo(gx, y + h / 2 - 5); c.lineTo(gx + 4, y + h / 2); c.lineTo(gx, y + h / 2 + 5); c.lineTo(gx - 4, y + h / 2); c.closePath(); c.fill();
    }
  });
}

export function panelTexture(scene: Phaser.Scene, key: string, w: number, h: number) {
  canvas(scene, key, w, h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(18,24,34,0.97)');
    g.addColorStop(1, 'rgba(8,11,18,0.97)');
    c.fillStyle = g;
    c.fillRect(6, 6, w - 12, h - 12);
    const gold = c.createLinearGradient(0, 0, 0, h);
    gold.addColorStop(0, '#f0d384'); gold.addColorStop(0.5, '#a77d2e'); gold.addColorStop(1, '#e2c06a');
    c.strokeStyle = gold; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
    c.strokeStyle = 'rgba(200,160,80,0.45)'; c.lineWidth = 1; c.strokeRect(13, 13, w - 26, h - 26);
    for (const [x, y] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) {
      c.fillStyle = '#1a0d06'; c.beginPath(); c.moveTo(x, y - 11); c.lineTo(x + 11, y); c.lineTo(x, y + 11); c.lineTo(x - 11, y); c.closePath(); c.fill();
      c.fillStyle = '#e2b553'; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 8, y); c.lineTo(x, y + 8); c.lineTo(x - 8, y); c.closePath(); c.fill();
      c.fillStyle = '#b8323a'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
    }
  });
}

function ribbon(scene: Phaser.Scene) {
  canvas(scene, 'tt_ribbon', 420, 56, (c) => {
    c.fillStyle = '#3a0c0a';
    for (const s of [-1, 1]) {
      const x = s < 0 ? 0 : 420;
      c.beginPath(); c.moveTo(x, 14); c.lineTo(x - s * 60, 14); c.lineTo(x - s * 60, 50); c.lineTo(x, 50); c.lineTo(x - s * 16, 32); c.closePath(); c.fill();
    }
    const g = c.createLinearGradient(0, 6, 0, 46);
    g.addColorStop(0, '#9a2a1c'); g.addColorStop(0.5, '#741c12'); g.addColorStop(1, '#4a110b');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(40, 6); c.quadraticCurveTo(210, 0, 380, 6); c.lineTo(380, 42); c.quadraticCurveTo(210, 36, 40, 42); c.closePath(); c.fill();
    c.strokeStyle = '#d8ac4c'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(44, 10); c.quadraticCurveTo(210, 4, 376, 10); c.stroke();
    c.beginPath(); c.moveTo(44, 38); c.quadraticCurveTo(210, 32, 376, 38); c.stroke();
  });
}

export function makeTitleTextures(scene: Phaser.Scene) {
  lights(scene);
  sky(scene);
  forest(scene, 'tt_far', 5, 14, '#16293a', 392, 14, 26, 2.5, null, [905, 1005]);
  forest(scene, 'tt_mid', 9, 7, '#0d1823', 404, 30, 54, 0.6, '#3d6a7a', [880, 1030]);
  vines(scene);
  ground(scene);
  foreground(scene);
  props(scene);
  button(scene, 'tt_btn', false);
  button(scene, 'tt_btn_hi', true);
  ribbon(scene);
}
