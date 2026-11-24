// The camp's training dummy: a straw sack on a post that takes every blow and
// never falls. It shows the numbers like any enemy, and a small damage-per-second
// readout over its head, so weapons can be compared before a run.
import Phaser from 'phaser';
import { Enemy } from './Enemies';
import { canvas } from '../titleArt';
import type { RoomScene } from '../scenes/RoomScene';
import { FONT, RES } from '../ui/theme';

const INK = '#06090d';
const SCALE = 0.5; // the texture is painted at twice its size, for sharp edges

function dummyTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('camp_dummy')) return;
  canvas(scene, 'camp_dummy', 96, 176, (c) => {
    const line = (w: number, col: string, pts: number[]) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.stroke();
    };
    // the post, stuck in a little mound, and the crossbar for arms
    c.fillStyle = INK; c.beginPath(); c.ellipse(48, 168, 26, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2018'; c.beginPath(); c.ellipse(48, 166, 22, 5, 0, 0, Math.PI * 2); c.fill();
    line(14, INK, [48, 166, 48, 40]);
    line(8, '#6a4424', [48, 164, 48, 42]);
    line(3, '#8a5f36', [46, 160, 46, 46]);
    line(12, INK, [10, 74, 86, 70]);
    line(6, '#6a4424', [12, 74, 84, 70]);
    // straw sticking out of the arm ends
    for (const [x, y, d] of [[12, 74, -1], [84, 70, 1]] as const) {
      for (let i = -2; i <= 2; i++) line(2, '#d8b060', [x, y + i * 2, x + d * (8 + Math.abs(i) * 2), y + i * 3]);
    }
    // the sack body, tied at the waist
    c.fillStyle = INK; c.beginPath(); c.ellipse(48, 98, 25, 37, 0, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(24, 0, 72, 0);
    g.addColorStop(0, '#8a6a3c'); g.addColorStop(0.45, '#c8a066'); g.addColorStop(1, '#6a4e2a');
    c.fillStyle = g; c.beginPath(); c.ellipse(48, 98, 21, 33, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(60,40,18,0.55)'; c.lineWidth = 1;
    for (let y = 72; y < 130; y += 7) { c.beginPath(); c.moveTo(30, y); c.quadraticCurveTo(48, y + 3, 66, y); c.stroke(); }
    line(5, INK, [28, 106, 68, 106]);
    line(2.5, '#b8402a', [29, 106, 67, 106]);
    // a painted target on the chest
    for (const [r, col] of [[12, '#f0e6d2'], [9, '#b8402a'], [5.5, '#f0e6d2'], [2.5, '#b8402a']] as const) {
      c.fillStyle = col; c.beginPath(); c.arc(48, 88, r, 0, Math.PI * 2); c.fill();
    }
    // the burlap head with stitched eyes
    c.fillStyle = INK; c.beginPath(); c.arc(48, 46, 19, 0, Math.PI * 2); c.fill();
    const h = c.createRadialGradient(42, 40, 2, 48, 46, 17);
    h.addColorStop(0, '#d8b47a'); h.addColorStop(1, '#8a6a3c');
    c.fillStyle = h; c.beginPath(); c.arc(48, 46, 15.5, 0, Math.PI * 2); c.fill();
    for (const ex of [41, 55]) { line(2.2, '#2a1a0c', [ex - 3, 41, ex + 3, 47]); line(2.2, '#2a1a0c', [ex + 3, 41, ex - 3, 47]); }
    line(1.6, '#2a1a0c', [41, 54, 44, 52, 47, 54, 50, 52, 53, 54, 56, 52]);
    // a tuft of straw on top
    for (let i = -3; i <= 3; i++) line(2, '#e0bc68', [48 + i * 2, 32, 48 + i * 4, 24 - Math.abs(i)]);
  });
}

export class Dummy extends Enemy {
  readonly img: Phaser.GameObjects.Image;
  private readonly home: { x: number; y: number };
  private readonly dpsText: Phaser.GameObjects.Text;
  private hits: { t: number; dmg: number }[] = [];
  private clock = 0;
  totalDamage = 0;

  constructor(scene: RoomScene, x: number, y: number) {
    super(scene, 'ghoul', x, y, 1000, 0);
    dummyTexture(scene);
    this.sprite.setVisible(false); // drawn as the dummy instead
    this.showPlate = false;
    this.body = 1.3; // the hero is pushed off it rather than walking through
    this.home = { x, y };
    this.shadow.setSize(44, 10);
    this.img = scene.add.image(x, y + 3, 'camp_dummy').setOrigin(0.5, 0.96).setScale(SCALE).setDepth(y + 10);
    // at its feet, clear of the hit numbers that float up from its head
    this.dpsText = scene.add.text(x, y + 16, '', {
      fontFamily: FONT.head, fontSize: '12px', fontStyle: '700', color: '#f0e6d2',
      stroke: '#000000', strokeThickness: 4, resolution: RES * 2,
    }).setOrigin(0.5).setDepth(19000).setAlpha(0);
  }

  get visualHeight() {
    return 78;
  }

  // it has nothing to be stopped from doing
  stun() {}

  // Every blow lands and is counted; the dummy only rocks, it never loses health.
  protected applyDamage(dmg: number, fromX: number, _knock: number, _stagger: number): number {
    this.flashT = 0.07;
    this.hits.push({ t: this.clock, dmg });
    this.totalDamage += dmg;
    const lean = (this.x >= fromX ? 1 : -1) * (dmg > 20 ? 16 : 9);
    this.scene.tweens.killTweensOf(this.img);
    this.img.angle = 0;
    this.scene.tweens.chain({
      targets: this.img,
      tweens: [
        { angle: lean, duration: 70, ease: 'Quad.easeOut' },
        { angle: -lean * 0.5, duration: 160, ease: 'Sine.easeInOut' },
        { angle: lean * 0.2, duration: 160, ease: 'Sine.easeInOut' },
        { angle: 0, duration: 140, ease: 'Sine.easeOut' },
      ],
    });
    return dmg;
  }

  // Damage per second over the last few seconds of hitting it.
  get dps() {
    const recent = this.hits.filter((h) => this.clock - h.t <= 5);
    if (recent.length < 2) return 0;
    const span = Math.max(1, this.clock - recent[0].t);
    return Math.round(recent.reduce((n, h) => n + h.dmg, 0) / span);
  }

  clamp() {
    this.x = this.home.x;
    this.y = this.home.y;
  }

  protected think(): boolean {
    return false;
  }

  update(dt: number) {
    this.clock += dt;
    this.stateT += dt;
    this.knockVx = 0;
    if (this.slowT > 0) this.slowT -= dt;
    this.clamp();
    this.shadow.setPosition(this.x, this.y);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.img.setTintFill(0xffffff);
    } else this.img.setTint(this.slowT > 0 ? 0x9fd0ff : this.scene.lightAt(this.x, this.y));

    // the readout shows while it is being hit, then fades
    this.hits = this.hits.filter((h) => this.clock - h.t <= 5);
    const last = this.hits[this.hits.length - 1];
    const live = !!last && this.clock - last.t < 3;
    const d = this.dps;
    if (live && d > 0) this.dpsText.setText(`${d} DPS`);
    this.dpsText.setAlpha(Phaser.Math.Linear(this.dpsText.alpha, live && d > 0 ? 1 : 0, 0.1));
  }

  destroy() {
    this.img.destroy();
    this.dpsText.destroy();
    super.destroy();
  }
}
