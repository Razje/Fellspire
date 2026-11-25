// The camp's weapon rack as a store, after Lost Castle 2's weapon selection: tabs
// along the top for each weapon type (and All), a grid of the weapons in the tab,
// and on the left the weapon in your hand beside the one selected, so the two can
// be compared before you take it.
//
// Keys: A D W S (or arrows, stick) move through the grid, Q and R (LB and RB)
// change tab, E (or Enter, A on a controller) equips, Esc (B) closes without
// changing anything. The mouse works on tabs and slots.
import Phaser from 'phaser';
import { RARITY, type Gear, type Item } from '../loot';
import { KINDS, WEAPONS, type WeaponKind } from '../weapons';
import { CURSOR_HOVER, Frame, hi, keyHint, keycap, pic, rrect } from './kit';
import { ItemCard, itemIcon } from './items';
import { C, GOLD_STOPS, gild, txt } from './theme';
import { menuLabels, type Device } from '../input';

type Tab = 'all' | WeaponKind;

const COLS = 6;
const SLOT = 64; // a grid slot, in screen pixels
const GAP = 12;
const ROWS_SHOWN = 3; // empty slots fill the grid to at least this many rows

// The panel on the right and the comparison on the left, in the 960 x 540 layout.
const PANEL = { x: 668, y: 278, w: 540, h: 372 };
const COMPARE = { y: 300, gap: 172, size: 0.78 };

function slotTex(scene: Phaser.Scene, key: string, border: string | null) {
  return hi(scene, key, SLOT + 8, SLOT + 8, (c) => {
    c.translate(4, 4);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 5; c.shadowOffsetY = 2;
    rrect(c, 0, 0, SLOT, SLOT, 7); c.fillStyle = '#07080b'; c.fill(); c.restore();
    const g = c.createLinearGradient(0, 0, 0, SLOT);
    g.addColorStop(0, '#2a2620'); g.addColorStop(1, '#14110d');
    rrect(c, 2, 2, SLOT - 4, SLOT - 4, 6); c.fillStyle = g; c.fill();
    c.lineWidth = 2; c.strokeStyle = border ?? 'rgba(150,130,100,0.25)'; rrect(c, 1, 1, SLOT - 2, SLOT - 2, 7); c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.9)'; rrect(c, 3, 3, SLOT - 6, SLOT - 6, 5); c.stroke();
  });
}

// A tab: a small plate, raised and gilded when it is the open one.
function tabTex(scene: Phaser.Scene, on: boolean) {
  const w = 46, h = 40;
  return hi(scene, `shop_tab_${on ? 1 : 0}`, w + 6, h + 6, (c) => {
    c.translate(3, 3);
    rrect(c, 0, 0, w, h, 6); c.fillStyle = '#050505'; c.fill();
    const g = c.createLinearGradient(0, 0, 0, h);
    if (on) { g.addColorStop(0, '#5a3a14'); g.addColorStop(1, '#2a1806'); } else { g.addColorStop(0, '#24211c'); g.addColorStop(1, '#100e0b'); }
    rrect(c, 2, 2, w - 4, h - 4, 5); c.fillStyle = g; c.fill();
    const b = c.createLinearGradient(0, 0, 0, h);
    if (on) { b.addColorStop(0, '#fff1b8'); b.addColorStop(0.5, '#e0b04a'); b.addColorStop(1, '#8a5f1a'); } else { b.addColorStop(0, '#8a8478'); b.addColorStop(1, '#3a3630'); }
    c.lineWidth = on ? 2.4 : 1.4; c.strokeStyle = b; rrect(c, 1, 1, w - 2, h - 2, 6); c.stroke();
  });
}

// Gold corner brackets around the selected slot.
function bracketTex(scene: Phaser.Scene) {
  const s = SLOT + 14;
  return hi(scene, 'shop_bracket', s + 4, s + 4, (c) => {
    c.translate(2, 2);
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, '#ffd100'); g.addColorStop(1, '#c08a20');
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [s, 0, -1, 1], [0, s, 1, -1], [s, s, -1, -1]]) {
      c.save(); c.translate(x, y); c.scale(sx, sy);
      c.lineCap = 'square';
      c.strokeStyle = '#1a1004'; c.lineWidth = 6; c.beginPath(); c.moveTo(2, 16); c.lineTo(2, 2); c.lineTo(16, 2); c.stroke();
      c.strokeStyle = g; c.lineWidth = 3; c.beginPath(); c.moveTo(2, 16); c.lineTo(2, 2); c.lineTo(16, 2); c.stroke();
      c.restore();
    }
  });
}

// A small label plate over a comparison card ("Equipped", "Selected").
function badge(scene: Phaser.Scene, x: number, y: number, text: string, gold: boolean) {
  const t = txt(scene, 0, 0, text.toUpperCase(), 'small', { fontSize: '11px', color: gold ? '#1a1004' : C.ivory, letterSpacing: 2, strokeThickness: 0 }).setOrigin(0.5);
  t.setShadow(0, 0, '#000', 0);
  const w = t.width + 22, h = 20;
  const g = scene.add.graphics();
  g.fillStyle(0x050505, 1).fillRoundedRect(-w / 2 - 1.5, -h / 2 - 1.5, w + 3, h + 3, 6);
  g.fillStyle(gold ? 0xe5b226 : 0x2a2620, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.lineStyle(1, gold ? 0xfff1b8 : 0x8a8478, 0.8).strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 4);
  return scene.add.container(x, y, [g, t]);
}

export class WeaponShop {
  readonly root: Phaser.GameObjects.Container;
  private tabs: Tab[];
  private tab = 0;
  private index = 0;
  private busy = false;
  private tabObjs: { bg: Phaser.GameObjects.Image; hit: Phaser.GameObjects.Zone }[] = [];
  private tabName!: Phaser.GameObjects.Text;
  private grid: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Container[] = [];
  private bracket: Phaser.GameObjects.Image;
  private compare: Phaser.GameObjects.Container;
  private chosenCard?: ItemCard;

  constructor(private scene: Phaser.Scene, private items: Item[], private gear: Gear,
    private onPick: (it: Item) => void, private onClose: () => void,
    // in co-op: whose turn it is, shown over the panel, and their device's keys
    turn?: { name: string; device: Device }) {
    const keys = menuLabels(turn?.device ?? { kind: 'solo' });
    const s = scene, { viewW, viewH } = { viewW: 960, viewH: 540 };
    this.tabs = ['all', ...KINDS.filter((k) => items.some((it) => it.kind === k))];
    this.root = s.add.container(0, 0).setDepth(90);
    const shade = s.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x05070c, 0.9).setInteractive(); // dark enough to hide the HUD's own bars and keys
    this.root.add(shade);

    // the panel, its tabs between Q and R, and the open tab's name
    const panel = new Frame(s, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 'gold', 'Weapon Rack');
    this.root.add(panel);
    const top = PANEL.y - PANEL.h / 2 + 44;
    const tw = 50, x0 = PANEL.x - ((this.tabs.length - 1) * tw) / 2;
    this.root.add(keycap(s, x0 - 42, top, keys.tabs[0]));
    this.root.add(keycap(s, x0 + (this.tabs.length - 1) * tw + 42, top, keys.tabs[1]));
    if (turn) {
      const who = txt(s, PANEL.x, PANEL.y - PANEL.h / 2 - 18, `${turn.name.toUpperCase()}'S TURN`, 'head', { fontSize: '14px', letterSpacing: 3, strokeThickness: 4 }).setOrigin(0.5);
      gild(who, GOLD_STOPS);
      this.root.add(who);
    }
    this.tabs.forEach((t, i) => {
      const x = x0 + i * tw;
      const bg = pic(s, x, top, tabTex(s, false));
      const face = t === 'all'
        ? txt(s, x, top, 'ALL', 'head', { fontSize: '12px', strokeThickness: 3 }).setOrigin(0.5)
        : pic(s, x, top, itemIcon(s, t, 30));
      const hit = s.add.zone(x, top, 46, 40).setInteractive({ cursor: CURSOR_HOVER });
      hit.on('pointerup', () => this.openTab(i));
      this.root.add([bg, face, hit]);
      this.tabObjs.push({ bg, hit });
    });
    this.tabName = txt(s, PANEL.x, top + 38, '', 'head', { fontSize: '15px', letterSpacing: 3, strokeThickness: 4 }).setOrigin(0.5);
    this.root.add(this.tabName);
    this.root.add(pic(s, PANEL.x, top + 56, 'ui_line').setScale(((PANEL.w - 60) / 640) * 0.5, 0.5).setAlpha(0.7));

    this.grid = s.add.container(0, 0);
    this.root.add(this.grid);
    this.bracket = pic(s, 0, 0, bracketTex(s)).setVisible(false);
    this.root.add(this.bracket);
    s.tweens.add({ targets: this.bracket, scale: { from: 0.5, to: 0.53 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // the comparison on the left
    const title = txt(s, 186, 46, 'COMPARE', 'head', { fontSize: '20px', letterSpacing: 4, strokeThickness: 5, padding: { x: 4, y: 4 } }).setOrigin(0.5);
    gild(title, GOLD_STOPS);
    this.root.add(title);
    this.compare = s.add.container(0, 0);
    this.root.add(this.compare);

    // what the keys do
    const hint = s.add.container(0, 516);
    const parts = [keyHint(s, 0, 0, keys.move4, 'Choose'), keyHint(s, 0, 0, keys.tabs, 'Weapon type'), keyHint(s, 0, 0, [keys.ok], 'Equip'), keyHint(s, 0, 0, [keys.back], 'Back')];
    let hx = 0;
    for (const p of parts) { p.x = hx; hx += p.width + 22; hint.add(p); }
    hint.x = viewW / 2 - (hx - 22) / 2;
    this.root.add(hint);

    // start on All, with the weapon in your hand selected
    const here = this.list().findIndex((it) => it.kind === gear.weapon.kind);
    this.openTab(0, Math.max(0, here));

    this.root.setAlpha(0);
    s.tweens.add({ targets: this.root, alpha: 1, duration: 220 });
    panel.setScale(0.96);
    s.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  // The weapons in the open tab.
  list(tab = this.tab) {
    const t = this.tabs[tab];
    return t === 'all' ? this.items : this.items.filter((it) => it.kind === t);
  }

  get selected(): Item | undefined {
    return this.list()[this.index];
  }

  get tabKey() {
    return this.tabs[this.tab];
  }

  openTab(i: number, index = 0) {
    if (this.busy) return;
    this.tab = (i + this.tabs.length) % this.tabs.length;
    this.tabObjs.forEach((o, k) => {
      o.bg.setTexture(tabTex(this.scene, k === this.tab)).setY(this.tabObjs[k].hit.y - (k === this.tab ? 3 : 0));
    });
    const t = this.tabs[this.tab];
    this.tabName.setText(t === 'all' ? 'ALL WEAPONS' : WEAPONS[t].label.toUpperCase());
    gild(this.tabName, GOLD_STOPS);
    this.buildGrid();
    this.focus(index);
  }

  private buildGrid() {
    const s = this.scene;
    this.grid.removeAll(true);
    this.slots = [];
    const list = this.list();
    const rows = Math.max(ROWS_SHOWN, Math.ceil(list.length / COLS));
    const left = PANEL.x - ((COLS - 1) * (SLOT + GAP)) / 2;
    const top = PANEL.y - PANEL.h / 2 + 152;
    for (let i = 0; i < rows * COLS; i++) {
      const x = left + (i % COLS) * (SLOT + GAP), y = top + Math.floor(i / COLS) * (SLOT + GAP);
      const it = list[i];
      if (!it) { this.grid.add(pic(s, x, y, slotTex(s, 'shop_slot_empty', null)).setAlpha(0.55)); continue; }
      const col = RARITY[it.rarity].color;
      const c = s.add.container(x, y);
      c.add(pic(s, 0, 0, slotTex(s, `shop_slot_${it.rarity}`, col)));
      c.add(pic(s, 0, 0, itemIcon(s, it.icon, SLOT - 14)));
      // the weapon in your hand carries a small gold mark
      if (it.kind === this.gear.weapon.kind && it.name === this.gear.weapon.name) {
        const m = s.add.graphics();
        m.fillStyle(0x050505, 1).fillTriangle(SLOT / 2 - 2, -SLOT / 2 + 2, SLOT / 2 - 2, -SLOT / 2 + 20, SLOT / 2 - 20, -SLOT / 2 + 2);
        m.fillStyle(0xffd100, 1).fillTriangle(SLOT / 2 - 4, -SLOT / 2 + 4, SLOT / 2 - 4, -SLOT / 2 + 16, SLOT / 2 - 16, -SLOT / 2 + 4);
        c.add(m);
      }
      c.setSize(SLOT, SLOT).setInteractive({ cursor: CURSOR_HOVER });
      const k = i;
      c.on('pointerover', () => { if (!this.busy && k !== this.index) this.focus(k); });
      c.on('pointerup', () => this.pick(k));
      this.grid.add(c);
      this.slots.push(c);
    }
  }

  focus(i: number) {
    const n = this.slots.length;
    if (!n) { this.bracket.setVisible(false); this.showCompare(); return; }
    this.index = Phaser.Math.Clamp(i, 0, n - 1);
    this.slots.forEach((c, k) => c.setScale(k === this.index ? 1.06 : 1));
    const c = this.slots[this.index];
    this.bracket.setVisible(true).setPosition(c.x, c.y);
    this.showCompare();
  }

  // Equipped on the left, selected on the right, each a full item card.
  private showCompare() {
    const s = this.scene, g = this.gear;
    this.compare.removeAll(true);
    const it = this.selected;
    const lx = 186 - COMPARE.gap / 2, rx = 186 + COMPARE.gap / 2;
    const same = !!it && it.kind === g.weapon.kind && it.name === g.weapon.name;
    const now = new ItemCard(s, lx, COMPARE.y, g.weapon, g, COMPARE.size, 'In your hand now');
    now.disableInteractive();
    this.compare.add([now, badge(s, lx, COMPARE.y - 168, 'Equipped', true)]);
    if (it) {
      const pick = new ItemCard(s, rx, COMPARE.y, it, g, COMPARE.size, same ? 'Already in your hand' : `Replaces ${g.weapon.name}`);
      pick.disableInteractive();
      pick.shine();
      this.compare.add([pick, badge(s, rx, COMPARE.y - 168, same ? 'Equipped' : 'Selected', same)]);
      this.chosenCard = pick;
      pick.setAlpha(0);
      s.tweens.add({ targets: pick, alpha: 1, duration: 120 });
    }
  }

  private pick(i = this.index) {
    if (this.busy) return;
    if (i !== this.index) this.focus(i);
    const it = this.selected;
    if (!it) return;
    this.busy = true;
    this.chosenCard?.chosen();
    const c = this.slots[this.index];
    this.scene.tweens.add({ targets: c, scale: 1.25, duration: 140, yoyo: true });
    this.scene.time.delayedCall(420, () => {
      this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 200, onComplete: () => this.root.destroy() });
      this.onPick(it);
    });
  }

  close() {
    if (this.busy) return;
    this.busy = true;
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 160, onComplete: () => this.root.destroy() });
    this.onClose();
  }

  // One step of navigation, from keys or a controller.
  nav(a: { left?: boolean; right?: boolean; up?: boolean; down?: boolean; tabL?: boolean; tabR?: boolean; ok?: boolean; back?: boolean }) {
    if (this.busy) return;
    const n = this.slots.length, i = this.index;
    if (a.back) this.close();
    else if (a.tabL) this.openTab(this.tab - 1);
    else if (a.tabR) this.openTab(this.tab + 1);
    else if (a.ok) this.pick();
    else if (a.left && n) this.focus(i % COLS === 0 ? Math.min(n - 1, i + COLS - 1) : i - 1);
    else if (a.right && n) this.focus((i + 1) % COLS === 0 || i + 1 >= n ? i - (i % COLS) : i + 1);
    else if (a.up && n) this.focus(i - COLS >= 0 ? i - COLS : i);
    else if (a.down && n) this.focus(i + COLS < n ? i + COLS : i);
  }

  key(code: string) {
    this.nav({
      left: code === 'ArrowLeft' || code === 'KeyA',
      right: code === 'ArrowRight' || code === 'KeyD',
      up: code === 'ArrowUp' || code === 'KeyW',
      down: code === 'ArrowDown' || code === 'KeyS',
      tabL: code === 'KeyQ',
      tabR: code === 'KeyR',
      ok: code === 'KeyE' || code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyJ',
      back: code === 'Escape' || code === 'Backspace',
    });
  }
}
