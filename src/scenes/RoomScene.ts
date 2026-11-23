import Phaser from 'phaser';
import { WORLD } from '../config';
import { Player } from '../entities/Player';
import { BoneThrower, Enemy, Ghoul } from '../entities/Enemies';
import type { Fighter } from '../entities/Fighter';
import { buildBlightwood, type Blightwood } from '../blightwood';
import { makeTitleTextures } from '../titleArt';
import { Hud } from '../hud';
import { settings } from '../settings';

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

const FONT = '"Cinzel", Georgia, serif';

export class RoomScene extends Phaser.Scene {
  player!: Player;
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private room = 1;
  private waves: Wave[] = [];
  private wave = 0;
  private waveDelay = 0;
  private gateOpen = false;
  private leaving = false;
  private freeze = 0;
  private startHp?: number;
  private kills = 0;
  private world!: Blightwood;
  private hud!: Hud;

  constructor() {
    super('room');
  }

  // Phaser reuses the scene object on restart, so all state is reset here.
  init(data: { room?: number; hp?: number }) {
    this.room = data.room ?? 1;
    this.startHp = data.hp;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.wave = 0;
    this.waveDelay = 1.2;
    this.gateOpen = false;
    this.leaving = false;
    this.freeze = 0;
    this.kills = 0;
    this.waves = this.makeWaves(this.room);
  }

  private makeWaves(r: number): Wave[] {
    const count = Math.min(2 + r, 4);
    return Array.from({ length: count }, (_, w) => ({
      ghouls: Math.min(2 + Math.floor(r / 2) + w, 6),
      throwers: r === 1 && w === 0 ? 0 : Math.min(1 + Math.floor((r + w) / 3), 3),
    }));
  }

  create() {
    const { viewW, viewH, roomW, groundTop, groundBottom } = WORLD;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, roomW, WORLD.roomH);
    if (!this.textures.exists('tt_sky')) makeTitleTextures(this);
    this.world = buildBlightwood(this);

    this.player = new Player(this, 150, 470);
    if (this.startHp !== undefined) this.player.hp = this.startHp;
    // follow the body, not the feet, and lag a touch so movement reads
    cam.startFollow(this.player.sprite, true, 0.1, 0.1, 0, 30);
    cam.fadeIn(350);

    this.hud = new Hud(this, this.room, this.waves.length);
    this.hud.showBanner(`The Blightwood  ·  Room ${this.room}`);

    this.input.keyboard!.on('keydown-R', () => this.scene.restart({ room: 1 }));
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.leaving) return;
      this.leaving = true;
      this.cameras.main.fadeOut(400);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('menu'));
    });
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
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
    this.updateWaves(dt);
    this.enemies = this.enemies.filter((e) => !e.removed);
    const cam = this.cameras.main;
    this.world.update(cam);
    this.hud.update(this.player.hp, this.player.maxHp, this.wave, this.gateOpen, dt);
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
      this.floatText(t.x, t.y - t.visualHeight - 6, String(dealt), byPlayer ? '#ffe08a' : '#ff6b5e');
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
          if (dealt > 0) this.floatText(p.x, p.y - p.visualHeight - 6, String(dealt), '#ff6b5e');
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
        this.pushApart(a, b, 26, 11, 0.5);
      }
      const p = this.player;
      if (!p.isDead() && p.state !== 'dodge') this.pushApart(p, a, 24, 10, 1);
      a.clamp();
    }
  }

  onEnemyDied(e: Enemy) {
    this.kills++;
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
        this.floatText(p.x, p.y - p.visualHeight - 6, `+${heal}`, '#6dffa0');
        o.sprite.destroy();
      }
    }
    this.pickups = this.pickups.filter((o) => !o.dead);
  }

  private onPlayerDied() {
    this.hud.showDeath(this.room);
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
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.restart({ room: this.room + 1, hp: Math.min(this.player.maxHp, this.player.hp + 20) });
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
      if (this.wave > 1) this.hud.showBanner(`Wave ${this.wave} of ${this.waves.length}`);
    } else {
      this.gateOpen = true;
      this.world.openExit();
      this.hud.showBanner('Room cleared  ·  The rune gate opens');
    }
  }

  private spawnWave(w: Wave) {
    const { viewW, roomW, groundTop, groundBottom } = WORLD;
    const left = this.cameras.main.scrollX;
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

  floatText(x: number, y: number, text: string, color: string) {
    if (!settings.damageNumbers && /^\d+$/.test(text)) return;
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: '20px', color, fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(19000).setStroke('#000', 4);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
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
