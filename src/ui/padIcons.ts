// Xbox controller buttons. Labels come from input.ts as 'pad:<button>'.
//
// The art is Kenney's "Input Prompts" pack (CC0, www.kenney.nl; the ten buttons used
// are in ./prompts/xbox/ with its License.txt, and may be kept in git): the face
// buttons in their colours, bumpers, triggers, the left stick and Menu in white for a
// dark background. BootScene loads them as `kpad_<button>`. Should they be missing,
// the buttons are drawn here instead, in the same spirit. Either way a button ends up
// as a texture painted at twice its size like every UI part (kit.ts `hi`).
import Phaser from 'phaser';
import { hi } from './kit';

// The Kenney buttons' urls by our name ('A', 'RT', 'LS', 'Menu' ...), for BootScene.
const files = import.meta.glob('./prompts/xbox/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const PAD_ART: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.png', ''), url]),
);
const KENNEY = 22; // the size a Kenney button is shown at (its art has a margin round it)
const hasArt = (scene: Phaser.Scene, button: string) => scene.textures.exists(`kpad_${button}`);

type Ctx = CanvasRenderingContext2D;

const FACE: Record<string, string> = { A: '#7bd24a', B: '#ff5a46', X: '#4aa0ff', Y: '#ffc83a' };
const FONT = '700 11px "Segoe UI", Arial, sans-serif';

const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath(); c.roundRect(x, y, w, h, r);
};

// The dark, slightly glossy body every button shares.
function body(c: Ctx, path: () => void) {
  path(); c.fillStyle = '#050505'; c.fill();
  c.save(); c.translate(0, -0.5); c.scale(1, 1);
  const g = c.createLinearGradient(0, 0, 0, 20);
  g.addColorStop(0, '#4a4f58'); g.addColorStop(0.5, '#2a2d33'); g.addColorStop(1, '#16181c');
  path(); c.fillStyle = g; c.fill();
  c.restore();
  path(); c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.22)'; c.stroke();
}

function letter(c: Ctx, text: string, x: number, y: number, colour: string, size = 11) {
  c.font = FONT.replace('11px', `${size}px`);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillText(text, x, y + 1);
  c.fillStyle = colour; c.fillText(text, x, y);
}

// The button's width at a height of 20, for laying it out.
export function padIconWidth(scene: Phaser.Scene, button: string): number {
  if (hasArt(scene, button)) return KENNEY;
  if (button === 'LB' || button === 'RB') return 28;
  if (button === 'LT' || button === 'RT') return 24;
  return 20;
}

// The texture for a button ('A', 'RT', 'LS' ...), 20 high.
export function padIcon(scene: Phaser.Scene, button: string): string {
  if (hasArt(scene, button)) {
    const src = scene.textures.get(`kpad_${button}`).getSourceImage() as HTMLImageElement;
    return hi(scene, `ui_kpad_${button}`, KENNEY, KENNEY, (c) => {
      c.imageSmoothingQuality = 'high';
      // a soft dark shadow keeps the white ones (bumpers, triggers) readable on light art
      c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 2; c.shadowOffsetY = 0.5;
      c.drawImage(src, 0, 0, KENNEY, KENNEY);
    });
  }
  const w = padIconWidth(scene, button), h = 20;
  return hi(scene, `ui_pad_${button}`, w, h, (c) => {
    if (FACE[button]) {
      body(c, () => { c.beginPath(); c.arc(w / 2, h / 2, 9, 0, Math.PI * 2); });
      letter(c, button, w / 2, h / 2 + 0.5, FACE[button], 11);
    } else if (button === 'LB' || button === 'RB') {
      body(c, () => rr(c, 1, 3, w - 2, 14, 7));
      letter(c, button, w / 2, h / 2 + 0.5, '#f0f0f0', 9);
    } else if (button === 'LT' || button === 'RT') {
      // a trigger: rounded on top, square at the bottom
      body(c, () => {
        c.beginPath();
        c.moveTo(2, h - 1); c.lineTo(2, 8); c.quadraticCurveTo(2, 1, w / 2, 1); c.quadraticCurveTo(w - 2, 1, w - 2, 8); c.lineTo(w - 2, h - 1); c.closePath();
      });
      letter(c, button, w / 2, h / 2 + 1.5, '#f0f0f0', 9);
    } else if (button === 'LS') {
      // the left stick from above: a ring with a dished cap and an L on it
      body(c, () => { c.beginPath(); c.arc(w / 2, h / 2, 9, 0, Math.PI * 2); });
      c.beginPath(); c.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
      c.fillStyle = '#121418'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
      letter(c, 'L', w / 2, h / 2 + 0.5, '#f0f0f0', 8);
    } else {
      // Menu: three lines in a disc
      body(c, () => { c.beginPath(); c.arc(w / 2, h / 2, 9, 0, Math.PI * 2); });
      c.fillStyle = '#f0f0f0';
      for (const dy of [-3, 0, 3]) c.fillRect(w / 2 - 4, h / 2 + dy - 0.6, 8, 1.3);
    }
  });
}
