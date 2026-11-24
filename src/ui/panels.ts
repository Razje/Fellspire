// Panels shared by the title screen and the pause menu: Options and Credits.
// A panel is a modal: a dimmed backdrop, a gilded frame that opens with a short
// scale and fade, and a FocusList for keys, stick and mouse.
import Phaser from 'phaser';
import { WORLD } from '../config';
import { settings, saveSettings } from '../settings';
import { Button, CheckRow, bandTextures, FocusList, Frame, SliderRow, pic, type Focusable } from './kit';
import { C, txt } from './theme';

export interface Panel {
  root: Phaser.GameObjects.Container;
  list: FocusList;
  close(): void;
}

// Opens a modal frame; build() fills it and returns the focusable items.
export function openPanel(
  scene: Phaser.Scene, w: number, h: number, title: string, depth: number,
  build: (frame: Frame, close: () => void) => Focusable[], onClose: () => void, dim = 0.55,
): Panel {
  const { viewW, viewH } = WORLD;
  bandTextures(scene);
  const root = scene.add.container(0, 0).setDepth(depth);
  const shade = scene.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x000000, dim).setInteractive();
  root.add(shade);
  const frame = new Frame(scene, viewW / 2, viewH / 2, w, h, 'gold', title);
  root.add(frame);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.tweens.add({ targets: frame, scale: 0.94, alpha: 0, duration: 130, ease: 'Quad.easeIn' });
    scene.tweens.add({ targets: shade, alpha: 0, duration: 150, onComplete: () => root.destroy() });
    onClose();
  };
  const items = build(frame, close);
  shade.setAlpha(0);
  frame.setScale(0.92).setAlpha(0);
  scene.tweens.add({ targets: shade, alpha: 1, duration: 160 });
  scene.tweens.add({ targets: frame, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  return { root, list: new FocusList(items), close };
}

export function openOptions(scene: Phaser.Scene, depth: number, onClose: () => void, dim?: number): Panel {
  return openPanel(scene, 420, 356, 'Options', depth, (f, close) => {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { f.add(o); return o; };
    const sec = (y: number, s: string) => {
      add(txt(scene, -170, y, s.toUpperCase(), 'small', { fontSize: '11px', color: C.goldSoft, letterSpacing: 2 }).setOrigin(0, 0.5));
      add(pic(scene, 40, y + 1, 'ui_line').setScale(0.2, 0.5).setTint(0xb89040).setAlpha(0.6));
    };
    sec(-138, 'Gameplay');
    const shake = add(new CheckRow(scene, 0, -112, 'Screen shake', () => settings.screenShake, (v) => { settings.screenShake = v; saveSettings(); }));
    const nums = add(new CheckRow(scene, 0, -84, 'Damage numbers', () => settings.damageNumbers, (v) => { settings.damageNumbers = v; saveSettings(); }));
    const full = add(new CheckRow(scene, 0, -56, 'Fullscreen', () => scene.scale.isFullscreen, () => {
      scene.scale.toggleFullscreen();
      scene.time.delayedCall(250, () => full.refresh());
    }));
    sec(-22, 'Sound');
    const vol = (y: number, label: string, k: 'master' | 'music' | 'effects') =>
      add(new SliderRow(scene, 0, y, label, () => settings[k], (v) => { settings[k] = v; saveSettings(); }));
    const master = vol(4, 'Master volume', 'master');
    const music = vol(32, 'Music', 'music');
    const fx = vol(60, 'Effects', 'effects');
    add(txt(scene, 0, 88, 'The game has no sound yet; these are kept for when it does.', 'small', { fontSize: '11px', color: C.grey, strokeThickness: 0 }).setOrigin(0.5));
    const done = add(new Button(scene, 0, 138, 160, 34, 'Done', close));
    return [shake, nums, full, master, music, fx, done];
  }, onClose, dim);
}

export function openCredits(scene: Phaser.Scene, depth: number, onClose: () => void, dim?: number): Panel {
  return openPanel(scene, 480, 344, 'Credits', depth, (f, close) => {
    const line = (y: number, head: string, body: string) => {
      f.add(txt(scene, 0, y, head.toUpperCase(), 'small', { fontSize: '11px', color: C.goldSoft, letterSpacing: 2 }).setOrigin(0.5));
      f.add(txt(scene, 0, y + 18, body, 'body', { fontSize: '14px', color: C.ivory, align: 'center' }).setOrigin(0.5, 0));
    };
    f.add(txt(scene, 0, -124, 'A personal prototype, built with Claude.', 'body', { fontSize: '14px', color: C.body }).setOrigin(0.5));
    f.add(pic(scene, 0, -102, 'ui_ornament'));
    line(-88, 'Character art', 'CraftPix.net chibi packs\nValkyrie, Zombie Villager, Skeleton Warrior');
    line(-8, 'Fonts', 'Cinzel and Cinzel Decorative by Natanael Gama\nMarcellus by Brian J. Bonislawsky');
    line(72, 'Engine', 'Phaser 3');
    const done = new Button(scene, 0, 136, 160, 34, 'Done', close);
    f.add(done);
    return [done];
  }, onClose, dim);
}
