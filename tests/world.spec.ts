import { expect, test, type Page } from './fixtures';

// The run's structure (DESIGN.md "The world", step 11.2): five tiers of areas, five
// levels each with the boss last, two rune gates out of a fight marked with the next
// level's type, one to the boss, a gate per next area out of a boss's glade, and the
// last area's boss winning the run.

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

// Runs code against the room scene (s) in the page.
function room(page: Page, body: string) {
  return page.evaluate(`(() => { const game = window.game; const s = game.scene.getScene('room'); ${body} })()`);
}

async function startRoom(page: Page, data: Record<string, unknown>) {
  await page.evaluate((d) => { (window as any).game.scene.getScene('menu').scene.start('room', d); }, data);
  await page.waitForFunction(() => {
    const g = (window as any).game, s = g?.scene.getScene('room');
    return !!s && g.scene.isActive('room') && !!s.player && !!g.scene.getScene('hud')?.ready;
  }, null, { timeout: 20_000 });
}

// Clears every wave of a fight by hand, frame by frame, until its gates open.
const CLEAR = `
  game.loop.sleep();
  const p = s.player;
  s.waveDelay = 0;
  for (let i = 0; i < 60 * 60 && !s.gateOpen; i++) {
    for (const e of s.enemies) if (!e.isDead()) e.takeHit(9999, e.x - 1, 0, false);
    p.hp = p.maxHp;
    s.update(0, 16.7);
  }
`;

// Puts player 1 in gate i and lets the room notice; the fade to the next runs on real time.
const ENTER = (i: number) => `
  game.loop.sleep();
  const g = s.gates[${i}];
  s.player.x = g.x; s.player.y = g.y;
  for (let k = 0; k < 5; k++) s.update(0, 16.7);
  game.loop.wake();
  return s.leaving;
`;

test('the world as data: one area to start and end, two to choose between in the middle', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page, 'menu');
  const r = await page.evaluate(async () => {
    const W = await import('/src/world.ts');
    const tiers = [0, 1, 2, 3, 4].map((t) => W.areasOfTier(t).length);
    const ids = new Set(W.AREAS.map((a) => a.id));
    // a gate pair is never the same type twice, and never offers the boss
    const pairs = Array.from({ length: 200 }, () => W.rollGateTypes());
    return {
      tiers, unique: ids.size === W.AREAS.length,
      sameTwice: pairs.some(([a, b]) => a === b), boss: pairs.some((p) => p.includes('boss')),
      seen: [...new Set(pairs.flat())].sort(),
      depths: [W.depth(0, 1), W.depth(0, 4), W.depth(0, 5), W.depth(1, 1), W.depth(4, 4)],
      byTier: W.findArea('2').id, byName: W.findArea('Frostmere').id, unknown: W.findArea('nowhere').id,
    };
  });
  expect(r.tiers).toEqual([1, 2, 2, 2, 1]);
  expect(r.unique).toBe(true);
  expect(r.sameTwice).toBe(false);
  expect(r.boss).toBe(false);
  expect(r.seen).toEqual(['challenge', 'elite', 'normal']);
  expect(r.depths).toEqual([1, 4, 4, 5, 20]);
  expect([r.byTier, r.byName, r.unknown]).toEqual(['scorchreach', 'frostmere', 'blightwood']);
});

test('out of a fight two gates, each a level type; out of level 4 one gate, to the boss', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await startRoom(page, { room: 2 });
  expect(await room(page, `return [s.area.id, s.room, s.levelType, s.run.levels, s.gates.length, s.gateOpen];`))
    .toEqual(['blightwood', 2, 'normal', ['normal', 'normal'], 2, false]);
  // the signs over the gates are dim until the room is won
  expect(await room(page, `return s.gates.every((g) => g.sign && g.sign.alpha < 0.6);`)).toBe(true);
  await room(page, CLEAR + 'game.loop.wake();');
  const gates = await room(page, `return s.gates.map((g) => g.to);`) as { kind: string; type: string }[];
  expect(gates.map((g) => g.kind)).toEqual(['level', 'level']);
  expect(gates[0].type).not.toBe(gates[1].type);
  await expect.poll(() => room(page, `return s.gates.every((g) => g.sign.alpha > 0.95);`), { timeout: 5000 }).toBe(true);

  // the second gate: its type is what level 3 is
  expect(await room(page, ENTER(1))).toBe(true);
  await expect.poll(() => room(page, `return s.room;`), { timeout: 10_000 }).toBe(3);
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud')?.ready, null, { timeout: 10_000 });
  expect(await room(page, `return [s.levelType, s.run.levels.length, s.run.rooms];`)).toEqual([gates[1].type, 3, 1]);

  // level 4: one gate, and it leads to the boss
  await room(page, `s.scene.restart({ room: 4, run: s.run });`);
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.room === 4 && !!s.player; }, null, { timeout: 10_000 });
  await room(page, CLEAR + 'game.loop.wake();');
  expect(await room(page, `return s.gates.map((g) => g.to);`)).toEqual([{ kind: 'level', type: 'boss' }]);
  expect(await room(page, ENTER(0))).toBe(true);
  await expect.poll(() => room(page, `return s.room;`), { timeout: 10_000 }).toBe(5);
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('room').boss, null, { timeout: 10_000 });
  expect(await room(page, `return [s.isBossRoom, s.levelType, s.run.levels];`))
    .toEqual([true, 'boss', ['normal', 'normal', gates[1].type, 'normal', 'boss']]);
  expect(errors).toEqual([]);
});

test('a boss opens the roads to the next areas; the last one wins the run', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  await startRoom(page, { room: 5, intro: false });
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('room').boss, null, { timeout: 10_000 });
  const base = await room(page, `return s.boss.maxHp;`) as number;
  await room(page, `s.boss.takeHit(99999, s.boss.x - 1, 0, false);`);
  await expect.poll(() => room(page, `return s.gateOpen;`), { timeout: 10_000 }).toBe(true);
  expect(await room(page, `return s.gates.map((g) => g.to.id);`)).toEqual(['gloomvine', 'mire']);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('hud').endKind)).toBe(null);

  // into the Mire: level 1 of a new area, harder than anything in the Blightwood
  expect(await room(page, ENTER(1))).toBe(true);
  await expect.poll(() => room(page, `return [s.room, s.area.id];`), { timeout: 10_000 }).toEqual([1, 'mire']);
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud')?.ready, null, { timeout: 10_000 });
  expect(await room(page, `return [s.run.route, s.run.levels, s.depth, s.run.rooms];`))
    .toEqual([['blightwood', 'mire'], ['normal'], 5, 1]);
  // the scenery is the Mire's copy of the Blightwood's
  expect(await room(page, `return s.textures.exists('fw_floor@mire') && s.children.list.some((o) => o.texture?.key === 'fw_floor@mire');`)).toBe(true);

  // the Fellspire's boss: the Warden stands in, three times as tough, and his fall wins
  await room(page, `s.scene.restart({ room: 5, intro: false, area: 'fellspire' });`);
  await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('room'); return s.area?.id === 'fellspire' && !!s.boss; }, null, { timeout: 10_000 });
  expect(await room(page, `return [s.gates.length, s.boss.maxHp];`)).toEqual([0, base * 3]);
  await room(page, `s.boss.takeHit(999999, s.boss.x - 1, 0, false);`);
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('hud').endKind), { timeout: 10_000 }).toBe('victory');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: info.outputPath('victory.png') });
  expect(errors).toEqual([]);
});

test('?area= in the address goes to an area, the HUD shows its levels, the pause menu its road', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/?area=frostmere&level=3');
  await page.waitForFunction(() => { const s = (window as any).game?.scene.getScene('room'); return !!s?.player && !!s.scene.get('hud')?.ready; }, null, { timeout: 60_000 });
  expect(await room(page, `return [s.area.id, s.room, s.depth, s.run.levels];`)).toEqual(['frostmere', 3, 11, ['normal', 'normal', 'normal']]);
  const hudTexts = () => page.evaluate(() => {
    const out: string[] = [];
    const walk = (o: any) => { if (o.type === 'Text') out.push(o.text); o.list?.forEach(walk); };
    (window as any).game.scene.getScene('hud').children.list.forEach(walk);
    return out;
  });
  const hud = await hudTexts();
  expect(hud).toContain('FROSTMERE');
  expect(hud).toContain('Level 3');
  expect(hud).toContain('The Frozen Dead');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: info.outputPath('frostmere.png') });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const texts = await hudTexts();
  expect(texts).toContain('THE ROAD');
  expect(texts).toContain('Frostmere');
  expect(texts).not.toContain('Scorchreach'); // the other of its tier is not on the road taken
  expect(texts).toContain('The Diamond Hollow'); // still ahead: both choices shown
  expect(texts).toContain('The Emerald Deep');
  await page.screenshot({ path: info.outputPath('road.png') });
  expect(errors).toEqual([]);
});
