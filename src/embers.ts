// Embers: what a run leaves behind. Gold and gear are lost when a run ends;
// embers are kept, in the browser, and spent at camp (step 10.2). They are put
// in the bank the moment they are earned, so closing the game mid-run, dying
// or giving up all keep what was earned. In co-op the party shares one bank.
import type { Run } from './run';

// How many embers each deed gives. Tune here.
export const EMBERS = {
  kill: 1, // any foe laid to rest, the Warden's summoned ghouls included
  room: 5, // a room cleared (its last wave dead)
  boss: 40, // the Lantern Warden
};

const KEY = 'fellspire.embers';
let bank: number | null = null;

// What is in the bank, carried over from every earlier run.
export function embers(): number {
  if (bank === null) {
    let n = 0;
    try { n = Number(localStorage.getItem(KEY)) || 0; } catch { /* storage blocked */ }
    bank = Math.max(0, Math.floor(n));
  }
  return bank;
}

function save() {
  try { localStorage.setItem(KEY, String(bank)); } catch { /* storage blocked */ }
}

// Earned in a run: counted on the run (for the end screen) and banked at once.
export function earnEmbers(run: Run, n: number) {
  if (n <= 0) return;
  run.embers = (run.embers ?? 0) + n;
  bank = embers() + n;
  save();
}

// Taken from the bank (the shrine, 10.2). False if there are not enough.
export function spendEmbers(n: number): boolean {
  if (n > embers()) return false;
  bank = embers() - n;
  save();
  return true;
}
