import { expect, test, type Page } from '@playwright/test';

// The ember shrine at camp (step 10.2): E beside it opens the upgrade tree over
// the paused camp; learning a rank takes its embers and is kept across a reload;
// an upgrade below one not yet learned is locked, and one too dear cannot be bought.

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

const panel = (page: Page) => page.evaluate(() => {
  const sh = (window as any).game.scene.getScene('hud').shop;
  if (!sh || !sh.views) return null;
  const b = sh.root.getBounds();
  return { sel: sh.selected.id, left: b.left, right: b.right, top: b.top, bottom: b.bottom };
});

const state = (page: Page) => page.evaluate(async () => {
  const E = await import('/src/embers.ts');
  const S = await import('/src/shrine.ts');
  return { embers: E.embers(), vigour: S.rankOf('vigour'), edge: S.rankOf('edge'), keen: S.rankOf('keen') };
});

async function openShrine(page: Page) {
  await page.evaluate(async () => {
    const { CAMP } = await import('/src/hub.ts');
    const p = (window as any).game.scene.getScene('room').player;
    p.x = CAMP.shrine.x; p.y = CAMP.shrine.y + 30;
  });
  await page.waitForTimeout(300);
  await page.keyboard.down('e');
  await page.waitForTimeout(120);
  await page.keyboard.up('e');
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('hud').shop?.views, null, { timeout: 5000 });
  await page.waitForTimeout(400);
}

test('the ember shrine: learn, lock, keep', async ({ page }, info) => {
  const errors = collectErrors(page);
  // 40 embers from earlier runs and nothing learned, set once (not again on the reload)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('fellspire.embers', '40');
      localStorage.removeItem('fellspire.shrine');
    }
  });
  await page.goto('/?camp');
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
  await page.waitForTimeout(1500);

  // the shrine stands between the fire and the gate, and says E when you are by it
  await page.evaluate(async () => {
    const { CAMP } = await import('/src/hub.ts');
    const p = (window as any).game.scene.getScene('room').player;
    p.x = CAMP.shrine.x - 40; p.y = CAMP.shrine.y + 30;
  });
  await page.waitForTimeout(1200);
  await shot(page, info, 'shrine-0-camp');

  await openShrine(page);
  expect(await page.evaluate(() => (window as any).game.scene.isPaused('room'))).toBe(true);
  // it starts on the first upgrade that can be learned, and fits the 960 x 540 screen
  const first = await panel(page);
  expect(first).toMatchObject({ sel: 'vigour' });
  expect(first!.left).toBeGreaterThanOrEqual(0);
  expect(first!.right).toBeLessThanOrEqual(960);
  expect(first!.top).toBeGreaterThanOrEqual(0);
  expect(first!.bottom).toBeLessThanOrEqual(540);
  await shot(page, info, 'shrine-1-open');

  // Edge (down and left) is locked until Vigour has a rank
  await page.keyboard.press('s'); await page.waitForTimeout(120);
  expect((await panel(page))!.sel).toBe('edge');
  await page.keyboard.press('e'); await page.waitForTimeout(200);
  expect(await state(page)).toEqual({ embers: 40, vigour: 0, edge: 0, keen: 0 });

  // back up to Vigour: one rank for 10, another for 20
  await page.keyboard.press('w'); await page.waitForTimeout(120);
  expect((await panel(page))!.sel).toBe('vigour');
  await page.keyboard.press('e'); await page.waitForTimeout(200);
  expect(await state(page)).toEqual({ embers: 30, vigour: 1, edge: 0, keen: 0 });
  await page.keyboard.press('e'); await page.waitForTimeout(200);
  expect(await state(page)).toEqual({ embers: 10, vigour: 2, edge: 0, keen: 0 });
  // the third rank costs 35: too dear, nothing changes
  await page.keyboard.press('e'); await page.waitForTimeout(200);
  expect(await state(page)).toEqual({ embers: 10, vigour: 2, edge: 0, keen: 0 });
  // Edge is open now but costs 15
  await page.keyboard.press('s'); await page.waitForTimeout(120);
  await page.keyboard.press('e'); await page.waitForTimeout(200);
  expect(await state(page)).toEqual({ embers: 10, vigour: 2, edge: 0, keen: 0 });
  await page.waitForTimeout(400);
  await shot(page, info, 'shrine-2-learned');

  // moving right crosses into the next branch
  await page.keyboard.press('d'); await page.waitForTimeout(120);
  expect((await panel(page))!.sel).toBe('bulwark');
  await page.keyboard.press('d'); await page.waitForTimeout(120);
  expect(['focus', 'fleetfoot']).toContain((await panel(page))!.sel);

  // Esc closes it and the camp carries on; the HUD shows what is left
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => {
    const g = (window as any).game;
    return [g.scene.isPaused('room'), !!g.scene.getScene('hud').shop, g.scene.getScene('hud').emberText.text];
  }), { timeout: 5000 }).toEqual([false, false, '10']);

  // a reload keeps both the bank and what was learned
  await page.reload();
  await waitForScene(page, 'room');
  expect(await state(page)).toEqual({ embers: 10, vigour: 2, edge: 0, keen: 0 });
  expect(errors).toEqual([]);
});

test('the shrine tree is sound', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page, 'menu');
  const problems = await page.evaluate(async () => {
    const { SHRINE, BRANCHES } = await import('/src/shrine.ts');
    const out: string[] = [];
    const ids = new Set(SHRINE.map((n: any) => n.id));
    if (ids.size !== SHRINE.length) out.push('duplicate ids');
    const spots = new Set<string>();
    for (const n of SHRINE as any[]) {
      if (!BRANCHES.some((b: any) => b.id === n.branch)) out.push(`${n.id}: unknown branch`);
      const spot = `${n.branch}:${n.row}:${n.col}`;
      if (spots.has(spot)) out.push(`${n.id}: shares a spot`);
      spots.add(spot);
      if (!n.cost.length) out.push(`${n.id}: no ranks`);
      for (let i = 1; i < n.cost.length; i++) if (n.cost[i] <= n.cost[i - 1]) out.push(`${n.id}: costs do not rise`);
      if (n.row === 0 && n.after) out.push(`${n.id}: top of a branch with a parent`);
      if (n.row > 0 && !n.after?.length) out.push(`${n.id}: no parent`);
      for (const a of n.after ?? []) {
        const p = (SHRINE as any[]).find((x) => x.id === a);
        if (!p) out.push(`${n.id}: unknown parent ${a}`);
        else if (p.branch !== n.branch || p.row >= n.row) out.push(`${n.id}: parent ${a} not above it in its branch`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});
