import { expect, test, type Page } from '@playwright/test';

// Embers (step 10.1): earned for kills, cleared rooms and the Warden, banked at
// once in the browser, kept across a reload, shown on the HUD in a room and at
// camp, and counted on the end screen.

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

async function startRoom(page: Page, room: number) {
  await waitForScene(page, 'menu');
  await page.evaluate((n) => (window as any).game.scene.getScene('menu').scene.start('room', { room: n }), room);
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
}

test('embers are earned, banked and kept', async ({ page }) => {
  const errors = collectErrors(page);
  // ten embers from "earlier runs", set once (not again on the reload below)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('fellspire.embers', '10');
    }
  });
  await page.goto('/');
  await startRoom(page, 1);

  const r = await page.evaluate(async () => {
    const E = await import('/src/embers.ts');
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const hud = game.scene.getScene('hud');
    const p = s.player;
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) { s.update(0, 16.7); hud.update(0, 16.7); } };
    const out: Record<string, unknown> = { start: E.embers(), hudStart: hud.emberText.text };
    step(90);
    // one kill: one ember, straight into the bank
    const g = s.enemies[0];
    g.takeHit(999, g.x - 1, 0, false);
    step(2);
    out.afterOne = E.embers();
    // clear the room: every kill and the room itself
    s.waveDelay = 0;
    for (let i = 0; i < 60 * 60 && !s.gateOpen; i++) {
      for (const e of s.enemies) if (!e.isDead()) e.takeHit(999, e.x - 1, 0, false);
      p.hp = p.maxHp;
      step(1);
    }
    step(2);
    out.kills = s.run.kills;
    out.runEmbers = s.run.embers;
    out.bank = E.embers();
    out.stored = localStorage.getItem('fellspire.embers');
    out.hud = hud.emberText.text;
    out.spendTooMuch = E.spendEmbers(100000);
    game.loop.wake();
    return out;
  });
  expect(r.start).toBe(10);
  expect(r.hudStart).toBe('10');
  expect(r.afterOne).toBe(11);
  expect(r.runEmbers).toBe((r.kills as number) * 1 + 5);
  expect(r.bank).toBe(10 + (r.runEmbers as number));
  expect(r.stored).toBe(String(r.bank));
  expect(r.hud).toBe(String(r.bank));
  expect(r.spendTooMuch).toBe(false);

  // the end screen counts this run's embers
  await page.evaluate(() => {
    const g = (window as any).game;
    g.scene.getScene('hud').showVictory(g.scene.getScene('room').run);
  });
  await page.waitForTimeout(4500);
  const texts = await page.evaluate(() => (window as any).game.scene.getScene('hud').children.list
    .flatMap((o: any) => (o.list ?? [o]).map((c: any) => c.text).filter(Boolean)));
  expect(texts).toContain('EMBERS KEPT');
  expect(texts).toContain(`+${r.runEmbers}`);
  await page.screenshot({ path: 'test-results/embers-end.png' });

  // a reload keeps them, and the camp shows the bank
  await page.reload();
  await startRoom(page, 0);
  const camp = await page.evaluate(async () => {
    const E = await import('/src/embers.ts');
    return { bank: E.embers(), hud: (window as any).game.scene.getScene('hud').emberText.text };
  });
  expect(camp.bank).toBe(r.bank);
  expect(camp.hud).toBe(String(r.bank));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/embers-camp.png' });
  expect(errors).toEqual([]);
});

test('in co-op the ember counter sits beside gold and kills', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?coop');
  await page.evaluate(() => {
    localStorage.setItem('fellspire.hero', JSON.stringify({ name: 'Sigrun', helmet: 1, eyes: 0, armour: 1, skin: 2 }));
    localStorage.setItem('fellspire.hero2', JSON.stringify({ name: 'Brynja', helmet: 2, eyes: 1, armour: 0, skin: 4 }));
    localStorage.setItem('fellspire.embers', '42');
  });
  await page.reload();
  await waitForScene(page, 'lobby');
  await page.waitForTimeout(500);
  for (const k of ['j', 'Numpad1', 'j', 'Numpad1']) { await page.keyboard.press(k); await page.waitForTimeout(200); }
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = (window as any).game;
    return { heroes: g.scene.getScene('room').heroes.length, text: g.scene.getScene('hud').emberText.text };
  });
  expect(r).toEqual({ heroes: 2, text: '42' });
  await page.screenshot({ path: 'test-results/embers-coop.png' });
  expect(errors).toEqual([]);
});
