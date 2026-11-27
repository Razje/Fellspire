// One run, carried from room to room: what you have done and what you carry.
import { newGear, type Gear } from './loot';
import type { LevelType } from './world';

export interface Run {
  rooms: number; // rooms cleared
  kills: number;
  damage: number; // dealt
  time: number; // seconds
  gold: number; // one purse, shared in co-op
  embers: number; // earned this run (already banked: see embers.ts)
  gear: Gear; // player 1's
  gear2?: Gear; // player 2's, in co-op
  risen?: number[]; // the heroes (who) whose Undying is spent this run
  // where the run is (world.ts): the areas chosen so far, the last being the one the
  // party is in, and the type of each level played in it, the current one last
  route: string[];
  levels: LevelType[];
}

export function newRun(): Run {
  return { rooms: 0, kills: 0, damage: 0, time: 0, gold: 0, embers: 0, gear: newGear(), route: ['blightwood'], levels: ['normal'] };
}

// What a hero carries: player 1 (who 0) or player 2 (who 1).
export function gearOf(run: Run, who: number): Gear {
  if (who === 0) return run.gear;
  return (run.gear2 ??= newGear());
}

export function setGearOf(run: Run, who: number, g: Gear) {
  if (who === 0) run.gear = g;
  else run.gear2 = g;
}
