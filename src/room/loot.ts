// Gold, barrels and crates, and the room chest with its cards.
// Mixed into RoomScene (see the end of scenes/RoomScene.ts), so `this` is the room
// and every method here is called as scene.<method>().
import Phaser from 'phaser';
import { WORLD } from '../config';
import { Player } from '../entities/Player';
import { gearOf } from '../run';
import { heroLook } from '../hero';
import { getParty } from '../input';
import { gearStats, rollChest, type Item } from '../loot';
import { shrineBonus } from '../shrine';
import { hi, keycap } from '../ui/kit';
import type { Breakable } from '../blightwood';
import { FONT, RES } from '../ui/theme';
import type { RoomScene, AttackSpec, HitSource } from '../scenes/RoomScene';

export const lootMethods = {
  coinTexture(this: RoomScene): void {
    hi(this, 'coin', 12, 12, (c) => {
      c.fillStyle = '#3a2204'; c.beginPath(); c.arc(6, 6, 5.6, 0, Math.PI * 2); c.fill();
      const g = c.createLinearGradient(0, 1, 0, 11);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f0b030'); g.addColorStop(1, '#b06a10');
      c.fillStyle = g; c.beginPath(); c.arc(6, 6, 4.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(120,70,8,0.8)'; c.lineWidth = 0.8; c.beginPath(); c.arc(6, 6, 3, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(4.4, 4.2, 1.1, 0, Math.PI * 2); c.fill();
    });
  },

  // Greed at the shrine: n gold becomes n x (1 + bonus), the fraction left over
  // rounded up by chance, so +10% on a ghoul's 3 coins is sometimes a fourth.
  moreGold(this: RoomScene, n: number): number {
    const x = n * (1 + (shrineBonus().gold ?? 0));
    return Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);
  },

  // Coins spill out with a bounce, then fly to the hero once close (or once the room is won).
  spawnCoins(this: RoomScene, x: number, y: number, n: number, value = 1): void {
    this.coinTexture();
    if (value > 0) n = this.moreGold(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 70;
      const img = this.add.image(x, y, 'coin').setScale(0.5);
      this.coins.push({ img, x, y, z: 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 140 + Math.random() * 90, t: 0, value, dead: false });
    }
  },

  updateCoins(this: RoomScene, dt: number): void {
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
  },

  // The player's swing also splinters barrels and crates in reach.
  smashProps(this: RoomScene, attacker: HitSource, spec: AttackSpec, inside: (x: number, y: number) => boolean, once?: Set<object>): number {
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
  },

  breakProp(this: RoomScene, b: Breakable): void {
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
  },

  splinters(this: RoomScene, x: number, y: number, n: number): void {
    const p = this.add.particles(x, y, 'tt_dot', {
      speed: { min: 60, max: 170 }, angle: { min: 200, max: 340 }, gravityY: 520, lifespan: { min: 350, max: 700 },
      scale: { start: 0.22, end: 0.08 }, tint: [0x8a5a2a, 0x6a4018, 0xb07a40], emitting: false,
    }).setDepth(y + 30);
    p.explode(n);
    this.time.delayedCall(900, () => p.destroy());
  },

  chestTextures(this: RoomScene): void {
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
  },

  // A stone arch with a gilded crown, the runes on its stones dark until the room is won.
  shrineTextures(this: RoomScene): void {
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
  },

  // The chest waits at the back of the room from the start, sealed in its shrine.
  placeChest(this: RoomScene): void {
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
    this.chest = { img, runes, x, y, prompt, locked: true, opened: false, items: this.rollCards(), items2: getParty().length > 1 ? this.rollCards() : undefined };
  },

  // A chest's cards: three, and one more for each rank of Keen Eye at the shrine.
  rollCards(this: RoomScene): Item[] {
    return rollChest(this.depth, Math.random, undefined, 3 + (shrineBonus().chestCard ?? 0));
  },

  // The room is won: light falls on the chest, the runes wake, the seal is gone.
  unlockChest(this: RoomScene): void {
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
  },

  chestNear(this: RoomScene, p: Player): boolean {
    const c = this.chest;
    return !!c && !c.locked && !c.opened && !p.isDead() && Math.hypot(p.x - c.x, (p.y - c.y) * 1.6) < 72;
  },

  // Whoever presses interact by the chest opens it; in co-op both then choose.
  updateChest(this: RoomScene): void {
    const c = this.chest;
    if (!c) return;
    const near = this.heroes.filter((h) => this.chestNear(h));
    c.prompt.setAlpha(Phaser.Math.Linear(c.prompt.alpha, near.length ? 1 : 0, 0.2)).setY(c.y - 52 + Math.sin(this.time.now / 250) * 2);
    const by = near.find((h) => h.interact);
    if (by) this.openChest(by);
  },

  // Lid up, light out, then the HUD offers the three cards with the room paused.
  openChest(this: RoomScene, who?: Player): void {
    const by = who ?? this.player;
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
        items: (h.who === 0 ? c.items : c.items2) ?? (c.items2 = this.rollCards()),
        gear: gearOf(this.run, h.who),
        device: party[h.who],
        name: heroLook(h.who).name,
        onPick: (it: Item) => {
          this.equip(it, h);
          if (--left === 0) this.scene.resume();
        },
      })));
    });
  },

  // Puts an item on a hero (player 1 unless said otherwise).
  equip(this: RoomScene, it: Item, hero?: Player): void {
    const p = hero ?? this.player;
    const g = gearOf(this.run, p.who);
    if (it.cat === 'weapon') g.weapon = it;
    else if (it.cat === 'armor') g.armor = it;
    else g.trinkets.push(it);
    const before = p.maxHp;
    p.stats = gearStats(g, shrineBonus());
    p.maxHp = 100 + p.stats.fx.maxHp;
    if (p.maxHp > before && !p.isDead()) p.hp += p.maxHp - before; // more health does not raise a fallen hero
    p.hp = Math.min(p.hp, p.maxHp);
    if (it.cat === 'weapon') p.arm();
  },
};
