// The camp between runs (DESIGN.md 8.3): a clearing in the Blightwood with a
// campfire in the middle, a weapon rack where the starting weapon is chosen, a
// training dummy to try it on, and the rune gate that starts the run.
//
// It is room 0 of RoomScene, so walking, the HUD and the pause menu are the
// fight's own; this file holds only what is particular to the camp.
import Phaser from 'phaser';
import { WORLD } from './config';
import { canvas } from './titleArt';
import { starterWeapon, WEAPON_KINDS, type Item, type WeaponKind } from './loot';
import { keycap } from './ui/kit';
import { FONT, RES } from './ui/theme';
import type { ClearSpot, Light, Obstacle } from './blightwood';

const INK = '#06090d';
const { groundTop } = WORLD;

// Where things stand, in room pixels.
export const CAMP = {
  start: { x: 190, y: 470 },
  fire: { x: 720, y: 450 },
  rack: { x: 420, y: groundTop + 30 },
  dummy: { x: 470, y: 535 },
};

// The spots no random prop may take.
export const CAMP_CLEAR: ClearSpot[] = [
  { x: CAMP.fire.x, y: CAMP.fire.y, r: 190 },
  { x: CAMP.rack.x, y: CAMP.rack.y, r: 110 },
  { x: CAMP.dummy.x, y: CAMP.dummy.y, r: 90 },
];

// What the rack offers. 8.4 replaces these with the real weapon types.
export const RACK_KINDS: WeaponKind[] = ['longsword', 'greatblade', 'rapier'];

// The weapon chosen last, remembered in the browser for the next run.
const KEY = 'fellspire.weapon';

export function savedWeapon(): Item {
  try {
    const k = localStorage.getItem(KEY) as WeaponKind | null;
    if (k && k in WEAPON_KINDS) return starterWeapon(k);
  } catch { /* storage blocked: fall back */ }
  return starterWeapon('longsword');
}

export function saveWeapon(kind: WeaponKind) {
  try { localStorage.setItem(KEY, kind); } catch { /* storage blocked */ }
}

// ---- textures ------------------------------------------------------------------------------

// A wooden rack with the three weapons hanging on it, painted at twice its size.
function rackTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('camp_rack')) return;
  canvas(scene, 'camp_rack', 220, 170, (c) => {
    const line = (w: number, col: string, x1: number, y1: number, x2: number, y2: number) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    };
    const wood = (w: number, x1: number, y1: number, x2: number, y2: number) => {
      line(w + 6, INK, x1, y1, x2, y2);
      line(w, '#6a4424', x1, y1, x2, y2);
      line(Math.max(1.5, w * 0.3), '#9a6a3a', x1 - 1, y1, x2 - 1, y2);
    };
    // two A-frame legs and two bars
    wood(9, 22, 164, 38, 40); wood(9, 54, 164, 38, 40);
    wood(9, 166, 164, 182, 40); wood(9, 198, 164, 182, 40);
    wood(8, 20, 54, 200, 54);
    wood(7, 26, 130, 194, 130);
    // pegs on the top bar
    for (const x of [62, 110, 158]) { c.fillStyle = INK; c.beginPath(); c.arc(x, 54, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#b08a50'; c.beginPath(); c.arc(x, 54, 3.5, 0, Math.PI * 2); c.fill(); }

    const steel = (x1: number, y1: number, x2: number, y2: number, w: number) => {
      line(w + 5, INK, x1, y1, x2, y2);
      const g = c.createLinearGradient(x1 - w, 0, x1 + w, 0);
      g.addColorStop(0, '#7a8a9a'); g.addColorStop(0.5, '#e8eef4'); g.addColorStop(1, '#8a9aa8');
      c.strokeStyle = g; c.lineWidth = w; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    };
    const guard = (x: number, y: number, w: number) => { line(8, INK, x - w, y, x + w, y); line(4, '#d8a840', x - w, y, x + w, y); };
    const grip = (x: number, y1: number, y2: number) => { line(8, INK, x, y1, x, y2); line(4, '#4a2a14', x, y1, x, y2); c.fillStyle = '#d8a840'; c.beginPath(); c.arc(x, y1 - 3, 4, 0, Math.PI * 2); c.fill(); };
    // each blade hangs point down from its peg, hilt up
    // longsword
    grip(62, 40, 58); guard(62, 60, 13); steel(62, 63, 62, 138, 7);
    // greatblade, broad and long
    grip(110, 30, 56); guard(110, 58, 18); steel(110, 62, 110, 152, 13);
    // rapier: a basket guard and a thin blade
    grip(158, 40, 58);
    c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.arc(158, 62, 10, Math.PI, 0, true); c.stroke();
    c.strokeStyle = '#d8a840'; c.lineWidth = 3; c.beginPath(); c.arc(158, 62, 10, Math.PI, 0, true); c.stroke();
    guard(158, 62, 11); steel(158, 64, 158, 146, 3.5);
  });
}

// ---- the camp ---------------------------------------------------------------------------------

export class Camp {
  private prompt: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Image;
  chosen = false; // a weapon was taken from the rack this visit

  constructor(private scene: Phaser.Scene, lights: Light[], obstacles: Obstacle[]) {
    this.buildFire(lights, obstacles);
    rackTexture(scene);
    const { x, y } = CAMP.rack;
    this.glow = scene.add.image(x, y - 40, 'tt_light').setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 0.7).setAlpha(0).setDepth(y - 1);
    scene.add.image(x, y + 4, 'camp_rack').setOrigin(0.5, 0.96).setScale(0.5).setDepth(y);
    obstacles.push({ x, y, rx: 52, ry: 9 });
    lights.push({ x, y: y + 10, radius: 120, strength: 0.35 });

    this.prompt = scene.add.container(x, y - 98).setDepth(19500).setAlpha(0);
    const cap = keycap(scene, 0, 0, 'E');
    const label = scene.add.text(16, 0, 'Choose a weapon', { fontFamily: FONT.label, fontSize: '13px', color: '#f0e6d2', stroke: '#000', strokeThickness: 3, resolution: RES * 2 }).setOrigin(0, 0.5);
    cap.x = -label.width / 2 - 4; label.x = cap.x + 14;
    this.prompt.add([cap, label]);
  }

  // The rack's three weapons, as cards.
  rackItems(): Item[] {
    return RACK_KINDS.map(starterWeapon);
  }

  private buildFire(lights: Light[], obstacles: Obstacle[]) {
    const s = this.scene, { x, y } = CAMP.fire;
    s.add.image(x, y + 6, 'fw_pool').setTint(0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setScale(3.2, 2.6).setAlpha(0.5).setDepth(0.5);
    const halo = s.add.image(x, y - 46, 'tt_light').setTint(0xff9a3c).setBlendMode(Phaser.BlendModes.ADD).setScale(1.9).setAlpha(0.32).setDepth(y + 3);
    s.time.addEvent({ delay: 90, loop: true, callback: () => { const f = Math.random(); halo.setAlpha(0.27 + f * 0.1).setScale(1.85 + f * 0.2); } });
    s.add.image(x, y + 4, 'tt_stones').setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    s.add.image(x, y - 1, 'tt_logs').setOrigin(0.5, 1).setScale(0.45).setDepth(y + 1);
    for (const [tint, f, dx] of [[0xff5a14, 0.62, 0], [0xffa03a, 0.46, -3], [0xfff0b0, 0.27, 1]] as const) {
      const fl = s.add.image(x + dx, y - 10, 'tt_flame').setOrigin(0.5, 0.92).setScale(f * 0.75, f).setTint(tint).setDepth(y + 2).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({ targets: fl, scaleY: f * 1.18, scaleX: f * 0.68, duration: 140 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      s.tweens.add({ targets: fl, angle: { from: -5, to: 5 }, duration: 300 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    s.add.particles(x, y - 24, 'tt_dot', {
      x: { min: -10, max: 10 }, speedY: { min: -80, max: -35 }, speedX: { min: -18, max: 18 },
      lifespan: { min: 1200, max: 2400 }, scale: { start: 0.24, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xffd27a, 0xff9a3c, 0xff6a2a], blendMode: 'ADD', frequency: 70,
    }).setDepth(y + 3);
    obstacles.push({ x, y, rx: 34, ry: 12 });
    lights.push({ x, y: y + 6, radius: 300, strength: 1 });
    // stumps to sit on around the fire
    for (const [dx, dy] of [[-92, -26], [96, -18], [-70, 44], [84, 48]]) {
      const sx = x + dx, sy = y + dy;
      s.add.image(sx, sy, 'fw_stump').setOrigin(0.5, 0.92).setScale(0.62).setDepth(sy).setFlipX(dx > 0);
      obstacles.push({ x: sx, y: sy, rx: 17, ry: 7 });
    }
  }

  // near: the hero stands by the rack and can choose
  update(near: boolean) {
    const { y } = CAMP.rack;
    this.prompt.setAlpha(Phaser.Math.Linear(this.prompt.alpha, near ? 1 : 0, 0.2)).setY(y - 98 + Math.sin(this.scene.time.now / 250) * 2);
    this.glow.setAlpha(Phaser.Math.Linear(this.glow.alpha, near ? 0.55 : 0, 0.15));
  }
}
