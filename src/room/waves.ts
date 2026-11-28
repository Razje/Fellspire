// Waves: when the next one comes, and when the room is won and its gates open (the
// gates themselves are in gates.ts). Mixed into RoomScene (see the end of
// scenes/RoomScene.ts), so `this` is the room and every method here is called as
// scene.<method>().
import Phaser from 'phaser';
import { WORLD } from '../config';
import { BoneThrower, Ghoul } from '../entities/Enemies';
import { EMBERS } from '../embers';
import type { RoomScene, Wave } from '../scenes/RoomScene';

export const wavesMethods = {
  updateWaves(this: RoomScene, dt: number): void {
    if (!this.livingHeroes.length) return;
    if (this.gateOpen) {
      this.updateGates();
      return;
    }
    if (this.isBossRoom) return; // the boss's fall opens his glade's gates (bossFight.ts)
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
      this.openGates();
      const then = this.gates.length > 1 ? '. Choose a gate' : '';
      if (this.meetChallenge()) this.hud?.banner('good', `${this.challenge!.def.name}: met`, `The gold chest is unsealed${then}`);
      else this.hud?.banner('good', 'Room Cleared', `The chest is unsealed${then}`);
      this.unlockChest();
      this.earn(EMBERS.room);
    }
  },

  spawnWave(this: RoomScene, w: Wave): void {
    const { viewW, roomW, groundTop, groundBottom } = WORLD;
    const left = this.cameras.main.worldView.x;
    const tier = 1 + 0.15 * (this.depth - 1);
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
      if (this.levelType === 'elite') e.crown();
      e.appear = 0; // fades in
      this.enemies.push(e);
    });
  },
};
