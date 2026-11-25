import { expect, test, type Page } from '@playwright/test';

// Going down in co-op (DESIGN.md 9.4): a fallen hero leaves a soul, the other holds
// interact by it to revive her. Letting go in the gold arc gives 60% health, holding
// the ring full 35%; a hit on the reviver costs progress, and she stands still.

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, fn: string) => page.evaluate(`(() => { const game = window.game; ${fn} })()`);
const room = <T = any>(page: Page, fn: string) => game(page, `const s = game.scene.getScene('room'); ${fn}`) as Promise<T>;

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

const PLAYER_1 = { name: 'Sigrun', helmet: 1, eyes: 0, armour: 1, skin: 2 };
const PLAYER_2 = { name: 'Brynja', helmet: 2, eyes: 1, armour: 0, skin: 4 };

// Two players on one keyboard in room 1, the enemies gone and no more waves coming,
// player 1 standing beside player 2, who has just gone down.
async function downInRoom(page: Page) {
  await page.goto('/?coop');
  await page.evaluate(([h1, h2]) => {
    localStorage.setItem('fellspire.hero', JSON.stringify(h1));
    localStorage.setItem('fellspire.hero2', JSON.stringify(h2));
  }, [PLAYER_1, PLAYER_2] as const);
  await page.reload();
  await waitForScene(page, 'lobby');
  await page.waitForTimeout(500);
  for (const k of ['j', 'Numpad1', 'j', 'Numpad1']) await press(page, k);
  await waitForScene(page, 'room');
  await room(page, `s.scene.restart({ room: 1 });`);
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.room === 1 && s.enemies.length > 0; }, null, { timeout: 10_000 });
  await page.waitForTimeout(800);
  await room(page, `
    s.enemies.forEach((e) => e.destroy()); s.enemies = []; s.waveDelay = 999;
    const [a, b] = s.heroes;
    a.x = 640; a.y = 480; b.x = 700; b.y = 480;
    b.invuln = 0; b.state = 'idle'; b.takeHit(999, b.x + 10, 0, false);`);
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').souls.length === 1, null, { timeout: 3000 });
  await page.waitForTimeout(900); // the soul fades in
}

const share = (page: Page) => room<number>(page, `return s.souls[0] ? s.souls[0].share : -1;`);

test('holding the ring full revives her at 35%; the reviver stands still', async ({ page }, info) => {
  const errors = collectErrors(page);
  await downInRoom(page);
  const r0 = await room(page, `const b = s.heroes[1]; return { dead: b.isDead(), dim: b.dim, hint: !!s.souls[0] };`);
  expect(r0).toMatchObject({ dead: true, hint: true });
  expect(r0.dim).toBeLessThan(0.5);
  await shot(page, info, 'revive-soul');

  // holding E with D held too: she does not walk away, the ring fills
  const x0 = await room<number>(page, `return s.heroes[0].x;`);
  await page.keyboard.down('e');
  await page.keyboard.down('d');
  await page.waitForTimeout(1500);
  expect(Math.abs((await room<number>(page, `return s.heroes[0].x;`)) - x0)).toBeLessThan(2);
  expect(await share(page)).toBeGreaterThan(0.3);
  await page.keyboard.up('d');
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').souls[0]?.inSweetSpot, null, { timeout: 3000 });
  await shot(page, info, 'revive-ring');
  // past the gold arc and on to the end
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return !s.heroes[1].isDead(); }, null, { timeout: 3000 });
  await page.keyboard.up('e');
  const r = await room(page, `const b = s.heroes[1]; return { hp: b.hp, max: b.maxHp, souls: s.souls.length, fallen: s.fallen.has(b), dim: b.dim, invuln: b.invuln > 0 };`);
  expect(r).toMatchObject({ hp: 35, max: 100, souls: 0, fallen: false, dim: 1, invuln: true });
  await page.waitForTimeout(300);
  await shot(page, info, 'revive-up');
  expect(errors).toEqual([]);
});

test('letting go in the gold arc revives her at 60%; too early does nothing', async ({ page }) => {
  const errors = collectErrors(page);
  await downInRoom(page);
  // let go too early: still down, and the progress drains after a moment
  await page.keyboard.down('e');
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').souls[0].share > 0.3, null, { timeout: 3000 });
  await page.keyboard.up('e');
  await page.waitForTimeout(200);
  const early = await share(page);
  expect(await room<boolean>(page, `return s.heroes[1].isDead();`)).toBe(true);
  expect(early).toBeGreaterThan(0.25);
  await page.waitForTimeout(1200);
  expect(await share(page)).toBeLessThan(early - 0.15);

  // hold into the gold arc and let go there
  await page.keyboard.down('e');
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room').souls[0]; return s.share > 0.76; }, null, { timeout: 4000, polling: 16 });
  await page.keyboard.up('e');
  await page.waitForFunction(() => !(window as any).game.scene.getScene('room').heroes[1].isDead(), null, { timeout: 2000 });
  expect(await room<number>(page, `return s.heroes[1].hp;`)).toBe(60);
  expect(errors).toEqual([]);
});

test('a hit on the reviver knocks progress off; both down still ends the run', async ({ page }) => {
  const errors = collectErrors(page);
  await downInRoom(page);
  await page.keyboard.down('e');
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').souls[0].share > 0.4, null, { timeout: 3000 });
  const r = await room(page, `
    const a = s.heroes[0], before = s.souls[0].t;
    a.invuln = 0; a.takeHit(5, a.x + 20, 0, false);
    s.update(0, 16.7);
    return { before, after: s.souls[0].t };`);
  expect(r.after).toBeLessThan(r.before - 0.5);
  await page.keyboard.up('e');

  await room(page, `const a = s.heroes[0]; a.invuln = 0; a.state = 'idle'; a.takeHit(999, a.x + 10, 0, false);`);
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').end, null, { timeout: 5000 });
  expect(errors).toEqual([]);
});
