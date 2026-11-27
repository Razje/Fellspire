import { expect, test, type Page } from './fixtures';

// The Lantern Warden: each attack lands on a player who stands there and misses
// one who dodges, the rest window takes extra damage, the lantern breaks at half
// health, the dark hurts, and beating him brings up the victory screen.

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

test('the Lantern Warden fight works', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 3 }));
  await waitForScene(page, 'room');
  expect(await page.evaluate(() => !!(window as any).game.scene.getScene('room').boss)).toBe(false);

  // the boss room starts with the game's clock stopped, stepped by hand until he is there:
  // awake, he summons minions after 6 s, and on a busy machine (tests side by side) a
  // check from outside saw him only after 7 s of game time
  const atStart = await page.evaluate(() => {
    const g = (window as any).game, s = g.scene.getScene('room');
    g.loop.sleep();
    s.scene.restart({ room: 4, intro: false });
    let t = performance.now();
    for (let i = 0; i < 60 && !(s.boss && g.scene.isActive('hud')); i++) { t += 16.7; g.step(t, 16.7); }
    return s.enemies.length;
  });
  await waitForScene(page, 'hud');

  const r = await page.evaluate(() => {
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player, b = s.boss;
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    const until = (f: () => boolean, max = 400) => { for (let i = 0; i < max && !f(); i++) step(1); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    const press = (k: string) => { p.keys[k].onDown(ev()); step(1); p.keys[k].onUp(ev()); };
    const reset = (x: number, y = 457) => {
      p.hp = 100; p.invuln = 0; p.state = 'idle'; p.facing = 1; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.knockVx = 0; p.dodgeCd = 0;
      b.x = 700; b.y = 457; b.attacksSinceRest = 0; b.summonCd = 99; b.setMode('approach');
    };
    const out: Record<string, unknown> = { enemies: s.enemies.length };

    reset(600); b.begin('slam'); until(() => b.mode === 'recover');
    out.slam = 100 - p.hp;

    reset(600); b.begin('slam'); until(() => b.t >= 0.85 - 0.12); press('L'); until(() => b.mode === 'recover');
    out.slamDodged = 100 - p.hp;

    reset(620); b.begin('sweep'); until(() => b.mode === 'recover');
    out.sweep = 100 - p.hp;

    // after enough attacks he rests, and takes half again as much damage
    reset(150); b.attacksSinceRest = 3; b.setMode('recover'); b.recoverFor = 0.05; step(20);
    out.restMode = b.mode;
    out.restHit = b.takeHit(10, b.x - 1, 0, false);

    reset(150); b.begin('summon'); until(() => b.mode === 'recover');
    out.summoned = s.enemies.filter((e: any) => e !== b).length;
    s.enemies.filter((e: any) => e !== b).forEach((e: any) => e.destroy());
    s.enemies = [b];

    // half health: the lantern breaks
    reset(150); b.hp = Math.ceil(b.maxHp * 0.5) + 5; b.takeHit(10, b.x - 1, 0, false);
    out.phase = b.phase; out.stagger = b.mode;
    game.loop.wake();
    return out;
  });
  expect(atStart).toBe(1);
  expect(r.slam).toBe(18);
  expect(r.slamDodged).toBe(0);
  expect(r.sweep).toBe(14);
  expect(r.restMode).toBe('rest');
  expect(r.restHit).toBe(15);
  expect(r.summoned).toBe(2);
  expect(r.phase).toBe(2);
  expect(r.stagger).toBe('stagger');

  // the dark comes in on the real clock
  await page.waitForFunction(() => (window as any).game.scene.getScene('room').darkRadius > 0, null, { timeout: 10_000 });
  const d = await page.evaluate(() => {
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player, b = s.boss;
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    b.setMode('asleep'); // hold him still while the light is checked
    p.hp = 100; p.x = 750; p.y = 470; step(120);
    const inLight = 100 - p.hp;
    p.hp = 100; p.x = 60; p.y = 470; step(120);
    const inDark = 100 - p.hp;
    b.setMode('approach');
    b.takeHit(9999, b.x - 1, 0, false);
    game.loop.wake();
    return { inLight, inDark, dead: b.isDead() };
  });
  expect(d.inLight).toBe(0);
  expect(d.inDark).toBeGreaterThanOrEqual(9);
  expect(d.dead).toBe(true);

  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('hud').endKind), { timeout: 10_000 }).toBe('victory');
  expect(errors).toEqual([]);
});

test.describe('screens', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('boss fight screenshots', async ({ page }, info) => {
    const errors = collectErrors(page);
    const shot = async (name: string) => {
      await page.screenshot({ path: info.outputPath(`${name}.png`) });
      await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' });
    };
    await page.goto('/?boss');
    await waitForScene(page, 'room');
    await page.waitForTimeout(2700);
    await shot('1-intro-card');

    await page.waitForFunction(() => (window as any).game.scene.getScene('room').boss?.awake, null, { timeout: 15_000 });
    // walk up to him and wait for a slam's warning on the floor
    await page.evaluate(() => { const s = (window as any).game.scene.getScene('room'); s.player.x = s.boss.x - 130; s.player.y = s.boss.y; });
    await page.waitForFunction(() => {
      const b = (window as any).game.scene.getScene('room').boss;
      return b.mode === 'windup' && b.t > 0.4;
    }, null, { timeout: 15_000 });
    await shot('2-phase-one');

    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('room');
      s.player.hp = 100;
      s.boss.hp = Math.ceil(s.boss.maxHp * 0.5) + 2;
      s.boss.takeHit(5, s.boss.x - 1, 0, false);
    });
    await page.waitForTimeout(700);
    await shot('3-lantern-shatters');
    await page.waitForTimeout(3800);
    await page.evaluate(() => { (window as any).game.scene.getScene('room').player.hp = 100; });
    await shot('4-circle-of-light');

    await page.evaluate(() => { const b = (window as any).game.scene.getScene('room').boss; b.takeHit(9999, b.x - 1, 0, false); });
    await page.waitForFunction(() => (window as any).game.scene.getScene('hud').endKind === 'victory', null, { timeout: 10_000 });
    await page.waitForTimeout(3500);
    await shot('5-victory');
    expect(errors).toEqual([]);
  });
});
