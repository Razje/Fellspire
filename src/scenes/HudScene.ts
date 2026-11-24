// Everything drawn over a fight, as its own scene on top of the room: the hero's
// unit frame and action bar, the room plaque and objective, banners, the pause
// menu and the end-of-run screen.
//
// Layout after Lost Castle 2 (small, at the edges, the hero's things bottom left);
// styling after classic fantasy MMOs (portrait in a gilded ring, green health,
// square action slots with keys, gilded panels and red buttons).
//
// It reads the room's state every frame; the room calls it for events (banners,
// an attack used, the hero falling). Esc belongs to this scene, so pausing works
// while the room itself is paused.
import Phaser from 'phaser';
import { WORLD } from '../config';
import { firstFrame, loadedAnims } from '../assets';
import { Bar, Button, FocusList, Frame, Slot, bandTextures, hi, icon, keyHint, pic, CURSOR, CURSOR_HOVER } from '../ui/kit';
import { openOptions, type Panel } from '../ui/panels';
import { C, FONT, GOLD_STOPS, RED_STOPS, gild, txt } from '../ui/theme';
import { screenCamera } from '../ui/view';
import type { RoomScene } from './RoomScene';

export interface RunStats { rooms: number; kills: number; damage: number; time: number }
export type BannerKind = 'zone' | 'warn' | 'good';
export type Action = 'light' | 'heavy' | 'dodge';

const { viewW, viewH } = WORLD;

function ringTexture(scene: Phaser.Scene) {
  hi(scene, 'ui_ring', 104, 104, (c) => {
    const cx = 52, cy = 50, r = 40;
    const gold = (y0: number, y1: number) => {
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, '#fff1b8'); g.addColorStop(0.35, '#e0b04a'); g.addColorStop(0.6, '#8a5f1a'); g.addColorStop(1, '#f0cf78');
      return g;
    };
    c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 8; c.shadowOffsetY = 2;
    c.lineWidth = 10; c.strokeStyle = '#0a0603'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); c.restore();
    c.lineWidth = 6; c.strokeStyle = gold(cy - r, cy + r); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.beginPath(); c.arc(cx, cy, r - 3.2, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy, r + 3.2, 0, Math.PI * 2); c.stroke();
    // engraved notches around the ring
    c.strokeStyle = 'rgba(60,30,4,0.55)'; c.lineWidth = 1;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); c.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2)); c.stroke();
    }
    // studs at the sides and a crest on top
    for (const a of [Math.PI, 0]) {
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      c.fillStyle = '#0a0603'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = gold(y - 4, y + 4); c.beginPath(); c.arc(x, y, 3.6, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#0a0603';
    c.beginPath(); c.moveTo(cx - 14, cy - r + 2); c.quadraticCurveTo(cx, cy - r - 16, cx + 14, cy - r + 2); c.closePath(); c.fill();
    c.fillStyle = gold(cy - r - 12, cy - r + 2);
    c.beginPath(); c.moveTo(cx - 11, cy - r + 1); c.quadraticCurveTo(cx, cy - r - 13, cx + 11, cy - r + 1); c.closePath(); c.fill();
    const gm = c.createRadialGradient(cx - 1, cy - r - 4, 0, cx, cy - r - 3, 5);
    gm.addColorStop(0, '#ffb0a0'); gm.addColorStop(0.5, '#d0202a'); gm.addColorStop(1, '#4a0408');
    c.fillStyle = gm; c.beginPath(); c.arc(cx, cy - r - 3, 3.6, 0, Math.PI * 2); c.fill();
  });
  hi(scene, 'ui_pip', 14, 14, (c) => {
    c.fillStyle = '#0a0603'; c.beginPath(); c.moveTo(7, 0); c.lineTo(14, 7); c.lineTo(7, 14); c.lineTo(0, 7); c.closePath(); c.fill();
    const g = c.createLinearGradient(0, 2, 0, 12); g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#e0b04a'); g.addColorStop(1, '#8a5f1a');
    c.fillStyle = g; c.beginPath(); c.moveTo(7, 2.2); c.lineTo(11.8, 7); c.lineTo(7, 11.8); c.lineTo(2.2, 7); c.closePath(); c.fill();
  });
  hi(scene, 'ui_pip_off', 14, 14, (c) => {
    c.fillStyle = '#0a0603'; c.beginPath(); c.moveTo(7, 0); c.lineTo(14, 7); c.lineTo(7, 14); c.lineTo(0, 7); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(224,176,74,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(7, 2.6); c.lineTo(11.4, 7); c.lineTo(7, 11.4); c.lineTo(2.6, 7); c.closePath(); c.stroke();
  });
  hi(scene, 'ui_roundbtn', 40, 40, (c) => {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 5; c.shadowOffsetY = 1;
    c.fillStyle = '#0a0603'; c.beginPath(); c.arc(20, 20, 17, 0, Math.PI * 2); c.fill(); c.restore();
    const g = c.createRadialGradient(17, 15, 0, 20, 20, 16); g.addColorStop(0, '#3a2a20'); g.addColorStop(1, '#0c0806');
    c.fillStyle = g; c.beginPath(); c.arc(20, 20, 14.5, 0, Math.PI * 2); c.fill();
    const gold = c.createLinearGradient(0, 4, 0, 36); gold.addColorStop(0, '#fff1b8'); gold.addColorStop(0.4, '#e0b04a'); gold.addColorStop(0.65, '#8a5f1a'); gold.addColorStop(1, '#f0cf78');
    c.lineWidth = 3; c.strokeStyle = gold; c.beginPath(); c.arc(20, 20, 15.5, 0, Math.PI * 2); c.stroke();
  });
}

export class HudScene extends Phaser.Scene {
  ready = false;
  private room!: RoomScene;
  private roomNo = 1;
  private hp!: Bar;
  private slots!: Record<Action | 'block', Slot>;
  private pips: Phaser.GameObjects.Image[] = [];
  private objective!: Phaser.GameObjects.Text;
  private objectiveDone!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private hurt!: Phaser.GameObjects.Image;
  private lastHp = 0;
  private bannerObjs: Phaser.GameObjects.GameObject[] = [];
  private pause?: { root: Phaser.GameObjects.Container; list: FocusList };
  private options?: Panel;
  private end?: { list: FocusList };
  private blur?: Phaser.FX.Blur;
  private padPrev: boolean[] = [];
  private gateShown = false;
  private bossBar?: { root: Phaser.GameObjects.Container; bar: Bar; exposed: Phaser.GameObjects.Text };
  endKind: 'death' | 'victory' | null = null;

  constructor() {
    super('hud');
  }

  init(data: { room: number }) {
    this.ready = false;
    this.roomNo = data.room ?? 1;
    this.pips = [];
    this.bannerObjs = [];
    this.pause = undefined;
    this.options = undefined;
    this.end = undefined;
    this.blur = undefined;
    this.padPrev = [];
    this.gateShown = false;
    this.bossBar = undefined;
    this.endKind = null;
  }

  create() {
    screenCamera(this);
    this.input.setDefaultCursor(CURSOR);
    this.room = this.scene.get('room') as RoomScene;
    ringTexture(this);
    bandTextures(this);
    this.buildUnitFrame();
    this.buildPlaque();
    this.buildHints();
    this.hurt = pic(this, viewW / 2, viewH / 2, 'ui_hurt').setDisplaySize(viewW, viewH).setTint(0x9a0000).setAlpha(0).setDepth(-10);
    this.lastHp = this.room.player?.hp ?? 100;

    const seen = new WeakSet<KeyboardEvent>();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (seen.has(e)) return;
      seen.add(e);
      this.onKey(e.code);
    });
    this.ready = true;
    if (!this.room.boss) this.banner('zone', 'The Blightwood', `Room ${this.roomNo}`);
    else this.buildBossBar();
  }

  // ---- the hero, bottom left ---------------------------------------------------------

  private buildUnitFrame() {
    const cx = 62, cy = 474;
    const art = loadedAnims.hero?.has('idle');
    this.add.circle(cx, cy, 37, 0x142231, 1);
    this.add.circle(cx, cy + 10, 30, 0x070b12, 0.6);
    const face = this.add.image(cx + 4, cy + 2, art ? firstFrame.hero! : 'ph_hero');
    face.setScale(art ? 150 / face.height : 1.1).setOrigin(0.5, art ? 0.56 : 0.5);
    const mask = this.make.graphics({}, false).fillCircle(cx, cy, 36);
    face.setMask(mask.createGeometryMask());
    pic(this, cx, cy - 2, 'ui_ring');

    txt(this, 116, 432, 'Valkyrie', 'head', { fontSize: '15px' }).setOrigin(0, 0.5);
    txt(this, 196, 433, 'Ironguard', 'small', { fontSize: '11px', color: C.grey }).setOrigin(0, 0.5).setVisible(false);
    this.hp = new Bar(this, 114, 444, 214, 15, 'health');

    const keys: [Action | 'block', 'light' | 'heavy' | 'dodge' | 'block', string][] = [
      ['light', 'light', 'J'], ['heavy', 'heavy', 'K'], ['dodge', 'dodge', 'Spc'], ['block', 'block', 'L'],
    ];
    const s = {} as Record<Action | 'block', Slot>;
    keys.forEach(([k, ico, key], i) => { s[k] = new Slot(this, 136 + i * 46, 492, ico, key); });
    this.slots = s;
  }

  // ---- where you are and what to do, top right ---------------------------------------

  private buildPlaque() {
    const room = this.room;
    const total = room.totalFoes;
    const f = new Frame(this, 820, 38, 172, 58, 'dark');
    f.add(txt(this, 0, -15, 'BLIGHTWOOD', 'small', { fontSize: '10px', color: C.goldSoft, letterSpacing: 3 }).setOrigin(0.5));
    f.add(txt(this, 0, room.boss ? 5 : 2, room.boss ? "Warden's Glade" : `Room ${this.roomNo}`, 'head', { fontSize: room.boss ? '15px' : '17px', color: C.ivory }).setOrigin(0.5));
    const n = room.waveCount;
    for (let i = 0; i < n; i++) {
      const p = pic(this, (i - (n - 1) / 2) * 16, 19, 'ui_pip_off');
      f.add(p);
      this.pips.push(p);
    }

    // the round menu button, Esc
    const mb = this.add.container(930, 34);
    mb.add([pic(this, 0, 0, 'ui_roundbtn'), pic(this, 0, 0, icon(this, 'menu', 22))]);
    mb.setSize(34, 34).setInteractive({ cursor: CURSOR_HOVER });
    mb.on('pointerover', () => this.tweens.add({ targets: mb, scale: 1.08, duration: 100 }));
    mb.on('pointerout', () => this.tweens.add({ targets: mb, scale: 1, duration: 100 }));
    mb.on('pointerup', () => this.openPause());
    txt(this, 930, 60, 'Esc', 'small', { fontSize: '10px', color: C.body }).setOrigin(0.5);

    // an objective tracker under the plaque
    const ox = 740;
    txt(this, ox, 80, room.boss ? 'The Drowned Light' : 'The Restless Dead', 'label', { fontSize: '13px', color: C.gold }).setOrigin(0, 0.5);
    this.objective = txt(this, ox + 8, 98, room.boss ? '- Defeat the Lantern Warden' : `- Dead laid to rest: 0/${total}`, 'small', { fontSize: '12px', color: C.ivory }).setOrigin(0, 0.5);
    this.objectiveDone = txt(this, ox + 8, 114, '- Step through the rune gate', 'small', { fontSize: '12px', color: C.ivory }).setOrigin(0, 0.5).setAlpha(0);

    // kills over the whole run, bottom right
    const k = new Frame(this, 902, 506, 92, 32, 'dark');
    k.add(pic(this, -26, 0, icon(this, 'skull', 22)));
    this.killText = txt(this, 6, 0, '0', 'head', { fontSize: '16px', color: C.ivory }).setOrigin(0, 0.5);
    k.add(this.killText);
  }

  private buildHints() {
    const row = this.add.container(0, 522);
    let x = 0;
    for (const [keys, what] of [[['W', 'A', 'S', 'D'], 'Move'], [['J'], 'Light'], [['K'], 'Heavy'], [['Space'], 'Dodge'], [['L'], 'Block'], [['Esc'], 'Menu']] as const) {
      const h = keyHint(this, x, 0, [...keys], what);
      row.add(h);
      x += h.width + 16;
    }
    row.x = viewW / 2 - (x - 16) / 2;
    row.setAlpha(0);
    this.tweens.chain({ targets: row, tweens: [{ alpha: 0.95, duration: 600, delay: 900 }, { alpha: 0, duration: 1500, delay: 9000 }] });
  }

  // ---- every frame ------------------------------------------------------------------------

  update(_t: number, dms: number) {
    const dt = Math.min(dms, 50) / 1000;
    const r = this.room;
    const p = r.player;
    if (!p) return;
    this.hp.set(Math.max(0, p.hp), p.maxHp, dt);

    // taking damage flashes the edges red; low health keeps them pulsing
    if (p.hp < this.lastHp - 0.5) {
      this.tweens.killTweensOf(this.hurt);
      this.hurt.setAlpha(0.55);
      this.tweens.add({ targets: this.hurt, alpha: 0, duration: 450 });
    } else if (p.hp > 0 && p.hp / p.maxHp < 0.3 && !this.tweens.isTweening(this.hurt)) {
      this.hurt.setAlpha(0.18 + 0.16 * Math.sin(this.time.now / 260));
    } else if (!this.tweens.isTweening(this.hurt)) this.hurt.setAlpha(0);
    this.lastHp = p.hp;

    this.slots.dodge.cooldown(Math.max(0, p.dodgeCd) / 0.55);
    this.slots.block.setActive(p.state === 'block');

    this.pips.forEach((pip, i) => pip.setTexture(r.gateOpen || i < r.wave - 1 ? 'ui_pip' : i === r.wave - 1 ? 'ui_pip' : 'ui_pip_off')
      .setAlpha(r.gateOpen || i < r.wave - 1 ? 1 : i === r.wave - 1 ? 0.55 + 0.45 * Math.sin(this.time.now / 300) ** 2 : 1));
    const total = r.totalFoes;
    if (!r.boss) this.objective.setText(`- Dead laid to rest: ${Math.min(r.slain, total)}/${total}`);
    this.updateBossBar(dt);
    if (r.gateOpen && !this.gateShown) {
      this.gateShown = true;
      this.objective.setColor(C.grey);
      this.tweens.add({ targets: this.objectiveDone, alpha: 1, duration: 500 });
    }
    this.killText.setText(String(r.run.kills));

    this.pollPad();
  }

  // ---- the boss ----------------------------------------------------------------------------

  // A long bar across the top with the boss's name, a mark where the fight
  // changes, and EXPOSED while he rests. Comes in when his introduction ends.
  private buildBossBar() {
    const w = 380;
    const root = this.add.container(viewW / 2, 30).setAlpha(0);
    const name = txt(this, 0, -12, 'The Lantern Warden', 'head', { fontSize: '16px', letterSpacing: 1 }).setOrigin(0.5);
    gild(name, GOLD_STOPS);
    const bar = new Bar(this, -w / 2, 0, w, 12, 'enemy', false);
    const tick = pic(this, 0, 6, 'ui_pip').setScale(0.4); // half health: the lantern breaks
    const exposed = txt(this, w / 2, -12, 'EXPOSED', 'small', { fontSize: '11px', color: C.gold, letterSpacing: 2 }).setOrigin(1, 0.5).setAlpha(0);
    root.add([pic(this, -w / 2 - 14, 6, 'ui_ornament').setScale(0.35, 0.8), pic(this, w / 2 + 14, 6, 'ui_ornament').setScale(0.35, 0.8)]);
    root.add([name, bar, tick, exposed]);
    this.bossBar = { root, bar, exposed };
  }

  private updateBossBar(dt: number) {
    const b = this.room.boss, bb = this.bossBar;
    if (!b || !bb) return;
    if (b.awake && bb.root.alpha === 0 && !this.tweens.isTweening(bb.root)) {
      bb.root.y = 18;
      this.tweens.add({ targets: bb.root, alpha: 1, y: 30, duration: 500, ease: 'Cubic.easeOut' });
    }
    bb.bar.set(b.hp, b.maxHp, dt);
    bb.exposed.setAlpha(b.resting ? 0.6 + 0.4 * Math.sin(this.time.now / 90) : 0);
    if (b.isDead() && bb.root.alpha === 1 && !this.tweens.isTweening(bb.root)) this.tweens.add({ targets: bb.root, alpha: 0.001, duration: 1200, delay: 600 });
  }

  // Lost Castle's boss card: a wide band low on the screen, the name in large
  // gilded letters sliding in from one side, the title from the other.
  bossIntro(name: string, title: string) {
    const cy = 356;
    const band = pic(this, viewW / 2, cy, 'ui_band').setDisplaySize(viewW, 112).setAlpha(0);
    const l1 = pic(this, viewW / 2, cy - 56, 'ui_line').setTint(0x7fe3d4).setScale(0.2, 0.5).setAlpha(0);
    const l2 = pic(this, viewW / 2, cy + 56, 'ui_line').setTint(0x7fe3d4).setScale(0.2, 0.5).setAlpha(0);
    const n = txt(this, viewW / 2 + 60, cy - 10, name.toUpperCase(), 'title', { fontFamily: FONT.head, fontSize: '44px', fontStyle: '700', letterSpacing: 3, strokeThickness: 7, padding: { x: 10, y: 8 } }).setOrigin(0.5).setAlpha(0);
    gild(n, GOLD_STOPS);
    if (n.preFX) { n.preFX.padding = 16; n.preFX.addGlow(0x3fe8dc, 2, 0, false, 0.1, 8); }
    const t = txt(this, viewW / 2 - 60, cy + 30, title, 'label', { fontSize: '16px', color: C.teal, fontStyle: 'italic', letterSpacing: 2 }).setOrigin(0.5).setAlpha(0);
    const all = [band, l1, l2, n, t];
    this.tweens.add({ targets: band, alpha: 1, duration: 300 });
    this.tweens.add({ targets: [l1, l2], alpha: 1, scaleX: 0.75, duration: 700, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: n, alpha: 1, x: viewW / 2, duration: 650, delay: 120, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 1, x: viewW / 2, duration: 650, delay: 320, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: all, alpha: 0, duration: 600, delay: 2500, onComplete: () => all.forEach((o) => o.destroy()) });
  }

  // ---- events from the room -----------------------------------------------------------------

  used(a: Action) {
    this.slots[a].flash();
  }

  banner(kind: BannerKind, text: string, sub?: string) {
    for (const o of this.bannerObjs) { this.tweens.killTweensOf(o); o.destroy(); }
    this.bannerObjs = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.bannerObjs.push(o); return o; };
    const hold = kind === 'zone' ? 2400 : 1500;
    const out = (targets: Phaser.GameObjects.GameObject[], delay: number) =>
      this.tweens.add({ targets, alpha: 0, duration: 700, delay });

    if (kind === 'zone') {
      // zone text, as when you ride into a new region: big gilded letters, no band
      const y = 124;
      const t = keep(txt(this, viewW / 2, y, text.toUpperCase(), 'title', { fontFamily: FONT.head, fontSize: '40px', fontStyle: '700', strokeThickness: 6, letterSpacing: 2, padding: { x: 8, y: 6 } }).setOrigin(0.5));
      gild(t, GOLD_STOPS);
      const orn = keep(pic(this, viewW / 2, y + 30, 'ui_ornament').setScale(0.9));
      const s = keep(txt(this, viewW / 2, y + 48, (sub ?? '').toUpperCase(), 'label', { fontSize: '14px', color: C.ivory, letterSpacing: 4 }).setOrigin(0.5));
      const all = [t, orn, s];
      for (const o of all) o.setAlpha(0);
      t.setScale(1.12);
      this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 700, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: [orn, s], alpha: 1, duration: 600, delay: 300 });
      out(all, hold);
      return;
    }

    // a dark band across the screen with the message, between two thin lines
    const y = 150;
    const lineTint = kind === 'warn' ? 0xff6a3d : 0xf0c060;
    const band = keep(pic(this, viewW / 2, y, 'ui_band').setDisplaySize(viewW, sub ? 64 : 50));
    const l1 = keep(pic(this, viewW / 2, y - (sub ? 32 : 25), 'ui_line').setTint(lineTint));
    const l2 = keep(pic(this, viewW / 2, y + (sub ? 32 : 25), 'ui_line').setTint(lineTint));
    const t = keep(txt(this, viewW / 2, sub ? y - 9 : y, text.toUpperCase(), 'head', {
      fontSize: kind === 'warn' ? '22px' : '24px', color: kind === 'warn' ? C.warn : C.gold, letterSpacing: 3, strokeThickness: 5, padding: { x: 4, y: 4 },
    }).setOrigin(0.5));
    if (kind === 'good') gild(t, GOLD_STOPS);
    const all: Phaser.GameObjects.GameObject[] = [band, l1, l2, t];
    if (sub) all.push(keep(txt(this, viewW / 2, y + 16, sub, 'label', { fontSize: '13px', color: C.ivory }).setOrigin(0.5)));
    for (const o of all) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    const bs = band.scaleY;
    band.setScale(band.scaleX, 0);
    this.tweens.add({ targets: band, scaleY: bs, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
    l1.setScale(0.2, 0.5); l2.setScale(0.2, 0.5);
    this.tweens.add({ targets: [l1, l2], scaleX: 0.5, alpha: 1, duration: 450, ease: 'Cubic.easeOut' });
    t.setScale(1.25);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 300, delay: 80, ease: 'Back.easeOut' });
    if (all[4]) this.tweens.add({ targets: all[4], alpha: 1, duration: 400, delay: 250 });
    out(all, hold);
  }

  // ---- pause ------------------------------------------------------------------------------

  private blurRoom(on: boolean) {
    const cam = this.room.cameras.main;
    if (on && !this.blur && cam.postFX) this.blur = cam.postFX.addBlur(1, 1.5, 1.5, 1.2);
    if (!on && this.blur) { cam.postFX.remove(this.blur); this.blur = undefined; }
  }

  get paused() {
    return !!this.pause;
  }

  openPause() {
    if (this.pause || this.end || !this.room.canPause()) return;
    this.room.scene.pause();
    this.blurRoom(true);
    const root = this.add.container(0, 0).setDepth(100);
    const shade = this.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x05070c, 0.45).setInteractive();
    const f = new Frame(this, viewW / 2, viewH / 2 - 6, 260, 262, 'gold', 'Game Menu');
    root.add([shade, f]);
    const items = [
      new Button(this, 0, -66, 196, 32, 'Resume', () => this.closePause()),
      new Button(this, 0, -24, 196, 32, 'Options', () => this.openOptionsPanel()),
      new Button(this, 0, 18, 196, 32, 'Restart Run', () => this.restartRun()),
      new Button(this, 0, 60, 196, 32, 'Main Menu', () => this.toMenu()),
    ];
    f.add(items);
    const hint = keyHint(this, 0, 102, ['Esc'], 'Resume');
    hint.x = -hint.width / 2;
    f.add(hint);
    shade.setAlpha(0); f.setAlpha(0).setScale(0.92);
    this.tweens.add({ targets: shade, alpha: 1, duration: 160 });
    this.tweens.add({ targets: f, alpha: 1, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.pause = { root, list: new FocusList(items) };
  }

  closePause() {
    const p = this.pause;
    if (!p) return;
    this.options?.close();
    this.pause = undefined;
    this.tweens.add({ targets: p.root, alpha: 0, duration: 140, onComplete: () => p.root.destroy() });
    this.blurRoom(false);
    this.room.scene.resume();
  }

  private openOptionsPanel() {
    if (this.options) return;
    this.options = openOptions(this, 200, () => { this.options = undefined; });
  }

  private restartRun() {
    this.blurRoom(false);
    this.room.restartRun();
  }

  private toMenu() {
    this.blurRoom(false);
    this.room.toMenu();
  }

  // ---- the end of a run ---------------------------------------------------------------------

  showDeath(run: RunStats) {
    if (this.end) return;
    this.endKind = 'death';
    this.end = { list: new FocusList([{ setFocus() {}, activate() {} }]) };
    this.time.delayedCall(900, () => this.buildEnd(run, false));
  }

  showVictory(run: RunStats) {
    if (this.end) return;
    this.endKind = 'victory';
    this.end = { list: new FocusList([{ setFocus() {}, activate() {} }]) };
    this.buildEnd(run, true);
  }

  // The end of a run, won or lost: a band across the middle in the outcome's
  // colour, the title, the run's numbers counting up in turn, then the choices.
  private buildEnd(run: RunStats, won: boolean) {
    this.blurRoom(true);
    const cx = viewW / 2, cy = viewH / 2;
    const root = this.add.container(0, 0).setDepth(100);
    const shade = this.add.rectangle(cx, cy, viewW, viewH, 0x000000, 0.45).setInteractive();
    const dark = pic(this, cx, cy, 'ui_wash').setDisplaySize(viewW, 330).setTint(0x000000).setAlpha(0.85);
    const red = pic(this, cx, cy, 'ui_wash').setDisplaySize(viewW, 300).setTint(won ? 0x5a4010 : 0x6a0804).setAlpha(0.5);
    const l1 = pic(this, cx, cy - 136, 'ui_line').setTint(won ? 0xf0c060 : 0xd8402a).setScale(0.6, 0.5);
    const l2 = pic(this, cx, cy + 142, 'ui_line').setTint(won ? 0xf0c060 : 0xd8402a).setScale(0.6, 0.5);
    root.add([shade, dark, red, l1, l2]);

    const title = won
      ? txt(this, cx, cy - 96, 'THE BLIGHTWOOD IS CLEANSED', 'title', { fontFamily: FONT.head, fontSize: '38px', fontStyle: '700', letterSpacing: 2, strokeThickness: 7, stroke: '#1a0e02', padding: { x: 16, y: 10 } }).setOrigin(0.5)
      : txt(this, cx, cy - 96, 'YOU HAVE FALLEN', 'title', { fontFamily: FONT.logo, fontSize: '46px', fontStyle: '900', strokeThickness: 7, stroke: '#1a0202', padding: { x: 16, y: 10 } }).setOrigin(0.5);
    gild(title, won ? GOLD_STOPS : RED_STOPS);
    if (title.preFX) { title.preFX.padding = 20; title.preFX.addGlow(won ? 0xffa030 : 0xff2a10, 2, 0, false, 0.1, 10); }
    const sub = txt(this, cx, cy - 56, won ? 'The Lantern Warden falls, and the dead lie still at last.' : 'The Blightwood claims another soul.', 'body', { fontSize: '15px', color: C.body }).setOrigin(0.5);
    const orn = pic(this, cx, cy - 36, 'ui_ornament');
    root.add([title, sub, orn]);

    const stats: [string, number, (v: number) => string][] = [
      ['Rooms cleared', run.rooms, (v) => String(Math.round(v))],
      ['Dead slain', run.kills, (v) => String(Math.round(v))],
      ['Damage dealt', run.damage, (v) => Math.round(v).toLocaleString('en-US')],
      ['Time', run.time, (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`],
    ];
    const vals = stats.map(([label, , fmt], i) => {
      const x = cx + (i - 1.5) * 132;
      const v = txt(this, x, cy + 6, fmt(0), 'head', { fontSize: '28px', color: C.ivory, strokeThickness: 5 }).setOrigin(0.5);
      const l = txt(this, x, cy + 34, label.toUpperCase(), 'small', { fontSize: '10px', color: C.goldSoft, letterSpacing: 2 }).setOrigin(0.5);
      root.add([v, l]);
      v.setAlpha(0); l.setAlpha(0);
      return { v, l };
    });

    const again = new Button(this, cx - 88, cy + 88, 160, 34, won ? 'New Run' : 'Try Again', () => this.restartRun());
    const menu = new Button(this, cx + 88, cy + 88, 160, 34, 'Main Menu', () => this.toMenu());
    const hint = this.add.container(0, cy + 124);
    const h1 = keyHint(this, 0, 0, ['R'], won ? 'New run' : 'Try again');
    const h2 = keyHint(this, h1.width + 18, 0, ['Esc'], 'Main menu');
    hint.add([h1, h2]);
    hint.x = cx - (h1.width + 18 + h2.width) / 2;
    root.add([again, menu, hint]);

    // in it comes: the band, the title, then each number counting up in turn
    for (const o of [shade, dark, red, l1, l2, sub, orn, again, menu, hint]) o.setAlpha(0);
    title.setAlpha(0).setScale(1.3);
    this.tweens.add({ targets: [shade, dark, red], alpha: (_: unknown, __: string, ___: unknown, i: number) => [1, 0.85, 0.5][i], duration: 500 });
    this.tweens.add({ targets: [l1, l2], alpha: 1, scaleX: 0.75, duration: 700, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 700, delay: 200, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [sub, orn], alpha: 1, duration: 500, delay: 650 });
    stats.forEach(([, target, fmt], i) => {
      const { v, l } = vals[i];
      const delay = 1000 + i * 380;
      this.tweens.add({ targets: [v, l], alpha: 1, duration: 250, delay });
      const counter = { n: 0 };
      this.tweens.add({
        targets: counter, n: target, duration: 650, delay, ease: 'Cubic.easeOut',
        onUpdate: () => v.setText(fmt(counter.n)),
        onComplete: () => { v.setText(fmt(target)); this.tweens.add({ targets: v, scale: { from: 1.18, to: 1 }, duration: 220, ease: 'Back.easeOut' }); },
      });
    });
    this.tweens.add({ targets: [again, menu, hint], alpha: 1, duration: 400, delay: 1000 + stats.length * 380 + 300 });
    this.end = { list: new FocusList([again, menu]) };
  }

  // ---- input ----------------------------------------------------------------------------------

  private onKey(code: string) {
    const up = code === 'ArrowUp' || code === 'KeyW';
    const down = code === 'ArrowDown' || code === 'KeyS';
    const left = code === 'ArrowLeft' || code === 'KeyA';
    const right = code === 'ArrowRight' || code === 'KeyD';
    const ok = code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyJ';
    const back = code === 'Escape' || code === 'Backspace';
    if (this.end) {
      if (code === 'KeyR') this.restartRun();
      else if (code === 'Escape') this.toMenu();
      else this.end.list.nav(up, down, left, right, ok);
      return;
    }
    this.nav(up, down, left, right, ok, back, code === 'Escape');
  }

  private nav(up: boolean, down: boolean, left: boolean, right: boolean, ok: boolean, back: boolean, toggle: boolean) {
    if (this.options) {
      if (back) this.options.close();
      else this.options.list.nav(up, down, left, right, ok);
    } else if (this.pause) {
      if (back) this.closePause();
      else this.pause.list.nav(up, down, left, right, ok);
    } else if (toggle) this.openPause();
  }

  private pollPad() {
    const pad = this.input.gamepad?.pad1;
    if (!pad) return;
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const hit = (i: number) => b(i) && !this.padPrev[i];
    const sy = pad.leftStick.y, sx = pad.leftStick.x;
    const up = hit(12) || (sy < -0.5 && !this.padPrev[99]);
    const down = hit(13) || (sy > 0.5 && !this.padPrev[98]);
    const left = hit(14) || (sx < -0.5 && !this.padPrev[97]);
    const right = hit(15) || (sx > 0.5 && !this.padPrev[96]);
    if (this.end) this.end.list.nav(up, down, left, right, hit(0));
    else if (this.pause || this.options) this.nav(up, down, left, right, hit(0), hit(1) || hit(9), false);
    else if (hit(9)) this.openPause();
    this.padPrev = pad.buttons.map((x) => x.pressed);
    this.padPrev[99] = sy < -0.5; this.padPrev[98] = sy > 0.5; this.padPrev[97] = sx < -0.5; this.padPrev[96] = sx > 0.5;
  }
}
