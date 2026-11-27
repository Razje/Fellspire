// Feedback: dust, shake, combat text, callouts and sparks.
// Mixed into RoomScene (see the end of scenes/RoomScene.ts), so `this` is the room
// and every method here is called as scene.<method>().
import type { Fighter } from '../entities/Fighter';
import { settings } from '../settings';
import { earnEmbers } from '../embers';
import { FONT, RES } from '../ui/theme';
import type { RoomScene } from '../scenes/RoomScene';

export const feedbackMethods = {
  // Little puffs of dust at someone's feet.
  dust(this: RoomScene, x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const d = this.add.image(x + (Math.random() - 0.5) * 14, y - 2, 'fw_dust').setDepth(y + 1)
        .setTint(0x8a7a66).setAlpha(0.5).setScale(0.5 + Math.random() * 0.4);
      this.tweens.add({ targets: d, scale: d.scale * 2, alpha: 0, y: y - 8 - Math.random() * 6, duration: 420 + Math.random() * 200, onComplete: () => d.destroy() });
    }
  },

  shake(this: RoomScene, ms: number, intensity: number): void {
    if (settings.screenShake) this.cameras.main.shake(ms, intensity);
  },

  // Floating combat text: your hits in white, heavy hits large and gold, damage
  // you take in red, heals in green. Each pops, then drifts up and away.
  combatText(this: RoomScene, on: Fighter, n: number, kind: 'hit' | 'heavy' | 'crit' | 'hurt' | 'heal' | 'burn' | 'storm'): void {
    if (!settings.damageNumbers && kind !== 'heal') return;
    const style = {
      hit: { size: 17, color: '#ffffff', pop: 1.5 },
      heavy: { size: 24, color: '#ffd100', pop: 1.9 },
      crit: { size: 28, color: '#ffd100', pop: 2.2 },
      hurt: { size: 17, color: '#ff3b2f', pop: 1.4 },
      heal: { size: 17, color: '#3cff3c', pop: 1.3 },
      burn: { size: 14, color: '#ff9a3a', pop: 1.2 },
      storm: { size: 18, color: '#9fd8ff', pop: 1.6 },
    }[kind];
    const x = on.x + (Math.random() - 0.5) * 16;
    const y = on.y - on.visualHeight - 4;
    const t = this.add.text(x, y, kind === 'heal' ? `+${n}` : kind === 'crit' ? `${n}!` : String(n), {
      fontFamily: FONT.head, fontSize: `${style.size}px`, fontStyle: '700', color: style.color,
      stroke: '#000000', strokeThickness: 4, resolution: RES * 1.5,
    }).setOrigin(0.5).setDepth(19000).setScale(style.pop);
    t.setShadow(0, 2, '#000', 2, true, true);
    const drift = kind === 'hurt' ? -18 : (Math.random() - 0.5) * 30;
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, x: x + drift, y: y - (kind === 'heavy' ? 46 : 36), duration: 900, delay: 120, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 350, delay: kind === 'heavy' ? 760 : 620, onComplete: () => t.destroy() });
  },

  // Embers for a deed: banked at once, and the HUD's counter glows.
  earn(this: RoomScene, n: number): void {
    earnEmbers(this.run, n);
    this.hud?.emberPulse(n);
  },

  // A word over someone's head that rises and fades ("Reload").
  callout(this: RoomScene, on: Fighter, text: string, color = '#e8eef4'): void {
    const t = this.add.text(on.x, on.y - on.visualHeight - 8, text.toUpperCase(), {
      fontFamily: FONT.head, fontSize: '12px', fontStyle: '700', color, stroke: '#000000', strokeThickness: 3, resolution: RES * 1.5,
    }).setOrigin(0.5).setDepth(19000).setLetterSpacing(2);
    this.tweens.add({ targets: t, y: t.y - 22, duration: 700, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, duration: 250, delay: 550, onComplete: () => t.destroy() });
  },

  hitSpark(this: RoomScene, x: number, y: number, color: number): void {
    const s = this.add.circle(x, y, 6, color, 1).setDepth(19000);
    this.tweens.add({ targets: s, scale: 3.2, alpha: 0, duration: 160, onComplete: () => s.destroy() });
  },

  blockSpark(this: RoomScene, x: number, y: number): void {
    const s = this.add.star(x, y, 6, 4, 14, 0x9fd0ff, 1).setDepth(19000);
    this.tweens.add({ targets: s, scale: 1.8, alpha: 0, angle: 60, duration: 200, onComplete: () => s.destroy() });
  },
};
