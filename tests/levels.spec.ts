import { expect, test, type Page } from './fixtures';

// Chest tiers, challenge rules and elite foes (DESIGN.md "The world", step 11.3): a
// normal fight's chest is wood, bronze or silver; a challenge level plays for a gold
// chest that falls back to wood when its rule is broken; an elite level's foes are
// crowned, tougher and harder hitting, and leave a gold chest.

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
  return page.evaluate(`(() => { const game = window.game; const s = game.scene.getScene('room'); const hud = game.scene.getScene('hud'); ${body} })()`);
}

async function startRoom(page: Page, data: Record<string, unknown>) {
  await page.evaluate((d) => { (window as any).game.scene.getScene('menu').scene.start('room', d); }, data);
  await page.waitForFunction(() => {
    const g = (window as any).game, s = g?.scene.getScene('room');
    return !!s && g.scene.isActive('room') && !!s.player && !!g.scene.getScene('hud')?.ready;
  }, null, { timeout: 20_000 });
}

async function boot(page: Page) {
  await page.goto('/');
  await waitForScene(page, 'menu');
}

// Brings on the first wave at once, the clock stopped.
const FIRST_WAVE = `
  game.loop.sleep();
  s.waveDelay = 0;
  for (let i = 0; i < 3 && s.wave === 0; i++) s.update(0, 16.7);
`;

// Clears every wave by hand until the gates open, keeping the hero unhurt.
const CLEAR = `
  game.loop.sleep();
  s.waveDelay = 0;
  for (let i = 0; i < 60 * 60 && !s.gateOpen; i++) {
    for (const e of s.enemies) if (!e.isDead()) e.takeHit(99999, e.x - 1, 0, false);
    s.player.hp = s.player.maxHp;
    s.update(0, 16.7);
  }
`;

test('chest tiers: better chests, better cards; deeper runs, better chests', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const L = await import('/src/loot.ts');
    const T = await import('/src/chests.ts');
    const rank: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
    const avg = (tier: string) => {
      let n = 0, sum = 0, low = 9;
      for (let i = 0; i < 400; i++) for (const it of L.rollChest(1, Math.random, undefined, 3, tier as any)) {
        n++; sum += rank[it.rarity]; low = Math.min(low, rank[it.rarity]);
      }
      return { avg: sum / n, low };
    };
    const share = (depth: number) => {
      const c: Record<string, number> = { wood: 0, bronze: 0, silver: 0, gold: 0 };
      for (let i = 0; i < 2000; i++) c[T.rollChestTier(depth)]++;
      return c;
    };
    return { wood: avg('wood'), bronze: avg('bronze'), silver: avg('silver'), gold: avg('gold'), early: share(1), late: share(12) };
  }) as any;
  // each tier is better than the one below, and keeps to its least rarity
  expect(r.wood.low).toBe(1);
  expect(r.bronze.low).toBe(2);
  expect(r.silver.low).toBe(2);
  expect(r.gold.low).toBe(3);
  expect(r.bronze.avg).toBeGreaterThan(r.wood.avg);
  expect(r.silver.avg).toBeGreaterThan(r.bronze.avg);
  expect(r.gold.avg).toBeGreaterThan(r.silver.avg);
  // a normal fight never rolls gold; wood is most common early, rarer late
  expect(r.early.gold + r.late.gold).toBe(0);
  expect(r.early.wood).toBeGreaterThan(r.early.bronze);
  expect(r.early.wood).toBeGreaterThan(r.early.silver);
  expect(r.late.silver).toBeGreaterThan(r.early.silver * 2);
  expect(r.late.wood).toBeLessThan(r.early.wood / 2);
});

test('a normal fight\'s chest is wood, bronze or silver, and looks it', async ({ page }) => {
  const errors = collectErrors(page);
  await boot(page);
  await startRoom(page, { room: 2 });
  const c = await room(page, `return { tier: s.chest.tier, tex: s.chest.img.texture.key, prompt: s.chest.prompt.list[1].text, n: s.chest.items.length };`) as any;
  expect(['wood', 'bronze', 'silver']).toContain(c.tier);
  expect(c.tex).toBe(`chest_${c.tier}`);
  expect(c.prompt).toMatch(/^Open (Wooden|Bronze|Silver) Chest$/);
  expect(c.n).toBe(3);
  expect(errors).toEqual([]);
});

test('a challenge kept: the gold chest is unsealed', async ({ page }, info) => {
  const errors = collectErrors(page);
  await boot(page);
  await startRoom(page, { room: 2, type: 'challenge', challenge: 'unscathed' });
  const start = await room(page, `return { type: s.levelType, rule: s.challenge.def.id, limit: s.challenge.limit, tier: s.chest.tier, line: hud.levelLine.text };`) as any;
  expect(start).toEqual({ type: 'challenge', rule: 'unscathed', limit: 3, tier: 'gold', line: '- Unscathed: 0/3 hits taken' });
  // the rule's banner comes after the zone's
  await expect.poll(() => room(page, `return hud.bannerObjs.map((o) => o.text).filter(Boolean).join(' | ');`), { timeout: 8000 })
    .toContain('CHALLENGE: UNSCATHED');
  await page.screenshot({ path: info.outputPath('challenge-banner.png') });

  // three hits are allowed, and a blocked one does not count
  await room(page, FIRST_WAVE + `
    const p = s.player;
    for (let i = 0; i < 3; i++) { p.invuln = 0; p.state = 'idle'; p.takeHit(4, p.x + 10, 0, false); }
    p.invuln = 0; p.state = 'block'; p.facing = 1; p.takeHit(4, p.x + 10, 0, false); p.state = 'idle';
    s.update(0, 16.7); hud.update(0, 16.7);
  `);
  expect(await room(page, `return [s.challenge.hits, s.challenge.failed, s.chest.tier, hud.levelLine.text];`))
    .toEqual([3, false, 'gold', '- Unscathed: 3/3 hits taken']);

  await room(page, CLEAR + `hud.update(0, 16.7); game.loop.wake();`);
  expect(await room(page, `return [s.challenge.met, s.chest.tier, s.chest.locked, s.chest.items.every((it) => ['rare', 'epic', 'legendary'].includes(it.rarity)), hud.levelLine.text];`))
    .toEqual([true, 'gold', false, true, '- Unscathed: met']);
  await page.waitForTimeout(600);
  await room(page, `s.player.x = s.chest.x - 56; s.player.y = s.chest.y + 6;`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: info.outputPath('challenge-met.png') });
  expect(errors).toEqual([]);
});

test('a challenge broken: the chest falls back to wood', async ({ page }, info) => {
  const errors = collectErrors(page);
  await boot(page);

  // Unscathed: the fourth hit breaks it
  await startRoom(page, { room: 2, type: 'challenge', challenge: 'unscathed' });
  await room(page, FIRST_WAVE + `
    const p = s.player;
    for (let i = 0; i < 4; i++) { p.invuln = 0; p.state = 'idle'; p.hp = p.maxHp; p.takeHit(4, p.x + 10, 0, false); }
    s.update(0, 16.7); hud.update(0, 16.7);
  `);
  expect(await room(page, `return [s.challenge.failed, s.chest.tier, s.chest.img.texture.key, s.chest.prompt.list[1].text, hud.levelLine.text];`))
    .toEqual([true, 'wood', 'chest_wood', 'Open Wooden Chest', '- Unscathed: failed']);
  await room(page, `game.loop.wake();`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('challenge-failed.png') });
  await room(page, CLEAR + `game.loop.wake();`);
  expect(await room(page, `return [s.challenge.met, s.chest.tier, s.chest.locked];`)).toEqual([false, 'wood', false]);

  // Steadfast: a dodge, by the dodge key, breaks it
  await room(page, `s.scene.restart({ room: 2, type: 'challenge', challenge: 'steadfast' });`);
  await page.waitForFunction(() => { const g = (window as any).game, s = g.scene.getScene('room'); return s.challenge?.def.id === 'steadfast' && !!s.player && !!g.scene.getScene('hud')?.ready; }, null, { timeout: 10_000 });
  await room(page, FIRST_WAVE + `s.player.dodgeCd = 0; game.loop.wake();`);
  await page.keyboard.down('KeyL');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyL');
  await expect.poll(() => room(page, `return [s.challenge.dodges > 0, s.challenge.failed, s.chest.tier];`), { timeout: 5000 })
    .toEqual([true, true, 'wood']);

  // Swift: the clock runs out
  await room(page, `s.scene.restart({ room: 2, type: 'challenge', challenge: 'swift' });`);
  await page.waitForFunction(() => { const g = (window as any).game, s = g.scene.getScene('room'); return s.challenge?.def.id === 'swift' && !!s.player && !!g.scene.getScene('hud')?.ready; }, null, { timeout: 10_000 });
  const swift = await room(page, FIRST_WAVE + `
    const c = s.challenge;
    const limit = c.limit;
    hud.update(0, 16.7);
    const line = hud.levelLine.text;
    c.time = limit - 0.01;
    s.update(0, 16.7);
    const after = [c.failed, s.chest.tier];
    game.loop.wake();
    return { limit, foes: s.totalFoes, line, after };
  `) as any;
  expect(swift.limit).toBe(15 + 4 * swift.foes);
  expect(swift.line).toMatch(/^- Swift: \d:\d\d left$/);
  expect(swift.after).toEqual([true, 'wood']);
  expect(errors).toEqual([]);
});

test('elite foes: crowned, tougher, harder hitting, worth more, and a gold chest', async ({ page }, info) => {
  const errors = collectErrors(page);
  await boot(page);
  // a plain level 2 first, for its foes' health
  await startRoom(page, { room: 2 });
  const plain = await room(page, FIRST_WAVE + `game.loop.wake(); return s.enemies.filter((e) => !e.isDead()).map((e) => [e.key, e.maxHp]);`) as [string, number][];

  await room(page, `s.scene.restart({ room: 2, type: 'elite' });`);
  await page.waitForFunction(() => { const g = (window as any).game, s = g.scene.getScene('room'); return s.levelType === 'elite' && !!s.player && !!g.scene.getScene('hud')?.ready; }, null, { timeout: 10_000 });
  expect(await room(page, `return [s.chest.tier, s.challenge, hud.levelLine.text];`)).toEqual(['gold', null, '- Crowned foes: a gold chest']);
  const elite = await room(page, FIRST_WAVE + `
    return s.enemies.filter((e) => !e.isDead()).map((e) => ({ key: e.key, hp: e.maxHp, elite: e.elite, power: e.power, crown: !!e.crownImg }));
  `) as any[];
  expect(elite.length).toBe(plain.length);
  for (const e of elite) {
    expect([e.elite, e.power, e.crown]).toEqual([true, 1.25, true]);
    const base = plain.find(([k]) => k === e.key)![1];
    expect(e.hp).toBe(Math.round(base * 1.6));
  }

  // a ghoul's claw lands 25% harder
  const hurt = await room(page, `
    const g = s.enemies.find((e) => e.key === 'ghoul');
    const p = s.player; p.invuln = 0; p.state = 'idle'; p.hp = p.maxHp;
    p.x = g.x + 30; p.y = g.y; g.facing = 1;
    const before = p.hp;
    s.resolveMelee(g, { dmg: 10 * g.power, range: 56, depth: 18, knock: 0 }, [p]);
    return before - p.hp;
  `);
  expect(hurt).toBe(13); // 12.5, rounded

  // a crowned kill gives two embers
  const embers = await room(page, `
    const before = s.run.embers;
    const e = s.enemies.find((x) => !x.isDead());
    e.takeHit(99999, e.x - 1, 0, false);
    return s.run.embers - before;
  `);
  expect(embers).toBe(2);
  await room(page, `game.loop.wake();`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: info.outputPath('elite-foes.png') });

  await room(page, CLEAR + `game.loop.wake();`);
  expect(await room(page, `return [s.chest.tier, s.chest.locked, s.chest.items.every((it) => ['rare', 'epic', 'legendary'].includes(it.rarity))];`))
    .toEqual(['gold', false, true]);
  expect(errors).toEqual([]);
});
