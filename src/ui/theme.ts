// The look of every screen in one place: fonts, colours, and a text helper that
// renders sharp on the full-HD canvas.
//
// The game keeps its 960 x 540 coordinates while the canvas is 1920 x 1080: every
// camera is zoomed 2x (see view.ts). So text is drawn at resolution 2 and UI art is
// painted at twice its size and shown at half scale (see kit.ts).
import Phaser from 'phaser';

export const RES = 2;

export const FONT = {
  logo: '"Cinzel Decorative", "Cinzel", Georgia, serif',
  head: '"Cinzel", Georgia, serif',
  label: '"Marcellus", "Cinzel", Georgia, serif',
};

// Text colours, after the classic fantasy MMO conventions: gold for things you
// can act on, pale yellow for titles, warm off-white for body text.
export const C = {
  gold: '#ffd100',
  goldSoft: '#e5b226',
  title: '#ffea89',
  ivory: '#f0e6d2',
  body: '#cfc5ae',
  grey: '#8a8a8a',
  dim: '#5f5a52',
  red: '#ff3b2f',
  warn: '#ff6a3d',
  green: '#3cff3c',
  teal: '#7fe3d4',
  white: '#ffffff',
  ink: '#050608',
};

// Item quality colours, for later loot.
export const QUALITY = {
  common: '#ffffff',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
  legendary: '#ff8000',
};

export type TextKind = 'title' | 'head' | 'label' | 'body' | 'small' | 'num' | 'button';

const KINDS: Record<TextKind, Phaser.Types.GameObjects.Text.TextStyle> = {
  title: { fontFamily: FONT.logo, fontSize: '30px', fontStyle: '700', color: C.title, stroke: C.ink, strokeThickness: 5 },
  head: { fontFamily: FONT.head, fontSize: '18px', fontStyle: '700', color: C.gold, stroke: C.ink, strokeThickness: 4 },
  label: { fontFamily: FONT.label, fontSize: '14px', color: C.ivory, stroke: C.ink, strokeThickness: 3 },
  body: { fontFamily: FONT.label, fontSize: '14px', color: C.body, lineSpacing: 6 },
  small: { fontFamily: FONT.label, fontSize: '11px', color: C.body, stroke: C.ink, strokeThickness: 3 },
  num: { fontFamily: FONT.head, fontSize: '12px', fontStyle: '700', color: C.white, stroke: C.ink, strokeThickness: 3 },
  button: { fontFamily: FONT.head, fontSize: '15px', fontStyle: '700', color: C.gold, stroke: '#1a0402', strokeThickness: 3 },
};

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, kind: TextKind = 'label', extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  const t = scene.add.text(x, y, s, { ...KINDS[kind], ...extra, resolution: RES });
  t.setShadow(0, 2, '#000000', 3, true, true);
  return t;
}

// Fill a text with a vertical gradient, like gilded lettering.
export function gild(t: Phaser.GameObjects.Text, stops: [number, string][]) {
  const pad = t.padding.top ?? 0;
  const g = t.context.createLinearGradient(0, pad, 0, t.height - pad);
  for (const [o, c] of stops) g.addColorStop(o, c);
  t.setFill(g);
  return t;
}

export const GOLD_STOPS: [number, string][] = [[0, '#fff6c8'], [0.45, '#f2c25a'], [0.56, '#b8781f'], [1, '#ffe08a']];
export const RED_STOPS: [number, string][] = [[0, '#ffd0c0'], [0.45, '#ff5a3c'], [0.6, '#a8140a'], [1, '#ff7a5a']];
