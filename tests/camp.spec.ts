import { expect, test, type Page } from '@playwright/test';

// The camp between runs (DESIGN.md 8.3): New Run lands there, the rack offers
// the weapons and remembers the pick, the training dummy takes blows and never
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

  // E beside the rack: six cards over the paused camp, the focused one on top at
  // full size; D twice and E takes the bow
  await room(page, 'const p = s.player; p.x = 420; p.y = 360;');
  await page.waitForTimeout(300);
  // held for a few frames: the hero reads E once per frame
  await page.keyboard.down('e');
  await page.waitForTimeout(120);
  await page.keyboard.up('e');
  await page.waitForFunction(() => (window as any).game.scene.getScene('hud').choosing, null, { timeout: 5000 });
  expect(await page.evaluate(() => (window as any).game.scene.isPaused('room'))).toBe(true);
  const heading = await page.evaluate(() => (window as any).game.scene.getScene('hud').children.list
    .flatMap((o: any) => (o.list ?? [o])).some((o: any) => o.type === 'Text' && o.text === 'CHOOSE YOUR WEAPON'));
  expect(heading).toBe(true);
  await page.waitForTimeout(900);
  await shot(page, info, 'camp-2-rack');
  const cards = await page.evaluate(() => {
    const ch = (window as any).game.scene.getScene('hud').choice;
    const vis = ch.cards.map((c: any) => { const b = c.getBounds(); return { l: b.left, r: b.right, scale: c.scale }; });
    return { n: ch.cards.length, vis, top: ch.root.list.indexOf(ch.cards[ch.index]) > ch.root.list.indexOf(ch.cards[0]) };
  });
  expect(cards.n).toBe(6);
  expect(Math.min(...cards.vis.map((v: any) => v.l))).toBeGreaterThanOrEqual(0); // all on screen (960 wide)
  expect(Math.max(...cards.vis.map((v: any) => v.r))).toBeLessThanOrEqual(960);
  expect(Math.max(...cards.vis.map((v: any) => v.scale))).toBeGreaterThanOrEqual(1); // the focused card at full size
  expect(cards.top).toBe(true);
  await page.keyboard.press('d');
  await page.waitForTimeout(150);
  await page.keyboard.press('d');
  await page.waitForTimeout(150);
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
  await shot(page, info, 'camp-3-dummy');

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
