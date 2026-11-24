// How loot looks: item icons, the chest's choice cards, and hover tooltips.
//
// Cards follow Azeroth Survivors' and the MMOs' item cards: near-black, the border
// and a wash rising from the bottom in the rarity's colour, a round icon disc on
// top (Lost Castle 2's treasure cards), the name in the rarity's colour, stats
// compared with what you carry now ("now » new", green better, red worse), and
// effects as green "Equip:" lines.
import Phaser from 'phaser';
import { RARITY, WEAPON_KINDS, itemLines, type Gear, type Item, type Rarity } from '../loot';
import { CURSOR_HOVER, Frame, hi, pic, rrect, type Focusable } from './kit';
import { C, FONT, txt } from './theme';

type Ctx = CanvasRenderingContext2D;

const vg = (c: Ctx, y0: number, y1: number, stops: [number, string][]) => {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
const GOLD: [number, string][] = [[0, '#fff1b8'], [0.35, '#e0b04a'], [0.6, '#8a5f1a'], [1, '#f0cf78']];
const STEEL: [number, string][] = [[0, '#ffffff'], [0.45, '#c8d2dc'], [0.55, '#7d8a98'], [1, '#e4ecf4']];
const INK = '#05070a';

function back(c: Ctx, s: number, inner: string, outer: string) {
  const g = c.createRadialGradient(s * 0.45, s * 0.38, 0, s / 2, s / 2, s * 0.75);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, s, s);
}

// A blade along the diagonal: w = half width, len = length, guard = crossguard half width.
function blade(c: Ctx, s: number, w: number, len: number, guard: number, cup = false) {
  c.save(); c.translate(s * 0.5, s * 0.54); c.rotate(Math.PI / 4);
  const top = -len * s, gy = s * 0.12;
  c.fillStyle = INK;
  c.beginPath(); c.moveTo(0, top - 2); c.lineTo(w * s + 1.5, top + w * s * 2); c.lineTo(w * s + 1.5, gy); c.lineTo(-w * s - 1.5, gy); c.lineTo(-w * s - 1.5, top + w * s * 2); c.closePath(); c.fill();
  const bl = c.createLinearGradient(-w * s, 0, w * s, 0); bl.addColorStop(0, '#ffffff'); bl.addColorStop(0.5, '#b8c4d0'); bl.addColorStop(1, '#5e6a78');
  c.fillStyle = bl;
  c.beginPath(); c.moveTo(0, top); c.lineTo(w * s, top + w * s * 2); c.lineTo(w * s, gy); c.lineTo(-w * s, gy); c.lineTo(-w * s, top + w * s * 2); c.closePath(); c.fill();
  if (cup) {
    c.fillStyle = INK; c.beginPath(); c.arc(0, gy + s * 0.03, s * 0.11, 0, Math.PI * 2); c.fill();
    c.fillStyle = vg(c, gy - s * 0.08, gy + s * 0.12, GOLD); c.beginPath(); c.arc(0, gy + s * 0.03, s * 0.09, 0, Math.PI * 2); c.fill();
  } else {
    c.fillStyle = INK; c.fillRect(-guard * s - 1.5, gy - 1.5, guard * 2 * s + 3, s * 0.08 + 3);
    c.fillStyle = vg(c, gy, gy + s * 0.08, GOLD); c.fillRect(-guard * s, gy, guard * 2 * s, s * 0.08);
  }
  c.fillStyle = INK; c.fillRect(-s * 0.045, gy + s * 0.07, s * 0.09, s * 0.2);
  c.fillStyle = '#5a3418'; c.fillRect(-s * 0.03, gy + s * 0.08, s * 0.06, s * 0.17);
  c.fillStyle = vg(c, gy + s * 0.24, gy + s * 0.32, GOLD); c.beginPath(); c.arc(0, gy + s * 0.29, s * 0.045, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawItemIcon(c: Ctx, name: string, s: number) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  const disc = (x: number, y: number, r: number, fill: string | CanvasGradient) => { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  switch (name) {
    case 'longsword': back(c, s, '#3a5a7a', '#0a1420'); blade(c, s, 0.055, 0.42, 0.17); break;
    case 'greatblade': back(c, s, '#6a3a2a', '#160806'); blade(c, s, 0.085, 0.46, 0.24); break;
    case 'rapier': back(c, s, '#3a6a6a', '#061614'); blade(c, s, 0.025, 0.46, 0.1, true); break;
    case 'armor': {
      back(c, s, '#4a5060', '#0a0c12');
      const plate = (k: number) => {
        c.beginPath();
        c.moveTo(s * 0.5, s * (0.2 + k)); c.lineTo(s * (0.8 - k), s * (0.22 + k)); c.lineTo(s * (0.86 - k), s * 0.4);
        c.lineTo(s * (0.72 - k), s * 0.44); c.lineTo(s * (0.7 - k), s * (0.82 - k)); c.quadraticCurveTo(s * 0.5, s * (0.9 - k), s * (0.3 + k), s * (0.82 - k));
        c.lineTo(s * (0.28 + k), s * 0.44); c.lineTo(s * (0.14 + k), s * 0.4); c.lineTo(s * (0.2 + k), s * (0.22 + k)); c.closePath();
      };
      plate(-0.02); c.fillStyle = INK; c.fill();
      plate(0); c.fillStyle = vg(c, s * 0.2, s * 0.9, STEEL); c.fill();
      c.strokeStyle = vg(c, s * 0.2, s * 0.9, GOLD); c.lineWidth = s * 0.04; plate(0.02); c.stroke();
      c.strokeStyle = 'rgba(40,50,60,0.7)'; c.lineWidth = s * 0.025;
      c.beginPath(); c.moveTo(s * 0.5, s * 0.3); c.lineTo(s * 0.5, s * 0.78); c.stroke();
      c.beginPath(); c.moveTo(s * 0.34, s * 0.58); c.quadraticCurveTo(s * 0.5, s * 0.64, s * 0.66, s * 0.58); c.stroke();
      break;
    }
    case 'tooth': {
      back(c, s, '#4a3a5a', '#0c0812');
      const fang = () => { c.beginPath(); c.moveTo(s * 0.36, s * 0.2); c.quadraticCurveTo(s * 0.7, s * 0.18, s * 0.66, s * 0.32); c.quadraticCurveTo(s * 0.62, s * 0.62, s * 0.4, s * 0.84); c.quadraticCurveTo(s * 0.46, s * 0.5, s * 0.36, s * 0.2); c.closePath(); };
      c.lineWidth = s * 0.07; c.strokeStyle = INK; fang(); c.stroke();
      c.fillStyle = vg(c, s * 0.2, s * 0.84, [[0, '#fffaf0'], [1, '#c8b890']]); fang(); c.fill();
      break;
    }
    case 'feather': {
      back(c, s, '#3a5a6a', '#081014');
      c.strokeStyle = INK; c.lineWidth = s * 0.08;
      c.beginPath(); c.moveTo(s * 0.24, s * 0.82); c.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.76, s * 0.18); c.stroke();
      c.fillStyle = vg(c, s * 0.18, s * 0.8, [[0, '#ffffff'], [1, '#9ab8d0']]);
      c.beginPath(); c.moveTo(s * 0.3, s * 0.74); c.quadraticCurveTo(s * 0.34, s * 0.34, s * 0.76, s * 0.18); c.quadraticCurveTo(s * 0.7, s * 0.6, s * 0.3, s * 0.74); c.closePath();
      c.lineWidth = s * 0.04; c.stroke(); c.fill();
      c.strokeStyle = 'rgba(60,90,120,0.7)'; c.lineWidth = s * 0.02;
      c.beginPath(); c.moveTo(s * 0.26, s * 0.8); c.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.74, s * 0.2); c.stroke();
      break;
    }
    case 'dice': {
      back(c, s, '#5a4a3a', '#120c08');
      c.save(); c.translate(s * 0.5, s * 0.52); c.rotate(-0.25);
      const d = s * 0.5;
      c.fillStyle = INK; c.beginPath(); c.roundRect(-d / 2 - 2, -d / 2 - 2, d + 4, d + 4, d * 0.2); c.fill();
      c.fillStyle = vg(c, -d / 2, d / 2, [[0, '#fffaf0'], [1, '#c8b890']]); c.beginPath(); c.roundRect(-d / 2, -d / 2, d, d, d * 0.18); c.fill();
      c.fillStyle = '#3a0a06';
      for (const [x, y] of [[-0.25, -0.25], [0, 0], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25]]) disc(x * d, y * d, d * 0.08, '#3a0a06');
      c.restore();
      break;
    }
    case 'locket': {
      back(c, s, '#3a4a6a', '#080a14');
      c.strokeStyle = vg(c, 0, s * 0.4, GOLD); c.lineWidth = s * 0.03;
      c.beginPath(); c.moveTo(s * 0.3, s * 0.1); c.quadraticCurveTo(s * 0.5, s * 0.36, s * 0.7, s * 0.1); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.ellipse(s * 0.5, s * 0.6, s * 0.24, s * 0.28, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = vg(c, s * 0.34, s * 0.86, GOLD); c.beginPath(); c.ellipse(s * 0.5, s * 0.6, s * 0.2, s * 0.24, 0, 0, Math.PI * 2); c.fill();
      disc(s * 0.5, s * 0.6, s * 0.13, '#1a2440');
      disc(s * 0.54, s * 0.57, s * 0.1, '#e8f0ff');
      disc(s * 0.59, s * 0.54, s * 0.09, '#1a2440');
      break;
    }
    case 'ring': {
      back(c, s, '#6a3a1a', '#180804');
      c.lineWidth = s * 0.13; c.strokeStyle = INK; c.beginPath(); c.ellipse(s * 0.5, s * 0.6, s * 0.24, s * 0.2, 0, 0, Math.PI * 2); c.stroke();
      c.lineWidth = s * 0.08; c.strokeStyle = vg(c, s * 0.4, s * 0.8, GOLD); c.beginPath(); c.ellipse(s * 0.5, s * 0.6, s * 0.24, s * 0.2, 0, 0, Math.PI * 2); c.stroke();
      disc(s * 0.5, s * 0.36, s * 0.14, INK);
      const g = c.createRadialGradient(s * 0.46, s * 0.32, 0, s * 0.5, s * 0.36, s * 0.12);
      g.addColorStop(0, '#fff0b0'); g.addColorStop(0.4, '#ff7a20'); g.addColorStop(1, '#7a1a04');
      disc(s * 0.5, s * 0.36, s * 0.11, g);
      break;
    }
    case 'vial': {
      back(c, s, '#3a5a3a', '#081008');
      const bottle = () => { c.beginPath(); c.moveTo(s * 0.42, s * 0.18); c.lineTo(s * 0.58, s * 0.18); c.lineTo(s * 0.58, s * 0.38); c.quadraticCurveTo(s * 0.78, s * 0.48, s * 0.74, s * 0.7); c.quadraticCurveTo(s * 0.7, s * 0.86, s * 0.5, s * 0.86); c.quadraticCurveTo(s * 0.3, s * 0.86, s * 0.26, s * 0.7); c.quadraticCurveTo(s * 0.22, s * 0.48, s * 0.42, s * 0.38); c.closePath(); };
      c.lineWidth = s * 0.07; c.strokeStyle = INK; bottle(); c.stroke();
      c.fillStyle = 'rgba(200,230,240,0.35)'; bottle(); c.fill();
      c.save(); bottle(); c.clip();
      c.fillStyle = vg(c, s * 0.5, s * 0.86, [[0, '#a0ffb0'], [1, '#2a8a3a']]); c.fillRect(0, s * 0.52, s, s);
      c.restore();
      c.fillStyle = '#6a4020'; c.fillRect(s * 0.4, s * 0.12, s * 0.2, s * 0.08);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(s * 0.33, s * 0.5, s * 0.04, s * 0.16);
      break;
    }
    case 'heart': {
      back(c, s, '#6a2a2a', '#140404');
      const heart = (k: number) => { c.beginPath(); c.moveTo(s * 0.5, s * (0.84 - k)); c.bezierCurveTo(s * (0.1 + k), s * 0.56, s * (0.16 + k), s * (0.2 + k), s * 0.5, s * (0.36 + k)); c.bezierCurveTo(s * (0.84 - k), s * (0.2 + k), s * (0.9 - k), s * 0.56, s * 0.5, s * (0.84 - k)); c.closePath(); };
      heart(-0.03); c.fillStyle = INK; c.fill();
      heart(0); c.fillStyle = vg(c, s * 0.2, s * 0.85, STEEL); c.fill();
      c.fillStyle = '#8a1a14'; heart(0.1); c.fill();
      for (const [x, y] of [[0.3, 0.42], [0.7, 0.42], [0.5, 0.74]]) disc(s * x, s * y, s * 0.03, '#2a3038');
      break;
    }
    case 'shard': {
      back(c, s, '#2a4a7a', '#04081a');
      const g = c.createRadialGradient(s * 0.5, s * 0.5, 0, s * 0.5, s * 0.5, s * 0.45);
      g.addColorStop(0, 'rgba(160,210,255,0.6)'); g.addColorStop(1, 'rgba(160,210,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
      const sh = () => { c.beginPath(); c.moveTo(s * 0.55, s * 0.12); c.lineTo(s * 0.7, s * 0.46); c.lineTo(s * 0.48, s * 0.88); c.lineTo(s * 0.32, s * 0.5); c.closePath(); };
      c.lineWidth = s * 0.06; c.strokeStyle = INK; sh(); c.stroke();
      c.fillStyle = vg(c, s * 0.12, s * 0.88, [[0, '#ffffff'], [0.5, '#8ac8ff'], [1, '#2a5aa0']]); sh(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = s * 0.02; c.beginPath(); c.moveTo(s * 0.55, s * 0.14); c.lineTo(s * 0.5, s * 0.84); c.stroke();
      break;
    }
    case 'pearl': {
      back(c, s, '#2a5a6a', '#041014');
      disc(s * 0.5, s * 0.52, s * 0.28, INK);
      const g = c.createRadialGradient(s * 0.42, s * 0.42, 0, s * 0.5, s * 0.52, s * 0.26);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8f0ff'); g.addColorStop(1, '#5a9ab8');
      disc(s * 0.5, s * 0.52, s * 0.25, g);
      disc(s * 0.42, s * 0.42, s * 0.06, 'rgba(255,255,255,0.95)');
      break;
    }
    case 'coin': {
      disc(s * 0.5, s * 0.5, s * 0.42, '#3a2204');
      disc(s * 0.5, s * 0.5, s * 0.36, vg(c, s * 0.14, s * 0.86, [[0, '#fff3b0'], [0.5, '#f0b030'], [1, '#b06a10']]));
      c.strokeStyle = 'rgba(120,70,8,0.8)'; c.lineWidth = s * 0.05; c.beginPath(); c.arc(s * 0.5, s * 0.5, s * 0.24, 0, Math.PI * 2); c.stroke();
      disc(s * 0.38, s * 0.36, s * 0.07, 'rgba(255,255,255,0.85)');
      break;
    }
  }
}

export function itemIcon(scene: Phaser.Scene, name: string, size: number) {
  return hi(scene, `itm_${name}_${size}`, size, size, (c) => {
    c.save(); rrect(c, 0, 0, size, size, size * 0.12); c.clip();
    drawItemIcon(c, name, size);
    c.restore();
  });
}

// ---- the cards -------------------------------------------------------------------------

export const CARD = { w: 204, h: 336 };

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function cardTextures(scene: Phaser.Scene, r: Rarity) {
  const col = RARITY[r].color, { w, h } = CARD, m = 20;
  hi(scene, `card_${r}`, w + m * 2, h + m * 2, (c) => {
    c.translate(m, m);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
    rrect(c, 0, 0, w, h, 9); c.fillStyle = '#060708'; c.fill(); c.restore();
    c.save(); rrect(c, 2, 2, w - 4, h - 4, 8); c.clip();
    c.fillStyle = vg(c, 0, h, [[0, '#15161c'], [1, '#08090c']]); c.fillRect(0, 0, w, h);
    c.fillStyle = vg(c, h * 0.55, h, [[0, rgba(col, 0)], [1, rgba(col, 0.26)]]); c.fillRect(0, 0, w, h);
    const top = c.createRadialGradient(w / 2, 0, 0, w / 2, 0, w * 0.8);
    top.addColorStop(0, rgba(col, 0.08)); top.addColorStop(1, rgba(col, 0));
    c.fillStyle = top; c.fillRect(0, 0, w, h);
    c.restore();
    c.lineWidth = 2.4; c.strokeStyle = vg(c, 0, h, [[0, '#ffffff'], [0.15, col], [1, col]]); rrect(c, 1.2, 1.2, w - 2.4, h - 2.4, 8.5); c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.9)'; rrect(c, 3, 3, w - 6, h - 6, 7); c.stroke();
    c.strokeStyle = rgba(col, 0.32); rrect(c, 7, 7, w - 14, h - 14, 5); c.stroke();
    for (const [x, y] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) {
      c.fillStyle = '#050505'; c.beginPath(); c.moveTo(x, y - 4.5); c.lineTo(x + 4.5, y); c.lineTo(x, y + 4.5); c.lineTo(x - 4.5, y); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 2.8); c.lineTo(x + 2.8, y); c.lineTo(x, y + 2.8); c.lineTo(x - 2.8, y); c.closePath(); c.fill();
    }
  });
  hi(scene, `card_glow_${r}`, w + m * 2, h + m * 2, (c) => {
    c.translate(m, m);
    c.shadowColor = col; c.shadowBlur = 16;
    c.lineWidth = 4; c.strokeStyle = rgba(col, 0.9); rrect(c, 0, 0, w, h, 9); c.stroke(); c.stroke();
  });
  hi(scene, `card_disc_${r}`, 76, 76, (c) => {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    c.fillStyle = '#050505'; c.beginPath(); c.arc(38, 38, 33, 0, Math.PI * 2); c.fill(); c.restore();
    c.lineWidth = 3.5; c.strokeStyle = vg(c, 6, 70, [[0, '#ffffff'], [0.3, col], [1, col]]); c.beginPath(); c.arc(38, 38, 30.5, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.beginPath(); c.arc(38, 38, 28.2, 0, Math.PI * 2); c.stroke();
  });
}

export function categoryLabel(it: Item) {
  if (it.cat === 'weapon') return `WEAPON  ·  ${WEAPON_KINDS[it.kind!].label.toUpperCase()}`;
  if (it.cat === 'armor') return 'ARMOR KIT';
  return 'TRINKET';
}

// One item's text block: name, rarity, rule, stat and effect lines. Returns the
// objects (centred on x = 0, starting at y) and the y below the last one.
function itemBody(scene: Phaser.Scene, it: Item, gear: Gear | null, y: number, width: number) {
  const col = RARITY[it.rarity].color;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const name = txt(scene, 0, y, it.name, 'head', { fontSize: '16px', color: col, align: 'center', wordWrap: { width }, strokeThickness: 4 }).setOrigin(0.5, 0);
  objs.push(name);
  y += name.height + 2;
  objs.push(txt(scene, 0, y, RARITY[it.rarity].label.toUpperCase(), 'small', { fontSize: '10px', color: col, letterSpacing: 3, strokeThickness: 2 }).setOrigin(0.5, 0).setAlpha(0.85));
  y += 18;
  objs.push(pic(scene, 0, y, 'ui_line').setScale((width / 640) * 0.9 * 0.5, 0.5).setTint(RARITY[it.rarity].tint).setAlpha(0.6));
  y += 10;
  for (const l of itemLines(it, gear)) {
    if (l.value !== undefined) {
      objs.push(txt(scene, -width / 2, y, l.label, 'label', { fontSize: '13px', strokeThickness: 2 }).setOrigin(0, 0));
      objs.push(txt(scene, width / 2, y, l.value, 'label', { fontSize: '13px', color: l.color ?? C.ivory, strokeThickness: 2 }).setOrigin(1, 0));
      y += 20;
    } else {
      const t = txt(scene, 0, y, l.equip ? `Equip: ${l.label}` : l.label, 'label', {
        fontSize: l.equip ? '13px' : '12px', color: l.equip ? '#1eff00' : (l.color ?? C.body), align: 'center',
        wordWrap: { width }, strokeThickness: 2, fontStyle: l.equip ? 'normal' : 'italic', lineSpacing: 2,
      }).setOrigin(0.5, 0);
      objs.push(t);
      y += t.height + 6;
    }
  }
  return { objs, y };
}

export class ItemCard extends Phaser.GameObjects.Container implements Focusable {
  onHover?: () => void;
  onPick?: () => void;
  private glow: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image;
  private focused = false;
  readonly baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly item: Item, gear: Gear) {
    super(scene, x, y);
    this.baseY = y;
    const r = item.rarity, { w, h } = CARD;
    cardTextures(scene, r);
    this.glow = pic(scene, 0, 0, `card_glow_${r}`).setAlpha(0);
    this.add(this.glow);
    this.add(pic(scene, 0, 0, `card_${r}`));
    // the icon in its disc, over the top edge
    this.add(pic(scene, 0, -h / 2 + 4, `card_disc_${r}`));
    this.add(pic(scene, 0, -h / 2 + 4, itemIcon(scene, item.icon, 44)));
    const tag = txt(scene, 0, -h / 2 + 50, categoryLabel(item), 'small', { fontSize: '10px', color: C.grey, letterSpacing: 2, strokeThickness: 0 }).setOrigin(0.5);
    const pill = scene.add.graphics();
    pill.fillStyle(0x000000, 0.55).fillRoundedRect(-tag.width / 2 - 9, -h / 2 + 41, tag.width + 18, 18, 9);
    pill.lineStyle(1, RARITY[r].tint, 0.45).strokeRoundedRect(-tag.width / 2 - 9, -h / 2 + 41, tag.width + 18, 18, 9);
    this.add([pill, tag]);
    const body = itemBody(scene, item, gear, -h / 2 + 70, w - 34);
    this.add(body.objs);
    const foot = item.cat === 'trinket'
      ? `Kept alongside your ${gear.trinkets.length ? `${gear.trinkets.length} other trinket${gear.trinkets.length > 1 ? 's' : ''}` : 'other gear'}`
      : item.cat === 'weapon' ? `Replaces ${gear.weapon.name}` : gear.armor ? `Replaces ${gear.armor.name}` : 'You wear no armor yet';
    this.add(txt(scene, 0, h / 2 - 22, foot, 'small', { fontSize: '10px', color: C.grey, align: 'center', wordWrap: { width: w - 30 }, strokeThickness: 0 }).setOrigin(0.5));
    this.flash = pic(scene, 0, 0, `card_glow_${r}`).setTintFill(0xffffff).setAlpha(0);
    this.add(this.flash);
    this.setSize(w, h).setInteractive({ cursor: CURSOR_HOVER });
    this.on('pointerover', () => this.onHover?.());
    this.on('pointerup', () => this.activate());
    scene.add.existing(this);
  }

  setFocus(on: boolean) {
    if (on === this.focused) return;
    this.focused = on;
    this.scene.tweens.killTweensOf(this.glow);
    this.scene.tweens.add({ targets: this, y: this.baseY - (on ? 14 : 0), scale: on ? 1.05 : 1, duration: 160, ease: 'Cubic.easeOut' });
    if (on) {
      this.glow.setAlpha(0.6);
      this.scene.tweens.add({ targets: this.glow, alpha: 1, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else this.glow.setAlpha(0);
  }

  activate() {
    this.onPick?.();
  }

  // The chosen card flares white.
  chosen() {
    this.flash.setAlpha(1);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 450 });
    this.scene.tweens.add({ targets: this, scale: 1.12, duration: 220, ease: 'Back.easeOut' });
  }
}

// A tooltip for an item you carry: a dark frame sized to its text.
export function itemTooltip(scene: Phaser.Scene, it: Item) {
  const width = 210;
  const body = itemBody(scene, it, null, 0, width);
  const tag = txt(scene, 0, 0, categoryLabel(it), 'small', { fontSize: '10px', color: C.grey, letterSpacing: 2, strokeThickness: 0 }).setOrigin(0.5, 0);
  const h = Math.round(body.y + 34);
  const f = new Frame(scene, 0, 0, width + 28, h, 'dark');
  tag.setY(-h / 2 + 10);
  f.add(tag);
  for (const o of body.objs) {
    (o as unknown as Phaser.GameObjects.Components.Transform).y += -h / 2 + 26;
    f.add(o);
  }
  return f;
}

export { FONT };
