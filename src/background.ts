import Phaser from 'phaser';
import { WORLD } from './config';

interface Layer { ts: Phaser.GameObjects.TileSprite; factor: number; scale: number }

export interface Background { update(cam: Phaser.Cameras.Scene2D.Camera): void }

// Real art: every PNG in assets/backgrounds/active/, back to front by file
// name, scaled to the screen height. The last layer moves with the world.
// No art: the drawn Blightwood stand-in.
export function buildBackground(scene: Phaser.Scene): Background {
  const { viewW, viewH, roomW, groundTop } = WORLD;
  const layers: Layer[] = [];
  const n = scene.registry.get('bgCount') as number;

  const addLayer = (key: string, factor: number, depth: number) => {
    const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    const scale = viewH / img.height;
    const ts = scene.add.tileSprite(0, 0, viewW, viewH, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
    ts.setTileScale(scale);
    layers.push({ ts, factor, scale });
  };

  if (n > 0) {
    for (let i = 0; i < n; i++) addLayer(`bg_${i}`, n === 1 ? 1 : 0.05 + (i / (n - 1)) * 0.95, -100 + i);
  } else {
    scene.add.image(0, 0, 'bgph_sky').setOrigin(0).setScrollFactor(0).setDepth(-100);
    addLayer('bgph_hills', 0.12, -99);
    addLayer('bgph_trees_far', 0.3, -98);
    const fog = scene.add.rectangle(0, 300, viewW, 120, 0x9fb59a, 0.07).setOrigin(0).setScrollFactor(0).setDepth(-97);
    fog.setBlendMode(Phaser.BlendModes.SCREEN);
    addLayer('bgph_trees_near', 0.6, -96);

    const ground = scene.add.tileSprite(0, groundTop - 28, roomW, viewH - groundTop + 28, 'bgph_ground').setOrigin(0).setDepth(-50);
    ground.setTint(0xffffff);

    const rnd = new Phaser.Math.RandomDataGenerator(['props']);
    for (let x = 120; x < roomW - 150; x += rnd.between(160, 320)) {
      const key = rnd.frac() < 0.7 ? 'prop_grave' : 'prop_fence';
      scene.add.image(x, groundTop - 10 + rnd.between(-4, 6), key).setOrigin(0.5, 1).setDepth(-40);
    }
  }

  return {
    update(cam) {
      for (const l of layers) l.ts.tilePositionX = (cam.scrollX * l.factor) / l.scale;
    },
  };
}
