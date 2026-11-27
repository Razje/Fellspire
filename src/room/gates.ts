// The rune gates out of a room and where each one leads (DESIGN.md, "The world"):
// out of a fight two gates, each marked with the next level's type; out of the fourth
// level one gate, to the boss; out of a boss's glade a gate per area of the next tier;
// out of the camp the way into the Blightwood. Mixed into RoomScene (see the end of
// scenes/RoomScene.ts), so `this` is the room.
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { gearOf, newRun } from '../run';
import { newGear } from '../loot';
import { heroLook } from '../hero';
import { shrineBonus } from '../shrine';
import { FONT, RES } from '../ui/theme';
import { pic } from '../ui/kit';
import { levelGlyph, TYPE_COLOUR } from '../ui/runmap';
import { LAST_TIER, LEVELS_PER_AREA, LEVEL_LABEL, area, areasOfTier, rollGateTypes, type LevelType } from '../world';
import type { RoomScene } from '../scenes/RoomScene';
import { REJOIN } from '../scenes/RoomScene';

export type GateTo = { kind: 'run' } | { kind: 'level'; type: LevelType } | { kind: 'area'; id: string };

export interface Gate {
  x: number; y: number;
  to: GateTo;
  tint: number; // its rune light
  sign?: Phaser.GameObjects.Container; // what it leads to, over the ring
}

// How close to a gate's middle a hero has to stand to be in it.
const IN_GATE = 46;

export const gatesMethods = {
  // Where this room's gates lead, decided before the room is built (it lays them out).
  planGates(this: RoomScene): Gate[] {
    const g = (to: GateTo, tint: number): Gate => ({ x: 0, y: 0, to, tint });
    if (this.isCamp) return [g({ kind: 'run' }, area('blightwood').look.rune)];
    if (this.isBossRoom) {
      if (this.area.tier >= LAST_TIER) return []; // the last boss: the run is won
      return areasOfTier(this.area.tier + 1).map((a) => g({ kind: 'area', id: a.id }, a.look.rune));
    }
    if (this.room === LEVELS_PER_AREA - 1) return [g({ kind: 'level', type: 'boss' }, TYPE_COLOUR.boss.tint)];
    return rollGateTypes().map((type) => g({ kind: 'level', type }, TYPE_COLOUR[type].tint));
  },

  // Puts the planned gates where the room built them and hangs a sign over each.
  placeGates(this: RoomScene, gates: Gate[]): void {
    this.gates = gates.map((gate, i) => {
      const at = this.world.exits[i];
      const placed = { ...gate, x: at.x, y: at.y };
      if (!this.isCamp) placed.sign = this.gateSign(placed);
      return placed;
    });
  },

  // A gate's sign: the next level's glyph and type, or the next area's name, beside
  // the ring on the side the party comes from. Dim until the room is cleared.
  gateSign(this: RoomScene, gate: Gate): Phaser.GameObjects.Container {
    const sign = this.add.container(gate.x - 104, gate.y - 64).setDepth(19400).setAlpha(0.45);
    const to = gate.to;
    const label = to.kind === 'area' ? area(to.id).name : to.kind === 'level' ? LEVEL_LABEL[to.type] : '';
    const colour = to.kind === 'level' ? TYPE_COLOUR[to.type].css : '#' + gate.tint.toString(16).padStart(6, '0');
    const text = this.add.text(0, 0, label.toUpperCase(), {
      fontFamily: FONT.label, fontSize: '12px', color: colour, stroke: '#000', strokeThickness: 4, resolution: RES * 2,
    }).setOrigin(0.5, 0);
    if (to.kind === 'level') {
      const glyph = pic(this, 0, -12, levelGlyph(this, to.type, 26));
      sign.add(glyph);
      this.tweens.add({ targets: glyph, y: -15, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      text.setY(4);
    } else {
      sign.add(this.add.text(0, -14, 'TO', { fontFamily: FONT.label, fontSize: '9px', color: '#b8ac94', stroke: '#000', strokeThickness: 3, resolution: RES * 2 }).setOrigin(0.5, 0));
    }
    sign.add(text);
    return sign;
  },

  // The room is won (or the boss is down): the gates light and their signs brighten.
  openGates(this: RoomScene): void {
    this.gateOpen = true;
    this.world.openExit();
    for (const g of this.gates) if (g.sign) this.tweens.add({ targets: g.sign, alpha: 1, duration: 600 });
  },

  // The gate a hero stands in, or -1.
  gateOf(this: RoomScene, h: Player): number {
    return this.gates.findIndex((g) => Math.hypot(h.x - g.x, (h.y - g.y) * 1.6) < IN_GATE);
  },

  // Every living hero has to stand in the same gate before it takes them through (a
  // fallen one comes along and gets up in the next room); until then it says who it
  // is waiting for.
  updateGates(this: RoomScene): void {
    const live = this.livingHeroes;
    if (!live.length || !this.gates.length) return;
    const where = live.map((h) => this.gateOf(h));
    const first = where.find((i) => i >= 0) ?? -1;
    const missing = first < 0 ? live : live.filter((_, i) => where[i] !== first);
    this.showGateWait(first >= 0 && missing.length ? missing[0] : null, this.gates[Math.max(0, first)]);
    if (!this.leaving && first >= 0 && !missing.length) this.leaveThrough(this.gates[first]);
  },

  // Through a gate: on to the next level, into the next area, or (from the camp) the run begins.
  leaveThrough(this: RoomScene, gate: Gate): void {
    this.leaving = true;
    const cam = this.cameras.main;
    const to = gate.to;
    if (to.kind === 'run') {
      // the run begins, carrying only the chosen weapon
      cam.flash(250, 127, 252, 240);
      this.time.delayedCall(120, () => cam.fade(600, 0, 0, 0, true));
      cam.once('camerafadeoutcomplete', () => {
        // Packed Bags at the shrine: the purse is not empty at the start
        const run = { ...newRun(), gold: shrineBonus().startGold ?? 0, gear: { ...newGear(), weapon: this.run.gear.weapon } };
        if (this.heroes.length > 1) run.gear2 = { ...newGear(), weapon: gearOf(this.run, 1).weapon };
        this.scene.restart({ room: 1, run });
      });
      return;
    }
    cam.fadeOut(400);
    if (!this.isBossRoom) this.run.rooms++; // a boss's glade was counted when he fell
    cam.once('camerafadeoutcomplete', () => {
      // the living heal a little between rooms; the fallen get back up
      const hps = this.heroes.map((h) => (h.isDead() ? Math.round(h.maxHp * REJOIN) : Math.min(h.maxHp, h.hp + 20)));
      const run = { ...this.run };
      if (to.kind === 'area') {
        run.route = [...run.route, to.id];
        run.levels = ['normal'];
        this.scene.restart({ room: 1, hps, run });
      } else {
        run.levels = [...run.levels.slice(0, this.room), to.type];
        this.scene.restart({ room: this.room + 1, hps, run });
      }
    });
  },

  // Over the gate while one hero stands in it and the other is still on the way.
  showGateWait(this: RoomScene, waitingFor: Player | null, gate: Gate): void {
    if (waitingFor && !this.gateWait) {
      this.gateWait = this.add.text(gate.x, gate.y - 78, '', { fontFamily: FONT.label, fontSize: '13px', color: '#f0e6d2', stroke: '#000', strokeThickness: 3, resolution: RES * 2 })
        .setOrigin(0.5).setDepth(19500).setAlpha(0);
    }
    const t = this.gateWait;
    if (!t) return;
    if (waitingFor) t.setText(`Waiting for ${heroLook(waitingFor.who).name}`).setX(gate.x);
    t.setAlpha(Phaser.Math.Linear(t.alpha, waitingFor && !this.leaving ? 1 : 0, 0.2)).setY(gate.y - 78 + Math.sin(this.time.now / 250) * 2);
  },
};
