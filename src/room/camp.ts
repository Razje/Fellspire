// The camp's rack and ember shrine.
// Mixed into RoomScene (see the end of scenes/RoomScene.ts), so `this` is the room
// and every method here is called as scene.<method>().
import { Player } from '../entities/Player';
import { CAMP, saveWeapon } from '../hub';
import type { HudScene } from '../scenes/HudScene';
import { gearOf } from '../run';
import { heroLook } from '../hero';
import { getParty } from '../input';
import type { RoomScene } from '../scenes/RoomScene';

export const campMethods = {
  rackNear(this: RoomScene, p: Player): boolean {
    const r = CAMP.rack;
    return !!this.camp && !p.isDead() && Math.hypot(p.x - r.x, (p.y - r.y) * 1.6) < 80;
  },

  shrineNear(this: RoomScene, p: Player): boolean {
    const r = CAMP.shrine;
    return !!this.camp && !p.isDead() && Math.hypot(p.x - r.x, (p.y - r.y) * 1.6) < 80;
  },

  updateCamp(this: RoomScene): void {
    if (!this.camp) return;
    const near = this.heroes.filter((h) => this.rackNear(h));
    const nearShrine = this.heroes.filter((h) => this.shrineNear(h));
    this.camp.update(near.length > 0, nearShrine.length > 0);
    const by = near.find((h) => h.interact);
    if (by) { this.openRack(by); return; }
    const at = nearShrine.find((h) => h.interact);
    if (at) this.openShrine(at);
  },

  // The ember shrine opens over the paused camp (HudScene.openShrine); what is
  // learned there is kept by shrine.ts, so closing it is all the room has to do.
  openShrine(this: RoomScene, who?: Player): void {
    const by = who ?? this.player;
    const hud = this.hud;
    if (!hud || !this.camp || hud.choosing) return;
    this.scene.pause();
    hud.openShrine(() => this.scene.resume(),
      this.heroes.length > 1 ? { name: heroLook(by.who).name, device: getParty()[by.who] } : undefined);
  },

  // The rack opens as a store over the paused camp (HudScene.openRack); the pick
  // is remembered, and Esc walks away without changing anything.
  openRack(this: RoomScene, who?: Player): void {
    const by = who ?? this.player;
    const hud = this.hud, camp = this.camp;
    if (!hud || !camp || hud.choosing) return;
    this.scene.pause();
    hud.openRack(camp.rackItems(), gearOf(this.run, by.who), (it) => {
      this.equip(it, by);
      if (it.kind) saveWeapon(it.kind, by.who);
      camp.chosen = true;
      this.scene.resume();
    }, () => this.scene.resume(),
    // in co-op it is the opener's turn, on their keys
    this.heroes.length > 1 ? { name: heroLook(by.who).name, device: getParty()[by.who] } : undefined);
  },
};
