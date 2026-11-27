// Waves and the exit: when the next wave comes, the gate opens and takes the party through.
// Mixed into RoomScene (see the end of scenes/RoomScene.ts), so `this` is the room
// and every method here is called as scene.<method>().
import Phaser from 'phaser';
import { WORLD } from '../config';
import { Player } from '../entities/Player';
import { BoneThrower, Ghoul } from '../entities/Enemies';
import { gearOf, newRun } from '../run';
import { EMBERS } from '../embers';
import { newGear } from '../loot';
import { heroLook } from '../hero';
import { shrineBonus } from '../shrine';
import { FONT, RES } from '../ui/theme';
import type { RoomScene, Wave } from '../scenes/RoomScene';
import { REJOIN } from '../scenes/RoomScene';

export const wavesMethods = {
  updateWaves(this: RoomScene, dt: number): void {
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
            // Packed Bags at the shrine: the purse is not empty at the start
            const run = { ...newRun(), gold: shrineBonus().startGold ?? 0, gear: { ...newGear(), weapon: this.run.gear.weapon } };
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
  },

  // Over the gate while one hero stands in it and the other is still on the way.
  showGateWait(this: RoomScene, waitingFor: Player | null): void {
    const ex = this.world.exit;
    if (waitingFor && !this.gateWait) {
      this.gateWait = this.add.text(ex.x, ex.y - 78, '', { fontFamily: FONT.label, fontSize: '13px', color: '#f0e6d2', stroke: '#000', strokeThickness: 3, resolution: RES * 2 })
        .setOrigin(0.5).setDepth(19500).setAlpha(0);
    }
    const t = this.gateWait;
    if (!t) return;
    if (waitingFor) t.setText(`Waiting for ${heroLook(waitingFor.who).name}`);
    t.setAlpha(Phaser.Math.Linear(t.alpha, waitingFor && !this.leaving ? 1 : 0, 0.2)).setY(ex.y - 78 + Math.sin(this.time.now / 250) * 2);
  },

  spawnWave(this: RoomScene, w: Wave): void {
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
  },
};
