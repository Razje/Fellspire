// A challenge level's rule (challenges.ts) as the room plays it: started with the
// room, told what happens (hits, dodges, time), broken the moment it no longer holds,
// met when the last wave falls. Breaking it turns the gold chest back to wood. Mixed
// into RoomScene (see the end of scenes/RoomScene.ts), so `this` is the room.
import { getParty } from '../input';
import { newChallenge } from '../challenges';
import type { Player } from '../entities/Player';
import type { RoomScene } from '../scenes/RoomScene';

export const challengeMethods = {
  // A challenge level gets its rule as the room is set up (after its waves, which
  // Swift's time limit depends on); any other level has none.
  setupChallenge(this: RoomScene, id?: string): void {
    this.challenge = this.levelType === 'challenge' ? newChallenge(this.totalFoes, getParty().length, id) : null;
  },

  // A hero took a hit that got through (a blocked one does not count).
  noteHit(this: RoomScene, _p: Player): void {
    const c = this.challenge;
    if (!c || c.failed || c.met || this.gateOpen) return;
    c.hits++;
    if (c.def.id === 'unscathed' && c.hits > c.limit) this.failChallenge();
  },

  noteDodge(this: RoomScene, _p: Player): void {
    const c = this.challenge;
    if (!c || c.failed || c.met || this.gateOpen) return;
    c.dodges++;
    if (c.def.id === 'steadfast') this.failChallenge();
  },

  // The clock runs from the first wave until the room is won.
  updateChallenge(this: RoomScene, dt: number): void {
    const c = this.challenge;
    if (!c || c.failed || c.met || this.gateOpen || this.wave === 0) return;
    c.time += dt;
    if (c.def.id === 'swift' && c.time > c.limit) this.failChallenge();
  },

  failChallenge(this: RoomScene): void {
    const c = this.challenge;
    if (!c || c.failed) return;
    c.failed = true;
    this.setChestTier('wood');
    this.hud?.banner('warn', `${c.def.name}: failed`, 'The chest falls back to wood');
  },

  // The last wave is down: a rule still standing is met. Returns whether it was.
  meetChallenge(this: RoomScene): boolean {
    const c = this.challenge;
    if (!c || c.failed) return false;
    c.met = true;
    return true;
  },
};
