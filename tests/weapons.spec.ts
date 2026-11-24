import { expect, test, type Page } from '@playwright/test';

// The weapon types (DESIGN.md 8.4 to 8.6): sword and shield, greatsword, dual
// blades, bow, staff, wand, blunderbuss and dual revolvers.
// Each one's light and heavy attack lands on the camp's training dummy, each
// skill fires on I and then waits out its cooldown, only the shield blocks, and
// the rack offers all eight. The game is stepped by hand, frame by frame, so the
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
      const gap = kind === 'blunderbuss' ? 100 : ranged ? 260 : 40;
      const o: Record<string, any> = { skill: s.stats.skill };
      reset(gap); o.light = dealt(() => { press('J'); step(60); });
      reset(gap); o.heavy = dealt(() => { press('K'); step(90); });
      reset(gap); o.blockState = hold('SHIFT', 10);
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

  expect(r.saved).toBe('blades'); // a "rapier" remembered from before 8.4 becomes the dual blades
  const all = ['sword', 'greatsword', 'blades', 'bow', 'staff', 'wand', 'blunderbuss', 'revolvers'];
  expect(r.rack).toEqual(all);
  const skills: Record<string, string> = { sword: 'shieldCharge', greatsword: 'leapSlam', blades: 'bladeStorm', bow: 'rainOfArrows', staff: 'blizzard', wand: 'sparkVolley', blunderbuss: 'cannonBlast', revolvers: 'fanTheHammer' };
  for (const kind of all) {
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

test('holding J or K keeps attacking, a press is one attack, she walks while attacking, attacks go straight', async ({ page }) => {
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
    const out: Record<string, any> = {};
    for (const [kind, key] of [['sword', 'J'], ['sword', 'K'], ['bow', 'J'], ['blades', 'J'], ['wand', 'J']] as const) {
      s.equip(L.starterWeapon(kind));
      step(10);
      p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = dm.x - (kind === 'bow' || kind === 'wand' ? 260 : 40); p.y = dm.y;
      const before = n;
      p.keys[key].onDown(ev());
      step(180); // three seconds held
      p.keys[key].onUp(ev());
      step(60);
      out[`${kind}-${key}`] = n - before;
    }
    // one tap is still one blow, even held as long as a finger really holds it (6 frames, 0.1 s)
    for (const [kind, key] of [['sword', 'J'], ['sword', 'K'], ['blades', 'K'], ['greatsword', 'K']] as const) {
      s.equip(L.starterWeapon(kind));
      step(10);
      p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = dm.x - 40; p.y = dm.y; p.vx = 0; p.vy = 0;
      const before = n;
      p.keys[key].onDown(ev()); step(1); p.keys[key].onUp(ev()); step(60);
      out[`tap-${kind}-${key}`] = n - before;
      step(10);
      p.state = 'idle'; p.stateT = 0; p.x = dm.x - 40; p.y = dm.y;
      const b2 = n;
      p.keys[key].onDown(ev()); step(6); p.keys[key].onUp(ev()); step(60);
      out[`press-${kind}-${key}`] = n - b2;
    }

    // walking while holding attack: half speed, still attacking, facing kept
    s.equip(L.starterWeapon('bow'));
    step(10);
    p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = 300; p.y = 470; p.vx = 0; p.vy = 0;
    p.keys.J.onDown(ev()); step(3);
    p.keys.S.onDown(ev());
    const y0 = p.y, states = new Set<string>();
    for (let i = 0; i < 60; i++) { step(1); states.add(p.state); }
    p.keys.S.onUp(ev()); p.keys.J.onUp(ev());
    out.walk = Math.round(p.y - y0);
    out.walkStates = [...states].join(',');
    step(60);

    // holding J with the staff and then walking left: she backs off still shooting right;
    // a fresh press of J with A held turns her round
    s.equip(L.starterWeapon('staff'));
    step(10);
    s.shots.list.forEach((b: any) => { b.left = 0; }); step(2);
    p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = 700; p.y = 470; p.vx = 0; p.vy = 0;
    p.keys.J.onDown(ev()); step(3);
    p.keys.A.onDown(ev());
    const x1 = p.x, faces = new Set<number>(), dirs = new Set<number>();
    for (let i = 0; i < 90; i++) { step(1); faces.add(p.facing); s.shots.list.forEach((b: any) => dirs.add(Math.sign(b.vx))); }
    out.backOff = { moved: Math.round(p.x - x1), faces: [...faces], dirs: [...dirs] };
    p.keys.J.onUp(ev());
    step(40); // the last bolt finishes; A still held
    p.keys.J.onDown(ev()); step(1); p.keys.J.onUp(ev());
    out.turnOnPress = p.facing;
    p.keys.A.onUp(ev());
    step(60);

    // W or S held never bends an attack: the arrow flies level
    p.state = 'idle'; p.stateT = 0; p.facing = 1; p.x = 300; p.y = 470; p.vx = 0; p.vy = 0;
    p.keys.S.onDown(ev()); p.keys.J.onDown(ev()); step(1); p.keys.J.onUp(ev());
    step(12);
    p.keys.S.onUp(ev());
    out.arrowVy = s.shots.list.map((b: any) => b.vy);
    game.loop.wake();
    return out;
  });
  expect(r['sword-J']).toBeGreaterThanOrEqual(6); // the combo comes round again and again
  expect(r['sword-K']).toBeGreaterThanOrEqual(3);
  expect(r['bow-J']).toBeGreaterThanOrEqual(6);
  // the fast ones: dual blades and wand land clearly more blows than the sword in the same time
  expect(r['blades-J']).toBeGreaterThan(r['sword-J'] * 1.5);
  expect(r['wand-J']).toBeGreaterThan(r['bow-J']);
  for (const k of ['sword-J', 'sword-K', 'blades-K', 'greatsword-K']) {
    expect(r[`tap-${k}`], `tap ${k}`).toBe(1);
    expect(r[`press-${k}`], `0.1 s press ${k}`).toBe(1);
  }
  // 60 frames at walking speed 205 would be about 205 px; half speed is about 100
  expect(r.walk).toBeGreaterThan(70);
  expect(r.walk).toBeLessThan(130);
  expect(r.walkStates).toBe('attack');
  expect(r.backOff.moved).toBeLessThan(-70); // walked left...
  expect(r.backOff.faces).toEqual([1]); // ...still facing right...
  expect(r.backOff.dirs).toEqual([1]); // ...every bolt flying right
  expect(r.turnOnPress).toBe(-1);
  expect(r.arrowVy.length).toBeGreaterThan(0);
  expect(r.arrowVy.every((v: number) => v === 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('on real foes: the charge stuns, the blizzard slows, an arrow pierces, the dash cuts through, sparks fan out and seek, guns kick and reload', async ({ page }) => {
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

    // the blades' dash cuts through a line and carries the hero past the first foe
    s.equip(L.starterWeapon('blades'));
    reset(); foes.forEach((e: any, i: number) => { e.x = 540 + i * 30; e.maxHp = e.hp = 999; });
    const x0 = p.x;
    press('K'); step(40);
    out.dashed = { cut: foes.filter((e: any) => e.hp < 999).length, moved: Math.round(p.x - x0) };

    // the wand's heavy fans three sparks up and down the floor
    s.equip(L.starterWeapon('wand'));
    reset(); foes.forEach((e: any) => { e.x = 900; });
    press('K'); step(20);
    const ys = s.shots.list.map((b: any) => Math.sign(Math.round(b.vy)));
    out.fan = { count: s.shots.count, ups: ys.filter((v: number) => v < 0).length, downs: ys.filter((v: number) => v > 0).length };
    step(120);

    // spark volley: foes behind and above still get hit, because the sparks seek them
    reset(); foes.forEach((e: any, i: number) => { e.maxHp = e.hp = 999; e.x = 420 - i * 40; e.y = i % 2 ? 400 : 540; });
    press('I'); step(150);
    out.sought = foes.filter((e: any) => e.hp < 999).length;
    step(60);

    // the blunderbuss: a cone of pellets throws the nearest foe back, and its kick
    // pushes the hero back too
    s.equip(L.starterWeapon('blunderbuss'));
    reset(); foes.forEach((e: any, i: number) => { e.maxHp = e.hp = 999; e.x = 580 + i * 400; });
    const bx = p.x, fx = foes[0].x;
    let far = fx; // furthest the foe is thrown, before it walks back
    press('J');
    for (let f = 0; f < 30; f++) { step(1); far = Math.max(far, foes[0].x); }
    out.blunder = { pushed: Math.round(far - fx), kicked: Math.round(bx - p.x), hit: foes[0].hp < 999 };
    // Cannon Blast hurls a crowd ahead away and throws the hero back further
    reset(); foes.forEach((e: any, i: number) => { e.maxHp = e.hp = 999; e.x = 570 + i * 30; e.y = 470 + (i % 2 ? 30 : -30); });
    const cx0 = p.x;
    press('I'); step(50);
    out.cannon = { hit: foes.filter((e: any) => e.hp < 999).length, kicked: Math.round(cx0 - p.x) };
    step(60);

    // the revolvers: six quick shots, then a reload while no shot leaves, then six more
    s.equip(L.starterWeapon('revolvers'));
    reset(); foes.forEach((e: any) => { e.maxHp = e.hp = 999; e.x = 900; });
    const shots: number[] = [];
    let fired = 0, lastAmmo = p.ammo, reloadSeen = false, shotDuringReload = false;
    p.keys.J.onDown(ev());
    for (let f = 0; f < 150; f++) {
      const reloading = p.reloadT > 0; // before this frame: the sixth shot itself starts the reload
      step(1);
      if (p.ammo < lastAmmo) { fired++; shots.push(f); if (reloading) shotDuringReload = true; }
      if (p.reloadT > 0) reloadSeen = true;
      lastAmmo = p.ammo;
    }
    p.keys.J.onUp(ev());
    out.revolvers = { firstSix: shots.slice(0, 6).length, reloadSeen, shotDuringReload, gap: shots[6] - shots[5], fired };
    // Fan the Hammer: six bullets out, and the guns come back full
    step(60); reset(); p.ammo = 2;
    press('I'); step(40);
    out.hammer = { ammo: p.ammo };
    game.loop.wake();
    return out;
  });
  expect(r.foes).toBeGreaterThanOrEqual(2);
  expect(r.stunned).toBe(true);
  expect(r.slowed).toBe(true);
  expect(r.pierced).toBe(r.foes);
  expect(r.dashed.cut).toBe(r.foes);
  expect(r.dashed.moved).toBeGreaterThan(100);
  expect(r.fan).toEqual({ count: 3, ups: 1, downs: 1 });
  expect(r.sought).toBe(r.foes);
  expect(r.blunder.hit).toBe(true);
  expect(r.blunder.pushed).toBeGreaterThan(20);
  expect(r.blunder.kicked).toBeGreaterThan(5);
  expect(r.cannon.hit).toBe(r.foes);
  expect(r.cannon.kicked).toBeGreaterThan(r.blunder.kicked);
  expect(r.revolvers.firstSix).toBe(6);
  expect(r.revolvers.reloadSeen).toBe(true);
  expect(r.revolvers.shotDuringReload).toBe(false);
  expect(r.revolvers.gap).toBeGreaterThan(40); // the reload (0.75 s) sits between the sixth and seventh shot
  expect(r.hammer.ammo).toBe(6);
  expect(errors).toEqual([]);
});

test('the eight weapons in the hand, and the skill slot', async ({ page }, info) => {
  const errors = collectErrors(page);
  await camp(page);
  for (const kind of ['sword', 'greatsword', 'blades', 'bow', 'staff', 'wand', 'blunderbuss', 'revolvers']) {
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
    ['blades', 'J', 4], ['blades', 'K', 8], ['blades', 'I', 20], ['wand', 'K', 18], ['wand', 'I', 14],
    ['blunderbuss', 'J', 10], ['blunderbuss', 'I', 10], ['revolvers', 'J', 4], ['revolvers', 'K', 12], ['revolvers', 'I', 14],
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
