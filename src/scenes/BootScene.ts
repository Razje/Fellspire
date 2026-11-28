import Phaser from 'phaser';
import { CHARACTERS, LOOPING, type CharKey } from '../config';
import { LEVELS_PER_AREA } from '../world';
import { artFrames, bgUrls, firstFrame, frameUrls, loadedAnims, sheetLoads, type FrameRef } from '../assets';
import { PAD_ART } from '../ui/padIcons';
import { makePlaceholderTextures } from '../placeholders';
import { screenCamera } from '../ui/view';
import { loadParts, partVariants } from '../rig/parts';
import { HERO_SETS } from '../hero';

export class BootScene extends Phaser.Scene {
  private found: Partial<Record<CharKey, Record<string, FrameRef[]>>> = {};

  constructor() {
    super('boot');
  }

  preload() {
    screenCamera(this, true);
    const label = this.add.text(480, 270, 'Loading...', { fontFamily: '"Cinzel", Georgia, serif', fontSize: '22px', color: '#d8c79a', resolution: 2 }).setOrigin(0.5);
    this.load.on('progress', (p: number) => label.setText(`Loading... ${Math.round(p * 100)}%`));

    // characters' frames: packed sheets where tools/pack-sheets.mjs made them (a grid
    // of equal cells), separate images otherwise (see assets.ts)
    for (const key of Object.keys(CHARACTERS) as CharKey[]) this.found[key] = artFrames[key] ?? {};
    for (const s of sheetLoads) this.load.spritesheet(s.key, s.url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    for (const url of frameUrls) this.load.image(url, url);
    bgUrls.forEach((url, i) => this.load.image(`bg_${i}`, url));
    // Kenney's Xbox buttons (ui/padIcons.ts)
    for (const [name, url] of Object.entries(PAD_ART)) this.load.image(`kpad_${name}`, url);
    this.registry.set('bgCount', bgUrls.length);
  }

  async create() {
    // the hero is drawn from her separate parts (src/rig), if they are unpacked;
    // all three Valkyrie sets, since character creation mixes them (hero.ts)
    const sets = HERO_SETS.filter((v) => partVariants().includes(v));
    if (sets.length) await loadParts(this, sets);
    const report: string[] = [];
    for (const key of Object.keys(CHARACTERS) as CharKey[]) {
      const frames = this.found[key] ?? {};
      const names = new Set<string>();
      for (const [anim, refs] of Object.entries(frames)) {
        this.anims.create({
          key: `${key}_${anim}`,
          frames: refs.map((r) => ({ key: r.key, frame: r.frame })),
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
    // ?boss in the address goes straight to the boss fight, for playtesting it;
    // ?area=frostmere (or ?area=2, a tier) to an area, with &level=3 for a level in it
    const q = new URLSearchParams(location.search);
    const where = q.get('area') ?? undefined;
    const level = Number(q.get('level')) || 1;
    // &type=elite or &type=challenge (with &challenge=swift, unscathed or steadfast) for a level type
    const type = (['normal', 'challenge', 'elite'] as const).find((t) => t === q.get('type'));
    if (q.has('rig')) this.scene.start('riglab'); // the rig lab, a test page for characters from parts
    else if (q.has('boss')) this.scene.start('room', { room: LEVELS_PER_AREA, area: where });
    else if (where) this.scene.start('room', { room: Math.min(LEVELS_PER_AREA, Math.max(1, level)), area: where, type, challenge: q.get('challenge') ?? undefined });
    else if (q.has('camp')) this.scene.start('room', { room: 0 });
    else if (q.has('coop')) this.scene.start('lobby'); // the co-op lobby
    else this.scene.start('menu');
  }
}
