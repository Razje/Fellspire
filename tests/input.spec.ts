import { expect, test, type Page } from '@playwright/test';

// The devices a hero can be driven by (src/input.ts): the solo keyboard, the left and
// right halves of one keyboard for two players, and their key layouts.

async function waitForScene(page: Page, key: string) {
  await page.waitForFunction((k) => {
    const g = (window as any).game;
    return !!g && g.scene.isActive(k);
  }, key, { timeout: 60_000 });
}

test('each keyboard layout drives its own actions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');

  const r = await page.evaluate(() => {
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    game.loop.sleep();
    const Controls = s.player.controls.constructor;
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    // presses one key on a device and reports which actions it caused
    const tryKey = (c: any, k: string) => {
      const key = c.keys[k];
      if (!key) return 'not listened to';
      key.onDown(ev());
      const inp = c.read();
      key.onUp(ev());
      c.read();
      const on = Object.entries(inp).filter(([, v]) => v === true || (typeof v === 'number' && v !== 0)).map(([a, v]) => (typeof v === 'number' ? `${a}${v}` : a));
      return on.join(' ');
    };
    const solo = s.player.controls, left = new Controls(s, { kind: 'left' }), right = new Controls(s, { kind: 'right' });
    return {
      solo: Object.fromEntries(['W', 'UP', 'J', 'K', 'I', 'L', 'SHIFT', 'E', 'SPACE'].map((k) => [k, tryKey(solo, k)])),
      left: Object.fromEntries(['D', 'UP', 'L', 'SHIFT', 'NUMPAD_ONE'].map((k) => [k, tryKey(left, k)])),
      right: Object.fromEntries(['RIGHT', 'UP', 'NUMPAD_ONE', 'NUMPAD_TWO', 'NUMPAD_THREE', 'NUMPAD_FOUR', 'NUMPAD_FIVE', 'NUMPAD_ZERO', 'J', 'L'].map((k) => [k, tryKey(right, k)])),
    };
  });
  console.log(JSON.stringify(r, null, 1));

  // one player: WASD or arrows, L dodges, Shift blocks, Space does nothing in a fight
  expect(r.solo).toEqual({
    W: 'my-1', UP: 'my-1', J: 'light lightHeld', K: 'heavy heavyHeld', I: 'skill',
    L: 'dodge', SHIFT: 'block', E: 'interact interactHeld', SPACE: 'not listened to',
  });
  // two on one keyboard: the left side leaves the arrows and numpad alone...
  expect(r.left).toEqual({ D: 'mx1', UP: 'not listened to', L: 'dodge', SHIFT: 'block', NUMPAD_ONE: 'not listened to' });
  // ...and the right side has arrows and numpad 1-5 and 0, and none of the letters
  expect(r.right).toEqual({
    RIGHT: 'mx1', UP: 'my-1', NUMPAD_ONE: 'light lightHeld', NUMPAD_TWO: 'heavy heavyHeld', NUMPAD_THREE: 'dodge',
    NUMPAD_FOUR: 'skill', NUMPAD_FIVE: 'block', NUMPAD_ZERO: 'interact interactHeld', J: 'not listened to', L: 'not listened to',
  });
  expect(errors).toEqual([]);
});

test('the numpad works with Num Lock off, and a quick tap is not lost', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    (window as any).game.loop.sleep(); // nothing reads the keys but us
    (window as any).rightPad = new s.player.controls.constructor(s, { kind: 'right' });
  });
  // this browser sends the numpad as with Num Lock off: Numpad 2 types ArrowDown
  const tap = async (k: string) => {
    await page.keyboard.press(k); // down and up before anything reads it
    return page.evaluate(() => { const i = (window as any).rightPad.read(); return { my: i.my, heavy: i.heavy, light: i.light }; });
  };
  expect(await tap('Numpad2')).toEqual({ my: 0, heavy: true, light: false });
  expect(await tap('Numpad1')).toEqual({ my: 0, heavy: false, light: true });
  // read once: the next read no longer sees it
  expect(await page.evaluate(() => (window as any).rightPad.read().light)).toBe(false);
  // the real arrow still moves
  await page.keyboard.down('ArrowDown');
  expect(await page.evaluate(() => (window as any).rightPad.read().my)).toBe(1);
  await page.keyboard.up('ArrowDown');
  expect(errors).toEqual([]);
});
