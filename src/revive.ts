import Phaser from 'phaser';
import type { Player } from './entities/Player';
import type { RoomScene } from './scenes/RoomScene';
import { keycap } from './ui/kit';
import { FONT, RES } from './ui/theme';
import { getParty, keyLabels } from './input';

// Going down in co-op (DESIGN.md 9.4): a fallen hero leaves a soul, and the other
// holds interact beside it to bring her back. The ring fills over `time`; letting
// go inside the gold arc (the sweet spot) raises her with more health than holding
// on to the end. A hit on the reviver knocks some of the progress off.
export const REVIVE = {
  time: 3, // seconds of holding to fill the ring
  sweetFrom: 0.72, // the gold arc, as shares of the ring
  sweetTo: 0.86,
  sweetHp: 0.6, // health on her feet after letting go in the gold arc
  fullHp: 0.35, // ... after holding the ring full
  reach: 70, // how close the reviver must stand (floor distance, depth counted 1.6x)
  grace: 0.5, // seconds the progress stays after letting go, before it drains
  drain: 1.2, // seconds of progress lost per second once draining
  hitLoss: 0.6, // seconds of progress a hit on the reviver costs
  invuln: 1.5, // seconds she cannot be hurt after getting up
  dim: 0.3, // how faint her body lies while the soul waits
};

const SOUL = 0xa8f0ff;
const GOLD = 0xffd36a;
const RING_R = 15;

type Raise = (share: number, by: Player) => void;

export class Soul {
  t = 0; // seconds of holding so far
  private idle = 0; // seconds since anyone held
  private holder: Player | null = null; // who held last frame
  private lastHp = 0;
  private hitFlash = 0;
  private readonly y0: number;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly orb: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private readonly motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly prompt: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private age = 0;

  constructor(private scene: RoomScene, readonly hero: Player, private raise: Raise) {
    const x = hero.x;
    this.y0 = hero.y;
    const d = hero.y + 12;
    this.glow = scene.add.image(x, hero.y, 'tt_light').setTint(SOUL).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.5).setScale(0.55, 0.22).setAlpha(0);
    this.orb = scene.add.image(x, hero.y - 40, 'tt_light').setTint(SOUL).setBlendMode(Phaser.BlendModes.ADD).setDepth(d).setScale(0.2).setAlpha(0);
    this.core = scene.add.image(x, hero.y - 40, 'tt_dot').setBlendMode(Phaser.BlendModes.ADD).setDepth(d + 1).setScale(0.55).setAlpha(0);
    this.motes = scene.add.particles(x, hero.y - 40, 'tt_dot', {
      x: { min: -10, max: 10 }, speedY: { min: -32, max: -12 }, lifespan: { min: 700, max: 1400 },
      scale: { start: 0.22, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [SOUL, 0xffffff], blendMode: 'ADD', frequency: 120,
    }).setDepth(d);
    this.ring = scene.add.graphics().setDepth(19400);
    this.prompt = scene.add.container(x, hero.y - 92).setDepth(19500).setAlpha(0);
    this.label = scene.add.text(0, 0, 'Hold to revive', { fontFamily: FONT.label, fontSize: '13px', color: '#f0e6d2', stroke: '#000', strokeThickness: 3, resolution: RES * 2 }).setOrigin(0, 0.5);
    this.prompt.add(this.label);
    this.setKey('E');
  }

  private cap: Phaser.GameObjects.Container | null = null;
  private key = '';

  // The keycap in the prompt: the interact key of whoever stands by.
  private setKey(k: string) {
    if (k === this.key) return;
    this.key = k;
    this.cap?.destroy();
    const cap = keycap(this.scene, 0, 0, k);
    const w = cap.width + 4 + this.label.width;
    cap.x = -w / 2 + cap.width / 2;
    this.label.x = -w / 2 + cap.width + 4;
    this.prompt.add(cap);
    this.cap = cap;
  }

  // A living hero close enough to the soul to revive it.
  near(p: Player) {
    return !p.isDead() && p !== this.hero && Math.hypot(p.x - this.hero.x, (p.y - this.y0) * 1.6) < REVIVE.reach;
  }

  get share() {
    return this.t / REVIVE.time;
  }

  get inSweetSpot() {
    return this.share >= REVIVE.sweetFrom && this.share <= REVIVE.sweetTo;
  }

  // One frame: who holds, the ring filling or draining, and getting her up.
  update(dt: number, heroes: Player[]) {
    this.age += dt;
    const fadeIn = Math.min(1, this.age / 0.8);
    this.hero.dim = Math.max(REVIVE.dim, 1 - this.age / 0.8 * (1 - REVIVE.dim));
    const near = heroes.filter((h) => this.near(h));
    const ready = (h: Player) => h.interactHeld && (h.state === 'idle' || h.state === 'move' || h.state === 'block');
    const holder = near.find(ready) ?? null;
    const was = this.holder;

    // a hit on the reviver knocks progress off
    if (was && was.hp < this.lastHp - 0.5) {
      this.t = Math.max(0, this.t - REVIVE.hitLoss);
      this.hitFlash = 0.35;
    }

    if (holder) {
      this.t += dt;
      this.idle = 0;
      if (this.t >= REVIVE.time) return this.raise(REVIVE.fullHp, holder);
    } else {
      // letting go (not knocked off, not turning to fight) in the gold arc raises her
      if (was && !was.interactHeld && !was.isDead() && was.state !== 'hurt' && this.inSweetSpot) return this.raise(REVIVE.sweetHp, was);
      this.idle += dt;
      if (this.idle > REVIVE.grace) this.t = Math.max(0, this.t - REVIVE.drain * dt);
    }
    this.holder = holder;
    this.lastHp = holder?.hp ?? 0;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    // the soul bobs over her body, brighter as the ring fills
    const bob = Math.sin(this.age * 2.6) * 4;
    const glow = 0.55 + 0.45 * this.share;
    const oy = this.y0 - 40 + bob;
    this.orb.setY(oy).setAlpha(fadeIn * glow).setScale(0.2 + 0.08 * this.share + 0.015 * Math.sin(this.age * 5));
    this.core.setY(oy).setAlpha(fadeIn * (0.7 + 0.3 * this.share));
    this.motes.setY(oy);
    this.glow.setAlpha(fadeIn * (0.35 + 0.4 * this.share));

    // the prompt shows the key of whoever stands by (their own device's)
    const by = holder ?? near[0];
    if (by) this.setKey(keyLabels(getParty()[by.who] ?? { kind: 'solo' }).interact);
    this.prompt.setAlpha(Phaser.Math.Linear(this.prompt.alpha, by && !holder ? 1 : 0, 0.2)).setY(this.y0 - 92 + bob * 0.5);
    this.drawRing(oy, fadeIn, !!holder || this.t > 0);
  }

  private drawRing(oy: number, a: number, show: boolean) {
    const g = this.ring.clear();
    if (!show) return;
    const x = this.hero.x, y = oy - 30;
    const start = -Math.PI / 2;
    const at = (s: number) => start + s * Math.PI * 2;
    // the track, the fill, and the gold arc just outside it (the sweet spot), which
    // stays visible while the fill runs under it
    g.lineStyle(6, 0x000000, 0.6 * a).strokeCircle(x, y, RING_R);
    const fill = this.hitFlash > 0 ? 0xff6b5e : this.inSweetSpot ? GOLD : SOUL;
    if (this.share > 0) g.lineStyle(3.5, fill, a).beginPath().arc(x, y, RING_R, start, at(Math.min(1, this.share))).strokePath();
    g.lineStyle(5, 0x000000, 0.6 * a).beginPath().arc(x, y, RING_R + 5, at(REVIVE.sweetFrom) - 0.05, at(REVIVE.sweetTo) + 0.05).strokePath();
    g.lineStyle(3, GOLD, (this.inSweetSpot ? 1 : 0.85) * a).beginPath().arc(x, y, RING_R + 5, at(REVIVE.sweetFrom), at(REVIVE.sweetTo)).strokePath();
  }

  destroy() {
    this.glow.destroy();
    this.orb.destroy();
    this.core.destroy();
    this.motes.destroy();
    this.ring.destroy();
    this.prompt.destroy();
  }
}
