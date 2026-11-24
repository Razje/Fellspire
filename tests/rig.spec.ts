import { expect, test } from '@playwright/test';

// The rig lab (?rig): characters drawn from the packs' separate parts by our own
// Spriter player. Checks it comes up and every character is fully drawn, and saves
// a screenshot per animation to compare the parts version with the frames.

test.use({ viewport: { width: 1920, height: 1080 } });

test('rig lab draws characters from parts', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('/?rig');
  await page.waitForFunction(() => (window as any).game?.scene.getScene('riglab')?.ready, null, { timeout: 60_000 });
  const parts = await page.evaluate(() =>
    (window as any).game.scene.getScene('riglab').rigs.map((r: any) => r.list.filter((p: any) => p.visible).length));
  expect(parts.length).toBe(4);
  for (const n of parts) expect(n).toBeGreaterThanOrEqual(10);
  for (const [k, n] of [['1', 'idle'], ['4', 'slash'], ['2', 'walk']]) {
    await page.keyboard.press(k);
    await page.waitForTimeout(k === '4' ? 180 : 300);
    await page.screenshot({ path: info.outputPath(`rig-${n}.png`) });
  }
  expect(errors).toEqual([]);
});

test('the hero in a fight is drawn from parts', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('menu'), null, { timeout: 60_000 });
  await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
  await page.waitForFunction(() => (window as any).game?.scene.getScene('hud')?.ready, null, { timeout: 60_000 });
  const r = await page.evaluate(() => {
    const game = (window as any).game;
    const s = game.scene.getScene('room');
    const p = s.player;
    game.loop.sleep();
    const step = (n: number) => { for (let i = 0; i < n; i++) s.update(0, 16.7); };
    let ts = 1;
    const ev = () => ({ timeStamp: ts++, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault() {} });
    step(5);
    const out: any = { rig: !!p.rig, spriteHidden: !p.sprite.visible, idle: p.rig?.animation, parts: p.rig?.list.filter((o: any) => o.visible).length };
    p.keys.J.onDown(ev()); step(3); p.keys.J.onUp(ev());
    out.attack = p.rig?.animation;
    step(40);
    p.keys.D.onDown(ev()); step(20);
    out.walk = p.rig?.animation; out.facing = p.rig?.scaleX > 0;
    p.keys.D.onUp(ev()); p.keys.A.onDown(ev()); step(20); p.keys.A.onUp(ev());
    out.facingLeft = p.rig?.scaleX < 0;
    p.takeHit(999, p.x + 10, 0, false); step(90);
    out.dead = p.rig?.animation; out.held = p.rig?.done;
    game.loop.wake();
    return out;
  });
  expect(r).toEqual({ rig: true, spriteHidden: true, idle: 'Idle', parts: r.parts, attack: 'Slashing', walk: 'Walking', facing: true, facingLeft: true, dead: 'Dying', held: true });
  expect(r.parts).toBeGreaterThanOrEqual(10);
  expect(errors).toEqual([]);
});

test.describe('fight screenshot', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('hero from parts in a room', async ({ page }, info) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).game?.scene.isActive('menu'), null, { timeout: 60_000 });
    await page.evaluate(() => (window as any).game.scene.getScene('menu').scene.start('room', { room: 1 }));
    await page.waitForFunction(() => (window as any).game?.scene.getScene('hud')?.ready, null, { timeout: 60_000 });
    await page.waitForTimeout(3500);
    await page.keyboard.press('j');
    await page.waitForTimeout(120);
    await page.screenshot({ path: info.outputPath('hero-parts-fight.png') });
  });
});
