import { expect, test, type Page } from '@playwright/test';

// Starting a co-op run (DESIGN.md 9.2): New Run asks Solo or Co-op; in the lobby each
// player joins on their own device, player 2 makes a hero the first time, both press
// Ready and the camp opens with those two devices. Real key presses throughout.

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, fn: string) => page.evaluate(`(() => { const game = window.game; ${fn} })()`);

async function waitForScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).game?.scene.isActive(k), key, { timeout: 60_000 });
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  return errors;
}

const shot = async (page: Page, info: any, name: string) => {
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
  await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' });
};

const press = async (page: Page, key: string) => { await page.keyboard.press(key); await page.waitForTimeout(200); };

const lobby = (page: Page) => game(page, `
  const l = game.scene.getScene('lobby');
  return { devices: l.controls.map((c) => c && c.device), status: l.status.text };`) as Promise<{ devices: any[]; status: string }>;

const PLAYER_1 = { name: 'Sigrun', helmet: 1, eyes: 0, armour: 1, skin: 2 };

test('New Run asks Solo or Co-op; Solo goes to the camp as before', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.evaluate((h) => localStorage.setItem('fellspire.hero', JSON.stringify(h)), PLAYER_1);
  await page.reload();
  await waitForScene(page, 'menu');
  await press(page, 'Enter'); // press any key
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // New Run
  expect(await game(page, `return game.scene.getScene('menu').mode;`)).toBe('newrun');
  // Back closes the panel and leaves the menu as it was
  await press(page, 'Escape');
  expect(await game(page, `return game.scene.getScene('menu').mode;`)).toBe('menu');
  await press(page, 'Enter'); // New Run again
  await press(page, 'Enter'); // Solo (focused first)
  await waitForScene(page, 'room');
  expect(await game(page, `const r = game.scene.getScene('room'); return { room: r.room, device: r.player.controls.device };`))
    .toEqual({ room: 0, device: { kind: 'solo' } });
  expect(errors).toEqual([]);
});

test('co-op lobby: join on two keyboard sides, player 2 makes a hero, both ready', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.evaluate((h) => localStorage.setItem('fellspire.hero', JSON.stringify(h)), PLAYER_1);
  await page.reload();
  await waitForScene(page, 'menu');
  await press(page, 'Enter');
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // New Run
  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // Co-op
  await waitForScene(page, 'lobby');
  await page.waitForTimeout(600);
  await shot(page, info, 'coop-1-empty');

  // player 1 joins with J; the press that joined is not also Ready
  await press(page, 'j');
  let l = await lobby(page);
  expect(l.devices).toEqual([{ kind: 'left' }, null]);
  // a second press of J does not take the other slot: it is player 1's Ready
  await press(page, 'j');
  l = await lobby(page);
  expect(l.devices[1]).toBeNull();
  expect(await game(page, `return game.scene.getScene('lobby').status.text;`)).toContain('Two players needed');
  await press(page, 'j'); // not ready again

  // player 2 joins on the numpad and, having no hero yet, makes one first
  await press(page, 'Numpad1');
  await waitForScene(page, 'create');
  expect(await game(page, `const c = game.scene.getScene('create'); return [c.who, c.then];`)).toEqual([1, 'lobby']);
  await page.waitForTimeout(700);
  await shot(page, info, 'coop-2-player2-hero');
  await game(page, `game.scene.getScene('create').finish();`);
  await waitForScene(page, 'lobby');
  // player 1's hero is untouched; player 2's is saved apart
  const heroes = await page.evaluate(() => [localStorage.getItem('fellspire.hero'), localStorage.getItem('fellspire.hero2')].map((s) => s && JSON.parse(s)));
  expect(heroes[0]).toEqual(PLAYER_1);
  expect(heroes[1]?.name).toBeTruthy();
  l = await lobby(page);
  expect(l.devices).toEqual([{ kind: 'left' }, { kind: 'right' }]);

  // player 2 leaves with Num 2 and joins again
  await press(page, 'Numpad2');
  expect((await lobby(page)).devices[1]).toBeNull();
  await press(page, 'Numpad1');
  expect((await lobby(page)).devices[1]).toEqual({ kind: 'right' });

  // both ready: J and Num 1
  await press(page, 'j');
  await page.waitForTimeout(500);
  await shot(page, info, 'coop-3-one-ready');
  expect(await game(page, `return game.scene.isActive('lobby');`)).toBe(true);
  await press(page, 'Numpad1');
  await waitForScene(page, 'room');
  expect(await game(page, `const r = game.scene.getScene('room'); return { room: r.room, device: r.player.controls.device };`))
    .toEqual({ room: 0, device: { kind: 'left' } });
  expect(errors).toEqual([]);
});

test('Esc in the lobby goes back to the title', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?coop');
  await waitForScene(page, 'lobby');
  await page.waitForTimeout(500);
  await press(page, 'Escape');
  await waitForScene(page, 'menu');
  expect(errors).toEqual([]);
});
