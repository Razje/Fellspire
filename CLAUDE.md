# Fellspire

A side-scrolling fantasy brawler roguelite in the browser, after Lost Castle 2:
fight through rooms of undead, loot, die, come back stronger. A personal prototype
of Martijn's, built with Claude since 2026-11-23. What the game should become is in
`DESIGN.md`; this file is about working on it.

Martijn is not a programmer. He decides what the game is and how it feels, plays
each step, and says when it is right. Explain in plain words, build in small steps,
and show evidence (test results, a screenshot) rather than claiming something works.

Its git `origin` is the private GitLab project `martijn.terol/fellspire`, created
2026-11-23 by pushing to it. `C:\IXON` (the General repo) ignores this folder.

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

Then http://127.0.0.1:5180. In Claude's browser pane, `preview_start` with the name
`fellspire` (from `C:\IXON\.claude\launch.json`). The pane pauses the game when it is
hidden (0 frames a second), so a screenshot of a hidden pane shows a frozen frame.
`window.game` is the Phaser game in development builds, for inspecting state.

## Testing: after every change

```powershell
npm --prefix C:\IXON\fellspire test
```

Playwright drives the real game in the Edge that comes with Windows (no browser
download), on its own port 5181. `tests/` checks that the title screen comes up
without errors, the menu responds, and the combat rules hold (hits land, blocking and
dodging work, waves clear, the exit leads to the next room). It saves a title-screen
screenshot under `test-results/` to look at. A new feature gets a test with it, and
the suite must pass before a change is called done.

Tests cannot judge feel. "The dodge is sluggish" only comes from Martijn playing it.

## How the code is laid out

| Path | What |
|---|---|
| `src/config.ts` | Tuning knobs: room size, ground strip, per-character size and `footY`, which pack folders feed which animation |
| `src/assets.ts` | Finds art packs under `assets/` by folder name; only the frames used are loaded |
| `src/scenes/BootScene.ts` | Loads frames, builds animations, makes the drawn stand-ins |
| `src/scenes/MenuScene.ts` | Title screen, menu, options, credits |
| `src/titleArt.ts` | The title screen's painted scenery, drawn on canvases at start-up |
| `src/scenes/RoomScene.ts` | A room: waves, exit, HUD, hit resolution, projectiles, pickups |
| `src/entities/` | `Fighter` (shared body, damage, animation), `Player`, `Enemies` (Ghoul, BoneThrower) |
| `src/placeholders.ts`, `src/background.ts` | Drawn stand-in characters and the fight background |
| `src/settings.ts` | Options remembered in the browser |
| `tools/` | `unpack.py` (pack zip into a role folder, shrunk), `shrink.mjs`, `measure-feet.mjs` |

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

The look follows Lost Castle 2 (dark teal night forests, warm light pools, glowing
cyan and violet magic, black foliage framing the screen) with a WoW-like feel for the
UI: gold bevelled lettering, red buttons with gold trim. Fonts are Cinzel and Cinzel
Decorative, bundled from npm.

## Workflow

One feature per step, taken from the build order in `DESIGN.md`: plan it, build it,
run the tests, let Martijn play it, commit when he is happy. Plan first (and get a
yes) for anything bigger than a small fix. Commit only when asked; push only when
asked. Update this file and `DESIGN.md` when the structure or the plan changes, so the
next session does not start from a stale map.
