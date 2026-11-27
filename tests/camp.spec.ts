import { expect, test, type Page } from './fixtures';

// The camp between runs (DESIGN.md 8.3): New Run lands there, the rack opens as
// a store with tabs and a comparison (8.6) and remembers the pick, the training dummy takes blows and never
// falls, and the rune gate starts room 1 with the chosen weapon.

test.use({ viewport: { width: 1920, height: 1080 } });

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

const room = <T>(page: Page, fn: string): Promise<T> =>
  page.evaluate(`(() => { const game = window.game; const s = game.scene.getScene('room'); ${fn} })()`) as Promise<T>;

test('New Run goes to the camp', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fellspire.hero', JSON.stringify({ name: 'Sigrun', helmet: 0, eyes: 0, armour: 0, skin: 0 })));
  await page.reload();
  await waitForScene(page, 'menu');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter'); // opens the menu
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter'); // New Run
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); // Solo
  await waitForScene(page, 'room');
  expect(await room(page, 'return s.isCamp;')).toBe(true);
  expect(errors).toEqual([]);
});

test('the camp: rack, dummy and gate', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('fellspire.weapon'));
  await page.goto('/?camp');
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
  await page.waitForTimeout(1500);

  // a camp, no waves, the gate already open, a sword and shield to start with
  expect(await room(page, `return {
    camp: s.isCamp, waves: s.waveCount, gate: s.gateOpen, dummy: !!s.dummy, weapon: s.run.gear.weapon.kind,
  };`)).toEqual({ camp: true, waves: 0, gate: true, dummy: true, weapon: 'sword' });
  await shot(page, info, 'camp-1-arrival');

  // E beside the rack: the store opens over the paused camp, on the All tab with
  // the sword in your hand selected and compared with itself
  await room(page, 'const p = s.player; p.x = 420; p.y = 360;');
  await page.waitForTimeout(300);
  // held for a few frames: the hero reads E once per frame
  await page.keyboard.down('e');
  await page.waitForTimeout(120);
  await page.keyboard.up('e');
  await page.waitForFunction(() => (window as any).game.scene.getScene('hud').choosing, null, { timeout: 5000 });
  expect(await page.evaluate(() => (window as any).game.scene.isPaused('room'))).toBe(true);
  const shop = () => page.evaluate(() => {
    const sh = (window as any).game.scene.getScene('hud').shop;
    if (!sh) return null;
    const b = sh.root.getBounds();
    return { tab: sh.tabKey, n: sh.list().length, sel: sh.selected?.kind, slots: sh.slots.length, left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  });
  await page.waitForTimeout(500);
  await shot(page, info, 'camp-2-rack');
  const first = await shop();
  expect(first).toMatchObject({ tab: 'all', n: 8, sel: 'sword', slots: 8 });
  expect(first!.left).toBeGreaterThanOrEqual(0); // all on screen (960 x 540)
  expect(first!.right).toBeLessThanOrEqual(960);
  expect(first!.top).toBeGreaterThanOrEqual(0);
  expect(first!.bottom).toBeLessThanOrEqual(540);

  // R opens the next tab, which holds only that type; Q goes back to All
  await page.keyboard.press('r');
  await page.waitForTimeout(150);
  expect(await shop()).toMatchObject({ tab: 'sword', n: 1, sel: 'sword' });
  await page.keyboard.press('q');
  await page.waitForTimeout(150);
  await page.keyboard.press('q');
  await page.waitForTimeout(150);
  expect(await shop()).toMatchObject({ tab: 'revolvers', n: 1, sel: 'revolvers' });
  await shot(page, info, 'camp-3-rack-tab');
  await page.keyboard.press('r');
  await page.waitForTimeout(150);
  expect(await shop()).toMatchObject({ tab: 'all' });

  // Esc walks away without changing anything
  await page.keyboard.press('Escape');
  await expect.poll(() => room(page, 'return [s.run.gear.weapon.kind, game.scene.isPaused("room"), !!game.scene.getScene("hud").shop];'), { timeout: 5000 })
    .toEqual(['sword', false, false]);

  // again, and through the grid: D three times is the bow, S goes down a row to the
  // revolvers' column, W comes back, and E takes the bow
  await page.waitForTimeout(300);
  await page.keyboard.down('e');
  await page.waitForTimeout(120);
  await page.keyboard.up('e');
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').shop, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  for (const k of ['d', 'd', 'd']) { await page.keyboard.press(k); await page.waitForTimeout(120); }
  expect((await shop())!.sel).toBe('bow');
  await page.keyboard.press('s');
  await page.waitForTimeout(120);
  expect((await shop())!.sel).toBe('bow'); // nothing below the bow (two in the second row)
  await page.keyboard.press('a'); await page.waitForTimeout(120);
  await page.keyboard.press('a'); await page.waitForTimeout(120);
  await page.keyboard.press('a'); await page.waitForTimeout(120);
  await page.keyboard.press('s'); await page.waitForTimeout(120);
  expect((await shop())!.sel).toBe('blunderbuss');
  await shot(page, info, 'camp-4-rack-compare');
  await page.keyboard.press('w'); await page.waitForTimeout(120);
  for (const k of ['d', 'd', 'd']) { await page.keyboard.press(k); await page.waitForTimeout(120); }
  expect((await shop())!.sel).toBe('bow');
  await page.keyboard.press('e');
  await expect.poll(() => room(page, 'return [s.run.gear.weapon.kind, s.stats.kind, game.scene.isPaused("room")];'), { timeout: 5000 })
    .toEqual(['bow', 'bow', false]);
  expect(await page.evaluate(() => localStorage.getItem('fellspire.weapon'))).toBe('bow');

  // the dummy takes every blow and stays standing, and shows damage per second
  const d = await room<{ dealt: number[]; hp: number; max: number; dead: boolean; total: number; x: number }>(page, `
    const p = s.player, dm = s.dummy;
    p.x = dm.x - 40; p.y = dm.y; p.facing = 1;
    const dealt = [];
    for (let i = 0; i < 30; i++) dealt.push(s.resolveMelee(p, { dmg: 50, range: 60, depth: 20, knock: 300, heavy: true }, s.enemies));
    return { dealt, hp: dm.hp, max: dm.maxHp, dead: dm.isDead(), total: dm.totalDamage, x: dm.x };
  `);
  expect(d.dealt.every((n) => n === 1)).toBe(true);
  expect(d.dead).toBe(false);
  expect(d.hp).toBe(d.max);
  expect(d.total).toBeGreaterThanOrEqual(30 * 50);
  expect(d.x).toBe(470); // knockback does not move it
  await expect.poll(() => room(page, 'return s.dummy.dps;'), { timeout: 3000 }).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await shot(page, info, 'camp-5-dummy');

  // into the rune gate: room 1, holding the bow, the run's numbers fresh
  await room(page, 'const p = s.player; p.x = s.world.exit.x; p.y = s.world.exit.y;');
  await expect.poll(() => room(page, 'return s.room;'), { timeout: 10_000 }).toBe(1);
  await waitForScene(page, 'room');
  expect(await room(page, 'return [s.run.gear.weapon.kind, s.run.damage, s.run.rooms, !!s.dummy];')).toEqual(['bow', 0, 0, false]);

  // a fresh visit to the camp remembers the pick
  await page.goto('/?camp');
  await waitForScene(page, 'room');
  expect(await room(page, 'return s.run.gear.weapon.kind;')).toBe('bow');
  expect(errors).toEqual([]);
});
