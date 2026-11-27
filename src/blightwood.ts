// The Blightwood as a place to fight in, laid out like a Lost Castle 2 room:
// seen from above at an angle, a deep forest floor taking most of the screen,
// a wall of dark trees and roots behind it, props standing throughout the
// floor (characters walk behind and in front of them, and cannot walk through
// them), torches whose light warms whoever stands near, a rune ring as the
// exit, and black foliage framing the bottom of the screen.
//
// See lost-castle-2-reference.md and the video frames noted in DESIGN.md.
import Phaser from 'phaser';
import { WORLD } from './config';
import { canvas, rng, trunk, radial } from './titleArt';
import type { Area } from './world';

const TW = 960; // tile width of the repeating background layers
const INK = '#06090d';
const { roomW, roomH, groundTop, groundBottom, viewW, viewH } = WORLD;
const FLOOR_Y = groundTop - 26; // the floor texture starts a little above the walkable edge

function wrap(draw: (dx: number) => void) {
  draw(0); draw(-TW); draw(TW);
}

// ---- background textures ---------------------------------------------------------

function forestTile(scene: Phaser.Scene, key: string, seed: number, n: number, color: string, base: number, wMin: number, wMax: number, blur: number, rim: string | null) {
  canvas(scene, key, TW, 540, (c) => {
    const r = rng(seed);
    const trees = Array.from({ length: n }, (_, i) => ({
      x: (i + 0.2 + r() * 0.6) * (TW / n), w: wMin + r() * (wMax - wMin),
      lean: (r() - 0.5) * 30, dy: r() * 14, seed: seed * 100 + i,
    }));
    c.filter = blur ? `blur(${blur}px)` : 'none';
    c.fillStyle = color;
    c.strokeStyle = color;
    for (const t of trees) {
      wrap((dx) => {
        trunk(c, t.x + dx, base + t.dy, -20, t.w, t.lean, rng(t.seed));
        if (rim) {
          c.save();
          c.strokeStyle = rim; c.lineWidth = 2; c.globalAlpha = 0.5;
          c.beginPath(); c.moveTo(t.x + dx + t.w / 2 - 1, base - 50); c.lineTo(t.x + dx + t.w / 2 - 1 + t.lean, 0); c.stroke();
          c.restore();
        }
      });
    }
    c.fillRect(0, base, TW, 540 - base);
  });
}

// The tree line right behind the floor: thick trunks with roots spilling forward.
function wallTile(scene: Phaser.Scene) {
  const H = 380, BASE = 352;
  canvas(scene, 'fw_wall', TW, H, (c) => {
    const r = rng(53);
    const trees = Array.from({ length: 7 }, (_, i) => ({
      x: (i + 0.15 + r() * 0.7) * (TW / 7), w: 46 + r() * 50, lean: (r() - 0.5) * 24, seed: 900 + i,
      roots: Array.from({ length: 4 }, () => ({ a: (r() - 0.5) * 2.4, len: 26 + r() * 40 })),
    }));
    // shadowy undergrowth band
    const g = c.createLinearGradient(0, BASE - 90, 0, BASE + 10);
    g.addColorStop(0, 'rgba(6,12,16,0)');
    g.addColorStop(1, 'rgba(6,12,16,0.95)');
    c.fillStyle = g;
    c.fillRect(0, BASE - 90, TW, 100);
    for (const t of trees) {
      wrap((dx) => {
        const x = t.x + dx;
        c.fillStyle = '#0a141c';
        c.strokeStyle = '#0a141c';
        trunk(c, x, BASE, -10, t.w, t.lean, rng(t.seed));
        // bark highlight from the moon
        c.save(); c.strokeStyle = '#2e5566'; c.globalAlpha = 0.55; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(x + t.w / 2 - 2, BASE - 40); c.lineTo(x + t.w / 2 - 2 + t.lean, 0); c.stroke(); c.restore();
        // roots creeping onto the floor
        c.strokeStyle = INK; c.lineCap = 'round';
        for (const rt of t.roots) {
          const ex = x + Math.sin(rt.a) * rt.len * 1.8, ey = BASE + 8 + Math.cos(rt.a) * rt.len * 0.35;
          c.lineWidth = 11; c.beginPath(); c.moveTo(x, BASE - 14); c.quadraticCurveTo((x + ex) / 2, BASE - 4, ex, ey); c.stroke();
          c.strokeStyle = '#1b2a30'; c.lineWidth = 6; c.beginPath(); c.moveTo(x, BASE - 14); c.quadraticCurveTo((x + ex) / 2, BASE - 4, ex, ey); c.stroke();
          c.strokeStyle = INK;
        }
      });
    }
    // bushes and thorny scrub along the base
    for (let i = 0; i < 22; i++) {
      const x = r() * TW, s = 14 + r() * 22, col = r() < 0.5 ? '#0d1c1a' : '#122523';
      wrap((dx) => {
        c.fillStyle = INK; c.beginPath(); c.ellipse(x + dx, BASE - s * 0.3, s * 1.25 + 2, s * 0.75 + 2, 0, Math.PI, 0); c.fill();
        c.fillStyle = col; c.beginPath(); c.ellipse(x + dx, BASE - s * 0.3, s * 1.25, s * 0.75, 0, Math.PI, 0); c.fill();
      });
    }
  });
}

function vinesTile(scene: Phaser.Scene) {
  canvas(scene, 'fw_vines', TW, 190, (c) => {
    const r = rng(77);
    c.strokeStyle = '#060d14'; c.fillStyle = '#060d14'; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x1 = r() * TW, span = 90 + r() * 170, sag = 50 + r() * 80, lw = 3 + r() * 3;
      const drops = Array.from({ length: 3 }, () => ({ t: r(), len: 30 + r() * 80, wob: (r() - 0.5) * 10 }));
      wrap((dx) => {
        c.lineWidth = lw;
        c.beginPath(); c.moveTo(x1 + dx, -5); c.quadraticCurveTo(x1 + dx + span / 2, sag, x1 + dx + span, -5); c.stroke();
        for (const d of drops) {
          const hx = x1 + dx + d.t * span;
          c.lineWidth = 2;
          c.beginPath(); c.moveTo(hx, 0); c.lineTo(hx + d.wob, d.len); c.stroke();
          c.beginPath(); c.ellipse(hx + d.wob, d.len, 4, 7, 0, 0, Math.PI * 2); c.fill();
        }
      });
    }
  });
}

// ---- the floor ------------------------------------------------------------------------

// One painting for the whole room floor: dark grass, a winding dirt path that
// curves away into the depth, a clearing, grass patches, pebbles.
function floorTexture(scene: Phaser.Scene) {
  const W = roomW, H = roomH - FLOOR_Y;
  canvas(scene, 'fw_floor', W, H, (c) => {
    const r = rng(131);
    const top = groundTop - FLOOR_Y; // walkable edge inside the texture
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1715');
    g.addColorStop(0.12, '#13261f');
    g.addColorStop(1, '#0f1f1a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // darker, mossy patches
    c.filter = 'blur(6px)';
    for (let i = 0; i < 26; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(30,58,42,0.55)' : 'rgba(8,16,14,0.5)';
      c.beginPath(); c.ellipse(r() * W, top + r() * (H - top), 40 + r() * 120, 14 + r() * 36, 0, 0, Math.PI * 2); c.fill();
    }
    c.filter = 'none';

    // the dirt path: a wide band that wanders across and down into the depth
    const mid = (x: number) => top + (H - top) * (0.48 + 0.16 * Math.sin(x / 260) + 0.08 * Math.sin(x / 97 + 1));
    const half = (x: number) => 52 + 14 * Math.sin(x / 140 + 2);
    const pathShape = () => {
      c.beginPath();
      for (let x = -20; x <= W + 20; x += 10) c.lineTo(x, mid(x) - half(x));
      for (let x = W + 20; x >= -20; x -= 10) c.lineTo(x, mid(x) + half(x) * 0.9);
      c.closePath();
    };
    // a clearing where the path widens, around the middle of the room
    const clearing = () => { c.beginPath(); c.ellipse(W * 0.5, mid(W * 0.5), 230, 92, 0, 0, Math.PI * 2); };
    c.strokeStyle = '#100b08'; c.lineWidth = 8; pathShape(); c.stroke(); clearing(); c.stroke();
    g = c.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#3f3328'); g.addColorStop(1, '#2c241d');
    c.fillStyle = g; pathShape(); c.fill(); clearing(); c.fill();

    // wheel ruts and pebbles in the dirt
    c.strokeStyle = 'rgba(16,11,8,0.4)'; c.lineWidth = 5;
    for (const off of [-24, 22]) {
      c.beginPath(); for (let x = 0; x <= W; x += 10) c.lineTo(x, mid(x) + off); c.stroke();
    }
    for (let i = 0; i < 160; i++) {
      const x = r() * W, y = mid(x) + (r() - 0.5) * 1.6 * half(x), rx = 1.5 + r() * 4, ry = 1 + r() * 2;
      c.fillStyle = '#120d0a'; c.beginPath(); c.ellipse(x, y + 1, rx + 1, ry + 1, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = r() < 0.5 ? '#5a4c3f' : '#43382e'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    }
    // grass tufts, denser away from the path
    for (let i = 0; i < 900; i++) {
      const x = r() * W, y = top + 6 + r() * (H - top - 6);
      const onPath = Math.abs(y - mid(x)) < half(x) * 0.9;
      if (onPath && r() < 0.85) continue;
      const h = 4 + r() * 9;
      c.strokeStyle = r() < 0.5 ? '#24402f' : '#30553c'; c.lineWidth = 2;
      c.beginPath();
      for (let k = -1; k <= 1; k++) { c.moveTo(x + k * 2.5, y); c.lineTo(x + k * 5 + (r() - 0.5) * 3, y - h); }
      c.stroke();
    }
    // the back edge sinks into shadow under the tree line
    g = c.createLinearGradient(0, 0, 0, top + 40);
    g.addColorStop(0, 'rgba(4,8,10,0.95)'); g.addColorStop(1, 'rgba(4,8,10,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, top + 40);
  });
}

function frontTile(scene: Phaser.Scene) {
  canvas(scene, 'fw_front', TW, 110, (c) => {
    const r = rng(91);
    c.fillStyle = INK; c.strokeStyle = INK;
    for (let i = 0; i < 5; i++) {
      const x = r() * TW, n = 4 + Math.floor(r() * 4), size = 50 + r() * 50;
      const fronds = Array.from({ length: n }, () => ({ a: -Math.PI / 2 + (r() - 0.5) * 2.2, len: size * (0.6 + r() * 0.5) }));
      wrap((dx) => {
        for (const f of fronds) {
          const ex = x + dx + Math.cos(f.a) * f.len, ey = 112 + Math.sin(f.a) * f.len;
          c.lineWidth = 3;
          c.beginPath(); c.moveTo(x + dx, 112); c.quadraticCurveTo((x + dx + ex) / 2, Math.min(112, ey) - 10, ex, ey); c.stroke();
          for (let t = 0.2; t < 1; t += 0.12) {
            const px = x + dx + (ex - x - dx) * t, py = 112 + (ey - 112) * t - Math.sin(t * Math.PI) * 8;
            const leaf = (1 - t) * 11 + 3;
            for (const s of [-1, 1]) { c.beginPath(); c.ellipse(px, py, leaf, leaf * 0.3, f.a + s * 1.1, 0, Math.PI * 2); c.fill(); }
          }
        }
      });
    }
    for (let x = 0; x < TW; x += 4) {
      const h = 6 + r() * 20;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, 112); c.lineTo(x + (r() - 0.5) * 12, 110 - h); c.stroke();
    }
  });
}

// ---- props ------------------------------------------------------------------------------

function outlined(c: CanvasRenderingContext2D, shape: () => void, fill: string | CanvasGradient, line = 4) {
  shape(); c.fillStyle = fill; c.fill();
  c.strokeStyle = INK; c.lineWidth = line; shape(); c.stroke();
}

function propTextures(scene: Phaser.Scene) {
  canvas(scene, 'fw_barrel', 44, 52, (c) => {
    const body = () => { c.beginPath(); c.moveTo(8, 8); c.quadraticCurveTo(2, 28, 8, 48); c.lineTo(36, 48); c.quadraticCurveTo(42, 28, 36, 8); c.closePath(); };
    const g = c.createLinearGradient(4, 0, 40, 0);
    g.addColorStop(0, '#3e2a1c'); g.addColorStop(0.45, '#7a5434'); g.addColorStop(1, '#3a2619');
    outlined(c, body, g);
    c.strokeStyle = INK; c.lineWidth = 3;
    for (const y of [16, 38]) { c.beginPath(); c.moveTo(5, y); c.quadraticCurveTo(22, y + 3, 39, y); c.stroke(); }
    outlined(c, () => { c.beginPath(); c.ellipse(22, 8, 14, 5, 0, 0, Math.PI * 2); }, '#5c3f28', 3);
  });
  canvas(scene, 'fw_crate', 50, 50, (c) => {
    outlined(c, () => { c.beginPath(); c.rect(6, 16, 38, 30); }, '#6b4a2c');
    outlined(c, () => { c.beginPath(); c.moveTo(6, 16); c.lineTo(16, 6); c.lineTo(48, 6); c.lineTo(44, 16); c.closePath(); }, '#8a6238', 3);
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(8, 18); c.lineTo(42, 44); c.moveTo(42, 18); c.lineTo(8, 44); c.stroke();
    c.strokeStyle = '#4c331f'; c.lineWidth = 2; c.strokeRect(10, 20, 30, 22);
  });
  canvas(scene, 'fw_stump', 70, 44, (c) => {
    outlined(c, () => { c.beginPath(); c.moveTo(14, 16); c.lineTo(10, 38); c.quadraticCurveTo(35, 46, 60, 38); c.lineTo(56, 16); c.closePath(); }, '#3a2a1e');
    outlined(c, () => { c.beginPath(); c.ellipse(35, 16, 22, 8, 0, 0, Math.PI * 2); }, '#8a6a48', 3);
    c.strokeStyle = '#5a432e'; c.lineWidth = 1.5;
    for (const rr of [5, 10, 15]) { c.beginPath(); c.ellipse(35, 16, rr, rr * 0.36, 0, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = INK; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(12, 36); c.lineTo(2, 42); c.moveTo(58, 36); c.lineTo(68, 41); c.stroke();
  });
  canvas(scene, 'fw_rock', 60, 38, (c) => {
    outlined(c, () => { c.beginPath(); c.moveTo(6, 34); c.lineTo(10, 16); c.lineTo(24, 6); c.lineTo(42, 8); c.lineTo(54, 20); c.lineTo(56, 34); c.closePath(); }, '#3c4a55');
    c.fillStyle = '#566874'; c.beginPath(); c.moveTo(14, 18); c.lineTo(25, 10); c.lineTo(40, 11); c.lineTo(30, 20); c.closePath(); c.fill();
    c.fillStyle = '#2a4a35'; c.beginPath(); c.ellipse(20, 33, 12, 3, 0, 0, Math.PI * 2); c.fill();
  });
  canvas(scene, 'fw_torch', 40, 150, (c) => {
    c.fillStyle = INK; c.fillRect(16, 30, 9, 120);
    c.fillStyle = '#2c2119'; c.fillRect(18, 32, 5, 116);
    c.fillStyle = INK; c.beginPath(); c.moveTo(4, 18); c.lineTo(36, 18); c.lineTo(28, 34); c.lineTo(12, 34); c.closePath(); c.fill();
    c.fillStyle = '#4a3b2c'; c.beginPath(); c.moveTo(8, 20); c.lineTo(32, 20); c.lineTo(26, 31); c.lineTo(14, 31); c.closePath(); c.fill();
    c.fillStyle = '#ffb347'; c.beginPath(); c.ellipse(20, 20, 12, 3.5, 0, 0, Math.PI * 2); c.fill();
  });
  canvas(scene, 'fw_fence', 150, 70, (c) => {
    const post = (x: number, h: number, tilt: number) => {
      c.save(); c.translate(x, 68); c.rotate(tilt);
      c.fillStyle = INK; c.fillRect(-6, -h - 2, 12, h + 2);
      c.fillStyle = '#4b3a2b'; c.fillRect(-4, -h, 8, h - 2);
      c.restore();
    };
    post(12, 58, -0.05); post(62, 52, 0.04); post(112, 60, -0.08); post(140, 40, 0.25);
    for (const y of [26, 46]) { c.fillStyle = INK; c.fillRect(2, y - 4, 128, 10); c.fillStyle = '#5a4634'; c.fillRect(4, y - 2, 124, 6); }
  });
  canvas(scene, 'fw_grave', 56, 78, (c) => {
    const shape = () => { c.beginPath(); c.moveTo(6, 78); c.lineTo(6, 26); c.quadraticCurveTo(28, -2, 50, 26); c.lineTo(50, 78); c.closePath(); };
    outlined(c, shape, '#2e3b47');
    c.fillStyle = '#1a232c'; c.fillRect(24, 22, 8, 32); c.fillRect(16, 30, 24, 7);
    c.strokeStyle = '#4b6173'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, 28); c.quadraticCurveTo(42, 12, 28, 8); c.stroke();
  });
  canvas(scene, 'fw_shroom', 36, 30, (c) => {
    for (const [x, s] of [[10, 1], [22, 1.3], [30, 0.8]] as const) {
      c.fillStyle = INK; c.fillRect(x - 2 * s, 30 - 12 * s, 4 * s, 12 * s);
      c.fillStyle = '#cfe9e4'; c.fillRect(x - 1.2 * s, 30 - 11 * s, 2.4 * s, 11 * s);
      c.fillStyle = INK; c.beginPath(); c.ellipse(x, 30 - 12 * s, 8 * s, 5 * s, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#5ff0e0'; c.beginPath(); c.ellipse(x, 30 - 12.5 * s, 6.5 * s, 4 * s, 0, Math.PI, 0); c.fill();
    }
  });
  canvas(scene, 'fw_bones', 60, 24, (c) => {
    c.lineCap = 'round';
    for (const [x1, y1, x2, y2] of [[6, 18, 34, 12], [20, 20, 50, 20], [40, 8, 54, 18]]) {
      c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = '#d8d0b8'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.fillStyle = INK; c.beginPath(); c.arc(14, 10, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e2dbc5'; c.beginPath(); c.arc(14, 10, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK; c.fillRect(10, 8, 3, 3); c.fillRect(15, 8, 3, 3);
  });
  canvas(scene, 'fw_pool', 256, 96, (c) => {
    c.save(); c.scale(1, 96 / 256);
    radial(c, 128, 128, 128, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    c.restore();
  });
  canvas(scene, 'fw_dust', 24, 24, (c) => radial(c, 12, 12, 12, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]));
}

export function makeBlightwoodTextures(scene: Phaser.Scene) {
  forestTile(scene, 'fw_far', 15, 13, '#16293a', 352, 14, 26, 2.5, null);
  forestTile(scene, 'fw_mid', 19, 7, '#0e1a25', 362, 26, 44, 1, '#3d6a7a');
  wallTile(scene);
  vinesTile(scene);
  floorTexture(scene);
  frontTile(scene);
  propTextures(scene);
}

// ---- an area's colours -------------------------------------------------------------------------

// A texture as an area sees it: the same painting, washed in the area's colour (a
// "color" blend keeps each pixel's lightness and takes the area's hue), copied once
// per area and kept. The Blightwood uses the original.
export function areaKey(scene: Phaser.Scene, key: string, a?: Area): string {
  const l = a?.look;
  if (!a || !l || (l.amount === 0 && l.sat === 1 && l.bright === 1)) return key;
  const k = `${key}@${a.id}`;
  if (scene.textures.exists(k)) return k;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  canvas(scene, k, src.width, src.height, (c) => {
    c.filter = `saturate(${l.sat}) brightness(${l.bright})`;
    c.drawImage(src, 0, 0);
    c.filter = 'none';
    c.globalCompositeOperation = 'color';
    c.globalAlpha = l.amount;
    c.fillStyle = '#' + l.grade.toString(16).padStart(6, '0');
    c.fillRect(0, 0, src.width, src.height);
    // the wash covered the clear parts too: keep only where the painting was
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(src, 0, 0);
  });
  return k;
}

// ---- the room ----------------------------------------------------------------------------------

export interface Light { x: number; y: number; radius: number; strength: number }
// A prop's footprint on the floor, an ellipse characters cannot enter.
export interface Obstacle { x: number; y: number; rx: number; ry: number }

// A barrel or crate that breaks after a couple of hits.
export interface Breakable { x: number; y: number; img: Phaser.GameObjects.Image; obstacle?: Obstacle; hp: number }

export interface Blightwood {
  breakables: Breakable[];
  update(cam: Phaser.Cameras.Scene2D.Camera): void;
  lightAt(x: number, y: number): number;
  pushOut(p: { x: number; y: number }): void;
  openExit(): void; // lights every gate
  extinguish(): void; // puts every torch out, for the Warden's second phase
  exit: { x: number; y: number }; // the first gate (the only one in most rooms)
  exits: { x: number; y: number }[]; // the gates, top to bottom
  lights: Light[];
  obstacles: Obstacle[];
}

const FIRE = Phaser.Display.Color.ValueToColor(0xffd6a8);

interface PropKind { key: string; scale: number; rx: number; ry: number; light?: boolean; glow?: boolean }
const KINDS: Record<string, PropKind> = {
  barrel: { key: 'fw_barrel', scale: 0.8, rx: 15, ry: 7 },
  crate: { key: 'fw_crate', scale: 0.8, rx: 17, ry: 8 },
  stump: { key: 'fw_stump', scale: 0.85, rx: 24, ry: 9 },
  rock: { key: 'fw_rock', scale: 0.85, rx: 22, ry: 8 },
  grave: { key: 'fw_grave', scale: 0.62, rx: 15, ry: 6 },
  torch: { key: 'fw_torch', scale: 0.62, rx: 8, ry: 5, light: true },
  shroom: { key: 'fw_shroom', scale: 0.9, rx: 0, ry: 0, glow: true },
  bones: { key: 'fw_bones', scale: 0.7, rx: 0, ry: 0 },
};

// A clear spot on the floor that no prop may take (the camp's fire, rack and dummy).
export interface ClearSpot { x: number; y: number; r: number }

// opts.camp lays out the camp between runs: no breakable barrels (nothing to loot
// there), no graves, and the rune gate already lit as the way out.
// gates: the light of each rune gate out of the room, top to bottom (none: no way out).
export function buildBlightwood(scene: Phaser.Scene, opts: { boss?: boolean; camp?: boolean; clear?: ClearSpot[]; area?: Area; gates?: number[] } = {}): Blightwood {
  const A = (key: string) => areaKey(scene, key, opts.area);
  const look = opts.area?.look;
  const MOON = Phaser.Display.Color.ValueToColor(look?.moon ?? 0xaebbe0);
  const gates = opts.gates ?? (opts.boss ? [] : [0x3fe8dc]);
  if (!scene.textures.exists('fw_floor')) makeBlightwoodTextures(scene);
  const lights: Light[] = [];
  const torches: (() => void)[] = [];
  const breakables: Breakable[] = [];
  const obstacles: Obstacle[] = [];

  // ---- far background, parallax in both directions
  const back = (key: string, y: number, h: number, f: number, fy: number, depth: number) =>
    scene.add.tileSprite(0, y, viewW + (roomW - viewW) * f + 40, h, key).setOrigin(0).setScrollFactor(f, fy).setDepth(depth);
  const packLayers = (scene.registry.get('bgCount') as number) ?? 0;
  let fog: Phaser.GameObjects.TileSprite | null = null;
  if (packLayers > 0) {
    for (let i = 0; i < packLayers; i++) {
      const img = scene.textures.get(`bg_${i}`).getSourceImage() as HTMLImageElement;
      back(A(`bg_${i}`), 0, viewH, 0.1 + 0.5 * (i / Math.max(1, packLayers - 1)), 0.3, -100 + i).setTileScale(viewH / img.height);
    }
  } else {
    scene.add.image(0, 0, A('tt_sky')).setOrigin(0).setScrollFactor(0).setDepth(-100);
    back(A('fw_far'), groundTop + 30 - 352, 540, 0.2, 0.4, -99);
    fog = back('tt_fog', groundTop - 150, 160, 0.3, 0.5, -98).setAlpha(0.55).setBlendMode(Phaser.BlendModes.SCREEN);
    back(A('fw_mid'), groundTop + 12 - 362, 540, 0.5, 0.75, -97);
  }
  // the tree line at the back of the floor, same plane as the floor
  scene.add.tileSprite(0, groundTop + 6 - 352, roomW, 380, A('fw_wall')).setOrigin(0).setDepth(groundTop - 60);
  scene.add.tileSprite(0, -20, roomW, 190, A('fw_vines')).setOrigin(0).setScrollFactor(1, 0.8).setDepth(-90);
  scene.add.image(0, FLOOR_Y, A('fw_floor')).setOrigin(0).setDepth(-50);

  // ---- props: along the back edge, along the front edge, and a few in the open
  const rnd = new Phaser.Math.RandomDataGenerator([opts.boss ? 'blightwood-warden' : opts.camp ? 'blightwood-camp' : 'blightwood-arena']);
  const placed: { x: number; y: number }[] = [];
  const free = (x: number, y: number, gap: number) => placed.every((p) => Math.hypot(p.x - x, (p.y - y) * 2) > gap);
  const put = (name: string, x: number, y: number) => {
    const k = KINDS[name];
    placed.push({ x, y });
    const img = scene.add.image(x, y, A(k.key)).setOrigin(0.5, 0.92).setScale(k.scale).setDepth(y).setFlipX(rnd.frac() < 0.5);
    const obstacle = k.rx ? { x, y, rx: k.rx, ry: k.ry } : undefined;
    if (obstacle) obstacles.push(obstacle);
    if (!opts.camp && (name === 'barrel' || name === 'crate')) breakables.push({ x, y, img, obstacle, hp: 2 });
    if (k.glow) scene.add.image(x, y - 8, 'tt_light').setDepth(y - 1).setScale(0.3).setTint(look?.rune ?? 0x3fe8dc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    if (k.light) torches.push(addTorchFire(scene, x, y, k.scale, lights));
  };
  // one gate in the middle of the right edge, or two: one up by the trees, one down front
  const exits = gates.length === 1 ? [{ x: roomW - 130, y: Math.round((groundTop + groundBottom) / 2) + 10 }]
    : gates.map((_, i) => ({ x: roomW - 230 + i * 40, y: i === 0 ? groundTop + 70 : groundBottom - 60 }));
  const exit = exits[0] ?? { x: -9999, y: -9999 };
  const mid = (groundTop + groundBottom) / 2;
  const keepClear = (x: number, y: number) => (x < 230 && Math.abs(y - 470) < 90) || exits.some((e) => Math.hypot(x - e.x, (y - e.y) * 1.6) < 150)
    || (!!opts.boss && Math.hypot(x - roomW / 2, (y - mid) * 2.2) < 420)
    || (!opts.boss && !opts.camp && Math.abs(x - roomW / 2) < 130 && y < groundTop + 80)
    || (opts.clear ?? []).some((c) => Math.hypot(x - c.x, (y - c.y) * 1.6) < c.r);

  // torches at fixed beats, back and front, so every room has its pools of light
  // (a combat room keeps the top middle for the chest's shrine, with a torch either side)
  const backTorches = opts.boss ? [[760, groundTop + 8]] : [[652, groundTop + 12], [848, groundTop + 12]];
  const torchSpots = opts.camp
    ? [[250, groundTop + 14], [1000, groundTop + 14], [1180, groundTop + 14], [1000, groundBottom - 4]]
    : [[300, groundTop + 14], ...backTorches, [1180, groundTop + 14], [520, groundBottom - 6], [1000, groundBottom - 4]];
  for (const [x, y] of torchSpots) put('torch', x, y);
  const backKinds = opts.camp ? ['shroom', 'stump', 'rock', 'fence', 'crate'] : ['grave', 'grave', 'shroom', 'bones', 'stump', 'rock', 'fence'];
  for (let x = 60; x < roomW - 40; x += rnd.between(70, 140)) {
    const y = groundTop + rnd.between(4, 22);
    if (!free(x, y, 60) || keepClear(x, y)) continue;
    const name = rnd.pick(backKinds);
    if (name === 'fence') {
      scene.add.image(x, y, A('fw_fence')).setOrigin(0.5, 0.95).setScale(0.62).setDepth(y);
      obstacles.push({ x, y, rx: 42, ry: 6 });
      placed.push({ x, y });
    } else put(name, x, y);
  }
  const frontKinds = opts.camp ? ['barrel', 'crate', 'rock', 'stump'] : ['barrel', 'barrel', 'crate', 'rock', 'stump', 'grave', 'bones'];
  for (let x = 120; x < roomW - 60; x += rnd.between(110, 220)) {
    const y = groundBottom - rnd.between(0, 18);
    if (!free(x, y, 70) || keepClear(x, y)) continue;
    const name = rnd.pick(frontKinds);
    put(name, x, y);
    if (name === 'barrel' && rnd.frac() < 0.6 && free(x + 26, y - 10, 20)) put(rnd.pick(['barrel', 'crate']), x + 26, y - 10);
  }
  // a few out in the open floor, to fight around
  for (let i = 0, tries = 0; i < (opts.boss || opts.camp ? 0 : 4) && tries < 60; tries++) {
    const x = rnd.between(320, roomW - 320), y = rnd.between(groundTop + 70, groundBottom - 70);
    if (!free(x, y, 160) || keepClear(x, y) || Math.abs(x - roomW / 2) < 200) continue;
    put(rnd.pick(['rock', 'stump', 'grave', 'shroom']), x, y);
    i++;
  }

  // fireflies over the room
  scene.add.particles(0, 0, 'tt_dot', {
    x: { min: 0, max: roomW }, y: { min: 120, max: groundBottom },
    speed: { min: 4, max: 12 }, lifespan: { min: 4000, max: 7000 },
    scale: { min: 0.1, max: 0.2 },
    alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 },
    tint: look?.flies ?? [0xc8ff8a, 0x9cf7c8], blendMode: 'ADD', frequency: 140,
  }).setDepth(9000).fastForward(6000);

  // ---- the exits: rune rings, dark until the room is cleared, each in its own light
  const rings = exits.map((e, i) => {
    const ring = scene.add.image(e.x, e.y, 'tt_portal').setOrigin(0.5, 0.96).setScale(0.55).setDepth(e.y).setTint(0x4a5866);
    const glow = scene.add.image(e.x, e.y - 70, 'tt_light').setScale(0.9).setTint(gates[i]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(e.y - 1);
    const pool = scene.add.image(e.x, e.y, 'fw_pool').setTint(gates[i]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.8).setDepth(0.5);
    obstacles.push({ x: e.x - 52, y: e.y - 4, rx: 10, ry: 6 }, { x: e.x + 52, y: e.y - 4, rx: 10, ry: 6 });
    return { e, ring, glow, pool, tint: gates[i] };
  });

  // ---- framing: black foliage along the bottom edge, and the vignette
  scene.add.tileSprite(-60, roomH - 108, roomW * 1.12 + 120, 110, A('fw_front')).setOrigin(0).setScrollFactor(1.12, 1).setDepth(15000);
  scene.add.image(0, 0, 'tt_vignette').setOrigin(0).setScrollFactor(0).setDepth(16000);

  let drift = 0;
  return {
    exit, exits, lights, obstacles, breakables,
    update() {
      drift += 0.35;
      if (fog) fog.tilePositionX = drift;
    },
    lightAt(x, y) {
      let w = 0;
      for (const l of lights) {
        const d = Math.hypot(x - l.x, (y - l.y) * 1.7);
        if (d < l.radius) w = Math.max(w, (1 - d / l.radius) ** 1.3 * l.strength);
      }
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(MOON, FIRE, 100, Math.round(w * 100));
      return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    },
    pushOut(p) {
      for (const o of obstacles) {
        const nx = (p.x - o.x) / o.rx, ny = (p.y - o.y) / o.ry;
        const d = Math.hypot(nx, ny);
        if (d >= 1) continue;
        const ux = d < 1e-4 ? 1 : nx / d, uy = d < 1e-4 ? 0 : ny / d;
        p.x = o.x + ux * o.rx;
        p.y = o.y + uy * o.ry;
      }
    },
    extinguish() {
      for (const out of torches) out();
    },
    openExit() {
      for (const { e, ring, glow, pool, tint } of rings) {
        ring.clearTint();
        scene.tweens.add({ targets: glow, alpha: 0.6, duration: 700 });
        scene.tweens.add({ targets: glow, scale: 0.8, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 700 });
        scene.tweens.add({ targets: pool, alpha: 0.55, duration: 700 });
        scene.add.particles(e.x, e.y - 70, 'tt_dot', {
          x: { min: -36, max: 36 }, y: { min: -34, max: 40 },
          speedY: { min: -20, max: -8 }, lifespan: { min: 1600, max: 2800 },
          scale: { start: 0.22, end: 0 }, alpha: { start: 0.9, end: 0 },
          tint: [tint, 0xffffff], blendMode: 'ADD', frequency: 70,
        }).setDepth(e.y + 1);
      }
    },
  };
}

// Returns a function that puts the torch out.
function addTorchFire(scene: Phaser.Scene, x: number, y: number, s: number, lights: Light[]) {
  const fy = y - 150 * s * 0.92 + 20 * s;
  const fx: Phaser.GameObjects.Image[] = [];
  let lit = true;
  for (const [tint, f, dx] of [[0xff5a14, 0.4, 0], [0xffa03a, 0.29, -1], [0xfff0b0, 0.17, 1]] as const) {
    const fl = scene.add.image(x + dx, fy, 'tt_flame').setOrigin(0.5, 0.92).setScale(f * 0.75, f).setTint(tint).setDepth(y + 1).setBlendMode(Phaser.BlendModes.ADD);
    fx.push(fl);
    scene.tweens.add({ targets: fl, scaleY: f * 1.2, scaleX: f * 0.66, duration: 130 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: fl, angle: { from: -6, to: 6 }, duration: 280 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const halo = scene.add.image(x, fy - 10, 'tt_light').setScale(1.1).setTint(0xff9a3c).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(y + 2);
  const pool = scene.add.image(x, y + 6, 'fw_pool').setScale(1.9, 1.8).setTint(0xff8a3a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(0.5);
  scene.time.addEvent({
    delay: 90, loop: true,
    callback: () => { if (!lit) return; const f = Math.random(); halo.setAlpha(0.3 + f * 0.1); pool.setAlpha(0.4 + f * 0.08); },
  });
  const sparks = scene.add.particles(x, fy - 8, 'tt_dot', {
    x: { min: -4, max: 4 }, speedY: { min: -55, max: -25 }, speedX: { min: -10, max: 10 },
    lifespan: { min: 800, max: 1500 }, scale: { start: 0.15, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [0xffd27a, 0xff9a3c], blendMode: 'ADD', frequency: 160,
  }).setDepth(y + 2);
  const light = { x, y: y + 6, radius: 170, strength: 0.85 };
  lights.push(light);
  return () => {
    lit = false;
    sparks.stop();
    scene.tweens.add({ targets: [...fx, halo, pool], alpha: 0, duration: 500 + Math.random() * 400 });
    scene.tweens.add({ targets: light, strength: 0, duration: 700 });
    // a last wisp of smoke
    scene.add.particles(x, fy - 10, 'fw_dust', {
      speedY: { min: -30, max: -14 }, speedX: { min: -6, max: 6 }, lifespan: 1400, scale: { start: 0.4, end: 1.2 },
      alpha: { start: 0.35, end: 0 }, tint: 0x8a8a9a, quantity: 1, frequency: 90, duration: 900,
    }).setDepth(y + 2);
  };
}
