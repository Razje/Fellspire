import { expect, test, type Page } from '@playwright/test';

// Walks through every screen of the interface, checks each one comes up and
// responds, and saves a full-HD screenshot of each under test-results/ to look at.

test.use({ viewport: { width: 1920, height: 1080 } });

async function waitForScene(page: Page, key: string) {
  await page.waitForFunction((k) => {
    const g = (window as any).game;
    return !!g && g.scene.isActive(k);
  }, key, { timeout: 60_000 });
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

const press = async (page: Page, key: string) => { await page.keyboard.press(key); await page.waitForTimeout(250); };

test('title menu and its panels', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.waitForTimeout(2600);
  await press(page, 'Enter');
  await page.waitForTimeout(600);
  await shot(page, info, '1-title-menu');

  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // Options
  await page.waitForTimeout(300);
  await shot(page, info, '2-options');
  // a slider moves with the arrow keys
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('fellspire.settings') || '{}').master ?? 0.8);
  await press(page, 'ArrowDown'); await press(page, 'ArrowDown'); await press(page, 'ArrowDown'); // to Master volume
  await press(page, 'ArrowLeft');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('fellspire.settings') || '{}').master);
  expect(after).toBeCloseTo(before - 0.1, 5);
  await press(page, 'Escape');
  expect(await page.evaluate(() => (window as any).game.scene.getScene('menu').mode)).toBe('menu');

  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // Credits
  await page.waitForTimeout(300);
  await shot(page, info, '3-credits');
  await press(page, 'Escape');
  expect(errors).toEqual([]);
});

test('HUD, pause menu and end screen', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
  await page.waitForTimeout(1200);
  await shot(page, info, '4-room-banner');

  // a fight: hit a ghoul so the plate and numbers show, take a hit
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    const p = s.player;
    const e = s.enemies[0];
    if (e) { e.x = p.x + 40; e.y = p.y; e.attackCd = 3; }
    p.takeHit(22, p.x + 30, 0, false);
  });
  await page.keyboard.press('j');
  await page.waitForTimeout(160);
  await shot(page, info, '5-hud-fight');

  // Esc pauses: the room stops, the game menu shows
  await press(page, 'Escape');
  const paused = await page.evaluate(() => {
    const g = (window as any).game;
    return { room: g.scene.isPaused('room'), menu: g.scene.getScene('hud').paused };
  });
  expect(paused).toEqual({ room: true, menu: true });
  await page.waitForTimeout(300);
  await shot(page, info, '6-pause');

  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // Options, over the pause menu
  await page.waitForTimeout(300);
  await shot(page, info, '7-pause-options');
  await press(page, 'Escape'); // closes Options
  await press(page, 'Escape'); // resumes
  expect(await page.evaluate(() => (window as any).game.scene.isPaused('room'))).toBe(false);

  // the hero falls: the end screen counts the run up
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    s.run.damage = 432; s.run.kills = 7;
    s.player.takeHit(999, s.player.x + 10, 0, false);
    s.onPlayerDied();
  });
  await page.waitForTimeout(4200);
  await shot(page, info, '8-end-screen');
  const end = await page.evaluate(() => !!(window as any).game.scene.getScene('hud').end);
  expect(end).toBe(true);

  // R tries again: a fresh room 1 with a fresh run
  await press(page, 'r');
  await expect.poll(() => page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    return s.player && !s.player.isDead() && s.run.kills === 0;
  }), { timeout: 5000 }).toBe(true);
  expect(errors).toEqual([]);
});
