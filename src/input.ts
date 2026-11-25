import Phaser from 'phaser';

// What a hero wants to do this frame, whatever device it came from.
// light/heavy: pressed this frame; lightHeld/heavyHeld: held down (repeats the attack)
export interface Input { mx: number; my: number; light: boolean; heavy: boolean; lightHeld: boolean; heavyHeld: boolean; skill: boolean; dodge: boolean; block: boolean; interact: boolean; interactHeld: boolean }

export const NO_INPUT: Input = { mx: 0, my: 0, light: false, heavy: false, lightHeld: false, heavyHeld: false, skill: false, dodge: false, block: false, interact: false, interactHeld: false };

// Which device drives a hero.
//   solo   the whole keyboard (WASD or the arrows) plus the first controller, as one player
//   left   keyboard, left side: WASD, J/K/I, L dodge, Shift block, E interact
//   right  keyboard, right side: arrows, numpad 1-5 and 0 (for two on one keyboard)
//   pad    one controller, by the browser's number for it (Gamepad.index)
export type Device = { kind: 'solo' } | { kind: 'left' } | { kind: 'right' } | { kind: 'pad'; index: number };

// The keys of each keyboard layout, by action. Phaser key names.
type Action = 'up' | 'down' | 'left' | 'right' | 'light' | 'heavy' | 'skill' | 'dodge' | 'block' | 'interact';
const LEFT: Record<Action, string[]> = {
  up: ['W'], down: ['S'], left: ['A'], right: ['D'],
  light: ['J'], heavy: ['K'], skill: ['I'], dodge: ['L'], block: ['SHIFT'], interact: ['E'],
};
const RIGHT: Record<Action, string[]> = {
  up: ['UP'], down: ['DOWN'], left: ['LEFT'], right: ['RIGHT'],
  light: ['NUMPAD_ONE'], heavy: ['NUMPAD_TWO'], dodge: ['NUMPAD_THREE'], skill: ['NUMPAD_FOUR'], block: ['NUMPAD_FIVE'], interact: ['NUMPAD_ZERO'],
};
const SOLO: Record<Action, string[]> = {
  up: ['W', 'UP'], down: ['S', 'DOWN'], left: ['A', 'LEFT'], right: ['D', 'RIGHT'],
  light: ['J'], heavy: ['K'], skill: ['I'], dodge: ['L'], block: ['SHIFT'], interact: ['E'],
};

// The keys shown on screen for a device, by action.
export type KeyLabels = Record<'light' | 'heavy' | 'skill' | 'dodge' | 'block' | 'interact', string> & { move: string[] };
export function keyLabels(d: Device): KeyLabels {
  if (d.kind === 'right') return { light: 'Num 1', heavy: 'Num 2', dodge: 'Num 3', skill: 'Num 4', block: 'Num 5', interact: 'Num 0', move: ['↑', '←', '↓', '→'] };
  if (d.kind === 'pad') return { light: 'X', heavy: 'Y', skill: 'LB', dodge: 'A', block: 'RB', interact: 'B', move: ['Stick'] };
  return { light: 'J', heavy: 'K', skill: 'I', dodge: 'L', block: 'Shift', interact: 'E', move: ['W', 'A', 'S', 'D'] };
}

// What a device is called on screen.
export function deviceName(d: Device): string {
  switch (d.kind) {
    case 'solo': return 'Keyboard or controller';
    case 'left': return 'Keyboard, left side';
    case 'right': return 'Keyboard, right side';
    case 'pad': return `Controller ${d.index + 1}`;
  }
}

// ---- menus (the chest's cards, the weapon rack) --------------------------------------------

// One step through a menu.
export interface MenuStep { left?: boolean; right?: boolean; up?: boolean; down?: boolean; ok?: boolean; back?: boolean; tabL?: boolean; tabR?: boolean }
type MenuAction = keyof MenuStep;

// The keys that work a menu, by device (KeyboardEvent.code). In co-op each player
// works their own part of a screen with their own side of the keyboard: back is the
// heavy attack key, as in the lobby, and the right side changes tab with Num 7 and 9.
const MENU: Record<'solo' | 'left' | 'right', Record<MenuAction, string[]>> = {
  solo: {
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    ok: ['KeyE', 'Enter', 'NumpadEnter', 'Space', 'KeyJ', 'Numpad1', 'Numpad0'], back: ['Escape', 'Backspace'], tabL: ['KeyQ'], tabR: ['KeyR'],
  },
  left: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    ok: ['KeyE', 'KeyJ', 'Space'], back: ['Escape', 'KeyK'], tabL: ['KeyQ'], tabR: ['KeyR'],
  },
  right: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    ok: ['Numpad1', 'Numpad0', 'NumpadEnter', 'Enter'], back: ['Escape', 'Numpad2'], tabL: ['Numpad7'], tabR: ['Numpad9'],
  },
};

// What a key does in a menu for this device, or null when it is not one of its keys.
export function menuKey(d: Device, code: string): MenuStep | null {
  if (d.kind === 'pad') return code === 'Escape' ? { back: true } : null;
  const m = MENU[d.kind];
  const step: MenuStep = {};
  let any = false;
  for (const a of Object.keys(m) as MenuAction[]) if (m[a].includes(code)) { step[a] = true; any = true; }
  return any ? step : null;
}

// Whether a controller works this device's menus: the solo player takes any of them.
export function menuPad(d: Device, padIndex: number) {
  return d.kind === 'solo' || (d.kind === 'pad' && d.index === padIndex);
}

// The keys to show for a device's menus.
export function menuLabels(d: Device) {
  if (d.kind === 'right') return { move: ['←', '→'], move4: ['↑', '←', '↓', '→'], ok: 'Num 1', back: 'Num 2', tabs: ['Num 7', 'Num 9'] };
  if (d.kind === 'pad') return { move: ['Stick'], move4: ['Stick'], ok: 'A', back: 'B', tabs: ['LB', 'RB'] };
  if (d.kind === 'left') return { move: ['A', 'D'], move4: ['A', 'D', 'W', 'S'], ok: 'E', back: 'K', tabs: ['Q', 'R'] };
  return { move: ['A', 'D'], move4: ['A', 'D', 'W', 'S'], ok: 'E', back: 'Esc', tabs: ['Q', 'R'] };
}

export const sameDevice =(a: Device, b: Device) => a.kind === b.kind && (a.kind !== 'pad' || a.index === (b as { index: number }).index);

// Who is playing and on what: one device for solo, two for co-op. Kept here, not in
// the run, so Try Again and Restart Run keep the same players.
let party: Device[] = [{ kind: 'solo' }];
export const getParty = () => party;
export function setParty(devices: Device[]) {
  party = devices.length ? devices : [{ kind: 'solo' }];
}

// Where each key of the layouts above sits (KeyboardEvent.code).
const CODES: Record<string, string[]> = {
  W: ['KeyW'], A: ['KeyA'], S: ['KeyS'], D: ['KeyD'], J: ['KeyJ'], K: ['KeyK'], I: ['KeyI'], L: ['KeyL'], E: ['KeyE'],
  SHIFT: ['ShiftLeft', 'ShiftRight'],
  UP: ['ArrowUp'], DOWN: ['ArrowDown'], LEFT: ['ArrowLeft'], RIGHT: ['ArrowRight'],
  NUMPAD_ZERO: ['Numpad0'], NUMPAD_ONE: ['Numpad1'], NUMPAD_TWO: ['Numpad2'], NUMPAD_THREE: ['Numpad3'], NUMPAD_FOUR: ['Numpad4'], NUMPAD_FIVE: ['Numpad5'],
};

// Controller buttons (standard mapping): A 0, B 1, X 2, Y 3, LB 4, RB 5, d-pad 12-15.
const PAD = { light: 2, heavy: 3, skill: 4, dodge: 0, block: 5, interact: 1, up: 12, down: 13, left: 14, right: 15 };

// Reads one device into an Input, once a frame.
export class Controls {
  readonly keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private map: Record<Action, string[]> | null;
  private padPrev: boolean[] = [];
  // keys pressed since the last read: a tap that goes down and up between two frames
  // would otherwise be lost, since releasing a Phaser Key clears its JustDown
  private taps = new Set<Phaser.Input.Keyboard.Key>();

  // Keys are matched by where they sit on the keyboard (KeyboardEvent.code), not by
  // the character they type: with Num Lock off, Numpad 2 types Arrow Down and Phaser's
  // own keys (which go by keyCode) cannot tell the two apart. So each key here is a
  // Phaser Key that this class feeds itself; JustDown and the tests' onDown work as usual.
  constructor(private scene: Phaser.Scene, readonly device: Device) {
    this.map = device.kind === 'left' ? LEFT : device.kind === 'right' ? RIGHT : device.kind === 'solo' ? SOLO : null;
    const kb = scene.input.keyboard;
    if (!this.map || !kb) return;
    const byCode = new Map<string, Phaser.Input.Keyboard.Key>();
    for (const name of new Set(Object.values(this.map).flat())) {
      const key = new Phaser.Input.Keyboard.Key(kb, Phaser.Input.Keyboard.KeyCodes[name as keyof typeof Phaser.Input.Keyboard.KeyCodes]);
      this.keys[name] = key;
      for (const code of CODES[name]) byCode.set(code, key);
    }
    kb.addCapture(Object.keys(this.keys).join(',')); // arrows and the like do not scroll the page
    // Phaser sometimes hands over one event twice (see CLAUDE.md); a second key-down
    // arriving after the key-up would leave the key held, so each event counts once
    const seen = new WeakSet<KeyboardEvent>();
    const down = (e: KeyboardEvent) => {
      const key = byCode.get(e.code);
      if (!key || seen.has(e)) return;
      seen.add(e);
      if (!key.isDown) this.taps.add(key);
      key.onDown(e);
    };
    const up = (e: KeyboardEvent) => {
      if (seen.has(e)) return;
      seen.add(e);
      byCode.get(e.code)?.onUp(e);
    };
    const reset = () => { for (const k of Object.values(this.keys)) k.reset(); };
    kb.on('keydown', down);
    kb.on('keyup', up);
    scene.game.events.on(Phaser.Core.Events.BLUR, reset); // no key stays held when the window loses focus
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', down);
      kb.off('keyup', up);
      scene.game.events.off(Phaser.Core.Events.BLUR, reset);
    });
  }

  private get pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const gp = this.scene.input.gamepad;
    if (!gp) return undefined;
    if (this.device.kind === 'solo') return gp.pad1;
    if (this.device.kind === 'pad') return gp.getPad(this.device.index);
    return undefined;
  }

  read(): Input {
    const inp: Input = { ...NO_INPUT };
    const m = this.map;
    if (m) {
      const down = (a: Action) => m[a].some((k) => this.keys[k].isDown);
      const jd = (a: Action) => m[a].some((k) => Phaser.Input.Keyboard.JustDown(this.keys[k]) || this.taps.has(this.keys[k]));
      inp.mx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
      inp.my = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
      inp.light = jd('light'); inp.heavy = jd('heavy');
      inp.lightHeld = down('light'); inp.heavyHeld = down('heavy');
      inp.skill = jd('skill'); inp.dodge = jd('dodge');
      inp.block = down('block'); inp.interact = jd('interact'); inp.interactHeld = down('interact');
      this.taps.clear();
    }
    const pad = this.pad;
    if (pad) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const pressed = (i: number) => b(i) && !this.padPrev[i];
      const sx = Math.abs(pad.leftStick.x) > 0.25 ? pad.leftStick.x : 0;
      const sy = Math.abs(pad.leftStick.y) > 0.25 ? pad.leftStick.y : 0;
      inp.mx = inp.mx || sx || (b(PAD.right) ? 1 : b(PAD.left) ? -1 : 0);
      inp.my = inp.my || sy || (b(PAD.down) ? 1 : b(PAD.up) ? -1 : 0);
      inp.light ||= pressed(PAD.light);
      inp.heavy ||= pressed(PAD.heavy);
      inp.lightHeld ||= b(PAD.light);
      inp.heavyHeld ||= b(PAD.heavy);
      inp.skill ||= pressed(PAD.skill);
      inp.dodge ||= pressed(PAD.dodge);
      inp.block ||= b(PAD.block);
      inp.interact ||= pressed(PAD.interact);
      inp.interactHeld ||= b(PAD.interact);
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }
    return inp;
  }
}
