import Phaser from 'phaser';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel-decorative/700.css';
import '@fontsource/cinzel-decorative/900.css';
import { WORLD } from './config';
import { discoverArt } from './assets';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { RoomScene } from './scenes/RoomScene';

// Canvas text only uses a font that is already loaded, so wait for them.
async function start() {
  try {
    await Promise.all([
      document.fonts.load('900 84px "Cinzel Decorative"'),
      document.fonts.load('700 28px "Cinzel Decorative"'),
      document.fonts.load('700 20px "Cinzel"'),
      document.fonts.load('400 15px "Cinzel"'),
    ]);
  } catch {
    /* fall back to Georgia */
  }
  await discoverArt();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WORLD.viewW,
    height: WORLD.viewH,
    backgroundColor: '#05070c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true },
    scene: [BootScene, MenuScene, RoomScene],
  });

  // Handle for poking at the running game from the browser console while developing.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

start();
