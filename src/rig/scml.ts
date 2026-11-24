// Reads Spriter animation files (.scml) and works out where every part of a
// character is at a given moment.
//
// CraftPix's chibi packs ship one of these next to the character's separate parts
// (PNG/Vector Parts). All the packs share one rig: the same parts, bones and
// animations. So the game can draw any character from parts of several packs
// (a head from one, a body from another, a bow instead of the sword). Rig.ts puts
// the result on screen.
//
// Spriter's format, as far as these files use it: bones and sprites each have a
// timeline of keys (position, angle, scale, alpha); a mainline says which timeline
// key is current at each moment and how bones and sprites are parented. Between
// keys values are blended; angles turn the way the key's `spin` says. Spriter's y
// axis points up and angles turn anticlockwise.

export interface SFile { name: string; w: number; h: number; px: number; py: number }

interface Pose { x: number; y: number; angle: number; sx: number; sy: number; a: number }
interface TKey extends Pose { time: number; spin: number; instant: boolean; file?: string; px?: number; py?: number }
interface Timeline { id: number; name: string; bone: boolean; keys: TKey[] }
interface Ref { id: number; parent: number; timeline: number; key: number; z: number }
interface MainKey { time: number; bones: Ref[]; objects: Ref[] }

export interface SAnim { name: string; length: number; looping: boolean; main: MainKey[]; timelines: Timeline[] }

export interface Scml { files: Map<string, SFile>; anims: Map<string, SAnim> }

// Where one part is, in Spriter's space: its pivot point, angle, scale.
export interface PartState extends Pose { slot: string; file: SFile; z: number }

const num = (e: Element, k: string, d: number) => (e.hasAttribute(k) ? parseFloat(e.getAttribute(k)!) : d);

export function parseScml(text: string): Scml {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const files = new Map<string, SFile>();
  const byId = new Map<string, SFile>();
  for (const folder of Array.from(doc.querySelectorAll('folder'))) {
    for (const f of Array.from(folder.querySelectorAll('file'))) {
      const sf: SFile = { name: f.getAttribute('name')!, w: num(f, 'width', 0), h: num(f, 'height', 0), px: num(f, 'pivot_x', 0), py: num(f, 'pivot_y', 1) };
      files.set(sf.name, sf);
      byId.set(`${folder.getAttribute('id')}/${f.getAttribute('id')}`, sf);
    }
  }
  const anims = new Map<string, SAnim>();
  const entity = doc.querySelector('entity')!;
  for (const a of Array.from(entity.querySelectorAll(':scope > animation'))) {
    const ref = (r: Element): Ref => ({
      id: num(r, 'id', 0), parent: num(r, 'parent', -1), timeline: num(r, 'timeline', 0), key: num(r, 'key', 0), z: num(r, 'z_index', 0),
    });
    const main = Array.from(a.querySelectorAll(':scope > mainline > key')).map((k) => ({
      time: num(k, 'time', 0),
      bones: Array.from(k.querySelectorAll('bone_ref')).map(ref),
      objects: Array.from(k.querySelectorAll('object_ref')).map(ref),
    }));
    const timelines = Array.from(a.querySelectorAll(':scope > timeline')).map((t) => {
      const bone = t.getAttribute('object_type') === 'bone';
      const keys = Array.from(t.querySelectorAll(':scope > key')).map((k) => {
        const p = k.querySelector(bone ? 'bone' : 'object')!;
        const f = bone ? undefined : byId.get(`${p.getAttribute('folder')}/${p.getAttribute('file')}`);
        const key: TKey = {
          time: num(k, 'time', 0), spin: num(k, 'spin', 1), instant: k.getAttribute('curve_type') === 'instant',
          x: num(p, 'x', 0), y: num(p, 'y', 0), angle: num(p, 'angle', 0), sx: num(p, 'scale_x', 1), sy: num(p, 'scale_y', 1), a: num(p, 'a', 1),
          file: f?.name,
          px: p.hasAttribute('pivot_x') ? num(p, 'pivot_x', 0) : undefined,
          py: p.hasAttribute('pivot_y') ? num(p, 'pivot_y', 1) : undefined,
        };
        return key;
      });
      return { id: num(t, 'id', 0), name: t.getAttribute('name') ?? '', bone, keys };
    });
    timelines.sort((x, y) => x.id - y.id);
    anims.set(a.getAttribute('name')!, { name: a.getAttribute('name')!, length: num(a, 'length', 1000), looping: a.getAttribute('looping') !== 'false', main, timelines });
  }
  return { files, anims };
}

// The value of one timeline at time t, blending from key k to the next.
function tween(anim: SAnim, tl: Timeline, k: number, t: number): TKey {
  const a = tl.keys[k];
  let n = k + 1;
  if (n >= tl.keys.length) {
    if (!anim.looping) return a;
    n = 0;
  }
  const b = tl.keys[n];
  if (a.instant || n === k) return a;
  let tb = b.time;
  if (n <= k) tb += anim.length;
  const span = tb - a.time;
  if (span <= 0) return a;
  const f = Math.max(0, Math.min(1, (t - a.time) / span));
  let ang = b.angle;
  if (a.spin === 0) ang = a.angle;
  else if (a.spin > 0 && ang < a.angle) ang += 360;
  else if (a.spin < 0 && ang > a.angle) ang -= 360;
  const l = (p: number, q: number) => p + (q - p) * f;
  return { ...a, x: l(a.x, b.x), y: l(a.y, b.y), angle: l(a.angle, ang), sx: l(a.sx, b.sx), sy: l(a.sy, b.sy), a: l(a.a, b.a) };
}

// A child's pose inside its parent's.
function combine(p: Pose, c: Pose): Pose {
  const x = c.x * p.sx, y = c.y * p.sy;
  const r = (p.angle * Math.PI) / 180, s = Math.sin(r), co = Math.cos(r);
  const flip = p.sx * p.sy < 0;
  return {
    x: x * co - y * s + p.x, y: x * s + y * co + p.y,
    angle: flip ? p.angle - c.angle : p.angle + c.angle,
    sx: c.sx * p.sx, sy: c.sy * p.sy, a: c.a * p.a,
  };
}

// Every part of the character at time t (milliseconds), in drawing order.
export function evaluate(scml: Scml, anim: SAnim, t: number): PartState[] {
  t = anim.looping ? ((t % anim.length) + anim.length) % anim.length : Math.min(t, anim.length);
  let mk = anim.main[0];
  for (const k of anim.main) if (k.time <= t) mk = k;
  const bones: Pose[] = [];
  for (const r of mk.bones) {
    const local = tween(anim, anim.timelines[r.timeline], r.key, t);
    bones[r.id] = r.parent >= 0 && bones[r.parent] ? combine(bones[r.parent], local) : local;
  }
  const out: PartState[] = [];
  for (const r of mk.objects) {
    const tl = anim.timelines[r.timeline];
    const local = tween(anim, tl, r.key, t);
    const w = r.parent >= 0 && bones[r.parent] ? combine(bones[r.parent], local) : local;
    const file = scml.files.get(local.file ?? '');
    if (!file) continue;
    const f = { ...file, px: local.px ?? file.px, py: local.py ?? file.py };
    out.push({ ...w, slot: tl.name, file: f, z: r.z });
  }
  out.sort((p, q) => p.z - q.z);
  return out;
}
