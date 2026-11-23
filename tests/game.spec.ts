import { expect, test, type Page } from '@playwright/test';

// The game exposes itself as window.game in development builds. Tests reach into
// it to read state and, for combat, to run the game logic frame by frame so the
// outcome does not depend on how fast the machine is.

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
    // the browser's own "failed to load resource" line has no URL; the response handler below names it
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return errors;
}

test('title screen comes up without errors', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.waitForTimeout(3500); // let the logo and ribbon fade in

  const texts = await page.evaluate(() =>
    (window as any).game.scene.getScene('menu').children.list
      .filter((o: any) => o.type === 'Text').map((o: any) => [o.text, o.alpha]));
  expect(texts).toContainEqual(['FELLSPIRE', 1]);
  expect(texts).toContainEqual(['Tales of the Blightwood', 1]);

  // the three characters are real art, not the drawn stand-ins
  const art = await page.evaluate(() => {
    const g = (window as any).game;
    return ['hero', 'ghoul', 'archer'].map((k) => !!g.anims.get(`${k}_idle`));
  });
  expect(art).toEqual([true, true, true]);

  await page.screenshot({ path: info.outputPath('title.png') });
  await info.attach('title screen', { path: info.outputPath('title.png'), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('menu responds to the keyboard, one step per key', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page, 'menu');
  const state = () => page.evaluate(() => {
    const m = (window as any).game.scene.getScene('menu');
    return { mode: m.mode, sel: m.sel };
  });
  // a short settle after each key, so a key handled twice would show up as a double move
  const press = async (key: string) => { await page.keyboard.press(key); await page.waitForTimeout(150); };

  await press('Enter'); // "press any key"
  await expect.poll(state).toEqual({ mode: 'menu', sel: 0 });
  await press('ArrowDown');
  expect(await state()).toEqual({ mode: 'menu', sel: 1 });
  await press('Enter'); // Options
  expect(await state()).toMatchObject({ mode: 'options' });
  await press('Escape');
  expect(await state()).toEqual({ mode: 'menu', sel: 1 });
  await press('ArrowUp');
  expect(await state()).toEqual({ mode: 'menu', sel: 0 });
  await press('Enter'); // New Run
  expect(await state()).toMatchObject({ mode: 'leaving' });
  await waitForScene(page, 'room');
});

test('fight scene draws the Blightwood', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');
  await page.waitForTimeout(2600); // fade-in, banner, first wave walking in

  const r = await page.evaluate(() => {
    const g = (window as any).game;
    const s = g.scene.getScene('room');
    const warm = (c: number) => (c >> 16) - (c & 0xff); // red minus blue
    return {
      textures: ['fw_far', 'fw_mid', 'fw_ground', 'fw_front', 'fw_torch', 'hud_frame'].filter((k) => !g.textures.exists(k)),
      nearTorch: warm(s.lightAt(380, 410)),
      inTheDark: warm(s.lightAt(150, 440)),
    };
  });
  expect(r.textures).toEqual([]); // every painted layer exists
  expect(r.nearTorch).toBeGreaterThan(r.inTheDark); // firelight warms a character

  await page.screenshot({ path: info.outputPath('fight.png') });
  await info.attach('fight scene', { path: info.outputPath('fight.png'), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('combat rules hold', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');

  const r = await page.evaluate(() => {
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player;
    game.loop.sleep(); // from here on, only our own steps move the game
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    const press = (k: string) => { p.keys[k].onDown(ev()); step(1); p.keys[k].onUp(ev()); };
    const hold = (k: string, down: boolean) => (down ? p.keys[k].onDown(ev()) : p.keys[k].onUp(ev()));
    const reset = () => { p.hp = 100; p.invuln = 0; p.state = 'idle'; p.facing = 1; p.x = 600; p.y = 440; };
    const out: Record<string, unknown> = {};

    step(90); // the first wave walks in
    out.firstWave = s.enemies.map((e: any) => e.key);

    // keep one ghoul, right in front of the player
    const [g, ...rest] = s.enemies;
    rest.forEach((e: any) => e.destroy());
    s.enemies = [g];
    reset();
    g.x = p.x + 60; g.y = p.y; g.attackCd = 5; g.state = 'idle';
    const before = g.hp;
    press('J'); step(20);
    out.lightHit = before - g.hp;

    // the ghoul's own attack lands on a player who just stands there
    reset();
    g.hp = g.maxHp; g.x = p.x + 60; g.y = p.y; g.attackCd = 0; g.state = 'idle'; g.knockVx = 0;
    step(70);
    out.ghoulHit = 100 - p.hp;
    g.destroy(); s.enemies = [];

    // bones: plain hit, blocked, dodged
    reset(); s.spawnBone(p.x + 200, p.y, -390, 8, 560); step(45);
    out.boneHit = 100 - p.hp;
    reset(); hold('L', true); step(2); s.spawnBone(p.x + 200, p.y, -390, 8, 560); step(45); hold('L', false); step(2);
    out.boneBlocked = 100 - p.hp;
    reset(); s.spawnBone(p.x + 60, p.y, -390, 8, 560); press('SPACE'); step(40);
    out.boneDodged = 100 - p.hp;

    // clear every wave; the exit should open
    for (let i = 0; i < 60 * 60 && !s.gateOpen; i++) {
      for (const e of s.enemies) if (!e.isDead()) e.takeHit(999, e.x - 1, 0, false);
      p.hp = 100;
      step(1);
    }
    out.gateOpen = s.gateOpen;

    // walking into the exit starts the next room (its fade runs on real time)
    p.x = 2340; step(5);
    out.leaving = s.leaving;
    game.loop.wake();
    return out;
  });

  expect(r.firstWave).toEqual(['ghoul', 'ghoul']);
  expect(r.lightHit).toBeGreaterThan(0);
  expect(r.ghoulHit).toBe(10);
  expect(r.boneHit).toBe(8);
  expect(r.boneBlocked).toBe(2); // blocking takes 20%
  expect(r.boneDodged).toBe(0);
  expect(r.gateOpen).toBe(true);
  expect(r.leaving).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('room').room), { timeout: 10_000 }).toBe(2);
  expect(errors).toEqual([]);
});
