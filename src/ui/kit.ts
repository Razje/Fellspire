// The UI kit: every frame, button, keycap, bar, slot and icon is painted here on
// canvases at twice its size and shown at half scale, so it stays sharp on the
// full-HD canvas. Screens build from these parts and never draw their own, which
// is what keeps them looking like one game.
//
// Style: dark translucent panels with a silver bevel (tooltips, plaques) or a
// gilded bevel with corner ornaments (menus), red buttons with gold trim and gold
// lettering, square action slots with a key in the corner.
import Phaser from 'phaser';
import { C, RES, txt } from './theme';

type Ctx = CanvasRenderingContext2D;

// ---- painting helpers ------------------------------------------------------------

// A texture painted at RES times its logical size. Draw in logical coordinates.
export function hi(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES))!;
  const c = tex.getContext();
  c.scale(RES, RES);
  draw(c);
  tex.refresh();
  return key;
}

// An image of a hi() texture at its logical size.
export function pic(scene: Phaser.Scene, x: number, y: number, key: string) {
  return scene.add.image(x, y, key).setScale(1 / RES);
}

export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function vgrad(c: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

const GOLD: [number, string][] = [[0, '#fff1b8'], [0.35, '#e0b04a'], [0.6, '#8a5f1a'], [1, '#f0cf78']];
const SILVER: [number, string][] = [[0, '#f2f2f2'], [0.4, '#a9a9a9'], [0.65, '#5d5d5d'], [1, '#c9c9c9']];
const BRONZE: [number, string][] = [[0, '#e9cf8c'], [0.4, '#a07a36'], [0.7, '#4f3a16'], [1, '#c09a52']];

function diamond(c: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient) {
  c.fillStyle = fill;
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill();
}

function gem(c: Ctx, x: number, y: number, r: number, hue: 'red' | 'teal' = 'red') {
  diamond(c, x, y, r + 2.5, '#140a04');
  diamond(c, x, y, r + 1, vgrad(c, y - r, y + r, GOLD));
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  if (hue === 'red') { g.addColorStop(0, '#ffb0a0'); g.addColorStop(0.4, '#d0202a'); g.addColorStop(1, '#4a0408'); }
  else { g.addColorStop(0, '#e0fff8'); g.addColorStop(0.4, '#2ac8b8'); g.addColorStop(1, '#04403a'); }
  diamond(c, x, y, r - 1, g);
}

// ---- cursor ------------------------------------------------------------------------

// A gilded pointer, as a CSS cursor. The hover variant glows.
function cursorUrl(glow: boolean) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const c = cv.getContext('2d')!;
  const path = () => {
    c.beginPath();
    c.moveTo(2, 2); c.lineTo(22, 12); c.lineTo(14, 14); c.lineTo(20, 25); c.lineTo(16, 27); c.lineTo(10, 16); c.lineTo(4, 22); c.closePath();
  };
  if (glow) { c.shadowColor = '#ffcc55'; c.shadowBlur = 6; }
  path(); c.fillStyle = '#1a0d04'; c.fill();
  c.shadowBlur = 0;
  c.save(); c.translate(1.5, 1.8); c.scale(0.86, 0.86); path();
  c.fillStyle = vgrad(c, 0, 26, glow ? [[0, '#fffbe0'], [0.5, '#ffd86a'], [1, '#c88a24']] : GOLD); c.fill(); c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(4, 4); c.lineTo(18, 11.5); c.stroke();
  return `url(${cv.toDataURL()}) 2 2`;
}

export let CURSOR = 'default';
export let CURSOR_HOVER = 'pointer';

export function installCursor(game: Phaser.Game) {
  CURSOR = `${cursorUrl(false)}, default`;
  CURSOR_HOVER = `${cursorUrl(true)}, pointer`;
  game.canvas.style.cursor = CURSOR;
  for (const s of game.scene.getScenes(false)) s.input?.setDefaultCursor(CURSOR);
}

// ---- frames ------------------------------------------------------------------------

export type FrameStyle = 'dark' | 'gold';
const M = 12; // margin around a frame for its drop shadow

function frameTex(scene: Phaser.Scene, w: number, h: number, style: FrameStyle) {
  return hi(scene, `ui_fr_${style}_${w}x${h}`, w + M * 2, h + M * 2, (c) => {
    c.translate(M, M);
    const r = style === 'gold' ? 5 : 6;
    // shadow and body
    c.save(); c.shadowColor = 'rgba(0,0,0,0.75)'; c.shadowBlur = 12; c.shadowOffsetY = 4;
    rrect(c, 0, 0, w, h, r);
    c.fillStyle = style === 'gold'
      ? vgrad(c, 0, h, [[0, 'rgba(20,17,14,0.96)'], [1, 'rgba(7,6,6,0.97)']])
      : vgrad(c, 0, h, [[0, 'rgba(16,19,26,0.92)'], [1, 'rgba(5,6,10,0.94)']]);
    c.fill(); c.restore();
    // a faint glow from the top, as if lit from above
    c.save(); rrect(c, 0, 0, w, h, r); c.clip();
    const lg = c.createRadialGradient(w / 2, -h * 0.2, 0, w / 2, -h * 0.2, Math.max(w, h) * 0.9);
    lg.addColorStop(0, style === 'gold' ? 'rgba(255,200,120,0.10)' : 'rgba(160,190,255,0.07)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = lg; c.fillRect(0, 0, w, h);
    c.restore();
    // bevelled border: black, metal, black
    const metal = style === 'gold' ? GOLD : SILVER;
    const bw = style === 'gold' ? 3.5 : 2.5;
    c.lineWidth = bw + 2; c.strokeStyle = '#050505'; rrect(c, 0, 0, w, h, r); c.stroke();
    c.lineWidth = bw; c.strokeStyle = vgrad(c, 0, h, metal); rrect(c, 0, 0, w, h, r); c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.85)'; rrect(c, bw / 2 + 0.5, bw / 2 + 0.5, w - bw - 1, h - bw - 1, Math.max(1, r - 2)); c.stroke();
    if (style === 'gold') {
      c.strokeStyle = 'rgba(224,176,74,0.28)'; rrect(c, 8, 8, w - 16, h - 16, 3); c.stroke();
      for (const [x, y, sx, sy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) corner(c, x, y, sx, sy);
    } else {
      for (const [x, y] of [[4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]]) {
        c.fillStyle = '#050505'; c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = vgrad(c, y - 2, y + 2, SILVER); c.beginPath(); c.arc(x, y, 1.8, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

// A gilded corner bracket with a curl and a gem, pointing into the frame.
function corner(c: Ctx, x: number, y: number, sx: number, sy: number) {
  c.save(); c.translate(x, y); c.scale(sx, sy);
  c.beginPath();
  c.moveTo(-4, -4); c.lineTo(30, -4); c.lineTo(23, 3); c.lineTo(3, 3); c.lineTo(3, 23); c.lineTo(-4, 30); c.closePath();
  c.fillStyle = '#0a0603'; c.fill();
  c.save(); c.translate(1, 1); c.scale(0.92, 0.92);
  c.beginPath(); c.moveTo(-4, -4); c.lineTo(28, -4); c.lineTo(22, 2); c.lineTo(2, 2); c.lineTo(2, 22); c.lineTo(-4, 28); c.closePath();
  c.fillStyle = vgrad(c, -4, 28, GOLD); c.fill(); c.restore();
  c.strokeStyle = vgrad(c, 0, 20, GOLD); c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(7, 9); c.quadraticCurveTo(15, 6, 16, 12); c.quadraticCurveTo(15, 16, 11, 14); c.stroke();
  c.beginPath(); c.moveTo(9, 7); c.quadraticCurveTo(6, 15, 12, 16); c.stroke();
  gem(c, 1, 1, 4.5);
  c.restore();
}

// A plate across the top edge of a gold frame, carrying its title.
function headerTex(scene: Phaser.Scene, w: number) {
  const h = 30;
  return hi(scene, `ui_head_${w}`, w + 8, h + 8, (c) => {
    c.translate(4, 4);
    const shape = (inset: number) => {
      c.beginPath();
      c.moveTo(inset, h / 2); c.lineTo(14 + inset * 0.5, inset); c.lineTo(w - 14 - inset * 0.5, inset);
      c.lineTo(w - inset, h / 2); c.lineTo(w - 14 - inset * 0.5, h - inset); c.lineTo(14 + inset * 0.5, h - inset); c.closePath();
    };
    c.save(); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    shape(0); c.fillStyle = '#0a0603'; c.fill(); c.restore();
    shape(1.5); c.fillStyle = vgrad(c, 0, h, GOLD); c.fill();
    shape(4); c.fillStyle = vgrad(c, 0, h, [[0, '#6a140c'], [0.5, '#3e0905'], [1, '#220402']]); c.fill();
    c.strokeStyle = 'rgba(255,220,150,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(18, 6.5); c.lineTo(w - 18, 6.5); c.stroke();
  });
}

export class Frame extends Phaser.GameObjects.Container {
  readonly fw: number;
  readonly fh: number;
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, style: FrameStyle = 'dark', title?: string) {
    super(scene, x, y);
    this.fw = w; this.fh = h;
    this.add(pic(scene, 0, 0, frameTex(scene, w, h, style)));
    if (title) {
      const t = txt(scene, 0, -h / 2, title, 'head', { fontSize: '16px' }).setOrigin(0.5);
      const hw = Math.max(150, Math.round(t.width + 64));
      this.add(pic(scene, 0, -h / 2, headerTex(scene, hw)));
      this.add(t);
    }
    scene.add.existing(this);
  }
}

// ---- buttons -----------------------------------------------------------------------

type BtnState = 'n' | 'h' | 'p' | 'd';

function buttonTex(scene: Phaser.Scene, w: number, h: number, s: BtnState) {
  const m = 8;
  return hi(scene, `ui_btn_${w}x${h}_${s}`, w + m * 2, h + m * 2, (c) => {
    c.translate(m, m);
    const r = 4;
    if (s === 'h') { c.save(); c.shadowColor = 'rgba(255,190,70,0.85)'; c.shadowBlur = 9; rrect(c, 0, 0, w, h, r); c.fillStyle = '#000'; c.fill(); c.restore(); }
    c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 4; c.shadowOffsetY = 2;
    rrect(c, 0, 0, w, h, r); c.fillStyle = '#060202'; c.fill(); c.restore();
    const body: Record<BtnState, [number, string][]> = {
      n: [[0, '#a3241a'], [0.48, '#6c120b'], [0.52, '#5a0d07'], [1, '#2e0503']],
      h: [[0, '#d23a28'], [0.48, '#8e1c10'], [0.52, '#7a150b'], [1, '#3e0804']],
      p: [[0, '#3a0603'], [0.5, '#5a0d07'], [1, '#6c120b']],
      d: [[0, '#4a4644'], [0.5, '#2e2c2a'], [1, '#1c1b1a']],
    };
    rrect(c, 2, 2, w - 4, h - 4, r - 1); c.fillStyle = vgrad(c, 2, h - 2, body[s]); c.fill();
    if (s !== 'p' && s !== 'd') {
      c.save(); rrect(c, 2, 2, w - 4, h - 4, r - 1); c.clip();
      c.fillStyle = vgrad(c, 2, h * 0.5, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
      c.fillRect(2, 2, w - 4, h * 0.45);
      c.restore();
    }
    c.lineWidth = 2; c.strokeStyle = vgrad(c, 0, h, s === 'd' ? SILVER : GOLD); rrect(c, 1, 1, w - 2, h - 2, r); c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.8)'; rrect(c, 2.5, 2.5, w - 5, h - 5, r - 1.5); c.stroke();
  });
}

export interface Focusable {
  setFocus(on: boolean): void;
  activate(): void;
  adjust?(dir: number): void;
  onHover?: () => void;
}

export class Button extends Phaser.GameObjects.Container implements Focusable {
  private bg: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private focused = false;
  private pressed = false;
  enabled = true;
  onHover?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, private onClick: () => void, fontSize = 15) {
    super(scene, x, y);
    for (const s of ['n', 'h', 'p', 'd'] as const) buttonTex(scene, w, h, s);
    this.bg = pic(scene, 0, 0, `ui_btn_${w}x${h}_n`);
    this.label = txt(scene, 0, -1, text, 'button', { fontSize: `${fontSize}px` }).setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(w, h).setInteractive({ cursor: CURSOR_HOVER });
    this.on('pointerover', () => { if (this.enabled) this.onHover?.(); });
    this.on('pointerdown', () => { if (!this.enabled) return; this.pressed = true; this.paint(); });
    this.on('pointerout', () => { this.pressed = false; this.paint(); });
    this.on('pointerup', () => { if (!this.pressed) return; this.pressed = false; this.paint(); this.activate(); });
    this.key = `${w}x${h}`;
    scene.add.existing(this);
  }

  private key: string;

  private paint() {
    const s: BtnState = !this.enabled ? 'd' : this.pressed ? 'p' : this.focused ? 'h' : 'n';
    this.bg.setTexture(`ui_btn_${this.key}_${s}`);
    this.label.setColor(!this.enabled ? C.grey : this.focused ? '#fff6d8' : C.gold).setY(s === 'p' ? 0 : -1);
  }

  setFocus(on: boolean) {
    if (on === this.focused) return;
    this.focused = on;
    this.paint();
    this.scene.tweens.add({ targets: this, scale: on ? 1.04 : 1, duration: 110, ease: 'Quad.easeOut' });
  }

  setEnabled(on: boolean) { this.enabled = on; this.paint(); return this; }

  activate() {
    if (!this.enabled) return;
    this.scene.tweens.add({ targets: this, scale: { from: 0.96, to: this.focused ? 1.04 : 1 }, duration: 140 });
    this.onClick();
  }
}

// ---- keycaps ------------------------------------------------------------------------

function keycapTex(scene: Phaser.Scene, w: number) {
  const h = 19;
  return hi(scene, `ui_key_${w}`, w + 2, h + 3, (c) => {
    c.translate(1, 0);
    rrect(c, 0, 1, w, h + 1, 4); c.fillStyle = '#050505'; c.fill();
    rrect(c, 1, 2, w - 2, h - 2, 3); c.fillStyle = vgrad(c, 2, h, [[0, '#4a505a'], [0.5, '#2b2f36'], [1, '#1a1c21']]); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1; c.beginPath(); c.moveTo(4, 2.8); c.lineTo(w - 4, 2.8); c.stroke();
    rrect(c, 1, h - 1, w - 2, 3, 2); c.fillStyle = '#0d0e10'; c.fill();
  });
}

export function keycap(scene: Phaser.Scene, x: number, y: number, label: string) {
  const t = txt(scene, 0, 0, label, 'num', { fontFamily: '"Marcellus", serif', fontStyle: '400', fontSize: '11px', color: C.ivory, strokeThickness: 0 });
  t.setShadow(0, 1, '#000', 0, false, true);
  const w = Math.max(19, Math.round(t.width + 10));
  const c = scene.add.container(x, y, [pic(scene, 0, 1, keycapTex(scene, w)), t.setOrigin(0.5)]);
  c.setSize(w, 20);
  return c;
}

// A row of keycaps followed by what they do: [J] Light attack
export function keyHint(scene: Phaser.Scene, x: number, y: number, keys: string[], what: string) {
  const c = scene.add.container(x, y);
  let cx = 0;
  for (const k of keys) {
    const cap = keycap(scene, 0, 0, k);
    cap.x = cx + cap.width / 2;
    cx += cap.width + 2;
    c.add(cap);
  }
  const t = txt(scene, cx + 4, 0, what, 'small', { fontSize: '12px', color: C.ivory }).setOrigin(0, 0.5);
  c.add(t);
  c.setSize(cx + 4 + t.width, 20);
  return c;
}

// ---- bars --------------------------------------------------------------------------

export type BarColour = 'health' | 'enemy' | 'lag' | 'mana';

function barTextures(scene: Phaser.Scene, w: number, h: number) {
  hi(scene, `ui_barfr_${w}x${h}`, w + 8, h + 8, (c) => {
    c.translate(4, 4);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 4; c.shadowOffsetY = 1;
    rrect(c, -2, -2, w + 4, h + 4, 3); c.fillStyle = '#050505'; c.fill(); c.restore();
    c.fillStyle = vgrad(c, 0, h, [[0, '#0b0c0b'], [1, '#1c1d1b']]); c.fillRect(0, 0, w, h);
    c.lineWidth = 1.6; c.strokeStyle = vgrad(c, -2, h + 2, BRONZE); rrect(c, -1.2, -1.2, w + 2.4, h + 2.4, 2.5); c.stroke();
  });
  const fills: Record<BarColour, [number, string][]> = {
    health: [[0, '#8aff7a'], [0.18, '#3fd43a'], [0.55, '#169a18'], [1, '#08510a']],
    enemy: [[0, '#ff8a70'], [0.25, '#d8321f'], [1, '#6a0a04']],
    lag: [[0, '#fff0c0'], [0.5, '#e8b060'], [1, '#9a5a20']],
    mana: [[0, '#8ac8ff'], [0.3, '#2a78e0'], [1, '#0a2c6a']],
  };
  for (const [name, stops] of Object.entries(fills)) {
    hi(scene, `ui_fill_${name}_${w}x${h}`, w, h, (c) => {
      c.fillStyle = vgrad(c, 0, h, stops); c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(0, 1, w, Math.max(1, h * 0.16));
      // faint segment ticks, every tenth
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let i = 1; i < 10; i++) c.fillRect(Math.round((w * i) / 10), 0, 1, h);
    });
  }
  hi(scene, 'ui_spark', 16, 32, (c) => {
    const g = c.createRadialGradient(8, 16, 0, 8, 16, 12);
    g.addColorStop(0, 'rgba(255,255,230,0.95)'); g.addColorStop(0.3, 'rgba(255,240,180,0.5)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = g; c.fillRect(0, 0, 16, 32);
  });
}

// A bar with a lagging strip that shows the damage just taken, a spark at the
// leading edge and an optional value in the middle.
export class Bar extends Phaser.GameObjects.Container {
  private fill: Phaser.GameObjects.Image;
  private lag: Phaser.GameObjects.Image;
  private spark: Phaser.GameObjects.Image;
  private value?: Phaser.GameObjects.Text;
  private frac = 1;
  private lagFrac = 1;
  private lagHold = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, private bw: number, private bh: number, colour: BarColour, showValue = true) {
    super(scene, x, y);
    const w = bw, h = bh;
    barTextures(scene, w, h);
    this.add(pic(scene, -4, -4, `ui_barfr_${w}x${h}`).setOrigin(0));
    this.lag = pic(scene, 0, 0, `ui_fill_lag_${w}x${h}`).setOrigin(0);
    this.fill = pic(scene, 0, 0, `ui_fill_${colour}_${w}x${h}`).setOrigin(0);
    this.spark = pic(scene, w, h / 2, 'ui_spark').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
    this.add([this.lag, this.fill, this.spark]);
    if (showValue) {
      this.value = txt(scene, w / 2, h / 2, '', 'num', { fontSize: `${Math.max(10, Math.round(h * 0.72))}px` }).setOrigin(0.5);
      this.add(this.value);
    }
    scene.add.existing(this);
  }

  set(v: number, max: number, dt: number) {
    const f = Phaser.Math.Clamp(v / max, 0, 1);
    if (f < this.frac) this.lagHold = 0.45; // hold the lag strip a moment, then let it slide
    this.frac = f;
    if (this.lagFrac > f) {
      if ((this.lagHold -= dt) <= 0) this.lagFrac = Math.max(f, this.lagFrac - dt * 0.7);
    } else this.lagFrac = f;
    this.fill.setCrop(0, 0, this.bw * RES * f, this.bh * RES);
    this.lag.setCrop(0, 0, this.bw * RES * this.lagFrac, this.bh * RES);
    this.spark.setX(this.bw * f).setVisible(f > 0.01 && f < 0.995);
    this.value?.setText(`${Math.ceil(v)} / ${max}`);
  }
}

// ---- action slots and icons --------------------------------------------------------

export const SLOT = 40;

function slotTextures(scene: Phaser.Scene) {
  const s = SLOT;
  hi(scene, 'ui_slot', s + 8, s + 8, (c) => {
    c.translate(4, 4);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 5; c.shadowOffsetY = 2;
    rrect(c, -1, -1, s + 2, s + 2, 4); c.fillStyle = '#050505'; c.fill(); c.restore();
    c.save(); c.globalCompositeOperation = 'destination-out';
    rrect(c, 2, 2, s - 4, s - 4, 2); c.fill(); c.restore();
    c.lineWidth = 2.4; c.strokeStyle = vgrad(c, 0, s, BRONZE); rrect(c, 0.5, 0.5, s - 1, s - 1, 3.5); c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.9)'; rrect(c, 2.2, 2.2, s - 4.4, s - 4.4, 2); c.stroke();
  });
  hi(scene, 'ui_slot_gloss', s, s, (c) => {
    rrect(c, 2.5, 2.5, s - 5, s - 5, 2); c.clip();
    c.fillStyle = vgrad(c, 0, s * 0.5, [[0, 'rgba(255,255,255,0.32)'], [1, 'rgba(255,255,255,0)']]);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(s, 0); c.lineTo(s, s * 0.32); c.quadraticCurveTo(s / 2, s * 0.5, 0, s * 0.4); c.closePath(); c.fill();
    const ig = c.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.75);
    ig.addColorStop(0, 'rgba(0,0,0,0)'); ig.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = ig; c.fillRect(0, 0, s, s);
  });
  hi(scene, 'ui_slot_glow', s + 16, s + 16, (c) => {
    c.translate(8, 8);
    c.shadowColor = '#ffd36a'; c.shadowBlur = 8;
    c.lineWidth = 2.5; c.strokeStyle = '#ffe9a0'; rrect(c, 0.5, 0.5, s - 1, s - 1, 3.5); c.stroke();
    c.stroke();
  });
}

type IconName = 'light' | 'heavy' | 'dodge' | 'block' | 'skull' | 'menu';

function iconBack(c: Ctx, s: number, inner: string, outer: string) {
  const g = c.createRadialGradient(s * 0.45, s * 0.38, 0, s / 2, s / 2, s * 0.75);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, s, s);
}

const STEEL: [number, string][] = [[0, '#ffffff'], [0.45, '#c8d2dc'], [0.55, '#7d8a98'], [1, '#e4ecf4']];

function drawIcon(c: Ctx, name: IconName, s: number) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  switch (name) {
    case 'light': {
      iconBack(c, s, '#3a6a8a', '#0a1420');
      // a swift arc behind the blade
      c.strokeStyle = 'rgba(190,240,255,0.55)'; c.lineWidth = 2.2;
      c.beginPath(); c.arc(s * 0.5, s * 0.55, s * 0.36, Math.PI * 1.05, Math.PI * 1.75); c.stroke();
      c.save(); c.translate(s * 0.5, s * 0.52); c.rotate(Math.PI / 4);
      c.fillStyle = '#05070a';
      c.beginPath(); c.moveTo(0, -s * 0.44); c.lineTo(s * 0.08, -s * 0.32); c.lineTo(s * 0.07, s * 0.12); c.lineTo(-s * 0.07, s * 0.12); c.lineTo(-s * 0.08, -s * 0.32); c.closePath(); c.fill();
      const bl = c.createLinearGradient(-s * 0.06, 0, s * 0.06, 0); bl.addColorStop(0, '#ffffff'); bl.addColorStop(0.5, '#b8c4d0'); bl.addColorStop(1, '#6a7684');
      c.fillStyle = bl;
      c.beginPath(); c.moveTo(0, -s * 0.41); c.lineTo(s * 0.055, -s * 0.31); c.lineTo(s * 0.05, s * 0.1); c.lineTo(-s * 0.05, s * 0.1); c.lineTo(-s * 0.055, -s * 0.31); c.closePath(); c.fill();
      c.fillStyle = vgrad(c, s * 0.1, s * 0.17, GOLD); c.fillRect(-s * 0.18, s * 0.1, s * 0.36, s * 0.07);
      c.fillStyle = '#5a3418'; c.fillRect(-s * 0.035, s * 0.17, s * 0.07, s * 0.17);
      c.fillStyle = vgrad(c, s * 0.33, s * 0.4, GOLD); c.beginPath(); c.arc(0, s * 0.37, s * 0.05, 0, Math.PI * 2); c.fill();
      c.restore();
      break;
    }
    case 'heavy': {
      iconBack(c, s, '#a8401a', '#200604');
      c.save(); c.translate(s * 0.47, s * 0.52); c.rotate(-Math.PI / 5);
      c.fillStyle = '#05070a'; c.fillRect(-s * 0.05, -s * 0.42, s * 0.1, s * 0.86);
      c.fillStyle = vgrad(c, -s * 0.4, s * 0.4, [[0, '#9a6a3a'], [1, '#4a2a12']]); c.fillRect(-s * 0.03, -s * 0.4, s * 0.06, s * 0.82);
      // the axe head, a broad crescent
      c.beginPath();
      c.moveTo(s * 0.02, -s * 0.36); c.quadraticCurveTo(s * 0.46, -s * 0.36, s * 0.42, -s * 0.02);
      c.quadraticCurveTo(s * 0.3, -s * 0.1, s * 0.02, -s * 0.06); c.closePath();
      c.fillStyle = '#05070a'; c.lineWidth = 3; c.strokeStyle = '#05070a'; c.stroke(); c.fill();
      c.fillStyle = vgrad(c, -s * 0.36, 0, STEEL); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(s * 0.2, -s * 0.33); c.quadraticCurveTo(s * 0.42, -s * 0.3, s * 0.4, -s * 0.06); c.stroke();
      c.restore();
      // impact sparks
      c.fillStyle = 'rgba(255,220,140,0.9)';
      for (const [x, y, r] of [[0.2, 0.8, 1.6], [0.3, 0.88, 1.2], [0.14, 0.7, 1]]) { c.beginPath(); c.arc(s * x, s * y, r, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'dodge': {
      iconBack(c, s, '#2a8a7a', '#04201c');
      c.strokeStyle = '#05100e'; c.lineWidth = 5;
      const swoosh = () => {
        for (const [y, r] of [[0.36, 0.3], [0.52, 0.36], [0.68, 0.26]] as const) {
          c.beginPath(); c.moveTo(s * 0.14, s * y); c.quadraticCurveTo(s * 0.5, s * (y - 0.12), s * (0.5 + r), s * y); c.stroke();
        }
      };
      swoosh();
      c.strokeStyle = '#d8fff6'; c.lineWidth = 2.4; swoosh();
      c.fillStyle = '#d8fff6'; c.strokeStyle = '#05100e'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(s * 0.9, s * 0.52); c.lineTo(s * 0.74, s * 0.42); c.lineTo(s * 0.76, s * 0.6); c.closePath(); c.stroke(); c.fill();
      break;
    }
    case 'block': {
      iconBack(c, s, '#4a5a7a', '#080c18');
      const shield = (k: number) => {
        c.beginPath();
        c.moveTo(s * 0.5, s * (0.12 + k)); c.quadraticCurveTo(s * 0.7, s * (0.2 + k), s * (0.82 - k), s * (0.2 + k));
        c.quadraticCurveTo(s * (0.82 - k), s * 0.62, s * 0.5, s * (0.9 - k));
        c.quadraticCurveTo(s * (0.18 + k), s * 0.62, s * (0.18 + k), s * (0.2 + k));
        c.quadraticCurveTo(s * 0.3, s * (0.2 + k), s * 0.5, s * (0.12 + k)); c.closePath();
      };
      shield(-0.02); c.fillStyle = '#05070a'; c.fill();
      shield(0.01); c.fillStyle = vgrad(c, 0, s, GOLD); c.fill();
      shield(0.06); c.fillStyle = vgrad(c, 0, s, [[0, '#3a68c8'], [1, '#0e2050']]); c.fill();
      c.fillStyle = vgrad(c, s * 0.25, s * 0.75, GOLD);
      c.fillRect(s * 0.46, s * 0.24, s * 0.08, s * 0.52); c.fillRect(s * 0.3, s * 0.38, s * 0.4, s * 0.08);
      break;
    }
    case 'skull': {
      c.fillStyle = '#05070a';
      c.beginPath(); c.arc(s * 0.5, s * 0.44, s * 0.36, 0, Math.PI * 2); c.fill(); c.fillRect(s * 0.28, s * 0.58, s * 0.44, s * 0.3);
      c.fillStyle = vgrad(c, s * 0.1, s * 0.9, [[0, '#fffaf0'], [1, '#b8ac94']]);
      c.beginPath(); c.arc(s * 0.5, s * 0.44, s * 0.32, 0, Math.PI * 2); c.fill(); c.fillRect(s * 0.32, s * 0.6, s * 0.36, s * 0.24);
      c.fillStyle = '#140a06';
      c.beginPath(); c.ellipse(s * 0.37, s * 0.48, s * 0.09, s * 0.1, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(s * 0.63, s * 0.48, s * 0.09, s * 0.1, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(s * 0.5, s * 0.58); c.lineTo(s * 0.45, s * 0.67); c.lineTo(s * 0.55, s * 0.67); c.closePath(); c.fill();
      for (let i = 0; i < 3; i++) c.fillRect(s * (0.39 + i * 0.09), s * 0.74, s * 0.03, s * 0.1);
      break;
    }
    case 'menu': {
      c.fillStyle = vgrad(c, s * 0.25, s * 0.75, GOLD);
      for (const y of [0.3, 0.47, 0.64]) { c.fillStyle = '#05070a'; c.fillRect(s * 0.24, s * y - 1, s * 0.52, s * 0.1 + 2); c.fillStyle = vgrad(c, s * y, s * (y + 0.1), GOLD); c.fillRect(s * 0.26, s * y, s * 0.48, s * 0.1); }
      break;
    }
  }
}

export function icon(scene: Phaser.Scene, name: IconName, size = SLOT - 6) {
  return hi(scene, `ico_${name}_${size}`, size, size, (c) => drawIcon(c, name, size));
}

// A square action slot: icon, gloss, key in the corner, cooldown sweep.
export class Slot extends Phaser.GameObjects.Container {
  private sweep: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Image;
  private flashImg: Phaser.GameObjects.Image;
  private cdText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, name: IconName, key: string) {
    super(scene, x, y);
    slotTextures(scene);
    const s = SLOT;
    this.add(scene.add.rectangle(0, 0, s - 4, s - 4, 0x050505));
    this.add(pic(scene, 0, 0, icon(scene, name)));
    this.flashImg = pic(scene, 0, 0, 'ui_slot_glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.sweep = scene.add.graphics();
    this.add(this.sweep);
    this.add(pic(scene, 0, 0, 'ui_slot_gloss'));
    this.add(pic(scene, 0, 0, 'ui_slot'));
    this.glow = pic(scene, 0, 0, 'ui_slot_glow').setAlpha(0);
    this.add([this.glow, this.flashImg]);
    this.cdText = txt(scene, 0, 1, '', 'num', { fontSize: '13px' }).setOrigin(0.5);
    this.add(this.cdText);
    const k = txt(scene, s / 2 - 4, -s / 2 + 2, key, 'num', { fontFamily: '"Marcellus", serif', fontStyle: '400', fontSize: '10px', color: '#e8e8e8', strokeThickness: 3 }).setOrigin(1, 0);
    this.add(k);
    this.setSize(s, s);
    scene.add.existing(this);
  }

  // frac: 1 = just used, 0 = ready.
  cooldown(frac: number, secondsLeft = 0) {
    const g = this.sweep;
    g.clear();
    if (frac <= 0) { this.cdText.setText(''); return; }
    // a clock-hand sweep over the square, ending at twelve o'clock
    const h = SLOT / 2 - 2;
    const at = (a: number) => {
      const cx = Math.cos(a), sy = Math.sin(a), t = h / Math.max(Math.abs(cx), Math.abs(sy));
      return new Phaser.Math.Vector2(cx * t, sy * t);
    };
    const end = Math.PI * 1.5, start = end - Math.PI * 2 * frac;
    const pts = [new Phaser.Math.Vector2(0, 0), at(start)];
    for (let k = -2; k < 8; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2; // the square's corners
      if (a > start && a < end) pts.push(at(a));
    }
    pts.push(at(end));
    g.fillStyle(0x000000, 0.62).fillPoints(pts, true);
    g.lineStyle(1, 0xffe9a0, 0.7).lineBetween(0, 0, pts[1].x, pts[1].y);
    this.cdText.setText(secondsLeft >= 1 ? String(Math.ceil(secondsLeft)) : '');
  }

  // Lit while held, like a toggled stance.
  setActive(on: boolean) {
    this.glow.setAlpha(on ? 0.9 : 0);
    return this;
  }

  flash() {
    this.scene.tweens.killTweensOf(this.flashImg);
    this.flashImg.setAlpha(1);
    this.scene.tweens.add({ targets: this.flashImg, alpha: 0, duration: 260 });
    this.scene.tweens.add({ targets: this, scale: { from: 0.9, to: 1 }, duration: 160, ease: 'Back.easeOut' });
  }
}

// ---- check boxes and sliders, as rows in an options list -----------------------------

function controlTextures(scene: Phaser.Scene) {
  hi(scene, 'ui_check', 20, 20, (c) => {
    rrect(c, 1, 1, 18, 18, 3); c.fillStyle = '#050505'; c.fill();
    rrect(c, 2, 2, 16, 16, 2); c.fillStyle = vgrad(c, 2, 18, [[0, '#0c0d10'], [1, '#22252b']]); c.fill();
    c.lineWidth = 1.6; c.strokeStyle = vgrad(c, 0, 20, GOLD); rrect(c, 1.8, 1.8, 16.4, 16.4, 2.5); c.stroke();
  });
  hi(scene, 'ui_tick', 24, 24, (c) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#1a0d00'; c.lineWidth = 5.5;
    c.beginPath(); c.moveTo(5, 12); c.lineTo(10, 18); c.lineTo(21, 4); c.stroke();
    c.strokeStyle = vgrad(c, 4, 18, [[0, '#fff6b0'], [1, '#ffb400']]); c.lineWidth = 3;
    c.beginPath(); c.moveTo(5, 12); c.lineTo(10, 18); c.lineTo(21, 4); c.stroke();
  });
  hi(scene, 'ui_row_hi', 360, 28, (c) => {
    const g = c.createLinearGradient(0, 0, 360, 0);
    g.addColorStop(0, 'rgba(255,200,90,0)'); g.addColorStop(0.2, 'rgba(255,200,90,0.16)'); g.addColorStop(0.8, 'rgba(255,200,90,0.16)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = g; c.fillRect(0, 0, 360, 28);
    const l = c.createLinearGradient(0, 0, 360, 0);
    l.addColorStop(0, 'rgba(255,215,120,0)'); l.addColorStop(0.5, 'rgba(255,215,120,0.6)'); l.addColorStop(1, 'rgba(255,215,120,0)');
    c.fillStyle = l; c.fillRect(0, 0, 360, 1); c.fillRect(0, 27, 360, 1);
  });
  hi(scene, 'ui_track', 150, 10, (c) => {
    rrect(c, 0.5, 1, 149, 8, 4); c.fillStyle = '#050505'; c.fill();
    rrect(c, 1.5, 2, 147, 6, 3); c.fillStyle = vgrad(c, 2, 8, [[0, '#0a0b0d'], [1, '#26292e']]); c.fill();
  });
  hi(scene, 'ui_track_fill', 150, 10, (c) => {
    rrect(c, 1.5, 2, 147, 6, 3); c.fillStyle = vgrad(c, 2, 8, [[0, '#ffe9a0'], [0.5, '#d89a2a'], [1, '#7a4c0c']]); c.fill();
  });
  hi(scene, 'ui_thumb', 16, 22, (c) => {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 3; c.shadowOffsetY = 1;
    c.beginPath(); c.moveTo(8, 1); c.lineTo(14, 7); c.lineTo(14, 19); c.lineTo(2, 19); c.lineTo(2, 7); c.closePath();
    c.fillStyle = '#0a0603'; c.fill(); c.restore();
    c.beginPath(); c.moveTo(8, 2.5); c.lineTo(12.8, 7.4); c.lineTo(12.8, 17.8); c.lineTo(3.2, 17.8); c.lineTo(3.2, 7.4); c.closePath();
    c.fillStyle = vgrad(c, 2, 18, GOLD); c.fill();
    c.fillStyle = '#7a1a10'; c.fillRect(6.5, 9, 3, 6);
  });
}

abstract class Row extends Phaser.GameObjects.Container implements Focusable {
  protected hiImg: Phaser.GameObjects.Image;
  protected label: Phaser.GameObjects.Text;
  onHover?: () => void;
  constructor(scene: Phaser.Scene, x: number, y: number, text: string) {
    super(scene, x, y);
    controlTextures(scene);
    this.hiImg = pic(scene, 0, 0, 'ui_row_hi').setAlpha(0);
    this.label = txt(scene, -150, 0, text, 'label', { fontSize: '15px' }).setOrigin(0, 0.5);
    this.add([this.hiImg, this.label]);
    this.setSize(340, 28).setInteractive({ cursor: CURSOR_HOVER });
    this.on('pointerover', () => this.onHover?.());
    scene.add.existing(this);
  }
  setFocus(on: boolean) {
    this.scene.tweens.add({ targets: this.hiImg, alpha: on ? 1 : 0, duration: 120 });
    this.label.setColor(on ? C.title : C.ivory);
  }
  abstract activate(): void;
}

export class CheckRow extends Row {
  private tick: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private get: () => boolean, private set: (v: boolean) => void) {
    super(scene, x, y, text);
    this.add(pic(scene, 140, 0, 'ui_check'));
    this.tick = pic(scene, 142, -2, 'ui_tick');
    this.add(this.tick);
    this.on('pointerup', () => this.activate());
    this.refresh();
  }
  refresh() { this.tick.setVisible(this.get()); }
  activate() {
    this.set(!this.get());
    this.refresh();
    if (this.tick.visible) this.scene.tweens.add({ targets: this.tick, scale: { from: 0.8, to: 0.5 }, duration: 160, ease: 'Back.easeOut' });
  }
}

export class SliderRow extends Row {
  private fill: Phaser.GameObjects.Image;
  private thumb: Phaser.GameObjects.Image;
  private pct: Phaser.GameObjects.Text;
  private dragging = false;
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private get: () => number, private set: (v: number) => void) {
    super(scene, x, y, text);
    const tx = -6;
    this.add(pic(scene, tx, 0, 'ui_track').setOrigin(0, 0.5));
    this.fill = pic(scene, tx, 0, 'ui_track_fill').setOrigin(0, 0.5);
    this.thumb = pic(scene, tx, 1, 'ui_thumb');
    this.pct = txt(scene, 186, 0, '', 'small', { fontSize: '12px', color: C.ivory }).setOrigin(1, 0.5);
    this.add([this.fill, this.thumb, this.pct]);
    const fromPointer = (p: Phaser.Input.Pointer) => {
      const m = this.getWorldTransformMatrix();
      const lx = (p.worldX - m.tx) / m.scaleX;
      this.set(Phaser.Math.Clamp(Math.round(((lx - tx) / 150) * 20) / 20, 0, 1));
      this.refresh();
    };
    this.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; fromPointer(p); });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.dragging && p.isDown) fromPointer(p); });
    scene.input.on('pointerup', () => { this.dragging = false; });
    this.refresh();
  }
  refresh() {
    const v = this.get();
    this.fill.setCrop(0, 0, 150 * RES * v, 10 * RES);
    this.thumb.setX(-6 + 150 * v);
    this.pct.setText(`${Math.round(v * 100)}%`);
  }
  activate() { this.adjust(1); }
  adjust(dir: number) {
    this.set(Phaser.Math.Clamp(Math.round((this.get() + dir * 0.1) * 10) / 10, 0, 1));
    this.refresh();
  }
}

// ---- a list of things you can move between with keys, stick or mouse -----------------

export class FocusList {
  index = 0;
  constructor(public items: Focusable[], start = 0) {
    items.forEach((it, i) => { it.onHover = () => this.focus(i); });
    this.focus(start, true);
  }
  focus(i: number, force = false) {
    const n = this.items.length;
    const next = ((i % n) + n) % n;
    if (next === this.index && !force) return;
    this.index = next;
    this.items.forEach((it, k) => it.setFocus(k === this.index));
  }
  // Returns true when the input was used.
  nav(up: boolean, down: boolean, left: boolean, right: boolean, ok: boolean) {
    if (up) this.focus(this.index - 1);
    else if (down) this.focus(this.index + 1);
    else if (left || right) this.items[this.index].adjust?.(left ? -1 : 1);
    else if (ok) this.items[this.index].activate();
    else return false;
    return true;
  }
}

// ---- banners and bands -------------------------------------------------------------

export function bandTextures(scene: Phaser.Scene) {
  hi(scene, 'ui_band', 960, 64, (c) => {
    const g = c.createLinearGradient(0, 0, 960, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.25, 'rgba(0,0,0,0.72)'); g.addColorStop(0.75, 'rgba(0,0,0,0.72)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 960, 64);
  });
  hi(scene, 'ui_line', 640, 2, (c) => {
    const g = c.createLinearGradient(0, 0, 640, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 640, 2);
  });
  hi(scene, 'ui_wash', 960, 240, (c) => {
    const g = c.createLinearGradient(0, 0, 960, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 960, 240);
    c.globalCompositeOperation = 'destination-in';
    const v = c.createLinearGradient(0, 0, 0, 240);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.18, 'rgba(0,0,0,1)'); v.addColorStop(0.82, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = v; c.fillRect(0, 0, 960, 240);
  });
  hi(scene, 'ui_hurt', 480, 270, (c) => {
    const g = c.createRadialGradient(240, 135, 90, 240, 135, 290);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.fillRect(0, 0, 480, 270);
  });
  hi(scene, 'ui_ornament', 120, 16, (c) => {
    // a small gilded divider: line, diamond, line
    for (const s of [-1, 1]) {
      const g = c.createLinearGradient(60, 0, 60 + s * 58, 0);
      g.addColorStop(0, 'rgba(240,200,110,1)'); g.addColorStop(1, 'rgba(240,200,110,0)');
      c.fillStyle = g; c.fillRect(Math.min(60, 60 + s * 58), 7.2, 58, 1.6);
    }
    gem(c, 60, 8, 3.5, 'red');
  });
}

// ---- choices and text entry, as rows (character creation) ----------------------------

function choiceTextures(scene: Phaser.Scene) {
  hi(scene, 'ui_arrow', 14, 18, (c) => {
    c.lineJoin = 'round';
    c.beginPath(); c.moveTo(3, 2); c.lineTo(12, 9); c.lineTo(3, 16); c.closePath();
    c.fillStyle = '#0a0603'; c.lineWidth = 3; c.strokeStyle = '#0a0603'; c.stroke(); c.fill();
    c.beginPath(); c.moveTo(4, 4); c.lineTo(10.5, 9); c.lineTo(4, 14); c.closePath();
    c.fillStyle = vgrad(c, 4, 14, GOLD); c.fill();
  });
  hi(scene, 'ui_field', 170, 24, (c) => {
    rrect(c, 0.5, 0.5, 169, 23, 3); c.fillStyle = '#050505'; c.fill();
    rrect(c, 1.5, 1.5, 167, 21, 2); c.fillStyle = vgrad(c, 1, 23, [[0, '#0a0b0d'], [1, '#1d2025']]); c.fill();
    c.lineWidth = 1; c.strokeStyle = 'rgba(229,178,38,0.55)'; rrect(c, 1.5, 1.5, 167, 21, 2); c.stroke();
  });
}

// Label on the left, "<  value  >" on the right; left and right step through the
// choices, and the arrows can be clicked. swatch, when given, is a colour dot
// beside the value (skin tones).
export class ChoiceRow extends Row {
  private value: Phaser.GameObjects.Text;
  private dot?: Phaser.GameObjects.Arc;
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private names: string[],
    private get: () => number, private set: (i: number) => void, private swatch?: (i: number) => number) {
    super(scene, x, y, text);
    choiceTextures(scene);
    const l = pic(scene, 20, 0, 'ui_arrow').setFlipX(true).setInteractive({ cursor: CURSOR_HOVER });
    const r = pic(scene, 160, 0, 'ui_arrow').setInteractive({ cursor: CURSOR_HOVER });
    l.on('pointerup', () => this.adjust(-1));
    r.on('pointerup', () => this.adjust(1));
    this.value = txt(scene, 90, 0, '', 'label', { fontSize: '14px', color: C.title }).setOrigin(0.5);
    this.add([l, r, this.value]);
    if (swatch) {
      this.dot = scene.add.circle(0, 0, 6, 0xffffff).setStrokeStyle(1.5, 0x050505);
      this.add(this.dot);
    }
    this.refresh();
  }
  refresh() {
    const i = this.get();
    this.value.setText(this.names[i]);
    if (this.dot && this.swatch) {
      this.dot.setFillStyle(this.swatch(i));
      this.value.setX(98);
      this.dot.setX(98 - this.value.width / 2 - 11);
    }
  }
  activate() { this.adjust(1); }
  adjust(dir: number) {
    const n = this.names.length;
    this.set((((this.get() + dir) % n) + n) % n);
    this.refresh();
    this.scene.tweens.add({ targets: this.value, scale: { from: 1.15, to: 1 }, duration: 140, ease: 'Quad.easeOut' });
  }
}

// A one-line text field. While it has focus, typing goes into it (typeKey()), so
// the screen sends it printable keys and Backspace (typeKey) before treating them as moves.
export class TextRow extends Row {
  private value: Phaser.GameObjects.Text;
  private caret: Phaser.GameObjects.Rectangle;
  focused = false;
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private get: () => string, private set: (s: string) => void, private max: number) {
    super(scene, x, y, text);
    choiceTextures(scene);
    this.add(pic(scene, 90, 0, 'ui_field'));
    this.value = txt(scene, 90, 0, '', 'label', { fontSize: '14px', color: C.title }).setOrigin(0.5);
    this.caret = scene.add.rectangle(0, 0, 1.5, 14, 0xffea89).setVisible(false);
    this.add([this.value, this.caret]);
    scene.tweens.add({ targets: this.caret, alpha: 0, duration: 450, yoyo: true, repeat: -1, ease: 'Stepped' });
    this.on('pointerup', () => this.onHover?.());
    this.refresh();
  }
  refresh() {
    this.value.setText(this.get());
    this.caret.setX(90 + this.value.width / 2 + 2);
  }
  setFocus(on: boolean) {
    super.setFocus(on);
    this.focused = on;
    this.caret.setVisible(on);
  }
  activate() { /* Enter moves on; the screen handles that */ }
  // A key while focused: returns true when it was typing.
  typeKey(key: string): boolean {
    const s = this.get();
    if (key === 'Backspace') { this.set(s.slice(0, -1)); this.refresh(); return true; }
    if (key.length === 1 && /[\p{L}\p{N} '\-]/u.test(key)) {
      if (s.length < this.max && !(key === ' ' && (s === '' || s.endsWith(' ')))) { this.set(s + key); this.refresh(); }
      return true;
    }
    return false;
  }
}
