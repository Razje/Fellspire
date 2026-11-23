// Drawn stand-ins, used for any character or background that has no art yet.
import Phaser from 'phaser';

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
