// Weapon parts drawn here in the CraftPix chibi style (thick dark outline, flat
// shading, a light edge), at the same pixel scale as the packs' own parts so they
// sit in the same hand. Each comes with its grip: the pixel the hand closes on.
import Phaser from 'phaser';
import type { PartSwap, Rig } from './Rig';
import type { WeaponKind } from '../weapons';

const OUT = '#1c1612';
// Where the hand holds the pack's own Sword.png (400 x 128): on the grip, between
// pommel and crossguard.
export const SWORD_GRIP: [number, number] = [80, 64];
// Where the other hand holds the Valkyrie's Shield.png (160 x 160): its middle.
export const SHIELD_GRIP: [number, number] = [80, 80];

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  c.lineJoin = 'round'; c.lineCap = 'round';
  draw(c);
  t.refresh();
}

export function weaponParts(scene: Phaser.Scene): Record<string, PartSwap> {
  // A recurve bow standing across the sword's line, belly forward, string behind.
  canvas(scene, 'wpn_bow', 200, 440, (c) => {
    const limb = () => {
      c.beginPath();
      c.moveTo(52, 22); c.quadraticCurveTo(150, 70, 150, 220); c.quadraticCurveTo(150, 370, 52, 418);
    };
    c.strokeStyle = '#d8d0b8'; c.lineWidth = 5; c.beginPath(); c.moveTo(50, 26); c.lineTo(50, 414); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 34; limb(); c.stroke();
    const g = c.createLinearGradient(60, 0, 150, 0); g.addColorStop(0, '#5a3418'); g.addColorStop(1, '#9a6230');
    c.strokeStyle = g; c.lineWidth = 20; limb(); c.stroke();
    c.strokeStyle = 'rgba(255,230,190,0.35)'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(60, 34); c.quadraticCurveTo(140, 80, 142, 200); c.stroke();
    // gilded tips and a leather grip
    for (const [x, y] of [[52, 22], [52, 418]]) {
      c.fillStyle = OUT; c.beginPath(); c.arc(x, y, 17, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e0b04a'; c.beginPath(); c.arc(x, y, 10, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = OUT; c.beginPath(); c.roundRect(126, 180, 50, 80, 12); c.fill();
    c.fillStyle = '#3a2212'; c.beginPath(); c.roundRect(133, 187, 36, 66, 8); c.fill();
    c.strokeStyle = '#6a4424'; c.lineWidth = 4;
    for (let y = 196; y < 250; y += 12) { c.beginPath(); c.moveTo(134, y); c.lineTo(168, y + 6); c.stroke(); }
  });
  // A long staff along the sword's line, a glowing crystal at its head.
  canvas(scene, 'wpn_staff', 640, 150, (c) => {
    c.strokeStyle = OUT; c.lineWidth = 30; c.beginPath(); c.moveTo(20, 75); c.lineTo(520, 75); c.stroke();
    const g = c.createLinearGradient(0, 62, 0, 88); g.addColorStop(0, '#a87440'); g.addColorStop(1, '#4a2a12');
    c.strokeStyle = g; c.lineWidth = 16; c.beginPath(); c.moveTo(22, 75); c.lineTo(518, 75); c.stroke();
    for (const x of [130, 250, 500]) { c.fillStyle = OUT; c.fillRect(x - 10, 56, 20, 38); c.fillStyle = '#e0b04a'; c.fillRect(x - 5, 61, 10, 28); }
    // prongs holding the crystal
    c.strokeStyle = OUT; c.lineWidth = 14;
    c.beginPath(); c.moveTo(505, 75); c.quadraticCurveTo(560, 20, 600, 40); c.moveTo(505, 75); c.quadraticCurveTo(560, 130, 600, 110); c.stroke();
    c.strokeStyle = '#e0b04a'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(508, 75); c.quadraticCurveTo(560, 24, 598, 42); c.moveTo(508, 75); c.quadraticCurveTo(560, 126, 598, 108); c.stroke();
    const glow = c.createRadialGradient(580, 75, 0, 580, 75, 60);
    glow.addColorStop(0, 'rgba(160,255,240,0.9)'); glow.addColorStop(1, 'rgba(160,255,240,0)');
    c.fillStyle = glow; c.fillRect(520, 15, 120, 120);
    c.fillStyle = OUT; c.beginPath(); c.moveTo(580, 40); c.lineTo(608, 75); c.lineTo(580, 110); c.lineTo(552, 75); c.closePath(); c.fill();
    const cg = c.createLinearGradient(552, 40, 608, 110); cg.addColorStop(0, '#e8fff8'); cg.addColorStop(0.5, '#5ae8d0'); cg.addColorStop(1, '#1a7a6a');
    c.fillStyle = cg; c.beginPath(); c.moveTo(580, 50); c.lineTo(600, 75); c.lineTo(580, 100); c.lineTo(560, 75); c.closePath(); c.fill();
  });
  // A two-handed greatsword along the sword's line, about half as long again.
  canvas(scene, 'wpn_greatsword', 600, 150, (c) => {
    // blade
    c.fillStyle = OUT; c.beginPath(); c.moveTo(150, 46); c.lineTo(540, 50); c.lineTo(592, 75); c.lineTo(540, 100); c.lineTo(150, 104); c.closePath(); c.fill();
    const g = c.createLinearGradient(0, 54, 0, 96); g.addColorStop(0, '#f4f8fc'); g.addColorStop(0.5, '#b8c4d0'); g.addColorStop(0.55, '#7a8898'); g.addColorStop(1, '#c8d2dc');
    c.fillStyle = g; c.beginPath(); c.moveTo(156, 55); c.lineTo(538, 58); c.lineTo(578, 75); c.lineTo(538, 92); c.lineTo(156, 95); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,70,84,0.7)'; c.lineWidth = 4; c.beginPath(); c.moveTo(160, 75); c.lineTo(520, 75); c.stroke();
    // crossguard, grip and pommel
    c.fillStyle = OUT; c.beginPath(); c.roundRect(126, 14, 34, 122, 12); c.fill();
    const gold = c.createLinearGradient(0, 18, 0, 132); gold.addColorStop(0, '#fff1b8'); gold.addColorStop(0.5, '#e0b04a'); gold.addColorStop(1, '#8a5f1a');
    c.fillStyle = gold; c.beginPath(); c.roundRect(133, 21, 20, 108, 8); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.roundRect(24, 58, 108, 34, 10); c.fill();
    c.fillStyle = '#4a2a14'; c.beginPath(); c.roundRect(30, 64, 98, 22, 7); c.fill();
    c.strokeStyle = '#7a4a24'; c.lineWidth = 4;
    for (let x = 40; x < 126; x += 14) { c.beginPath(); c.moveTo(x, 65); c.lineTo(x + 8, 85); c.stroke(); }
    c.fillStyle = OUT; c.beginPath(); c.arc(22, 75, 22, 0, Math.PI * 2); c.fill();
    c.fillStyle = gold; c.beginPath(); c.arc(22, 75, 14, 0, Math.PI * 2); c.fill();
  });
  // A long dagger along the sword's line, a little curved: one for each hand.
  canvas(scene, 'wpn_dagger', 280, 110, (c) => {
    // blade
    c.fillStyle = OUT; c.beginPath(); c.moveTo(96, 34); c.quadraticCurveTo(200, 30, 272, 52); c.quadraticCurveTo(200, 80, 96, 76); c.closePath(); c.fill();
    const g = c.createLinearGradient(0, 40, 0, 72); g.addColorStop(0, '#f4f8fc'); g.addColorStop(0.5, '#b8c4d0'); g.addColorStop(0.55, '#7a8898'); g.addColorStop(1, '#c8d2dc');
    c.fillStyle = g; c.beginPath(); c.moveTo(100, 42); c.quadraticCurveTo(200, 40, 256, 53); c.quadraticCurveTo(200, 70, 100, 68); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,70,84,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(104, 55); c.quadraticCurveTo(180, 53, 230, 54); c.stroke();
    // guard, grip and pommel
    c.fillStyle = OUT; c.beginPath(); c.roundRect(80, 20, 24, 70, 9); c.fill();
    const gold = c.createLinearGradient(0, 24, 0, 86); gold.addColorStop(0, '#fff1b8'); gold.addColorStop(0.5, '#e0b04a'); gold.addColorStop(1, '#8a5f1a');
    c.fillStyle = gold; c.beginPath(); c.roundRect(85, 25, 14, 60, 6); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.roundRect(22, 40, 62, 30, 9); c.fill();
    c.fillStyle = '#3a1e30'; c.beginPath(); c.roundRect(28, 46, 52, 18, 6); c.fill();
    c.strokeStyle = '#6a3a5a'; c.lineWidth = 3;
    for (let x = 34; x < 78; x += 11) { c.beginPath(); c.moveTo(x, 47); c.lineTo(x + 6, 63); c.stroke(); }
    c.fillStyle = OUT; c.beginPath(); c.arc(20, 55, 17, 0, Math.PI * 2); c.fill();
    c.fillStyle = gold; c.beginPath(); c.arc(20, 55, 10, 0, Math.PI * 2); c.fill();
  });
  // A short wand of dark wood, a violet gem in a gold cap.
  canvas(scene, 'wpn_wand', 300, 90, (c) => {
    c.strokeStyle = OUT; c.lineWidth = 24; c.beginPath(); c.moveTo(14, 45); c.lineTo(236, 45); c.stroke();
    const g = c.createLinearGradient(0, 36, 0, 56); g.addColorStop(0, '#6a4a6a'); g.addColorStop(1, '#2a1626');
    c.strokeStyle = g; c.lineWidth = 12; c.beginPath(); c.moveTo(16, 45); c.lineTo(234, 45); c.stroke();
    c.strokeStyle = 'rgba(255,220,255,0.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(24, 41); c.lineTo(226, 41); c.stroke();
    for (const x of [92, 220]) { c.fillStyle = OUT; c.fillRect(x - 9, 28, 18, 34); c.fillStyle = '#e0b04a'; c.fillRect(x - 4, 33, 8, 24); }
    const glow = c.createRadialGradient(262, 45, 0, 262, 45, 40);
    glow.addColorStop(0, 'rgba(210,160,255,0.9)'); glow.addColorStop(1, 'rgba(210,160,255,0)');
    c.fillStyle = glow; c.fillRect(222, 5, 78, 80);
    c.fillStyle = OUT; c.beginPath(); c.moveTo(262, 18); c.lineTo(288, 45); c.lineTo(262, 72); c.lineTo(236, 45); c.closePath(); c.fill();
    const cg = c.createLinearGradient(240, 20, 285, 70); cg.addColorStop(0, '#f8eaff'); cg.addColorStop(0.5, '#a86af0'); cg.addColorStop(1, '#4a1a8a');
    c.fillStyle = cg; c.beginPath(); c.moveTo(262, 27); c.lineTo(279, 45); c.lineTo(262, 63); c.lineTo(245, 45); c.closePath(); c.fill();
  });
  return {
    greatsword: { texture: 'wpn_greatsword', grip: { from: SWORD_GRIP, to: [92, 75], rest: 70 } },
    bow: { texture: 'wpn_bow', grip: { from: SWORD_GRIP, to: [150, 220], scale: 1.2, rest: -35 } },
    staff: { texture: 'wpn_staff', grip: { from: SWORD_GRIP, to: [190, 75], scale: 1.25, rest: 80 } },
    blades: { texture: 'wpn_dagger', grip: { from: SWORD_GRIP, to: [52, 55], rest: 60 }, front: 'Right Hand.png' },
    // the second blade sits where the shield was, in the other hand
    offhand: { texture: 'wpn_dagger', grip: { from: SHIELD_GRIP, to: [52, 55], angle: 0 } },
    wand: { texture: 'wpn_wand', grip: { from: SWORD_GRIP, to: [60, 45], scale: 1.15, rest: 15 }, front: 'Right Hand.png' },
  };
}

// Puts a weapon kind in a rig's hand. The pack's sword and shield are the sword
// kind; every other kind hides the shield and its swing trail, and is shown in the
// hand all the time (the pack's own sword only appears while it swings).
export function armRig(rig: Rig, kind: WeaponKind) {
  const parts = weaponParts(rig.scene);
  for (const f of ['Sword.png', 'Shield.png', 'SlashFX.png']) rig.skin.delete(f);
  if (kind !== 'sword') {
    rig.skin.set('Sword.png', { ...parts[kind], show: true });
    rig.skin.set('Shield.png', kind === 'blades' ? { ...parts.offhand, show: true } : { texture: null });
    if (kind !== 'greatsword' && kind !== 'blades') rig.skin.set('SlashFX.png', { texture: null });
  }
  rig.step(0);
  return rig;
}
