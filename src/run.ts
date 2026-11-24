// One run, carried from room to room: what you have done and what you carry.
import { newGear, type Gear } from './loot';

export interface Run {
  rooms: number; // rooms cleared
  kills: number;
  damage: number; // dealt
  time: number; // seconds
  gold: number;
  gear: Gear;
}

export function newRun(): Run {
  return { rooms: 0, kills: 0, damage: 0, time: 0, gold: 0, gear: newGear() };
}
