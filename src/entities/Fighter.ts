import Phaser from 'phaser';
import { CHARACTERS, RIG_ANIMS, WORLD, type CharConfig, type CharKey } from '../config';
import type { Rig } from '../rig/Rig';
import { firstFrame, loadedAnims } from '../assets';
import type { RoomScene } from '../scenes/RoomScene';

export type State = 'idle' | 'move' | 'block' | 'windup' | 'attack' | 'skill' | 'hurt' | 'dodge' | 'dead';

const PH_H = 84; // placeholder texture height

// Anything that walks the ground strip, takes hits and dies.
// x is the horizontal position, y is the depth on the ground strip (the feet).
export abstract class Fighter {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly cfg: CharConfig;
  readonly animated: Set<string>;
  facing = 1;
  hp: number;
  state: State = 'idle';
  stateT = 0;
  invuln = 0;
  removed = false;
  protected fading = false;
  appear = 1; // 0..1, rises to 1: lets a newcomer fade in
  lift = 0; // pixels above the floor (a leap); the shadow stays on the floor
  protected knockVx = 0;
  protected flashT = 0;
  protected tintColor: number | null = null;
  protected bobT = 0;
  private baseScale: number;
  private currentAnim = '';
  rig?: Rig; // when set, the character is drawn from parts and the sprite is hidden

  // scaleMul draws the character larger than its pack's usual size (bosses).
  constructor(public scene: RoomScene, public key: CharKey, public x: number, public y: number, public maxHp: number, scaleMul = 1) {
    this.cfg = CHARACTERS[key];
    this.hp = maxHp;
    this.animated = loadedAnims[key] ?? new Set();
    const art = this.animated.has('idle');
    this.sprite = scene.add.sprite(x, y, art ? firstFrame[key]! : `ph_${key}`);
    this.sprite.setOrigin(0.5, art ? this.cfg.footY : 0.98);
    this.baseScale = (art ? this.cfg.height / this.sprite.height : (this.cfg.height * 0.62) / PH_H) * scaleMul;
    this.sprite.setScale(this.baseScale);
    this.shadow = scene.add.ellipse(x, y, this.cfg.height * 0.36 * scaleMul, this.cfg.height * 0.1 * scaleMul, 0x000000, 0.4).setDepth(1);
  }

  get hasArt() {
    return this.animated.has('idle');
  }

  // Roughly how tall the visible character is, for health bars and numbers.
  get visualHeight() {
    return this.sprite.displayHeight * (this.hasArt ? 0.68 : 0.95);
  }

  isDead() {
    return this.state === 'dead';
  }

  playAnim(name: string, opts: { duration?: number; loop?: boolean; force?: boolean } = {}) {
    const r = this.rig;
    if (r && RIG_ANIMS[name] && r.has(RIG_ANIMS[name])) {
      if (this.currentAnim === name && !opts.force) return;
      this.currentAnim = name;
      r.play(RIG_ANIMS[name], true, { loop: !!opts.loop, duration: opts.duration });
      return;
    }
    if (this.hasArt && this.animated.has(name)) {
      const key = `${this.key}_${name}`;
      if (this.currentAnim === key && !opts.force) return;
      this.currentAnim = key;
      const frames = this.scene.anims.get(key).frames.length;
      this.sprite.play({
        key,
        repeat: opts.loop ? -1 : 0,
        frameRate: opts.duration ? Math.max(1, frames / (opts.duration / 1000)) : 18,
      });
      return;
    }
    if (this.currentAnim === name && !opts.force) return;
    this.currentAnim = name;
    if (this.hasArt) return; // art exists but lacks this animation: keep the current one
    // Placeholder "animation": a little tilt so attacks still read.
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    s.angle = 0;
    const d = opts.duration ?? 300;
    if (name === 'attack' || name === 'heavy' || name === 'throw') {
      this.scene.tweens.chain({
        targets: s,
        tweens: [
          { angle: -this.facing * 14, duration: d * 0.55, ease: 'Sine.easeOut' },
          { angle: this.facing * 22, duration: d * 0.15, ease: 'Quad.easeIn' },
          { angle: 0, duration: d * 0.3 },
        ],
      });
    } else if (name === 'dodge') {
      this.scene.tweens.add({ targets: s, angle: this.facing * 360, duration: d, onComplete: () => (s.angle = 0) });
    } else if (name === 'hurt') {
      this.scene.tweens.add({ targets: s, angle: -this.facing * 10, duration: d / 2, yoyo: true });
    }
  }

  // Ignores the hit and returns -1 while invulnerable or dead.
  takeHit(dmg: number, fromX: number, knock: number, heavy: boolean): number {
    if (this.isDead() || this.invuln > 0) return -1;
    return this.applyDamage(dmg, fromX, knock, heavy ? 0.45 : 0.3);
  }

  protected applyDamage(dmg: number, fromX: number, knock: number, staggerFor: number): number {
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = 0.07;
    this.knockVx = (this.x >= fromX ? 1 : -1) * knock;
    if (this.hp <= 0) {
      this.die();
    } else if (staggerFor > 0) {
      this.state = 'hurt';
      this.stateT = -staggerFor; // counts up to 0
      this.playAnim('hurt', { duration: staggerFor * 1000, force: true });
    }
    return dmg;
  }

  die() {
    this.state = 'dead';
    this.stateT = 0;
    if (this.hasArt && this.animated.has('die')) {
      this.playAnim('die', { duration: 700, force: true });
    } else {
      this.scene.tweens.killTweensOf(this.sprite);
      this.scene.tweens.add({ targets: this.sprite, angle: this.facing * -90, duration: 280, ease: 'Quad.easeIn' });
    }
  }

  fadeAndRemove(delayMs: number) {
    this.scene.time.delayedCall(delayMs, () => {
      this.fading = true;
      this.scene.tweens.add({
        targets: [this.rig ?? this.sprite, this.shadow],
        alpha: 0,
        duration: 400,
        onComplete: () => this.destroy(),
      });
    });
  }

  destroy() {
    this.rig?.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
    this.removed = true;
  }

  // The same as sync, for a character drawn from parts.
  private syncRig(dt: number) {
    const r = this.rig!;
    r.step(dt * 1000);
    this.sprite.setPosition(this.x, this.y).setFlipX(this.facing < 0);
    r.setPosition(this.x, this.y - this.lift).setFacing(this.facing).setDepth(this.y + 10);
    this.shadow.setPosition(this.x, this.y);
    if (this.flashT > 0) {
      this.flashT -= dt;
      r.flash(true);
    } else r.tintAll(this.tintColor ?? this.scene.lightAt(this.x, this.y));
    this.appear = Math.min(1, this.appear + dt * 2.5);
    if (!this.fading) r.setAlpha((this.invuln > 0 && this.state !== 'dodge' && Math.floor(this.invuln * 20) % 2 === 0 ? 0.45 : 1) * this.appear);
  }

  // Knockback, timers and staying on the ground strip.
  protected physics(dt: number) {
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.knockVx !== 0) {
      this.x += this.knockVx * dt;
      const f = 1600 * dt;
      this.knockVx = Math.abs(this.knockVx) <= f ? 0 : this.knockVx - Math.sign(this.knockVx) * f;
    }
    this.clamp();
  }

  clamp() {
    this.x = Phaser.Math.Clamp(this.x, 20, WORLD.roomW - 20);
    this.y = Phaser.Math.Clamp(this.y, WORLD.groundTop, WORLD.groundBottom);
    // props have footprints nobody can walk through
    this.scene.pushOut(this);
  }

  protected sync(dt: number, moving = false) {
    if (this.rig) { this.syncRig(dt); return; }
    let bob = 0;
    if (!this.hasArt && moving && !this.isDead()) {
      this.bobT += dt * 14;
      bob = -Math.abs(Math.sin(this.bobT)) * 5;
    }
    this.sprite.setPosition(this.x, this.y + bob - this.lift);
    this.sprite.setFlipX(this.cfg.facesLeft ? this.facing > 0 : this.facing < 0);
    this.sprite.setDepth(this.y + 10);
    this.shadow.setPosition(this.x, this.y);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.sprite.setTintFill(0xffffff);
    } else if (this.tintColor !== null) {
      this.sprite.setTint(this.tintColor);
    } else {
      // moonlight, warming up near torches
      this.sprite.setTint(this.scene.lightAt(this.x, this.y));
    }
    // Blink while invulnerable after a hit (not during a dodge, which is obvious).
    this.appear = Math.min(1, this.appear + dt * 2.5);
    if (!this.fading) this.sprite.setAlpha((this.invuln > 0 && this.state !== 'dodge' && Math.floor(this.invuln * 20) % 2 === 0 ? 0.45 : 1) * this.appear);
  }
}
