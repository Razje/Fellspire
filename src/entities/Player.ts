import Phaser from 'phaser';
import { Fighter } from './Fighter';
import type { AttackSpec, RoomScene } from '../scenes/RoomScene';

interface Move extends AttackSpec {
  anim: 'attack' | 'heavy';
  dur: number; // whole move, seconds
  hitAt: number; // when the blow lands
  lunge: number; // pixels stepped forward before it lands
}

// Sizes are in room pixels at the arena scale (characters about 75 px tall).
const LIGHT: Move[] = [
  { anim: 'attack', dur: 0.28, hitAt: 0.11, dmg: 9, range: 58, depth: 22, knock: 80, lunge: 24 },
  { anim: 'attack', dur: 0.28, hitAt: 0.11, dmg: 10, range: 58, depth: 22, knock: 95, lunge: 24 },
  { anim: 'heavy', dur: 0.42, hitAt: 0.18, dmg: 17, range: 66, depth: 26, knock: 250, lunge: 56, heavy: true },
];
const HEAVY: Move = { anim: 'heavy', dur: 0.58, hitAt: 0.33, dmg: 28, range: 74, depth: 28, knock: 320, lunge: 44, heavy: true };

const SPEED = 205; // the same in every direction: the floor is a place, not a lane
const ACCEL = 16; // how quickly speed follows the stick (higher = snappier)
const DODGE_TIME = 0.3;
const DODGE_SPEED = 380;
const AIM_Y = 0.55; // how much of a lunge goes up or down when aiming that way

interface Input { mx: number; my: number; light: boolean; heavy: boolean; dodge: boolean; block: boolean }

export class Player extends Fighter {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private move: Move | null = null;
  private aimY = 0;
  private hitDone = false;
  private combo = 0;
  private comboTimer = 0;
  private buffer: 'light' | 'heavy' | null = null;
  private dodgeCd = 0;
  private dodgeDir = { x: 1, y: 0 };
  private vx = 0;
  private vy = 0;
  private dustT = 0;
  private padPrev: boolean[] = [];

  constructor(scene: RoomScene, x: number, y: number) {
    super(scene, 'hero', x, y, 100);
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private readInput(): Input {
    const k = this.keys;
    const jd = Phaser.Input.Keyboard.JustDown;
    const mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const inp: Input = { mx, my, light: jd(k.J), heavy: jd(k.K), dodge: jd(k.SPACE), block: k.L.isDown || k.SHIFT.isDown };

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
        if (inp.heavy) { this.aim(inp); this.startMove(HEAVY); break; }
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
          else if (b === 'heavy') this.startMove(HEAVY);
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
    const m = LIGHT[this.combo];
    this.combo = (this.combo + 1) % LIGHT.length;
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
  }

  private startDodge(inp: Input) {
    const len = Math.hypot(inp.mx, inp.my);
    this.dodgeDir = len ? { x: inp.mx / len, y: inp.my / len } : { x: this.facing, y: 0 };
    if (inp.mx) this.facing = Math.sign(inp.mx);
    this.state = 'dodge';
    this.stateT = 0;
    this.invuln = DODGE_TIME;
    this.dodgeCd = 0.55;
    this.move = null;
    this.combo = 0;
    this.playAnim('dodge', { duration: DODGE_TIME * 1000, force: true });
    this.scene.dust(this.x, this.y, 3);
  }

  takeHit(dmg: number, fromX: number, knock: number, heavy: boolean): number {
    if (this.isDead() || this.invuln > 0 || this.state === 'dodge') return -1;
    const fromFront = Math.sign(fromX - this.x) === this.facing;
    if (this.state === 'block' && fromFront) {
      this.scene.blockSpark(this.x + this.facing * 18, this.y - this.visualHeight * 0.5);
      return this.applyDamage(Math.round(dmg * 0.2), fromX, knock * 0.4, 0);
    }
    const d = this.applyDamage(dmg, fromX, knock, heavy ? 0.4 : 0.22);
    this.invuln = 0.5;
    this.move = null;
    this.combo = 0;
    if (d > 0) this.scene.shake(90, 0.004);
    return d;
  }
}
