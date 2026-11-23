import Phaser from 'phaser';
import { Fighter } from './Fighter';
import type { AttackSpec, RoomScene } from '../scenes/RoomScene';

interface Move extends AttackSpec {
  anim: 'attack' | 'heavy';
  dur: number; // whole move, seconds
  hitAt: number; // when the blow lands
  lunge: number; // pixels stepped forward before it lands
}

const LIGHT: Move[] = [
  { anim: 'attack', dur: 0.3, hitAt: 0.12, dmg: 9, range: 92, depth: 28, knock: 110, lunge: 40 },
  { anim: 'attack', dur: 0.3, hitAt: 0.12, dmg: 10, range: 92, depth: 28, knock: 130, lunge: 40 },
  { anim: 'heavy', dur: 0.46, hitAt: 0.2, dmg: 17, range: 104, depth: 32, knock: 360, lunge: 95, heavy: true },
];
const HEAVY: Move = { anim: 'heavy', dur: 0.62, hitAt: 0.36, dmg: 28, range: 118, depth: 34, knock: 460, lunge: 70, heavy: true };

const SPEED_X = 235;
const SPEED_Y = 150;
const DODGE_TIME = 0.34;
const DODGE_SPEED = 470;

interface Input { mx: number; my: number; light: boolean; heavy: boolean; dodge: boolean; block: boolean }

export class Player extends Fighter {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private move: Move | null = null;
  private hitDone = false;
  private combo = 0;
  private comboTimer = 0;
  private buffer: 'light' | 'heavy' | null = null;
  private dodgeCd = 0;
  private dodgeDir = 1;
  private padPrev: boolean[] = [];

  constructor(scene: RoomScene, x: number, y: number) {
    super(scene, 'hero', x, y, 100);
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private readInput(): Input {
    const k = this.keys;
    const jd = Phaser.Input.Keyboard.JustDown;
    let mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const inp: Input = { mx, my, light: jd(k.J), heavy: jd(k.K), dodge: jd(k.SPACE), block: k.L.isDown || k.SHIFT.isDown };

    // Controller: stick or d-pad, X light, Y heavy, A dodge, RB block.
    const pad = this.scene.input.gamepad?.pad1;
    if (pad) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const pressed = (i: number) => b(i) && !this.padPrev[i];
      const sx = Math.abs(pad.leftStick.x) > 0.3 ? Math.sign(pad.leftStick.x) : 0;
      const sy = Math.abs(pad.leftStick.y) > 0.3 ? Math.sign(pad.leftStick.y) : 0;
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
        if (inp.dodge && this.dodgeCd <= 0) { this.startDodge(inp.mx); break; }
        if (inp.light) { if (inp.mx) this.facing = Math.sign(inp.mx); this.startLight(); break; }
        if (inp.heavy) { if (inp.mx) this.facing = Math.sign(inp.mx); this.startMove(HEAVY); break; }
        const blocking = inp.block;
        const speed = blocking ? 0.35 : 1;
        if (inp.mx !== 0 && !blocking) this.facing = Math.sign(inp.mx);
        const len = inp.mx && inp.my ? Math.SQRT1_2 : 1;
        this.x += inp.mx * SPEED_X * speed * len * dt;
        this.y += inp.my * SPEED_Y * speed * len * dt;
        moving = inp.mx !== 0 || inp.my !== 0;
        const next = blocking ? 'block' : moving ? 'move' : 'idle';
        if (next !== this.state) { this.state = next; this.stateT = 0; }
        this.playAnim(next === 'move' ? 'walk' : 'idle', { loop: true });
        if (blocking) this.tintColor = 0x9fc0ff;
        break;
      }
      case 'attack': {
        const m = this.move;
        if (!m) { this.state = 'idle'; this.stateT = 0; break; }
        const t = this.stateT;
        if (t < m.hitAt) this.x += this.facing * (m.lunge / m.hitAt) * dt;
        if (!this.hitDone && t >= m.hitAt) {
          this.hitDone = true;
          this.scene.resolveMelee(this, m, this.scene.enemies);
        }
        if (inp.light) this.buffer = 'light';
        if (inp.heavy) this.buffer = 'heavy';
        // Dodging cancels the end of an attack, once the blow has landed.
        if (inp.dodge && this.hitDone && this.dodgeCd <= 0) { this.startDodge(inp.mx); break; }
        if (t >= m.dur) {
          const b = this.buffer;
          this.buffer = null;
          if (inp.mx) this.facing = Math.sign(inp.mx);
          if (b === 'light' && this.combo > 0) this.startLight();
          else if (b === 'heavy') this.startMove(HEAVY);
          else { this.state = 'idle'; this.stateT = 0; this.comboTimer = 0.4; }
        }
        break;
      }
      case 'dodge': {
        const k = 1 - (this.stateT / DODGE_TIME) * 0.6;
        this.x += this.dodgeDir * DODGE_SPEED * k * dt;
        this.y += inp.my * SPEED_Y * 0.6 * dt;
        if (this.stateT >= DODGE_TIME) { this.state = 'idle'; this.stateT = 0; }
        break;
      }
      case 'hurt':
        if (this.stateT >= 0) { this.state = 'idle'; this.stateT = 0; }
        break;
    }
    this.clamp();
    this.sync(dt, moving);
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

  private startDodge(mx: number) {
    this.dodgeDir = mx ? Math.sign(mx) : this.facing;
    this.facing = this.dodgeDir;
    this.state = 'dodge';
    this.stateT = 0;
    this.invuln = DODGE_TIME;
    this.dodgeCd = 0.6;
    this.move = null;
    this.combo = 0;
    this.playAnim('dodge', { duration: DODGE_TIME * 1000, force: true });
  }

  takeHit(dmg: number, fromX: number, knock: number, heavy: boolean): number {
    if (this.isDead() || this.invuln > 0 || this.state === 'dodge') return -1;
    const fromFront = Math.sign(fromX - this.x) === this.facing;
    if (this.state === 'block' && fromFront) {
      this.scene.blockSpark(this.x + this.facing * 26, this.y - this.visualHeight * 0.5);
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
