# Fellspire

A side-scrolling fantasy brawler roguelite in the browser, after Lost Castle 2:
fight through rooms of undead, loot, die, come back stronger. A personal prototype
of Martijn's, built with Claude since 2026-11-23. What the game should become is in
`DESIGN.md`; this file is about working on it.

Martijn is not a programmer. He decides what the game is and how it feels, plays
each step, and says when it is right. Explain in plain words, build in small steps,
and show evidence (test results, a screenshot) rather than claiming something works.

Its git `origin` is Martijn's own **private GitHub repository**
`https://github.com/Razje/Fellspire`, since 2026-11-24. Before that it lived on IXON's
GitLab (`martijn.terol/fellspire`, created 2026-11-23); that project is kept as the
remote `gitlab`, a backup that is no longer pushed to, and still holds the old history.
`C:\IXON` (the General repo) ignores this folder.

**Commits use the GitHub no-reply address** `111313434+Razje@users.noreply.github.com`,
set in this repo's local git config: this is a personal project, so the work address
stays out of it. The whole history was rewritten to that address on the move, so
commit ids before 2026-11-24 differ from GitLab's. A clone on another machine that
still points at GitLab must be re-cloned from GitHub, not pulled, and needs the
address set again:

```powershell
git clone https://github.com/Razje/Fellspire.git C:\IXON\fellspire
```

```powershell
git -C C:\IXON\fellspire config --local user.email 111313434+Razje@users.noreply.github.com
```

```powershell
git -C C:\IXON\fellspire config --local user.name "Martijn Terol"
```

## Hard rules

- **No Blizzard or World of Warcraft material**, not models, art, sound, names or
  logos, even though the project started from a WoW-themed idea. Familiar fantasy is
  fine (orcs, liches, paladins); Blizzard's specific characters, places and designs
  are not. Asked and settled on 2026-11-23.
- **Art packs never go into git.** The CraftPix licence forbids passing on the source
  files, and `.gitignore` keeps all of `assets/` out except its README.
- **Commands for Martijn are PowerShell 5.1**: one command per block, absolute
  paths, no `&&`.

## Running it

```powershell
node C:\IXON\fellspire\node_modules\vite\bin\vite.js C:\IXON\fellspire
```

Then http://127.0.0.1:5180, http://127.0.0.1:5180/?boss to go straight to the
boss fight (`?boss&area=fellspire` for the last one, which wins the run),
http://127.0.0.1:5180/?area=frostmere&level=3 for a level of an area (`?area=2` takes
the first area of tier 2), http://127.0.0.1:5180/?camp for the camp, or
http://127.0.0.1:5180/?coop for the co-op lobby. In Claude's browser pane, `preview_start` with the name
`fellspire` (from `C:\IXON\.claude\launch.json`). The pane pauses the game when it is
hidden (0 frames a second), so a screenshot of a hidden pane shows a frozen frame.
`window.game` is the Phaser game in development builds, for inspecting state.

## A copy to send someone

```powershell
node C:\IXON\fellspire\tools\package.mjs
```

Builds `release\Fellspire.html`, one self-contained file (art, fonts and code inside,
about 26 MB) that opens by double-clicking with no install or internet, and zips it
with a how-to-play note as `release\Fellspire-<date>.zip`. Checked on 2026-11-24 by
opening it from disk in Edge and playing into room 1. Only the art the game shows
goes in (`KEEP` in the script); the CraftPix licence allows art inside a game, not
the source files on their own. `release/` is ignored by git.

**Check every new package from disk before handing it over**: open
`release\Fellspire.html` in Playwright's Edge (a `file://` URL), wait about 25 s for
it to load, and play into the camp. The dev server and the test suite never see what
`KEEP` leaves out. On 2026-11-24 the copy had been broken since character creation
(8.2) mixed all three Valkyrie part sets while `KEEP` held only the first: the left-out
Spriter files arrived empty and crashed the start-up on a blank title. `KEEP` now has
all three, and `rig/parts.ts` skips an empty pack instead of crashing. The release
build has no `window.game`, so drive it with keys, clicks and screenshots.

## Testing: after every change

While working, run only the tests a change can affect:

```powershell
npm --prefix C:\IXON\fellspire run test:changed
```

Before a commit, and whenever `test:changed` says so, run everything:

```powershell
npm --prefix C:\IXON\fellspire test
```

Playwright drives the real game in the Edge that comes with Windows (no browser
download). `tests/` checks that the title screen comes up without errors, the menu
responds, the combat rules hold (hits land, blocking and dodging work, waves clear,
the exit leads to the next room), and every feature since. It saves screenshots under
`test-results/` to look at. A new feature gets a test with it, and the suite must pass
before a change is called done.

**How the suite runs (since 2026-11-27).** Four tests at a time (`PW_WORKERS` changes
it), each worker with its own dev server on ports 5181 and up, Edge on the real GPU:
about 4 minutes instead of 11.8 (with the frame sheets, below). Every spec imports `test` from `tests/fixtures.ts`, not
from `@playwright/test`: that sets each worker's server and records, from the browser's
own code coverage, which functions of `src/` each test ran (`.covermap/`, ignored by
git, rebuilt by every run). `tools/test-changed.mjs` maps each changed line to the
function around it (TypeScript's parser) and runs just the tests that ran it: one line
in `RoomScene.raise` ran the 3 revive and Undying tests in 58 s. Comments, types and
imports run nothing; a change outside any function (data such as `AREAS`) runs every
test that used the file; a changed spec runs whole; config, `index.html`, package files
or no record yet run everything. `--dry` says what it would run, a commit id compares
against that commit instead of the last one.

- **Booting the game is the cost of a test.** It took about 8 s while 369 frames loaded as
  separate images; packed into 3 sheets (`tools/pack-sheets.mjs`, see Art) the title is
  up in about 3 s. More workers stop helping past four on this laptop because that work
  is CPU in every browser.
- **Never return a scene from `page.evaluate`.** `scene.start()` and `scene.restart()`
  return Phaser's scene plugin, and an arrow like `() => game.scene....start('room')`
  hands it back, so Playwright copied the whole game object graph to the test: about
  3 s each time, in 14 places. Use a block body, `() => { ...start('room'); }`.
- **Never rely on a check from outside catching a moment in the game.** Under load
  Playwright's polling lagged 7 s of game time behind: the boss test saw the Warden
  only after he had summoned minions. Stop the clock (`game.loop.sleep()`) and step it
  by hand (`game.step(t, 16.7)`) when a test needs the first frames.
- **Coverage is lost across a reload unless it is taken before.** The fixture takes it
  inside `page.goto` and `page.reload`; watching for the new page's request was too late,
  and holding that request deadlocked the browser. A test must leave a page only through
  those two. It also opens `/tsconfig.json` first, because coverage switched on in the
  blank start page does not follow the move to the game's process.

Tests cannot judge feel. "The dodge is sluggish" only comes from Martijn playing it.

## How the code is laid out

| Path | What |
|---|---|
| `src/world.ts` | The run's shape as data: the eight areas (`AREAS`: name, tier 0 to 4, the objective's heading, `look` = the colour wash, moonlight, fireflies and rune light, the boss's name), five levels per area with the boss last (`LEVELS_PER_AREA`), the level types (`normal`, `challenge`, `elite`, `boss`), `depth(tier, level)` that waves, foes and chests scale with, `rollGateTypes` for a pair of gates, `findArea` for `?area=` |
| `src/config.ts` | Tuning knobs: foes' extra health in co-op (`COOP`), room size (an arena of 1500 x 660, floor from `groundTop` to `groundBottom`), per-character size and `footY`, which pack folders feed which animation |
| `src/assets.ts` | Finds art packs under `assets/` by folder name; only the frames used are loaded, from the packed sheets when they hold them all (`artFrames` gives each frame as a `FrameRef`: texture key, and the cell in a sheet), else one file each |
| `src/artPick.ts` | Which frames each character uses (`pickFrames`), shared by the game and `tools/pack-sheets.mjs`; imports only types, so Node can load it |
| `src/scenes/BootScene.ts` | Loads frames, builds animations, makes the drawn stand-ins |
| `src/scenes/MenuScene.ts` | Title screen and its menu (New Run, Character, Options, Credits); Options and Credits come from `ui/panels.ts`. Shows your hero at the campfire once one is made |
| `src/scenes/CreateScene.ts` | Character creation: the hero large on the left, the choices in a gilded panel. `then: 'run'` starts the camp after, `'menu'` returns to the open menu, `'lobby'` to the co-op lobby; `who` is the player (0 or 1) |
| `src/scenes/LobbyScene.ts` | The co-op lobby (`?coop`): two slots joined from any device, Ready / Change hero / Leave on each player's own keys; both ready sets the party and opens the camp |
| `src/hero.ts` | The players' characters: the saved look per player (`fellspire.hero`, and `fellspire.hero2` for co-op's player 2), the names of the choices, `heroRig()` / `dressRig()` that put the look on a rig |
| `src/scenes/HudScene.ts` | Runs on top of a room: a unit frame and action bar per hero (player 1 bottom left, player 2 bottom right, mirrored), room plaque, objective, banners, pause menu, end screen, the chest's cards (`openChoice`: one side per player in co-op, each answering only its own device's keys), the rack (`openRack`, the opener's turn) and the ember shrine (`openShrine`); `shop` is whichever of the two is open. Owns Esc |
| `src/ui/theme.ts` | Fonts, colours, `txt()` for sharp text, `gild()` for gradient lettering |
| `src/ui/kit.ts` | Every UI part, painted at 2x: `Frame`, `Button`, `keycap`/`keyHint`, `Bar`, `Slot` and icons, `CheckRow`, `SliderRow`, `ChoiceRow` (◀ value ▶), `TextRow` (a typed name), `FocusList` (keys, stick and mouse), banner bands, the cursor |
| `src/ui/panels.ts` | Modal panels shared by the title screen and the pause menu: Options, Credits |
| `src/ui/view.ts` | The 2x camera zoom and the parallax correction that goes with it |
| `src/titleArt.ts` | The title screen's painted scenery, drawn on canvases at start-up; its helpers (`canvas`, `rng`, `trunk`) are shared with `blightwood.ts` |
| `src/hub.ts` | The camp between runs, which is room 0 of `RoomScene`: where things stand (`CAMP`), the campfire, the weapon rack and what it offers (`RACK_KINDS`), the chosen weapon remembered in the browser (`fellspire.weapon`), the ember shrine's altar |
| `src/shrine.ts` | The ember shrine's upgrade tree as data (`SHRINE`: branch, row and column, `after` = the upgrades that open it, a cost per rank, the effect and how much per rank), what is learned (`fellspire.shrine`), `buyRank`, and `shrineBonus()`, everything learned added up by effect, which every hero's `gearStats(gear, shrineBonus())` folds in; the shrine-only effects (`ShrineOnly` in `loot.ts`) have their rules in `Player` (skill cooldown, dodge safety) and `RoomScene` (gold, start gold, chest cards, Undying) |
| `src/ui/shrine.ts` | The shrine's panel (`ShrinePanel`): the three branches as trees of discs joined by lines, the bank, a card for the selected upgrade; its glyphs are drawn here. Opened by `HudScene.openShrine` |
| `src/ui/armory.ts` | The rack's store (`WeaponShop`): tabs per weapon type, a grid, the equipped and selected weapons compared as cards; opened by `HudScene.openRack` |
| `src/scenes/RoomScene.ts` | A room: `heroes` (one per device in the party; `player` is player 1, `stats` player 1's), the camera on the middle of the living heroes and the `LEASH` between them, `nearestHero` for enemies, a fallen hero in co-op (`checkFallen`, her `Soul`, `raise`), waves, exit, hit resolution (`strike(attacker, by, ...)`, the one path for swings, shots and skill areas; `by` is the hero whose gear bonuses apply) with gear bonuses and effects, projectiles, pickups, coins, breakable props, the room chest, combat text, run stats; launches the HUD. `room` is the level in the area (1 to 5; 0 is the camp), `area`, `levelType` and `depth` say where the run is. Level 5 is the boss's glade: his introduction, the darkness and circle of light, then the gates to the next areas (or victory in the last). Until each area has its own boss the Warden stands in everywhere, with 50% more health per tier |
| `src/room/` | `RoomScene`'s methods by subject, split out on 2026-11-27 so the class stays readable: `waves.ts` (waves, and opening the gates when they are done), `gates.ts` (where each gate leads, `planGates` before the room is built and `placeGates` after, the signs over them, all living heroes in one gate takes them through, "Waiting for"), `gearFx.ts` (healing, chain lightning, burning ground), `loot.ts` (coins, barrels and crates, the chest, `equip`), `camp.ts` (rack and shrine), `bossFight.ts` (the Warden's glade and its darkness), `feedback.ts` (dust, shake, combat text, sparks). Each exports a `<part>Methods` object whose methods take `this: RoomScene`; the end of `RoomScene.ts` mixes them in, so callers still write `scene.openChest()`. **Give every method here an explicit return type and no default that reads `this`** (`by: Player = this.player`): either makes TypeScript's type of the part depend on itself and the whole room stops type-checking. RoomScene's fields are public for the same reason (the parts read them) |
| `src/weapons.ts` | The weapon types as data (`WEAPONS`: label, block or not, light combo, heavy, the skills a weapon can carry, names) and the skills' names and cooldowns (`SKILLS`). A move can shoot (`shot`), cut along its lunge (`sweep`, the blades' dash), set its own hit-stop (`stop`), kick the hero back (`recoil`), make her untouchable until it lands (`evade`) and spend a round (`ammo`, with the weapon's `mag`). A new weapon type starts here |
| `src/revive.ts` | Co-op revives: a fallen hero's `Soul` (the glow over her body, the ring with its gold sweet-spot arc, the key prompt), who is holding interact by it, and when she gets up; tuning in `REVIVE` |
| `src/skills.ts` | How each skill plays out (`SKILL_TUNING` holds its numbers): it returns how long the hero is busy and puts an effect on the room that runs each frame |
| `src/shots.ts` | The player's arrows, bolts, orbs, sparks, pellets and bullets in flight (guns leave a `muzzle()` flash and smoke): first foe or barrel hit, piercing, bursting, a spread fanned up and down the floor, seeking (`homing`); `launch()` sends one with any velocity, for skills |
| `src/entities/` | `Fighter` (shared body, damage, animation, `lift` for a leap), `Player` (`who` is 0 or 1, `stats` its own gear's; reads its moves and skill from `weapons.ts`, its keys through `input.ts`: L dodge, Shift block, I skill; a press of J/K queues one attack and turns her to the side held, holding repeats and keeps her facing; walks at `ATTACK_MOVE` speed while attacking; attacks never aim up or down), `Enemies` (Ghoul, BoneThrower; each goes for `scene.nearestHero`, kept in `hunted`), `Warden` (the boss: moves, phases, his tuning numbers in `WARDEN`), `Dummy` (the camp's training dummy: an enemy that only rocks when hit, never loses health, and counts damage per second) |
| `src/blightwood.ts` | The fight room, for every area: background layers, the tree line, one painted floor, props with footprints (`obstacles`, `pushOut`), torches and their light (`lightAt` tints characters), one or two rune-ring gates (`exits`, top to bottom, each in its own light), foreground framing. Another area gets the same textures washed in its colour by `areaKey` (a canvas `color` blend, copied once per area as `<key>@<area>`) |
| `src/placeholders.ts` | Drawn stand-in characters for missing art |
| `src/loot.ts` | Rarities, weapons, armor kits, trinkets and their effects, as lists; `rollChest`, `gearStats` (what everything carried adds up to), card lines |
| `src/run.ts` | One run's state carried between rooms: stats, gold (one shared purse), embers earned this run, player 1's `gear` and player 2's `gear2`, whose Undying is spent (`risen`), the areas taken (`route`, the current one last) and the types of this area's levels so far (`levels`); `gearOf(run, who)` |
| `src/embers.ts` | Embers, kept between runs: what each deed gives (`EMBERS`), the bank in the browser (`fellspire.embers`, one for the party), `earnEmbers` (banks at once; `RoomScene.earn` also pulses the HUD) and `spendEmbers` for the shrine |
| `src/ui/items.ts` | Item icons, the chest's choice cards, hover tooltips |
| `src/ui/runmap.ts` | Where the run is, drawn: a glyph and colour per level type (`levelGlyph`, `TYPE_COLOUR`: swords, hourglass, crown, skull), the area's five levels under the room plaque (`levelStrip`), the road of five tiers on the pause menu (`roadPanel`) |
| `src/rig/` | Characters from parts: `scml.ts` reads the packs' Spriter files and works out each part's pose, `Rig.ts` draws them with part swaps (another pack's head, a drawn weapon by its grip), `parts.ts` loads `assets/parts/`, `weapons.ts` the drawn greatsword, bow, staff, dagger, wand, blunderbuss and revolver and `armRig()` that puts the carried weapon in the hand (dual blades and revolvers put the second one on the shield's slot), `skin.ts` the skin tones and the recolour that finds a part's skin by colour |
| `src/scenes/RigLabScene.ts` | The rig lab, `?rig`: frames and parts side by side, overlaid, and mixed characters |
| `src/input.ts` | Which device drives a hero (`Device`: solo, the keyboard's left or right side, a controller) and its keys and buttons; `Controls.read()` turns it into one frame's `Input`; `getParty()` is who plays on what (set by the menu and the lobby, kept across restarts); `keyLabels()` the keys to show; `menuKey()` / `menuPad()` / `menuLabels()` which keys and controller work a menu for a device. Tests press `p.keys[...]`, the Phaser names of that device's keys |
| `src/settings.ts` | Options remembered in the browser |
| `tools/` | `unpack.py` (pack zip into a role folder, shrunk), `unpack-parts.py` (a pack's separate parts and Spriter file into `assets/parts/`), `shrink.mjs`, `measure-feet.mjs`, `test-changed.mjs` (runs the tests a change affects; see Testing), `pack-sheets.mjs` (character frames into sheets; see Art), `package.mjs` |

Keep it that way as it grows: new enemies, weapons and rooms should become data
(definitions in a list), not more branches in `Player` or `RoomScene`. Large single
files are what makes AI-built games fall apart.

## Art

Characters are CraftPix chibi packs, unzipped by role into `assets/characters/<role>/`
with `python -I tools/unpack.py <zip> <hero|ghoul|archer>`, which also shrinks the
900 px frames to 256 px (graphics memory). The feet sit at 0.84 of the frame in all
three packs so far; measure a new pack with `node tools/measure-feet.mjs`. The game
picks animations by folder name (`Idle`, `Walking`, `Slashing`, ...). CraftPix
downloads need Martijn's sign-in; downloads from the browser pane reach him as a save
dialog. macOS zips carry `__MACOSX/._*.png` files that are not images; the tools skip
them.

**After unpacking character art, or changing a character's variant or animation folders
(`CHARACTERS`, `ANIM_SOURCES` in `config.ts`), pack the frames again:**

```powershell
node C:\IXON\fellspire\tools\pack-sheets.mjs
```

It packs the frames each character uses into grid sheets of 16 x 8 cells
(`assets/sheets/<character>-<n>.png`, plus `sheets.json` saying where each frame went;
ignored by git like all art), about 4 s. The choice of frames is `src/artPick.ts`, the
same code the game runs, so they cannot disagree. A character whose frames are not all
in the sheets loads its files one by one instead and says so in the console: slower,
never broken. `tools/package.mjs` packs fresh sheets itself and ships them instead of
the separate frames (the copy went from about 26 to 17 MB).

**14 free chibi packs are in `assets/packs/` since 2026-11-27** and their parts are
unpacked in `assets/parts/`: Valkyrie, Skeleton Warrior, Zombie Villager, Skeleton
Crusader, Dark Oracle, Necromancer of the Shadow (one variant is a Frozen Lich), Forest
Ranger, Bloody Alchemist, Seer, Minotaur, Reaper Man, Fallen Angel, Golem, and Orc /
Ogre / Goblin. **All share one rig** (bones `bone_000`-`007`, the same part names, the same
18 animations), checked by parsing each `Animations.scml`. Exceptions: Skeleton Crusader
adds a shield bone like the Valkyrie; Bloody Alchemist lacks Idle Blinking and Face 02;
Forest Ranger has Shooting, Run Shooting and Shooting in The Air with a Bow and an Arrow
part instead of the three slashes, a real draw-and-shoot for the player's bow. CraftPix
downloads from the browser pane wait on a save dialog in the desktop app, so the pane
must be showing; the files host refuses a direct fetch (403).

`lost-castle-2-reference.md` is Martijn's write-up of Lost Castle 2 (look, HUD,
combat, rooms, bosses); read the relevant section before designing a step. The look follows Lost Castle 2 (dark teal night forests, warm light pools, glowing
cyan and violet magic, black foliage framing the screen) with a WoW-like feel for the
UI: gold bevelled lettering, red buttons with gold trim. Fonts are Cinzel and Cinzel
Decorative, bundled from npm.

## Things that bite

- **The player is drawn from parts** (`src/rig/`, `HERO_PARTS` in `config.ts`, dressed
  in the saved look by `hero.ts`, which mixes all three Valkyrie sets) when
  `assets/parts/` holds them; run `python -I tools/unpack-parts.py <zip> x` for each
  pack zip in `assets/packs/` on a new machine. Without them the game falls back to
  the frames. Enemies still use frames. `RIG_ANIMS` maps the game's animation names
  to the pack's Spriter animations.

- **Depth is drawing order.** Everything on the floor sets its depth to its feet's
  y (characters y + 10, props y), so whoever stands lower on screen is drawn in
  front. Floor-level effects (light pools 0.5, shadows 1, attack markers 2) sit
  just above the floor (-50), combat text 19000, foreground framing 15000. The HUD
  is a separate scene drawn over the room.
- **The canvas is 1920 x 1080, the game is laid out in 960 x 540**, at 16:9. On a
  wider window `WORLD.viewW` grows (worked out once at load, up to the room's 1500), so
  the room and HUD show more; use `WORLD.viewW`, never 960, for the screen's width there.
  The title, character and lobby screens keep a 960 stage in the middle
  (`screenCamera(scene, true)`, `STAGE_LEFT`/`STAGE_RIGHT`) and `titleArt.ts` paints
  their scenery wide enough for the sides. `tests/wide.spec.ts` covers it. Every camera is
  zoomed 2x (`ui/view.ts`). Phaser zooms around the camera's middle, so a screen
  scene calls `screenCamera()`, the room uses `worldView.x` (not `scrollX`) for the
  left edge of the view, and anything in the room with a scroll factor other than 1
  is corrected by `shiftParallax()` after it is built. Screen-pinned things go in
  `HudScene`, not in the room with `setScrollFactor(0)`.
- **UI art is painted at twice its size** with `hi()` and shown with `pic()` at half
  scale; text goes through `txt()` (resolution 2). A UI part drawn any other way looks
  soft next to the rest. Build screens from `ui/kit.ts` parts so they match.
- A drawn frame's drop shadow is a filled shape: clear its middle
  (`destination-out`) or it hides whatever sits inside. Cost the action bar its icons once.
- **Phaser sometimes delivers one key event twice** (same `timeStamp`), so a
  `keydown` listener that moves a selection must ignore an event it has already
  handled; `MenuScene` uses a `WeakSet`. Found by the menu test, 2026-11-23.
  `Key.isDown`/`JustDown` in the fight are not affected.
- **Bash heredocs eat backslashes** in this harness (see `C:\IXON\CLAUDE.md`).
  Write scripts with the Write tool. A Python script that edits files must open them
  with `newline=''` (or in binary): text mode on Windows writes every line back as
  CRLF. Found 2026-11-25, eleven files at once.
- **A camera fade is ignored while another one runs.** `fadeOut` during the title's
  1.4 s fade-in did nothing, so `camerafadeoutcomplete` never came and the screen never
  changed. Leaving a scene uses `cam.fade(ms, 0, 0, 0, true)` (forced). Found by the
  character creation test, 2026-11-24.
- **Skin is found by colour** (`rig/skin.ts`): the most common warm, light colour in a
  part, grown into every connected skin-like pixel, keeping only big areas. Gauntlets and
  gloves have none and are left alone. A new pack's heads need checking against it.
- **Hit-stop freezes the whole room**, the player's input reading included. A test
  that steps the game by hand and presses a key right after a hit loses the press;
  step ten frames first. Found by the weapon tests, 2026-11-24.
- **The pack's sword is hidden (alpha 0) in Idle, Walking and Throwing**; it only
  shows while swinging. A drawn weapon swapped in for it sets `show` so it stays in
  the hand, and `rest` turns it upright while the pack would have hidden it.
- **A swapped weapon can vanish behind the body.** At rest the pack keeps its sword's
  layer at the very back, which a long staff or bow sticks out of but a short wand
  does not. A swap with `front: 'Right Hand.png'` (`rig/Rig.ts`) is drawn just under
  that hand whatever the pose. Found on the wand, 2026-11-24.
- **Hit-stop costs quick weapons more.** 45 ms per hit nearly matched a dual-blade
  cut's whole length and made the blades barely faster than the sword in a held-J
  test; their light cuts use `stop: 22`.
- **The borrowed Throwing animation swings the arm overhead**, so a gun on the sword's
  grip pointed at the sky mid-shot. A part swap with `level` (`rig/Rig.ts`) keeps the
  hand's position but holds the part at a fixed angle. Found on the blunderbuss, 2026-11-24.
- **Knockback is set, not added, and fades fast** (1600 px/s per second in
  `Fighter.physics`): knock 170 moved a foe about 9 px, and a foe walks back while
  being pushed. A knock meant to be felt needs 350 or more.
- A screen over the room (the rack) needs a shade of about 0.9: at 0.66 the HUD's
  bars and key hints show through and clash with its own.
- **Fight keys go by position (`KeyboardEvent.code`), not keyCode.** With Num Lock off,
  Numpad 2 arrives as Arrow Down (keyCode 40), and Playwright's Edge always sends the
  numpad that way, so Phaser's own keys (keyCode-based) cannot tell player 2's heavy
  attack from walking down. `Controls` makes its own Phaser `Key`s and feeds them from
  the keyboard events by code. It also remembers a press until read: releasing a Phaser
  Key clears its JustDown, so a tap that goes down and up between two frames (every
  `page.keyboard.press` in a test) was lost. And it ignores an event it has seen: a
  duplicate key-down arriving after the key-up left the key held. Found 2026-11-24.
- **Measure frame rate in headless Edge with the real GPU**, not in the browser pane
  or a visible window: Windows throttles a hidden pane or a covered window to a few
  frames a second, which looks exactly like the game slowing down. `chromium.launch({
  channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist',
  '--enable-gpu'] })` reports the AMD GPU and gives a steady 80-85 fps. A bot that plays
  the game must read `hud.choice` while the room is paused: the chest pauses the room
  until a card is taken, so a bot waiting for the room waits forever. Both cost a false
  "freeze" report on 2026-11-27.
- Phaser tweens time themselves by the real clock, so stepping the game by hand
  in a tight loop moves sprites but not tweens. Tests that need tweens wait.

## Workflow

One feature per step, taken from the build order in `DESIGN.md`: plan it, build it,
run the tests, let Martijn play it, commit when he is happy. Plan first (and get a
yes) for anything bigger than a small fix. Commit only when asked; push only when
asked. Update this file and `DESIGN.md` when the structure or the plan changes, so the
next session does not start from a stale map.
