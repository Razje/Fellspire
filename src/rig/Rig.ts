// A character drawn from separate parts, moved by a Spriter animation (scml.ts).
//
// Each part is an image named after its file in the pack ("Head.png", "Sword.png").
// A skin swaps parts: another pack's head on this body, or a bow where the sword
// was. A swapped weapon is placed by its grip: the pixel where the hand held the
// old part, matched to the pixel where the hand holds the new one.
import Phaser from 'phaser';
import { evaluate, type SAnim, type Scml } from './scml';

export interface PartSwap {
  texture: string | null; // null hides the part
  show?: boolean; // shown even where the animation hides the part it replaces
  front?: string; // drawn just below this part ("Right Hand.png"), over the body, whatever the pose
  // rest: an extra turn (degrees) while the animation hides the part it replaces,
  // so a weapon the pack never poses at rest is held upright instead of levelled
  grip?: { from: [number, number]; to: [number, number]; angle?: number; scale?: number; rest?: number };
}

export class Rig extends Phaser.GameObjects.Container {
  skin = new Map<string, PartSwap>();
  private anim!: SAnim;
  private t = 0;
  private loop = true;
  speed = 1;
  done = false;
  private tint = 0xffffff;
  private flashing = false;
  private parts = new Map<string, Phaser.GameObjects.Image>();

  // base: the texture prefix for this character's own parts ("Valkyrie_1").
  constructor(scene: Phaser.Scene, x: number, y: number, readonly scml: Scml, readonly base: string, readonly size = 0.11) {
    super(scene, x, y);
    this.setScale(size);
    scene.add.existing(this);
    this.play('Idle');
  }

  // loop false plays once and holds the last pose; duration (ms) stretches it to fit.
  play(name: string, restart = false, opts: { loop?: boolean; duration?: number } = {}) {
    const a = this.scml.anims.get(name);
    if (!a) return this;
    this.speed = opts.duration ? a.length / opts.duration : 1;
    if (a === this.anim && !restart) return this;
    this.anim = a;
    this.loop = opts.loop ?? true;
    this.t = 0;
    this.done = false;
    this.draw();
    return this;
  }

  has(name: string) {
    return this.scml.anims.has(name);
  }

  get animation() {
    return this.anim.name;
  }

  setFacing(dir: number) {
    this.setScale(this.size * (dir < 0 ? -1 : 1), this.size);
    return this;
  }

  step(ms: number) {
    this.t += ms * this.speed;
    if ((!this.loop || !this.anim.looping) && this.t >= this.anim.length) { this.t = this.anim.length; this.done = true; }
    this.draw();
  }

  private draw() {
    // a play-once animation rests on its last pose instead of wrapping to the first
    const t = this.done ? this.anim.length - 1 : this.t;
    const states = evaluate(this.scml, this.anim, t);
    const seen = new Set<string>();
    states.forEach((s, i) => {
      const swap = this.skin.get(s.file.name);
      const key = swap ? swap.texture : `${this.base}/${s.file.name}`;
      let img = this.parts.get(s.slot);
      if (!img) {
        img = this.scene.add.image(0, 0, '__WHITE');
        this.parts.set(s.slot, img);
        this.add(img);
      }
      seen.add(s.slot);
      if (!key || !this.scene.textures.exists(key)) { img.setVisible(false); return; }
      img.setVisible(true).setTexture(key).setAlpha(swap?.show ? 1 : s.a);
      if (this.flashing) img.setTintFill(0xffffff);
      else img.setTint(this.tint);
      const rad = (s.angle * Math.PI) / 180;
      if (swap?.grip) {
        // where the hand was on the old part, in the part's own space (y up)...
        const { from, to, scale = 1 } = swap.grip;
        const angle = (swap.grip.angle ?? 0) + (s.a < 0.01 ? swap.grip.rest ?? 0 : 0);
        const lx = from[0] - s.file.px * s.file.w;
        const ly = s.file.h - from[1] - s.file.py * s.file.h;
        const wx = s.x + lx * s.sx * Math.cos(rad) - ly * s.sy * Math.sin(rad);
        const wy = s.y + lx * s.sx * Math.sin(rad) + ly * s.sy * Math.cos(rad);
        // ...is where the new part's grip goes
        img.setOrigin(to[0] / img.width, to[1] / img.height).setPosition(wx, -wy)
          .setRotation(-rad - (angle * Math.PI) / 180).setScale(s.sx * scale, s.sy * scale);
      } else {
        img.setOrigin(s.file.px, 1 - s.file.py).setPosition(s.x, -s.y).setRotation(-rad).setScale(s.sx, s.sy);
      }
      this.moveTo(img, i);
    });
    // a part held in front: just below the part it names (a short wand behind the
    // body would disappear)
    states.forEach((s) => {
      const front = this.skin.get(s.file.name)?.front;
      if (!front) return;
      const st = states.find((o) => o.file.name === front);
      const img = this.parts.get(s.slot), over = st && this.parts.get(st.slot);
      if (!img || !over) return;
      const i = this.getIndex(img), o = this.getIndex(over);
      if (i !== o - 1) this.moveTo(img, i < o ? o - 1 : o);
    });
    for (const [slot, img] of this.parts) if (!seen.has(slot)) img.setVisible(false);
  }

  // Tint every part at once (the light where the character stands).
  tintAll(c: number) {
    this.tint = c;
    this.flashing = false;
    for (const img of this.parts.values()) img.setTint(c);
  }

  // Every part solid white for a moment: the hit flash.
  flash(on: boolean) {
    this.flashing = on;
    for (const img of this.parts.values()) { if (on) img.setTintFill(0xffffff); else img.setTint(this.tint); }
  }
}
