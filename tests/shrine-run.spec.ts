import { expect, test, type Page } from './fixtures';

// The ember shrine's upgrades count in a run (step 10.3): learned ranks add to the
// hero's numbers, and the shrine's own upgrades each have their rule: skills and
// dodges recharge sooner, a dodge stays untouchable longer, gold comes in larger,
// a run starts with gold, chests show a fourth card, and Undying gets a hero up
// from her first fall of a run.

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

// Every upgrade at its top rank (Keen Eye has one, Undying one).
const FULL = {
  vigour: 3, edge: 3, bulwark: 3, keen: 3, thorns: 3, executioner: 2, bloodthirst: 2,
  focus: 3, fleetfoot: 3, swiftstep: 3, kindling: 3, rime: 3, storm: 2,
  greed: 3, keeneye: 1, packed: 3, lucky: 3, undying: 1,
};

async function learned(page: Page, ranks: Record<string, number>) {
  await page.addInitScript((r) => localStorage.setItem('fellspire.shrine', JSON.stringify(r)), ranks);
}

async function startRoom(page: Page) {
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
}

const heroNumbers = (page: Page) => page.evaluate(() => {
  const s = (window as any).game.scene.getScene('room');
  const p = s.player;
  return {
    maxHp: p.maxHp, fx: p.stats.fx, skillCdMax: p.skillCdMax, skillBase: p.skill.cooldown,
    dodgeCdMax: p.dodgeCdMax, dodgeSafe: p.dodgeSafe, cards: s.chest?.items.length,
  };
});

test('with nothing learned a hero starts as before', async ({ page }) => {
  const errors = collectErrors(page);
  await startRoom(page);
  const n = await heroNumbers(page);
  expect(n.maxHp).toBe(100);
  expect(n.fx.damage).toBe(0);
  expect(n.skillCdMax).toBe(n.skillBase);
  expect(n.dodgeCdMax).toBeCloseTo(0.55);
  expect(n.dodgeSafe).toBeCloseTo(0.3);
  expect(n.cards).toBe(3);
  expect(errors).toEqual([]);
});

test('learned upgrades add to the hero, the chest and the gold', async ({ page }) => {
  const errors = collectErrors(page);
  await learned(page, FULL);
  await startRoom(page);
  const n = await heroNumbers(page);
  expect(n.maxHp).toBe(130); // Vigour 3 x 10
  expect(n.fx.damage).toBeCloseTo(0.15); // Edge
  expect(n.fx.armor).toBeCloseTo(0.12); // Bulwark
  expect(n.fx.crit).toBeCloseTo(0.12); // Keen Strikes
  expect(n.fx.thorns).toBe(9);
  expect(n.fx.execute).toBeCloseTo(0.3);
  expect(n.fx.lifeOnKill).toBe(4);
  expect(n.fx.burn).toBe(6);
  expect(n.fx.frost).toBeCloseTo(1.5);
  expect(n.fx.storm).toBe(12);
  expect(n.fx.orbs).toBeCloseTo(0.6);
  expect(n.skillCdMax).toBeCloseTo(n.skillBase * 0.76); // Focus 3 x 8%
  expect(n.dodgeCdMax).toBeCloseTo(0.55 * 0.82); // Swift Step 3 x 6%
  expect(n.dodgeSafe).toBeCloseTo(0.42); // Fleetfoot 3 x 40 ms
  expect(n.cards).toBe(4); // Keen Eye

  const r = await page.evaluate(() => {
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player;
    game.loop.sleep();
    const step = (k: number) => { for (let i = 0; i < k; i++) s.update(0, 16.7); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    const press = (k: string) => { p.keys[k].onDown(ev()); step(1); p.keys[k].onUp(ev()); };
    step(10);
    const out: Record<string, number> = {};
    // the skill and the dodge are set to their shortened cooldowns when used
    press('I'); out.skillCd = p.skillCd;
    step(200); p.state = 'idle';
    press('L'); out.invuln = p.invuln; out.dodgeCd = p.dodgeCd;
    // Greed 3: 100 coins become 130 or so (the fraction rounds by chance; here none)
    const before = s.coins.length;
    s.spawnCoins(p.x, p.y, 100);
    out.coins = s.coins.length - before;
    game.loop.wake();
    return out;
  });
  expect(r.skillCd).toBeCloseTo(n.skillCdMax, 1);
  expect(r.invuln).toBeCloseTo(0.42, 1);
  expect(r.dodgeCd).toBeCloseTo(0.55 * 0.82, 1);
  expect(r.coins).toBe(130);
  expect(errors).toEqual([]);
});

test('Packed Bags: the run through the camp gate starts with gold', async ({ page }) => {
  const errors = collectErrors(page);
  await learned(page, { greed: 1, packed: 2 });
  await page.goto('/?camp');
  await waitForScene(page, 'room');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    const p = s.player; p.x = s.world.exit.x; p.y = s.world.exit.y;
  });
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').room === 1, null, { timeout: 15_000 });
  expect(await page.evaluate(() => (window as any).game.scene.getScene('room').run.gold)).toBe(50);
  expect(errors).toEqual([]);
});

test('Undying: the first fall of a run is not the end, the second is', async ({ page }, info) => {
  const errors = collectErrors(page);
  await learned(page, { greed: 1, keeneye: 1, lucky: 1, undying: 1 });
  await startRoom(page);
  await page.waitForTimeout(800);
  const first = await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    const p = s.player;
    p.invuln = 0; p.state = 'idle';
    p.takeHit(999, p.x + 10, 0, false);
    return { hp: p.hp };
  });
  expect(first.hp).toBe(0);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    const p = s.player;
    return { hp: p.hp, dead: p.isDead(), risen: s.run.risen, invuln: p.invuln > 0 };
  });
  expect(after.dead).toBe(false);
  expect(after.hp).toBe(30); // 30% of 100
  expect(after.risen).toEqual([0]);
  expect(after.invuln).toBe(true);
  await page.screenshot({ path: info.outputPath('undying.png') });
  await info.attach('undying', { path: info.outputPath('undying.png'), contentType: 'image/png' });

  // spent for this run: carried into the next room, and a second fall ends it
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('room');
    const p = s.player;
    p.invuln = 0; p.state = 'idle';
    p.takeHit(999, p.x + 10, 0, false);
  });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('room').player.isDead())).toBe(true);
  expect(errors).toEqual([]);
});

test.describe('co-op', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('Keen Eye in co-op: four cards a side on one screen', async ({ page }, info) => {
    const errors = collectErrors(page);
    await learned(page, { greed: 1, keeneye: 1 });
    await page.goto('/?coop');
    await page.evaluate(() => {
      localStorage.setItem('fellspire.hero', JSON.stringify({ name: 'Sigrun', helmet: 1, eyes: 0, armour: 1, skin: 2 }));
      localStorage.setItem('fellspire.hero2', JSON.stringify({ name: 'Brynja', helmet: 2, eyes: 1, armour: 0, skin: 4 }));
    });
    await page.reload();
    await waitForScene(page, 'lobby');
    await page.waitForTimeout(500);
    for (const k of ['j', 'Numpad1', 'j', 'Numpad1']) { await page.keyboard.press(k); await page.waitForTimeout(200); }
    await waitForScene(page, 'room');
    await waitForScene(page, 'hud');
    await page.waitForTimeout(600);
    await page.evaluate(() => (window as any).game.scene.getScene('room').scene.restart({ room: 1 }));
    await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.room === 1 && s.enemies.length > 0; }, null, { timeout: 10_000 });
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => { const c = (window as any).game.scene.getScene('room').chest; return [c.items.length, c.items2.length]; })).toEqual([4, 4]);
    await page.evaluate(() => { const s = (window as any).game.scene.getScene('room'); s.enemies.forEach((e: any) => e.takeHit(9999, e.x, 0, false)); s.waves = []; s.wave = 0; s.waveDelay = 0; });
    await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.gateOpen && !s.chest.locked; }, null, { timeout: 8000 });
    await page.evaluate(() => { const s = (window as any).game.scene.getScene('room'); const [a, b] = s.heroes; a.x = s.chest.x - 50; a.y = s.chest.y; b.x = s.chest.x + 120; b.y = s.chest.y + 120; });
    await page.waitForTimeout(200);
    await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e');
    await page.waitForFunction(() => (window as any).game.scene.getScene('hud').choosing, null, { timeout: 5000 });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: info.outputPath('coop-four-cards.png') });
    await info.attach('coop-four-cards', { path: info.outputPath('coop-four-cards.png'), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
});
