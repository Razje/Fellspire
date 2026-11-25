import Phaser from 'phaser';
import { COOP, DARK, WORLD, ZONE } from '../config';
import { Player } from '../entities/Player';
import { BoneThrower, Enemy, Ghoul } from '../entities/Enemies';
import { Warden } from '../entities/Warden';
import { Dummy } from '../entities/Dummy';
import { Camp, CAMP, CAMP_CLEAR, saveWeapon, savedWeapon } from '../hub';
import type { Fighter } from '../entities/Fighter';
import { buildBlightwood, type Blightwood } from '../blightwood';
import { canvas, makeTitleTextures } from '../titleArt';
import { settings } from '../settings';
import type { Action, HudScene } from './HudScene';
import { gearOf, newRun, type Run } from '../run';
import { EMBERS, earnEmbers } from '../embers';
import { newGear } from '../loot';
import { heroLook } from '../hero';
import { getParty, keyLabels } from '../input';
import { REVIVE, Soul } from '../revive';
import { gearStats, rollChest, type GearStats, type Item } from '../loot';
import { hi, keycap } from '../ui/kit';
import { Shots } from '../shots';
import type { Breakable } from '../blightwood';
import { shiftParallax, ZOOM } from '../ui/view';
import { FONT, RES } from '../ui/theme';

export interface AttackSpec {
  dmg: number;
  range: number; // reach in front of the attacker
  depth: number; // how far up or down the ground strip it still connects
  knock: number;
  heavy?: boolean;
  around?: boolean; // hits on both sides (a spin)
  stun?: number; // seconds a foe stands dazed after the hit
  slow?: number; // seconds a foe is slowed after the hit
  dot?: boolean; // ticking damage: no flinch, no knockback, no hit-stop
  quiet?: boolean; // no hit-stop or shake (many small hits at once)
  stop?: number; // hit-stop in ms instead of the usual (short for quick weapons)
}

// Where a blow comes from: knockback pushes away from x, sparks sit on its side.
export interface HitSource { x: number; y: number; facing: number }

export interface StrikeOpts {
  once?: Set<object>; // skip what is in it, and add what gets hit (a piercing arrow)
  max?: number; // stop after this many (an arrow that stops at the first)
}

interface Coin { img: Phaser.GameObjects.Image; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; value: number; dead: boolean }
interface Fire { x: number; y: number; left: number; tick: number; dmg: number; by: Player; objs: Phaser.GameObjects.Image[] }
interface Chest {
  img: Phaser.GameObjects.Image; runes: Phaser.GameObjects.Image; x: number; y: number;
  prompt: Phaser.GameObjects.Container; locked: boolean; opened: boolean;
  items: Item[]; // player 1's cards
  items2?: Item[]; // player 2's, rolled apart, in co-op
}

interface Wave { ghouls: number; throwers: number }

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; vx: number; dmg: number; left: number; dead: boolean;
}

interface Pickup { sprite: Phaser.GameObjects.Image; x: number; y: number; t: number; dead: boolean }

// The farthest apart two heroes may stand, side to side, so both stay in view
// (the view's width less 140, 820 at 16:9: this leaves each a margin at the edge).
export const LEASH = WORLD.viewW - 140;
// A hero who fell comes back in the next room with this share of their health.
const REJOIN = 0.3;

export class RoomScene extends Phaser.Scene {
  heroes: Player[] = []; // one in solo, two in co-op
  private fallen = new Set<Player>(); // heroes already counted as down
  souls: Soul[] = []; // a fallen hero's, while the other can still revive her
  private focus = { x: 0, y: 0 }; // what the camera follows: between the living heroes
  private striker: Player | null = null; // whose blow is being dealt (for kill effects)
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  shots!: Shots; // the player's arrows and bolts
  private effects: ((dt: number) => boolean)[] = []; // skills playing out
  private pickups: Pickup[] = [];
  private room = 1;
  private waves: Wave[] = [];
  wave = 0; // waves started so far
  private waveDelay = 0;
  gateOpen = false;
  private leaving = false;
  private freeze = 0;
  private startHp: (number | undefined)[] = [];
  slain = 0; // in this room
  run: Run = newRun();
  private coins: Coin[] = [];
  private fires: Fire[] = [];
  private chest: Chest | null = null;
  private hitCount = 0; // for every-fifth-hit effects
  private world!: Blightwood;
  boss: Warden | null = null;
  camp: Camp | null = null; // room 0, between runs
  dummy: Dummy | null = null;
  cutscene = false; // the player cannot act (boss introduction)
  private intro = true;
  private dark: { img: Phaser.GameObjects.Image; t: number; r: number; tick: number; warned: boolean } | null = null;
  private slow = { k: 1, left: 0 };
  private emberFx?: Phaser.GameObjects.Particles.ParticleEmitter;
  private gateWait?: Phaser.GameObjects.Text; // "Waiting for ..." over the gate, in co-op

  constructor() {
    super('room');
  }

  // Phaser reuses the scene object on restart, so all state is reset here.
  init(data: { room?: number; hp?: number; hps?: (number | undefined)[]; run?: Run; intro?: boolean }) {
    this.room = data.room ?? 1;
    this.intro = data.intro ?? true;
    this.boss = null;
    this.camp = null;
    this.dummy = null;
    this.cutscene = false;
    this.dark = null;
    this.slow = { k: 1, left: 0 };
    this.emberFx = undefined;
    this.gateWait = undefined;
    this.startHp = data.hps ?? [data.hp];
    this.heroes = [];
    this.fallen = new Set();
    this.souls = [];
    this.striker = null;
    this.run = data.run ? { ...data.run } : newRun();
    // the camp hands out the weapon each player chose at its rack last time
    if (this.isCamp && !data.run) {
      this.run.gear = { ...this.run.gear, weapon: savedWeapon(0) };
      if (getParty().length > 1) this.run.gear2 = { ...newGear(), weapon: savedWeapon(1) };
    }
    this.coins = [];
    this.fires = [];
    this.chest = null;
    this.hitCount = 0;
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.pickups = [];
    this.wave = 0;
    this.waveDelay = 1.2;
    this.gateOpen = false;
    this.leaving = false;
    this.freeze = 0;
    this.slain = 0;
    this.waves = this.makeWaves(this.room);
  }

  // Player 1's hero (the only one in solo).
  get player() {
    return this.heroes[0];
  }

  // What player 1's gear adds up to (each hero has their own: hero.stats).
  get stats(): GearStats {
    return this.player?.stats ?? gearStats(this.run.gear);
  }

  get livingHeroes() {
    return this.heroes.filter((h) => !h.isDead());
  }

  // The living hero nearest to a point; keep stays the choice unless another is
  // clearly closer, so a foe does not turn back and forth between two heroes.
  nearestHero(x: number, y: number, keep?: Player | null): Player {
    const live = this.livingHeroes;
    if (!live.length) return keep ?? this.player;
    const d = (h: Player) => Math.hypot(h.x - x, (h.y - y) * 1.6);
    let best = live[0];
    for (const h of live) if (d(h) < d(best)) best = h;
    if (keep && !keep.isDead() && keep !== best && d(keep) < d(best) + 60) return keep;
    return best;
  }

  get isBossRoom() {
    return this.room === ZONE.bossRoom;
  }

  get isCamp() {
    return this.room === 0;
  }

  private makeWaves(r: number): Wave[] {
    if (r === ZONE.bossRoom || r === 0) return [];
    const count = Math.min(2 + r, 4);
    return Array.from({ length: count }, (_, w) => ({
      ghouls: Math.min(2 + Math.floor(r / 2) + w, 6),
      throwers: r === 1 && w === 0 ? 0 : Math.min(1 + Math.floor((r + w) / 3), 3),
    }));
  }

  get waveCount() {
    return this.waves.length;
  }

  get totalFoes() {
    return this.waves.reduce((n, w) => n + w.ghouls + w.throwers, 0);
  }

  // The HUD runs as its own scene; it may not have started yet on the first frame.
  private get hud(): HudScene | null {
    const h = this.scene.get('hud') as HudScene | null;
    return h?.ready ? h : null;
  }

  create() {
    const { roomW } = WORLD;
    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, 0, roomW, WORLD.roomH);
    if (!this.textures.exists('tt_sky')) makeTitleTextures(this);
    this.world = buildBlightwood(this, { boss: this.isBossRoom, camp: this.isCamp, clear: this.isCamp ? CAMP_CLEAR : undefined });
    shiftParallax(this);
    this.shots = new Shots(this);

    const start = this.isCamp ? CAMP.start : { x: 150, y: 470 };
    getParty().forEach((device, who) => {
      // player 2 starts a step behind and below player 1
      const h = new Player(this, start.x - who * 40, start.y + who * 60, device, who as 0 | 1);
      const hp = this.startHp[who];
      if (hp !== undefined) h.hp = Math.max(1, Math.min(h.maxHp, hp));
      this.heroes.push(h);
    });
    this.updateFocus(true);
    // follow the body, not the feet, and lag a touch so movement reads
    cam.startFollow(this.focus, true, 0.1, 0.1, 0, 30);
    cam.fadeIn(350);

    if (this.isCamp) {
      this.camp = new Camp(this, this.world.lights, this.world.obstacles);
      this.dummy = new Dummy(this, CAMP.dummy.x, CAMP.dummy.y);
      this.enemies.push(this.dummy);
      this.gateOpen = true; // the rune gate is the way into the run
      this.world.openExit();
    } else if (!this.isBossRoom) this.placeChest();
    if (this.isBossRoom) {
      const b = this.toughen(new Warden(this, roomW / 2 + 260, (WORLD.groundTop + WORLD.groundBottom) / 2));
      this.boss = b;
      this.enemies.push(b);
      this.world.lights.push(b.light);
      if (this.intro) this.playIntro(b);
      else b.wake();
    }

    this.scene.launch('hud', { room: this.room });
  }

  // The camera goes to the Warden, his name comes up, then back to the hero.
  private playIntro(b: Warden) {
    this.cutscene = true;
    const cam = this.cameras.main;
    cam.stopFollow();
    this.time.delayedCall(500, () => cam.pan(b.x, b.y - 60, 1100, 'Sine.easeInOut'));
    this.time.delayedCall(1700, () => { b.flare(); this.hud?.bossIntro('The Lantern Warden', 'Keeper of the Drowned Light'); });
    this.time.delayedCall(4500, () => cam.pan(this.focus.x, this.focus.y - 30, 800, 'Sine.easeInOut'));
    this.time.delayedCall(5350, () => {
      cam.startFollow(this.focus, true, 0.1, 0.1, 0, 30);
      this.cutscene = false;
      b.wake();
    });
  }

  canPause() {
    return !this.leaving && this.livingHeroes.length > 0;
  }

  // A new run starts back at the camp.
  restartRun() {
    this.leaveTo(() => this.scene.restart({ room: 0 }));
  }

  toMenu() {
    this.leaveTo(() => { this.scene.stop('hud'); this.scene.start('menu'); });
  }

  // Fade out, then go. Works from a paused room too.
  private leaveTo(go: () => void) {
    if (this.leaving && !this.scene.isPaused()) return;
    if (this.scene.isPaused()) this.scene.resume();
    this.leaving = true;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once('camerafadeoutcomplete', go);
  }

  onPlayerAction(p: Player, a: Action) {
    this.hud?.used(p.who, a);
  }

  // The camera's point: the middle of the living heroes (of all of them once none
  // is left standing). The sprite's y is the feet, like the hero's own.
  private updateFocus(snap = false) {
    const live = this.livingHeroes.length ? this.livingHeroes : this.heroes;
    if (!live.length) return;
    this.focus.x = live.reduce((n, h) => n + h.x, 0) / live.length;
    this.focus.y = live.reduce((n, h) => n + h.y, 0) / live.length;
    if (snap) this.cameras.main.centerOn(this.focus.x, this.focus.y - 30);
  }

  // Two living heroes may not walk further apart than LEASH: whoever moved away
  // this frame is held back (by the share they moved), so neither leaves the screen.
  private leash(before: number[]) {
    const live = this.livingHeroes;
    if (live.length < 2) return;
    const [a, b] = live;
    let excess = Math.abs(a.x - b.x) - LEASH;
    if (excess <= 0) return;
    const away = (h: Player, o: Player) => Math.max(0, (h.x - before[this.heroes.indexOf(h)]) * Math.sign(h.x - o.x));
    const ma = away(a, b), mb = away(b, a), sum = ma + mb;
    if (sum > 0) {
      const ka = Math.min(ma, (excess * ma) / sum), kb = Math.min(mb, (excess * mb) / sum);
      a.x -= Math.sign(a.x - b.x) * ka;
      b.x -= Math.sign(b.x - a.x) * kb;
      excess -= ka + kb;
    }
    if (excess > 0.5) {
      // pushed apart by something else (a knockback): both give way
      a.x -= Math.sign(a.x - b.x) * excess / 2;
      b.x -= Math.sign(b.x - a.x) * excess / 2;
    }
    for (const h of live) h.syncPosition();
  }

  // A hero who has just gone down: in co-op the other fights on; when no one is
  // left standing the run is over.
  private checkFallen() {
    for (const h of this.heroes) {
      if (!h.isDead() || this.fallen.has(h)) continue;
      this.fallen.add(h);
      if (this.livingHeroes.length === 0) {
        this.hud?.showDeath(this.run);
        continue;
      }
      // she leaves a soul; the other holds interact by it to bring her back
      this.souls.push(new Soul(this, h, (share, by) => this.raise(h, share, by)));
      const other = this.livingHeroes[0];
      const key = keyLabels(getParty()[other.who] ?? { kind: 'solo' }).interact;
      this.hud?.banner('warn', `${heroLook(h.who).name} has fallen`, `${heroLook(other.who).name}: hold ${key} by her soul to revive her`);
    }
  }

  // Is this hero standing by a fallen hero's soul (and so rooted while holding interact)?
  byASoul(p: Player) {
    return this.souls.some((s) => s.near(p));
  }

  private updateSouls(dt: number) {
    if (!this.livingHeroes.length) return;
    for (const s of [...this.souls]) s.update(dt, this.heroes);
  }

  // A fallen hero gets back up, with share of her health: a burst of light where
  // her soul was, a moment untouchable, her corner of the HUD lit again.
  raise(h: Player, share: number, by?: Player) {
    const soul = this.souls.find((s) => s.hero === h);
    if (soul) { soul.destroy(); this.souls = this.souls.filter((s) => s !== soul); }
    if (!h.isDead()) return;
    h.hp = Math.max(1, Math.round(h.maxHp * share));
    h.state = 'idle';
    h.stateT = 0;
    h.invuln = REVIVE.invuln;
    h.dim = 1;
    h.playAnim('idle', { loop: true, force: true });
    this.fallen.delete(h);
    const burst = this.add.particles(h.x, h.y - 40, 'tt_dot', {
      speed: { min: 50, max: 170 }, lifespan: { min: 400, max: 900 },
      scale: { start: 0.3, end: 0 }, tint: [0xa8f0ff, 0xffffff, 0xffe08a], blendMode: 'ADD', emitting: false,
    }).setDepth(h.y + 20);
    burst.explode(36);
    this.time.delayedCall(1000, () => burst.destroy());
    const flash = this.add.image(h.x, h.y - 30, 'tt_light').setTint(0xa8f0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(h.y + 19).setScale(0.3).setAlpha(0.95);
    this.tweens.add({ targets: flash, scale: 1.3, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
    const strong = share >= REVIVE.sweetHp;
    const name = heroLook(h.who).name;
    this.hud?.banner('good', strong ? `${name} rises, strong` : `${name} is back on her feet`, by ? `Revived by ${heroLook(by.who).name}` : undefined);
  }

  update(_time: number, deltaMs: number) {
    let dt = Math.min(deltaMs, 50) / 1000;
    // slow motion for the killing blow on a boss
    if (this.slow.left > 0) {
      this.slow.left -= dt;
      dt *= this.slow.k;
      if (this.slow.left <= 0) { this.tweens.timeScale = 1; this.anims.globalTimeScale = 1; }
    }
    this.checkFallen();
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0) this.anims.resumeAll();
      return;
    }

    const before = this.heroes.map((h) => h.x);
    for (const h of this.heroes) h.update(dt);
    this.leash(before);
    this.updateFocus();
    this.effects = this.effects.filter((f) => f(dt));
    this.updateChest();
    this.updateCamp();
    this.updateSouls(dt);
    for (const e of this.enemies) e.update(dt);
    this.separate();
    this.updateProjectiles(dt);
    this.shots.update(dt);
    this.updatePickups(dt);
    this.updateCoins(dt);
    this.updateFires(dt);
    if (!this.isBossRoom) this.updateWaves(dt);
    this.updateDark(dt);
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.world.update(this.cameras.main);
    if (this.livingHeroes.length && !this.isCamp) this.run.time += dt;
  }

  // ---- combat -----------------------------------------------------------

  inReach(attacker: { x: number; y: number; facing: number }, x: number, y: number, spec: AttackSpec) {
    const ahead = (x - attacker.x) * attacker.facing;
    if (spec.around ? Math.abs(x - attacker.x) > spec.range : ahead < -20 || ahead > spec.range) return false;
    return Math.abs(y - attacker.y) <= spec.depth;
  }

  resolveMelee(attacker: Fighter, spec: AttackSpec, targets: Fighter[]): number {
    return this.strike(attacker, attacker instanceof Player ? attacker : null, spec, targets, (x, y) => this.inReach(attacker, x, y, spec));
  }

  // A skill's effect, run every frame until it returns false.
  addEffect(f: (dt: number) => boolean) {
    this.effects.push(f);
  }

  // Every hit goes through here, whether a swing, a shot or a skill's area: inside
  // says which floor positions it reaches. A hero's hits (by) get that hero's gear
  // bonuses and effects and also break barrels and crates.
  strike(attacker: HitSource, by: Player | null, spec: AttackSpec, targets: Fighter[], inside: (x: number, y: number) => boolean, opts: StrikeOpts = {}): number {
    let hits = 0;
    const byPlayer = !!by;
    const fx = by?.stats.fx;
    this.striker = by;
    const { once, max = Infinity } = opts;
    for (const t of targets) {
      if (hits >= max) break;
      if (t.isDead() || once?.has(t)) continue;
      if (!inside(t.x, t.y)) continue;
      let dmg = spec.dmg;
      let crit = false;
      if (by && fx) {
        dmg *= by.stats.power * (1 + fx.damage);
        if (t.hp / t.maxHp < 0.3) dmg *= 1 + fx.execute;
        if (fx.crit > 0 && Math.random() < fx.crit) { dmg *= 2; crit = true; }
        dmg = Math.max(1, Math.round(dmg));
      }
      const dealt = spec.dot && t instanceof Enemy ? t.takeDot(dmg) : t.takeHit(dmg, attacker.x, spec.knock, !!spec.heavy);
      if (dealt < 0) continue;
      hits++;
      once?.add(t);
      if (t instanceof Enemy && !t.isDead()) {
        if (spec.stun) t.stun(spec.stun);
        if (spec.slow) t.slowT = Math.max(t.slowT, spec.slow);
      }
      if (by) {
        this.run.damage += dealt;
        this.onPlayerHit(by, t as Enemy, dealt);
      } else if (t instanceof Player && dealt > 0 && t.stats.fx.thorns > 0 && attacker instanceof Enemy) {
        const back = attacker.takeDot(t.stats.fx.thorns);
        if (back > 0) this.combatText(attacker, back, 'burn');
      }
      this.combatText(t, dealt, byPlayer ? (crit ? 'crit' : spec.heavy ? 'heavy' : 'hit') : 'hurt');
      this.hitSpark(t.x - attacker.facing * 12, t.y - t.visualHeight * 0.5, byPlayer ? 0xfff1c0 : 0xff6b5e);
    }
    if (by && fx && hits < max) {
      hits += this.smashProps(attacker, spec, inside, once);
      if (hits > 0 && spec.heavy && fx.burn > 0) this.burnGround(by, attacker.x + attacker.facing * (spec.around ? 0 : 40), attacker.y, fx.burn);
    }
    this.striker = null;
    if (hits > 0 && !spec.dot && !spec.quiet) {
      this.hitStop(spec.stop ?? (spec.heavy ? 85 : 45));
      if (spec.heavy) this.shake(110, 0.006);
    }
    return hits;
  }

  hitStop(ms: number) {
    this.freeze = ms / 1000;
    this.anims.pauseAll();
  }

  spawnBone(x: number, y: number, vx: number, dmg: number, reach: number) {
    const sprite = this.add.image(x, y - 30, 'ph_bone').setDepth(y + 11);
    const shadow = this.add.ellipse(x, y, 20, 6, 0x000000, 0.3).setDepth(1);
    this.projectiles.push({ sprite, shadow, x, y, vx, dmg, left: reach, dead: false });
  }

  private updateProjectiles(dt: number) {
    for (const b of this.projectiles) {
      b.x += b.vx * dt;
      b.left -= Math.abs(b.vx) * dt;
      b.sprite.setPosition(b.x, b.y - 30).setDepth(b.y + 11).setRotation(b.sprite.rotation + dt * 14);
      b.shadow.setPosition(b.x, b.y);
      for (const p of this.livingHeroes) {
        if (b.dead || Math.abs(p.x - b.x) >= 18 || Math.abs(p.y - b.y) >= 13) continue;
        const dealt = p.takeHit(b.dmg, b.x - Math.sign(b.vx) * 40, 140, false);
        if (dealt >= 0) {
          b.dead = true;
          if (dealt > 0) this.combatText(p, dealt, 'hurt');
        }
      }
      if (b.left <= 0) b.dead = true;
      if (b.dead) {
        this.tweens.add({ targets: [b.sprite, b.shadow], alpha: 0, duration: 120, onComplete: () => { b.sprite.destroy(); b.shadow.destroy(); } });
      }
    }
    this.projectiles = this.projectiles.filter((b) => !b.dead);
  }

  // Two bodies on the floor overlap when they are within an ellipse of each
  // other (wide, shallow: the floor is seen at an angle). Push b out of a;
  // share is how much of the push b takes (the player never gets pushed).
  private pushApart(a: Fighter, b: Fighter, rx: number, ry: number, share: number) {
    const nx = (b.x - a.x) / rx, ny = (b.y - a.y) / ry;
    const d = Math.hypot(nx, ny);
    if (d >= 1) return;
    const ux = d < 1e-4 ? (Math.random() < 0.5 ? -1 : 1) : nx / d, uy = d < 1e-4 ? 0 : ny / d;
    const amt = 1 - d;
    b.x += ux * rx * amt * share; b.y += uy * ry * amt * share;
    if (share < 1) { a.x -= ux * rx * amt * (1 - share); a.y -= uy * ry * amt * (1 - share); }
  }

  pushOut(f: { x: number; y: number }) {
    this.world?.pushOut(f);
  }

  // Keeps enemies from stacking on one spot or standing inside a hero, and the
  // two heroes from standing inside each other.
  private separate() {
    const live = this.livingHeroes;
    if (live.length === 2 && live.every((h) => h.state !== 'dodge')) {
      this.pushApart(live[0], live[1], 22, 9, 0.5);
      for (const h of live) h.clamp();
    }
    const list = this.enemies.filter((e) => !e.isDead());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const k = Math.max(a.body, b.body);
        this.pushApart(a, b, 26 * k, 11 * k, a.body > b.body ? 1 : b.body > a.body ? 0 : 0.5);
      }
      for (const p of live) if (p.state !== 'dodge') this.pushApart(a, p, 24 * a.body, 10 * a.body, a.body > 1 ? 1 : 0);
      a.clamp();
    }
  }

  onEnemyDied(e: Enemy) {
    this.slain++;
    this.run.kills++;
    this.earn(EMBERS.kill);
    this.spawnCoins(e.x, e.y, e.key === 'ghoul' ? Phaser.Math.Between(2, 4) : Phaser.Math.Between(3, 5));
    // life on kill heals whoever dealt the blow (the nearest hero, if no one's blow did it)
    const by = this.striker ?? (this.livingHeroes.length ? this.nearestHero(e.x, e.y) : null);
    if (by && by.stats.fx.lifeOnKill > 0) this.healPlayer(by, by.stats.fx.lifeOnKill);
    if (Math.random() < 0.25) {
      const sprite = this.add.image(e.x, e.y - 10, 'ph_orb').setDepth(e.y + 5).setScale(0.8);
      this.pickups.push({ sprite, x: e.x, y: e.y, t: 0, dead: false });
    }
  }

  private updatePickups(dt: number) {
    for (const o of this.pickups) {
      o.t += dt;
      o.sprite.setY(o.y - 10 - Math.sin(o.t * 4) * 3);
      const p = this.livingHeroes.find((h) => Math.abs(h.x - o.x) < 24 && Math.abs(h.y - o.y) < 16);
      if (p) {
        o.dead = true;
        const heal = Math.min(Math.round(15 * (1 + p.stats.fx.orbs)), p.maxHp - p.hp);
        p.hp += heal;
        if (heal > 0) this.combatText(p, heal, 'heal');
        o.sprite.destroy();
      }
    }
    this.pickups = this.pickups.filter((o) => !o.dead);
  }

  // Colour a character should be tinted where it stands: moonlight, warmer near fire.
  lightAt(x: number, y: number) {
    return this.world.lightAt(x, y);
  }

  // ---- waves and the exit ----------------------------------------------

  private updateWaves(dt: number) {
    if (!this.livingHeroes.length) return;
    if (this.gateOpen) {
      const ex = this.world.exit;
      // every living hero has to stand in the gate before it takes them through (a
      // fallen one comes along and gets up in the next room); until then it says who
      // it is waiting for
      const live = this.livingHeroes;
      const inGate = (h: Player) => Math.hypot(h.x - ex.x, (h.y - ex.y) * 1.6) < 46;
      const missing = live.filter((h) => !inGate(h));
      this.showGateWait(missing.length < live.length && missing.length ? missing[0] : null);
      if (!this.leaving && !missing.length) {
        this.leaving = true;
        const cam = this.cameras.main;
        if (this.isCamp) {
          // through the gate: the run begins, carrying only the chosen weapon
          cam.flash(250, 127, 252, 240);
          this.time.delayedCall(120, () => cam.fade(600, 0, 0, 0, true));
          cam.once('camerafadeoutcomplete', () => {
            const run = { ...newRun(), gear: { ...newGear(), weapon: this.run.gear.weapon } };
            if (this.heroes.length > 1) run.gear2 = { ...newGear(), weapon: gearOf(this.run, 1).weapon };
            this.scene.restart({ room: 1, run });
          });
          return;
        }
        cam.fadeOut(400);
        this.run.rooms++;
        cam.once('camerafadeoutcomplete', () => {
          // the living heal a little between rooms; the fallen get back up
          const hps = this.heroes.map((h) => (h.isDead() ? Math.round(h.maxHp * REJOIN) : Math.min(h.maxHp, h.hp + 20)));
          this.scene.restart({ room: this.room + 1, hps, run: this.run });
        });
      }
      return;
    }
    const alive = this.enemies.some((e) => !e.isDead());
    if (alive) return;
    this.waveDelay -= dt;
    if (this.waveDelay > 0) return;
    if (this.wave < this.waves.length) {
      this.spawnWave(this.waves[this.wave]);
      this.wave++;
      this.waveDelay = 1.0;
      if (this.wave > 1) this.hud?.banner('warn', `Wave ${this.wave} of ${this.waves.length}`);
    } else {
      this.gateOpen = true;
      this.world.openExit();
      this.hud?.banner('good', 'Room Cleared', 'The chest is unsealed');
      this.unlockChest();
      this.earn(EMBERS.room);
    }
  }

  // Over the gate while one hero stands in it and the other is still on the way.
  private showGateWait(waitingFor: Player | null) {
    const ex = this.world.exit;
    if (waitingFor && !this.gateWait) {
      this.gateWait = this.add.text(ex.x, ex.y - 78, '', { fontFamily: FONT.label, fontSize: '13px', color: '#f0e6d2', stroke: '#000', strokeThickness: 3, resolution: RES * 2 })
        .setOrigin(0.5).setDepth(19500).setAlpha(0);
    }
    const t = this.gateWait;
    if (!t) return;
    if (waitingFor) t.setText(`Waiting for ${heroLook(waitingFor.who).name}`);
    t.setAlpha(Phaser.Math.Linear(t.alpha, waitingFor && !this.leaving ? 1 : 0, 0.2)).setY(ex.y - 78 + Math.sin(this.time.now / 250) * 2);
  }

  private spawnWave(w: Wave) {
    const { viewW, roomW, groundTop, groundBottom } = WORLD;
    const left = this.cameras.main.worldView.x;
    const tier = 1 + 0.15 * (this.room - 1);
    const types: ('g' | 't')[] = [...Array(w.ghouls).fill('g'), ...Array(w.throwers).fill('t')];
    types.forEach((type, i) => {
      let x: number, y: number;
      if (i % 3 === 2) {
        // out of the trees at the back, somewhere in view
        x = Phaser.Math.Clamp(left + Phaser.Math.Between(120, viewW - 120), 60, roomW - 60);
        y = groundTop + 2;
      } else {
        let side = i % 2 === 0 ? 1 : -1;
        x = side > 0 ? left + viewW + 30 + i * 16 : left - 30 - i * 16;
        if (x < 20 || x > roomW - 20) { side = -side; x = side > 0 ? left + viewW + 30 + i * 16 : left - 30 - i * 16; }
        x = Phaser.Math.Clamp(x, 20, roomW - 20);
        y = Phaser.Math.Between(groundTop + 30, groundBottom - 20);
      }
      const e = this.toughen(type === 'g' ? new Ghoul(this, x, y, tier) : new BoneThrower(this, x, y, tier));
      e.appear = 0; // fades in
      this.enemies.push(e);
    });
  }


  // ---- gear effects -----------------------------------------------------------

  private healPlayer(p: Player, n: number) {
    if (p.isDead()) return;
    const heal = Math.min(n, p.maxHp - p.hp);
    if (heal <= 0) return;
    p.hp += heal;
    this.combatText(p, heal, 'heal');
  }

  private onPlayerHit(p: Player, t: Enemy, _dealt: number) {
    const fx = p.stats.fx;
    if (fx.lifeOnHit > 0) p.hp = Math.min(p.maxHp, p.hp + fx.lifeOnHit);
    if (fx.frost > 0 && !t.isDead()) t.slowT = Math.max(t.slowT, fx.frost);
    this.hitCount++;
    if (fx.storm > 0 && this.hitCount % 5 === 0) this.chainLightning(t, fx.storm);
  }

  // Called after a hero takes a hit: their armor's second wind, once a room.
  afterPlayerHurt(p: Player) {
    const sw = p.stats.fx.secondWind;
    if (sw > 0 && !p.secondWindUsed && p.hp > 0 && p.hp < p.maxHp * 0.3) {
      p.secondWindUsed = true;
      this.healPlayer(p, sw);
      const ring = this.add.ellipse(p.x, p.y, 30, 12).setStrokeStyle(3, 0x6dffa0, 1).setDepth(2);
      this.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    }
  }

  private chainLightning(from: Enemy, dmg: number) {
    const next = this.enemies
      .filter((e) => e !== from && !e.isDead() && Math.hypot(e.x - from.x, (e.y - from.y) * 1.6) < 220)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
    const to = next ?? from;
    const ax = from.x, ay = from.y - from.visualHeight * 0.6, bx = to.x, by = to.y - to.visualHeight * 0.6 - (next ? 0 : 120);
    const g = this.add.graphics().setDepth(19000).setBlendMode(Phaser.BlendModes.ADD);
    for (const [w, c] of [[5, 0x4a8aff], [2, 0xe8f6ff]] as const) {
      g.lineStyle(w, c, 1);
      g.beginPath(); g.moveTo(ax, ay);
      for (let i = 1; i < 6; i++) {
        const k = i / 6;
        g.lineTo(ax + (bx - ax) * k + (Math.random() - 0.5) * 18, ay + (by - ay) * k + (Math.random() - 0.5) * 18);
      }
      g.lineTo(bx, by); g.strokePath();
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    const dealt = to.takeDot(dmg);
    if (dealt > 0) { this.combatText(to, dealt, 'storm'); this.run.damage += dealt; }
  }

  // Burning ground where a heavy attack lands: it hurts foes standing in it.
  private burnGround(by: Player, x: number, y: number, dmg: number) {
    const objs: Phaser.GameObjects.Image[] = [];
    objs.push(this.add.image(x, y, 'fw_pool').setTint(0xff6a20).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1, 0.9).setAlpha(0.6).setDepth(0.5));
    for (let i = 0; i < 4; i++) {
      const fl = this.add.image(x + (i - 1.5) * 16 + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 10, 'tt_flame')
        .setOrigin(0.5, 0.92).setScale(0.12, 0.16).setTint(i % 2 ? 0xffa03a : 0xff5a14).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 2);
      this.tweens.add({ targets: fl, scaleY: 0.22, duration: 120 + Math.random() * 80, yoyo: true, repeat: -1 });
      objs.push(fl);
    }
    this.fires.push({ x, y, left: 3, tick: 0.25, dmg, by, objs });
  }

  private updateFires(dt: number) {
    for (const f of this.fires) {
      f.left -= dt;
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.5;
        this.striker = f.by;
        for (const e of this.enemies) {
          if (e.isDead() || ((e.x - f.x) / 46) ** 2 + ((e.y - f.y) / 18) ** 2 > 1) continue;
          const d = e.takeDot(f.dmg);
          if (d > 0) { this.combatText(e, d, 'burn'); this.run.damage += d; }
        }
        this.striker = null;
      }
      if (f.left <= 0) {
        this.tweens.add({ targets: f.objs, alpha: 0, duration: 300, onComplete: () => f.objs.forEach((o) => o.destroy()) });
      }
    }
    this.fires = this.fires.filter((f) => f.left > 0);
  }

  // ---- gold, barrels and the chest ------------------------------------------------

  private coinTexture() {
    hi(this, 'coin', 12, 12, (c) => {
      c.fillStyle = '#3a2204'; c.beginPath(); c.arc(6, 6, 5.6, 0, Math.PI * 2); c.fill();
      const g = c.createLinearGradient(0, 1, 0, 11);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f0b030'); g.addColorStop(1, '#b06a10');
      c.fillStyle = g; c.beginPath(); c.arc(6, 6, 4.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(120,70,8,0.8)'; c.lineWidth = 0.8; c.beginPath(); c.arc(6, 6, 3, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(4.4, 4.2, 1.1, 0, Math.PI * 2); c.fill();
    });
  }

  // Coins spill out with a bounce, then fly to the hero once close (or once the room is won).
  spawnCoins(x: number, y: number, n: number, value = 1) {
    this.coinTexture();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 70;
      const img = this.add.image(x, y, 'coin').setScale(0.5);
      this.coins.push({ img, x, y, z: 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 140 + Math.random() * 90, t: 0, value, dead: false });
    }
  }

  private updateCoins(dt: number) {
    const anyone = this.livingHeroes.length > 0;
    for (const c of this.coins) {
      c.t += dt;
      // gold is one purse: a coin flies to whichever hero is nearer
      const p = this.nearestHero(c.x, c.y);
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
      const pull = anyone && c.t > 0.45 && (d < 80 || this.gateOpen || !!this.boss?.isDead());
      if (pull) {
        const sp = 260 + c.t * 300;
        c.x += (dx / (d || 1)) * Math.min(d, sp * dt);
        c.y += (dy / (d || 1)) * Math.min(d, sp * dt);
        c.z += (14 - c.z) * Math.min(1, dt * 8);
        if (d < 8) {
          c.dead = true;
          this.run.gold += c.value;
          if (c.value) this.hud?.goldPulse();
          c.img.destroy();
          continue;
        }
      } else {
        c.vz -= 700 * dt;
        c.z += c.vz * dt;
        if (c.z <= 0) { c.z = 0; c.vz = Math.abs(c.vz) * 0.4; c.vx *= 0.6; c.vy *= 0.6; if (c.vz < 30) c.vz = 0; }
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.y = Phaser.Math.Clamp(c.y, WORLD.groundTop, WORLD.groundBottom);
      }
      c.img.setPosition(c.x, c.y - 4 - c.z).setDepth(c.y + 4).setScale(0.5 * Math.max(0.25, Math.abs(Math.cos(c.t * 9))), 0.5);
    }
    this.coins = this.coins.filter((c) => !c.dead);
  }

  // The player's swing also splinters barrels and crates in reach.
  private smashProps(attacker: HitSource, spec: AttackSpec, inside: (x: number, y: number) => boolean, once?: Set<object>): number {
    let n = 0;
    for (const b of this.world.breakables) {
      if (b.hp <= 0 || once?.has(b) || !inside(b.x, b.y)) continue;
      n++;
      once?.add(b);
      b.hp -= spec.heavy ? 2 : 1;
      this.splinters(b.x, b.y - 14, b.hp <= 0 ? 14 : 5);
      if (b.hp > 0) {
        this.tweens.add({ targets: b.img, x: b.x + attacker.facing * 3, duration: 50, yoyo: true, repeat: 1 });
      } else this.breakProp(b);
    }
    return n;
  }

  private breakProp(b: Breakable) {
    b.img.destroy();
    if (b.obstacle) {
      const i = this.world.obstacles.indexOf(b.obstacle);
      if (i >= 0) this.world.obstacles.splice(i, 1);
    }
    this.dust(b.x, b.y, 5);
    if (Math.random() < 0.65) this.spawnCoins(b.x, b.y, Phaser.Math.Between(1, 3));
    if (Math.random() < 0.1) {
      const sprite = this.add.image(b.x, b.y - 10, 'ph_orb').setDepth(b.y + 5).setScale(0.8);
      this.pickups.push({ sprite, x: b.x, y: b.y, t: 0, dead: false });
    }
  }

  private splinters(x: number, y: number, n: number) {
    const p = this.add.particles(x, y, 'tt_dot', {
      speed: { min: 60, max: 170 }, angle: { min: 200, max: 340 }, gravityY: 520, lifespan: { min: 350, max: 700 },
      scale: { start: 0.22, end: 0.08 }, tint: [0x8a5a2a, 0x6a4018, 0xb07a40], emitting: false,
    }).setDepth(y + 30);
    p.explode(n);
    this.time.delayedCall(900, () => p.destroy());
  }

  private chestTextures() {
    const wood = (c: CanvasRenderingContext2D, y0: number, y1: number) => {
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, '#8a5228'); g.addColorStop(1, '#4a2810');
      return g;
    };
    const gold = (c: CanvasRenderingContext2D, y0: number, y1: number) => {
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, '#fff1b8'); g.addColorStop(0.4, '#e0b04a'); g.addColorStop(0.7, '#8a5f1a'); g.addColorStop(1, '#f0cf78');
      return g;
    };
    const body = (c: CanvasRenderingContext2D) => {
      c.fillStyle = '#140a04'; c.beginPath(); c.roundRect(4, 34, 72, 40, 4); c.fill();
      c.fillStyle = wood(c, 36, 72); c.fillRect(7, 37, 66, 34);
      c.strokeStyle = 'rgba(30,14,4,0.6)'; c.lineWidth = 1;
      for (const y of [46, 56, 64]) { c.beginPath(); c.moveTo(8, y); c.lineTo(72, y); c.stroke(); }
      c.fillStyle = gold(c, 36, 72);
      for (const x of [12, 64]) c.fillRect(x, 36, 5, 36);
      c.fillRect(6, 68, 68, 4);
    };
    hi(this, 'chest', 80, 76, (c) => {
      body(c);
      // the lid, closed
      c.fillStyle = '#140a04'; c.beginPath(); c.moveTo(4, 38); c.lineTo(4, 22); c.quadraticCurveTo(40, 2, 76, 22); c.lineTo(76, 38); c.closePath(); c.fill();
      c.fillStyle = wood(c, 8, 36); c.beginPath(); c.moveTo(7, 35); c.lineTo(7, 23); c.quadraticCurveTo(40, 6, 73, 23); c.lineTo(73, 35); c.closePath(); c.fill();
      c.fillStyle = gold(c, 8, 38);
      for (const x of [12, 64]) { c.beginPath(); c.moveTo(x, 35); c.lineTo(x, 16 + Math.abs(x - 40) * 0.05); c.lineTo(x + 5, 15 + Math.abs(x - 40) * 0.05); c.lineTo(x + 5, 35); c.closePath(); c.fill(); }
      c.fillRect(6, 33, 68, 4);
      // lock plate
      c.fillStyle = '#140a04'; c.beginPath(); c.roundRect(33, 30, 14, 16, 3); c.fill();
      c.fillStyle = gold(c, 30, 46); c.beginPath(); c.roundRect(34.5, 31.5, 11, 13, 2); c.fill();
      c.fillStyle = '#2a1404'; c.beginPath(); c.arc(40, 37, 2, 0, Math.PI * 2); c.fill(); c.fillRect(39.2, 37, 1.6, 4);
    });
    hi(this, 'chest_open', 80, 76, (c) => {
      // the lid thrown back, light pouring out
      c.fillStyle = '#140a04'; c.beginPath(); c.moveTo(6, 30); c.lineTo(10, 4); c.lineTo(70, 4); c.lineTo(74, 30); c.closePath(); c.fill();
      c.fillStyle = wood(c, 4, 30); c.beginPath(); c.moveTo(9, 28); c.lineTo(12, 7); c.lineTo(68, 7); c.lineTo(71, 28); c.closePath(); c.fill();
      c.fillStyle = gold(c, 4, 30); c.fillRect(14, 7, 4, 21); c.fillRect(62, 7, 4, 21);
      body(c);
      const g = c.createLinearGradient(0, 30, 0, 44);
      g.addColorStop(0, '#fff6c8'); g.addColorStop(1, '#e0a020');
      c.fillStyle = g; c.fillRect(8, 33, 64, 8);
    });
  }

  // A stone arch with a gilded crown, the runes on its stones dark until the room is won.
  private shrineTextures() {
    const stone = (c: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, rot: number, seed: number) => {
      c.save(); c.translate(cx, cy); c.rotate(rot);
      const j = (k: number) => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1) * 2.2;
      c.beginPath();
      c.moveTo(-w / 2 + j(1), -h / 2 + j(2)); c.lineTo(w / 2 - j(3), -h / 2 + j(4)); c.lineTo(w / 2 + j(5) * 0.5, h / 2 - j(6)); c.lineTo(-w / 2 - j(7) * 0.5, h / 2 + j(8) * 0.3); c.closePath();
      c.fillStyle = '#0c1016'; c.lineWidth = 3; c.strokeStyle = '#0c1016'; c.stroke(); c.fill();
      const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, '#8496a8'); g.addColorStop(0.5, '#56687a'); g.addColorStop(1, '#344250');
      c.fillStyle = g; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-w / 2 + 3, -h / 2 + 2, w - 8, 2);
      c.restore();
    };
    const W = 150, H = 140, cx = W / 2, cy = 74, r = 56;
    hi(this, 'shrine', W, H, (c) => {
      // the dark recess inside the arch
      c.fillStyle = '#05070b';
      c.beginPath(); c.moveTo(cx - r + 14, H); c.lineTo(cx - r + 14, cy); c.arc(cx, cy, r - 14, Math.PI, 0); c.lineTo(cx + r - 14, H); c.closePath(); c.fill();
      // pillars and arch stones
      let k = 1;
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) stone(c, cx + side * (r - 3), cy + 14 + i * 19, 24, 18, (i % 2 ? 0.06 : -0.05) * side, k++);
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        stone(c, cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), 24, 18, a + Math.PI / 2, k++);
      }
      // the crown on top, and two gold shards beside it
      const gold = c.createLinearGradient(0, 2, 0, 30);
      gold.addColorStop(0, '#fff1b8'); gold.addColorStop(0.4, '#e0b04a'); gold.addColorStop(0.7, '#8a5f1a'); gold.addColorStop(1, '#f0cf78');
      const crown = () => { c.beginPath(); c.moveTo(cx - 18, 28); c.lineTo(cx - 20, 10); c.lineTo(cx - 9, 19); c.lineTo(cx, 3); c.lineTo(cx + 9, 19); c.lineTo(cx + 20, 10); c.lineTo(cx + 18, 28); c.closePath(); };
      c.lineWidth = 4; c.strokeStyle = '#140a04'; crown(); c.stroke();
      c.fillStyle = gold; crown(); c.fill();
      for (const s of [-1, 1]) {
        c.save(); c.translate(cx + s * 34, 24); c.rotate(s * 0.5);
        c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 0); c.lineTo(0, 9); c.lineTo(-6, 0); c.closePath();
        c.lineWidth = 3; c.strokeStyle = '#140a04'; c.stroke(); c.fillStyle = gold; c.fill();
        c.restore();
      }
    });
    hi(this, 'shrine_runes', W, H, (c) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.6; c.lineCap = 'round';
      const glyph = (x: number, y: number, n: number) => {
        c.beginPath();
        if (n % 3 === 0) { c.moveTo(x - 4, y - 4); c.lineTo(x, y + 4); c.lineTo(x + 4, y - 4); }
        else if (n % 3 === 1) { c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.moveTo(x - 4, y - 1); c.lineTo(x + 4, y + 2); }
        else { c.moveTo(x - 4, y); c.lineTo(x, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.closePath(); }
        c.stroke();
      };
      let n = 0;
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) glyph(cx + side * (r - 3), cy + 14 + i * 19, n++);
      for (let i = 1; i <= 5; i += 2) { const a = Math.PI + (i / 6) * Math.PI; glyph(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), n++); }
    });
  }

  // The chest waits at the back of the room from the start, sealed in its shrine.
  private placeChest() {
    this.chestTextures();
    this.shrineTextures();
    const x = WORLD.roomW / 2, y = WORLD.groundTop + 30;
    this.add.image(x, y + 2, 'shrine').setOrigin(0.5, 1).setScale(0.5).setDepth(y - 2);
    const runes = this.add.image(x, y + 2, 'shrine_runes').setOrigin(0.5, 1).setScale(0.5).setDepth(y - 1)
      .setTint(0x7ffcf0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12);
    const img = this.add.image(x, y + 4, 'chest').setOrigin(0.5, 0.94).setScale(0.5).setDepth(y).setTint(0x7a8494);
    this.world.obstacles.push({ x, y, rx: 48, ry: 12 });
    const prompt = this.add.container(x, y - 52).setDepth(19500).setAlpha(0);
    const cap = keycap(this, 0, 0, 'E');
    const label = this.add.text(16, 0, 'Open', { fontFamily: FONT.label, fontSize: '13px', color: '#f0e6d2', stroke: '#000', strokeThickness: 3, resolution: RES * 2 }).setOrigin(0, 0.5);
    cap.x = -label.width / 2 - 4; label.x = cap.x + 14;
    prompt.add([cap, label]);
    // in co-op each player gets their own random cards
    this.chest = { img, runes, x, y, prompt, locked: true, opened: false, items: rollChest(this.room), items2: getParty().length > 1 ? rollChest(this.room) : undefined };
  }

  // The room is won: light falls on the chest, the runes wake, the seal is gone.
  private unlockChest() {
    const c = this.chest;
    if (!c || !c.locked) return;
    c.locked = false;
    const beam = this.add.image(c.x, c.y - 150, 'tt_light').setTint(0xffe6a0).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.55, 4.2).setAlpha(0).setDepth(c.y + 2);
    const pool = this.add.image(c.x, c.y + 6, 'fw_pool').setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.8, 1.4).setAlpha(0).setDepth(0.5);
    this.tweens.add({ targets: beam, alpha: 0.85, duration: 350, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: beam, alpha: 0.38, duration: 900, delay: 350 });
    this.tweens.add({ targets: beam, scaleX: 0.5, duration: 1600, delay: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: pool, alpha: 0.55, duration: 600 });
    this.tweens.add({ targets: c.runes, alpha: 0.9, duration: 700, delay: 200 });
    this.tweens.add({ targets: c.runes, alpha: 0.55, duration: 1300, delay: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.addCounter({ from: 0, to: 1, duration: 600, onUpdate: (t) => {
      const v = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x7a8494), Phaser.Display.Color.ValueToColor(0xffffff), 1, t.getValue() ?? 0);
      if (!c.opened) c.img.setTint(Phaser.Display.Color.GetColor(v.r, v.g, v.b));
    } });
    // motes drifting up through the light
    this.add.particles(c.x, c.y - 10, 'tt_dot', {
      x: { min: -30, max: 30 }, speedY: { min: -40, max: -15 }, lifespan: { min: 1200, max: 2400 },
      scale: { start: 0.18, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffe08a, 0xffffff], blendMode: 'ADD', frequency: 110,
    }).setDepth(c.y + 3);
    this.world.lights.push({ x: c.x, y: c.y + 20, radius: 150, strength: 0.7 });
    this.shake(120, 0.003);
  }

  private chestNear(p: Player) {
    const c = this.chest;
    return !!c && !c.locked && !c.opened && !p.isDead() && Math.hypot(p.x - c.x, (p.y - c.y) * 1.6) < 72;
  }

  // Whoever presses interact by the chest opens it; in co-op both then choose.
  private updateChest() {
    const c = this.chest;
    if (!c) return;
    const near = this.heroes.filter((h) => this.chestNear(h));
    c.prompt.setAlpha(Phaser.Math.Linear(c.prompt.alpha, near.length ? 1 : 0, 0.2)).setY(c.y - 52 + Math.sin(this.time.now / 250) * 2);
    const by = near.find((h) => h.interact);
    if (by) this.openChest(by);
  }

  // Lid up, light out, then the HUD offers the three cards with the room paused.
  openChest(by: Player = this.player) {
    const c = this.chest;
    if (!c || c.opened) return;
    c.opened = true;
    c.img.setTexture('chest_open');
    const burst = this.add.particles(c.x, c.y - 24, 'tt_dot', {
      speed: { min: 40, max: 140 }, angle: { min: 220, max: 320 }, lifespan: { min: 500, max: 1000 },
      scale: { start: 0.3, end: 0 }, tint: [0xffe08a, 0xffffff, 0xffb040], blendMode: 'ADD', emitting: false,
    }).setDepth(c.y + 20);
    burst.explode(40);
    const glow = this.add.image(c.x, c.y - 30, 'tt_light').setTint(0xffd36a).setBlendMode(Phaser.BlendModes.ADD).setDepth(c.y + 19).setScale(0.3).setAlpha(0.9);
    this.tweens.add({ targets: glow, scale: 1.4, alpha: 0.35, duration: 500 });
    this.time.delayedCall(450, () => {
      const hud = this.hud;
      if (!hud || !this.livingHeroes.length) return;
      this.scene.pause();
      if (this.heroes.length < 2) {
        hud.openChest(c.items, gearOf(this.run, by.who), (it) => {
          this.equip(it, by);
          this.scene.resume();
        });
        return;
      }
      // one screen, a side for each player (a fallen hero chooses too); the room
      // resumes once both have taken a card
      const party = getParty();
      let left = this.heroes.length;
      hud.openChoice(this.heroes.map((h) => ({
        items: (h.who === 0 ? c.items : c.items2) ?? (c.items2 = rollChest(this.room)),
        gear: gearOf(this.run, h.who),
        device: party[h.who],
        name: heroLook(h.who).name,
        onPick: (it: Item) => {
          this.equip(it, h);
          if (--left === 0) this.scene.resume();
        },
      })));
    });
  }

  // Puts an item on a hero (player 1 unless said otherwise).
  equip(it: Item, p: Player = this.player) {
    const g = gearOf(this.run, p.who);
    if (it.cat === 'weapon') g.weapon = it;
    else if (it.cat === 'armor') g.armor = it;
    else g.trinkets.push(it);
    const before = p.maxHp;
    p.stats = gearStats(g);
    p.maxHp = 100 + p.stats.fx.maxHp;
    if (p.maxHp > before && !p.isDead()) p.hp += p.maxHp - before; // more health does not raise a fallen hero
    p.hp = Math.min(p.hp, p.maxHp);
    if (it.cat === 'weapon') p.arm();
  }

  // ---- the camp -----------------------------------------------------------

  private rackNear(p: Player) {
    const r = CAMP.rack;
    return !!this.camp && !p.isDead() && Math.hypot(p.x - r.x, (p.y - r.y) * 1.6) < 80;
  }

  private updateCamp() {
    if (!this.camp) return;
    const near = this.heroes.filter((h) => this.rackNear(h));
    this.camp.update(near.length > 0);
    const by = near.find((h) => h.interact);
    if (by) this.openRack(by);
  }

  // The rack opens as a store over the paused camp (HudScene.openRack); the pick
  // is remembered, and Esc walks away without changing anything.
  openRack(by: Player = this.player) {
    const hud = this.hud, camp = this.camp;
    if (!hud || !camp || hud.choosing) return;
    this.scene.pause();
    hud.openRack(camp.rackItems(), gearOf(this.run, by.who), (it) => {
      this.equip(it, by);
      if (it.kind) saveWeapon(it.kind, by.who);
      camp.chosen = true;
      this.scene.resume();
    }, () => this.scene.resume(),
    // in co-op it is the opener's turn, on their keys
    this.heroes.length > 1 ? { name: heroLook(by.who).name, device: getParty()[by.who] } : undefined);
  }

  // A foe as it comes into the room: tougher with two heroes.
  private toughen<T extends Fighter>(e: T): T {
    if (getParty().length > 1) {
      e.maxHp = Math.round(e.maxHp * COOP.foeHp);
      e.hp = e.maxHp;
    }
    return e;
  }

  // ---- the boss fight -----------------------------------------------------

  // A boss's blow on a hero, outside the usual melee check.
  hitPlayer(p: Player, from: Fighter, dmg: number, knock: number, heavy: boolean) {
    const dealt = p.takeHit(dmg, from.x, knock, heavy);
    if (dealt > 0) this.combatText(p, dealt, 'hurt');
  }

  summonMinions(n: number) {
    const b = this.boss;
    if (!b) return;
    const left = this.cameras.main.worldView.x;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Clamp(b.x + (i % 2 ? 1 : -1) * Phaser.Math.Between(90, 220), Math.max(60, left + 60), Math.min(WORLD.roomW - 60, left + WORLD.viewW - 60));
      const g = this.toughen(new Ghoul(this, x, WORLD.groundTop + 2, 1.2));
      g.appear = 0;
      this.enemies.push(g);
      const glow = this.add.image(x, WORLD.groundTop - 10, 'tt_light').setTint(0x6fffd8).setBlendMode(Phaser.BlendModes.ADD).setDepth(WORLD.groundTop + 20).setScale(0.2).setAlpha(0.9);
      this.tweens.add({ targets: glow, scale: 0.9, alpha: 0, duration: 700, onComplete: () => glow.destroy() });
    }
  }

  // A ring of force spreading over the floor where a slam lands.
  shockwave(x: number, y: number, tint: number) {
    const ring = this.add.ellipse(x, y, 40, 16).setStrokeStyle(3, tint, 0.95).setDepth(2);
    this.tweens.add({ targets: ring, scaleX: 4.2, scaleY: 4.2, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const flash = this.add.image(x, y - 10, 'tt_light').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 12).setScale(0.4).setAlpha(0.9);
    this.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    this.dust(x, y, 8);
  }

  // The trail of a big swing.
  sweepArc(x: number, y: number, facing: number, tint: number) {
    const g = this.add.graphics().setDepth(y + 60);
    g.lineStyle(7, tint, 0.85);
    g.beginPath();
    g.arc(x, y, 74, facing > 0 ? -1.3 : Math.PI + 1.3, facing > 0 ? 0.9 : Math.PI - 0.9, facing < 0);
    g.strokePath();
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath();
    g.arc(x, y, 74, facing > 0 ? -1.1 : Math.PI + 1.1, facing > 0 ? 0.8 : Math.PI - 0.8, facing < 0);
    g.strokePath();
    g.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  embers(x: number, y: number) {
    if (!this.emberFx) {
      this.emberFx = this.add.particles(0, 0, 'tt_dot', {
        speed: { min: 10, max: 50 }, angle: { min: 200, max: 340 }, lifespan: { min: 400, max: 900 },
        scale: { start: 0.22, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffd27a, 0xff8a3a, 0xff5a14],
        blendMode: 'ADD', emitting: false,
      }).setDepth(9500);
    }
    this.emberFx.emitParticleAt(x, y, 2);
  }

  // Phase two begins: the lantern bursts, the torches die, the dark closes in.
  lanternShatters(x: number, y: number) {
    this.cameras.main.flash(350, 160, 255, 225);
    this.shake(500, 0.012);
    const shards = this.add.particles(x, y, 'tt_dot', {
      speed: { min: 80, max: 260 }, angle: { min: 180, max: 360 }, gravityY: 400, lifespan: { min: 500, max: 1100 },
      scale: { start: 0.3, end: 0 }, tint: [0x9fffe8, 0x6fffd8, 0xffffff], blendMode: 'ADD', emitting: false,
    }).setDepth(19000);
    shards.explode(60);
    this.time.delayedCall(1500, () => shards.destroy());
    this.hud?.banner('warn', 'The lantern shatters', 'Stay in the light');
    this.time.delayedCall(500, () => this.world.extinguish());
    this.time.delayedCall(900, () => this.startDark());
  }

  private startDark() {
    if (this.dark || !this.boss || this.boss.isDead()) return;
    if (!this.textures.exists('boss_dark')) {
      canvas(this, 'boss_dark', 1024, 1024, (c) => {
        c.fillStyle = '#04060c';
        c.fillRect(0, 0, 1024, 1024);
        c.globalCompositeOperation = 'destination-out';
        const g = c.createRadialGradient(512, 512, 0, 512, 512, 100);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 1024, 1024);
      });
    }
    const cx = WORLD.roomW / 2, cy = (WORLD.groundTop + WORLD.groundBottom) / 2;
    // what is left of the lantern's flame burns on in the middle of the clearing
    const pool = this.add.image(cx, cy + 4, 'fw_pool').setTint(0x6fffd8).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2, 2).setAlpha(0).setDepth(0.5);
    const flames = ([[0x3fe8dc, 0.42, 0], [0x9ffff0, 0.3, -1], [0xffffff, 0.17, 1]] as const).map(([tint, f, dx]) => {
      const fl = this.add.image(cx + dx, cy, 'tt_flame').setOrigin(0.5, 0.92).setScale(f * 0.75, f).setTint(tint).setDepth(cy + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.tweens.add({ targets: fl, scaleY: f * 1.2, scaleX: f * 0.66, duration: 140 + Math.random() * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return fl;
    });
    this.tweens.add({ targets: [pool, ...flames], alpha: 1, duration: 800 });
    this.add.particles(cx, cy - 18, 'tt_dot', {
      x: { min: -5, max: 5 }, speedY: { min: -50, max: -20 }, lifespan: { min: 700, max: 1400 },
      scale: { start: 0.16, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0x9fffe8, 0x6fffd8], blendMode: 'ADD', frequency: 120,
    }).setDepth(cy + 2);
    this.world.lights.push({ x: cx, y: cy, radius: 260, strength: 0.75 });
    this.world.obstacles.push({ x: cx, y: cy, rx: 14, ry: 6 });

    const img = this.add.image(cx, cy, 'boss_dark').setDepth(15500).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 0.96, duration: 1400 });
    this.dark = { img, t: 0, r: DARK.startRadius, tick: DARK.tick, warned: false };
    this.updateDark(0);
  }

  // The circle of light shrinks; standing outside it hurts.
  private updateDark(dt: number) {
    const d = this.dark;
    if (!d) return;
    d.t += dt;
    if (!this.boss?.isDead()) d.r = Math.max(DARK.endRadius, DARK.startRadius - ((DARK.startRadius - DARK.endRadius) * d.t) / DARK.shrinkSeconds);
    const s = d.r / 80; // the hole in the texture is about 80 pixels across its soft edge
    d.img.setScale(s, s * DARK.squash);
    if (this.boss?.isDead() || this.cutscene) return;
    const out = this.livingHeroes.filter((p) => this.inDark(p.x, p.y));
    if (out.length) {
      d.tick -= dt;
      if (d.tick <= 0) {
        d.tick = DARK.tick;
        for (const p of out) {
          p.hp = Math.max(0, p.hp - DARK.damage);
          this.combatText(p, DARK.damage, 'hurt');
          if (p.hp <= 0) p.die();
        }
        if (!d.warned) { d.warned = true; this.hud?.banner('warn', 'The dark gnaws at you'); }
      }
    } else d.tick = Math.min(d.tick, DARK.tick);
  }

  inDark(x: number, y: number) {
    const d = this.dark;
    if (!d) return false;
    const cx = WORLD.roomW / 2, cy = (WORLD.groundTop + WORLD.groundBottom) / 2;
    return ((x - cx) / d.r) ** 2 + ((y - cy) / (d.r * DARK.squash)) ** 2 > 1;
  }

  get darkRadius() {
    return this.dark?.r ?? 0;
  }

  onBossDied(b: Warden) {
    this.run.rooms++;
    this.run.kills++;
    this.run.gold += 60; // his hoard, counted at once so the victory screen has it
    this.earn(EMBERS.boss);
    this.spawnCoins(b.x, b.y, 24, 0);
    // the killing blow in slow motion, then the light comes back
    this.slow = { k: 0.25, left: 1.6 };
    this.tweens.timeScale = 0.25;
    this.anims.globalTimeScale = 0.25;
    this.cameras.main.flash(500, 255, 250, 230);
    this.shake(300, 0.01);
    for (const e of this.enemies) if (e !== b && !e.isDead()) e.takeHit(999, e.x - 1, 0, false);
    if (this.dark) this.tweens.add({ targets: this.dark.img, alpha: 0, duration: 2200, delay: 400 });
    this.time.delayedCall(3000, () => { if (this.livingHeroes.length) this.hud?.showVictory(this.run); });
  }

  // ---- feedback --------------------------------------------------------

  // Little puffs of dust at someone's feet.
  dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const d = this.add.image(x + (Math.random() - 0.5) * 14, y - 2, 'fw_dust').setDepth(y + 1)
        .setTint(0x8a7a66).setAlpha(0.5).setScale(0.5 + Math.random() * 0.4);
      this.tweens.add({ targets: d, scale: d.scale * 2, alpha: 0, y: y - 8 - Math.random() * 6, duration: 420 + Math.random() * 200, onComplete: () => d.destroy() });
    }
  }

  shake(ms: number, intensity: number) {
    if (settings.screenShake) this.cameras.main.shake(ms, intensity);
  }

  // Floating combat text: your hits in white, heavy hits large and gold, damage
  // you take in red, heals in green. Each pops, then drifts up and away.
  combatText(on: Fighter, n: number, kind: 'hit' | 'heavy' | 'crit' | 'hurt' | 'heal' | 'burn' | 'storm') {
    if (!settings.damageNumbers && kind !== 'heal') return;
    const style = {
      hit: { size: 17, color: '#ffffff', pop: 1.5 },
      heavy: { size: 24, color: '#ffd100', pop: 1.9 },
      crit: { size: 28, color: '#ffd100', pop: 2.2 },
      hurt: { size: 17, color: '#ff3b2f', pop: 1.4 },
      heal: { size: 17, color: '#3cff3c', pop: 1.3 },
      burn: { size: 14, color: '#ff9a3a', pop: 1.2 },
      storm: { size: 18, color: '#9fd8ff', pop: 1.6 },
    }[kind];
    const x = on.x + (Math.random() - 0.5) * 16;
    const y = on.y - on.visualHeight - 4;
    const t = this.add.text(x, y, kind === 'heal' ? `+${n}` : kind === 'crit' ? `${n}!` : String(n), {
      fontFamily: FONT.head, fontSize: `${style.size}px`, fontStyle: '700', color: style.color,
      stroke: '#000000', strokeThickness: 4, resolution: RES * 1.5,
    }).setOrigin(0.5).setDepth(19000).setScale(style.pop);
    t.setShadow(0, 2, '#000', 2, true, true);
    const drift = kind === 'hurt' ? -18 : (Math.random() - 0.5) * 30;
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, x: x + drift, y: y - (kind === 'heavy' ? 46 : 36), duration: 900, delay: 120, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 350, delay: kind === 'heavy' ? 760 : 620, onComplete: () => t.destroy() });
  }

  // Embers for a deed: banked at once, and the HUD's counter glows.
  earn(n: number) {
    earnEmbers(this.run, n);
    this.hud?.emberPulse(n);
  }

  // A word over someone's head that rises and fades ("Reload").
  callout(on: Fighter, text: string, color = '#e8eef4') {
    const t = this.add.text(on.x, on.y - on.visualHeight - 8, text.toUpperCase(), {
      fontFamily: FONT.head, fontSize: '12px', fontStyle: '700', color, stroke: '#000000', strokeThickness: 3, resolution: RES * 1.5,
    }).setOrigin(0.5).setDepth(19000).setLetterSpacing(2);
    this.tweens.add({ targets: t, y: t.y - 22, duration: 700, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 250, delay: 550, onComplete: () => t.destroy() });
  }

  private hitSpark(x: number, y: number, color: number) {
    const s = this.add.circle(x, y, 6, color, 1).setDepth(19000);
    this.tweens.add({ targets: s, scale: 3.2, alpha: 0, duration: 160, onComplete: () => s.destroy() });
  }

  blockSpark(x: number, y: number) {
    const s = this.add.star(x, y, 6, 4, 14, 0x9fd0ff, 1).setDepth(19000);
    this.tweens.add({ targets: s, scale: 1.8, alpha: 0, angle: 60, duration: 200, onComplete: () => s.destroy() });
  }


}
