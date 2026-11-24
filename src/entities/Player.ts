import Phaser from 'phaser';
import { Fighter } from './Fighter';
import type { RoomScene } from '../scenes/RoomScene';
import { SKILLS, WEAPONS, type Move } from '../weapons';
import { startSkill } from '../skills';
import { armRig } from '../rig/weapons';
import { CHARACTERS } from '../config';
import { heroRig } from '../hero';

const DODGE_CD = 0.55;

const SPEED = 205; // the same in every direction: the floor is a place, not a lane
const ACCEL = 16; // how quickly speed follows the stick (higher = snappier)
const DODGE_TIME = 0.3;
const DODGE_SPEED = 380;
const ATTACK_MOVE = 0.5; // share of walking speed kept while attacking

// light/heavy: pressed this frame; lightHeld/heavyHeld: held down (repeats the attack)
interface Input { mx: number; my: number; light: boolean; heavy: boolean; lightHeld: boolean; heavyHeld: boolean; skill: boolean; dodge: boolean; block: boolean; interact: boolean }

// The moves of each weapon kind are in weapons.ts; the skills in skills.ts.

export class Player extends Fighter {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private move: Move | null = null;
  private hitDone = false;
  private swept = new Set<object>(); // what a dashing move has already cut
  private combo = 0;
  private comboTimer = 0;
  private buffer: 'light' | 'heavy' | null = null;
  dodgeCd = 0; // seconds until the next dodge; the HUD shows it
  skillCd = 0; // seconds until the skill is ready again
  private skillLock = 0; // seconds the current skill keeps the hero busy
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
    const rig = heroRig(scene, x, y, CHARACTERS.hero.height / 900);
    if (rig) {
      this.rig = rig;
      this.sprite.setVisible(false);
      this.playAnim('idle', { loop: true, force: true });
    }
    this.arm();
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,I,E,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private get kit() {
    return WEAPONS[this.scene.stats.kind];
  }

  get skill() {
    return SKILLS[this.scene.stats.skill];
  }

  // Puts the carried weapon in the hero's hand (the drawn hero only).
  arm() {
    if (this.rig) armRig(this.rig, this.scene.stats.kind);
  }

  get dodgeCdMax() {
    return DODGE_CD * (1 - this.scene.stats.fx.dodgeCd);
  }

  private readInput(): Input {
    if (this.scene.cutscene) return { mx: 0, my: 0, light: false, heavy: false, lightHeld: false, heavyHeld: false, skill: false, dodge: false, block: false, interact: false };
    const k = this.keys;
    const jd = Phaser.Input.Keyboard.JustDown;
    const mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    // a press queues one attack; holding J or K keeps attacking once the move ends
    const inp: Input = {
      mx, my, light: jd(k.J), heavy: jd(k.K), lightHeld: k.J.isDown, heavyHeld: k.K.isDown,
      skill: jd(k.I), dodge: jd(k.SPACE), block: k.L.isDown || k.SHIFT.isDown, interact: jd(k.E),
    };

    // Controller: stick (analogue) or d-pad, X light, Y heavy (both held to repeat), LB skill, A dodge, RB block.
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
      inp.lightHeld ||= b(2);
      inp.heavyHeld ||= b(3);
      inp.skill ||= pressed(4);
      inp.dodge ||= pressed(0);
      inp.block ||= b(5);
      inp.interact ||= pressed(1);
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }
    if (!this.kit.block) inp.block = false; // only a shield blocks
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
    this.skillCd -= dt;
    let moving = false;

    switch (this.state) {
      case 'idle':
      case 'move':
      case 'block': {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
        if (inp.dodge && this.dodgeCd <= 0) { this.startDodge(inp); break; }
        if (inp.light || inp.lightHeld) { this.aim(inp); this.startLight(); break; }
        if (inp.heavy || inp.heavyHeld) { this.aim(inp); this.startMove(this.kit.heavy); break; }
        if (inp.skill && this.skillCd <= 0) { this.aim(inp); this.startSkill(); break; }
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
        if (m.sweep) this.vx = this.vy = 0; // a dash goes where it goes
        else {
          // still walking, at half speed, while the attack plays; the facing stays put
          const len = Math.hypot(inp.mx, inp.my) || 1;
          const top = SPEED * ATTACK_MOVE, k = Math.min(1, ACCEL * dt);
          this.vx += ((inp.mx / len) * top - this.vx) * k;
          this.vy += ((inp.my / len) * top - this.vy) * k;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
        }
        // the lunge is always straight ahead
        if (t < m.hitAt) {
          this.x += this.facing * (m.lunge / m.hitAt) * dt;
          if (m.sweep) this.sweepCut(m);
        }
        if (!this.hitDone && t >= m.hitAt) {
          this.hitDone = true;
          if (m.shot) this.scene.shots.fire(this, m);
          else if (m.sweep) this.sweepCut(m);
          else this.scene.resolveMelee(this, m, this.scene.enemies);
        }
        if (inp.light) this.buffer = 'light';
        if (inp.heavy) this.buffer = 'heavy';
        // dodging cancels the end of an attack, once the blow has landed
        if (inp.dodge && this.hitDone && this.dodgeCd <= 0) { this.startDodge(inp); break; }
        if (t >= m.dur) {
          // a press made during the move goes first, else whatever is still held.
          // A new press turns to the side you hold; a held attack keeps its facing,
          // so you can walk away while still attacking the way you started.
          if (this.buffer) this.aim(inp);
          const b = this.buffer ?? (inp.lightHeld ? 'light' : inp.heavyHeld ? 'heavy' : null);
          this.buffer = null;
          if (b === 'light') this.startLight();
          else if (b === 'heavy') this.startMove(this.kit.heavy);
          else { this.state = 'idle'; this.stateT = 0; this.comboTimer = 0.4; }
        }
        break;
      }
      case 'skill':
        // the skill moves the hero itself (skills.ts); here only the waiting
        this.vx = this.vy = 0;
        if (this.stateT >= this.skillLock) { this.state = 'idle'; this.stateT = 0; }
        break;
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

  // Attacks turn to the side you hold; they always go straight, never up or down.
  private aim(inp: Input) {
    if (inp.mx) this.facing = Math.sign(inp.mx);
  }

  private startLight() {
    this.scene.onPlayerAction('light');
    const light = this.kit.light;
    const m = light[this.combo % light.length];
    this.combo = (this.combo + 1) % light.length;
    this.comboTimer = 1;
    this.startMove(m);
  }

  // A dash cuts whatever it passes, each foe once, without stopping the dash.
  private sweepCut(m: Move) {
    const s = this.scene;
    s.strike(this, true, { ...m, quiet: true }, s.enemies, (x, y) => s.inReach(this, x, y, m), { once: this.swept });
  }

  private startMove(m: Move) {
    this.move = m;
    this.hitDone = false;
    this.swept.clear();
    if (m.sweep) { this.invuln = Math.max(this.invuln, m.hitAt); this.scene.dust(this.x, this.y, 3); }
    this.buffer = null;
    this.state = 'attack';
    this.stateT = 0;
    this.playAnim(m.anim, { duration: m.dur * 1000, force: true });
    if (m === this.kit.heavy) this.scene.onPlayerAction('heavy');
  }

  private startSkill() {
    this.skillCd = this.skill.cooldown;
    this.state = 'skill';
    this.stateT = 0;
    this.move = null;
    this.combo = 0;
    this.skillLock = startSkill(this.scene.stats.skill, this.scene, this);
    this.scene.onPlayerAction('skill');
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
