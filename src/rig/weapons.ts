// Weapon parts drawn here in the CraftPix chibi style (thick dark outline, flat
// shading, a light edge), at the same pixel scale as the packs' own parts so they
// sit in the same hand. Each comes with its grip: the pixel the hand closes on.
import Phaser from 'phaser';
import type { PartSwap } from './Rig';

const OUT = '#1c1612';
// Where the hand holds the pack's own Sword.png (400 x 128): on the grip, between
// pommel and crossguard.
export const SWORD_GRIP: [number, number] = [80, 64];

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
  // A pair of short daggers would be two parts; for the proof, one long knife.
  canvas(scene, 'wpn_dagger', 260, 110, (c) => {
    c.fillStyle = OUT; c.beginPath(); c.moveTo(20, 55); c.lineTo(110, 40); c.lineTo(245, 55); c.lineTo(110, 72); c.closePath(); c.fill();
    c.fillStyle = OUT; c.beginPath(); c.roundRect(10, 38, 100, 34, 10); c.fill();
    const g = c.createLinearGradient(0, 44, 0, 66); g.addColorStop(0, '#f4f8fc'); g.addColorStop(1, '#7a8898');
    c.fillStyle = g; c.beginPath(); c.moveTo(110, 46); c.lineTo(232, 55); c.lineTo(110, 64); c.closePath(); c.fill();
    c.fillStyle = '#4a2a14'; c.beginPath(); c.roundRect(18, 46, 70, 18, 6); c.fill();
    c.fillStyle = '#e0b04a'; c.fillRect(92, 32, 14, 46);
  });
  return {
    bow: { texture: 'wpn_bow', grip: { from: SWORD_GRIP, to: [150, 220] } },
    staff: { texture: 'wpn_staff', grip: { from: SWORD_GRIP, to: [190, 75] } },
    dagger: { texture: 'wpn_dagger', grip: { from: SWORD_GRIP, to: [52, 55] } },
  };
}
