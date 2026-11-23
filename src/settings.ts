// Player options, remembered in this browser when storage is available.
export interface Settings {
  screenShake: boolean;
  damageNumbers: boolean;
}

const KEY = 'fellspire.settings';
const defaults: Settings = { screenShake: true, damageNumbers: true };

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
