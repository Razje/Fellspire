import { expect, test, type Page } from './fixtures';

// Camp and loot in co-op (DESIGN.md 9.5): the weapon rack is the turn of whoever
// opened it and answers only their keys; a chest puts one screen up with a side for
// each player, their own random cards and their own cursor; foes have 1.5x health.

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, fn: string) => page.evaluate(`(() => { const game = window.game; ${fn} })()`);
const room = <T = any>(page: Page, fn: string) => game(page, `const s = game.scene.getScene('room'); ${fn}`) as Promise<T>;
const hud = <T = any>(page: Page, fn: string) => game(page, `const h = game.scene.getScene('hud'); ${fn}`) as Promise<T>;

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
// held a few frames: a hero reads interact once a frame
const hold = async (page: Page, key: string) => { await page.keyboard.down(key); await page.waitForTimeout(120); await page.keyboard.up(key); };

const PLAYER_1 = { name: 'Sigrun', helmet: 1, eyes: 0, armour: 1, skin: 2 };
const PLAYER_2 = { name: 'Brynja', helmet: 2, eyes: 1, armour: 0, skin: 4 };

// Into the camp as two players on one keyboard (left side, right side).
async function coopCamp(page: Page) {
  await page.goto('/?coop');
  await page.evaluate(([h1, h2]) => {
    localStorage.setItem('fellspire.hero', JSON.stringify(h1));
    localStorage.setItem('fellspire.hero2', JSON.stringify(h2));
    localStorage.setItem('fellspire.weapon', 'sword');
    localStorage.setItem('fellspire.weapon2', 'sword');
  }, [PLAYER_1, PLAYER_2] as const);
  await page.reload();
  await waitForScene(page, 'lobby');
  await page.waitForTimeout(500);
  await press(page, 'j');
  await press(page, 'Numpad1');
  await press(page, 'j');
  await press(page, 'Numpad1');
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
  await page.waitForTimeout(600);
}

test('the rack is the turn of whoever opened it, on their keys only', async ({ page }, info) => {
  const errors = collectErrors(page);
  await coopCamp(page);
  await room(page, `const r = s.heroes[1]; r.x = 420; r.y = 360; s.heroes[0].x = 250; s.heroes[0].y = 500;`);
  await page.waitForTimeout(200);
  await hold(page, 'Numpad0');
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').shop, null, { timeout: 5000 });
  await page.waitForTimeout(500);
  const texts = await hud<string[]>(page, `return h.shop.root.list.filter((o) => o.type === 'Text').map((o) => o.text);`);
  expect(texts).toContain("BRYNJA'S TURN");
  await shot(page, info, 'rack-player-2-turn');

  // player 1's keys do nothing to player 2's turn
  const sel0 = await hud(page, `return h.shop.selected.name;`);
  await press(page, 'd');
  await press(page, 'r');
  await press(page, 'e');
  expect(await hud(page, `return [!!h.shop, h.shop.tabKey, h.shop.selected.name];`)).toEqual([true, 'all', sel0]);
  // player 2's do: the next weapon, then take it
  await press(page, 'ArrowRight');
  const picked = await hud<string>(page, `return h.shop.selected.kind;`);
  expect(picked).not.toBe('sword');
  await press(page, 'Numpad1');
  await expect.poll(() => room(page, `return [s.run.gear.weapon.kind, s.run.gear2.weapon.kind, game.scene.isPaused('room')];`), { timeout: 5000 })
    .toEqual(['sword', picked, false]);
  expect(errors).toEqual([]);
});

test('a chest gives each player their own cards on one screen', async ({ page }, info) => {
  const errors = collectErrors(page);
  await coopCamp(page);
  await room(page, `s.scene.restart({ room: 1 });`);
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.room === 1 && s.enemies.length > 0; }, null, { timeout: 10_000 });
  // two rolls, one per player
  expect(await room(page, `return [s.chest.items.length, s.chest.items2?.length, s.chest.items !== s.chest.items2];`)).toEqual([3, 3, true]);
  await page.waitForTimeout(800);
  await room(page, `s.enemies.forEach((e) => e.takeHit(9999, e.x, 0, false)); s.waves = []; s.wave = 0; s.waveDelay = 0;`);
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.gateOpen && !s.chest.locked; }, null, { timeout: 8000 });
  await room(page, `const [a, b] = s.heroes; a.x = s.chest.x - 50; a.y = s.chest.y; b.x = s.chest.x + 120; b.y = s.chest.y + 120;`);
  await page.waitForTimeout(200);
  await hold(page, 'e');
  await page.waitForFunction(() => (window as any).game.scene.getScene('hud').choosing, null, { timeout: 5000 });
  await page.waitForTimeout(1400);
  expect(await hud(page, `return h.choice.sides.length;`)).toBe(2);
  const labels = await hud<string[]>(page, `return h.choice.root.list.filter((o) => o.type === 'Text').map((o) => o.text);`);
  expect(labels.some((t) => t.startsWith('SIGRUN'))).toBe(true);
  expect(labels.some((t) => t.startsWith('BRYNJA'))).toBe(true);
  await shot(page, info, 'chest-two-sides');

  // each moves their own cursor: player 1 right, player 2 left
  await press(page, 'd');
  await press(page, 'ArrowLeft');
  expect(await hud(page, `return h.choice.sides.map((sd) => sd.index);`)).toEqual([2, 0]);
  // player 1 takes theirs; the screen waits for player 2
  await press(page, 'e');
  await page.waitForTimeout(800);
  expect(await hud(page, `return [!!h.choice, h.choice.sides.map((sd) => !!sd.taken)];`)).toEqual([true, [true, false]]);
  expect(await page.evaluate(() => (window as any).game.scene.isPaused('room'))).toBe(true);
  await shot(page, info, 'chest-waiting-for-player-2');
  // player 1's keys cannot choose for player 2
  await press(page, 'a');
  expect(await hud(page, `return h.choice.sides[1].index;`)).toBe(0);
  await press(page, 'Numpad1');

  await expect.poll(() => page.evaluate(() => (window as any).game.scene.isPaused('room')), { timeout: 5000 }).toBe(false);
  const got = await room(page, `
    const has = (g, it) => it.cat === 'weapon' ? g.weapon === it : it.cat === 'armor' ? g.armor === it : g.trinkets.includes(it);
    return [has(s.run.gear, s.chest.items[2]), has(s.run.gear2, s.chest.items2[0]),
      has(s.run.gear, s.chest.items2[0]) && s.chest.items2[0].cat !== 'weapon', has(s.run.gear2, s.chest.items[2]) && s.chest.items[2].cat !== 'weapon'];`);
  expect(got).toEqual([true, true, false, false]);
  expect(errors).toEqual([]);
});

test('the gate waits until both living heroes stand in it', async ({ page }, info) => {
  const errors = collectErrors(page);
  await coopCamp(page);
  // player 1 in the gate, player 2 a way off: nothing happens, the gate says who it waits for
  await room(page, `const [a, b] = s.heroes; a.x = s.world.exit.x; a.y = s.world.exit.y; b.x = a.x - 300; b.y = a.y + 60;`);
  await page.waitForTimeout(1200);
  expect(await room(page, `return [s.room, s.leaving, s.gateWait?.text, s.gateWait?.alpha > 0.9];`)).toEqual([0, false, 'Waiting for Brynja', true]);
  await shot(page, info, 'gate-waiting');
  // player 2 steps in too: through they go
  await room(page, `const [a, b] = s.heroes; b.x = a.x + 15; b.y = a.y + 8;`);
  await expect.poll(() => room(page, `return s.room;`), { timeout: 8000 }).toBe(1);

  // a fallen hero does not hold the other back: she gets up in the next room
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.room === 1 && s.enemies.length > 0; }, null, { timeout: 10_000 });
  await room(page, `const a = s.heroes[0]; a.invuln = 0; a.state = 'idle'; a.takeHit(999, a.x + 10, 0, false);
    s.enemies.forEach((e) => e.takeHit(9999, e.x, 0, false)); s.waves = []; s.wave = 0; s.waveDelay = 0;`);
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').gateOpen, null, { timeout: 8000 });
  await room(page, `const b = s.heroes[1]; b.x = s.world.exit.x; b.y = s.world.exit.y;`);
  await expect.poll(() => room(page, `return s.room;`), { timeout: 8000 }).toBe(2);
  expect(errors).toEqual([]);
});

test('foes have 1.5x health with two players, the Warden too', async ({ page }) => {
  const errors = collectErrors(page);
  await coopCamp(page);
  await room(page, `s.scene.restart({ room: 5, intro: false });`);
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('room').boss, null, { timeout: 10_000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const { WARDEN } = await import('/src/entities/Warden.ts');
    const s = (window as any).game.scene.getScene('room');
    const n = s.enemies.length;
    s.summonMinions(1);
    const m = s.enemies[n];
    return { warden: s.boss.maxHp, full: s.boss.hp, base: WARDEN.hp, minion: m.maxHp };
  });
  expect(r.warden).toBe(Math.round(r.base * 1.5));
  expect(r.full).toBe(r.warden);
  expect(r.minion).toBe(Math.round(Math.round(34 * 1.2) * 1.5));
  expect(errors).toEqual([]);
});
