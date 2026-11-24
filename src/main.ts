import Phaser from 'phaser';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel-decorative/700.css';
import '@fontsource/cinzel-decorative/900.css';
import '@fontsource/marcellus/400.css';
import { WORLD } from './config';
import { discoverArt } from './assets';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { RoomScene } from './scenes/RoomScene';
import { HudScene } from './scenes/HudScene';
import { RigLabScene } from './scenes/RigLabScene';
import { ZOOM } from './ui/view';
import { installCursor } from './ui/kit';

// Canvas text only uses a font that is already loaded, so wait for them.
async function start() {
  try {
    await Promise.all([
      document.fonts.load('900 84px "Cinzel Decorative"'),
      document.fonts.load('700 28px "Cinzel Decorative"'),
      document.fonts.load('700 20px "Cinzel"'),
      document.fonts.load('400 15px "Cinzel"'),
      document.fonts.load('400 14px "Marcellus"'),
    ]);
  } catch {
    /* fall back to Georgia */
  }
  await discoverArt();

  // Full HD canvas; every camera zooms 2x onto the 960 x 540 layout (ui/view.ts).
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WORLD.viewW * ZOOM,
    height: WORLD.viewH * ZOOM,
    backgroundColor: '#05070c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true },
    scene: [BootScene, MenuScene, RoomScene, HudScene, RigLabScene],
  });
  game.events.once(Phaser.Core.Events.READY, () => installCursor(game));

  // Handle for poking at the running game from the browser console while developing.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

start();
