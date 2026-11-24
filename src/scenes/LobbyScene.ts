// The co-op lobby: two slots, one per player. A player joins by pressing a button on
// their own device (J for the keyboard's left side, Numpad 1 for its right side, A or
// Start on a controller), so any mix of devices works. Once in, that device's own keys
// work the slot: light attack is Ready, the skill key changes the hero, heavy leaves.
// When both are ready the run starts at the camp with those two devices (input.ts's
// party). Esc goes back to the title.
import Phaser from 'phaser';
import { hasHero, heroLook, heroRig, type Who } from '../hero';
import { Controls, deviceName, keyLabels, sameDevice, setParty, type Device } from '../input';
import type { Rig } from '../rig/Rig';
import { makeTitleTextures } from '../titleArt';
import { Frame, bandTextures, keyHint, pic } from '../ui/kit';
import { C, txt } from '../ui/theme';
import { screenCamera } from '../ui/view';

interface Slot {
  device: Device | null;
  ready: boolean;
}

// Kept outside the scene so a trip to character creation and back keeps who joined.
let slots: Slot[] = [{ device: null, ready: false }, { device: null, ready: false }];

const SLOT_X = [262, 698];

export class LobbyScene extends Phaser.Scene {
  private controls: (Controls | null)[] = [null, null];
  private views: Phaser.GameObjects.Container[] = [];
  private rigs: (Rig | null)[] = [null, null];
  private padPrev = new Map<number, boolean[]>();
  private leaving = false;
  private countdown?: Phaser.Time.TimerEvent;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('lobby');
  }

  // back: returning from character creation, so the slots stay as they were
  init(data?: { back?: boolean }) {
    if (!data?.back) slots = [{ device: null, ready: false }, { device: null, ready: false }];
    this.controls = [null, null];
    this.views = [];
    this.rigs = [null, null];
    this.padPrev = new Map();
    this.leaving = false;
    this.countdown = undefined;
  }

  create() {
    screenCamera(this);
    if (!this.textures.exists('tt_sky')) makeTitleTextures(this);
    bandTextures(this);
    const add = this.add;
    add.image(0, 0, 'tt_sky').setOrigin(0).setDepth(0);
    add.image(480, 0, 'tt_far').setOrigin(0.5, 0).setDepth(1);
    add.image(480, 0, 'tt_mid').setOrigin(0.5, 0).setDepth(2);
    add.image(480, 0, 'tt_ground').setOrigin(0.5, 0).setDepth(3);
    add.rectangle(480, 270, 960, 540, 0x02040a, 0.45).setDepth(4);
    add.image(0, 0, 'tt_vignette').setOrigin(0).setDepth(90);

    txt(this, 480, 34, 'Co-op', 'title', { fontSize: '30px' }).setOrigin(0.5).setDepth(100);
    this.status = txt(this, 480, 470, '', 'body', { fontSize: '14px', color: C.body }).setOrigin(0.5).setDepth(100);
    const back = keyHint(this, 0, 510, ['Esc'], 'Back to the title').setDepth(100).setAlpha(0.8);
    back.x = 480 - back.width / 2;

    // devices already in a slot (coming back from character creation) work at once
    slots.forEach((s, i) => { if (s.device) this.controls[i] = this.listen(s.device); });
    for (const i of [0, 1]) this.drawSlot(i);
    this.refreshStatus();

    this.cameras.main.fadeIn(400, 0, 0, 0);
    const seen = new WeakSet<KeyboardEvent>();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (seen.has(e) || this.leaving) return;
      seen.add(e);
      if (e.code === 'Escape') this.leave();
      else if (e.code === 'KeyJ') this.join({ kind: 'left' });
      else if (e.code === 'Numpad1') this.join({ kind: 'right' });
    });
  }

  // A device's keys, with this frame's press already used up (the press that joined
  // must not also count as Ready).
  private listen(d: Device) {
    const c = new Controls(this, d);
    c.read();
    return c;
  }

  private join(d: Device) {
    if (slots.some((s) => s.device && sameDevice(s.device, d))) return;
    const i = slots.findIndex((s) => !s.device);
    if (i < 0) return;
    slots[i] = { device: d, ready: false };
    this.controls[i] = this.listen(d);
    this.cancelCountdown();
    this.drawSlot(i);
    this.refreshStatus();
    // player 2's first time: make a hero before anything else
    if (i === 1 && !hasHero(1)) this.editHero(1);
  }

  private leaveSlot(i: number) {
    slots[i] = { device: null, ready: false };
    this.controls[i] = null;
    this.cancelCountdown();
    this.drawSlot(i);
    this.refreshStatus();
  }

  private toggleReady(i: number) {
    slots[i].ready = !slots[i].ready;
    if (slots[i].ready) this.rigs[i]?.play('Slashing', true, { loop: false, duration: 600 });
    this.drawSlot(i);
    this.refreshStatus();
    if (slots.every((s) => s.device && s.ready)) this.startCountdown();
    else this.cancelCountdown();
  }

  private editHero(i: number) {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    cam.fade(300, 0, 0, 0, true);
    cam.once('camerafadeoutcomplete', () => this.scene.start('create', { then: 'lobby', who: i as Who, device: slots[i].device ?? undefined }));
  }

  private startCountdown() {
    this.cancelCountdown();
    this.countdown = this.time.delayedCall(900, () => this.begin());
  }

  private cancelCountdown() {
    this.countdown?.remove();
    this.countdown = undefined;
  }

  private begin() {
    if (this.leaving) return;
    this.leaving = true;
    setParty(slots.map((s) => s.device!));
    const cam = this.cameras.main;
    cam.flash(250, 255, 170, 90);
    this.time.delayedCall(150, () => cam.fade(700, 0, 0, 0, true));
    cam.once('camerafadeoutcomplete', () => this.scene.start('room', { room: 0 })); // the camp
  }

  private leave() {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    cam.fade(300, 0, 0, 0, true);
    cam.once('camerafadeoutcomplete', () => this.scene.start('menu', { skipIntro: true }));
  }

  private refreshStatus() {
    const n = slots.filter((s) => s.device).length;
    const ready = slots.filter((s) => s.ready).length;
    this.status.setText(
      n < 2 ? 'Two players needed. Each joins on their own keyboard side or controller.'
        : ready < 2 ? 'Both players press their light attack when ready.'
        : 'Into the camp...',
    );
  }

  // ---- a slot ---------------------------------------------------------------------

  private drawSlot(i: number) {
    this.views[i]?.destroy();
    this.rigs[i]?.destroy();
    this.rigs[i] = null;
    const s = slots[i];
    const x = SLOT_X[i];
    const v = this.add.container(x, 250).setDepth(50);
    this.views[i] = v;
    const f = new Frame(this, 0, 0, 380, 360, s.ready ? 'gold' : 'dark', `Player ${i + 1}`);
    v.add(f);

    if (!s.device) {
      v.add(txt(this, 0, -110, 'Press to join', 'head', { fontSize: '18px', color: C.ivory }).setOrigin(0.5));
      v.add(pic(this, 0, -86, 'ui_ornament'));
      const rows: [string[], string][] = [[['J'], 'Keyboard, left side'], [['Num 1'], 'Keyboard, right side'], [['A'], 'A controller']];
      rows.forEach(([keys, what], k) => {
        const h = keyHint(this, 0, -46 + k * 34, keys, what);
        h.x = -h.width / 2;
        v.add(h);
      });
      v.add(txt(this, 0, 96, 'Two on one keyboard: one on WASD and J K L,\nthe other on the arrows and the numpad.', 'small', { fontSize: '11px', color: C.grey, align: 'center', strokeThickness: 0 }).setOrigin(0.5));
      return;
    }

    const look = heroLook(i as Who);
    v.add(this.add.ellipse(0, 96, 120, 20, 0x000000, 0.5));
    // the rig draws itself, so it sits beside the container rather than in it
    const rig = heroRig(this, x, 250 + 98, 290 / 900, look);
    if (rig) { rig.setDepth(52); this.rigs[i] = rig; }
    v.add(txt(this, 0, -146, look.name, 'head', { fontSize: '17px' }).setOrigin(0.5));
    v.add(txt(this, 0, -124, deviceName(s.device), 'small', { fontSize: '12px', color: C.teal }).setOrigin(0.5));
    if (s.ready) v.add(txt(this, 0, 116, 'Ready', 'head', { fontSize: '20px', color: C.green }).setOrigin(0.5));
    const k = keyLabels(s.device);
    const hints = [keyHint(this, 0, 0, [k.light], s.ready ? 'Not ready' : 'Ready'), keyHint(this, 0, 0, [k.skill], 'Change hero'), keyHint(this, 0, 0, [k.heavy], 'Leave')];
    const w = hints.reduce((a, h) => a + h.width, 0) + 16 * (hints.length - 1);
    let hx = -w / 2;
    for (const h of hints) { h.setPosition(hx, 148); hx += h.width + 16; v.add(h); }
  }

  update(_t: number, dms: number) {
    for (const r of this.rigs) {
      if (!r) continue;
      r.step(dms);
      if (r.done) r.play('Idle');
    }
    if (this.leaving) return;

    // a controller not yet in a slot joins with A or Start
    const gp = this.input.gamepad;
    for (const pad of gp?.getAll() ?? []) {
      const prev = this.padPrev.get(pad.index) ?? [];
      const hit = (b: number) => !!pad.buttons[b]?.pressed && !prev[b];
      if (hit(0) || hit(9)) this.join({ kind: 'pad', index: pad.index });
      this.padPrev.set(pad.index, pad.buttons.map((b) => b.pressed));
    }

    // each player works their own slot with their own device
    for (const i of [0, 1]) {
      const c = this.controls[i];
      if (!c || this.leaving) continue;
      const inp = c.read();
      if (inp.heavy) this.leaveSlot(i);
      else if (inp.skill) this.editHero(i);
      else if (inp.light) this.toggleReady(i);
    }
  }
}
