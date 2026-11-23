import Phaser from 'phaser';
import { makeTitleTextures, panelTexture } from '../titleArt';
import { firstFrame, loadedAnims } from '../assets';
import { settings, saveSettings } from '../settings';
import { CHARACTERS, type CharKey } from '../config';

const DISPLAY = '"Cinzel Decorative", "Cinzel", Georgia, serif';
const SERIF = '"Cinzel", Georgia, serif';
const GOLD = '#f3d68a';
const IVORY = '#e9dcc0';

type Mode = 'intro' | 'prompt' | 'menu' | 'options' | 'credits' | 'leaving';

interface Row { text: Phaser.GameObjects.Text; label: () => string; act: () => void }

export class MenuScene extends Phaser.Scene {
  private mode: Mode = 'intro';
  private layers: { obj: Phaser.GameObjects.Components.Transform; baseX: number; depth: number }[] = [];
  private look = 0; // eased pointer offset, -1..1
  private lookTarget = 0;
  private prompt!: Phaser.GameObjects.Text;
  private buttons: { bg: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; act: () => void }[] = [];
  private flames: Phaser.GameObjects.Image[] = [];
  private menu!: Phaser.GameObjects.Container;
  private sel = 0;
  private panel?: Phaser.GameObjects.Container;
  private rows: Row[] = [];
  private rowSel = 0;
  private padPrev: boolean[] = [];

  constructor() {
    super('menu');
  }

  init() {
    this.mode = 'intro';
    this.layers = [];
    this.buttons = [];
    this.flames = [];
    this.rows = [];
    this.sel = 0;
    this.panel = undefined;
    this.padPrev = [];
  }

  create() {
    if (!this.textures.exists('tt_sky')) makeTitleTextures(this);
    this.buildScene();
    this.buildLogo();
    this.buildMenu();

    this.prompt = this.add.text(480, 498, 'Press any key to begin', { fontFamily: SERIF, fontSize: '20px', fontStyle: '700', color: '#f6e7c4', stroke: '#05070c', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(900).setAlpha(0).setShadow(0, 2, '#000', 6, true, true);

    this.add.text(948, 530, 'prototype v0.1', { fontFamily: SERIF, fontSize: '11px', color: '#8a9aa6' })
      .setOrigin(1, 1).setDepth(900).setAlpha(0.6);

    this.cameras.main.fadeIn(1400, 0, 0, 0);
    this.time.delayedCall(2300, () => this.showPrompt());

    // Phaser sometimes hands the same browser event over twice (seen in tests:
    // identical timestamps), which moved the selection two places. Handle each once.
    const seen = new WeakSet<KeyboardEvent>();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (seen.has(e)) return;
      seen.add(e);
      this.onKey(e.code || e.key, e.key);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.lookTarget = (p.x - 480) / 480; });
    this.input.on('pointerdown', () => { if (this.mode === 'prompt' || this.mode === 'intro') this.openMenu(); });
  }

  // ---- the painted scene -----------------------------------------------------

  private layer<T extends Phaser.GameObjects.Components.Transform>(obj: T, depth: number): T {
    this.layers.push({ obj, baseX: obj.x, depth });
    return obj;
  }

  private buildScene() {
    const add = this.add;
    add.image(0, 0, 'tt_sky').setOrigin(0).setDepth(0);
    this.layer(add.image(480, 0, 'tt_far').setOrigin(0.5, 0).setDepth(10), 0.15);

    // drifting mist between the tree rows
    for (const [y, dur, a] of [[330, 60000, 0.55], [372, 45000, 0.45]] as const) {
      const fog = add.tileSprite(480, y, 1200, 160, 'tt_fog').setDepth(15).setAlpha(a).setBlendMode(Phaser.BlendModes.SCREEN);
      this.tweens.add({ targets: fog, tilePositionX: 640, duration: dur, repeat: -1 });
      this.layer(fog, 0.25);
    }

    // rune ring with its glow
    const portalGlow = add.image(664, 300, 'tt_light').setDepth(19).setScale(1.5).setTint(0x3fe8dc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
    this.tweens.add({ targets: portalGlow, alpha: 0.25, scale: 1.35, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.layer(portalGlow, 0.35);
    this.layer(add.image(664, 418, 'tt_portal').setOrigin(0.5, 1).setDepth(20).setScale(0.95), 0.35);
    const runes = add.particles(664, 300, 'tt_dot', {
      x: { min: -60, max: 60 }, y: { min: -40, max: 60 },
      speedY: { min: -18, max: -6 }, lifespan: { min: 2500, max: 4500 },
      scale: { start: 0.25, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: [0x7ffcf0, 0x9b7bff], blendMode: 'ADD', frequency: 180,
    }).setDepth(21);
    this.layer(runes, 0.35);

    this.layer(add.image(480, 0, 'tt_mid').setOrigin(0.5, 0).setDepth(30), 0.5);

    // lantern post with its pool of light
    const lantern = this.layer(add.image(566, 432, 'tt_lantern').setOrigin(0.5, 1).setDepth(34).setScale(0.8), 0.6);
    const lglow = add.image(lantern.x + 13, 432 - 160 * 0.8 + 18, 'tt_light').setDepth(35).setScale(0.7).setTint(0xffb347).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    this.tweens.add({ targets: lglow, alpha: 0.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.layer(lglow, 0.6);

    this.layer(add.image(480, 0, 'tt_ground').setOrigin(0.5, 0).setDepth(40), 0.7);
    this.layer(add.image(740, 444, 'tt_grave').setOrigin(0.5, 1).setDepth(42).setScale(0.75), 0.7);
    this.layer(add.image(900, 450, 'tt_grave').setOrigin(0.5, 1).setDepth(42).setScale(0.6).setAngle(-8), 0.7);

    this.buildCampfire(470, 470);

    // the Valkyrie keeping watch, lit by the fire on her right side
    const hero = this.character('hero', 384, 478, 232, false);
    hero.setTint(0x8c98bc, 0xffc999, 0x8c98bc, 0xffc999);
    this.layer(hero, 0.75);

    // the dead, creeping in from the dark
    const z = this.character('ghoul', 832, 488, 220, true);
    z.setTint(0x7d8eb0, 0x3c4964, 0x7d8eb0, 0x3c4964);
    this.layer(z, 0.8);
    const s = this.character('archer', 762, 456, 176, true);
    s.setTint(0x5d6c8c, 0x2f3a52, 0x5d6c8c, 0x2f3a52).setDepth(41);
    this.layer(s, 0.7);
    this.tweens.add({ targets: z, x: '-=10', duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // fireflies drifting over the clearing
    const flies = add.particles(0, 0, 'tt_dot', {
      x: { min: 40, max: 920 }, y: { min: 190, max: 470 },
      speed: { min: 4, max: 14 }, lifespan: { min: 4000, max: 7000 },
      scale: { min: 0.14, max: 0.26 },
      alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.9 },
      tint: [0xc8ff8a, 0x9cf7c8], blendMode: 'ADD', frequency: 240,
    }).setDepth(60);
    flies.fastForward(5000);
    this.layer(flies, 0.8);

    this.layer(add.image(480, 0, 'tt_vines').setOrigin(0.5, 0).setDepth(70), 0.9);
    this.layer(add.image(480, 0, 'tt_front').setOrigin(0.5, 0).setDepth(80), 1.1);
    add.image(0, 0, 'tt_vignette').setOrigin(0).setDepth(90);
  }

  private character(key: CharKey, x: number, y: number, height: number, flip: boolean) {
    const art = loadedAnims[key]?.has('idle');
    const spr = this.add.sprite(x, y, art ? firstFrame[key]! : `ph_${key}`).setOrigin(0.5, art ? CHARACTERS[key].footY : 0.98).setDepth(50);
    spr.setScale(art ? height / spr.height : (height * 0.62) / 84);
    spr.setFlipX(flip);
    if (art) spr.play({ key: `${key}_idle`, repeat: -1, frameRate: 12 + Math.random() * 4 });
    this.add.ellipse(x, y - 2, height * 0.32, 14, 0x000000, 0.45).setDepth(49);
    return spr;
  }

  private buildCampfire(x: number, y: number) {
    const add = this.add;
    const pool = add.image(x, y - 6, 'tt_light').setDepth(45).setScale(3.4, 0.9).setTint(0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
    const halo = add.image(x, y - 50, 'tt_light').setDepth(55).setScale(2.6).setTint(0xff9a3c).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32);
    this.layer(pool, 0.75);
    this.layer(halo, 0.75);
    this.time.addEvent({
      delay: 90, loop: true,
      callback: () => {
        const f = Math.random();
        halo.setAlpha(0.27 + f * 0.1).setScale(2.5 + f * 0.25);
        pool.setAlpha(0.4 + f * 0.1);
      },
    });
    this.layer(add.image(x, y + 4, 'tt_stones').setOrigin(0.5, 1).setDepth(46).setScale(0.8), 0.75);
    this.layer(add.image(x, y - 2, 'tt_logs').setOrigin(0.5, 1).setDepth(47).setScale(0.7), 0.75);
    for (const [tint, s, dx] of [[0xff5a14, 1.0, 0], [0xffa03a, 0.72, -4], [0xfff0b0, 0.42, 2]] as const) {
      const fl = add.image(x + dx, y - 14, 'tt_flame').setOrigin(0.5, 0.92).setScale(s * 0.75, s).setTint(tint).setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: fl, scaleY: s * 1.18, scaleX: s * 0.68, duration: 140 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: fl, angle: { from: -5, to: 5 }, duration: 300 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.layer(fl, 0.75);
    }
    const embers = add.particles(x, y - 30, 'tt_dot', {
      x: { min: -16, max: 16 },
      speedY: { min: -95, max: -40 }, speedX: { min: -22, max: 22 },
      accelerationX: { min: -14, max: 14 },
      lifespan: { min: 1400, max: 2800 },
      scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xffd27a, 0xff9a3c, 0xff6a2a], blendMode: 'ADD', frequency: 55,
    }).setDepth(56);
    this.layer(embers, 0.75);
  }

  // ---- logo -------------------------------------------------------------------

  private buildLogo() {
    const logo = this.add.text(480, 96, 'FELLSPIRE', {
      fontFamily: DISPLAY, fontSize: '84px', fontStyle: '900', color: '#f6d77c',
      stroke: '#2a1205', strokeThickness: 9, padding: { x: 20, y: 14 },
    }).setOrigin(0.5).setDepth(800);
    const grd = logo.context.createLinearGradient(0, 14, 0, logo.height - 14);
    grd.addColorStop(0, '#fff6c8');
    grd.addColorStop(0.42, '#f2c25a');
    grd.addColorStop(0.55, '#b8781f');
    grd.addColorStop(1, '#ffe08a');
    logo.setFill(grd);
    logo.setShadow(0, 6, '#000000', 14, true, true);
    if (logo.preFX) {
      logo.preFX.padding = 28;
      logo.preFX.addGlow(0xff8a2a, 3, 0, false, 0.1, 14);
      logo.preFX.addShine(0.35, 0.3, 4);
    }

    const ribbon = this.add.image(480, 164, 'tt_ribbon').setDepth(799).setScale(0.92);
    const sub = this.add.text(480, 160, 'Tales of the Blightwood', {
      fontFamily: SERIF, fontSize: '17px', fontStyle: '700', color: '#f8e7bd',
    }).setOrigin(0.5).setDepth(801).setShadow(0, 1, '#000', 3, true, true);

    // drop in after the scene fades up
    for (const o of [logo, ribbon, sub]) o.setAlpha(0);
    logo.setScale(1.25);
    this.tweens.add({ targets: logo, alpha: 1, scale: 1, duration: 900, delay: 700, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [ribbon, sub], alpha: 1, duration: 700, delay: 1400 });
    this.time.delayedCall(1150, () => {
      const burst = this.add.particles(480, 100, 'tt_dot', {
        x: { min: -260, max: 260 }, y: { min: -20, max: 30 },
        speed: { min: 20, max: 80 }, angle: { min: 200, max: 340 },
        lifespan: { min: 700, max: 1500 }, scale: { start: 0.35, end: 0 },
        tint: [0xffd27a, 0xff9a3c], blendMode: 'ADD', emitting: false,
      }).setDepth(802);
      burst.explode(70);
      this.time.delayedCall(1600, () => burst.destroy());
    });
  }

  // ---- menu -------------------------------------------------------------------

  private buildMenu() {
    this.menu = this.add.container(0, 0).setDepth(850).setAlpha(0);
    const strip = this.add.graphics();
    strip.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0, 0.7, 0);
    strip.fillRect(0, 210, 380, 260);
    this.menu.add(strip);

    const items: [string, () => void][] = [
      ['New Run', () => this.startRun()],
      ['Options', () => this.openOptions()],
      ['Credits', () => this.openCredits()],
    ];
    items.forEach(([label, act], i) => {
      const y = 262 + i * 64;
      const bg = this.add.image(172, y, 'tt_btn').setInteractive({ useHandCursor: true });
      const text = this.add.text(172, y - 1, label, { fontFamily: SERIF, fontSize: '22px', fontStyle: '700', color: IVORY })
        .setOrigin(0.5).setShadow(0, 2, '#000', 4, true, true);
      bg.on('pointerover', () => { if (this.mode === 'menu') this.select(i); });
      bg.on('pointerdown', () => { if (this.mode === 'menu') { this.select(i); act(); } });
      this.buttons.push({ bg, text, act });
      this.menu.add([bg, text]);
    });
    for (const side of [-1, 1]) {
      const f = this.add.image(0, 0, 'tt_flame').setScale(0.22, 0.3).setTint(0xffa03a).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, scaleY: 0.36, duration: 160, yoyo: true, repeat: -1, delay: side > 0 ? 80 : 0 });
      this.flames.push(f);
      this.menu.add(f);
    }
    this.select(0);
  }

  private select(i: number) {
    this.sel = (i + this.buttons.length) % this.buttons.length;
    this.buttons.forEach((b, k) => {
      const on = k === this.sel;
      b.bg.setTexture(on ? 'tt_btn_hi' : 'tt_btn');
      b.text.setColor(on ? '#fff3cc' : IVORY);
      this.tweens.add({ targets: [b.bg, b.text], scale: on ? 1.05 : 1, duration: 120 });
    });
    const b = this.buttons[this.sel].bg;
    this.flames[0].setPosition(b.x - 152, b.y + 6);
    this.flames[1].setPosition(b.x + 152, b.y + 6);
  }

  private showPrompt() {
    if (this.mode !== 'intro') return;
    this.mode = 'prompt';
    this.tweens.add({ targets: this.prompt, alpha: { from: 0, to: 1 }, duration: 700 });
    this.tweens.add({ targets: this.prompt, alpha: 0.35, duration: 1100, yoyo: true, repeat: -1, delay: 700, ease: 'Sine.easeInOut' });
  }

  private openMenu() {
    if (this.mode !== 'prompt' && this.mode !== 'intro') return;
    this.mode = 'menu';
    this.tweens.killTweensOf(this.prompt);
    this.tweens.add({ targets: this.prompt, alpha: 0, duration: 250 });
    this.menu.x = -60;
    this.tweens.add({ targets: this.menu, alpha: 1, x: 0, duration: 450, ease: 'Cubic.easeOut' });
  }

  private startRun() {
    if (this.mode !== 'menu') return;
    this.mode = 'leaving';
    const cam = this.cameras.main;
    cam.flash(250, 255, 170, 90);
    this.time.delayedCall(150, () => cam.fadeOut(700, 0, 0, 0));
    cam.once('camerafadeoutcomplete', () => this.scene.start('room', { room: 1 }));
  }

  // ---- panels -----------------------------------------------------------------

  private openPanel(title: string, w: number, h: number, body: string | null, rows: Omit<Row, 'text'>[]) {
    const key = `tt_panel_${w}x${h}`;
    if (!this.textures.exists(key)) panelTexture(this, key, w, h);
    const c = this.add.container(480, 300).setDepth(950).setAlpha(0);
    const shade = this.add.rectangle(0, -300 + 270, 960, 540, 0x000000, 0.55).setInteractive();
    c.add(shade);
    c.add(this.add.image(0, 0, key));
    c.add(this.add.text(0, -h / 2 + 38, title, { fontFamily: DISPLAY, fontSize: '28px', fontStyle: '700', color: GOLD })
      .setOrigin(0.5).setShadow(0, 2, '#000', 4, true, true));
    let y = -h / 2 + 82;
    if (body) {
      const t = this.add.text(0, y, body, { fontFamily: SERIF, fontSize: '15px', color: IVORY, align: 'center', lineSpacing: 7, wordWrap: { width: w - 70 } })
        .setOrigin(0.5, 0);
      c.add(t);
      y += t.height + 24;
    }
    this.rows = rows.map((r, i) => {
      const text = this.add.text(0, y + i * 42, r.label(), { fontFamily: SERIF, fontSize: '20px', fontStyle: '700', color: IVORY })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).setShadow(0, 2, '#000', 4, true, true);
      text.on('pointerover', () => this.selectRow(i));
      text.on('pointerdown', () => { this.selectRow(i); this.activateRow(); });
      c.add(text);
      return { ...r, text };
    });
    this.panel = c;
    this.selectRow(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
  }

  private selectRow(i: number) {
    this.rowSel = (i + this.rows.length) % this.rows.length;
    this.rows.forEach((r, k) => {
      const on = k === this.rowSel;
      r.text.setText(on ? `~  ${r.label()}  ~` : r.label());
      r.text.setColor(on ? '#ffe9a8' : IVORY);
    });
  }

  private activateRow() {
    this.rows[this.rowSel]?.act();
    if (this.panel) this.selectRow(this.rowSel);
  }

  private closePanel() {
    const p = this.panel;
    if (!p) return;
    this.panel = undefined;
    this.rows = [];
    this.tweens.add({ targets: p, alpha: 0, duration: 150, onComplete: () => p.destroy() });
    this.mode = 'menu';
  }

  private openOptions() {
    this.mode = 'options';
    const onOff = (v: boolean) => (v ? 'On' : 'Off');
    this.openPanel('Options', 440, 300, null, [
      { label: () => `Screen shake: ${onOff(settings.screenShake)}`, act: () => { settings.screenShake = !settings.screenShake; saveSettings(); } },
      { label: () => `Damage numbers: ${onOff(settings.damageNumbers)}`, act: () => { settings.damageNumbers = !settings.damageNumbers; saveSettings(); } },
      { label: () => `Fullscreen: ${onOff(this.scale.isFullscreen)}`, act: () => { this.scale.toggleFullscreen(); this.time.delayedCall(200, () => this.panel && this.selectRow(this.rowSel)); } },
      { label: () => 'Back', act: () => this.closePanel() },
    ]);
  }

  private openCredits() {
    this.mode = 'credits';
    this.openPanel('Credits', 560, 360,
      'A personal prototype, built with Claude.\n\n' +
      'Character art: CraftPix.net chibi packs\n(Valkyrie, Zombie Villager, Skeleton Warrior)\n' +
      'Fonts: Cinzel and Cinzel Decorative by Natanael Gama\n' +
      'Engine: Phaser 3',
      [{ label: () => 'Back', act: () => this.closePanel() }]);
  }

  // ---- input --------------------------------------------------------------------

  private onKey(code: string, key: string) {
    const is = (...names: string[]) => names.includes(code) || names.includes(key);
    const up = is('ArrowUp', 'Up', 'KeyW', 'w');
    const down = is('ArrowDown', 'Down', 'KeyS', 's');
    const ok = is('Enter', 'Space', ' ', 'KeyJ', 'j', 'NumpadEnter');
    const back = is('Escape', 'Esc', 'Backspace', 'KeyK', 'k');
    if (this.mode === 'intro' || this.mode === 'prompt') { this.openMenu(); return; }
    this.nav(up, down, ok, back);
  }

  private nav(up: boolean, down: boolean, ok: boolean, back: boolean) {
    switch (this.mode) {
      case 'intro':
      case 'prompt':
        if (up || down || ok || back) this.openMenu();
        break;
      case 'menu':
        if (up) this.select(this.sel - 1);
        if (down) this.select(this.sel + 1);
        if (ok) this.buttons[this.sel].act();
        break;
      case 'options':
      case 'credits':
        if (up) this.selectRow(this.rowSel - 1);
        if (down) this.selectRow(this.rowSel + 1);
        if (ok) this.activateRow();
        if (back) this.closePanel();
        break;
    }
  }

  update(_t: number, dms: number) {
    // gentle parallax: nearer layers drift further with the mouse
    this.look += (this.lookTarget - this.look) * Math.min(1, dms / 400);
    for (const l of this.layers) l.obj.x = l.baseX - this.look * 34 * l.depth;

    const pad = this.input.gamepad?.pad1;
    if (pad) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const hit = (i: number) => b(i) && !this.padPrev[i];
      const stickUp = pad.leftStick.y < -0.5 && !this.padPrev[99];
      const stickDown = pad.leftStick.y > 0.5 && !this.padPrev[98];
      this.nav(hit(12) || stickUp, hit(13) || stickDown, hit(0) || hit(9), hit(1));
      this.padPrev = pad.buttons.map((x) => x.pressed);
      this.padPrev[99] = pad.leftStick.y < -0.5;
      this.padPrev[98] = pad.leftStick.y > 0.5;
    }
  }
}
