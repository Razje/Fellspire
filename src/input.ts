import Phaser from 'phaser';

// What a hero wants to do this frame, whatever device it came from.
// light/heavy: pressed this frame; lightHeld/heavyHeld: held down (repeats the attack)
export interface Input { mx: number; my: number; light: boolean; heavy: boolean; lightHeld: boolean; heavyHeld: boolean; skill: boolean; dodge: boolean; block: boolean; interact: boolean }

export const NO_INPUT: Input = { mx: 0, my: 0, light: false, heavy: false, lightHeld: false, heavyHeld: false, skill: false, dodge: false, block: false, interact: false };

// Which device drives a hero.
//   solo   the whole keyboard (WASD or the arrows) plus the first controller, as one player
//   left   keyboard, left side: WASD, J/K/I, L dodge, Shift block, E interact
//   right  keyboard, right side: arrows, numpad 1-5 and 0 (for two on one keyboard)
//   pad    one controller, by its number (0 = the first one plugged in)
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

// The keys shown on screen for a layout (the HUD's action bar), by action.
export const KEY_LABELS = {
  keyboard: { light: 'J', heavy: 'K', skill: 'I', dodge: 'L', block: 'Shift', interact: 'E', move: ['W', 'A', 'S', 'D'] },
  right: { light: 'N1', heavy: 'N2', skill: 'N4', dodge: 'N3', block: 'N5', interact: 'N0', move: ['↑', '←', '↓', '→'] },
};

// Controller buttons (standard mapping): A 0, B 1, X 2, Y 3, LB 4, RB 5, d-pad 12-15.
const PAD = { light: 2, heavy: 3, skill: 4, dodge: 0, block: 5, interact: 1, up: 12, down: 13, left: 14, right: 15 };

// Reads one device into an Input, once a frame.
export class Controls {
  readonly keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private map: Record<Action, string[]> | null;
  private padPrev: boolean[] = [];

  constructor(private scene: Phaser.Scene, readonly device: Device) {
    this.map = device.kind === 'left' ? LEFT : device.kind === 'right' ? RIGHT : device.kind === 'solo' ? SOLO : null;
    if (this.map) {
      const names = [...new Set(Object.values(this.map).flat())];
      Object.assign(this.keys, scene.input.keyboard!.addKeys(names.join(',')));
    }
  }

  private get pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const gp = this.scene.input.gamepad;
    if (!gp) return undefined;
    if (this.device.kind === 'solo') return gp.pad1;
    if (this.device.kind === 'pad') return gp.getAll()[this.device.index];
    return undefined;
  }

  read(): Input {
    const inp: Input = { ...NO_INPUT };
    const m = this.map;
    if (m) {
      const down = (a: Action) => m[a].some((k) => this.keys[k].isDown);
      const jd = (a: Action) => m[a].some((k) => Phaser.Input.Keyboard.JustDown(this.keys[k]));
      inp.mx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
      inp.my = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
      inp.light = jd('light'); inp.heavy = jd('heavy');
      inp.lightHeld = down('light'); inp.heavyHeld = down('heavy');
      inp.skill = jd('skill'); inp.dodge = jd('dodge');
      inp.block = down('block'); inp.interact = jd('interact');
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
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }
    return inp;
  }
}
