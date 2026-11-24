import Phaser from 'phaser';
import { DARK, WORLD, ZONE } from '../config';
import { Player } from '../entities/Player';
import { BoneThrower, Enemy, Ghoul } from '../entities/Enemies';
import { Warden } from '../entities/Warden';
import type { Fighter } from '../entities/Fighter';
import { buildBlightwood, type Blightwood } from '../blightwood';
import { canvas, makeTitleTextures } from '../titleArt';
import { settings } from '../settings';
import type { Action, HudScene, RunStats } from './HudScene';
import { shiftParallax, ZOOM } from '../ui/view';
import { FONT, RES } from '../ui/theme';

export interface AttackSpec {
  dmg: number;
  range: number; // reach in front of the attacker
  depth: number; // how far up or down the ground strip it still connects
  knock: number;
  heavy?: boolean;
}

interface Wave { ghouls: number; throwers: number }

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; vx: number; dmg: number; left: number; dead: boolean;
}

interface Pickup { sprite: Phaser.GameObjects.Image; x: number; y: number; t: number; dead: boolean }

export class RoomScene extends Phaser.Scene {
  player!: Player;
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private room = 1;
  private waves: Wave[] = [];
  wave = 0; // waves started so far
  private waveDelay = 0;
  gateOpen = false;
  private leaving = false;
  private freeze = 0;
  private startHp?: number;
  slain = 0; // in this room
  run: RunStats = { rooms: 0, kills: 0, damage: 0, time: 0 };
  private world!: Blightwood;
  boss: Warden | null = null;
  cutscene = false; // the player cannot act (boss introduction)
  private intro = true;
  private dark: { img: Phaser.GameObjects.Image; t: number; r: number; tick: number; warned: boolean } | null = null;
  private slow = { k: 1, left: 0 };
  private emberFx?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('room');
  }

  // Phaser reuses the scene object on restart, so all state is reset here.
  init(data: { room?: number; hp?: number; run?: RunStats; intro?: boolean }) {
    this.room = data.room ?? 1;
    this.intro = data.intro ?? true;
    this.boss = null;
    this.cutscene = false;
    this.dark = null;
    this.slow = { k: 1, left: 0 };
    this.emberFx = undefined;
    this.startHp = data.hp;
    this.run = data.run ? { ...data.run } : { rooms: 0, kills: 0, damage: 0, time: 0 };
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.wave = 0;
    this.waveDelay = 1.2;
    this.gateOpen = false;
    this.leaving = false;
    this.freeze = 0;
    this.slain = 0;
    this.waves = this.makeWaves(this.room);
  }

  get isBossRoom() {
    return this.room === ZONE.bossRoom;
  }

  private makeWaves(r: number): Wave[] {
    if (r === ZONE.bossRoom) return [];
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
    this.world = buildBlightwood(this, { boss: this.isBossRoom });
    shiftParallax(this);

    this.player = new Player(this, 150, 470);
    if (this.startHp !== undefined) this.player.hp = this.startHp;
    // follow the body, not the feet, and lag a touch so movement reads
    cam.startFollow(this.player.sprite, true, 0.1, 0.1, 0, 30);
    cam.fadeIn(350);

    if (this.isBossRoom) {
      const b = new Warden(this, roomW / 2 + 260, (WORLD.groundTop + WORLD.groundBottom) / 2);
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
    this.time.delayedCall(4500, () => cam.pan(this.player.x, this.player.y - 30, 800, 'Sine.easeInOut'));
    this.time.delayedCall(5350, () => {
      cam.startFollow(this.player.sprite, true, 0.1, 0.1, 0, 30);
      this.cutscene = false;
      b.wake();
    });
  }

  canPause() {
    return !this.leaving && !this.player.isDead();
  }

  restartRun() {
    this.leaveTo(() => this.scene.restart({ room: 1 }));
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

  onPlayerAction(a: Action) {
    this.hud?.used(a);
  }

  update(_time: number, deltaMs: number) {
    let dt = Math.min(deltaMs, 50) / 1000;
    // slow motion for the killing blow on a boss
    if (this.slow.left > 0) {
      this.slow.left -= dt;
      dt *= this.slow.k;
      if (this.slow.left <= 0) { this.tweens.timeScale = 1; this.anims.globalTimeScale = 1; }
    }
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0) this.anims.resumeAll();
      return;
    }

    this.player.update(dt);
    for (const e of this.enemies) e.update(dt);
    this.separate();
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    if (!this.isBossRoom) this.updateWaves(dt);
    this.updateDark(dt);
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.world.update(this.cameras.main);
    if (!this.player.isDead()) this.run.time += dt;
  }

  // ---- combat -----------------------------------------------------------

  resolveMelee(attacker: Fighter, spec: AttackSpec, targets: Fighter[]): number {
    let hits = 0;
    for (const t of targets) {
      if (t.isDead()) continue;
      const ahead = (t.x - attacker.x) * attacker.facing;
      if (ahead < -20 || ahead > spec.range) continue;
      if (Math.abs(t.y - attacker.y) > spec.depth) continue;
      const dealt = t.takeHit(spec.dmg, attacker.x, spec.knock, !!spec.heavy);
      if (dealt < 0) continue;
      hits++;
      const byPlayer = attacker === this.player;
      if (byPlayer) this.run.damage += dealt;
      this.combatText(t, dealt, byPlayer ? (spec.heavy ? 'heavy' : 'hit') : 'hurt');
      this.hitSpark(t.x - attacker.facing * 12, t.y - t.visualHeight * 0.5, byPlayer ? 0xfff1c0 : 0xff6b5e);
    }
    if (hits > 0) {
      this.hitStop(spec.heavy ? 85 : 45);
      if (spec.heavy) this.shake(110, 0.006);
    }
    if (this.player.isDead()) this.onPlayerDied();
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
    const p = this.player;
    for (const b of this.projectiles) {
      b.x += b.vx * dt;
      b.left -= Math.abs(b.vx) * dt;
      b.sprite.setPosition(b.x, b.y - 30).setDepth(b.y + 11).setRotation(b.sprite.rotation + dt * 14);
      b.shadow.setPosition(b.x, b.y);
      if (Math.abs(p.x - b.x) < 18 && Math.abs(p.y - b.y) < 13) {
        const dealt = p.takeHit(b.dmg, b.x - Math.sign(b.vx) * 40, 140, false);
        if (dealt >= 0) {
          b.dead = true;
          if (dealt > 0) this.combatText(p, dealt, 'hurt');
          if (p.isDead()) this.onPlayerDied();
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

  // Keeps enemies from stacking on one spot or standing inside the player.
  private separate() {
    const list = this.enemies.filter((e) => !e.isDead());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const k = Math.max(a.body, b.body);
        this.pushApart(a, b, 26 * k, 11 * k, a.body > b.body ? 1 : b.body > a.body ? 0 : 0.5);
      }
      const p = this.player;
      if (!p.isDead() && p.state !== 'dodge') this.pushApart(a, p, 24 * a.body, 10 * a.body, a.body > 1 ? 1 : 0);
      a.clamp();
    }
  }

  onEnemyDied(e: Enemy) {
    this.slain++;
    this.run.kills++;
    if (Math.random() < 0.25) {
      const sprite = this.add.image(e.x, e.y - 10, 'ph_orb').setDepth(e.y + 5).setScale(0.8);
      this.pickups.push({ sprite, x: e.x, y: e.y, t: 0, dead: false });
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const o of this.pickups) {
      o.t += dt;
      o.sprite.setY(o.y - 10 - Math.sin(o.t * 4) * 3);
      if (!p.isDead() && Math.abs(p.x - o.x) < 24 && Math.abs(p.y - o.y) < 16) {
        o.dead = true;
        const heal = Math.min(15, p.maxHp - p.hp);
        p.hp += heal;
        if (heal > 0) this.combatText(p, heal, 'heal');
        o.sprite.destroy();
      }
    }
    this.pickups = this.pickups.filter((o) => !o.dead);
  }

  private onPlayerDied() {
    this.hud?.showDeath(this.run);
  }

  // Colour a character should be tinted where it stands: moonlight, warmer near fire.
  lightAt(x: number, y: number) {
    return this.world.lightAt(x, y);
  }

  // ---- waves and the exit ----------------------------------------------

  private updateWaves(dt: number) {
    if (this.player.isDead()) return;
    if (this.gateOpen) {
      const ex = this.world.exit;
      if (!this.leaving && Math.hypot(this.player.x - ex.x, (this.player.y - ex.y) * 1.6) < 46) {
        this.leaving = true;
        this.cameras.main.fadeOut(400);
        this.run.rooms++;
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.restart({ room: this.room + 1, hp: Math.min(this.player.maxHp, this.player.hp + 20), run: this.run });
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
      this.hud?.banner('good', 'Room Cleared', 'The rune gate has opened');
    }
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
      const e = type === 'g' ? new Ghoul(this, x, y, tier) : new BoneThrower(this, x, y, tier);
      e.appear = 0; // fades in
      this.enemies.push(e);
    });
  }


  // ---- the boss fight -----------------------------------------------------

  // A boss's blow on the player, outside the usual melee check.
  hitPlayer(from: Fighter, dmg: number, knock: number, heavy: boolean) {
    const p = this.player;
    const dealt = p.takeHit(dmg, from.x, knock, heavy);
    if (dealt > 0) this.combatText(p, dealt, 'hurt');
    if (p.isDead()) this.onPlayerDied();
  }

  summonMinions(n: number) {
    const b = this.boss;
    if (!b) return;
    const left = this.cameras.main.worldView.x;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Clamp(b.x + (i % 2 ? 1 : -1) * Phaser.Math.Between(90, 220), Math.max(60, left + 60), Math.min(WORLD.roomW - 60, left + WORLD.viewW - 60));
      const g = new Ghoul(this, x, WORLD.groundTop + 2, 1.2);
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
    const p = this.player;
    if (p.isDead() || this.boss?.isDead() || this.cutscene) return;
    if (this.inDark(p.x, p.y)) {
      d.tick -= dt;
      if (d.tick <= 0) {
        d.tick = DARK.tick;
        p.hp = Math.max(0, p.hp - DARK.damage);
        this.combatText(p, DARK.damage, 'hurt');
        if (!d.warned) { d.warned = true; this.hud?.banner('warn', 'The dark gnaws at you'); }
        if (p.hp <= 0) { p.die(); this.onPlayerDied(); }
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
    // the killing blow in slow motion, then the light comes back
    this.slow = { k: 0.25, left: 1.6 };
    this.tweens.timeScale = 0.25;
    this.anims.globalTimeScale = 0.25;
    this.cameras.main.flash(500, 255, 250, 230);
    this.shake(300, 0.01);
    for (const e of this.enemies) if (e !== b && !e.isDead()) e.takeHit(999, e.x - 1, 0, false);
    if (this.dark) this.tweens.add({ targets: this.dark.img, alpha: 0, duration: 2200, delay: 400 });
    this.time.delayedCall(3000, () => { if (!this.player.isDead()) this.hud?.showVictory(this.run); });
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
  combatText(on: Fighter, n: number, kind: 'hit' | 'heavy' | 'hurt' | 'heal') {
    if (!settings.damageNumbers && kind !== 'heal') return;
    const style = {
      hit: { size: 17, color: '#ffffff', pop: 1.5 },
      heavy: { size: 24, color: '#ffd100', pop: 1.9 },
      hurt: { size: 17, color: '#ff3b2f', pop: 1.4 },
      heal: { size: 17, color: '#3cff3c', pop: 1.3 },
    }[kind];
    const x = on.x + (Math.random() - 0.5) * 16;
    const y = on.y - on.visualHeight - 4;
    const t = this.add.text(x, y, kind === 'heal' ? `+${n}` : String(n), {
      fontFamily: FONT.head, fontSize: `${style.size}px`, fontStyle: '700', color: style.color,
      stroke: '#000000', strokeThickness: 4, resolution: RES * 1.5,
    }).setOrigin(0.5).setDepth(19000).setScale(style.pop);
    t.setShadow(0, 2, '#000', 2, true, true);
    const drift = kind === 'hurt' ? -18 : (Math.random() - 0.5) * 30;
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, x: x + drift, y: y - (kind === 'heavy' ? 46 : 36), duration: 900, delay: 120, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 350, delay: kind === 'heavy' ? 760 : 620, onComplete: () => t.destroy() });
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
