import Phaser from 'phaser';
import { Fighter } from './Fighter';
import type { AttackSpec, RoomScene } from '../scenes/RoomScene';
import type { WeaponKind } from '../loot';
import { CHARACTERS, HERO_PARTS } from '../config';
import { Rig } from '../rig/Rig';
import { scmlOf } from '../rig/parts';

interface Move extends AttackSpec {
  anim: 'attack' | 'heavy';
  dur: number; // whole move, seconds
  hitAt: number; // when the blow lands
  lunge: number; // pixels stepped forward before it lands
}

// Each weapon kind has its own moves: the light combo and the heavy attack.
// Sizes are in room pixels at the arena scale (characters about 75 px tall).
// Damage here is before the weapon's own power and the gear's bonuses.
const KITS: Record<WeaponKind, { light: Move[]; heavy: Move }> = {
  longsword: {
    light: [
      { anim: 'attack', dur: 0.28, hitAt: 0.11, dmg: 9, range: 58, depth: 22, knock: 80, lunge: 24 },
      { anim: 'attack', dur: 0.28, hitAt: 0.11, dmg: 10, range: 58, depth: 22, knock: 95, lunge: 24 },
      { anim: 'heavy', dur: 0.42, hitAt: 0.18, dmg: 17, range: 66, depth: 26, knock: 250, lunge: 56, heavy: true },
    ],
    heavy: { anim: 'heavy', dur: 0.58, hitAt: 0.33, dmg: 28, range: 74, depth: 28, knock: 320, lunge: 44, heavy: true },
  },
  // slow and crushing, with reach; the heavy spins and hits both sides
  greatblade: {
    light: [
      { anim: 'attack', dur: 0.38, hitAt: 0.17, dmg: 14, range: 72, depth: 26, knock: 130, lunge: 20 },
      { anim: 'attack', dur: 0.38, hitAt: 0.17, dmg: 15, range: 72, depth: 26, knock: 140, lunge: 20 },
      { anim: 'heavy', dur: 0.56, hitAt: 0.26, dmg: 25, range: 80, depth: 30, knock: 300, lunge: 40, heavy: true },
    ],
    heavy: { anim: 'heavy', dur: 0.72, hitAt: 0.4, dmg: 34, range: 86, depth: 32, knock: 340, lunge: 8, heavy: true, around: true },
  },
  // quick and light, four strikes; the heavy is a long lunge
  rapier: {
    light: [
      { anim: 'attack', dur: 0.2, hitAt: 0.08, dmg: 6, range: 62, depth: 20, knock: 50, lunge: 26 },
      { anim: 'attack', dur: 0.2, hitAt: 0.08, dmg: 6, range: 62, depth: 20, knock: 50, lunge: 26 },
      { anim: 'attack', dur: 0.2, hitAt: 0.08, dmg: 7, range: 62, depth: 20, knock: 60, lunge: 26 },
      { anim: 'heavy', dur: 0.32, hitAt: 0.13, dmg: 12, range: 68, depth: 22, knock: 170, lunge: 44, heavy: true },
    ],
    heavy: { anim: 'heavy', dur: 0.48, hitAt: 0.26, dmg: 22, range: 76, depth: 22, knock: 220, lunge: 120, heavy: true },
  },
};
const DODGE_CD = 0.55;

const SPEED = 205; // the same in every direction: the floor is a place, not a lane
const ACCEL = 16; // how quickly speed follows the stick (higher = snappier)
const DODGE_TIME = 0.3;
const DODGE_SPEED = 380;
const AIM_Y = 0.55; // how much of a lunge goes up or down when aiming that way

interface Input { mx: number; my: number; light: boolean; heavy: boolean; dodge: boolean; block: boolean; interact: boolean }

export class Player extends Fighter {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private move: Move | null = null;
  private aimY = 0;
  private hitDone = false;
  private combo = 0;
  private comboTimer = 0;
  private buffer: 'light' | 'heavy' | null = null;
  dodgeCd = 0; // seconds until the next dodge; the HUD shows it
  private dodgeDir = { x: 1, y: 0 };
  private vx = 0;
  private vy = 0;
  private dustT = 0;
  private padPrev: boolean[] = [];
  interact = false; // E pressed this frame (open a chest)

  constructor(scene: RoomScene, x: number, y: number) {
    super(scene, 'hero', x, y, 100 + scene.stats.fx.maxHp);
    // drawn from parts when they are there: the frames' 900-pixel canvas maps to the
    // configured height, so the two are the same size
    const scml = scmlOf(HERO_PARTS);
    if (scml) {
      this.rig = new Rig(scene, x, y, scml, HERO_PARTS, CHARACTERS.hero.height / 900);
      this.sprite.setVisible(false);
      this.playAnim('idle', { loop: true, force: true });
    }
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,E,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private get kit() {
    return KITS[this.scene.stats.kind];
  }

  get dodgeCdMax() {
    return DODGE_CD * (1 - this.scene.stats.fx.dodgeCd);
  }

  private readInput(): Input {
    if (this.scene.cutscene) return { mx: 0, my: 0, light: false, heavy: false, dodge: false, block: false, interact: false };
    const k = this.keys;
    const jd = Phaser.Input.Keyboard.JustDown;
    const mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const inp: Input = { mx, my, light: jd(k.J), heavy: jd(k.K), dodge: jd(k.SPACE), block: k.L.isDown || k.SHIFT.isDown, interact: jd(k.E) };

    // Controller: stick (analogue) or d-pad, X light, Y heavy, A dodge, RB block.
    const pad = this.scene.input.gamepad?.pad1;
    if (pad) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const pressed = (i: number) => b(i) && !this.padPrev[i];
      const sx = Math.abs(pad.leftStick.x) > 0.25 ? pad.leftStick.x : 0;
      const sy = Math.abs(pad.leftStick.y) > 0.25 ? pad.leftStick.y : 0;
      inp.mx = mx || sx || (b(15) ? 1 : b(14) ? -1 : 0);
      inp.my = my || sy || (b(13) ? 1 : b(12) ? -1 : 0);
      inp.light ||= pressed(2);
      inp.heavy ||= pressed(3);
      inp.dodge ||= pressed(0);
      inp.block ||= b(5);
      inp.interact ||= pressed(1);
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }
    return inp;
  }

  update(dt: number) {
    this.physics(dt);
    this.tintColor = null;
    if (this.isDead()) {
      this.sync(dt);
      return;
    }
    const inp = this.readInput();
    this.interact = inp.interact;
    this.dodgeCd -= dt;
    let moving = false;

    switch (this.state) {
      case 'idle':
      case 'move':
      case 'block': {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
        if (inp.dodge && this.dodgeCd <= 0) { this.startDodge(inp); break; }
        if (inp.light) { this.aim(inp); this.startLight(); break; }
        if (inp.heavy) { this.aim(inp); this.startMove(this.kit.heavy); break; }
        const blocking = inp.block;
        if (inp.mx !== 0 && !blocking) this.facing = Math.sign(inp.mx);
        // ease towards the wanted velocity: quick, but not instant
        const len = Math.hypot(inp.mx, inp.my) || 1;
        const top = SPEED * (blocking ? 0.35 : 1);
        const k = Math.min(1, ACCEL * dt);
        this.vx += ((inp.mx / len) * top - this.vx) * k;
        this.vy += ((inp.my / len) * top - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        moving = Math.hypot(this.vx, this.vy) > 30;
        const next = blocking ? 'block' : moving ? 'move' : 'idle';
        if (next !== this.state) { this.state = next; this.stateT = 0; }
        this.playAnim(next === 'move' ? 'walk' : 'idle', { loop: true });
        if (blocking) this.tintColor = 0x9fc0ff;
        if (moving && (this.dustT -= dt) <= 0) { this.dustT = 0.24; this.scene.dust(this.x - this.facing * 8, this.y, 1); }
        break;
      }
      case 'attack': {
        const m = this.move;
        if (!m) { this.state = 'idle'; this.stateT = 0; break; }
        const t = this.stateT;
        this.vx = this.vy = 0;
        if (t < m.hitAt) {
          this.x += this.facing * (m.lunge / m.hitAt) * dt;
          this.y += this.aimY * AIM_Y * (m.lunge / m.hitAt) * dt;
        }
        if (!this.hitDone && t >= m.hitAt) {
          this.hitDone = true;
          this.scene.resolveMelee(this, m, this.scene.enemies);
        }
        if (inp.light) this.buffer = 'light';
        if (inp.heavy) this.buffer = 'heavy';
        // dodging cancels the end of an attack, once the blow has landed
        if (inp.dodge && this.hitDone && this.dodgeCd <= 0) { this.startDodge(inp); break; }
        if (t >= m.dur) {
          const b = this.buffer;
          this.buffer = null;
          this.aim(inp);
          if (b === 'light' && this.combo > 0) this.startLight();
          else if (b === 'heavy') this.startMove(this.kit.heavy);
          else { this.state = 'idle'; this.stateT = 0; this.comboTimer = 0.4; }
        }
        break;
      }
      case 'dodge': {
        const k = 1 - (this.stateT / DODGE_TIME) * 0.6;
        this.x += this.dodgeDir.x * DODGE_SPEED * k * dt;
        this.y += this.dodgeDir.y * DODGE_SPEED * 0.8 * k * dt;
        if (this.stateT >= DODGE_TIME) {
          this.state = 'idle'; this.stateT = 0;
          this.vx = this.dodgeDir.x * SPEED * 0.6; this.vy = this.dodgeDir.y * SPEED * 0.6;
        }
        break;
      }
      case 'hurt':
        this.vx = this.vy = 0;
        if (this.stateT >= 0) { this.state = 'idle'; this.stateT = 0; }
        break;
    }
    this.clamp();
    this.sync(dt, moving);
  }

  // Attacks turn to the side you hold and lean up or down with it.
  private aim(inp: Input) {
    if (inp.mx) this.facing = Math.sign(inp.mx);
    this.aimY = Math.sign(inp.my);
  }

  private startLight() {
    this.scene.onPlayerAction('light');
    const light = this.kit.light;
    const m = light[this.combo % light.length];
    this.combo = (this.combo + 1) % light.length;
    this.comboTimer = 1;
    this.startMove(m);
  }

  private startMove(m: Move) {
    this.move = m;
    this.hitDone = false;
    this.buffer = null;
    this.state = 'attack';
    this.stateT = 0;
    this.playAnim(m.anim, { duration: m.dur * 1000, force: true });
    if (m === this.kit.heavy) this.scene.onPlayerAction('heavy');
  }

  private startDodge(inp: Input) {
    const len = Math.hypot(inp.mx, inp.my);
    this.dodgeDir = len ? { x: inp.mx / len, y: inp.my / len } : { x: this.facing, y: 0 };
    if (inp.mx) this.facing = Math.sign(inp.mx);
    this.state = 'dodge';
    this.stateT = 0;
    this.invuln = DODGE_TIME;
    this.dodgeCd = this.dodgeCdMax;
    this.move = null;
    this.combo = 0;
    this.playAnim('dodge', { duration: DODGE_TIME * 1000, force: true });
    this.scene.onPlayerAction('dodge');
    this.scene.dust(this.x, this.y, 3);
  }

  takeHit(dmg: number, fromX: number, knock: number, heavy: boolean): number {
    if (this.isDead() || this.invuln > 0 || this.state === 'dodge') return -1;
    const fromFront = Math.sign(fromX - this.x) === this.facing;
    const armor = this.scene.stats.fx.armor;
    if (this.state === 'block' && fromFront) {
      this.scene.blockSpark(this.x + this.facing * 18, this.y - this.visualHeight * 0.5);
      return this.applyDamage(Math.round(dmg * 0.2 * (1 - armor)), fromX, knock * 0.4, 0);
    }
    const d = this.applyDamage(Math.max(1, Math.round(dmg * (1 - armor))), fromX, knock, heavy ? 0.4 : 0.22);
    this.scene.afterPlayerHurt();
    this.invuln = 0.5;
    this.move = null;
    this.combo = 0;
    if (d > 0) this.scene.shake(90, 0.004);
    return d;
  }
}
