// The ember shrine's panel, after Lost Castle 2's camp upgrades: three branching
// trees side by side (Might, Grace, Fortune), each upgrade a round disc with its
// rank under it, joined to the one it grows from by a line that lights up once
// that one is learned. On the left, the ember bank and a card for the selected
// upgrade: what it does now, what the next rank adds, and what it costs.
//
// Keys: arrows / WASD (or the stick) move between upgrades, E (Enter, A) learns
// the next rank, Esc (B) closes. The mouse works on the discs. The tree itself is
// data in shrine.ts; this file only draws it.
import Phaser from 'phaser';
import { WORLD } from '../config';
import { embers } from '../embers';
import { BRANCHES, SHRINE, buyRank, buyState, fxLine, maxRank, nextCost, nodeById, rankOf, type ShrineNode } from '../shrine';
import { CURSOR_HOVER, Frame, hi, keyHint, pic } from './kit';
import { itemIcon } from './items';
import { C, GOLD_STOPS, gild, txt } from './theme';
import { menuLabels, type Device, type MenuStep } from '../input';

type Ctx = CanvasRenderingContext2D;

const DISC = 46; // a node's disc, in screen pixels
const PANEL = { x: 612, y: 284, w: 660, h: 404 };
const ROW0 = 176, ROW_STEP = 80, COL_STEP = 64;
const CARD = { x: 150, y: 300, w: 236, h: 340 };
const INK = '#06080b';
const EMBER = '#ffa040';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

// ---- the pictures on the discs ------------------------------------------------------------

// A glyph in a light tone with a dark outline, drawn in an s x s box.
function drawGlyph(c: Ctx, name: string, s: number) {
  const fill = '#f4ead4', line = '#1a120a';
  const paint = (p: Path2D, f: string | CanvasGradient = fill) => {
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = line; c.lineWidth = s * 0.09; c.stroke(p);
    c.fillStyle = f; c.fill(p);
  };
  const strokeOnly = (p: Path2D, w: number) => {
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = line; c.lineWidth = w + s * 0.08; c.stroke(p);
    c.strokeStyle = fill; c.lineWidth = w; c.stroke(p);
  };
  const m = s / 2;
  const P = () => new Path2D();
  switch (name) {
    case 'heart': {
      const p = P();
      p.moveTo(m, s * 0.8);
      p.bezierCurveTo(s * 0.1, s * 0.5, s * 0.16, s * 0.18, m, s * 0.34);
      p.bezierCurveTo(s * 0.84, s * 0.18, s * 0.9, s * 0.5, m, s * 0.8);
      paint(p, '#ff8a7a');
      break;
    }
    case 'sword': {
      c.save(); c.translate(m, m); c.rotate(Math.PI / 4); c.translate(-m, -m);
      const b = P(); b.moveTo(m, s * 0.1); b.lineTo(m + s * 0.07, s * 0.2); b.lineTo(m + s * 0.07, s * 0.62); b.lineTo(m - s * 0.07, s * 0.62); b.lineTo(m - s * 0.07, s * 0.2); b.closePath();
      paint(b);
      const g = P(); g.rect(m - s * 0.2, s * 0.62, s * 0.4, s * 0.07); paint(g, '#e0b04a');
      const h = P(); h.rect(m - s * 0.04, s * 0.69, s * 0.08, s * 0.14); paint(h, '#8a5428');
      const k = P(); k.arc(m, s * 0.87, s * 0.05, 0, Math.PI * 2); paint(k, '#e0b04a');
      c.restore();
      break;
    }
    case 'shield': {
      const p = P();
      p.moveTo(m, s * 0.14); p.lineTo(s * 0.8, s * 0.24); p.quadraticCurveTo(s * 0.8, s * 0.66, m, s * 0.88); p.quadraticCurveTo(s * 0.2, s * 0.66, s * 0.2, s * 0.24); p.closePath();
      paint(p);
      const q = P(); q.moveTo(m, s * 0.24); q.lineTo(m, s * 0.76); q.moveTo(s * 0.3, s * 0.42); q.lineTo(s * 0.7, s * 0.42);
      c.strokeStyle = '#8a5428'; c.lineWidth = s * 0.06; c.stroke(q);
      break;
    }
    case 'star': {
      const p = P();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.16 : s * 0.38;
        const x = m + Math.cos(a) * r, y = m + 0.03 * s + Math.sin(a) * r;
        if (i) p.lineTo(x, y); else p.moveTo(x, y);
      }
      p.closePath(); paint(p, '#ffe08a');
      break;
    }
    case 'thorn': {
      const v = P(); v.moveTo(s * 0.22, s * 0.84); v.bezierCurveTo(s * 0.2, s * 0.5, s * 0.8, s * 0.5, s * 0.74, s * 0.14);
      strokeOnly(v, s * 0.08);
      for (const [x, y, dx, dy] of [[0.27, 0.6, -0.14, -0.06], [0.52, 0.5, 0.06, 0.14], [0.68, 0.33, -0.15, -0.02]]) {
        const t = P(); t.moveTo(s * x, s * (y - 0.05)); t.lineTo(s * (x + dx), s * (y + dy)); t.lineTo(s * (x + 0.05), s * (y + 0.03)); t.closePath();
        paint(t);
      }
      break;
    }
    case 'skull': {
      const p = P(); p.arc(m, s * 0.42, s * 0.28, Math.PI * 0.85, Math.PI * 0.15); p.lineTo(s * 0.64, s * 0.82); p.lineTo(s * 0.36, s * 0.82); p.closePath();
      paint(p);
      c.fillStyle = line;
      c.beginPath(); c.ellipse(s * 0.39, s * 0.46, s * 0.08, s * 0.09, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(s * 0.61, s * 0.46, s * 0.08, s * 0.09, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(m, s * 0.56); c.lineTo(m + s * 0.04, s * 0.64); c.lineTo(m - s * 0.04, s * 0.64); c.closePath(); c.fill();
      break;
    }
    case 'drop': {
      const p = P(); p.moveTo(m, s * 0.12); p.bezierCurveTo(s * 0.62, s * 0.32, s * 0.78, s * 0.48, s * 0.78, s * 0.62); p.arc(m, s * 0.62, s * 0.28, 0, Math.PI); p.bezierCurveTo(s * 0.22, s * 0.48, s * 0.38, s * 0.32, m, s * 0.12);
      paint(p, '#ff5a4a');
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(s * 0.4, s * 0.6, s * 0.05, s * 0.09, 0.4, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'hourglass': {
      const p = P(); p.moveTo(s * 0.28, s * 0.2); p.lineTo(s * 0.72, s * 0.2); p.lineTo(m + s * 0.04, m); p.lineTo(s * 0.72, s * 0.8); p.lineTo(s * 0.28, s * 0.8); p.lineTo(m - s * 0.04, m); p.closePath();
      paint(p);
      const sand = P(); sand.moveTo(s * 0.36, s * 0.74); sand.lineTo(s * 0.64, s * 0.74); sand.lineTo(m, s * 0.58); sand.closePath();
      c.fillStyle = '#e0b04a'; c.fill(sand);
      const bars = P(); bars.rect(s * 0.2, s * 0.13, s * 0.6, s * 0.08); bars.rect(s * 0.2, s * 0.79, s * 0.6, s * 0.08);
      paint(bars, '#8a5428');
      break;
    }
    case 'wing': {
      for (let i = 0; i < 4; i++) {
        const p = P();
        c.save(); c.translate(s * 0.3, s * 0.7); c.rotate(-0.25 - i * 0.32);
        p.ellipse(s * 0.24, 0, s * (0.3 - i * 0.03), s * 0.08, 0, 0, Math.PI * 2);
        paint(p);
        c.restore();
      }
      break;
    }
    case 'boot': {
      const p = P(); p.moveTo(s * 0.32, s * 0.16); p.lineTo(s * 0.56, s * 0.16); p.lineTo(s * 0.56, s * 0.56); p.quadraticCurveTo(s * 0.84, s * 0.6, s * 0.84, s * 0.76); p.lineTo(s * 0.84, s * 0.84); p.lineTo(s * 0.28, s * 0.84); p.closePath();
      paint(p, '#d8a868');
      const w = P(); w.moveTo(s * 0.1, s * 0.5); w.lineTo(s * 0.24, s * 0.5); w.moveTo(s * 0.06, s * 0.64); w.lineTo(s * 0.22, s * 0.64);
      c.strokeStyle = fill; c.lineWidth = s * 0.05; c.stroke(w);
      break;
    }
    case 'flame': {
      const p = P(); p.moveTo(m, s * 0.1); p.bezierCurveTo(s * 0.62, s * 0.34, s * 0.82, s * 0.44, s * 0.78, s * 0.66); p.bezierCurveTo(s * 0.74, s * 0.9, s * 0.26, s * 0.9, s * 0.22, s * 0.66); p.bezierCurveTo(s * 0.2, s * 0.48, s * 0.36, s * 0.42, m, s * 0.1);
      const g = c.createLinearGradient(0, s * 0.1, 0, s * 0.86); g.addColorStop(0, '#ffe080'); g.addColorStop(1, '#ff6a1a');
      paint(p, g);
      break;
    }
    case 'snow': {
      const p = P();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3, dx = Math.cos(a) * s * 0.34, dy = Math.sin(a) * s * 0.34;
        p.moveTo(m - dx, m - dy); p.lineTo(m + dx, m + dy);
        for (const k of [-1, 1]) {
          const bx = m + k * dx * 0.6, by = m + k * dy * 0.6;
          const ex = Math.cos(a + 0.7) * s * 0.1 * k, ey = Math.sin(a + 0.7) * s * 0.1 * k;
          const fx = Math.cos(a - 0.7) * s * 0.1 * k, fy = Math.sin(a - 0.7) * s * 0.1 * k;
          p.moveTo(bx, by); p.lineTo(bx + ex, by + ey); p.moveTo(bx, by); p.lineTo(bx + fx, by + fy);
        }
      }
      strokeOnly(p, s * 0.06);
      break;
    }
    case 'bolt': {
      const p = P(); p.moveTo(s * 0.58, s * 0.08); p.lineTo(s * 0.26, s * 0.54); p.lineTo(s * 0.48, s * 0.54); p.lineTo(s * 0.38, s * 0.92); p.lineTo(s * 0.76, s * 0.4); p.lineTo(s * 0.54, s * 0.4); p.closePath();
      paint(p, '#ffe060');
      break;
    }
    case 'coin': {
      const p = P(); p.arc(m, m, s * 0.32, 0, Math.PI * 2);
      paint(p, '#f0b030');
      c.strokeStyle = 'rgba(120,70,8,0.8)'; c.lineWidth = s * 0.05; c.beginPath(); c.arc(m, m, s * 0.2, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(s * 0.4, s * 0.38, s * 0.05, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'eye': {
      const p = P(); p.moveTo(s * 0.1, m); p.quadraticCurveTo(m, s * 0.14, s * 0.9, m); p.quadraticCurveTo(m, s * 0.86, s * 0.1, m); p.closePath();
      paint(p);
      c.fillStyle = '#2fb8a8'; c.beginPath(); c.arc(m, m, s * 0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = line; c.beginPath(); c.arc(m, m, s * 0.07, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(m - s * 0.05, m - s * 0.05, s * 0.03, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'bag': {
      const p = P(); p.moveTo(s * 0.4, s * 0.3); p.bezierCurveTo(s * 0.12, s * 0.46, s * 0.12, s * 0.86, m, s * 0.86); p.bezierCurveTo(s * 0.88, s * 0.86, s * 0.88, s * 0.46, s * 0.6, s * 0.3); p.closePath();
      paint(p, '#c89858');
      const t = P(); t.moveTo(s * 0.36, s * 0.14); t.lineTo(s * 0.64, s * 0.14); t.lineTo(s * 0.58, s * 0.3); t.lineTo(s * 0.42, s * 0.3); t.closePath();
      paint(t, '#c89858');
      c.fillStyle = '#ffd36a'; c.font = `bold ${s * 0.26}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', m, s * 0.62);
      break;
    }
    case 'clover': {
      const st = P(); st.moveTo(m, m); st.quadraticCurveTo(m + s * 0.06, s * 0.74, m + s * 0.16, s * 0.88);
      strokeOnly(st, s * 0.06);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const p = P(); p.arc(m + dx * s * 0.15, m + dy * s * 0.15 - s * 0.04, s * 0.14, 0, Math.PI * 2);
        paint(p, '#7ad868');
      }
      break;
    }
    case 'phoenix': {
      const p = P();
      p.moveTo(m, s * 0.3);
      p.bezierCurveTo(s * 0.4, s * 0.14, s * 0.18, s * 0.12, s * 0.06, s * 0.2);
      p.bezierCurveTo(s * 0.2, s * 0.3, s * 0.22, s * 0.44, s * 0.4, s * 0.52);
      p.lineTo(s * 0.4, s * 0.62);
      p.quadraticCurveTo(s * 0.3, s * 0.8, m, s * 0.92);
      p.quadraticCurveTo(s * 0.7, s * 0.8, s * 0.6, s * 0.62);
      p.lineTo(s * 0.6, s * 0.52);
      p.bezierCurveTo(s * 0.78, s * 0.44, s * 0.8, s * 0.3, s * 0.94, s * 0.2);
      p.bezierCurveTo(s * 0.82, s * 0.12, s * 0.6, s * 0.14, m, s * 0.3);
      p.closePath();
      const g = c.createLinearGradient(0, s * 0.12, 0, s * 0.92); g.addColorStop(0, '#ffe080'); g.addColorStop(1, '#ff5a1a');
      paint(p, g);
      c.fillStyle = line; c.beginPath(); c.arc(m, s * 0.24, s * 0.06, 0, Math.PI * 2); c.fill();
      break;
    }
  }
}

// A node's disc: a dark well in its branch's colour with its glyph. The ring
// around it is drawn separately, since it changes with what has been learned.
function discTex(scene: Phaser.Scene, n: ShrineNode, size = DISC) {
  const b = BRANCHES.find((x) => x.id === n.branch)!;
  return hi(scene, `shrine_disc_${n.id}_${size}`, size + 8, size + 8, (c) => {
    c.translate(4, 4);
    const r = size / 2;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.75)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    c.fillStyle = INK; c.beginPath(); c.arc(r, r, r, 0, Math.PI * 2); c.fill(); c.restore();
    const g = c.createRadialGradient(r * 0.8, r * 0.7, 0, r, r, r);
    const col = Phaser.Display.Color.IntegerToColor(b.colour);
    g.addColorStop(0, `rgba(${col.red},${col.green},${col.blue},0.55)`); g.addColorStop(1, '#0c0a08');
    c.fillStyle = g; c.beginPath(); c.arc(r, r, r - 2, 0, Math.PI * 2); c.fill();
    const gs = size * 0.62;
    c.save(); c.translate(r - gs / 2, r - gs / 2); drawGlyph(c, n.glyph, gs); c.restore();
    c.fillStyle = 'rgba(255,255,255,0.1)'; c.beginPath(); c.ellipse(r, r * 0.55, r * 0.7, r * 0.35, 0, 0, Math.PI * 2); c.fill();
  });
}

type RingKind = 'dim' | 'open' | 'lit' | 'max';

function ringTex(scene: Phaser.Scene, kind: RingKind, branchColour: number, size = DISC) {
  return hi(scene, `shrine_ring_${kind}_${branchColour}_${size}`, size + 12, size + 12, (c) => {
    c.translate(6, 6);
    const r = size / 2;
    if (kind === 'max') { c.save(); c.shadowColor = 'rgba(255,200,80,0.9)'; c.shadowBlur = 8; }
    const g = c.createLinearGradient(0, 0, 0, size);
    if (kind === 'max') { g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#e0b04a'); g.addColorStop(1, '#8a5f1a'); }
    else if (kind === 'lit') { const k = hex(branchColour); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, k); g.addColorStop(1, k); }
    else if (kind === 'open') { g.addColorStop(0, '#b8ae98'); g.addColorStop(1, '#5a5448'); }
    else { g.addColorStop(0, '#4a4640'); g.addColorStop(1, '#2a2824'); }
    c.strokeStyle = g; c.lineWidth = kind === 'dim' ? 2 : 3;
    c.beginPath(); c.arc(r, r, r - 1, 0, Math.PI * 2); c.stroke();
    if (kind === 'max') c.restore();
  });
}

// Gold corner brackets around the selected disc.
function bracketTex(scene: Phaser.Scene) {
  const s = DISC + 16;
  return hi(scene, 'shrine_bracket', s + 4, s + 4, (c) => {
    c.translate(2, 2);
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#ffd100'); g.addColorStop(1, '#c08a20');
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [s, 0, -1, 1], [0, s, 1, -1], [s, s, -1, -1]]) {
      c.save(); c.translate(x, y); c.scale(sx, sy); c.lineCap = 'square';
      c.strokeStyle = '#1a1004'; c.lineWidth = 6; c.beginPath(); c.moveTo(2, 13); c.lineTo(2, 2); c.lineTo(13, 2); c.stroke();
      c.strokeStyle = g; c.lineWidth = 3; c.beginPath(); c.moveTo(2, 13); c.lineTo(2, 2); c.lineTo(13, 2); c.stroke();
      c.restore();
    }
  });
}

// ---- the panel -----------------------------------------------------------------------------

interface NodeView { n: ShrineNode; x: number; y: number; root: Phaser.GameObjects.Container; disc: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Image; rank: Phaser.GameObjects.Text }

export class ShrinePanel {
  readonly root: Phaser.GameObjects.Container;
  private views: NodeView[] = [];
  private lines: Phaser.GameObjects.Graphics;
  private bracket: Phaser.GameObjects.Image;
  private card: Phaser.GameObjects.Container;
  private bankText: Phaser.GameObjects.Text;
  private index = 0;
  private busy = false;
  private ox: number; // the 960 layout's left edge on a wider screen

  constructor(private scene: Phaser.Scene, private onClose: () => void,
    // in co-op: whose turn it is, shown over the panel, and their device's keys
    turn?: { name: string; device: Device }) {
    const s = scene, { viewW, viewH } = WORLD;
    const keys = menuLabels(turn?.device ?? { kind: 'solo' });
    this.ox = (viewW - 960) / 2;
    const ox = this.ox;
    this.root = s.add.container(0, 0).setDepth(90);
    this.root.add(s.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x05070c, 0.9).setInteractive());

    const panel = new Frame(s, ox + PANEL.x, PANEL.y, PANEL.w, PANEL.h, 'gold', 'Ember Shrine');
    this.root.add(panel);
    if (turn) {
      const who = txt(s, ox + PANEL.x, PANEL.y - PANEL.h / 2 - 22, `${turn.name.toUpperCase()}'S TURN`, 'head', { fontSize: '14px', letterSpacing: 3, strokeThickness: 4 }).setOrigin(0.5);
      gild(who, GOLD_STOPS);
      this.root.add(who);
    }

    // the three branches: a heading each, a thin rule between them
    const colW = PANEL.w / 3;
    BRANCHES.forEach((b, i) => {
      const cx = ox + PANEL.x - colW + i * colW;
      const head = txt(s, cx, PANEL.y - PANEL.h / 2 + 40, b.name.toUpperCase(), 'head', { fontSize: '17px', letterSpacing: 4, strokeThickness: 5, color: b.css, padding: { x: 4, y: 4 } }).setOrigin(0.5);
      const blurb = txt(s, cx, PANEL.y - PANEL.h / 2 + 60, b.blurb, 'small', { fontSize: '11px', color: C.body }).setOrigin(0.5);
      this.root.add([head, blurb]);
      if (i) this.root.add(s.add.rectangle(cx - colW / 2, PANEL.y + 22, 1, PANEL.h - 96, 0xc8a050, 0.25));
    });

    this.lines = s.add.graphics();
    this.root.add(this.lines);

    for (const n of SHRINE) {
      const bi = BRANCHES.findIndex((b) => b.id === n.branch);
      const x = ox + PANEL.x - colW + bi * colW + n.col * COL_STEP, y = ROW0 + n.row * ROW_STEP;
      const b = BRANCHES[bi];
      const root = s.add.container(x, y);
      const disc = pic(s, 0, 0, discTex(s, n));
      const ring = pic(s, 0, 0, ringTex(s, 'dim', b.colour));
      const rank = txt(s, 0, DISC / 2 + 9, '', 'num', { fontSize: '12px', strokeThickness: 4 }).setOrigin(0.5);
      root.add([disc, ring, rank]);
      root.setSize(DISC, DISC).setInteractive({ cursor: CURSOR_HOVER });
      const k = this.views.length;
      root.on('pointerover', () => { if (!this.busy && k !== this.index) this.focus(k); });
      root.on('pointerup', () => { this.focus(k); this.buy(); });
      this.root.add(root);
      this.views.push({ n, x, y, root, disc, ring, rank });
    }

    this.bracket = pic(s, 0, 0, bracketTex(s));
    this.root.add(this.bracket);
    s.tweens.add({ targets: this.bracket, scale: { from: 0.5, to: 0.535 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // the ember bank, over the card
    const bank = new Frame(s, ox + CARD.x, 74, 150, 40, 'dark');
    bank.add(pic(s, -44, 0, itemIcon(s, 'ember', 28)));
    this.bankText = txt(s, -22, 0, String(embers()), 'head', { fontSize: '22px', color: EMBER, strokeThickness: 5 }).setOrigin(0, 0.5);
    bank.add(this.bankText);
    this.root.add(bank);
    this.card = s.add.container(ox + CARD.x, CARD.y);
    this.root.add(this.card);

    // what the keys do
    const hint = s.add.container(0, 516);
    const parts = [keyHint(s, 0, 0, keys.move4, 'Choose'), keyHint(s, 0, 0, [keys.ok], 'Learn'), keyHint(s, 0, 0, [keys.back], 'Back')];
    let hx = 0;
    for (const p of parts) { p.x = hx; hx += p.width + 22; hint.add(p); }
    hint.x = viewW / 2 - (hx - 22) / 2;
    this.root.add(hint);

    this.refresh();
    // start on the first upgrade that can be learned, else the first one
    const start = this.views.findIndex((v) => buyState(v.n) === 'ok');
    this.focus(Math.max(0, start));

    this.root.setAlpha(0);
    s.tweens.add({ targets: this.root, alpha: 1, duration: 220 });
    panel.setScale(0.96);
    s.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  get selected(): ShrineNode {
    return this.views[this.index].n;
  }

  // Redraws every disc's ring and rank and the lines between them.
  private refresh() {
    const s = this.scene;
    for (const v of this.views) {
      const b = BRANCHES.find((x) => x.id === v.n.branch)!;
      const r = rankOf(v.n.id), max = maxRank(v.n), st = buyState(v.n);
      const kind: RingKind = r >= max ? 'max' : r > 0 ? 'lit' : st === 'locked' ? 'dim' : 'open';
      v.ring.setTexture(ringTex(s, kind, b.colour));
      v.disc.setAlpha(st === 'locked' && r === 0 ? 0.35 : 1);
      v.disc.setTint(st === 'locked' && r === 0 ? 0x8a8a8a : 0xffffff);
      v.rank.setText(`${r}/${max}`).setColor(r >= max ? C.gold : st === 'ok' ? C.green : r > 0 ? C.ivory : C.grey);
    }
    // elbow lines from each upgrade to the ones that grow from it
    const g = this.lines;
    g.clear();
    for (const v of this.views) {
      for (const a of v.n.after ?? []) {
        const p = this.views.find((w) => w.n.id === a)!;
        const lit = rankOf(a) > 0;
        const b = BRANCHES.find((x) => x.id === v.n.branch)!;
        const midY = (p.y + v.y) / 2;
        const path = [[p.x, p.y + DISC / 2 + 14], [p.x, midY], [v.x, midY], [v.x, v.y - DISC / 2 - 2]];
        g.lineStyle(5, 0x050505, 0.9);
        g.strokePoints(path.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
        g.lineStyle(2, lit ? b.colour : 0x4a443a, lit ? 1 : 0.9);
        g.strokePoints(path.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
      }
    }
    this.bankText.setText(String(embers()));
  }

  focus(i: number) {
    this.index = Phaser.Math.Clamp(i, 0, this.views.length - 1);
    const v = this.views[this.index];
    this.views.forEach((w, k) => w.root.setScale(k === this.index ? 1.08 : 1));
    this.bracket.setPosition(v.x, v.y);
    this.showCard();
  }

  // The card for the selected upgrade: its picture, name and rank, what it does
  // now and what the next rank adds, the price, and whether it can be learned.
  private showCard() {
    const s = this.scene, n = this.selected;
    const b = BRANCHES.find((x) => x.id === n.branch)!;
    const r = rankOf(n.id), max = maxRank(n), st = buyState(n), cost = nextCost(n);
    this.card.removeAll(true);
    const f = new Frame(s, 0, 0, CARD.w, CARD.h, 'dark');
    this.card.add(f);
    let y = -CARD.h / 2 + 22;
    this.card.add(txt(s, 0, y, b.name.toUpperCase(), 'small', { fontSize: '11px', color: b.css, letterSpacing: 3 }).setOrigin(0.5));
    y += 44;
    this.card.add(pic(s, 0, y, discTex(s, n, 64)));
    this.card.add(pic(s, 0, y, ringTex(s, r >= max ? 'max' : r > 0 ? 'lit' : 'open', b.colour, 64)));
    y += 50;
    const name = txt(s, 0, y, n.name, 'head', { fontSize: '19px', strokeThickness: 5, padding: { x: 4, y: 4 } }).setOrigin(0.5);
    gild(name, GOLD_STOPS);
    this.card.add(name);
    y += 22;
    this.card.add(txt(s, 0, y, `Rank ${r} of ${max}`, 'small', { fontSize: '12px', color: C.body }).setOrigin(0.5));
    y += 16;
    this.card.add(pic(s, 0, y, 'ui_line').setScale(((CARD.w - 40) / 640) * 0.5, 0.5).setAlpha(0.6));
    y += 18;
    const wrap = { wordWrap: { width: CARD.w - 36 }, align: 'center' };
    const label = (t: string) => { this.card.add(txt(s, 0, y, t, 'small', { fontSize: '10px', color: C.grey, letterSpacing: 2 }).setOrigin(0.5)); y += 16; };
    const line = (t: string, col: string) => { const o = txt(s, 0, y, t, 'body', { fontSize: '13px', color: col, ...wrap }).setOrigin(0.5, 0); this.card.add(o); y += o.height + 10; };
    label('NOW');
    line(r > 0 ? fxLine(n, r) : 'Not learned yet', r > 0 ? C.green : C.dim);
    if (r < max) {
      label(r > 0 ? 'NEXT RANK' : 'LEARN');
      line(fxLine(n, r + 1), C.ivory);
    }

    // the price and what stands in the way, at the foot of the card
    const fy = CARD.h / 2 - 50;
    if (cost !== null) {
      const row = s.add.container(0, fy);
      const t = txt(s, 0, 0, String(cost), 'head', { fontSize: '20px', color: st === 'poor' ? C.red : EMBER, strokeThickness: 5 }).setOrigin(0, 0.5);
      const ic = pic(s, 0, 0, itemIcon(s, 'ember', 24));
      ic.x = -(t.width + 28) / 2 + 12; t.x = ic.x + 16;
      row.add([ic, t]);
      this.card.add(row);
    }
    const why = st === 'max' ? 'Fully learned'
      : st === 'locked' ? `Requires ${(n.after ?? []).map((a) => nodeById(a)!.name).join(' or ')}`
        : st === 'poor' ? 'Not enough embers' : 'Ready to learn';
    this.card.add(txt(s, 0, fy + 28, why, 'small', { fontSize: '12px', color: st === 'ok' ? C.green : st === 'max' ? C.gold : C.warn }).setOrigin(0.5));
  }

  // Learns the next rank of the selected upgrade, or shakes the card when it cannot.
  buy(): boolean {
    if (this.busy) return false;
    const n = this.selected, v = this.views[this.index];
    if (!buyRank(n.id)) {
      this.scene.tweens.add({ targets: this.card, x: { from: this.card.x - 6, to: this.card.x }, duration: 220, ease: 'Elastic.easeOut' });
      return false;
    }
    this.refresh();
    this.showCard();
    const s = this.scene;
    s.tweens.add({ targets: v.root, scale: { from: 1.35, to: 1.08 }, duration: 320, ease: 'Back.easeOut' });
    s.tweens.add({ targets: this.bankText, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    const flash = s.add.image(v.x, v.y, 'tt_light').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.9);
    this.root.add(flash);
    s.tweens.add({ targets: flash, scale: 0.8, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
    return true;
  }

  close() {
    if (this.busy) return;
    this.busy = true;
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 160, onComplete: () => this.root.destroy() });
    this.onClose();
  }

  // The nearest upgrade in a direction, by where the discs sit on screen.
  private step(dx: number, dy: number) {
    const v = this.views[this.index];
    let best = -1, bestScore = Infinity;
    this.views.forEach((w, k) => {
      if (k === this.index) return;
      const ax = w.x - v.x, ay = w.y - v.y;
      const along = ax * dx + ay * dy;
      if (along <= 0) return;
      const across = Math.abs(ax * dy - ay * dx);
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = k; }
    });
    if (best >= 0) this.focus(best);
  }

  // One step of navigation, from keys or a controller.
  nav(a: MenuStep) {
    if (this.busy) return;
    if (a.back) this.close();
    else if (a.ok) this.buy();
    else if (a.left) this.step(-1, 0);
    else if (a.right) this.step(1, 0);
    else if (a.up) this.step(0, -1);
    else if (a.down) this.step(0, 1);
  }
}
