// How each weapon skill plays out (the names and cooldowns are in weapons.ts).
//
// A skill starts from Player when I (or LB) is pressed. It returns how long the
// hero is busy with it, and puts an effect on the room that runs every frame until
// it says it is done: a charge moving the hero, a leap ending in a slam, arrows or
// ice falling on an area after the hero has moved on.
import Phaser from 'phaser';
import { WORLD } from './config';
import type { SkillId } from './weapons';
import type { AttackSpec, RoomScene } from './scenes/RoomScene';
import type { Player } from './entities/Player';

// The tuning numbers, one block per skill.
export const SKILL_TUNING = {
  shieldCharge: { time: 0.36, speed: 560, dmg: 14, knock: 280, stun: 1.4 },
  leapSlam: { time: 0.55, height: 62, distance: 150, dmg: 32, rx: 100, ry: 42, knock: 360 },
  rainOfArrows: { ahead: 170, rx: 84, ry: 34, mark: 0.5, volleys: 6, every: 0.18, dmg: 6, cast: 0.36 },
  blizzard: { ahead: 190, rx: 112, ry: 46, last: 3.5, every: 0.35, dmg: 5, slow: 1.2, cast: 0.5 },
};

type Effect = (dt: number) => boolean; // false when done

const inEllipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// Where an area skill lands: ahead of the hero, leaning with the aim, on the floor.
function ahead(p: Player, dist: number, aimY: number) {
  return {
    x: Phaser.Math.Clamp(p.x + p.facing * dist, 40, WORLD.roomW - 40),
    y: Phaser.Math.Clamp(p.y + aimY * 70, WORLD.groundTop + 10, WORLD.groundBottom - 10),
  };
}

// Starts a skill; returns the seconds the hero is busy with it.
export function startSkill(id: SkillId, s: RoomScene, p: Player, aimY: number): number {
  switch (id) {
    case 'shieldCharge': return shieldCharge(s, p, aimY);
    case 'leapSlam': return leapSlam(s, p, aimY);
    case 'rainOfArrows': return rainOfArrows(s, p, aimY);
    case 'blizzard': return blizzard(s, p, aimY);
  }
}

// Rush forward behind the shield: everything touched is hit once and stunned.
function shieldCharge(s: RoomScene, p: Player, aimY: number) {
  const T = SKILL_TUNING.shieldCharge;
  const hit = new Set<object>();
  const spec: AttackSpec = { dmg: T.dmg, range: 0, depth: 22, knock: T.knock, heavy: true, stun: T.stun };
  p.invuln = Math.max(p.invuln, T.time);
  p.playAnim('heavy', { duration: T.time * 1000, force: true });
  s.dust(p.x, p.y, 4);
  let t = 0, dustT = 0;
  const run: Effect = (dt) => {
    t += dt;
    if (p.state !== 'skill' || t > T.time) return false;
    const k = 1 - (t / T.time) * 0.4;
    p.x += p.facing * T.speed * k * dt;
    p.y += aimY * T.speed * 0.4 * k * dt;
    if ((dustT -= dt) <= 0) { dustT = 0.05; s.dust(p.x - p.facing * 10, p.y, 1); }
    s.strike(p, true, spec, s.enemies, (x, y) => Math.abs(x - (p.x + p.facing * 14)) < 30 && Math.abs(y - p.y) <= spec.depth, { once: hit });
    return true;
  };
  s.addEffect(run);
  return T.time;
}

// Up into the air, forward, and down in a ring of force.
function leapSlam(s: RoomScene, p: Player, aimY: number) {
  const T = SKILL_TUNING.leapSlam;
  p.invuln = Math.max(p.invuln, T.time + 0.05);
  p.playAnim('leap', { duration: T.time * 1000, force: true });
  s.dust(p.x, p.y, 5);
  let t = 0;
  const run: Effect = (dt) => {
    t += dt;
    if (p.isDead()) { p.lift = 0; return false; }
    const step = Math.min(dt, Math.max(0, T.time - (t - dt)));
    p.x += p.facing * (T.distance / T.time) * step;
    p.y += aimY * (T.distance * 0.35 / T.time) * step;
    p.lift = Math.sin(Math.min(1, t / T.time) * Math.PI) * T.height;
    if (t < T.time) return true;
    p.lift = 0;
    p.clamp();
    s.shockwave(p.x, p.y, 0xffd27a);
    s.shake(180, 0.01);
    s.strike({ x: p.x, y: p.y - 1, facing: p.facing }, true, { dmg: T.dmg, range: 0, depth: T.ry, knock: T.knock, heavy: true }, s.enemies, inEllipse(p.x, p.y, T.rx, T.ry));
    return false;
  };
  s.addEffect(run);
  return T.time + 0.12;
}

// A red circle ahead, then volleys of arrows falling into it.
function rainOfArrows(s: RoomScene, p: Player, aimY: number) {
  const T = SKILL_TUNING.rainOfArrows;
  const { x, y } = ahead(p, T.ahead, aimY);
  p.playAnim('throw', { duration: T.cast * 1000, force: true });
  const mark = s.add.ellipse(x, y, T.rx * 2, T.ry * 2, 0xff3a2a, 0.14).setStrokeStyle(2, 0xff5a3a, 0.9).setDepth(2);
  s.tweens.add({ targets: mark, alpha: { from: 0.4, to: 1 }, duration: 160, yoyo: true, repeat: -1 });
  const spec: AttackSpec = { dmg: T.dmg, range: 0, depth: T.ry, knock: 40, quiet: true };
  const FALL = 0.13; // seconds from a volley's start until its arrows land
  let t = 0, done = 0, landed = 0;
  const run: Effect = (dt) => {
    t += dt;
    if (t < T.mark) return true;
    while (landed < done && t >= T.mark + landed * T.every + FALL) {
      landed++;
      s.strike({ x, y: y - 1, facing: p.facing }, true, spec, s.enemies, inEllipse(x, y, T.rx, T.ry));
    }
    while (done < T.volleys && t >= T.mark + done * T.every) {
      done++;
      // a few arrows streak down to random spots in the circle
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
        const ax = x + Math.cos(a) * r * T.rx * 0.9, ay = y + Math.sin(a) * r * T.ry * 0.9;
        const arrow = s.add.image(ax - 30, ay - 220, 'shot_arrow').setScale(0.5).setRotation(Math.PI * 0.42).setDepth(ay + 11);
        s.tweens.add({ targets: arrow, x: ax, y: ay - 6, duration: FALL * 1000, ease: 'Quad.easeIn', onComplete: () => {
          s.dust(ax, ay, 1);
          s.tweens.add({ targets: arrow, alpha: 0, duration: 400, delay: 200, onComplete: () => arrow.destroy() });
        } });
      }
    }
    if (landed >= T.volleys) {
      s.tweens.add({ targets: mark, alpha: 0, duration: 300, delay: 150, onComplete: () => mark.destroy() });
      return false;
    }
    return true;
  };
  s.addEffect(run);
  return T.cast;
}

// Ice falls over an area ahead for a few seconds: it hurts and slows what stands in it.
function blizzard(s: RoomScene, p: Player, aimY: number) {
  const T = SKILL_TUNING.blizzard;
  const { x, y } = ahead(p, T.ahead, aimY);
  p.playAnim('throw', { duration: T.cast * 1000, force: true });
  const pool = s.add.image(x, y, 'fw_pool').setTint(0x9fd8ff).setBlendMode(Phaser.BlendModes.ADD)
    .setScale((T.rx * 2.4) / 256, (T.ry * 2.4) / 96).setAlpha(0).setDepth(0.5);
  const frost = s.add.ellipse(x, y, T.rx * 2, T.ry * 2, 0xcfeeff, 0.12).setStrokeStyle(2, 0xcfeeff, 0.6).setDepth(2).setAlpha(0);
  s.tweens.add({ targets: [pool, frost], alpha: 1, duration: 300 });
  const snow = s.add.particles(x, y - 150, 'tt_dot', {
    x: { min: -T.rx, max: T.rx }, y: { min: -20, max: 20 }, speedY: { min: 220, max: 300 }, speedX: { min: -40, max: -10 },
    lifespan: { min: 480, max: 620 }, scale: { start: 0.26, end: 0.12 }, alpha: { start: 0.95, end: 0.4 },
    tint: [0xffffff, 0xcfeeff, 0x9fd8ff], blendMode: 'ADD', frequency: 14,
  }).setDepth(y + 40);
  const spec: AttackSpec = { dmg: T.dmg, range: 0, depth: T.ry, knock: 0, dot: true, slow: T.slow };
  let t = 0, tick = 0.15;
  const run: Effect = (dt) => {
    t += dt;
    if ((tick -= dt) <= 0 && t <= T.last) {
      tick = T.every;
      s.strike({ x, y: y - 1, facing: p.facing }, true, spec, s.enemies, inEllipse(x, y, T.rx, T.ry));
    }
    if (t < T.last) return true;
    snow.stop();
    s.tweens.add({ targets: [pool, frost], alpha: 0, duration: 500, onComplete: () => { pool.destroy(); frost.destroy(); snow.destroy(); } });
    return false;
  };
  s.addEffect(run);
  return T.cast;
}
