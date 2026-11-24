import { expect, test, type Page } from '@playwright/test';

// Gold, breakable props, the room chest and its three cards, and gear that
// really changes the numbers. The loot module is imported straight from the dev
// server, so tests use the same code the game does.

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

async function startRoom(page: Page) {
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
}

test('chests offer three of a kind', async ({ page }) => {
  await startRoom(page);
  const r = await page.evaluate(async () => {
    const L = await import('/src/loot.ts');
    const bad: string[] = [];
    const cats = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const items = L.rollChest(1 + (i % 4));
      if (items.length !== 3) bad.push('count');
      if (new Set(items.map((x: any) => x.cat)).size !== 1) bad.push('mixed');
      if (items.some((x: any) => !['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(x.rarity))) bad.push('rarity');
      if (items[0].cat === 'trinket' && new Set(items.map((x: any) => x.name)).size !== 3) bad.push('same trinket twice');
      cats.add(items[0].cat);
    }
    return { bad, cats: [...cats].sort() };
  });
  expect(r.bad).toEqual([]);
  expect(r.cats).toEqual(['armor', 'trinket', 'weapon']);
});

test('gold, barrels, the chest and gear', async ({ page }) => {
  const errors = collectErrors(page);
  await startRoom(page);

  const r = await page.evaluate(async () => {
    const L = await import('/src/loot.ts');
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player;
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    const press = (k: string) => { p.keys[k].onDown(ev()); step(1); p.keys[k].onUp(ev()); };
    const reset = (x = 750, y = 470) => { p.hp = p.maxHp; p.invuln = 0; p.state = 'idle'; p.facing = 1; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.knockVx = 0; };
    const out: Record<string, unknown> = {};

    step(90);
    const [g, ...rest] = s.enemies;
    rest.forEach((e: any) => e.destroy());
    s.enemies = [g];
    s.waveDelay = 999;

    // a light hit with the starting sword, then with a greatsword
    const hitWith = () => { reset(); g.hp = g.maxHp; g.x = p.x + 40; g.y = p.y; g.attackCd = 9; g.state = 'idle'; g.knockVx = 0; const b = g.hp; press('J'); step(25); return b - g.hp; };
    out.sword = hitWith();
    s.equip(L.makeWeapon('common', Math.random, 'greatsword'));
    out.greatsword = hitWith();

    // armor: more health, less damage from a bone
    s.equip(L.makeArmor('epic'));
    out.maxHp = p.maxHp;
    reset(); s.spawnBone(p.x + 200, p.y, -390, 8, 560); step(45);
    out.boneWithArmor = p.maxHp - p.hp;

    // gold: a ghoul's coins land and come to you
    reset(); g.x = p.x + 30; g.y = p.y; g.takeHit(999, p.x, 0, false);
    const before = s.run.gold;
    step(120);
    out.gold = s.run.gold - before;

    // a barrel splinters after two light hits, and stops blocking the way
    const b = s.world.breakables[0];
    const obstaclesBefore = s.world.obstacles.length;
    reset(b.x - 34, b.y);
    press('J'); step(30); press('J'); step(30);
    out.barrelHp = b.hp;
    out.obstacleGone = s.world.obstacles.length === obstaclesBefore - 1;

    // clear the room: the chest comes, E next to it opens it
    out.sealedAtStart = s.chest.locked;
    s.waveDelay = 0;
    for (let i = 0; i < 60 * 60 && !s.gateOpen; i++) {
      for (const e of s.enemies) if (!e.isDead()) e.takeHit(999, e.x - 1, 0, false);
      p.hp = p.maxHp;
      step(1);
    }
    out.chest = !!s.chest && !s.chest.locked;
    s.chest.items = L.rollChest(1, Math.random, 'trinket');
    reset(s.chest.x - 50, s.chest.y);
    press('E'); step(2);
    out.opened = s.chest.opened;
    game.loop.wake();
    return out;
  });
  expect(r.greatsword as number).toBeGreaterThan(r.sword as number);
  expect(r.maxHp).toBe(140);
  expect(r.boneWithArmor).toBe(7); // 8 less 15%
  expect(r.gold as number).toBeGreaterThanOrEqual(2);
  expect(r.barrelHp as number).toBeLessThanOrEqual(0);
  expect(r.obstacleGone).toBe(true);
  expect(r.sealedAtStart).toBe(true);
  expect(r.chest).toBe(true);
  expect(r.opened).toBe(true);

  // the three cards come up over a paused room; take the middle one with E
  await page.waitForFunction(() => (window as any).game.scene.getScene('hud').choosing, null, { timeout: 5000 });
  expect(await page.evaluate(() => (window as any).game.scene.isPaused('room'))).toBe(true);
  await page.waitForTimeout(900);
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => {
    const g = (window as any).game;
    return { trinkets: g.scene.getScene('room').run.gear.trinkets.length, paused: g.scene.isPaused('room') };
  }), { timeout: 5000 }).toEqual({ trinkets: 1, paused: false });
  expect(errors).toEqual([]);
});

test('each effect does what it says', async ({ page }) => {
  const errors = collectErrors(page);
  await startRoom(page);
  const r = await page.evaluate(() => {
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player;
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    const press = (k: string) => { p.keys[k].onDown(ev()); step(1); p.keys[k].onUp(ev()); };
    const reset = () => { p.hp = p.maxHp; p.invuln = 0; p.state = 'idle'; p.facing = 1; p.x = 750; p.y = 470; p.vx = 0; p.vy = 0; p.knockVx = 0; };
    const trinket = (effects: any) => s.equip({ cat: 'trinket', name: 'Test', rarity: 'rare', icon: 'ring', effects });
    const clearGear = () => { s.run.gear.trinkets = []; s.equip({ cat: 'trinket', name: 'none', rarity: 'common', icon: 'ring', effects: {} }); s.run.gear.trinkets = []; s.equip(s.run.gear.weapon); };
    step(90);
    const [g, h, ...rest] = s.enemies;
    rest.forEach((e: any) => e.destroy());
    s.enemies = [g, h];
    s.waveDelay = 999;
    const place = () => { reset(); s.fires.forEach((f: any) => { f.left = 0; }); s.updateFires(0); for (const e of [g, h]) { e.hp = e.maxHp; e.attackCd = 99; e.state = 'idle'; e.knockVx = 0; e.slowT = 0; } g.x = p.x + 40; g.y = p.y; h.x = p.x + 140; h.y = p.y + 60; };
    const out: Record<string, unknown> = {};

    clearGear(); trinket({ frost: 1.5 }); place(); press('J'); step(20);
    out.slowed = g.slowT > 0;

    clearGear(); trinket({ storm: 20 }); place(); s.hitCount = 4; press('J'); step(20);
    out.stormOnOther = h.maxHp - h.hp;

    clearGear(); trinket({ burn: 5 }); place(); g.hp = 500; press('K'); step(50);
    out.fires = s.fires.length;
    const afterHeavy = g.hp; g.x = s.fires[0]?.x ?? g.x; g.y = s.fires[0]?.y ?? g.y; step(70);
    out.burned = afterHeavy - g.hp;

    clearGear(); trinket({ thorns: 6 }); place(); g.attackCd = 0; step(70);
    out.thorns = g.maxHp - g.hp;

    clearGear(); trinket({ secondWind: 20 }); place(); p.hp = 25; s.secondWindUsed = false; s.spawnBone(p.x + 200, p.y, -390, 8, 560); g.x = 200; step(45);
    out.afterSecondWind = p.hp;

    clearGear(); trinket({ lifeOnKill: 4 }); place(); p.hp = 50; g.takeHit(999, p.x, 0, false); step(2);
    out.afterKill = p.hp;
    game.loop.wake();
    return out;
  });
  expect(r.slowed).toBe(true);
  expect(r.stormOnOther).toBe(20);
  expect(r.fires).toBe(1);
  expect(r.burned as number).toBeGreaterThanOrEqual(5);
  expect(r.thorns).toBe(6);
  expect(r.afterSecondWind).toBe(37); // 25, less 8, then healed 20
  expect(r.afterKill).toBe(54);
  expect(errors).toEqual([]);
});

test.describe('screens', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('loot screenshots', async ({ page }, info) => {
    const errors = collectErrors(page);
    const shot = async (name: string) => {
      await page.screenshot({ path: info.outputPath(`${name}.png`) });
      await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' });
    };
    await startRoom(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = (window as any).game.scene.getScene('room'); s.player.x = s.chest.x - 120; s.player.y = s.chest.y + 60; });
    await page.waitForTimeout(3200);
    await shot('0-chest-sealed');
    // clear the room for real time, so the light falls on the chest
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('room');
      s.waves = s.waves.slice(0, 1);
      s.player.x = 600; s.player.y = 470;
    });
    await page.waitForFunction(() => {
      const s = (window as any).game.scene.getScene('room');
      for (const e of s.enemies) if (!e.isDead()) e.takeHit(999, e.x - 1, 0, false);
      return s.gateOpen;
    }, null, { timeout: 15_000, polling: 200 });
    await page.evaluate(() => { const s = (window as any).game.scene.getScene('room'); s.player.x = s.chest.x - 56; s.player.y = s.chest.y + 4; });
    await page.waitForTimeout(1600);
    await shot('1-chest');

    const choose = async (cat: string, name: string) => {
      await page.evaluate(async (c) => {
        const L = await import('/src/loot.ts');
        const g = (window as any).game;
        const s = g.scene.getScene('room'), h = g.scene.getScene('hud');
        // one of each of the better rarities, so the cards show the range
        const r = ['uncommon', 'rare', 'epic'];
        const items = c === 'weapon' ? r.map((x, i) => L.makeWeapon(x, Math.random, ['sword', 'bow', 'staff'][i]))
          : c === 'armor' ? r.map((x) => L.makeArmor(x)) : r.map((x, i) => L.makeTrinket(x, Math.random, i ? [] : []));
        s.scene.pause();
        h.openChest(items, s.run.gear, (it: any) => { s.equip(it); s.scene.resume(); });
      }, cat);
      await page.waitForTimeout(1300);
      await shot(name);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
      await page.keyboard.press('e');
      await page.waitForTimeout(1200);
    };
    await choose('weapon', '2-choose-weapon');
    await choose('armor', '3-choose-armor');
    await choose('trinket', '4-choose-trinket');
    await page.evaluate(async () => {
      const L = await import('/src/loot.ts');
      const s = (window as any).game.scene.getScene('room');
      s.equip(L.makeTrinket('legendary'));
      s.equip(L.makeTrinket('common'));
      (window as any).game.scene.getScene('hud').refreshGear();
    });
    await page.mouse.move(900, 700);
    await page.mouse.move(776, 984, { steps: 6 }); // over the weapon slot
    await page.waitForTimeout(400);
    await shot('5-hud-gear-tooltip');
    expect(errors).toEqual([]);
  });
});
