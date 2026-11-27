// Where the run is, drawn: a glyph per level type (over the rune gates and on the
// HUD's level strip), the strip of an area's five levels under the room plaque, and
// the road of five areas on the pause menu.
import Phaser from 'phaser';
import { hi, pic } from './kit';
import { C, txt } from './theme';
import { AREAS, LAST_TIER, LEVELS_PER_AREA, area, type LevelType } from '../world';
import type { Run } from '../run';

type Ctx = CanvasRenderingContext2D;
const INK = '#05070a';

function grad(c: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

// Each type has its own colour, so a gate reads from across the room.
export const TYPE_COLOUR: Record<LevelType, { tint: number; stops: [number, string][]; css: string }> = {
  normal: { tint: 0x3fe8dc, stops: [[0, '#f4fbff'], [1, '#9ab4c4']], css: '#c8dce8' },
  challenge: { tint: 0xffb83a, stops: [[0, '#fff4c0'], [0.5, '#f2b03a'], [1, '#a8661a']], css: '#f2c25a' },
  elite: { tint: 0xff4a3a, stops: [[0, '#ffd8c8'], [0.5, '#ff5a3c'], [1, '#9a140a']], css: '#ff7a5a' },
  boss: { tint: 0xb46aff, stops: [[0, '#f4e8ff'], [0.5, '#c08aff'], [1, '#5a2a9a']], css: '#c8a0ff' },
};

// A level type's sign: crossed swords, an hourglass, a crown, a skull.
export function levelGlyph(scene: Phaser.Scene, type: LevelType, s: number): string {
  return hi(scene, `glyph_${type}_${s}`, s, s, (c) => {
    const fill = grad(c, s * 0.1, s * 0.9, TYPE_COLOUR[type].stops);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const both = (path: () => void, w = s * 0.08) => {
      path(); c.strokeStyle = INK; c.lineWidth = w + s * 0.1; c.stroke();
      path(); c.strokeStyle = fill; c.lineWidth = w; c.stroke();
    };
    const shape = (path: () => void) => {
      path(); c.strokeStyle = INK; c.lineWidth = s * 0.1; c.stroke();
      path(); c.fillStyle = fill; c.fill();
    };
    switch (type) {
      case 'normal':
        for (const d of [1, -1]) {
          const a = s * (0.5 - d * 0.3), b = s * (0.5 + d * 0.3);
          both(() => { c.beginPath(); c.moveTo(a, s * 0.2); c.lineTo(b, s * 0.78); });
          both(() => { c.beginPath(); c.moveTo(s * 0.5 + d * s * 0.2 - s * 0.08, s * 0.66); c.lineTo(s * 0.5 + d * s * 0.2 + s * 0.08, s * 0.58); }, s * 0.07);
        }
        break;
      case 'challenge':
        shape(() => {
          c.beginPath();
          c.moveTo(s * 0.26, s * 0.16); c.lineTo(s * 0.74, s * 0.16); c.lineTo(s * 0.54, s * 0.5);
          c.lineTo(s * 0.74, s * 0.84); c.lineTo(s * 0.26, s * 0.84); c.lineTo(s * 0.46, s * 0.5); c.closePath();
        });
        c.fillStyle = INK;
        c.beginPath(); c.moveTo(s * 0.36, s * 0.78); c.lineTo(s * 0.64, s * 0.78); c.lineTo(s * 0.5, s * 0.62); c.closePath(); c.fill();
        break;
      case 'elite':
        shape(() => {
          c.beginPath();
          c.moveTo(s * 0.16, s * 0.74); c.lineTo(s * 0.12, s * 0.3); c.lineTo(s * 0.34, s * 0.5); c.lineTo(s * 0.5, s * 0.2);
          c.lineTo(s * 0.66, s * 0.5); c.lineTo(s * 0.88, s * 0.3); c.lineTo(s * 0.84, s * 0.74); c.closePath();
        });
        c.fillStyle = INK;
        c.fillRect(s * 0.2, s * 0.64, s * 0.6, s * 0.04);
        break;
      case 'boss':
        shape(() => {
          c.beginPath(); c.arc(s * 0.5, s * 0.44, s * 0.32, 0, Math.PI * 2);
          c.rect(s * 0.32, s * 0.6, s * 0.36, s * 0.24);
        });
        c.fillStyle = INK;
        c.beginPath(); c.ellipse(s * 0.37, s * 0.47, s * 0.09, s * 0.1, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(s * 0.63, s * 0.47, s * 0.09, s * 0.1, 0, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 3; i++) c.fillRect(s * (0.39 + i * 0.09), s * 0.72, s * 0.03, s * 0.12);
        break;
    }
  });
}

// A small diamond on the strip: a level done, the one you are on, or still ahead.
function nodeTexture(scene: Phaser.Scene, state: 'done' | 'now' | 'ahead'): string {
  const s = 14;
  return hi(scene, `runnode_${state}`, s, s, (c) => {
    const d = (r: number) => { c.beginPath(); c.moveTo(s / 2, s / 2 - r); c.lineTo(s / 2 + r, s / 2); c.lineTo(s / 2, s / 2 + r); c.lineTo(s / 2 - r, s / 2); c.closePath(); };
    d(6.5); c.fillStyle = INK; c.fill();
    d(5); c.fillStyle = state === 'ahead' ? '#28323c' : grad(c, 2, 12, [[0, '#fff1b8'], [0.5, '#e0b04a'], [1, '#8a5f1a']]); c.fill();
    if (state === 'now') { d(2.4); c.fillStyle = '#fff8e0'; c.fill(); }
  });
}

// The strip of an area's levels: a diamond for each, joined by a line, with the type's
// glyph over the levels already chosen and the boss's skull over the last. x is the
// middle, y the line.
export function levelStrip(scene: Phaser.Scene, x: number, y: number, run: Run, level: number): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const gap = 30, n = LEVELS_PER_AREA;
  const left = -((n - 1) * gap) / 2;
  root.add(scene.add.rectangle(0, 0, (n - 1) * gap, 2, 0x000000, 0.8));
  root.add(scene.add.rectangle(0, 0, (n - 1) * gap, 1, 0x8a6a2a, 0.9));
  for (let i = 0; i < n; i++) {
    const lv = i + 1, nx = left + i * gap;
    const state = lv < level ? 'done' : lv === level ? 'now' : 'ahead';
    const node = pic(scene, nx, 0, nodeTexture(scene, state));
    root.add(node);
    const type: LevelType | undefined = lv === n ? 'boss' : run.levels[i];
    if (type && (lv <= level || type === 'boss')) {
      const g = pic(scene, nx, -12, levelGlyph(scene, type, 16)).setAlpha(lv < level ? 0.55 : 1);
      root.add(g);
    }
    if (state === 'now') {
      scene.tweens.add({ targets: node, scale: node.scale * 1.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  return root;
}

// The road through the run, for the pause menu: a column per tier, the area taken (or
// in) lit, an area still ahead shown as its choices, dim.
export function roadPanel(scene: Phaser.Scene, x: number, y: number, run: Run): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const gap = 118;
  const left = -(LAST_TIER * gap) / 2;
  root.add(scene.add.rectangle(0, 0, LAST_TIER * gap, 2, 0x000000, 0.8));
  root.add(scene.add.rectangle(0, 0, LAST_TIER * gap, 1, 0x8a6a2a, 0.9));
  // each area in its tier's column (a jump to an area by ?area= leaves earlier ones open)
  const here = area(run.route[run.route.length - 1]).tier;
  for (let t = 0; t <= LAST_TIER; t++) {
    const nx = left + t * gap;
    const taken = run.route.find((id) => area(id).tier === t);
    const state = t < here ? 'done' : t === here ? 'now' : 'ahead';
    root.add(pic(scene, nx, 0, nodeTexture(scene, state)).setScale(0.75));
    const names = taken ? [area(taken).name] : AREAS.filter((a) => a.tier === t).map((a) => a.name);
    names.forEach((name, i) => {
      const colour = state === 'now' ? C.gold : state === 'done' ? C.ivory : C.grey;
      root.add(txt(scene, nx, 16 + i * 14, name, 'small', { fontSize: '10px', color: colour }).setOrigin(0.5, 0).setAlpha(state === 'ahead' ? 0.75 : 1));
    });
  }
  return root;
}
