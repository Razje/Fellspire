// Player options, remembered in this browser when storage is available.
export interface Settings {
  screenShake: boolean;
  damageNumbers: boolean;
  // Volumes 0..1. Stored now; the game has no sound yet.
  master: number;
  music: number;
  effects: number;
}

const KEY = 'fellspire.settings';
const defaults: Settings = { screenShake: true, damageNumbers: true, master: 0.8, music: 0.7, effects: 0.8 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* private window or blocked storage: use defaults */
  }
  return { ...defaults };
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* not fatal */
  }
}
