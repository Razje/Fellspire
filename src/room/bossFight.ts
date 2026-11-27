// The Warden's glade: his minions, slams, sweeps, the lantern and the darkness.
// Mixed into RoomScene (see the end of scenes/RoomScene.ts), so `this` is the room
// and every method here is called as scene.<method>().
import Phaser from 'phaser';
import { DARK, WORLD } from '../config';
import { Player } from '../entities/Player';
import { Ghoul } from '../entities/Enemies';
import { Warden } from '../entities/Warden';
import type { Fighter } from '../entities/Fighter';
import { canvas } from '../titleArt';
import { EMBERS } from '../embers';
import type { RoomScene } from '../scenes/RoomScene';

export const bossFightMethods = {
  // A boss's blow on a hero, outside the usual melee check.
  hitPlayer(this: RoomScene, p: Player, from: Fighter, dmg: number, knock: number, heavy: boolean): void {
    const dealt = p.takeHit(dmg, from.x, knock, heavy);
    if (dealt > 0) this.combatText(p, dealt, 'hurt');
  },

  summonMinions(this: RoomScene, n: number): void {
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
  },

  // A ring of force spreading over the floor where a slam lands.
  shockwave(this: RoomScene, x: number, y: number, tint: number): void {
    const ring = this.add.ellipse(x, y, 40, 16).setStrokeStyle(3, tint, 0.95).setDepth(2);
    this.tweens.add({ targets: ring, scaleX: 4.2, scaleY: 4.2, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const flash = this.add.image(x, y - 10, 'tt_light').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 12).setScale(0.4).setAlpha(0.9);
    this.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    this.dust(x, y, 8);
  },

  // The trail of a big swing.
  sweepArc(this: RoomScene, x: number, y: number, facing: number, tint: number): void {
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
  },

  embers(this: RoomScene, x: number, y: number): void {
    if (!this.emberFx) {
      this.emberFx = this.add.particles(0, 0, 'tt_dot', {
        speed: { min: 10, max: 50 }, angle: { min: 200, max: 340 }, lifespan: { min: 400, max: 900 },
        scale: { start: 0.22, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffd27a, 0xff8a3a, 0xff5a14],
        blendMode: 'ADD', emitting: false,
      }).setDepth(9500);
    }
    this.emberFx.emitParticleAt(x, y, 2);
  },

  // Phase two begins: the lantern bursts, the torches die, the dark closes in.
  lanternShatters(this: RoomScene, x: number, y: number): void {
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
  },

  startDark(this: RoomScene): void {
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
  },

  // The circle of light shrinks; standing outside it hurts.
  updateDark(this: RoomScene, dt: number): void {
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
  },

  inDark(this: RoomScene, x: number, y: number): boolean {
    const d = this.dark;
    if (!d) return false;
    const cx = WORLD.roomW / 2, cy = (WORLD.groundTop + WORLD.groundBottom) / 2;
    return ((x - cx) / d.r) ** 2 + ((y - cy) / (d.r * DARK.squash)) ** 2 > 1;
  },

  onBossDied(this: RoomScene, b: Warden): void {
    this.run.rooms++;
    this.run.kills++;
    this.run.gold += this.moreGold(60); // his hoard, counted at once so the victory screen has it
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
    // the last area's boss wins the run; any other opens his glade's gates to the next areas
    this.time.delayedCall(3000, () => {
      if (!this.livingHeroes.length) return;
      if (!this.gates.length) { this.hud?.showVictory(this.run); return; }
      this.openGates();
      this.hud?.banner('good', `${this.area.boss.name} falls`, this.gates.length > 1 ? 'Two roads lead on. Choose a gate' : 'The road leads on');
    });
  },
};
