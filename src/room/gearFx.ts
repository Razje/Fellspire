// Gear effects in a fight: healing, chain lightning, burning ground.
// Mixed into RoomScene (see the end of scenes/RoomScene.ts), so `this` is the room
// and every method here is called as scene.<method>().
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemies';
import type { RoomScene } from '../scenes/RoomScene';

export const gearFxMethods = {
  healPlayer(this: RoomScene, p: Player, n: number): void {
    if (p.isDead()) return;
    const heal = Math.min(n, p.maxHp - p.hp);
    if (heal <= 0) return;
    p.hp += heal;
    this.combatText(p, heal, 'heal');
  },

  onPlayerHit(this: RoomScene, p: Player, t: Enemy, _dealt: number): void {
    const fx = p.stats.fx;
    if (fx.lifeOnHit > 0) p.hp = Math.min(p.maxHp, p.hp + fx.lifeOnHit);
    if (fx.frost > 0 && !t.isDead()) t.slowT = Math.max(t.slowT, fx.frost);
    this.hitCount++;
    if (fx.storm > 0 && this.hitCount % 5 === 0) this.chainLightning(t, fx.storm);
  },

  // Called after a hero takes a hit: their armor's second wind, once a room.
  afterPlayerHurt(this: RoomScene, p: Player): void {
    const sw = p.stats.fx.secondWind;
    if (sw > 0 && !p.secondWindUsed && p.hp > 0 && p.hp < p.maxHp * 0.3) {
      p.secondWindUsed = true;
      this.healPlayer(p, sw);
      const ring = this.add.ellipse(p.x, p.y, 30, 12).setStrokeStyle(3, 0x6dffa0, 1).setDepth(2);
      this.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    }
  },

  chainLightning(this: RoomScene, from: Enemy, dmg: number): void {
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
  },

  // Burning ground where a heavy attack lands: it hurts foes standing in it.
  burnGround(this: RoomScene, by: Player, x: number, y: number, dmg: number): void {
    const objs: Phaser.GameObjects.Image[] = [];
    objs.push(this.add.image(x, y, 'fw_pool').setTint(0xff6a20).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1, 0.9).setAlpha(0.6).setDepth(0.5));
    for (let i = 0; i < 4; i++) {
      const fl = this.add.image(x + (i - 1.5) * 16 + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 10, 'tt_flame')
        .setOrigin(0.5, 0.92).setScale(0.12, 0.16).setTint(i % 2 ? 0xffa03a : 0xff5a14).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 2);
      this.tweens.add({ targets: fl, scaleY: 0.22, duration: 120 + Math.random() * 80, yoyo: true, repeat: -1 });
      objs.push(fl);
    }
    this.fires.push({ x, y, left: 3, tick: 0.25, dmg, by, objs });
  },

  updateFires(this: RoomScene, dt: number): void {
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
  },
};
