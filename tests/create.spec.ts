import { expect, test, type Page } from '@playwright/test';

// Character creation (DESIGN.md 8.2): the first New Run opens it, choices change
// the hero and are remembered, the name reaches the HUD, and the title menu's
// Character item reopens it. Saves full-HD screenshots under test-results/.

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, fn: string) => page.evaluate(`(() => { const game = window.game; ${fn} })()`);

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

const press = async (page: Page, key: string) => { await page.keyboard.press(key); await page.waitForTimeout(150); };

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('fellspire.hero') || 'null'));

// the texture a part of a rig is drawn with right now
const partTexture = (page: Page, scene: string, path: string, file: string) =>
  game(page, `const r = game.scene.getScene('${scene}').${path}; return r.skin.get('${file}')?.texture ?? null;`);

test('make a hero on the first run, and change her later', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForScene(page, 'menu');
  expect(await saved(page)).toBeNull();

  await press(page, 'Enter'); // press any key
  await page.waitForTimeout(500);
  await press(page, 'Enter'); // New Run
  await waitForScene(page, 'create');
  await page.waitForTimeout(900);
  await shot(page, info, 'create-1-first');

  // the list starts on Helmet; right steps to the next helmet, and the hero wears it
  expect(await partTexture(page, 'create', 'rig', 'Head.png')).toContain('Valkyrie_1/Head.png');
  await press(page, 'ArrowRight');
  expect(await partTexture(page, 'create', 'rig', 'Head.png')).toContain('Valkyrie_2/Head.png');
  // eyes, armour, skin
  await press(page, 'ArrowDown'); await press(page, 'ArrowRight'); await press(page, 'ArrowRight'); // eyes: Brown
  await press(page, 'ArrowDown'); await press(page, 'ArrowLeft'); // armour: Wildscale (wraps round)
  expect(await partTexture(page, 'create', 'rig', 'Body.png')).toBe('Valkyrie_3/Body.png');
  await press(page, 'ArrowDown'); await press(page, 'ArrowRight'); await press(page, 'ArrowRight'); // skin: Umber
  expect(await partTexture(page, 'create', 'rig', 'Head.png')).toBe('skin5:Valkyrie_2/Head.png');

  // a skin recolour really changed the face: its middle is not the original colour
  const px = await game(page, `
    const t = game.textures; const a = t.getPixel(240, 330, 'Valkyrie_2/Head.png'); const b = t.getPixel(240, 330, 'skin5:Valkyrie_2/Head.png');
    return [a.r, a.g, a.b, b.r, b.g, b.b];`) as number[];
  expect(px[3] + px[4] + px[5]).toBeLessThan(px[0] + px[1] + px[2] - 150);

  // the name: up to the top, clear it, type a new one (W and S are letters here)
  for (let i = 0; i < 4; i++) await press(page, 'ArrowUp');
  for (let i = 0; i < 10; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('Sigrun Ws');
  await page.waitForTimeout(200);
  expect(await game(page, `return game.scene.getScene('create').look.name;`)).toBe('Sigrun Ws');
  // an empty name cannot begin the run
  for (let i = 0; i < 9; i++) await page.keyboard.press('Backspace');
  expect(await game(page, `return game.scene.getScene('create').confirm.enabled;`)).toBe(false);
  await page.keyboard.type('Sigrun');
  expect(await game(page, `return game.scene.getScene('create').confirm.enabled;`)).toBe(true);
  await page.waitForTimeout(300);
  await shot(page, info, 'create-2-chosen');

  // Begin the Run: saved, and into room 1 wearing it, her name on the HUD
  await press(page, 'Enter'); // leaves the name field
  for (let i = 0; i < 5; i++) await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await waitForScene(page, 'room');
  expect(await saved(page)).toEqual({ name: 'Sigrun', helmet: 1, eyes: 2, armour: 2, skin: 5 });
  await waitForScene(page, 'hud');
  await page.waitForTimeout(2500);
  expect(await partTexture(page, 'room', 'player.rig', 'Body.png')).toBe('Valkyrie_3/Body.png');
  expect(await partTexture(page, 'hud', 'portrait', 'Head.png')).toBe('skin5:Valkyrie_2/Head.png');
  const hudName = await game(page, `return game.scene.getScene('hud').children.list.some((o) => o.type === 'Text' && o.text === 'Sigrun');`);
  expect(hudName).toBe(true);
  await shot(page, info, 'create-3-in-the-fight');

  // the Character item reopens creation
  await page.reload();
  await waitForScene(page, 'menu');
  await page.waitForTimeout(400);
  await press(page, 'Enter');
  await page.waitForTimeout(500);
  await shot(page, info, 'create-4-title-with-her');
  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // Character
  await waitForScene(page, 'create');
  await page.waitForTimeout(700);
  expect(await game(page, `return game.scene.getScene('create').look.name;`)).toBe('Sigrun');
  // a change then Escape (cancel) keeps what was saved, and returns to the open menu
  await press(page, 'ArrowRight');
  await press(page, 'Escape');
  await waitForScene(page, 'menu');
  await page.waitForTimeout(600);
  expect(await game(page, `const m = game.scene.getScene('menu'); return [m.mode, m.sel];`)).toEqual(['menu', 1]); // back on Character
  expect((await saved(page)).helmet).toBe(1);
  // New Run now asks Solo or Co-op (no hero to make any more); Solo starts the run
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  expect(await game(page, `return game.scene.getScene('menu').mode;`)).toBe('newrun');
  await press(page, 'Enter'); // Solo
  await waitForScene(page, 'room');
  expect(errors).toEqual([]);
});

test('Randomise gives a complete hero', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page, 'menu');
  await game(page, `game.scene.getScene('menu').scene.start('create', { then: 'menu' });`);
  await waitForScene(page, 'create');
  for (let i = 0; i < 5; i++) {
    await game(page, `game.scene.getScene('create').randomise();`);
    const l = await game(page, `return game.scene.getScene('create').look;`) as any;
    expect(l.name.length).toBeGreaterThan(0);
    for (const k of ['helmet', 'eyes', 'armour']) expect(l[k]).toBeGreaterThanOrEqual(0);
    expect(l.skin).toBeLessThan(7);
  }
});
