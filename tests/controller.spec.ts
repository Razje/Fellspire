import { expect, test, type Page } from './fixtures';

// Playing on an Xbox controller (Martijn, 2026-11-28): the skill is on the right
// trigger; the keys on screen turn into Xbox buttons once the controller is touched
// and back into keys once the keyboard is; and the chest can be left without taking
// a card (B on a controller, Esc or the back key on the keyboard).
//
// The test browser has no controller, so one is faked: navigator.getGamepads() hands
// back window.__pad, a standard-mapping pad whose buttons the test presses.

test.use({ viewport: { width: 1920, height: 1080 } });

const FAKE_PAD = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons, vibrationActuator: null };
  (window as any).__pad = pad;
  (window as any).__press = (i: number, on: boolean) => {
    buttons[i].pressed = on; buttons[i].touched = on; buttons[i].value = on ? 1 : 0;
    pad.timestamp = performance.now(); // Phaser ignores a pad state older than when it first saw the pad
  };
  navigator.getGamepads = () => [pad as any, null, null, null];
  window.addEventListener('load', () => window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad })));
};

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

const room = (page: Page, body: string) =>
  page.evaluate(`(() => { const game = window.game; const s = game.scene.getScene('room'); const hud = game.scene.getScene('hud'); ${body} })()`);

async function startRoom(page: Page, data: Record<string, unknown>) {
  await page.waitForFunction(() => (window as any).game?.scene.isActive('menu'), null, { timeout: 60_000 });
  await page.evaluate((d) => { (window as any).game.scene.getScene('menu').scene.start('room', d); }, data);
  await page.waitForFunction(() => {
    const g = (window as any).game, s = g?.scene.getScene('room');
    return !!s && g.scene.isActive('room') && !!s.player && !!g.scene.getScene('hud')?.ready;
  }, null, { timeout: 20_000 });
}

// Holds a controller button for a few frames, then lets go.
async function padPress(page: Page, i: number) {
  await page.evaluate((b) => (window as any).__press(b, true), i);
  await page.waitForTimeout(150);
  await page.evaluate((b) => (window as any).__press(b, false), i);
  await page.waitForTimeout(150);
}

// What the action bar's skill slot shows in its corner: its text, or the button's texture.
const SKILL_KEY = `const k = hud.units[0].slots.skill.keyObj; return k.type === 'Text' ? k.text : k.texture.key;`;

// Clears every wave by hand until the gates open and the chest is unsealed.
const CLEAR = `
  game.loop.sleep();
  s.waveDelay = 0;
  for (let i = 0; i < 60 * 60 && !s.gateOpen; i++) {
    for (const e of s.enemies) if (!e.isDead()) e.takeHit(99999, e.x - 1, 0, false);
    s.player.hp = s.player.maxHp;
    s.update(0, 16.7);
  }
  game.loop.wake();
`;

test('the skill is on the right trigger', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(FAKE_PAD);
  await page.goto('/');
  await startRoom(page, { room: 1 });
  await room(page, `s.player.skillCd = 0;`);
  await page.waitForTimeout(300);

  // the left bumper no longer casts it
  await padPress(page, 4);
  expect(await room(page, `return s.player.skillCd;`)).toBeLessThanOrEqual(0);
  // the right trigger does
  await padPress(page, 7);
  expect(await room(page, `return s.player.skillCd;`)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('keys on screen follow the controller and the keyboard', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.addInitScript(FAKE_PAD);
  await page.goto('/');
  await startRoom(page, { room: 1 });
  // keyboard first: the skill slot says I
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(100);
  expect(await room(page, SKILL_KEY)).toBe('I');

  // touch the controller: Xbox buttons in the action bar, and RT on the skill
  await padPress(page, 0);
  await expect.poll(() => room(page, SKILL_KEY), { timeout: 3000 }).toBe('ui_kpad_RT');
  expect(await room(page, `return ['light', 'heavy', 'dodge', 'block'].map((a) => hud.units[0].slots[a].keyObj.texture?.key);`))
    .toEqual(['ui_kpad_X', 'ui_kpad_Y', 'ui_kpad_A', 'ui_kpad_RB']);
  await page.screenshot({ path: info.outputPath('xbox-action-bar.png'), clip: { x: 0, y: 760, width: 1100, height: 320 } });

  // the chest's prompt and the chest screen's hints show buttons too
  await room(page, CLEAR);
  await room(page, `s.player.x = s.chest.x - 56; s.player.y = s.chest.y + 6;`);
  await page.waitForTimeout(500);
  expect(await room(page, `return [s.chest.promptKey, s.chest.prompt.list[0].list[0].texture.key];`)).toEqual(['pad:B', 'ui_kpad_B']);
  await page.screenshot({ path: info.outputPath('xbox-chest-prompt.png'), clip: { x: 560, y: 120, width: 800, height: 420 } });
  await padPress(page, 1); // B opens the chest
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').choice, null, { timeout: 5000 });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: info.outputPath('xbox-chest-screen.png') });

  // the keyboard again: keys again
  await padPress(page, 1); // leave the chest
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyW');
  await expect.poll(() => room(page, SKILL_KEY), { timeout: 3000 }).toBe('I');
  expect(errors).toEqual([]);
});

test('a chest can be left without taking a card, and opened again', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await startRoom(page, { room: 1 });
  await room(page, CLEAR);
  await room(page, `s.player.x = s.chest.x - 56; s.player.y = s.chest.y + 6;`);
  await page.waitForTimeout(400);
  const before = await room(page, `return { weapon: s.run.gear.weapon.name, armor: s.run.gear.armor, trinkets: s.run.gear.trinkets.length, cards: s.chest.items.map((it) => it.name) };`) as any;

  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').choice, null, { timeout: 5000 });
  await page.waitForTimeout(1100);
  // the hint row offers Leave
  expect(await room(page, `return hud.choice.root.list.filter((o) => o.list).flatMap((o) => o.list).flatMap((o) => o.list ?? []).map((o) => o.text).filter(Boolean);`))
    .toEqual(expect.arrayContaining(['Choose', 'Take', 'Leave']));
  await page.screenshot({ path: info.outputPath('chest-with-leave.png') });

  await page.keyboard.press('Escape');
  await expect.poll(() => room(page, `return [!!hud.choice, game.scene.isPaused('room')];`), { timeout: 5000 }).toEqual([false, false]);
  const after = await room(page, `return { weapon: s.run.gear.weapon.name, armor: s.run.gear.armor, trinkets: s.run.gear.trinkets.length, opened: s.chest.opened, took: s.chest.took.size, tex: s.chest.img.texture.key };`) as any;
  expect(after).toEqual({ weapon: before.weapon, armor: before.armor, trinkets: before.trinkets, opened: false, took: 0, tex: `chest_${await room(page, 'return s.chest.tier;')}` });

  // opened again: the same cards, and now one is taken
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').choice, null, { timeout: 5000 });
  expect(await room(page, `return s.chest.items.map((it) => it.name);`)).toEqual(before.cards);
  await page.waitForTimeout(1100);
  await page.keyboard.press('Enter');
  await expect.poll(() => room(page, `return [!!hud.choice, s.chest.opened, s.chest.took.size];`), { timeout: 5000 }).toEqual([false, true, 1]);
  expect(errors).toEqual([]);
});

test('in co-op one player can leave while the other takes, and come back for theirs', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('menu'), null, { timeout: 60_000 });
  await page.evaluate(async () => { (await import('/src/input.ts' as any)).setParty([{ kind: 'left' }, { kind: 'right' }]); });
  await startRoom(page, { room: 1 });
  await room(page, CLEAR);
  await room(page, `s.openChest(s.player);`);
  await page.waitForFunction(() => (window as any).game.scene.getScene('hud').choice?.sides.length === 2, null, { timeout: 5000 });
  await page.waitForTimeout(1100);
  await page.keyboard.press('KeyE'); // player 1 takes a card
  await page.keyboard.press('Numpad2'); // player 2 leaves (back on the right side)
  await expect.poll(() => room(page, `return [!!hud.choice, s.chest.opened, [...s.chest.took]];`), { timeout: 5000 }).toEqual([false, false, [0]]);

  // opened again: only player 2 chooses
  await page.waitForTimeout(800);
  await room(page, `s.openChest(s.heroes[1]);`);
  await page.waitForFunction(() => (window as any).game.scene.getScene('hud').choice?.sides.length === 1, null, { timeout: 5000 });
  await page.waitForTimeout(1100);
  await page.keyboard.press('Numpad1');
  await expect.poll(() => room(page, `return [!!hud.choice, s.chest.opened, [...s.chest.took].sort()];`), { timeout: 5000 }).toEqual([false, true, [0, 1]]);
  await page.evaluate(async () => { (await import('/src/input.ts' as any)).setParty([{ kind: 'solo' }]); });
  expect(errors).toEqual([]);
});
