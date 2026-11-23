// The Blightwood as a place to fight in: the title screen's moonlit forest,
// painted as tiles that repeat seamlessly across a room, plus torches whose
// light warms whoever stands near them, a rune ring as the exit, and black
// foliage framing the bottom of the screen.
//
// Look after Lost Castle 2 (see lost-castle-2-reference.md): dark teal night,
// warm pools of fire light, cyan magic, thick dark outlines on props.
import Phaser from 'phaser';
import { WORLD } from './config';
import { canvas, rng, trunk, radial, type Ctx } from './titleArt';

const TW = 960; // tile width of every repeating layer
const GROUND_Y = WORLD.groundTop - 35; // where the painted ground texture starts
const INK = '#06090d';

// Draws something three times, so whatever crosses the tile edge wraps round.
function wrap(draw: (dx: number) => void) {
  draw(0); draw(-TW); draw(TW);
}

// ---- textures -----------------------------------------------------------------

function forestTile(scene: Phaser.Scene, key: string, seed: number, n: number, color: string, base: number, wMin: number, wMax: number, blur: number, rim: string | null) {
  canvas(scene, key, TW, 540, (c) => {
    const r = rng(seed);
    const trees = Array.from({ length: n }, (_, i) => ({
      x: (i + 0.2 + r() * 0.6) * (TW / n),
      w: wMin + r() * (wMax - wMin),
      lean: (r() - 0.5) * 30,
      dy: r() * 14,
      seed: seed * 100 + i,
    }));
    c.filter = blur ? `blur(${blur}px)` : 'none';
    c.fillStyle = color;
    c.strokeStyle = color;
    for (const t of trees) {
      wrap((dx) => {
        trunk(c, t.x + dx, base + t.dy, -20, t.w, t.lean, rng(t.seed));
        if (rim) {
          c.save();
          c.strokeStyle = rim; c.lineWidth = 2; c.globalAlpha = 0.5;
          c.beginPath(); c.moveTo(t.x + dx + t.w / 2 - 1, base - 50); c.lineTo(t.x + dx + t.w / 2 - 1 + t.lean, 0); c.stroke();
          c.restore();
        }
      });
    }
    c.fillRect(0, base, TW, 540 - base);
  });
}

function vinesTile(scene: Phaser.Scene) {
  canvas(scene, 'fw_vines', TW, 190, (c) => {
    const r = rng(77);
    c.strokeStyle = '#060d14';
    c.fillStyle = '#060d14';
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x1 = r() * TW, span = 90 + r() * 170, sag = 50 + r() * 80, lw = 3 + r() * 3;
      const drops = Array.from({ length: 3 }, () => ({ t: r(), len: 30 + r() * 80, wob: (r() - 0.5) * 10 }));
      wrap((dx) => {
        c.lineWidth = lw;
        c.beginPath(); c.moveTo(x1 + dx, -5); c.quadraticCurveTo(x1 + dx + span / 2, sag, x1 + dx + span, -5); c.stroke();
        for (const d of drops) {
          const hx = x1 + dx + d.t * span;
          c.lineWidth = 2;
          c.beginPath(); c.moveTo(hx, 0); c.lineTo(hx + d.wob, d.len); c.stroke();
          c.beginPath(); c.ellipse(hx + d.wob, d.len, 4, 7, 0, 0, Math.PI * 2); c.fill();
        }
      });
    }
  });
}

// The ground strip: a back edge of grass, the dirt path the fighters walk on
// (lined up with WORLD.groundTop..groundBottom), and grass in front of it.
function groundTile(scene: Phaser.Scene) {
  const H = 540 - GROUND_Y;
  const pathTop = WORLD.groundTop - GROUND_Y - 12;
  const pathBot = WORLD.groundBottom - GROUND_Y + 12;
  canvas(scene, 'fw_ground', TW, H, (c) => {
    const r = rng(31);
    const edge = (x: number, y0: number, a: number, b: number) =>
      y0 + a * Math.sin((2 * Math.PI * x) / 480) + b * Math.sin((2 * Math.PI * x) / 320 + 1.3);

    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f1f1c');
    g.addColorStop(1, '#081311');
    c.fillStyle = g;
    c.fillRect(0, 0, TW, H);

    // dirt path with a thick dark rim, Lost Castle style
    const pathShape = () => {
      c.beginPath();
      c.moveTo(0, edge(0, pathTop, 5, 3));
      for (let x = 0; x <= TW; x += 8) c.lineTo(x, edge(x, pathTop, 5, 3));
      for (let x = TW; x >= 0; x -= 8) c.lineTo(x, edge(x, pathBot, 4, 3));
      c.closePath();
    };
    g = c.createLinearGradient(0, pathTop, 0, pathBot);
    g.addColorStop(0, '#463a2e');
    g.addColorStop(0.5, '#3a3027');
    g.addColorStop(1, '#2b231d');
    c.fillStyle = g;
    pathShape(); c.fill();
    c.strokeStyle = '#120d0a'; c.lineWidth = 4; pathShape(); c.stroke();

    // worn wheel ruts, pebbles, cracks
    c.strokeStyle = 'rgba(20,14,10,0.35)'; c.lineWidth = 6;
    for (const y of [pathTop + 46, pathBot - 44]) {
      c.beginPath(); for (let x = 0; x <= TW; x += 10) c.lineTo(x, edge(x, y, 3, 2)); c.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = r() * TW, y = pathTop + 10 + r() * (pathBot - pathTop - 20), rx = 2 + r() * 5, ry = 1.5 + r() * 2.5;
      const light = r() < 0.5;
      wrap((dx) => {
        c.fillStyle = '#120d0a'; c.beginPath(); c.ellipse(x + dx, y + 1, rx + 1, ry + 1, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = light ? '#5b4d40' : '#3f352c'; c.beginPath(); c.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
      });
    }
    // grass: thick along both path edges, sparse tufts on it
    const tuft = (x: number, y: number, h: number, col: string) => {
      c.strokeStyle = col; c.lineWidth = 2.2;
      c.beginPath();
      for (let k = -1; k <= 1; k++) { c.moveTo(x + k * 3, y); c.lineTo(x + k * 6 + (r() - 0.5) * 4, y - h); }
      c.stroke();
    };
    for (let i = 0; i < 260; i++) {
      const x = r() * TW;
      const top = r() < 0.5;
      const y = top ? edge(x, pathTop, 5, 3) + 2 + r() * 4 : edge(x, pathBot, 4, 3) + 4 + r() * (H - pathBot);
      const h = 6 + r() * 10, col = r() < 0.5 ? '#24402f' : '#30553c';
      wrap((dx) => tuft(x + dx, y, h, col));
    }
    for (let i = 0; i < 26; i++) {
      const x = r() * TW, y = pathTop + 20 + r() * (pathBot - pathTop - 30), h = 4 + r() * 6;
      wrap((dx) => tuft(x + dx, y, h, '#2a4a35'));
    }
  });
}

function frontTile(scene: Phaser.Scene) {
  canvas(scene, 'fw_front', TW, 90, (c) => {
    const r = rng(91);
    c.fillStyle = INK;
    c.strokeStyle = INK;
    // low fern clumps
    for (let i = 0; i < 6; i++) {
      const x = r() * TW, n = 4 + Math.floor(r() * 4), size = 40 + r() * 40;
      const fronds = Array.from({ length: n }, () => ({ a: -Math.PI / 2 + (r() - 0.5) * 2.2, len: size * (0.6 + r() * 0.5) }));
      wrap((dx) => {
        for (const f of fronds) {
          const ex = x + dx + Math.cos(f.a) * f.len, ey = 92 + Math.sin(f.a) * f.len;
          c.lineWidth = 3;
          c.beginPath(); c.moveTo(x + dx, 92); c.quadraticCurveTo((x + dx + ex) / 2, Math.min(92, ey) - 10, ex, ey); c.stroke();
          for (let t = 0.2; t < 1; t += 0.12) {
            const px = x + dx + (ex - x - dx) * t, py = 92 + (ey - 92) * t - Math.sin(t * Math.PI) * 8;
            const leaf = (1 - t) * 10 + 3;
            for (const s of [-1, 1]) { c.beginPath(); c.ellipse(px, py, leaf, leaf * 0.3, f.a + s * 1.1, 0, Math.PI * 2); c.fill(); }
          }
        }
      });
    }
    // grass blades along the very bottom
    for (let x = 0; x < TW; x += 4) {
      const h = 8 + r() * 22;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, 92); c.lineTo(x + (r() - 0.5) * 12, 90 - h); c.stroke();
    }
  });
}

function propTextures(scene: Phaser.Scene) {
  // a big dark trunk that passes in front of the action now and then
  canvas(scene, 'fw_trunk', 170, 540, (c) => {
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(40, 0); c.lineTo(122, 0);
    c.quadraticCurveTo(112, 300, 128, 470); c.quadraticCurveTo(150, 520, 170, 540);
    c.lineTo(0, 540); c.quadraticCurveTo(22, 515, 40, 470); c.quadraticCurveTo(54, 300, 40, 0);
    c.fill();
    c.strokeStyle = '#1d3440'; c.lineWidth = 2; c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(119, 0); c.quadraticCurveTo(110, 300, 125, 470); c.stroke();
  });
  canvas(scene, 'fw_torch', 40, 150, (c) => {
    c.fillStyle = INK;
    c.fillRect(16, 30, 9, 120);
    c.fillStyle = '#2c2119';
    c.fillRect(18, 32, 5, 116);
    // iron bowl
    c.fillStyle = INK;
    c.beginPath(); c.moveTo(4, 18); c.lineTo(36, 18); c.lineTo(28, 34); c.lineTo(12, 34); c.closePath(); c.fill();
    c.fillStyle = '#4a3b2c';
    c.beginPath(); c.moveTo(8, 20); c.lineTo(32, 20); c.lineTo(26, 31); c.lineTo(14, 31); c.closePath(); c.fill();
    c.fillStyle = '#ffb347';
    c.beginPath(); c.ellipse(20, 20, 12, 3.5, 0, 0, Math.PI * 2); c.fill();
  });
  canvas(scene, 'fw_fence', 150, 70, (c) => {
    const post = (x: number, h: number, tilt: number) => {
      c.save(); c.translate(x, 68); c.rotate(tilt);
      c.fillStyle = INK; c.fillRect(-6, -h - 2, 12, h + 2);
      c.fillStyle = '#4b3a2b'; c.fillRect(-4, -h, 8, h - 2);
      c.restore();
    };
    post(12, 58, -0.05); post(62, 52, 0.04); post(112, 60, -0.08); post(140, 40, 0.25);
    for (const y of [26, 46]) {
      c.fillStyle = INK; c.fillRect(2, y - 4, 128, 10);
      c.fillStyle = '#5a4634'; c.fillRect(4, y - 2, 124, 6);
    }
  });
  canvas(scene, 'fw_grave', 56, 78, (c) => {
    const shape = () => { c.beginPath(); c.moveTo(6, 78); c.lineTo(6, 26); c.quadraticCurveTo(28, -2, 50, 26); c.lineTo(50, 78); c.closePath(); };
    c.fillStyle = '#2e3b47'; shape(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 4; shape(); c.stroke();
    c.fillStyle = '#1a232c'; c.fillRect(24, 22, 8, 32); c.fillRect(16, 30, 24, 7);
    c.strokeStyle = '#4b6173'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(46, 28); c.quadraticCurveTo(42, 12, 28, 8); c.stroke();
    c.fillStyle = '#2a4a35';
    for (let x = 4; x < 54; x += 5) { c.beginPath(); c.moveTo(x, 78); c.lineTo(x + 3, 68 - (x % 3) * 3); c.lineTo(x + 5, 78); c.fill(); }
  });
  canvas(scene, 'fw_shroom', 36, 30, (c) => {
    for (const [x, s] of [[10, 1], [22, 1.3], [30, 0.8]] as const) {
      c.fillStyle = INK; c.fillRect(x - 2 * s, 30 - 12 * s, 4 * s, 12 * s);
      c.fillStyle = '#cfe9e4'; c.fillRect(x - 1.2 * s, 30 - 11 * s, 2.4 * s, 11 * s);
      c.fillStyle = INK; c.beginPath(); c.ellipse(x, 30 - 12 * s, 8 * s, 5 * s, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#5ff0e0'; c.beginPath(); c.ellipse(x, 30 - 12.5 * s, 6.5 * s, 4 * s, 0, Math.PI, 0); c.fill();
    }
  });
  canvas(scene, 'fw_bones', 60, 24, (c) => {
    c.lineCap = 'round';
    for (const [x1, y1, x2, y2] of [[6, 18, 34, 12], [20, 20, 50, 20], [40, 8, 54, 18]]) {
      c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = '#d8d0b8'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.fillStyle = INK; c.beginPath(); c.arc(14, 10, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e2dbc5'; c.beginPath(); c.arc(14, 10, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK; c.fillRect(10, 8, 3, 3); c.fillRect(15, 8, 3, 3);
  });
  // soft round pool of light on the ground, squashed for perspective
  canvas(scene, 'fw_pool', 256, 96, (c) => {
    c.save(); c.scale(1, 96 / 256);
    radial(c, 128, 128, 128, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    c.restore();
  });
}

export function makeBlightwoodTextures(scene: Phaser.Scene) {
  forestTile(scene, 'fw_far', 15, 13, '#16293a', 352, 14, 26, 2.5, null);
  forestTile(scene, 'fw_mid', 19, 6, '#0d1823', 362, 32, 56, 0.6, '#3d6a7a');
  vinesTile(scene);
  groundTile(scene);
  frontTile(scene);
  propTextures(scene);
}

// ---- the scene --------------------------------------------------------------------

export interface Light { x: number; y: number; radius: number; strength: number }

export interface Blightwood {
  update(cam: Phaser.Cameras.Scene2D.Camera, playerScreenX: number): void;
  // colour to tint a character standing at (x, y): cool moonlight, warmer near fire
  lightAt(x: number, y: number): number;
  openExit(): void;
  exitX: number;
}

const MOON = Phaser.Display.Color.ValueToColor(0xaebbe0);
const FIRE = Phaser.Display.Color.ValueToColor(0xffd6a8);

export function buildBlightwood(scene: Phaser.Scene): Blightwood {
  if (!scene.textures.exists('fw_ground')) makeBlightwoodTextures(scene);
  const { viewW, viewH, roomW, groundTop, groundBottom } = WORLD;
  const parallax: { ts: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  const tile = (key: string, y: number, h: number, factor: number, depth: number) => {
    const ts = scene.add.tileSprite(0, y, viewW, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
    parallax.push({ ts, factor });
    return ts;
  };

  let fog1: Phaser.GameObjects.TileSprite | null = null;
  let fog2: Phaser.GameObjects.TileSprite | null = null;
  const packLayers = (scene.registry.get('bgCount') as number) ?? 0;
  if (packLayers > 0) {
    // a background pack in assets/backgrounds/active/ replaces the painted sky and trees
    for (let i = 0; i < packLayers; i++) {
      const img = scene.textures.get(`bg_${i}`).getSourceImage() as HTMLImageElement;
      tile(`bg_${i}`, 0, viewH, packLayers === 1 ? 0.5 : 0.05 + (i / (packLayers - 1)) * 0.7, -100 + i).setTileScale(viewH / img.height);
    }
  } else {
    scene.add.image(0, 0, 'tt_sky').setOrigin(0).setScrollFactor(0).setDepth(-100);
    tile('fw_far', 0, viewH, 0.15, -99);
    fog1 = tile('tt_fog', 250, 160, 0.25, -98).setAlpha(0.5).setBlendMode(Phaser.BlendModes.SCREEN);
    tile('fw_mid', 0, viewH, 0.45, -97);
    fog2 = tile('tt_fog', 300, 160, 0.5, -96).setAlpha(0.35).setBlendMode(Phaser.BlendModes.SCREEN);
    tile('fw_vines', 0, 190, 0.7, -95);
  }
  scene.add.tileSprite(0, GROUND_Y, roomW, viewH - GROUND_Y, 'fw_ground').setOrigin(0).setDepth(-50);

  // props along the back edge, placed the same way every time for a given room
  const rnd = new Phaser.Math.RandomDataGenerator(['blightwood']);
  const lights: Light[] = [];
  const backY = groundTop - 6;
  for (let x = 90; x < roomW - 260; x += rnd.between(110, 230)) {
    const pick = rnd.frac();
    const y = backY + rnd.between(-4, 4);
    if (pick < 0.32) scene.add.image(x, y, 'fw_grave').setOrigin(0.5, 1).setDepth(y - 30).setScale(rnd.realInRange(0.75, 0.95)).setAngle(rnd.between(-6, 6));
    else if (pick < 0.55) scene.add.image(x, y, 'fw_fence').setOrigin(0.5, 1).setDepth(y - 30).setFlipX(rnd.frac() < 0.5);
    else if (pick < 0.72) {
      scene.add.image(x, y + 2, 'fw_shroom').setOrigin(0.5, 1).setDepth(y - 30);
      scene.add.image(x, y - 10, 'tt_light').setDepth(y - 31).setScale(0.35).setTint(0x3fe8dc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    } else scene.add.image(x, y + 4, 'fw_bones').setOrigin(0.5, 1).setDepth(y - 30);
  }
  // torches every so often, each a light source
  for (let x = 380; x < roomW - 300; x += 560 + rnd.between(-60, 60)) {
    addTorch(scene, x, backY, lights);
  }

  // fireflies over the whole room
  scene.add.particles(0, 0, 'tt_dot', {
    x: { min: 0, max: roomW }, y: { min: 150, max: groundBottom },
    speed: { min: 4, max: 14 }, lifespan: { min: 4000, max: 7000 },
    scale: { min: 0.12, max: 0.24 },
    alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 },
    tint: [0xc8ff8a, 0x9cf7c8], blendMode: 'ADD', frequency: 110,
  }).setDepth(9000).fastForward(6000);

  // the exit: the rune ring, dark until the room is cleared
  const exitX = roomW - 80;
  const exitY = Math.round((groundTop + groundBottom) / 2) + 6;
  const ring = scene.add.image(exitX, exitY, 'tt_portal').setOrigin(0.5, 1).setScale(0.85).setDepth(exitY - 40).setTint(0x4a5866);
  const ringGlow = scene.add.image(exitX, exitY - 105, 'tt_light').setScale(1.3).setTint(0x3fe8dc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(exitY - 41);
  const ringPool = scene.add.image(exitX, exitY, 'fw_pool').setTint(0x3fe8dc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(1.2).setDepth(0.5);

  // foreground framing: grass along the bottom, a big trunk passing in front now and then
  tile('fw_front', viewH - 90, 90, 1.2, 15000);
  // placed so each sweeps across the screen as the camera moves, never parked mid-screen at the start
  const trunks = [1180, 2320].map((x, i) =>
    scene.add.image(x, 0, 'fw_trunk').setOrigin(0.5, 0).setScale(0.72, 1).setScrollFactor(1.35, 0).setDepth(15001).setFlipX(i % 2 === 1));
  scene.add.image(0, 0, 'tt_vignette').setOrigin(0).setScrollFactor(0).setDepth(16000);

  let fogDrift = 0;
  return {
    exitX,
    update(cam, playerScreenX) {
      fogDrift += 0.12;
      for (const p of parallax) p.ts.tilePositionX = (cam.scrollX * p.factor) / p.ts.tileScaleX;
      // mist also drifts on its own
      if (fog1) fog1.tilePositionX += fogDrift * 0.3;
      if (fog2) fog2.tilePositionX += fogDrift * 0.5;
      // a trunk turns see-through while the player is behind it
      for (const t of trunks) {
        const sx = t.x - cam.scrollX * 1.35;
        const behind = Math.abs(sx - playerScreenX) < 80;
        t.setAlpha(Phaser.Math.Linear(t.alpha, behind ? 0.3 : 1, 0.15));
      }
    },
    lightAt(x, y) {
      let w = 0;
      for (const l of lights) {
        const d = Math.hypot(x - l.x, (y - l.y) * 1.6);
        if (d < l.radius) w = Math.max(w, (1 - d / l.radius) ** 1.4 * l.strength);
      }
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(MOON, FIRE, 100, Math.round(w * 100));
      return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    },
    openExit() {
      ring.clearTint();
      scene.tweens.add({ targets: ringGlow, alpha: 0.55, duration: 700 });
      scene.tweens.add({ targets: ringGlow, scale: 1.15, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 700 });
      scene.tweens.add({ targets: ringPool, alpha: 0.5, duration: 700 });
      scene.add.particles(exitX, exitY - 105, 'tt_dot', {
        x: { min: -55, max: 55 }, y: { min: -50, max: 60 },
        speedY: { min: -22, max: -8 }, lifespan: { min: 1800, max: 3200 },
        scale: { start: 0.28, end: 0 }, alpha: { start: 0.9, end: 0 },
        tint: [0x7ffcf0, 0x9b7bff], blendMode: 'ADD', frequency: 70,
      }).setDepth(exitY - 39);
    },
  };
}

function addTorch(scene: Phaser.Scene, x: number, y: number, lights: Light[]) {
  scene.add.image(x, y, 'fw_torch').setOrigin(0.5, 1).setDepth(y - 30);
  const fy = y - 150 + 20;
  for (const [tint, s, dx] of [[0xff5a14, 0.55, 0], [0xffa03a, 0.4, -2], [0xfff0b0, 0.24, 1]] as const) {
    const fl = scene.add.image(x + dx, fy, 'tt_flame').setOrigin(0.5, 0.92).setScale(s * 0.75, s).setTint(tint).setDepth(y - 29).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: fl, scaleY: s * 1.2, scaleX: s * 0.66, duration: 130 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: fl, angle: { from: -6, to: 6 }, duration: 280 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const halo = scene.add.image(x, fy - 14, 'tt_light').setScale(1.6).setTint(0xff9a3c).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(y - 31);
  const pool = scene.add.image(x, y + 40, 'fw_pool').setScale(2.4, 2.2).setTint(0xff8a3a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.42).setDepth(0.5);
  scene.time.addEvent({
    delay: 90, loop: true,
    callback: () => {
      const f = Math.random();
      halo.setAlpha(0.3 + f * 0.1);
      pool.setAlpha(0.38 + f * 0.08);
    },
  });
  scene.add.particles(x, fy - 10, 'tt_dot', {
    x: { min: -6, max: 6 }, speedY: { min: -70, max: -30 }, speedX: { min: -14, max: 14 },
    lifespan: { min: 900, max: 1800 }, scale: { start: 0.2, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [0xffd27a, 0xff9a3c], blendMode: 'ADD', frequency: 140,
  }).setDepth(y - 28);
  lights.push({ x, y: y + 40, radius: 230, strength: 0.85 });
}
