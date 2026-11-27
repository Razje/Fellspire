import { expect, test, type Page } from './fixtures';

// Wide and ultrawide screens: the view is 540 high and as wide as the window's
// shape allows (config.ts), from 960 at 16:9 up to the room's width, 1500. The
// title screens keep their 960 stage in the middle; the room and HUD use it all.

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

// the canvas size, where it sits in the window, and what a scene's camera shows (in layout pixels)
const view = (page: Page, scene: string) => page.evaluate((k) => {
  const game = (window as any).game;
  const r = game.canvas.getBoundingClientRect();
  const v = game.scene.getScene(k).cameras.main.worldView;
  return { w: game.scale.width, h: game.scale.height, left: Math.round(r.left), width: Math.round(r.width), cam: [Math.round(v.x), Math.round(v.right)] };
}, scene);

test('an ultrawide window fills the width', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1720, height: 720 }); // 3440 x 1440 at half size, 21.5:9
  await page.goto('/');
  await waitForScene(page, 'menu');
  await page.waitForTimeout(1600);
  // a 1290 wide view, edge to edge; the title's 960 stage centred in it
  expect(await view(page, 'menu')).toEqual({ w: 2580, h: 1080, left: 0, width: 1720, cam: [-165, 1125] });
  await shot(page, info, 'wide-1-title');

  await page.goto('/?camp');
  await waitForScene(page, 'room');
  await waitForScene(page, 'hud');
  await page.waitForTimeout(1500);
  // the HUD lays out on 0..1290, so player 1's frame is at the left and the purse at the right edge
  expect((await view(page, 'hud')).cam).toEqual([0, 1290]);
  // the right-hand pieces follow the right edge: the purse ends 12 in from it, as at 16:9
  const purseRight = await page.evaluate(() => (window as any).game.scene.getScene('hud').goldText.parentContainer.getBounds().right);
  expect(Math.round(purseRight)).toBeGreaterThan(1260);
  const room = await view(page, 'room');
  expect(room.cam[1] - room.cam[0]).toBe(1290);
  await shot(page, info, 'wide-2-camp');
  expect(errors).toEqual([]);
});

test('beyond the room width, and narrower than 16:9, it letterboxes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 540 }); // 32:9
  await page.goto('/');
  await waitForScene(page, 'menu');
  const wide = await view(page, 'menu');
  expect(wide.w).toBe(3000); // capped at the room's 1500
  expect(wide.width).toBeLessThan(1920);

  await page.setViewportSize({ width: 1024, height: 768 }); // 4:3
  await page.goto('/');
  await waitForScene(page, 'menu');
  expect((await view(page, 'menu')).w).toBe(1920); // the 960 layout, as before
});
