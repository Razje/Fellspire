// The canvas is full HD (1920 x 1080) so text and edges are sharp, while the game
// itself is laid out in 960 x 540 coordinates. Every camera is zoomed 2x.
//
// Phaser zooms around the middle of the camera, which shifts two things:
// - a camera that should show 0..960 x 0..540 has to be centred on (480, 270);
// - in a scrolling room, anything with a scroll factor other than 1 (parallax
//   layers, the vignette) lands 480 x (1 - factor) too far left. shiftParallax()
//   puts those back where they were designed.
import Phaser from 'phaser';
import { WORLD } from '../config';

export const ZOOM = 2;

export function screenCamera(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setZoom(ZOOM);
  cam.centerOn(WORLD.viewW / 2, WORLD.viewH / 2);
  return cam;
}

export function shiftParallax(scene: Phaser.Scene) {
  const hx = WORLD.viewW / 2, hy = WORLD.viewH / 2;
  for (const o of scene.children.list as unknown as (Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Transform)[]) {
    if (o.scrollFactorX === undefined) continue;
    if (o.scrollFactorX !== 1) o.x += hx * (1 - o.scrollFactorX);
    if (o.scrollFactorY !== 1) o.y += hy * (1 - o.scrollFactorY);
  }
}
