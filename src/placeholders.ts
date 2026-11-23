// Drawn stand-ins, used for any character or background that has no art yet.
import Phaser from 'phaser';
import { WORLD } from './config';

const darken = (c: number, pct: number) => Phaser.Display.Color.IntegerToColor(c).darken(pct).color;

interface ChibiLook {
  skin: number;
  body: number;
  accent: number;
  eye: number;
  weapon: 'sword' | 'claw' | 'bone';
  helmet?: boolean;
  hood?: boolean;
}

// 72 x 84 texture, feet on the bottom edge, facing right.
function chibi(scene: Phaser.Scene, key: string, o: ChibiLook) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // legs
  g.fillStyle(darken(o.body, 30), 1);
  g.fillRoundedRect(25, 62, 9, 21, 3);
  g.fillRoundedRect(38, 62, 9, 21, 3);
  // back arm
  g.fillStyle(darken(o.skin, 20), 1);
  g.fillRoundedRect(18, 46, 8, 16, 3);
  // body
  g.fillStyle(o.body, 1);
  g.fillRoundedRect(21, 42, 30, 26, 7);
  g.fillStyle(o.accent, 1);
  g.fillRect(21, 57, 30, 4);
  // weapon arm
  if (o.weapon === 'sword') {
    g.fillStyle(0xe4e8ee, 1);
    g.fillRect(55, 14, 6, 40);
    g.fillTriangle(55, 14, 61, 14, 58, 6);
    g.fillStyle(o.accent, 1);
    g.fillRect(49, 52, 18, 5);
    g.fillStyle(0x5a3b22, 1);
    g.fillRect(56, 57, 4, 9);
  } else if (o.weapon === 'bone') {
    g.fillStyle(0xeee8d8, 1);
    g.fillRect(52, 44, 16, 5);
    g.fillCircle(52, 44, 3);
    g.fillCircle(52, 49, 3);
    g.fillCircle(68, 44, 3);
    g.fillCircle(68, 49, 3);
  } else {
    g.fillStyle(0xd8d0b8, 1);
    g.fillTriangle(56, 50, 66, 46, 60, 54);
    g.fillTriangle(56, 54, 67, 53, 59, 58);
  }
  g.fillStyle(o.skin, 1);
  g.fillRoundedRect(46, 46, 9, 15, 3);
  // head
  g.fillStyle(o.skin, 1);
  g.fillCircle(36, 25, 21);
  if (o.helmet) {
    g.fillStyle(o.body, 1);
    g.fillRoundedRect(14, 4, 44, 17, { tl: 16, tr: 16, bl: 2, br: 2 });
    g.fillStyle(o.accent, 1);
    g.fillRect(34, 2, 5, 20);
  }
  if (o.hood) {
    g.fillStyle(darken(o.body, 15), 1);
    g.fillRoundedRect(13, 3, 42, 20, { tl: 18, tr: 14, bl: 4, br: 2 });
  }
  // eyes
  g.fillStyle(o.eye, 1);
  g.fillCircle(41, 28, 3.5);
  g.fillCircle(51, 28, 3.5);
  g.generateTexture(key, 72, 84);
  g.destroy();
}

export function makePlaceholderTextures(scene: Phaser.Scene) {
  chibi(scene, 'ph_hero', { skin: 0xf1c7a0, body: 0x5d7fa8, accent: 0xe0b44a, eye: 0x1d2433, weapon: 'sword', helmet: true });
  chibi(scene, 'ph_ghoul', { skin: 0x8fae78, body: 0x5a4a3a, accent: 0x3b2f25, eye: 0xf4e04d, weapon: 'claw' });
  chibi(scene, 'ph_archer', { skin: 0xe9e3d0, body: 0x3a3442, accent: 0x7a2f2f, eye: 0xff5a3c, weapon: 'bone', hood: true });

  let g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xeee8d8, 1);
  g.fillRect(6, 3, 18, 4);
  [4, 26].forEach((x) => { g.fillCircle(x, 3, 3); g.fillCircle(x, 7, 3); });
  g.generateTexture('ph_bone', 30, 11);
  g.destroy();

  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x3cff8a, 0.25); g.fillCircle(14, 14, 14);
  g.fillStyle(0x48e07a, 1); g.fillCircle(14, 14, 8);
  g.fillStyle(0xd8ffe6, 1); g.fillCircle(11, 11, 3);
  g.generateTexture('ph_orb', 28, 28);
  g.destroy();
}

// ---- Blightwood stand-in scenery ------------------------------------------

function wrapDraw(w: number, x: number, draw: (x: number) => void) {
  draw(x); draw(x - w); draw(x + w);
}

function treeLayer(scene: Phaser.Scene, key: string, color: number, count: number, baseY: number, size: number, seed: string) {
  const W = WORLD.viewW, H = WORLD.viewH;
  const rnd = new Phaser.Math.RandomDataGenerator([seed]);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(color, 1);
  g.fillRect(0, baseY, W, H - baseY);
  for (let i = 0; i < count; i++) {
    const x = rnd.between(0, W);
    const s = size * rnd.realInRange(0.7, 1.3);
    const dead = rnd.frac() < 0.4;
    wrapDraw(W, x, (tx) => {
      g.fillRect(tx - s * 0.06, baseY - s * 1.1, s * 0.12, s * 1.15);
      if (dead) {
        g.lineStyle(Math.max(2, s * 0.04), color, 1);
        g.lineBetween(tx, baseY - s * 0.8, tx - s * 0.35, baseY - s * 1.2);
        g.lineBetween(tx, baseY - s * 0.95, tx + s * 0.3, baseY - s * 1.35);
        g.lineBetween(tx - s * 0.2, baseY - s * 1.02, tx - s * 0.3, baseY - s * 1.4);
      } else {
        for (let k = 0; k < 3; k++) {
          const w = s * (0.55 - k * 0.12), top = baseY - s * (0.55 + k * 0.38);
          g.fillTriangle(tx - w, top + s * 0.5, tx + w, top + s * 0.5, tx, top);
        }
      }
    });
  }
  g.generateTexture(key, W, H);
  g.destroy();
}

export function makeBlightwoodTextures(scene: Phaser.Scene) {
  const W = WORLD.viewW, H = WORLD.viewH;
  let g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillGradientStyle(0x10141f, 0x10141f, 0x46584c, 0x46584c, 1);
  g.fillRect(0, 0, W, H);
  g.fillStyle(0xdfe8d0, 0.08); g.fillCircle(720, 110, 90);
  g.fillStyle(0xdfe8d0, 0.12); g.fillCircle(720, 110, 60);
  g.fillStyle(0xe8efda, 1); g.fillCircle(720, 110, 38);
  g.generateTexture('bgph_sky', W, H);
  g.destroy();

  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x2b3b37, 1);
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const y = 300 - 40 * Math.sin((x / W) * Math.PI * 2) - 22 * Math.sin((x / W) * Math.PI * 6 + 1);
    g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.closePath();
  g.fillPath();
  g.generateTexture('bgph_hills', W, H);
  g.destroy();

  treeLayer(scene, 'bgph_trees_far', 0x223029, 16, 345, 120, 'far');
  treeLayer(scene, 'bgph_trees_near', 0x151d1a, 9, 380, 190, 'near');

  // ground tile
  const GW = 256, GH = 180;
  const rnd = new Phaser.Math.RandomDataGenerator(['ground']);
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x3a3a2c, 1); g.fillRect(0, 0, GW, GH);
  for (let i = 0; i < 40; i++) {
    g.fillStyle(rnd.pick([0x313126, 0x434232, 0x2c2d23]), 1);
    const x = rnd.between(0, GW), y = rnd.between(10, GH), w = rnd.between(14, 50);
    wrapDraw(GW, x, (tx) => g.fillEllipse(tx, y, w, w * 0.35));
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle(rnd.pick([0x4f6236, 0x3f5130]), 1);
    const x = rnd.between(0, GW), y = rnd.between(14, GH);
    wrapDraw(GW, x, (tx) => g.fillTriangle(tx - 3, y, tx + 3, y, tx + rnd.between(-2, 2), y - rnd.between(5, 10)));
  }
  g.fillStyle(0x26301f, 1); g.fillRect(0, 0, GW, 8);
  g.fillStyle(0x4f6236, 1);
  for (let x = 0; x < GW; x += 6) g.fillTriangle(x, 8, x + 6, 8, x + 3, 8 - ((x * 7) % 9));
  g.generateTexture('bgph_ground', GW, GH);
  g.destroy();

  // props
  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x6c6f72, 1); g.fillRoundedRect(4, 6, 32, 46, { tl: 16, tr: 16, bl: 0, br: 0 });
  g.fillStyle(0x55585b, 1); g.fillRect(17, 16, 6, 22); g.fillRect(11, 22, 18, 5);
  g.fillStyle(0x3b4a2a, 1); g.fillEllipse(20, 52, 44, 8);
  g.generateTexture('prop_grave', 40, 56);
  g.destroy();

  g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x4a3a2c, 1);
  for (let x = 4; x < 120; x += 22) { g.fillRect(x, 10, 7, 40); g.fillTriangle(x, 10, x + 7, 10, x + 3.5, 3); }
  g.fillRect(0, 20, 124, 5); g.fillRect(0, 36, 124, 5);
  g.generateTexture('prop_fence', 124, 52);
  g.destroy();
}
