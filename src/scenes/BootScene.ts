import Phaser from 'phaser';
import { CHARACTERS, LOOPING, ZONE, type CharKey } from '../config';
import { artFrames, bgUrls, firstFrame, loadedAnims } from '../assets';
import { makePlaceholderTextures } from '../placeholders';
import { screenCamera } from '../ui/view';
import { loadParts, partVariants } from '../rig/parts';
import { HERO_PARTS } from '../config';

export class BootScene extends Phaser.Scene {
  private found: Partial<Record<CharKey, Record<string, string[]>>> = {};

  constructor() {
    super('boot');
  }

  preload() {
    screenCamera(this);
    const label = this.add.text(480, 270, 'Loading...', { fontFamily: '"Cinzel", Georgia, serif', fontSize: '22px', color: '#d8c79a', resolution: 2 }).setOrigin(0.5);
    this.load.on('progress', (p: number) => label.setText(`Loading... ${Math.round(p * 100)}%`));

    const queued = new Set<string>();
    for (const key of Object.keys(CHARACTERS) as CharKey[]) {
      const frames = artFrames[key] ?? {};
      this.found[key] = frames;
      for (const urls of Object.values(frames)) {
        for (const url of urls) {
          if (queued.has(url)) continue;
          queued.add(url);
          this.load.image(url, url);
        }
      }
    }
    bgUrls.forEach((url, i) => this.load.image(`bg_${i}`, url));
    this.registry.set('bgCount', bgUrls.length);
  }

  async create() {
    // the hero is drawn from her separate parts (src/rig), if they are unpacked
    if (partVariants().includes(HERO_PARTS)) await loadParts(this, [HERO_PARTS]);
    const report: string[] = [];
    for (const key of Object.keys(CHARACTERS) as CharKey[]) {
      const frames = this.found[key] ?? {};
      const names = new Set<string>();
      for (const [anim, urls] of Object.entries(frames)) {
        this.anims.create({
          key: `${key}_${anim}`,
          frames: urls.map((u) => ({ key: u })),
          frameRate: 18,
          repeat: LOOPING.has(anim) ? -1 : 0,
        });
        names.add(anim);
      }
      loadedAnims[key] = names;
      if (frames.idle) firstFrame[key] = frames.idle[0];
      report.push(`${key}: ${names.size ? [...names].map((n) => `${n}(${frames[n].length})`).join(' ') : 'placeholder'}`);
    }
    // Shows in the browser console which art was picked up.
    console.info('[fellspire] art found\n' + report.join('\n') + `\nbackground layers: ${this.registry.get('bgCount')}`);

    makePlaceholderTextures(this);
    // ?boss in the address goes straight to the boss fight, for playtesting it
    const q = new URLSearchParams(location.search);
    if (q.has('rig')) this.scene.start('riglab'); // the rig lab, a test page for characters from parts
    else if (q.has('boss')) this.scene.start('room', { room: ZONE.bossRoom });
    else this.scene.start('menu');
  }
}
