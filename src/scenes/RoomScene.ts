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
import { shrineBonus } from '../shrine';
import { hi, keycap } from '../ui/kit';
import { Shots } from '../shots';
import type { Breakable } from '../blightwood';
import { shiftParallax, ZOOM } from '../ui/view';
import { FONT, RES } from '../ui/theme';
import { wavesMethods } from '../room/waves';
import { gearFxMethods } from '../room/gearFx';
import { lootMethods } from '../room/loot';
import { campMethods } from '../room/camp';
import { bossFightMethods } from '../room/bossFight';
import { feedbackMethods } from '../room/feedback';

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

export interface Coin { img: Phaser.GameObjects.Image; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; value: number; dead: boolean }
export interface Fire { x: number; y: number; left: number; tick: number; dmg: number; by: Player; objs: Phaser.GameObjects.Image[] }
export interface Chest {
  img: Phaser.GameObjects.Image; runes: Phaser.GameObjects.Image; x: number; y: number;
  prompt: Phaser.GameObjects.Container; locked: boolean; opened: boolean;
  items: Item[]; // player 1's cards
  items2?: Item[]; // player 2's, rolled apart, in co-op
}

export interface Wave { ghouls: number; throwers: number }

export interface Projectile {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; vx: number; dmg: number; left: number; dead: boolean;
}

export interface Pickup { sprite: Phaser.GameObjects.Image; x: number; y: number; t: number; dead: boolean }

// The farthest apart two heroes may stand, side to side, so both stay in view
// (the view's width less 140, 820 at 16:9: this leaves each a margin at the edge).
export const LEASH = WORLD.viewW - 140;
// A hero who fell comes back in the next room with this share of their health.
export const REJOIN = 0.3;

export class RoomScene extends Phaser.Scene {
  heroes: Player[] = []; // one in solo, two in co-op
  fallen = new Set<Player>(); // heroes already counted as down
  souls: Soul[] = []; // a fallen hero's, while the other can still revive her
  focus = { x: 0, y: 0 }; // what the camera follows: between the living heroes
  striker: Player | null = null; // whose blow is being dealt (for kill effects)
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  shots!: Shots; // the player's arrows and bolts
  effects: ((dt: number) => boolean)[] = []; // skills playing out
  pickups: Pickup[] = [];
  room = 1;
  waves: Wave[] = [];
  wave = 0; // waves started so far
  waveDelay = 0;
  gateOpen = false;
  leaving = false;
  freeze = 0;
  startHp: (number | undefined)[] = [];
  slain = 0; // in this room
  run: Run = newRun();
  coins: Coin[] = [];
  fires: Fire[] = [];
  chest: Chest | null = null;
  hitCount = 0; // for every-fifth-hit effects
  world!: Blightwood;
  boss: Warden | null = null;
  camp: Camp | null = null; // room 0, between runs
  dummy: Dummy | null = null;
  cutscene = false; // the player cannot act (boss introduction)
  intro = true;
  dark: { img: Phaser.GameObjects.Image; t: number; r: number; tick: number; warned: boolean } | null = null;
  slow = { k: 1, left: 0 };
  emberFx?: Phaser.GameObjects.Particles.ParticleEmitter;
  gateWait?: Phaser.GameObjects.Text; // "Waiting for ..." over the gate, in co-op

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
    return this.player?.stats ?? gearStats(this.run.gear, shrineBonus());
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

  makeWaves(r: number): Wave[] {
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
  get hud(): HudScene | null {
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
  playIntro(b: Warden) {
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
  leaveTo(go: () => void) {
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
  updateFocus(snap = false) {
    const live = this.livingHeroes.length ? this.livingHeroes : this.heroes;
    if (!live.length) return;
    this.focus.x = live.reduce((n, h) => n + h.x, 0) / live.length;
    this.focus.y = live.reduce((n, h) => n + h.y, 0) / live.length;
    if (snap) this.cameras.main.centerOn(this.focus.x, this.focus.y - 30);
  }

  // Two living heroes may not walk further apart than LEASH: whoever moved away
  // this frame is held back (by the share they moved), so neither leaves the screen.
  leash(before: number[]) {
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
  checkFallen() {
    for (const h of this.heroes) {
      if (!h.isDead() || this.fallen.has(h)) continue;
      // Undying at the shrine: once a run, each hero gets straight back up
      const und = h.stats.fx.undying;
      if (und > 0 && !this.run.risen?.includes(h.who)) {
        this.run.risen = [...(this.run.risen ?? []), h.who];
        this.raise(h, und, undefined, 'Undying');
        continue;
      }
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

  updateSouls(dt: number) {
    if (!this.livingHeroes.length) return;
    for (const s of [...this.souls]) s.update(dt, this.heroes);
  }

  // A fallen hero gets back up, with share of her health: a burst of light where
  // her soul was, a moment untouchable, her corner of the HUD lit again.
  raise(h: Player, share: number, by?: Player, why?: string) {
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
    if (why) this.hud?.banner('good', `${name} rises again`, why);
    else this.hud?.banner('good', strong ? `${name} rises, strong` : `${name} is back on her feet`, by ? `Revived by ${heroLook(by.who).name}` : undefined);
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

  updateProjectiles(dt: number) {
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
  pushApart(a: Fighter, b: Fighter, rx: number, ry: number, share: number) {
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
  separate() {
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

  updatePickups(dt: number) {
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


  // A foe as it comes into the room: tougher with two heroes.
  toughen<T extends Fighter>(e: T): T {
    if (getParty().length > 1) {
      e.maxHp = Math.round(e.maxHp * COOP.foeHp);
      e.hp = e.maxHp;
    }
    return e;
  }

  get darkRadius() {
    return this.dark?.r ?? 0;
  }
}

// The room's methods live in several files under src/room/ (waves, gear effects, loot,
// the camp, the boss fight, feedback); they are mixed in here, so callers still
// write scene.openChest() and so on, and each file reaches the room as `this`.
type WavesMethods = typeof wavesMethods;
type GearFxMethods = typeof gearFxMethods;
type LootMethods = typeof lootMethods;
type CampMethods = typeof campMethods;
type BossFightMethods = typeof bossFightMethods;
type FeedbackMethods = typeof feedbackMethods;
export interface RoomScene extends WavesMethods, GearFxMethods, LootMethods, CampMethods, BossFightMethods, FeedbackMethods {}
Object.assign(RoomScene.prototype, wavesMethods, gearFxMethods, lootMethods, campMethods, bossFightMethods, feedbackMethods);
