// The rig lab (open the game with ?rig): a proof that characters can be drawn from
// the packs' separate parts with our own Spriter player.
//
// Columns, left to right: the ready-made frames the game uses now; the same
// character drawn by the player; both laid over each other to check they match;
// then mixed characters, parts from different packs with drawn weapons.
// Keys 1-9 switch the animation.
import Phaser from 'phaser';
import { loadParts } from '../rig/parts';
import { Rig, type PartSwap } from '../rig/Rig';
import { weaponParts } from '../rig/weapons';
import { screenCamera, STAGE_LEFT } from '../ui/view';
import { C, txt } from '../ui/theme';
import { CHARACTERS, WORLD } from '../config';
import { firstFrame, loadedAnims } from '../assets';

const ANIMS: [string, string][] = [
  ['Idle', 'idle'], ['Walking', 'walk'], ['Running', 'run'], ['Slashing', 'attack'], ['Run Slashing', 'heavy'],
  ['Throwing', 'throw'], ['Sliding', 'dodge'], ['Hurt', 'hurt'], ['Dying', 'die'],
];
const HEIGHT = 230; // on-screen size of a whole 900-pixel frame

export class RigLabScene extends Phaser.Scene {
  rigs: Rig[] = [];
  frames: Phaser.GameObjects.Sprite[] = [];
  private label!: Phaser.GameObjects.Text;
  ready = false;

  constructor() {
    super('riglab');
  }

  async create() {
    screenCamera(this, true);
    const g = this.add.graphics();
    g.fillGradientStyle(0x16283a, 0x16283a, 0x070b12, 0x070b12, 1).fillRect(STAGE_LEFT, 0, WORLD.viewW, 540);
    g.fillStyle(0x0c141c, 1).fillRect(STAGE_LEFT, 440, WORLD.viewW, 100);
    txt(this, 480, 30, 'RIG LAB', 'head', { fontSize: '20px', letterSpacing: 4 }).setOrigin(0.5);
    this.label = txt(this, 480, 56, '', 'label', { fontSize: '14px' }).setOrigin(0.5);
    txt(this, 480, 520, 'Keys 1-9: animation', 'small', { fontSize: '12px', color: C.grey }).setOrigin(0.5);

    const scmls = await loadParts(this, ['Valkyrie_1', 'Valkyrie_2', 'Skeleton_Warrior_1', 'Zombie_Villager_1']);
    const w = weaponParts(this);
    const size = HEIGHT / 900;
    const col = (i: number) => 96 + i * 192;
    const y = 440;

    // 1: the frames used now
    const art = loadedAnims.hero?.has('idle');
    const fr = this.add.sprite(col(0), y, firstFrame.hero ?? 'ph_hero').setOrigin(0.5, CHARACTERS.hero.footY);
    if (art) fr.setScale(HEIGHT / fr.height);
    this.frames.push(fr);
    // 2: the same character from parts
    this.rigs.push(new Rig(this, col(1), y, scmls.get('Valkyrie_1')!, 'Valkyrie_1', size));
    // 3: both, overlaid: red where only the frames are, the rig on top half see-through
    const under = this.add.sprite(col(2), y, firstFrame.hero ?? 'ph_hero').setOrigin(0.5, CHARACTERS.hero.footY).setTintFill(0xff3030).setAlpha(0.8);
    if (art) under.setScale(HEIGHT / under.height);
    this.frames.push(under);
    const over = new Rig(this, col(2), y, scmls.get('Valkyrie_1')!, 'Valkyrie_1', size);
    over.setAlpha(0.75);
    this.rigs.push(over);
    // 4: a Valkyrie body with the Skeleton's head and faces, and a bow
    const a = new Rig(this, col(3), y, scmls.get('Valkyrie_1')!, 'Valkyrie_1', size);
    for (const f of ['Head.png', 'Face 01.png', 'Face 02.png', 'Face 03.png']) a.skin.set(f, { texture: `Skeleton_Warrior_1/${f}` });
    a.skin.set('Sword.png', w.bow);
    a.skin.set('Shield.png', { texture: null } as PartSwap);
    this.rigs.push(a);
    // 5: a Zombie body with the second Valkyrie's head, and a staff
    const b = new Rig(this, col(4), y, scmls.get('Zombie_Villager_1')!, 'Zombie_Villager_1', size);
    for (const f of ['Head.png', 'Face 01.png', 'Face 02.png', 'Face 03.png']) b.skin.set(f, { texture: `Valkyrie_2/${f}` });
    b.skin.set('Sword.png', w.staff);
    this.rigs.push(b);

    const names = ['Frames (now)', 'Rig from parts', 'Overlaid', 'Skull head + bow', 'Mixed + staff'];
    names.forEach((n, i) => txt(this, col(i), 470, n, 'label', { fontSize: '13px', color: C.gold }).setOrigin(0.5));

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= ANIMS.length) this.show(n - 1);
    });
    this.show(0);
    this.ready = true;
  }

  show(i: number) {
    const [rigName, frameName] = ANIMS[i];
    for (const r of this.rigs) r.play(rigName, true);
    const len = this.rigs[0].scml.anims.get(rigName)!.length;
    for (const f of this.frames) {
      const key = `hero_${frameName}`;
      if (!this.anims.exists(key)) continue;
      const frames = this.anims.get(key).frames.length;
      f.play({ key, repeat: -1, frameRate: frames / (len / 1000) });
    }
    this.label.setText(`${i + 1}  ${rigName}`);
  }

  update(_t: number, dms: number) {
    for (const r of this.rigs) {
      r.step(dms);
      if (r.done) r.play(r.animation, true);
    }
  }
}
