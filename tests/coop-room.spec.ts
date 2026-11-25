import { expect, test, type Page } from '@playwright/test';

// Two heroes in a room (DESIGN.md 9.3): each on their own keys and with their own
// gear, the camera keeping both in view and a leash holding them together, enemies
// going for the nearest living hero, and one hero falling while the other fights on.

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
const LEASH = 820;

// Into the camp as two players on one keyboard (left side J, right side Num 1), both
// heroes already made; weapons as remembered from last time.
async function coopCamp(page: Page, weapons: [string, string] = ['sword', 'sword']) {
  await page.goto('/?coop');
  await page.evaluate(([h1, h2, w1, w2]) => {
    localStorage.setItem('fellspire.hero', JSON.stringify(h1));
    localStorage.setItem('fellspire.hero2', JSON.stringify(h2));
    localStorage.setItem('fellspire.weapon', w1 as string);
    localStorage.setItem('fellspire.weapon2', w2 as string);
  }, [PLAYER_1, PLAYER_2, ...weapons] as const);
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

test('two heroes in the camp, each on their own keys, with their own weapon', async ({ page }, info) => {
  const errors = collectErrors(page);
  await coopCamp(page, ['bow', 'staff']);
  const start = await room(page, `return {
    n: s.heroes.length,
    devices: s.heroes.map((h) => h.controls.device),
    who: s.heroes.map((h) => h.who),
    kinds: s.heroes.map((h) => h.stats.kind),
    gear: [s.run.gear.weapon.kind, s.run.gear2.weapon.kind],
    xs: s.heroes.map((h) => h.x),
  };`);
  expect(start.n).toBe(2);
  expect(start.devices).toEqual([{ kind: 'left' }, { kind: 'right' }]);
  expect(start.who).toEqual([0, 1]);
  expect(start.kinds).toEqual(['bow', 'staff']);
  expect(start.gear).toEqual(['bow', 'staff']);
  // both names on the HUD
  const names = await game(page, `return game.scene.getScene('hud').children.list.filter((o) => o.type === 'Text').map((o) => o.text);`) as string[];
  expect(names).toEqual(expect.arrayContaining(['Sigrun', 'Brynja']));
  await shot(page, info, 'coop-camp-two-heroes');

  // D walks player 1 only; the right arrow walks player 2 only
  await page.keyboard.down('d'); await page.waitForTimeout(500); await page.keyboard.up('d');
  await page.waitForTimeout(400); // she eases to a stop
  const afterD = await room<number[]>(page, `return s.heroes.map((h) => h.x);`);
  expect(afterD[0] - start.xs[0]).toBeGreaterThan(40);
  expect(Math.abs(afterD[1] - start.xs[1])).toBeLessThan(2);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  const afterArrow = await room<number[]>(page, `return s.heroes.map((h) => h.x);`);
  expect(Math.abs(afterArrow[0] - afterD[0])).toBeLessThan(2);
  expect(afterArrow[1] - afterD[1]).toBeGreaterThan(40);

  // player 2 takes a weapon at the rack with Num 0, and only player 2's changes
  await room(page, `const r = s.heroes[1]; r.x = 420; r.y = 360; s.heroes[0].x = 300; s.heroes[0].y = 470;`);
  await page.waitForTimeout(200);
  await press(page, 'Numpad0');
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').shop, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  await press(page, 'ArrowRight'); // the next weapon along the grid
  const picked = await game(page, `return game.scene.getScene('hud').shop.selected.kind;`) as string;
  expect(picked).not.toBe('staff');
  await press(page, 'Numpad1');
  await expect.poll(() => room(page, `return [s.run.gear.weapon.kind, s.run.gear2.weapon.kind, s.heroes[0].stats.kind, s.heroes[1].stats.kind, game.scene.isPaused('room')];`), { timeout: 5000 })
    .toEqual(['bow', picked, 'bow', picked, false]);
  expect(await page.evaluate(() => [localStorage.getItem('fellspire.weapon'), localStorage.getItem('fellspire.weapon2')])).toEqual(['bow', picked]);

  // through the gate, each carries their own weapon into room 1
  await room(page, `const [h, g] = s.heroes; h.x = s.world.exit.x; h.y = s.world.exit.y; g.x = h.x - 20; g.y = h.y + 10;`);
  await expect.poll(() => room(page, `return s.room;`), { timeout: 8000 }).toBe(1);
  await page.waitForTimeout(400);
  expect(await room(page, `return s.heroes.map((h) => h.stats.kind);`)).toEqual(['bow', picked]);
  expect(errors).toEqual([]);
});

test('the camera keeps both in view and the leash holds them together', async ({ page }) => {
  const errors = collectErrors(page);
  await coopCamp(page);
  await room(page, `s.heroes[0].x = 300; s.heroes[0].y = 470; s.heroes[1].x = 1050; s.heroes[1].y = 470;`);
  await page.waitForTimeout(300);
  // player 2 walks right, away from player 1, for a long while
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1000); // the camera catches up
  const r = await room(page, `const v = s.cameras.main.worldView; return { xs: s.heroes.map((h) => h.x), view: [v.x, v.right] };`);
  expect(r.xs[1] - r.xs[0]).toBeLessThanOrEqual(LEASH + 1);
  expect(r.xs[1] - r.xs[0]).toBeGreaterThan(LEASH - 20); // they did walk up to it
  expect(Math.abs(r.xs[0] - 300)).toBeLessThan(2); // player 1 was not dragged along
  for (const x of r.xs) {
    expect(x).toBeGreaterThan(r.view[0] + 20);
    expect(x).toBeLessThan(r.view[1] - 20);
  }
  expect(errors).toEqual([]);
});

test('enemies go for the nearest living hero; one falls, the other fights on', async ({ page }, info) => {
  const errors = collectErrors(page);
  await coopCamp(page);
  await room(page, `s.scene.restart({ room: 1 });`);
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.room === 1 && s.enemies.length > 0; }, null, { timeout: 10_000 });
  await page.waitForTimeout(1200);
  await shot(page, info, 'coop-fight');

  const r = await room(page, `
    game.loop.sleep();
    const step = (n) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    const [a, b] = s.heroes;
    const e = s.enemies[0];
    s.enemies.slice(1).forEach((x) => x.destroy());
    s.enemies = [e];
    s.waveDelay = 999;
    e.attackCd = 99;
    a.x = 300; a.y = 470; b.x = 700; b.y = 470; e.x = 640; e.y = 470;
    step(2);
    const out = { first: e.hunted === b };
    // player 1 comes a little nearer: the ghoul keeps its target until player 1 is clearly nearer
    a.x = 600; b.x = 700; e.x = 640; step(2);
    out.kept = e.hunted === b;
    a.x = 660; b.x = 900; e.x = 640; step(2);
    out.switched = e.hunted === a;
    // player 1 falls: the ghoul turns to player 2, the run goes on
    a.invuln = 0; a.state = 'idle'; a.takeHit(999, a.x + 10, 0, false);
    step(3);
    out.dead = a.isDead();
    out.afterFall = e.hunted === b;
    out.ended = !!game.scene.getScene('hud').end;
    out.fallenCounted = s.fallen.has(a);
    // a fallen hero is out of the leash: player 2 may walk off from the body
    a.x = 300; b.x = 1400; step(2);
    out.farFromBody = b.x - a.x;
    game.loop.wake();
    return out;`);
  expect(r).toMatchObject({ first: true, kept: true, switched: true, dead: true, afterFall: true, ended: false, fallenCounted: true });
  expect(r.farFromBody).toBeGreaterThan(LEASH);

  // through the gate: the fallen hero gets back up in the next room, at part health
  await room(page, `s.enemies.forEach((e) => e.takeHit(999, e.x, 0, false)); s.waves = []; s.wave = 0; s.waveDelay = 0;`);
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').gateOpen, null, { timeout: 8000 });
  await room(page, `const h = s.heroes[1]; h.x = s.world.exit.x; h.y = s.world.exit.y;`);
  await expect.poll(() => room(page, `return s.room;`), { timeout: 8000 }).toBe(2);
  await page.waitForTimeout(300);
  const back = await room<[boolean, number, number][]>(page, `return s.heroes.map((h) => [h.isDead(), h.hp, h.maxHp]);`);
  expect(back[0]).toEqual([false, 30, 100]);
  expect(back[1][0]).toBe(false);

  // both fall: the run is over
  await room(page, `for (const h of s.heroes) { h.invuln = 0; h.state = 'idle'; h.takeHit(999, h.x + 10, 0, false); }`);
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').end, null, { timeout: 5000 });
  await page.waitForTimeout(3500);
  await shot(page, info, 'coop-both-fallen');
  expect(errors).toEqual([]);
});
