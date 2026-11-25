// How each weapon skill plays out (the names and cooldowns are in weapons.ts).
//
// A skill starts from Player when I (or LB) is pressed. It returns how long the
// hero is busy with it, and puts an effect on the room that runs every frame until
// it says it is done: a charge moving the hero, a leap ending in a slam, arrows or
// ice falling on an area after the hero has moved on.
import Phaser from 'phaser';
import { WORLD } from './config';
import type { Move, SkillId } from './weapons';
import type { AttackSpec, RoomScene } from './scenes/RoomScene';
import type { Player } from './entities/Player';

// The tuning numbers, one block per skill.
export const SKILL_TUNING = {
  shieldCharge: { time: 0.36, speed: 560, dmg: 14, knock: 280, stun: 1.4 },
  leapSlam: { time: 0.55, height: 62, distance: 150, dmg: 32, rx: 100, ry: 42, knock: 360 },
  rainOfArrows: { ahead: 170, rx: 84, ry: 34, mark: 0.5, volleys: 6, every: 0.18, dmg: 6, cast: 0.36 },
  blizzard: { ahead: 190, rx: 112, ry: 46, last: 3.5, every: 0.35, dmg: 5, slow: 1.2, cast: 0.5 },
  bladeStorm: { time: 0.85, every: 0.085, dmg: 4, rx: 74, ry: 30, knock: 25, drift: 70 },
  sparkVolley: { count: 6, dmg: 7, speed: 430, reach: 560, homing: 7, cast: 0.34 },
  cannonBlast: { cast: 0.42, fireAt: 0.14, reach: 230, spread: 0.45, dmg: 30, knock: 620, pellets: 10, recoil: 420 },
  fanTheHammer: { shots: 6, every: 0.07, dmg: 8, speed: 1200, reach: 600, wobble: 0.06, cast: 0.5 },
};

type Effect = (dt: number) => boolean; // false when done

const inEllipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// Where an area skill lands: straight ahead of the hero, on the floor.
function ahead(p: Player, dist: number) {
  return {
    x: Phaser.Math.Clamp(p.x + p.facing * dist, 40, WORLD.roomW - 40),
    y: Phaser.Math.Clamp(p.y, WORLD.groundTop + 10, WORLD.groundBottom - 10),
  };
}

// Starts a skill; returns the seconds the hero is busy with it.
export function startSkill(id: SkillId, s: RoomScene, p: Player): number {
  switch (id) {
    case 'shieldCharge': return shieldCharge(s, p);
    case 'leapSlam': return leapSlam(s, p);
    case 'rainOfArrows': return rainOfArrows(s, p);
    case 'blizzard': return blizzard(s, p);
    case 'bladeStorm': return bladeStorm(s, p);
    case 'sparkVolley': return sparkVolley(s, p);
    case 'cannonBlast': return cannonBlast(s, p);
    case 'fanTheHammer': return fanTheHammer(s, p);
  }
}

// Rush forward behind the shield: everything touched is hit once and stunned.
function shieldCharge(s: RoomScene, p: Player) {
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
    if ((dustT -= dt) <= 0) { dustT = 0.05; s.dust(p.x - p.facing * 10, p.y, 1); }
    s.strike(p, p, spec, s.enemies, (x, y) => Math.abs(x - (p.x + p.facing * 14)) < 30 && Math.abs(y - p.y) <= spec.depth, { once: hit });
    return true;
  };
  s.addEffect(run);
  return T.time;
}

// Up into the air, forward, and down in a ring of force.
function leapSlam(s: RoomScene, p: Player) {
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
    p.lift = Math.sin(Math.min(1, t / T.time) * Math.PI) * T.height;
    if (t < T.time) return true;
    p.lift = 0;
    p.clamp();
    s.shockwave(p.x, p.y, 0xffd27a);
    s.shake(180, 0.01);
    s.strike({ x: p.x, y: p.y - 1, facing: p.facing }, p, { dmg: T.dmg, range: 0, depth: T.ry, knock: T.knock, heavy: true }, s.enemies, inEllipse(p.x, p.y, T.rx, T.ry));
    return false;
  };
  s.addEffect(run);
  return T.time + 0.12;
}

// A red circle ahead, then volleys of arrows falling into it.
function rainOfArrows(s: RoomScene, p: Player) {
  const T = SKILL_TUNING.rainOfArrows;
  const { x, y } = ahead(p, T.ahead);
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
      s.strike({ x, y: y - 1, facing: p.facing }, p, spec, s.enemies, inEllipse(x, y, T.rx, T.ry));
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
function blizzard(s: RoomScene, p: Player) {
  const T = SKILL_TUNING.blizzard;
  const { x, y } = ahead(p, T.ahead);
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
      s.strike({ x, y: y - 1, facing: p.facing }, p, spec, s.enemies, inEllipse(x, y, T.rx, T.ry));
    }
    if (t < T.last) return true;
    snow.stop();
    s.tweens.add({ targets: [pool, frost], alpha: 0, duration: 500, onComplete: () => { pool.destroy(); frost.destroy(); snow.destroy(); } });
    return false;
  };
  s.addEffect(run);
  return T.cast;
}

// A whirl of quick cuts all around, drifting forward a little: many small hits.
function bladeStorm(s: RoomScene, p: Player) {
  const T = SKILL_TUNING.bladeStorm;
  const spec: AttackSpec = { dmg: T.dmg, range: 0, depth: T.ry, knock: T.knock, quiet: true };
  const dir = p.facing;
  let t = 0, tick = 0, n = 0;
  const run: Effect = (dt) => {
    t += dt;
    if (p.state !== 'skill' || t > T.time) { if (!p.isDead()) p.facing = dir; return false; }
    p.x += dir * T.drift * dt;
    if ((tick -= dt) <= 0) {
      tick = T.every;
      // cut left and right in turn, each cut a slash arc around the hero
      p.facing = n % 2 ? -dir : dir;
      p.playAnim(n % 3 === 2 ? 'heavy' : 'attack', { duration: T.every * 1000 * 1.6, force: true });
      slashArc(s, p.x, p.y, n++);
      s.strike({ x: p.x, y: p.y - 1, facing: p.facing }, p, spec, s.enemies, inEllipse(p.x, p.y, T.rx, T.ry));
    }
    return true;
  };
  s.addEffect(run);
  return T.time;
}

// A pale crescent flashing round the hero at a turning angle.
function slashArc(s: RoomScene, x: number, y: number, n: number) {
  const g = s.add.graphics().setDepth(y + 12).setBlendMode(Phaser.BlendModes.ADD);
  const a0 = n * 2.1, flip = n % 2 ? -1 : 1;
  g.lineStyle(5, 0xe8f0ff, 0.9);
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = a0 + flip * (i / 10) * 2.2;
    const px = x + Math.cos(a) * 56, py = y - 30 + Math.sin(a) * 26;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.strokePath();
  s.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
}

// Sparks burst out in a fan and seek the nearest foes.
function sparkVolley(s: RoomScene, p: Player) {
  const T = SKILL_TUNING.sparkVolley;
  p.playAnim('throw', { duration: T.cast * 1000, force: true });
  const move: Move = {
    anim: 'throw', dur: 0, hitAt: 0, dmg: T.dmg, range: 0, depth: 18, knock: 60, lunge: 0, quiet: true,
    shot: { look: 'spark', speed: T.speed, reach: T.reach, homing: T.homing },
  };
  let t = 0;
  const run: Effect = (dt) => {
    t += dt;
    if (t < T.cast * 0.45) return true;
    for (let i = 0; i < T.count; i++) {
      // spread over a half circle in front, up and down the floor
      const a = (i / (T.count - 1) - 0.5) * Math.PI * 0.9;
      s.shots.launch(p.x + p.facing * 18, p.y, Math.cos(a) * T.speed * p.facing, Math.sin(a) * T.speed * 0.6, move, p);
    }
    s.shockwave(p.x + p.facing * 18, p.y, 0xb98aff);
    return false;
  };
  s.addEffect(run);
  return T.cast;
}

// One huge blast: everything in a wide cone ahead is hit hard and hurled away, and
// the kick throws the hero back a good step.
function cannonBlast(s: RoomScene, p: Player) {
  const T = SKILL_TUNING.cannonBlast;
  p.playAnim('throw', { duration: T.cast * 1000, force: true });
  const dir = p.facing;
  const spec: AttackSpec = { dmg: T.dmg, range: 0, depth: 0, knock: T.knock, heavy: true, stop: 110 };
  const pellets: Move = {
    anim: 'throw', dur: 0, hitAt: 0, dmg: 0, range: 0, depth: 0, knock: 0, lunge: 0, quiet: true,
    shot: { look: 'pellet', speed: 1000, reach: T.reach, pierce: true, show: true },
  };
  let t = 0;
  const run: Effect = (dt) => {
    t += dt;
    if (t < T.fireAt) return true;
    const x0 = p.x + dir * 30, y0 = p.y;
    // the cone: ahead of the muzzle, widening with distance
    const inside = (x: number, y: number) => {
      const d = (x - x0) * dir;
      return d > -20 && d < T.reach && Math.abs(y - y0) <= 22 + Math.max(0, d) * T.spread;
    };
    s.strike({ x: x0 - dir * 40, y: y0, facing: dir }, p, spec, s.enemies, inside);
    for (let i = 0; i < T.pellets; i++) {
      const lean = (Math.random() - 0.5) * 2 * T.spread, k = 0.8 + Math.random() * 0.4;
      s.shots.launch(x0, y0, dir * 1000 * k, lean * 1000 * k, pellets, p);
    }
    s.shots.muzzle(x0, y0, dir, 2.6);
    s.shockwave(x0 + dir * 50, y0, 0xffb060);
    s.shake(200, 0.012);
    s.dust(p.x, p.y, 5);
    p.recoil(T.recoil);
    return false;
  };
  s.addEffect(run);
  return T.cast;
}

// Six shots as fast as the hammer can be fanned, a little wild, from both guns in
// turn; afterwards the guns are freshly loaded.
function fanTheHammer(s: RoomScene, p: Player) {
  const T = SKILL_TUNING.fanTheHammer;
  const dir = p.facing;
  const move: Move = {
    anim: 'throw', dur: 0, hitAt: 0, dmg: T.dmg, range: 0, depth: 18, knock: 60, lunge: 0, quiet: true,
    shot: { look: 'bullet', speed: T.speed, reach: T.reach },
  };
  let t = 0, fired = 0;
  const run: Effect = (dt) => {
    t += dt;
    if (p.isDead()) return false;
    while (fired < T.shots && t >= 0.05 + fired * T.every) {
      p.facing = dir;
      p.playAnim('throw', { duration: T.every * 1000 * 1.5, force: true });
      const lean = (Math.random() - 0.5) * 2 * T.wobble;
      const hand = fired % 2 ? 4 : -4; // left gun, right gun
      s.shots.launch(p.x + dir * 30, p.y + hand, dir * T.speed, lean * T.speed, move, p);
      s.shots.muzzle(p.x + dir * 30, p.y + hand, dir, 0.8);
      fired++;
    }
    if (fired < T.shots) return true;
    p.refill();
    return false;
  };
  s.addEffect(run);
  return T.cast;
}
