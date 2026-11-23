import Phaser from 'phaser';
import { Fighter } from './Fighter';
import type { CharKey } from '../config';
import type { RoomScene } from '../scenes/RoomScene';

export abstract class Enemy extends Fighter {
  protected attackCd: number;
  protected hitDone = false;
  protected readonly telegraph: Phaser.GameObjects.Graphics;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  protected speed: number;

  constructor(scene: RoomScene, key: CharKey, x: number, y: number, hp: number, speed: number) {
    super(scene, key, x, y, hp);
    this.speed = speed;
    this.attackCd = 0.8 + Math.random() * 1.2;
    this.telegraph = scene.add.graphics().setDepth(2);
    this.hpBar = scene.add.graphics().setDepth(9000);
    this.facing = x < scene.player.x ? 1 : -1;
  }

  protected get player() {
    return this.scene.player;
  }

  takeHit(dmg: number, fromX: number, knock: number, heavy: boolean): number {
    if (this.isDead()) return -1;
    // Any hit interrupts a wind-up: hitting first is how you stay safe.
    this.telegraph.clear();
    return this.applyDamage(dmg, fromX, knock, heavy ? 0.5 : 0.3);
  }

  die() {
    super.die();
    this.telegraph.clear();
    this.hpBar.clear();
    this.scene.onEnemyDied(this);
    this.fadeAndRemove(900);
  }

  destroy() {
    this.telegraph.destroy();
    this.hpBar.destroy();
    super.destroy();
  }

  update(dt: number) {
    this.physics(dt);
    this.attackCd -= dt;
    let moving = false;
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
  }

  // Returns whether the enemy walked this frame.
  protected abstract think(dt: number): boolean;

  protected walkToward(tx: number, ty: number, dt: number, speedMul = 1): boolean {
    const mx = tx - this.x;
    const my = (ty - this.y) * 1.8;
    const len = Math.hypot(mx, my);
    if (len < 6) {
      this.playAnim('idle', { loop: true });
      return false;
    }
    this.x += (mx / len) * this.speed * speedMul * dt;
    this.y += (my / len) * this.speed * speedMul * 0.6 * dt;
    this.playAnim('walk', { loop: true });
    return true;
  }

  private drawHpBar() {
    const g = this.hpBar;
    g.clear();
    if (this.isDead() || this.hp >= this.maxHp) return;
    const w = 46, x = this.x - w / 2, y = this.y - this.visualHeight - 14;
    g.fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, w + 2, 7);
    g.fillStyle(0xc8463c, 1).fillRect(x, y, w * (this.hp / this.maxHp), 5);
  }
}

// Shambles up close and claws, after a red wind-up on the ground.
export class Ghoul extends Enemy {
  static WINDUP = 0.55;

  constructor(scene: RoomScene, x: number, y: number, tier: number) {
    super(scene, 'ghoul', x, y, Math.round(34 * tier), 92 + Math.random() * 20);
  }

  protected think(dt: number): boolean {
    const p = this.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    switch (this.state) {
      case 'idle':
      case 'move': {
        this.facing = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 80 && Math.abs(dy) < 20 && this.attackCd <= 0) {
          this.state = 'windup';
          this.stateT = 0;
          this.hitDone = false;
          this.playAnim('attack', { duration: (Ghoul.WINDUP + 0.2) * 1000, force: true });
          return false;
        }
        const moved = this.walkToward(p.x - Math.sign(dx || 1) * 62, p.y, dt);
        this.state = moved ? 'move' : 'idle';
        return moved;
      }
      case 'windup': {
        const k = this.stateT / Ghoul.WINDUP;
        const g = this.telegraph;
        g.clear();
        g.fillStyle(0xff3b30, 0.12 + 0.3 * k);
        g.fillEllipse(this.x + this.facing * 48, this.y, 100, 34);
        g.lineStyle(2, 0xff6a5a, 0.35 + 0.6 * k);
        g.strokeEllipse(this.x + this.facing * 48, this.y, 100, 34);
        if (this.stateT >= Ghoul.WINDUP) {
          g.clear();
          this.state = 'attack';
          this.stateT = 0;
          this.scene.resolveMelee(this, { dmg: 10, range: 88, depth: 24, knock: 230 }, [p]);
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

// Keeps its distance, lines up with you and throws bones along the lane.
export class BoneThrower extends Enemy {
  static WINDUP = 0.75;
  static REACH = 560;

  constructor(scene: RoomScene, x: number, y: number, tier: number) {
    super(scene, 'archer', x, y, Math.round(26 * tier), 82);
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
        if (Math.abs(dy) < 16 && adx > 140 && adx < BoneThrower.REACH - 40 && this.attackCd <= 0) {
          this.state = 'windup';
          this.stateT = 0;
          this.playAnim('throw', { duration: (BoneThrower.WINDUP + 0.25) * 1000, force: true });
          return false;
        }
        let tx = this.x;
        if (adx < 200) tx = this.x - Math.sign(dx || 1) * 120; // back off
        else if (adx > 400) tx = p.x - Math.sign(dx) * 320;
        const moved = this.walkToward(tx, p.y, dt, adx < 200 ? 1.3 : 1);
        this.facing = dx >= 0 ? 1 : -1;
        this.state = moved ? 'move' : 'idle';
        return moved;
      }
      case 'windup': {
        const k = this.stateT / BoneThrower.WINDUP;
        const g = this.telegraph;
        g.clear();
        g.fillStyle(0xff3b30, 0.08 + 0.3 * k);
        const x0 = this.x + this.facing * 20;
        g.fillRect(Math.min(x0, x0 + this.facing * BoneThrower.REACH), this.y - 5, BoneThrower.REACH, 10);
        g.lineStyle(2, 0xff6a5a, 0.3 + 0.6 * k);
        g.strokeRect(Math.min(x0, x0 + this.facing * BoneThrower.REACH), this.y - 5, BoneThrower.REACH, 10);
        if (this.stateT >= BoneThrower.WINDUP) {
          g.clear();
          this.state = 'attack';
          this.stateT = 0;
          this.scene.spawnBone(this.x + this.facing * 26, this.y, this.facing * 390, 8, BoneThrower.REACH);
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
