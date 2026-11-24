// Character creation: name, helmet, eyes, armour and skin tone, with the hero
// shown large and updating as you choose. Opens from the title screen: on the
// first New Run (then straight into the run), or from its Character item (then
// back to the menu). Until the hub exists (DESIGN.md 8.3), this is the hub's job.
import Phaser from 'phaser';
import { ARMOURS, EYES, HELMETS, NAME_MAX, dressRig, heroLook, heroRig, randomLook, saveLook, type HeroLook } from '../hero';
import { SKIN_TONES } from '../rig/skin';
import type { Rig } from '../rig/Rig';
import { makeTitleTextures } from '../titleArt';
import { Button, ChoiceRow, FocusList, Frame, TextRow, bandTextures, keyHint, pic, type Focusable } from '../ui/kit';
import { C, txt } from '../ui/theme';
import { screenCamera } from '../ui/view';

export interface CreateData {
  // 'run': made on the way into a run, which starts after; 'menu': back to the title
  then: 'run' | 'menu';
}

const rgbNum = ([r, g, b]: [number, number, number]) => (r << 16) | (g << 8) | b;

export class CreateScene extends Phaser.Scene {
  private look!: HeroLook;
  private then: CreateData['then'] = 'menu';
  private rig: Rig | null = null;
  private list!: FocusList;
  private nameRow!: TextRow;
  private rows: ChoiceRow[] = [];
  private confirm!: Button;
  private leaving = false;
  private padPrev: boolean[] = [];

  constructor() {
    super('create');
  }

  init(data: CreateData) {
    this.then = data?.then ?? 'menu';
    this.look = { ...heroLook() };
    this.rows = [];
    this.leaving = false;
    this.padPrev = [];
    this.rig = null;
  }

  create() {
    screenCamera(this);
    if (!this.textures.exists('tt_sky')) makeTitleTextures(this);
    this.buildBackdrop();
    this.buildHero();
    this.buildPanel();

    this.cameras.main.fadeIn(500, 0, 0, 0);
    const seen = new WeakSet<KeyboardEvent>();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (seen.has(e)) return;
      seen.add(e);
      this.onKey(e);
    });
  }

  // ---- the clearing at night, quieter than the title screen ------------------------

  private buildBackdrop() {
    const add = this.add;
    add.image(0, 0, 'tt_sky').setOrigin(0).setDepth(0);
    add.image(480, 0, 'tt_far').setOrigin(0.5, 0).setDepth(1);
    add.image(480, 0, 'tt_mid').setOrigin(0.5, 0).setDepth(2);
    add.image(480, 0, 'tt_ground').setOrigin(0.5, 0).setDepth(3);
    add.rectangle(480, 270, 960, 540, 0x02040a, 0.35).setDepth(4);
    // a pool of warm light where she stands
    const pool = add.image(270, 478, 'tt_light').setDepth(5).setScale(3.2, 0.9).setTint(0xff9a3c).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    const halo = add.image(270, 330, 'tt_light').setDepth(5).setScale(3.4).setTint(0xffb060).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
    this.tweens.add({ targets: [pool, halo], alpha: '-=0.06', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const motes = add.particles(0, 0, 'tt_dot', {
      x: { min: 120, max: 420 }, y: { min: 200, max: 480 },
      speedY: { min: -14, max: -4 }, lifespan: { min: 3000, max: 6000 },
      scale: { min: 0.12, max: 0.22 }, alpha: { start: 0.8, end: 0 },
      tint: [0xffd27a, 0xff9a3c], blendMode: 'ADD', frequency: 260,
    }).setDepth(6);
    motes.fastForward(4000);
    add.image(0, 0, 'tt_vignette').setOrigin(0).setDepth(90);
  }

  private buildHero() {
    this.add.ellipse(270, 476, 120, 22, 0x000000, 0.5).setDepth(9);
    this.rig = heroRig(this, 270, 478, 380 / 900, this.look);
    if (!this.rig) {
      txt(this, 270, 320, 'The character parts are not unpacked,\nso the hero cannot be shown.', 'body', { align: 'center' }).setOrigin(0.5).setDepth(10);
      return;
    }
    this.rig.setDepth(10).setInteractive(new Phaser.Geom.Rectangle(-500, -900, 1000, 900), Phaser.Geom.Rectangle.Contains);
    this.rig.on('pointerup', () => this.flourish());
  }

  // a short swing, so you see the armour move
  private flourish() {
    this.rig?.play('Slashing', true, { loop: false, duration: 600 });
  }

  // ---- the choices ----------------------------------------------------------------

  private buildPanel() {
    bandTextures(this); // the gold ornament divider
    const f = new Frame(this, 690, 262, 400, 430, 'gold', this.then === 'run' ? 'Create your Hero' : 'Your Hero').setDepth(100);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { f.add(o); return o; };
    add(txt(this, 0, -170, 'One hero, every run. The weapon you carry decides how you fight.', 'small', { fontSize: '11px', color: C.body, strokeThickness: 0 }).setOrigin(0.5));

    this.nameRow = add(new TextRow(this, 0, -132, 'Name', () => this.look.name, (s) => { this.look.name = s; this.validate(); }, NAME_MAX));
    const choice = (y: number, label: string, names: string[], k: 'helmet' | 'eyes' | 'armour' | 'skin', swatch?: (i: number) => number) => {
      const r = add(new ChoiceRow(this, 0, y, label, names, () => this.look[k], (i) => { this.look[k] = i; this.dress(); }, swatch));
      this.rows.push(r);
      return r;
    };
    const helmet = choice(-92, 'Helmet', HELMETS, 'helmet');
    const eyes = choice(-60, 'Eyes', EYES, 'eyes');
    const armour = choice(-28, 'Armour', ARMOURS, 'armour');
    const skin = choice(4, 'Skin tone', SKIN_TONES.map((t) => t.name), 'skin', (i) => rgbNum(SKIN_TONES[i].rgb));

    add(pic(this, 0, 40, 'ui_ornament'));
    const random = add(new Button(this, 0, 74, 200, 32, 'Randomise', () => this.randomise(), 14));
    this.confirm = add(new Button(this, 0, 126, 220, 40, this.then === 'run' ? 'Begin the Run' : 'Done', () => this.finish(), 17));
    const items: Focusable[] = [this.nameRow, helmet, eyes, armour, skin, random, this.confirm];
    if (this.then === 'menu') items.push(add(new Button(this, 0, 172, 160, 30, 'Cancel', () => this.leave(false), 13)));
    this.list = new FocusList(items, 1);

    const hint = this.add.container(0, 514).setDepth(100).setAlpha(0.8);
    const h1 = keyHint(this, 0, 0, ['W', 'S'], 'Choose');
    const h2 = keyHint(this, h1.width + 14, 0, ['A', 'D'], 'Change');
    const h3 = keyHint(this, h1.width + h2.width + 28, 0, ['Enter'], 'Confirm');
    hint.add([h1, h2, h3]);
    hint.x = 690 - (h1.width + h2.width + h3.width + 28) / 2;
    this.validate();
  }

  private dress() {
    if (this.rig) dressRig(this.rig, this.look);
  }

  private randomise() {
    this.look = randomLook();
    this.nameRow.refresh();
    for (const r of this.rows) r.refresh();
    this.dress();
    this.validate();
    this.flourish();
  }

  // a hero needs a name
  private validate() {
    this.confirm?.setEnabled(this.look.name.trim().length > 0);
  }

  private finish() {
    if (this.look.name.trim().length === 0) return;
    saveLook(this.look);
    this.leave(true);
  }

  private leave(saved: boolean) {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    if (saved && this.then === 'run') {
      this.flourish();
      cam.flash(250, 255, 170, 90);
      this.time.delayedCall(250, () => cam.fade(700, 0, 0, 0, true));
      cam.once('camerafadeoutcomplete', () => this.scene.start('room', { room: 0 })); // the camp
    } else {
      cam.fade(300, 0, 0, 0, true);
      cam.once('camerafadeoutcomplete', () => this.scene.start('menu', { skipIntro: true }));
    }
  }

  // ---- input --------------------------------------------------------------------

  private onKey(e: KeyboardEvent) {
    if (this.leaving) return;
    const code = e.code, key = e.key;
    // typing into the name: letters, digits and Backspace belong to the field
    if (this.nameRow.focused && this.nameRow.typeKey(key)) { e.preventDefault(); return; }
    const is = (...names: string[]) => names.includes(code) || names.includes(key);
    const up = is('ArrowUp', 'KeyW') || (is('Tab') && e.shiftKey);
    const down = is('ArrowDown', 'KeyS') || (is('Tab') && !e.shiftKey);
    const left = is('ArrowLeft', 'KeyA');
    const right = is('ArrowRight', 'KeyD');
    const ok = is('Enter', 'NumpadEnter', 'Space', 'KeyJ');
    if (is('Tab')) e.preventDefault();
    if (is('Escape')) { if (this.then === 'menu') this.leave(false); return; }
    // Enter on the name moves on to the next row
    if (ok && this.nameRow.focused) { this.list.focus(this.list.index + 1); return; }
    this.list.nav(up, down, left, right, ok);
  }

  update(_t: number, dms: number) {
    if (this.rig) {
      this.rig.step(dms);
      if (this.rig.done) this.rig.play('Idle');
    }
    const pad = this.input.gamepad?.pad1;
    if (pad && !this.leaving) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const hit = (i: number) => b(i) && !this.padPrev[i];
      const sx = pad.leftStick.x, sy = pad.leftStick.y;
      const st = { u: sy < -0.5, d: sy > 0.5, l: sx < -0.5, r: sx > 0.5 };
      const was = { u: this.padPrev[99], d: this.padPrev[98], l: this.padPrev[97], r: this.padPrev[96] };
      this.list.nav(hit(12) || (st.u && !was.u), hit(13) || (st.d && !was.d), hit(14) || (st.l && !was.l), hit(15) || (st.r && !was.r), hit(0) || hit(9));
      if (hit(1) && this.then === 'menu') this.leave(false);
      if (hit(3)) this.randomise();
      this.padPrev = pad.buttons.map((x) => x.pressed);
      this.padPrev[99] = st.u; this.padPrev[98] = st.d; this.padPrev[97] = st.l; this.padPrev[96] = st.r;
    }
  }
}
