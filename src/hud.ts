// The fight HUD, in the title screen's style: a unit frame with the hero's
// portrait and a health bar in gold, a room plaque with wave pips, wave
// announcements on the red ribbon, and a framed panel when the hero falls.
import Phaser from 'phaser';
import { WORLD } from './config';
import { canvas, panelTexture } from './titleArt';
import { firstFrame, loadedAnims } from './assets';

const SERIF = '"Cinzel", Georgia, serif';
const DISPLAY = '"Cinzel Decorative", "Cinzel", Georgia, serif';
const DEPTH = 20000;
const BAR = { x: 84, y: 30, w: 196, h: 18 };

function textures(scene: Phaser.Scene) {
  canvas(scene, 'hud_frame', 300, 84, (c) => {
    // bar backing
    c.fillStyle = 'rgba(4,6,10,0.85)';
    c.beginPath(); c.roundRect(BAR.x - 10, BAR.y - 6, BAR.w + 18, BAR.h + 12, 5); c.fill();
    const gold = c.createLinearGradient(0, BAR.y - 6, 0, BAR.y + BAR.h + 6);
    gold.addColorStop(0, '#f6dd8e'); gold.addColorStop(0.5, '#a77d2e'); gold.addColorStop(1, '#e2c06a');
    c.strokeStyle = gold; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(BAR.x - 10, BAR.y - 6, BAR.w + 18, BAR.h + 12, 5); c.stroke();
    c.fillStyle = '#2a0b09';
    c.fillRect(BAR.x, BAR.y, BAR.w, BAR.h);
    // portrait ring (its dark backing is a separate circle under the face)
    const ring = c.createLinearGradient(0, 6, 0, 74);
    ring.addColorStop(0, '#fff0b0'); ring.addColorStop(0.5, '#b8862e'); ring.addColorStop(1, '#f0d384');
    c.strokeStyle = '#1a0d06'; c.lineWidth = 8; c.beginPath(); c.arc(42, 40, 35, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = ring; c.lineWidth = 5; c.beginPath(); c.arc(42, 40, 35, 0, Math.PI * 2); c.stroke();
    // gem on the ring
    c.fillStyle = '#1a0d06'; c.beginPath(); c.moveTo(42, 66); c.lineTo(51, 75); c.lineTo(42, 84); c.lineTo(33, 75); c.closePath(); c.fill();
    c.fillStyle = '#c0303a'; c.beginPath(); c.moveTo(42, 69); c.lineTo(48, 75); c.lineTo(42, 81); c.lineTo(36, 75); c.closePath(); c.fill();
  });
  canvas(scene, 'hud_fill', BAR.w, BAR.h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, BAR.h);
    g.addColorStop(0, '#ff7a5c'); g.addColorStop(0.45, '#d0342a'); g.addColorStop(1, '#7a1410');
    c.fillStyle = g; c.fillRect(0, 0, BAR.w, BAR.h);
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(0, 2, BAR.w, 4);
  });
  canvas(scene, 'hud_lag', BAR.w, BAR.h, (c) => { c.fillStyle = '#f2d08a'; c.fillRect(0, 0, BAR.w, BAR.h); });
  canvas(scene, 'hud_pip', 16, 16, (c) => {
    c.fillStyle = '#1a0d06'; c.beginPath(); c.moveTo(8, 0); c.lineTo(16, 8); c.lineTo(8, 16); c.lineTo(0, 8); c.closePath(); c.fill();
    c.fillStyle = '#e2b553'; c.beginPath(); c.moveTo(8, 3); c.lineTo(13, 8); c.lineTo(8, 13); c.lineTo(3, 8); c.closePath(); c.fill();
  });
  panelTexture(scene, 'hud_panel', 460, 210);
}

export class Hud {
  private fill: Phaser.GameObjects.Image;
  private lag: Phaser.GameObjects.Image;
  private lagFrac = 1;
  private hpText: Phaser.GameObjects.Text;
  private roomText: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Image[] = [];
  private ribbon: Phaser.GameObjects.Image;
  private banner: Phaser.GameObjects.Text;
  private dead?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, room: number, waves: number) {
    if (!scene.textures.exists('hud_frame')) textures(scene);
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 0) =>
      o.setScrollFactor(0).setDepth(DEPTH + d);
    const ox = 12, oy = 10;

    // portrait: the hero's idle frame, cropped to the ring
    const art = loadedAnims.hero?.has('idle');
    fixed(scene.add.circle(ox + 42, oy + 40, 34, 0x0c1420, 0.95), 0);
    const face = scene.add.image(ox + 42, oy + 52, art ? firstFrame.hero! : 'ph_hero');
    face.setScale(art ? 92 / face.height : 0.9).setOrigin(0.5, art ? 0.42 : 0.5);
    const mask = scene.make.graphics({}, false).fillCircle(ox + 42, oy + 40, 31).setScrollFactor(0); // fixed to the screen, like the HUD
    face.setMask(mask.createGeometryMask());
    fixed(face, 1);
    fixed(scene.add.image(ox, oy, 'hud_frame').setOrigin(0), 2);

    this.lag = fixed(scene.add.image(ox + BAR.x, oy + BAR.y, 'hud_lag').setOrigin(0), 3);
    this.fill = fixed(scene.add.image(ox + BAR.x, oy + BAR.y, 'hud_fill').setOrigin(0), 4);
    this.hpText = fixed(scene.add.text(ox + BAR.x + BAR.w / 2, oy + BAR.y + BAR.h / 2, '', {
      fontFamily: SERIF, fontSize: '12px', fontStyle: '700', color: '#fff4dc', stroke: '#2a0b09', strokeThickness: 3,
    }).setOrigin(0.5), 5);
    fixed(scene.add.text(ox + BAR.x - 4, oy + 8, 'VALKYRIE', {
      fontFamily: SERIF, fontSize: '13px', fontStyle: '700', color: '#f3d68a', stroke: '#05070c', strokeThickness: 4,
    }), 5);

    // room plaque, top right
    const rx = WORLD.viewW - 16;
    fixed(scene.add.text(rx, 12, 'BLIGHTWOOD', {
      fontFamily: SERIF, fontSize: '12px', fontStyle: '700', color: '#9fd8cf', stroke: '#05070c', strokeThickness: 4,
    }).setOrigin(1, 0), 5);
    this.roomText = fixed(scene.add.text(rx, 28, `Room ${room}`, {
      fontFamily: DISPLAY, fontSize: '22px', fontStyle: '700', color: '#f3d68a', stroke: '#05070c', strokeThickness: 5,
    }).setOrigin(1, 0), 5);
    for (let i = 0; i < waves; i++) {
      this.pips.push(fixed(scene.add.image(rx - 8 - (waves - 1 - i) * 20, 66, 'hud_pip').setAlpha(0.3), 5));
    }

    // banner on the ribbon
    this.ribbon = fixed(scene.add.image(WORLD.viewW / 2, 118, 'tt_ribbon').setScale(1.15).setAlpha(0), 5);
    this.banner = fixed(scene.add.text(WORLD.viewW / 2, 113, '', {
      fontFamily: SERIF, fontSize: '20px', fontStyle: '700', color: '#f8e7bd', stroke: '#2a0b09', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0), 6);

    const hint = fixed(scene.add.text(WORLD.viewW / 2, WORLD.viewH - 14,
      'WASD move   ·   J light   ·   K heavy   ·   Space dodge   ·   L block   ·   Esc menu', {
        fontFamily: SERIF, fontSize: '12px', fontStyle: '700', color: '#e9dcc0', stroke: '#05070c', strokeThickness: 4,
      }).setOrigin(0.5, 1).setAlpha(0.85), 5);
    scene.tweens.add({ targets: hint, alpha: 0, delay: 9000, duration: 1500 });
  }

  update(hp: number, maxHp: number, waveNow: number, cleared: boolean, dt: number) {
    const frac = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.fill.setCrop(0, 0, BAR.w * frac, BAR.h);
    // the pale "damage taken" strip catches up after a moment
    this.lagFrac = this.lagFrac > frac ? Math.max(frac, this.lagFrac - dt * 0.6) : frac;
    this.lag.setCrop(0, 0, BAR.w * this.lagFrac, BAR.h);
    this.hpText.setText(`${Math.ceil(hp)} / ${maxHp}`);
    this.pips.forEach((p, i) => p.setAlpha(cleared || i < waveNow - 1 ? 1 : i === waveNow - 1 ? 0.75 : 0.3));
  }

  showBanner(text: string) {
    const s = this.scene;
    s.tweens.killTweensOf([this.banner, this.ribbon]);
    this.banner.setText(text);
    for (const o of [this.banner, this.ribbon]) {
      o.setAlpha(0);
      s.tweens.chain({ targets: o, tweens: [{ alpha: 1, duration: 250 }, { alpha: 1, duration: 1500 }, { alpha: 0, duration: 500 }] });
    }
  }

  showDeath(room: number) {
    if (this.dead) return;
    const s = this.scene;
    const c = s.add.container(WORLD.viewW / 2, WORLD.viewH / 2).setScrollFactor(0).setDepth(DEPTH + 10).setAlpha(0);
    c.add(s.add.rectangle(0, 0, WORLD.viewW, WORLD.viewH, 0x05070c, 0.55));
    c.add(s.add.image(0, 0, 'hud_panel'));
    c.add(s.add.text(0, -46, 'You have fallen', { fontFamily: DISPLAY, fontSize: '30px', fontStyle: '700', color: '#ff9b8a', stroke: '#05070c', strokeThickness: 4 }).setOrigin(0.5));
    c.add(s.add.text(0, 2, `The Blightwood claims you in room ${room}.`, { fontFamily: SERIF, fontSize: '15px', color: '#e9dcc0' }).setOrigin(0.5));
    c.add(s.add.text(0, 44, 'R  try again      Esc  menu', { fontFamily: SERIF, fontSize: '16px', fontStyle: '700', color: '#f3d68a' }).setOrigin(0.5));
    s.tweens.add({ targets: c, alpha: 1, duration: 700, delay: 600 });
    this.dead = c;
  }

  get deathShown() {
    return !!this.dead;
  }
}
