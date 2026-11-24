// The camp's training dummy: a big stuffed straw dummy on a post, elite-sized, that
// takes every blow and never falls. It shows the numbers like any enemy, and a small damage-per-second
// readout over its head, so weapons can be compared before a run.
import Phaser from 'phaser';
import { Enemy } from './Enemies';
import { canvas } from '../titleArt';
import type { RoomScene } from '../scenes/RoomScene';
import { FONT, RES } from '../ui/theme';

const INK = '#06090d';
const SCALE = 0.5; // the texture is painted at twice its size, for sharp edges

// A big training dummy, elite-sized: a round stuffed belly on a thick post, plank
// feet, beam arms with straw, a sack head under a dented iron pot. Painted at 2x.
function dummyTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('camp_dummy')) return;
  canvas(scene, 'camp_dummy', 240, 300, (c) => {
    const line = (w: number, col: string, pts: number[]) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.stroke();
    };
    const wood = (w: number, pts: number[]) => { line(w + 7, INK, pts); line(w, '#6a4424', pts); };
    // plank feet crossed under the post
    wood(13, [62, 288, 178, 276]);
    wood(13, [70, 272, 172, 290]);
    // the post
    wood(20, [120, 286, 120, 150]);
    line(4, '#8a5f36', [114, 280, 114, 160]);
    // beam arms through the belly, straw bursting from the ends
    wood(14, [22, 150, 218, 140]);
    for (const [x, y, d] of [[22, 150, -1], [218, 140, 1]] as const) {
      for (let i = -3; i <= 3; i++) line(3, i % 2 ? '#c89a48' : '#e0bc68', [x, y + i * 3, x + d * (14 + Math.abs(i) * 3), y + i * 5]);
    }
    // the round belly, a rope belt and seams
    c.fillStyle = INK; c.beginPath(); c.ellipse(120, 172, 76, 70, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(100, 150, 8, 120, 172, 72);
    g.addColorStop(0, '#dcb478'); g.addColorStop(0.65, '#a8804a'); g.addColorStop(1, '#6a4e2a');
    c.fillStyle = g; c.beginPath(); c.ellipse(120, 172, 69, 63, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(60,40,18,0.45)'; c.lineWidth = 2;
    for (let y = 124; y < 232; y += 12) {
      const half = Math.sqrt(Math.max(0, 1 - ((y - 172) / 63) ** 2)) * 66;
      c.beginPath(); c.moveTo(120 - half, y); c.quadraticCurveTo(120, y + 6, 120 + half, y); c.stroke();
    }
    // a stitched patch on the side
    c.fillStyle = INK; c.fillRect(146, 178, 34, 30);
    c.fillStyle = '#7a5a8a'; c.fillRect(149, 181, 28, 24);
    c.strokeStyle = '#e8dcc0'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(151 + i * 7, 179); c.lineTo(153 + i * 7, 184); c.stroke(); c.beginPath(); c.moveTo(151 + i * 7, 203); c.lineTo(153 + i * 7, 208); c.stroke(); }
    // rope belt low on the belly
    line(10, INK, [52, 204, 120, 216, 188, 204]);
    line(5, '#c8a060', [53, 204, 120, 216, 187, 204]);
    line(6, INK, [96, 214, 88, 238]); line(3, '#c8a060', [96, 214, 88, 237]);
    // the painted target
    for (const [r, col] of [[27, INK], [24, '#f0e6d2'], [18, '#b8402a'], [12, '#f0e6d2'], [6, '#b8402a']] as const) {
      c.fillStyle = col; c.beginPath(); c.arc(112, 166, r, 0, Math.PI * 2); c.fill();
    }
    // two arrows stuck in it
    for (const [x, y, a] of [[84, 196, -0.5], [168, 150, -0.55]] as const) {
      const dx = Math.cos(a), dy = Math.sin(a);
      line(6, INK, [x, y, x + dx * 40, y + dy * 40]);
      line(3, '#b08050', [x, y, x + dx * 39, y + dy * 39]);
      const fx = x + dx * 40, fy = y + dy * 40;
      c.fillStyle = '#e8e0d0';
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - dx * 12 - dy * 7 * sd, fy - dy * 12 + dx * 7 * sd); c.lineTo(fx - dx * 4, fy - dy * 4); c.closePath(); c.fill(); }
    }
    // the sack head, stitched face
    c.fillStyle = INK; c.beginPath(); c.arc(120, 86, 34, 0, Math.PI * 2); c.fill();
    const h = c.createRadialGradient(110, 80, 3, 120, 86, 31);
    h.addColorStop(0, '#d8b47a'); h.addColorStop(1, '#8a6a3c');
    c.fillStyle = h; c.beginPath(); c.arc(120, 86, 29, 0, Math.PI * 2); c.fill();
    for (const ex of [108, 132]) { line(3.5, '#2a1a0c', [ex - 5, 84, ex + 5, 94]); line(3.5, '#2a1a0c', [ex + 5, 84, ex - 5, 94]); }
    line(2.5, '#2a1a0c', [106, 106, 111, 102, 116, 106, 121, 102, 126, 106, 131, 102, 136, 106]);
    // a dented iron pot for a helmet, tipped to one side
    c.save(); c.translate(120, 62); c.rotate(-0.16);
    c.fillStyle = INK; c.beginPath(); c.moveTo(-38, 8); c.lineTo(-32, -26); c.quadraticCurveTo(0, -40, 32, -26); c.lineTo(38, 8); c.closePath(); c.fill();
    const m = c.createLinearGradient(-32, 0, 32, 0);
    m.addColorStop(0, '#5a6470'); m.addColorStop(0.4, '#b8c4d0'); m.addColorStop(1, '#4a525c');
    c.fillStyle = m; c.beginPath(); c.moveTo(-32, 3); c.lineTo(-27, -22); c.quadraticCurveTo(0, -34, 27, -22); c.lineTo(32, 3); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,36,44,0.55)'; c.beginPath(); c.ellipse(10, -14, 7, 5, 0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK; c.fillRect(-44, 2, 88, 11);
    c.fillStyle = '#6a7480'; c.fillRect(-41, 4, 82, 6);
    c.restore();
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
    this.body = 1.8; // big, like the Warden: the hero is pushed off it, still within a dagger's reach
    this.home = { x, y };
    this.shadow.setSize(96, 18);
    this.img = scene.add.image(x, y + 3, 'camp_dummy').setOrigin(0.5, 0.96).setScale(SCALE).setDepth(y + 10);
    // at its feet, clear of the hit numbers that float up from its head
    this.dpsText = scene.add.text(x, y + 16, '', {
      fontFamily: FONT.head, fontSize: '12px', fontStyle: '700', color: '#f0e6d2',
      stroke: '#000000', strokeThickness: 4, resolution: RES * 2,
    }).setOrigin(0.5).setDepth(19000).setAlpha(0);
  }

  get visualHeight() {
    return 140;
  }

  // it has nothing to be stopped from doing
  stun() {}

  // Every blow lands and is counted; the dummy only rocks, it never loses health.
  protected applyDamage(dmg: number, fromX: number, _knock: number, _stagger: number): number {
    this.flashT = 0.07;
    this.hits.push({ t: this.clock, dmg });
    this.totalDamage += dmg;
    const lean = (this.x >= fromX ? 1 : -1) * (dmg > 20 ? 10 : 5); // heavy, so it rocks less
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
