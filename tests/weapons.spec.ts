import { expect, test, type Page } from '@playwright/test';

// The weapon types (DESIGN.md 8.4): sword and shield, greatsword, bow and staff.
// Each one's light and heavy attack lands on the camp's training dummy, each
// skill fires on I and then waits out its cooldown, only the shield blocks, and
// the rack offers all four. The game is stepped by hand, frame by frame, so the
// checks do not depend on how fast the test machine is.

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

async function camp(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fellspire.weapon', 'rapier')); // a pick from before 8.4
  await page.goto('/?camp');
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
  await page.waitForTimeout(800);
}

test('every weapon type hits, and its skill fires and cools down', async ({ page }) => {
  const errors = collectErrors(page);
  await camp(page);
  const r = await page.evaluate(async () => {
    const L = await import('/src/loot.ts');
    const W = await import('/src/weapons.ts');
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player, dm = s.dummy;
    const out: Record<string, any> = { saved: s.run.gear.weapon.kind, rack: s.camp.rackItems().map((i: any) => i.kind) };
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    const press = (k: string) => { p.keys[k].onDown(ev()); step(1); p.keys[k].onUp(ev()); };
    const hold = (k: string, n: number) => { p.keys[k].onDown(ev()); step(n); const st = p.state; p.keys[k].onUp(ev()); step(2); return st; };
    // the hero stands left of the dummy, facing it, ready for anything
    const reset = (gap: number) => { step(10); p.hp = p.maxHp; p.invuln = 0; p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = dm.x - gap; p.y = dm.y; p.vx = 0; p.vy = 0; p.knockVx = 0; p.lift = 0; };
    const dealt = (fn: () => void) => { const b = dm.totalDamage; fn(); return dm.totalDamage - b; };

    for (const kind of W.KINDS) {
      s.equip(L.starterWeapon(kind));
      const ranged = !!W.WEAPONS[kind].heavy.shot;
      const gap = ranged ? 260 : 40;
      const o: Record<string, any> = { skill: s.stats.skill };
      reset(gap); o.light = dealt(() => { press('J'); step(60); });
      reset(gap); o.heavy = dealt(() => { press('K'); step(90); });
      reset(gap); o.blockState = hold('L', 10);
      // the skill: damage on the dummy, the cooldown starts, a second press does nothing
      reset(120); p.skillCd = 0;
      o.skillDealt = dealt(() => {
        press('I');
        o.stateAfterPress = p.state;
        o.cdAfterPress = Math.round(p.skillCd * 10) / 10;
        step(260); // long enough for a blizzard to run its course
      });
      o.cooldown = W.SKILLS[s.stats.skill].cooldown;
      reset(120);
      const cdBefore = p.skillCd;
      press('I');
      o.secondPress = { state: p.state, cdStillRunning: p.skillCd < cdBefore && p.skillCd > 0 };
      out[kind] = o;
    }
    game.loop.wake();
    return out;
  });

  expect(r.saved).toBe('sword'); // "rapier" from before 8.4 becomes sword and shield
  expect(r.rack).toEqual(['sword', 'greatsword', 'bow', 'staff']);
  const skills: Record<string, string> = { sword: 'shieldCharge', greatsword: 'leapSlam', bow: 'rainOfArrows', staff: 'blizzard' };
  for (const kind of ['sword', 'greatsword', 'bow', 'staff']) {
    const o = r[kind];
    expect(o.skill, kind).toBe(skills[kind]);
    expect(o.light, `${kind} light`).toBeGreaterThan(0);
    expect(o.heavy, `${kind} heavy`).toBeGreaterThan(o.light);
    expect(o.blockState === 'block', `${kind} block`).toBe(kind === 'sword');
    expect(o.stateAfterPress, `${kind} skill state`).toBe('skill');
    expect(o.cdAfterPress, `${kind} cooldown`).toBe(o.cooldown);
    expect(o.skillDealt, `${kind} skill damage`).toBeGreaterThan(0);
    expect(o.secondPress.state, `${kind} second press`).not.toBe('skill');
    expect(o.secondPress.cdStillRunning, `${kind} still cooling`).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('holding J or K keeps attacking', async ({ page }) => {
  const errors = collectErrors(page);
  await camp(page);
  const r = await page.evaluate(async () => {
    const L = await import('/src/loot.ts');
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player, dm = s.dummy;
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    // count every blow the dummy takes (its own list forgets hits after 5 seconds)
    let n = 0;
    const orig = dm.applyDamage.bind(dm);
    dm.applyDamage = (...a: any[]) => { n++; return orig(...a); };
    const out: Record<string, number> = {};
    for (const [kind, key] of [['sword', 'J'], ['sword', 'K'], ['bow', 'J']] as const) {
      s.equip(L.starterWeapon(kind));
      step(10);
      p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = dm.x - (kind === 'bow' ? 260 : 40); p.y = dm.y;
      const before = n;
      p.keys[key].onDown(ev());
      step(180); // three seconds held
      p.keys[key].onUp(ev());
      step(60);
      out[`${kind}-${key}`] = n - before;
    }
    // one tap is still one blow
    s.equip(L.starterWeapon('sword'));
    step(10);
    p.state = 'idle'; p.stateT = 0; p.x = dm.x - 40; p.y = dm.y;
    const before = n;
    p.keys.J.onDown(ev()); step(1); p.keys.J.onUp(ev()); step(60);
    out.tap = n - before;
    game.loop.wake();
    return out;
  });
  expect(r['sword-J']).toBeGreaterThanOrEqual(6); // the combo comes round again and again
  expect(r['sword-K']).toBeGreaterThanOrEqual(3);
  expect(r['bow-J']).toBeGreaterThanOrEqual(6);
  expect(r.tap).toBe(1);
  expect(errors).toEqual([]);
});

test('skills on real foes: the charge stuns, the blizzard slows, a heavy arrow pierces', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
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
    step(90); // the first wave comes in
    s.waveDelay = 999;
    const foes = s.enemies.filter((e: any) => !e.isDead());
    const reset = () => {
      step(10); // past any hit-stop from the last skill, which holds the whole room still
      p.hp = p.maxHp; p.invuln = 0; p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = 500; p.y = 470; p.skillCd = 0; p.lift = 0;
      foes.forEach((e: any, i: number) => { e.hp = e.maxHp; e.x = 600 + i * 70; e.y = 470; e.attackCd = 99; e.state = 'idle'; e.stateT = 0; e.knockVx = 0; e.slowT = 0; });
    };
    const out: Record<string, any> = { foes: foes.length };

    s.equip(L.starterWeapon('sword'));
    reset(); press('I'); step(8);
    out.stunned = foes[0].state === 'hurt' && foes[0].stateT < -0.8;

    s.equip(L.starterWeapon('staff'));
    reset(); foes.forEach((e: any) => { e.x = 690; }); press('I'); step(40);
    out.slowed = foes.some((e: any) => e.slowT > 0);

    s.equip(L.starterWeapon('bow'));
    reset(); foes.forEach((e: any, i: number) => { e.x = 640 + i * 40; e.maxHp = e.hp = 999; });
    press('K'); step(80);
    out.pierced = foes.filter((e: any) => e.hp < 999).length;
    game.loop.wake();
    return out;
  });
  expect(r.foes).toBeGreaterThanOrEqual(2);
  expect(r.stunned).toBe(true);
  expect(r.slowed).toBe(true);
  expect(r.pierced).toBe(r.foes);
  expect(errors).toEqual([]);
});

test('the four weapons in the hand, and the skill slot', async ({ page }, info) => {
  const errors = collectErrors(page);
  await camp(page);
  for (const kind of ['sword', 'greatsword', 'bow', 'staff']) {
    await page.evaluate(async (k) => {
      const L = await import('/src/loot.ts');
      const g = (window as any).game;
      const s = g.scene.getScene('room');
      s.equip(L.starterWeapon(k));
      g.scene.getScene('hud').refreshGear();
      const p = s.player;
      p.x = 380; p.y = 470; p.facing = 1;
    }, kind);
    await page.waitForTimeout(500);
    await page.screenshot({ path: info.outputPath(`hand-${kind}.png`) });
    await info.attach(`hand-${kind}`, { path: info.outputPath(`hand-${kind}.png`), contentType: 'image/png' });
  }

  // Each weapon caught mid-move: stepped by hand to the moment, then the room is
  // held still (as a hit-stop does) while it keeps drawing, for a close look.
  const poses: [string, string, number][] = [
    ['sword', 'J', 6], ['sword', 'I', 10], ['greatsword', 'K', 20], ['greatsword', 'I', 16],
    ['bow', 'K', 34], ['bow', 'I', 40], ['staff', 'J', 10], ['staff', 'I', 70],
  ];
  for (const [kind, key, frames] of poses) {
    const at = await page.evaluate(async ([k, key, n]) => {
      const L = await import('/src/loot.ts');
      const g = (window as any).game;
      const s = g.scene.getScene('room'), p = s.player;
      s.freeze = 0;
      s.equip(L.starterWeapon(k));
      g.scene.getScene('hud').refreshGear();
      g.loop.sleep();
      const step = (m: number) => { for (let i = 0; i < m; i++) s.update(0, 16.7); };
      p.state = 'idle'; p.stateT = 0; p.x = 330; p.y = 520; p.facing = 1; p.skillCd = 0; p.invuln = 0; p.lift = 0;
      step(12);
      let ts = 1e9;
      const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
      p.keys[key].onDown(ev()); step(1); p.keys[key].onUp(ev()); step(n);
      s.freeze = 9999;
      g.loop.wake();
      const cam = s.cameras.main;
      return { x: (p.x - cam.worldView.x) * 2, y: (p.y - cam.worldView.y) * 2 };
    }, [kind, key, frames] as const);
    await page.waitForTimeout(300);
    const name = `pose-${kind}-${key}`;
    const clip = { x: Math.max(0, at.x - 260), y: Math.max(0, at.y - 300), width: 760, height: 380 };
    await page.screenshot({ path: info.outputPath(`${name}.png`), clip });
    await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' });
  }
  await page.evaluate(() => { (window as any).game.scene.getScene('room').freeze = 0; });
  expect(errors).toEqual([]);
});
