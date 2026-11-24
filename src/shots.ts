// The player's arrows, bolts, orbs, pellets and bullets: what a ranged move sends out when it lands
// (weapons.ts, a move's `shot`). They fly level at chest height, straight ahead,
// and hit the first foe or barrel in their path; a piercing one goes
// on through everything, an orb bursts where it stops. A wand's sparks can fan out
// (spread) or seek the nearest foe (homing).
import Phaser from 'phaser';
import { WORLD } from './config';
import { canvas } from './titleArt';
import type { Move } from './weapons';
import type { RoomScene } from './scenes/RoomScene';

const CHEST = 34; // how far above the feet a shot flies

interface Shot {
  img: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; vx: number; vy: number;
  left: number;
  move: Move;
  speed: number;
  hit: Set<object>; // what it already struck (a piercing arrow strikes each once)
  dead: boolean;
}

function textures(scene: Phaser.Scene) {
  // an arrow pointing right, drawn at twice its size
  canvas(scene, 'shot_arrow', 72, 14, (c) => {
    c.lineCap = 'round';
    c.strokeStyle = '#1c1612'; c.lineWidth = 5; c.beginPath(); c.moveTo(6, 7); c.lineTo(60, 7); c.stroke();
    c.strokeStyle = '#b08050'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(7, 7); c.lineTo(59, 7); c.stroke();
    c.fillStyle = '#1c1612'; c.beginPath(); c.moveTo(72, 7); c.lineTo(56, 0); c.lineTo(56, 14); c.closePath(); c.fill();
    c.fillStyle = '#dfe6ee'; c.beginPath(); c.moveTo(69, 7); c.lineTo(58, 2.5); c.lineTo(58, 11.5); c.closePath(); c.fill();
    c.fillStyle = '#e8e0d0';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(4, 7); c.lineTo(16, 7); c.lineTo(10, 7 + s * 6); c.lineTo(0, 7 + s * 6); c.closePath(); c.fill(); }
  });
  // a bright bolt with a tail
  canvas(scene, 'shot_bolt', 64, 24, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(90,232,208,0)'); g.addColorStop(0.7, 'rgba(120,250,230,0.8)'); g.addColorStop(1, '#ffffff');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(40, 2, 56, 4); c.arc(52, 12, 8, -Math.PI / 2, Math.PI / 2); c.quadraticCurveTo(40, 22, 0, 12); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(54, 12, 5, 0, Math.PI * 2); c.fill();
  });
  // a violet spark: a bright star with a short tail
  canvas(scene, 'shot_spark', 48, 24, (c) => {
    const g = c.createLinearGradient(0, 0, 48, 0);
    g.addColorStop(0, 'rgba(170,110,255,0)'); g.addColorStop(0.75, 'rgba(200,150,255,0.85)'); g.addColorStop(1, '#ffffff');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(28, 5, 40, 6); c.arc(38, 12, 6, -Math.PI / 2, Math.PI / 2); c.quadraticCurveTo(28, 19, 0, 12); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 3 : 8; c.lineTo(39 + Math.cos(a) * r, 12 + Math.sin(a) * r); }
    c.closePath(); c.fill();
  });
  // a lead pellet with a hot streak behind it
  canvas(scene, 'shot_pellet', 28, 12, (c) => {
    const g = c.createLinearGradient(0, 0, 28, 0);
    g.addColorStop(0, 'rgba(255,170,80,0)'); g.addColorStop(1, 'rgba(255,200,120,0.7)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 6); c.lineTo(20, 3); c.lineTo(20, 9); c.closePath(); c.fill();
    c.fillStyle = '#1c1612'; c.beginPath(); c.arc(21, 6, 5.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a7a80'; c.beginPath(); c.arc(21, 6, 3.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8e8f0'; c.beginPath(); c.arc(22.5, 4.6, 1.4, 0, Math.PI * 2); c.fill();
  });
  // a bullet: a bright, thin streak with a hot tip
  canvas(scene, 'shot_bullet', 56, 10, (c) => {
    const g = c.createLinearGradient(0, 0, 56, 0);
    g.addColorStop(0, 'rgba(255,200,90,0)'); g.addColorStop(0.7, 'rgba(255,220,140,0.85)'); g.addColorStop(1, '#ffffff');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 5); c.lineTo(48, 2); c.arc(50, 5, 3, -Math.PI / 2, Math.PI / 2); c.lineTo(0, 5); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(51, 5, 2.4, 0, Math.PI * 2); c.fill();
  });
  // a muzzle flash, pointing right
  canvas(scene, 'shot_flash', 64, 48, (c) => {
    const g = c.createRadialGradient(10, 24, 0, 10, 24, 40);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#fff0a0'); g.addColorStop(0.7, 'rgba(255,140,40,0.7)'); g.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = g; c.beginPath();
    const pts = [[0, 24], [20, 4], [26, 16], [62, 24], [26, 32], [20, 44]];
    c.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) c.lineTo(x, y); c.closePath(); c.fill();
  });
  // a swirling orb
  canvas(scene, 'shot_orb', 40, 40, (c) => {
    const g = c.createRadialGradient(20, 20, 0, 20, 20, 19);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#b8fff0'); g.addColorStop(0.75, 'rgba(60,200,190,0.8)'); g.addColorStop(1, 'rgba(60,200,190,0)');
    c.fillStyle = g; c.fillRect(0, 0, 40, 40);
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2;
    c.beginPath(); c.arc(20, 20, 11, 0.2, 2.2); c.stroke();
    c.beginPath(); c.arc(20, 20, 11, 3.3, 5.3); c.stroke();
  });
}

export class Shots {
  private list: Shot[] = [];

  constructor(private scene: RoomScene) {
    textures(scene);
  }

  get count() {
    return this.list.length;
  }

  // Sends out the move's shot from the hero's hand, straight the way they face; a
  // spread sends several, fanned up and down the floor around that line.
  fire(from: { x: number; y: number; facing: number }, move: Move) {
    const spec = move.shot!;
    const dir = from.facing;
    const n = spec.spread?.count ?? 1;
    const gun = spec.look === 'pellet' || spec.look === 'bullet';
    for (let i = 0; i < n; i++) {
      const lean = n > 1 ? (i - (n - 1) / 2) * (spec.spread!.lean / ((n - 1) / 2)) : 0;
      // a pellet's speed varies a little, so the cone looks ragged rather than a fan
      const k = spec.look === 'pellet' ? 0.85 + Math.random() * 0.3 : 1;
      this.launch(from.x + dir * (gun ? 30 : 22), from.y, dir * spec.speed * k, lean * spec.speed * k, move);
    }
    if (gun) this.muzzle(from.x + dir * 30, from.y, dir, spec.look === 'pellet' ? 1.5 : 0.8);
  }

  // A flash at the muzzle and a puff of smoke drifting up; a big gun shakes the room.
  muzzle(x: number, y: number, dir: number, size: number) {
    const s = this.scene, h = y - CHEST;
    const f = s.add.image(x, h, 'shot_flash').setOrigin(0.1, 0.5).setFlipX(dir < 0).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5 * size).setDepth(y + 12);
    s.tweens.add({ targets: f, alpha: 0, scaleX: 0.7 * size, duration: 90, onComplete: () => f.destroy() });
    const light = s.add.image(x, h, 'tt_light').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35 * size).setAlpha(0.8).setDepth(y + 11);
    s.tweens.add({ targets: light, alpha: 0, duration: 140, onComplete: () => light.destroy() });
    for (let i = 0; i < Math.round(3 * size); i++) {
      const p = s.add.circle(x + dir * (4 + Math.random() * 14 * size), h + (Math.random() - 0.5) * 8, 4 + Math.random() * 3 * size, 0xb8b4ac, 0.5).setDepth(y + 12);
      s.tweens.add({ targets: p, x: p.x + dir * (10 + Math.random() * 20), y: p.y - 14 - Math.random() * 16, scale: 2.2, alpha: 0, duration: 500 + Math.random() * 300, ease: 'Sine.easeOut', onComplete: () => p.destroy() });
    }
    if (size > 1) s.shake(70, 0.004);
  }

  // One shot from a point with a velocity (floor pixels a second).
  launch(x: number, y: number, vx: number, vy: number, move: Move) {
    const spec = move.shot!;
    const s = this.scene;
    const dir = Math.sign(vx) || 1;
    const img = s.add.image(x, y - CHEST, `shot_${spec.look}`).setScale(0.5).setFlipX(dir < 0);
    let glow: Phaser.GameObjects.Image | undefined;
    if (spec.look === 'pellet') img.setScale(0.55);
    else if (spec.look === 'bullet') {
      img.setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
      glow = s.add.image(x, y - CHEST, 'tt_light').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setScale(0.14).setAlpha(0.6);
    } else if (spec.look !== 'arrow') {
      img.setBlendMode(Phaser.BlendModes.ADD).setScale(spec.look === 'orb' ? 0.8 : 0.6);
      glow = s.add.image(x, y - CHEST, 'tt_light').setTint(spec.look === 'spark' ? 0xb98aff : 0x6fffd8).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(spec.look === 'orb' ? 0.5 : spec.look === 'spark' ? 0.24 : 0.3).setAlpha(0.7);
    }
    const shadow = s.add.ellipse(x, y, spec.look === 'arrow' ? 18 : spec.look === 'pellet' ? 6 : 14, spec.look === 'pellet' ? 3 : 5, 0x000000, 0.25).setDepth(1);
    const b: Shot = { img, glow, shadow, x, y, vx, vy, left: spec.reach, move, speed: Math.hypot(vx, vy), hit: new Set(), dead: false };
    this.turn(b);
    this.list.push(b);
  }

  // Points the picture along the way it flies.
  private turn(b: Shot) {
    const dir = Math.sign(b.vx) || 1;
    b.img.setFlipX(dir < 0).setRotation(Math.atan2(b.vy, Math.abs(b.vx)) * dir);
  }

  // A seeking shot bends towards the nearest living foe it has not hit yet.
  private seek(b: Shot, rate: number, dt: number) {
    let best: { x: number; y: number } | null = null, bd = 420;
    for (const e of this.scene.enemies) {
      if (e.isDead() || b.hit.has(e)) continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(best.y - b.y, best.x - b.x);
    const a = cur + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - cur), -rate * dt, rate * dt);
    b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed;
    this.turn(b);
  }

  update(dt: number) {
    const s = this.scene;
    for (const b of this.list) {
      const spec = b.move.shot!;
      if (spec.homing) this.seek(b, spec.homing, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.left -= Math.hypot(b.vx, b.vy) * dt;
      const off = b.y < WORLD.groundTop || b.y > WORLD.groundBottom || b.x < 0 || b.x > WORLD.roomW;
      const dir = Math.sign(b.vx);
      // what it touches this frame, a short box around its head
      const inside = (x: number, y: number) => Math.abs(x - b.x) < 18 && Math.abs(y - b.y) <= b.move.depth;
      const hits = spec.show ? 0 : s.strike({ x: b.x - dir * 40, y: b.y, facing: dir }, true, b.move, s.enemies, inside, { once: b.hit, max: spec.pierce ? undefined : 1 });
      if ((hits > 0 && !spec.pierce) || b.left <= 0 || off) {
        b.dead = true;
        if (spec.burst) this.burst(b);
      }
      b.img.setPosition(b.x, b.y - CHEST).setDepth(b.y + 11);
      if (spec.look === 'orb') b.img.setRotation(b.img.rotation + dt * 8);
      if (spec.look === 'spark' && !b.dead && Math.random() < dt * 30) this.trail(b.x, b.y);
      b.glow?.setPosition(b.x, b.y - CHEST).setDepth(b.y + 10);
      b.shadow.setPosition(b.x, b.y);
      if (b.dead) {
        const objs = [b.img, b.shadow, ...(b.glow ? [b.glow] : [])];
        s.tweens.add({ targets: objs, alpha: 0, duration: 120, onComplete: () => objs.forEach((o) => o.destroy()) });
      }
    }
    this.list = this.list.filter((b) => !b.dead);
  }

  // A fading mote left behind a spark.
  private trail(x: number, y: number) {
    const s = this.scene;
    const m = s.add.image(x, y - CHEST, 'tt_dot').setTint(0xc8a0ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.16).setDepth(y + 10);
    s.tweens.add({ targets: m, alpha: 0, scale: 0.04, y: m.y - 6, duration: 260, onComplete: () => m.destroy() });
  }

  // An orb's end: a flash and a ring, hitting everything around it.
  private burst(b: Shot) {
    const s = this.scene, { rx, ry } = b.move.shot!.burst!;
    s.shockwave(b.x, b.y, 0x7ffcf0);
    s.strike({ x: b.x, y: b.y - 1, facing: Math.sign(b.vx) }, true, { ...b.move, heavy: true }, s.enemies,
      (x, y) => ((x - b.x) / rx) ** 2 + ((y - b.y) / ry) ** 2 <= 1, { once: b.hit });
  }
}
