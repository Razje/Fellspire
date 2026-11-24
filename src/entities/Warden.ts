// The Lantern Warden, boss of the Blightwood.
//
// Built the way Lost Castle 2 builds its bosses: every attack is shown on the
// floor in red before it lands, after every few attacks he stops to catch his
// breath and takes extra damage, and at half health the fight changes.
//
// Phase 1, the lantern lit: lantern slam (a red circle where you stand), a wide
// sweep in front of him, and ghouls summoned out of the tree line.
// Phase 2, the lantern broken: torches go out, the room scene darkens everything
// outside a shrinking circle of light, and he fights faster, adding the ember
// rush, a charge along a red line.
//
// Art: a stand-in for now, the skeleton pack drawn twice the size and darkened,
// carrying a lantern painted here. A real pack can replace it later.
import Phaser from 'phaser';
import { Enemy } from './Enemies';
import { canvas } from '../titleArt';
import type { Light } from '../blightwood';
import type { RoomScene } from '../scenes/RoomScene';

// The numbers to tune after playing.
export const WARDEN = {
  hp: 560,
  speed: [52, 64], // phase 1, phase 2
  attacksBeforeRest: 3,
  rest: [2.4, 1.8], // seconds open to hits
  restDamage: 1.5, // damage taken while resting
  slam: { windup: [0.85, 0.62], dmg: 18, rx: 64, ry: 26, reach: 150, recover: 0.7 },
  sweep: { windup: [0.6, 0.48], dmg: 14, range: 128, depth: 36, recover: 0.6 },
  summon: { windup: 1.0, cooldown: [13, 22], count: [2, 1], maxAlive: 3 },
  rush: { windup: 0.9, dmg: 16, length: 400, width: 26, speed: 640, recover: 0.8 },
  phaseAt: 0.5,
  stagger: 2.6, // the lantern breaking
};

type Mode = 'asleep' | 'approach' | 'windup' | 'strike' | 'recover' | 'rest' | 'stagger';
type Move = 'slam' | 'sweep' | 'summon' | 'rush';

function lanternTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('boss_lantern')) return;
  canvas(scene, 'boss_lantern', 40, 66, (c) => {
    const iron = '#14161c';
    c.lineJoin = 'round';
    // handle ring
    c.strokeStyle = iron; c.lineWidth = 4;
    c.beginPath(); c.arc(20, 9, 7, Math.PI, 0); c.stroke();
    // cap
    c.fillStyle = iron;
    c.beginPath(); c.moveTo(8, 18); c.lineTo(32, 18); c.lineTo(26, 10); c.lineTo(14, 10); c.closePath(); c.fill();
    // glass, glowing from inside
    const g = c.createRadialGradient(20, 36, 2, 20, 36, 18);
    g.addColorStop(0, '#f4fff8'); g.addColorStop(0.35, '#8affd8'); g.addColorStop(1, '#1d6a5c');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(9, 19); c.lineTo(31, 19); c.lineTo(29, 52); c.lineTo(11, 52); c.closePath(); c.fill();
    // bars and frame
    c.strokeStyle = iron; c.lineWidth = 3;
    c.beginPath(); c.moveTo(9, 19); c.lineTo(31, 19); c.lineTo(29, 52); c.lineTo(11, 52); c.closePath(); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(16, 19); c.lineTo(15.5, 52); c.moveTo(24, 19); c.lineTo(24.5, 52); c.moveTo(10, 35); c.lineTo(30, 35); c.stroke();
    // base
    c.fillStyle = iron;
    c.beginPath(); c.moveTo(7, 52); c.lineTo(33, 52); c.lineTo(29, 60); c.lineTo(11, 60); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(12, 21, 2, 12);
  });
}

export class Warden extends Enemy {
  mode: Mode = 'asleep';
  phase: 1 | 2 = 1;
  private move: Move = 'slam';
  private t = 0; // time in the current mode
  private struck = false;
  attacksSinceRest = 0;
  private summonCd = 6;
  private target = { x: 0, y: 0 }; // where the slam lands
  private dir = { x: 1, y: 0 }; // the rush's direction
  private rushLeft = 0;
  private lantern: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private restRing: Phaser.GameObjects.Ellipse;
  readonly light: Light;
  readonly H: number; // about how tall he stands

  constructor(scene: RoomScene, x: number, y: number) {
    super(scene, 'archer', x, y, WARDEN.hp, WARDEN.speed[0], 1.9);
    this.showPlate = false;
    this.body = 1.8;
    this.facing = -1;
    this.tintColor = this.baseTint = 0x8f84ad; // a cold, drowned grey-violet
    this.H = this.visualHeight;
    lanternTexture(scene);
    this.lantern = scene.add.image(x, y, 'boss_lantern').setOrigin(0.5, 0.1).setScale(0.8);
    this.glow = scene.add.image(x, y, 'tt_light').setTint(0x6fffd8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(0.75);
    this.restRing = scene.add.ellipse(x, y, 110, 38).setStrokeStyle(2, 0xffe08a, 0.9).setDepth(2).setVisible(false);
    this.light = { x, y, radius: 190, strength: 0.6 };
    this.placeLantern(0);
  }

  get resting() {
    return this.mode === 'rest';
  }

  get awake() {
    return this.mode !== 'asleep';
  }

  wake() {
    if (this.mode === 'asleep') this.setMode('approach');
  }

  // A burst of light from the lantern: his roar during the introduction.
  flare() {
    this.scene.tweens.add({ targets: this.glow, scale: 2.2, alpha: 0.95, duration: 260, yoyo: true, ease: 'Quad.easeOut' });
    this.scene.shake(400, 0.006);
  }

  private setMode(m: Mode) {
    this.mode = m;
    this.t = 0;
    this.struck = false;
  }

  takeHit(dmg: number, fromX: number, _knock: number, heavy: boolean): number {
    if (this.isDead() || this.mode === 'asleep' || this.mode === 'stagger') return -1;
    const d = Math.round(dmg * (this.resting ? WARDEN.restDamage : 1));
    // a boss is not knocked about or interrupted by ordinary hits
    const dealt = this.applyDamage(d, fromX, 0, 0);
    if (heavy && this.resting) this.scene.shake(80, 0.004);
    if (this.phase === 1 && !this.isDead() && this.hp <= this.maxHp * WARDEN.phaseAt) this.breakLantern();
    return dealt;
  }

  takeDot(dmg: number): number {
    return this.takeHit(dmg, this.x, 0, false);
  }

  die() {
    this.state = 'dead';
    this.stateT = 0;
    this.telegraph.clear();
    this.restRing.setVisible(false);
    this.playAnim('die', { duration: 1600, force: true });
    this.scene.tweens.add({ targets: [this.lantern, this.glow], alpha: 0, duration: 600 });
    this.scene.tweens.add({ targets: this.light, strength: 0, duration: 800 });
    this.scene.onBossDied(this);
  }

  destroy() {
    this.lantern.destroy();
    this.glow.destroy();
    this.restRing.destroy();
    super.destroy();
  }

  private breakLantern() {
    this.phase = 2;
    this.telegraph.clear();
    this.restRing.setVisible(false);
    this.setMode('stagger');
    this.playAnim('hurt', { duration: 900, force: true });
    this.speed = WARDEN.speed[1];
    this.attacksSinceRest = 0;
    this.summonCd = WARDEN.summon.cooldown[1] * 0.5;
    const { x, y } = this.lantern;
    this.lantern.setVisible(false);
    this.scene.tweens.add({ targets: this.glow, scale: 3, alpha: 0, duration: 500 });
    this.scene.lanternShatters(x, y + 20);
  }

  update(dt: number) {
    super.update(dt);
    this.placeLantern(dt);
  }

  // ---- the lantern, held, raised, slammed ---------------------------------------

  private swing = 0;
  private placeLantern(dt: number) {
    this.swing += dt * 3;
    const H = this.H, f = this.facing;
    const hand = { x: this.x + f * H * 0.3, y: this.y - H * 0.5 + Math.sin(this.swing) * 2 };
    let p = hand;
    if (this.move === 'slam' && (this.mode === 'windup' || this.mode === 'recover')) {
      const w = WARDEN.slam.windup[this.phase - 1];
      const up = { x: this.x + f * H * 0.12, y: this.y - H * 1.15 };
      const down = { x: this.target.x, y: this.target.y - 24 };
      if (this.mode === 'windup') {
        const k = this.t / w;
        p = k < 0.8 ? lerp(hand, up, ease(k / 0.8)) : lerp(up, down, ((k - 0.8) / 0.2) ** 2);
      } else p = this.t < 0.35 ? down : lerp(down, hand, ease((this.t - 0.35) / (WARDEN.slam.recover - 0.35)));
    } else if (this.move === 'summon' && this.mode === 'windup') {
      p = lerp(hand, { x: this.x + f * H * 0.1, y: this.y - H * 1.25 }, ease(Math.min(1, this.t / 0.4)));
    } else if (this.move === 'sweep' && this.mode === 'windup') {
      p = lerp(hand, { x: this.x - f * H * 0.35, y: this.y - H * 0.75 }, ease(Math.min(1, this.t / 0.3)));
    } else if (this.move === 'sweep' && this.mode === 'recover') {
      p = lerp({ x: this.x + f * H * 0.7, y: this.y - H * 0.35 }, hand, ease(Math.min(1, this.t / 0.4)));
    }
    if (this.mode === 'rest') p = { x: this.x + f * H * 0.32, y: this.y - H * 0.18 }; // lowered, resting on the ground
    this.lantern.setPosition(p.x, p.y).setDepth(this.y + (this.mode === 'recover' && this.move === 'slam' ? 12 : 11));
    this.lantern.setAlpha(this.sprite.alpha).setFlipX(f < 0);
    this.glow.setPosition(p.x, p.y + 22).setDepth(this.y + 12);
    if (!this.scene.tweens.isTweening(this.glow) && this.phase === 1 && !this.isDead()) {
      const charge = this.mode === 'windup' ? 0.3 * Math.min(1, this.t / 0.6) : 0;
      this.glow.setAlpha((this.resting ? 0.25 : 0.5 + charge) + Math.sin(this.swing * 1.7) * 0.05).setScale(0.7 + charge);
    }
    this.light.x = p.x; this.light.y = this.y;
    if (this.phase === 1 && !this.isDead()) this.light.strength = this.resting ? 0.3 : 0.6;
    this.restRing.setPosition(this.x, this.y);
  }

  // ---- the fight ----------------------------------------------------------------------

  protected think(dt: number): boolean {
    const p = this.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy * 1.6);
    const ph = this.phase - 1;
    this.t += dt;
    this.summonCd -= dt;
    this.state = 'idle';
    const g = this.telegraph;

    switch (this.mode) {
      case 'asleep':
        this.playAnim('idle', { loop: true });
        return false;

      case 'stagger':
        if (this.t >= WARDEN.stagger) this.setMode('approach');
        return false;

      case 'rest': {
        this.restRing.setVisible(true).setAlpha(0.5 + 0.5 * Math.sin(this.t * 8));
        this.tintColor = Math.floor(this.t * 6) % 2 ? 0xd8c890 : 0xb4a8c8;
        this.playAnim('idle', { loop: true });
        if (this.t >= WARDEN.rest[ph]) {
          this.restRing.setVisible(false);
          this.tintColor = 0x8f84ad;
          this.attacksSinceRest = 0;
          this.setMode('approach');
        }
        return false;
      }

      case 'approach': {
        this.facing = dx >= 0 ? 1 : -1;
        const alive = this.scene.enemies.filter((e) => e !== this && !e.isDead()).length;
        if (this.summonCd <= 0 && alive < WARDEN.summon.maxAlive && this.t > 0.6) return this.begin('summon');
        if (this.phase === 2 && dist > 170 && dist < 360 && this.t > 0.8 && Math.random() < dt * 1.2) return this.begin('rush');
        if (Math.abs(dx) < WARDEN.sweep.range - 10 && Math.abs(dy) < WARDEN.sweep.depth - 6 && this.t > 0.4) return this.begin('sweep');
        if (dist < WARDEN.slam.reach + 40 && this.t > 0.5) return this.begin('slam');
        return this.walkToward(p.x - Math.sign(dx || 1) * 70, p.y, dt);
      }

      case 'windup': {
        g.clear();
        if (this.move === 'slam') {
          const k = this.t / WARDEN.slam.windup[ph];
          const { rx, ry } = WARDEN.slam;
          g.fillStyle(0xff3b30, 0.1 + 0.32 * k).fillEllipse(this.target.x, this.target.y, rx * 2, ry * 2);
          g.lineStyle(2, 0xff6a5a, 0.5 + 0.5 * k).strokeEllipse(this.target.x, this.target.y, rx * 2, ry * 2);
          // a ring closing in on the edge marks when it lands
          g.lineStyle(1.5, 0xffd0c0, 0.8).strokeEllipse(this.target.x, this.target.y, rx * 2 * (2 - k), ry * 2 * (2 - k));
          if (k >= 1) this.strike();
        } else if (this.move === 'sweep') {
          const k = this.t / WARDEN.sweep.windup[ph];
          const cx = this.x + this.facing * WARDEN.sweep.range * 0.5;
          g.fillStyle(0xff3b30, 0.1 + 0.3 * k).fillEllipse(cx, this.y, WARDEN.sweep.range * 1.25, WARDEN.sweep.depth * 2);
          g.lineStyle(2, 0xff6a5a, 0.4 + 0.6 * k).strokeEllipse(cx, this.y, WARDEN.sweep.range * 1.25, WARDEN.sweep.depth * 2);
          if (k >= 1) this.strike();
        } else if (this.move === 'rush') {
          const k = this.t / WARDEN.rush.windup;
          this.drawLane(g, k);
          if (k >= 1) { g.clear(); this.setMode('strike'); this.rushLeft = WARDEN.rush.length; this.playAnim('walk', { loop: true, duration: 300 }); }
        } else if (this.move === 'summon') {
          if (this.t >= WARDEN.summon.windup) this.strike();
        }
        return false;
      }

      case 'strike': {
        // only the rush lasts: he charges along the lane, the embers trailing behind
        const step = Math.min(this.rushLeft, WARDEN.rush.speed * dt);
        this.x += this.dir.x * step; this.y += this.dir.y * step;
        this.rushLeft -= step;
        this.scene.dust(this.x, this.y, 1);
        this.scene.embers(this.x, this.y - this.H * 0.4);
        if (!this.struck && !p.isDead() && Math.hypot(p.x - this.x, (p.y - this.y) * 2) < 40) {
          this.struck = true;
          this.scene.hitPlayer(this, WARDEN.rush.dmg, 260, true);
        }
        const before = { x: this.x, y: this.y };
        this.clamp();
        if (this.rushLeft <= 0 || Math.hypot(this.x - before.x, this.y - before.y) > 0.5) this.endMove(WARDEN.rush.recover);
        return true;
      }

      case 'recover':
        if (this.t >= this.recoverFor) {
          if (this.attacksSinceRest >= WARDEN.attacksBeforeRest) { this.setMode('rest'); this.playAnim('idle', { loop: true }); }
          else this.setMode('approach');
        }
        return false;
    }
    return false;
  }

  private recoverFor = 0.6;

  private begin(m: Move): boolean {
    const p = this.player;
    this.move = m;
    this.setMode('windup');
    const ph = this.phase - 1;
    this.facing = p.x >= this.x ? 1 : -1;
    if (m === 'slam') {
      // where you stand now, as far as his reach allows
      const dx = p.x - this.x, dy = (p.y - this.y) * 1.6;
      const d = Math.hypot(dx, dy), r = Math.min(1, WARDEN.slam.reach / Math.max(1, d));
      this.target = { x: this.x + dx * r, y: this.y + (dy * r) / 1.6 };
      this.playAnim('heavy', { duration: (WARDEN.slam.windup[ph] + 0.3) * 1000, force: true });
    } else if (m === 'sweep') {
      this.playAnim('attack', { duration: (WARDEN.sweep.windup[ph] + 0.25) * 1000, force: true });
    } else if (m === 'summon') {
      this.playAnim('throw', { duration: WARDEN.summon.windup * 1000, force: true });
      this.scene.tweens.add({ targets: this.glow, scale: 1.8, alpha: 0.9, duration: 500, yoyo: true });
    } else if (m === 'rush') {
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
      this.dir = { x: dx / d, y: dy / d };
      this.playAnim('idle', { loop: true });
    }
    return false;
  }

  private drawLane(g: Phaser.GameObjects.Graphics, k: number) {
    const { length, width } = WARDEN.rush;
    const nx = -this.dir.y, ny = this.dir.x, w = width / 2;
    const ax = this.x, ay = this.y, bx = ax + this.dir.x * length, by = ay + this.dir.y * length;
    const pts = [
      new Phaser.Math.Vector2(ax + nx * w, ay + ny * w * 0.6), new Phaser.Math.Vector2(bx + nx * w, by + ny * w * 0.6),
      new Phaser.Math.Vector2(bx - nx * w, by - ny * w * 0.6), new Phaser.Math.Vector2(ax - nx * w, ay - ny * w * 0.6),
    ];
    g.fillStyle(0xff3b30, 0.1 + 0.3 * k).fillPoints(pts, true);
    g.lineStyle(2, 0xff6a5a, 0.4 + 0.6 * k).strokePoints(pts, true);
    // chevrons running along it
    const n = 5;
    g.lineStyle(2, 0xffd0c0, 0.5 + 0.5 * k);
    for (let i = 0; i < n; i++) {
      const s = ((i + (k * 2) % 1) / n) * length;
      const cx = ax + this.dir.x * s, cy = ay + this.dir.y * s;
      g.lineBetween(cx + nx * w * 0.7 - this.dir.x * 8, cy + ny * w * 0.42 - this.dir.y * 8, cx, cy);
      g.lineBetween(cx - nx * w * 0.7 - this.dir.x * 8, cy - ny * w * 0.42 - this.dir.y * 8, cx, cy);
    }
  }

  private strike() {
    const p = this.player;
    const ph = this.phase - 1;
    this.telegraph.clear();
    if (this.move === 'slam') {
      const { rx, ry, dmg } = WARDEN.slam;
      if (!p.isDead() && ((p.x - this.target.x) / rx) ** 2 + ((p.y - this.target.y) / ry) ** 2 <= 1) {
        this.scene.hitPlayer(this, dmg, 220, true);
      }
      this.scene.shockwave(this.target.x, this.target.y, this.phase === 1 ? 0x7fffd8 : 0xff8a3a);
      this.scene.shake(160, 0.008);
      this.endMove(WARDEN.slam.recover);
    } else if (this.move === 'sweep') {
      this.scene.resolveMelee(this, { dmg: WARDEN.sweep.dmg, range: WARDEN.sweep.range, depth: WARDEN.sweep.depth, knock: 280, heavy: true }, [p]);
      this.scene.sweepArc(this.x, this.y - this.H * 0.4, this.facing, this.phase === 1 ? 0x9fffe0 : 0xffb070);
      this.endMove(WARDEN.sweep.recover);
    } else if (this.move === 'summon') {
      this.scene.summonMinions(WARDEN.summon.count[ph]);
      this.summonCd = WARDEN.summon.cooldown[ph];
      this.setMode('recover');
      this.recoverFor = 0.5;
    }
  }

  private endMove(recover: number) {
    this.attacksSinceRest++;
    this.recoverFor = recover;
    this.setMode('recover');
    this.playAnim('idle', { loop: true });
  }
}

const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const ease = (k: number) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 2;
