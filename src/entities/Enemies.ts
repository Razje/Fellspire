import Phaser from 'phaser';
import { Fighter } from './Fighter';
import type { CharKey } from '../config';
import type { RoomScene } from '../scenes/RoomScene';
import type { Player } from './Player';
import { hi } from '../ui/kit';

// An elite foe (elite levels, step 11.3) against a plain one. Tune here.
export const ELITE = {
  hp: 1.6, // times the health
  power: 1.25, // times the damage of its blows
  size: 1.12, // times as large
};

// The gold crown over an elite's head, painted once at twice its size.
export function crownTexture(scene: Phaser.Scene): string {
  return hi(scene, 'elite_crown', 28, 20, (c) => {
    const shape = () => {
      c.beginPath();
      c.moveTo(4, 17); c.lineTo(2, 5); c.lineTo(9, 10); c.lineTo(14, 2); c.lineTo(19, 10); c.lineTo(26, 5); c.lineTo(24, 17);
      c.closePath();
    };
    c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = '#140a04'; shape(); c.stroke();
    const g = c.createLinearGradient(0, 2, 0, 17);
    g.addColorStop(0, '#fff1b8'); g.addColorStop(0.45, '#e0b04a'); g.addColorStop(0.75, '#8a5f1a'); g.addColorStop(1, '#f0cf78');
    c.fillStyle = g; shape(); c.fill();
    c.fillStyle = '#ff4a3a';
    c.beginPath(); c.arc(14, 12, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (const [x, y] of [[2, 5], [14, 2], [26, 5]]) { c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); }
  });
}

export abstract class Enemy extends Fighter {
  protected attackCd: number;
  protected hitDone = false;
  protected readonly telegraph: Phaser.GameObjects.Graphics;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  protected showPlate = true; // the small health plate over the head
  body = 1; // how much floor the enemy takes up, 1 = a normal-sized one
  slowT = 0; // seconds left of being slowed (frost)
  protected baseTint: number | null = null;
  private lagFrac = 1;
  private plateAlpha = 0;
  protected speed: number;
  power = 1; // what its blows are multiplied by (an elite's hit harder)
  elite = false;
  private crownImg?: Phaser.GameObjects.Image;

  constructor(scene: RoomScene, key: CharKey, x: number, y: number, hp: number, speed: number, scaleMul = 1) {
    super(scene, key, x, y, hp, scaleMul);
    this.speed = speed;
    this.attackCd = 0.8 + Math.random() * 1.2;
    this.telegraph = scene.add.graphics().setDepth(2);
    this.hpBar = scene.add.graphics().setDepth(9000);
    this.facing = x < scene.player.x ? 1 : -1;
  }

  private hunted: Player | null = null;

  // The hero this enemy is after: the nearest living one, kept until another is
  // clearly closer (RoomScene.nearestHero). Chosen once a frame in update.
  protected get player(): Player {
    return this.hunted ?? this.scene.player;
  }

  takeHit(dmg: number, fromX: number, knock: number, heavy: boolean): number {
    if (this.isDead()) return -1;
    // Any hit interrupts a wind-up: hitting first is how you stay safe.
    this.telegraph.clear();
    return this.applyDamage(dmg, fromX, knock, heavy ? 0.5 : 0.3);
  }

  // Makes this foe an elite (an elite level's): tougher, harder hitting, a little
  // larger, with a gold crown over its head. Numbers in ELITE.
  crown() {
    if (this.elite) return;
    this.elite = true;
    this.maxHp = Math.round(this.maxHp * ELITE.hp);
    this.hp = this.maxHp;
    this.power = ELITE.power;
    this.sprite.setScale(this.sprite.scaleX * ELITE.size, this.sprite.scaleY * ELITE.size);
    this.shadow.setScale(ELITE.size);
    const key = crownTexture(this.scene);
    this.crownImg = this.scene.add.image(this.x, this.y, key).setScale(0.5).setDepth(9001).setAlpha(0);
  }

  // Dazed for a while (a shield charge): it stands reeling and does nothing.
  stun(seconds: number) {
    if (this.isDead() || this.state === 'hurt' && this.stateT < -seconds) return;
    this.telegraph.clear();
    this.state = 'hurt';
    this.stateT = -seconds;
    this.playAnim('hurt', { duration: seconds * 1000, force: true });
  }

  // Damage that ticks (burning ground, lightning): no flinch, no knockback.
  takeDot(dmg: number): number {
    if (this.isDead()) return -1;
    return this.applyDamage(dmg, this.x, 0, 0);
  }

  die() {
    super.die();
    this.telegraph.clear();
    this.hpBar.clear();
    if (this.crownImg) this.scene.tweens.add({ targets: this.crownImg, alpha: 0, y: this.crownImg.y - 12, duration: 500 });
    this.scene.onEnemyDied(this);
    this.fadeAndRemove(900);
  }

  destroy() {
    this.telegraph.destroy();
    this.hpBar.destroy();
    this.crownImg?.destroy();
    super.destroy();
  }

  update(dt: number) {
    this.physics(dt);
    this.attackCd -= dt;
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.tintColor = this.slowT > 0 ? 0x9fd0ff : this.baseTint;
    }
    let moving = false;
    this.hunted = this.scene.nearestHero(this.x, this.y, this.hunted);
    if (!this.isDead()) {
      if (this.state === 'hurt') {
        if (this.stateT >= 0) { this.state = 'idle'; this.stateT = 0; }
      } else if (this.player.isDead()) {
        this.state = 'idle';
        this.telegraph.clear();
        this.playAnim('idle', { loop: true });
      } else {
        moving = this.think(dt);
      }
      this.clamp();
    }
    this.sync(dt, moving);
    this.drawHpBar();
    // the crown floats over the head, above the health plate
    if (this.crownImg && !this.isDead()) {
      this.crownImg.setPosition(this.x, this.y - this.visualHeight - 22 + Math.sin(this.bobT + this.scene.time.now / 300) * 1.5)
        .setAlpha(this.appear);
    }
  }

  // Returns whether the enemy walked this frame.
  protected abstract think(dt: number): boolean;

  protected walkToward(tx: number, ty: number, dt: number, speedMul = 1): boolean {
    const mx = tx - this.x;
    const my = ty - this.y;
    const len = Math.hypot(mx, my);
    if (len < 5) {
      this.playAnim('idle', { loop: true });
      return false;
    }
    const step = Math.min(len, this.speed * speedMul * (this.slowT > 0 ? 0.5 : 1) * dt);
    this.x += (mx / len) * step;
    this.y += (my / len) * step;
    this.playAnim('walk', { loop: true });
    return true;
  }

  // A small health plate over the head, shown once the enemy has been hurt.
  private drawHpBar() {
    const g = this.hpBar;
    g.clear();
    const want = !this.showPlate || this.isDead() || this.hp >= this.maxHp ? 0 : 1;
    this.plateAlpha += (want - this.plateAlpha) * 0.2;
    if (this.plateAlpha < 0.02) return;
    const a = this.plateAlpha;
    const f = Math.max(0, this.hp / this.maxHp);
    this.lagFrac = this.lagFrac > f ? Math.max(f, this.lagFrac - 0.012) : f;
    const w = 34, h = 4, x = Math.round(this.x - w / 2), y = Math.round(this.y - this.visualHeight - 10);
    g.fillStyle(0x000000, 0.85 * a).fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    g.lineStyle(0.75, 0x8a6a34, 0.9 * a).strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    g.fillStyle(0x1a0806, a).fillRect(x, y, w, h);
    g.fillStyle(0xe8c890, a).fillRect(x, y, w * this.lagFrac, h);
    g.fillStyle(0xc4281c, a).fillRect(x, y, w * f, h);
    g.fillStyle(0xff7a5c, a).fillRect(x, y, w * f, 1);
  }
}

// Shambles up close and claws, after a red wind-up on the ground.
export class Ghoul extends Enemy {
  static WINDUP = 0.55;

  // Each ghoul picks its own spot beside the player, so a pack spreads out and
  // closes in from several sides instead of queueing on one line.
  private side = 1;
  private slotDy = 0;
  private retarget = 0;

  constructor(scene: RoomScene, x: number, y: number, tier: number) {
    super(scene, 'ghoul', x, y, Math.round(34 * tier), 74 + Math.random() * 16);
    this.side = x < scene.player.x ? -1 : 1;
    this.slotDy = (Math.random() - 0.5) * 50;
  }

  protected think(dt: number): boolean {
    const p = this.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    switch (this.state) {
      case 'idle':
      case 'move': {
        this.facing = dx >= 0 ? 1 : -1;
        if ((this.retarget -= dt) <= 0) {
          this.retarget = 1.2 + Math.random();
          if (Math.abs(dx) > 90) this.side = dx > 0 ? -1 : 1;
          this.slotDy = (Math.random() - 0.5) * 50;
        }
        if (Math.abs(dx) < 52 && Math.abs(dy) < 16 && this.attackCd <= 0) {
          this.state = 'windup';
          this.stateT = 0;
          this.hitDone = false;
          this.playAnim('attack', { duration: (Ghoul.WINDUP + 0.2) * 1000, force: true });
          return false;
        }
        // far off: head for the spot; close by: line up to strike
        const near = Math.hypot(dx, dy) < 110;
        const moved = this.walkToward(p.x + this.side * 40, p.y + (near && this.attackCd <= 0.3 ? 0 : this.slotDy), dt);
        this.state = moved ? 'move' : 'idle';
        return moved;
      }
      case 'windup': {
        const k = this.stateT / Ghoul.WINDUP;
        const g = this.telegraph;
        g.clear();
        g.fillStyle(0xff3b30, 0.12 + 0.3 * k);
        g.fillEllipse(this.x + this.facing * 30, this.y, 64, 24);
        g.lineStyle(2, 0xff6a5a, 0.35 + 0.6 * k);
        g.strokeEllipse(this.x + this.facing * 30, this.y, 64, 24);
        if (this.stateT >= Ghoul.WINDUP) {
          g.clear();
          this.state = 'attack';
          this.stateT = 0;
          this.scene.resolveMelee(this, { dmg: 10 * this.power, range: 56, depth: 18, knock: 160 }, this.scene.livingHeroes);
        }
        return false;
      }
      case 'attack':
        if (this.stateT >= 0.45) {
          this.state = 'idle';
          this.stateT = 0;
          this.attackCd = 1.0 + Math.random() * 0.9;
        }
        return false;
    }
    return false;
  }
}

// Keeps its distance, lines up with you and throws bones along that line.
export class BoneThrower extends Enemy {
  static WINDUP = 0.75;
  static REACH = 420;

  constructor(scene: RoomScene, x: number, y: number, tier: number) {
    super(scene, 'archer', x, y, Math.round(26 * tier), 66);
    this.attackCd = 1.5 + Math.random();
  }

  protected think(dt: number): boolean {
    const p = this.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const adx = Math.abs(dx);
    switch (this.state) {
      case 'idle':
      case 'move': {
        this.facing = dx >= 0 ? 1 : -1;
        if (Math.abs(dy) < 12 && adx > 100 && adx < BoneThrower.REACH - 40 && this.attackCd <= 0) {
          this.state = 'windup';
          this.stateT = 0;
          this.playAnim('throw', { duration: (BoneThrower.WINDUP + 0.25) * 1000, force: true });
          return false;
        }
        let tx = this.x;
        if (adx < 150) tx = this.x - Math.sign(dx || 1) * 90; // back off
        else if (adx > 300) tx = p.x - Math.sign(dx) * 230;
        const moved = this.walkToward(tx, p.y, dt, adx < 150 ? 1.3 : 1);
        this.facing = dx >= 0 ? 1 : -1;
        this.state = moved ? 'move' : 'idle';
        return moved;
      }
      case 'windup': {
        const k = this.stateT / BoneThrower.WINDUP;
        const g = this.telegraph;
        g.clear();
        g.fillStyle(0xff3b30, 0.08 + 0.3 * k);
        const x0 = this.x + this.facing * 14;
        g.fillRect(Math.min(x0, x0 + this.facing * BoneThrower.REACH), this.y - 4, BoneThrower.REACH, 8);
        g.lineStyle(2, 0xff6a5a, 0.3 + 0.6 * k);
        g.strokeRect(Math.min(x0, x0 + this.facing * BoneThrower.REACH), this.y - 4, BoneThrower.REACH, 8);
        if (this.stateT >= BoneThrower.WINDUP) {
          g.clear();
          this.state = 'attack';
          this.stateT = 0;
          this.scene.spawnBone(this.x + this.facing * 16, this.y, this.facing * 330, 8 * this.power, BoneThrower.REACH);
        }
        return false;
      }
      case 'attack':
        if (this.stateT >= 0.35) {
          this.state = 'idle';
          this.stateT = 0;
          this.attackCd = 1.8 + Math.random() * 1.3;
        }
        return false;
    }
    return false;
  }
}
