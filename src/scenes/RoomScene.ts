import Phaser from 'phaser';
import { WORLD } from '../config';
import { Player } from '../entities/Player';
import { BoneThrower, Enemy, Ghoul } from '../entities/Enemies';
import type { Fighter } from '../entities/Fighter';
import { buildBackground, type Background } from '../background';
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
  private bg!: Background;
  private gate!: Phaser.GameObjects.Container;
  private hud!: { bar: Phaser.GameObjects.Graphics; info: Phaser.GameObjects.Text; banner: Phaser.GameObjects.Text; dead: Phaser.GameObjects.Text };

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
    cam.setBounds(0, 0, roomW, viewH);
    this.bg = buildBackground(this);

    this.player = new Player(this, 180, (groundTop + groundBottom) / 2);
    if (this.startHp !== undefined) this.player.hp = this.startHp;
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.fadeIn(350);

    this.gate = this.buildGate(roomW - 80, (groundTop + groundBottom) / 2);
    this.gate.setVisible(false);

    const bar = this.add.graphics().setScrollFactor(0).setDepth(20000);
    const info = this.add.text(viewW - 16, 14, '', { fontFamily: FONT, fontSize: '18px', color: '#e8dcb5' })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(20000).setShadow(1, 1, '#000', 2);
    const banner = this.add.text(viewW / 2, 120, '', { fontFamily: FONT, fontSize: '34px', color: '#f3d27a' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20000).setShadow(2, 2, '#000', 4).setAlpha(0);
    const dead = this.add.text(viewW / 2, viewH / 2 - 40, '', { fontFamily: FONT, fontSize: '30px', color: '#ff9b8a', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20000).setShadow(2, 2, '#000', 4);
    this.add.text(16, viewH - 26, 'Move WASD / arrows   J light (x3 combo)   K heavy   Space dodge   L block   R restart   Esc menu', {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfc6a8',
    }).setScrollFactor(0).setDepth(20000).setAlpha(0.75).setShadow(1, 1, '#000', 2);
    this.hud = { bar, info, banner, dead };
    this.showBanner(`Blightwood, room ${this.room}`);

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
    this.bg.update(this.cameras.main);
    this.drawHud();
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
    if (this.player.isDead() && !this.hud.dead.text) this.onPlayerDied();
    return hits;
  }

  hitStop(ms: number) {
    this.freeze = ms / 1000;
    this.anims.pauseAll();
  }

  spawnBone(x: number, y: number, vx: number, dmg: number, reach: number) {
    const sprite = this.add.image(x, y - 50, 'ph_bone').setDepth(y + 11).setScale(1.3);
    const shadow = this.add.ellipse(x, y, 20, 6, 0x000000, 0.3).setDepth(1);
    this.projectiles.push({ sprite, shadow, x, y, vx, dmg, left: reach, dead: false });
  }

  private updateProjectiles(dt: number) {
    const p = this.player;
    for (const b of this.projectiles) {
      b.x += b.vx * dt;
      b.left -= Math.abs(b.vx) * dt;
      b.sprite.setPosition(b.x, b.y - 50).setRotation(b.sprite.rotation + dt * 14);
      b.shadow.setPosition(b.x, b.y);
      if (Math.abs(p.x - b.x) < 24 && Math.abs(p.y - b.y) < 18) {
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

  // Keeps enemies from stacking on one spot or standing inside the player.
  private separate() {
    const list = this.enemies.filter((e) => !e.isDead());
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 18) {
          const push = (40 - Math.abs(dx)) / 2;
          const s = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
          a.x -= s * push * 0.5;
          b.x += s * push * 0.5;
        }
      }
      const p = this.player;
      if (!p.isDead() && p.state !== 'dodge') {
        const dx = a.x - p.x;
        if (Math.abs(dx) < 34 && Math.abs(a.y - p.y) < 16) a.x = p.x + (dx === 0 ? 1 : Math.sign(dx)) * 34;
      }
      a.clamp();
    }
  }

  onEnemyDied(e: Enemy) {
    this.kills++;
    if (Math.random() < 0.25) {
      const sprite = this.add.image(e.x, e.y - 14, 'ph_orb').setDepth(e.y + 5);
      this.pickups.push({ sprite, x: e.x, y: e.y, t: 0, dead: false });
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const o of this.pickups) {
      o.t += dt;
      o.sprite.setY(o.y - 14 - Math.sin(o.t * 4) * 4);
      if (!p.isDead() && Math.abs(p.x - o.x) < 34 && Math.abs(p.y - o.y) < 22) {
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
    if (this.hud.dead.text) return;
    this.hud.dead.setText(`You fell in room ${this.room}.\nPress R to try again, Esc for the menu.`);
    this.hud.dead.setAlpha(0);
    this.tweens.add({ targets: this.hud.dead, alpha: 1, duration: 600, delay: 500 });
  }

  // ---- waves and the exit ----------------------------------------------

  private updateWaves(dt: number) {
    if (this.player.isDead()) return;
    if (this.gateOpen) {
      if (!this.leaving && this.player.x > WORLD.roomW - 120) {
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
      if (this.wave > 1) this.showBanner(`Wave ${this.wave} of ${this.waves.length}`);
    } else {
      this.gateOpen = true;
      this.gate.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: this.gate, alpha: 1, duration: 600 });
      this.showBanner('Room cleared! Head right');
    }
  }

  private spawnWave(w: Wave) {
    const { viewW, roomW, groundTop, groundBottom } = WORLD;
    const left = this.cameras.main.scrollX;
    const tier = 1 + 0.15 * (this.room - 1);
    const types: ('g' | 't')[] = [...Array(w.ghouls).fill('g'), ...Array(w.throwers).fill('t')];
    types.forEach((type, i) => {
      let side = i % 2 === 0 ? 1 : -1;
      let x = side > 0 ? left + viewW + 40 + i * 22 : left - 40 - i * 22;
      if (x < 40 || x > roomW - 40) { side = -side; x = side > 0 ? left + viewW + 40 + i * 22 : left - 40 - i * 22; }
      x = Phaser.Math.Clamp(x, 40, roomW - 40);
      const y = Phaser.Math.Between(groundTop + 10, groundBottom - 10);
      this.enemies.push(type === 'g' ? new Ghoul(this, x, y, tier) : new BoneThrower(this, x, y, tier));
    });
  }

  private buildGate(x: number, y: number) {
    const glow = this.add.ellipse(0, -70, 120, 170, 0xffb347, 0.18);
    const ring = this.add.ellipse(0, -70, 84, 140, 0xffd27a, 0.55);
    const core = this.add.ellipse(0, -70, 60, 112, 0x2a1408, 0.9);
    const c = this.add.container(x, y, [glow, ring, core]).setDepth(y - 60);
    this.tweens.add({ targets: [glow, ring], scaleX: 1.08, scaleY: 1.05, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    return c;
  }

  // ---- feedback --------------------------------------------------------

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

  private showBanner(text: string) {
    const b = this.hud.banner;
    this.tweens.killTweensOf(b);
    b.setText(text).setAlpha(0);
    this.tweens.chain({ targets: b, tweens: [{ alpha: 1, duration: 250 }, { alpha: 1, duration: 1400 }, { alpha: 0, duration: 500 }] });
  }

  private drawHud() {
    const g = this.hud.bar;
    const p = this.player;
    g.clear();
    g.fillStyle(0x000000, 0.55).fillRoundedRect(12, 12, 248, 26, 6);
    g.fillStyle(0x5b1a16, 1).fillRoundedRect(16, 16, 240, 18, 4);
    g.fillStyle(0xd0463a, 1).fillRoundedRect(16, 16, Math.max(0, 240 * (p.hp / p.maxHp)), 18, 4);
    g.fillStyle(0xffffff, 0.18).fillRect(18, 18, Math.max(0, 236 * (p.hp / p.maxHp)), 5);
    const waveText = this.gateOpen ? 'cleared' : `wave ${Math.max(1, this.wave)}/${this.waves.length}`;
    this.hud.info.setText(`Room ${this.room}   ${waveText}   kills ${this.kills}`);
  }
}
